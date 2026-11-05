// wir-home: Brücke zwischen der Wir-App und Home Assistant. Der Browser redet nie direkt mit Home Assistant.
// - hält eine dauerhafte WebSocket-Verbindung zu HA (ha.js) – oder simuliert HA im Testmodus (sim.js),
//   solange HA_URL/HA_TOKEN in /etc/wir-home.env fehlen
// - schreibt die Zustände der freigegebenen Geräte in die PocketBase-Collection home_state (Realtime an beide Handys)
// - nimmt Befehle NUR von PocketBase entgegen (POST http://127.0.0.1:8095/cmd, siehe pb_hooks/wir_zuhause.pb.js),
//   prüft sie gegen die Freigabeliste (config.jsonc) und begrenzt die Rate
// - 24-h-Verlauf für das Raumklima, Wetter von Open-Meteo (zwischengespeichert)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const conf = require('./config');
const { Sim } = require('./sim');

const env = (k, d) => (process.env[k] ?? d);
const need = k => { const v = process.env[k]; if (!v) { console.error('Fehlt: ' + k); process.exit(1); } return v; };
const PB = need('PB_URL').replace(/\/$/, '');
const PB_EMAIL = need('PB_EMAIL');
const PB_PASSWORD = need('PB_PASSWORD');
const PORT = Number(env('HOME_PORT', 8095));
const CONFIG = env('HOME_CONFIG', path.join(__dirname, 'config.jsonc'));
// Platzhalter ("", "HIER…") zählen als nicht gesetzt -> Testmodus
const real = v => !!v && !/^(HIER|<|x+$)/i.test(v.trim());
const HA_URL = real(env('HA_URL', '')) ? env('HA_URL').trim() : '';
const HA_TOKEN = real(env('HA_TOKEN', '')) ? env('HA_TOKEN').trim() : '';

const log = (...a) => console.log(new Date().toISOString(), ...a);

// ----------------------------------------------------------------------
// PocketBase (als Dienst-Superuser)
// ----------------------------------------------------------------------
let token = null, tokenAt = 0;
async function auth() {
  const r = await fetch(PB + '/api/collections/_superusers/auth-with-password', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: PB_EMAIL, password: PB_PASSWORD }),
  });
  if (!r.ok) throw new Error('PocketBase-Login fehlgeschlagen: ' + r.status);
  token = (await r.json()).token;
  tokenAt = Date.now();
}
async function api(method, p, body, retry = true) {
  if (!token || Date.now() - tokenAt > 3600000) await auth();
  const r = await fetch(PB + p, {
    method, headers: { Authorization: token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 401 && retry) { token = null; return api(method, p, body, false); }
  const t = await r.text();
  if (!r.ok) { const e = new Error(`${method} ${p} -> ${r.status} ${t.slice(0, 200)}`); e.status = r.status; throw e; }
  return t ? JSON.parse(t) : null;
}

// home_state: ein Datensatz pro Schlüssel, Schreiben gebündelt (mehrere Änderungen in 80 ms = ein Schreibvorgang)
const ids = new Map();      // key -> record id
const cache = new Map();    // key -> zuletzt geschriebene Daten (JSON)
const dirty = new Map();    // key -> Daten, die noch geschrieben werden müssen
let flushTimer = null, flushing = false;

async function loadRecords() {
  for (let page = 1; ; page++) {
    const res = await api('GET', `/api/collections/home_state/records?page=${page}&perPage=200&skipTotal=1`);
    for (const r of res.items) { ids.set(r.key, r.id); cache.set(r.key, JSON.stringify(r.data)); }
    if (res.items.length < 200) break;
  }
}
function put(key, data) {
  const j = JSON.stringify(data);
  if (cache.get(key) === j && !dirty.has(key)) return;
  dirty.set(key, data);
  if (!flushTimer) flushTimer = setTimeout(flush, 80);
}
async function flush() {
  flushTimer = null;
  if (flushing) { flushTimer = setTimeout(flush, 80); return; }
  flushing = true;
  const batch = [...dirty.entries()];
  dirty.clear();
  for (const [key, data] of batch) {
    const j = JSON.stringify(data);
    if (cache.get(key) === j) continue;
    try {
      if (ids.has(key)) await api('PATCH', `/api/collections/home_state/records/${ids.get(key)}`, { data });
      else {
        try { ids.set(key, (await api('POST', '/api/collections/home_state/records', { key, data })).id); }
        catch (err) {
          // gibt es schon (z. B. nach Neustart) -> nachladen und aktualisieren
          const f = encodeURIComponent(`key="${key.replace(/"/g, '')}"`);
          const r = await api('GET', `/api/collections/home_state/records?filter=${f}&perPage=1`);
          if (!r.items[0]) throw err;
          ids.set(key, r.items[0].id);
          await api('PATCH', `/api/collections/home_state/records/${r.items[0].id}`, { data });
        }
      }
      cache.set(key, j);
    } catch (err) {
      log('home_state schreiben', key, err.message);
      if (!dirty.has(key)) dirty.set(key, data);
      if (!flushTimer) flushTimer = setTimeout(flush, 5000);
    }
  }
  flushing = false;
}

// ----------------------------------------------------------------------
// Konfiguration (wird bei Änderung der Datei neu gelesen)
// ----------------------------------------------------------------------
let C = null;
function readConfig() {
  const c = conf.load(CONFIG);
  c.cfg.allowIds = [...c.allow.keys()];
  if (c.errors.length) log('Konfiguration – übersprungen:', c.errors.join(' | '));
  return c;
}

// öffentlicher Teil der Konfiguration für die App (enthält keine Geheimnisse)
function publicConfig() {
  const { allowIds, fernseher, ...rest } = C.cfg;
  let tv = null;
  if (fernseher) { const { intern: _, ...f } = fernseher; tv = { ...f, titel: !!fernseher.intern.adb }; }
  return { ...rest, fernseher: tv, fehler: C.errors };
}

// ----------------------------------------------------------------------
// Verbindung zu Home Assistant (oder Simulator)
// ----------------------------------------------------------------------
let backend = null;
const states = new Map();
const meta = { mode: 'test', connected: false, error: '', scene: '', scene_at: '', since: new Date().toISOString(), beat: 0 };

// nur die Felder speichern, die die App braucht
const ATTRS = ['friendly_name', 'brightness', 'color_mode', 'rgb_color', 'color_temp_kelvin', 'min_color_temp_kelvin', 'max_color_temp_kelvin',
  'supported_color_modes', 'last_triggered', 'unit_of_measurement', 'device_class', 'percentage', 'current',
  'volume_level', 'is_volume_muted', 'media_title', 'media_series_title', 'media_artist', 'app_name', 'source',
  'media_duration', 'media_position', 'media_position_updated_at', 'app_id', 'current_activity', 'supported_features'];
function slim(s) {
  const a = {};
  for (const k of ATTRS) if (s.attributes && s.attributes[k] !== undefined) a[k] = s.attributes[k];
  return { state: String(s.state), a, changed: s.last_changed || '' };
}

function onState(s) {
  const was = states.get(s.entity_id);
  states.set(s.entity_id, s);
  // interne Entitäten (ADB) nie nach home_state – nur die ausgewertete Antwort
  if (s.entity_id === intern.adb) {
    adbSeq++; tvEcht(); tvWatchState(s.entity_id, was); kinoLicht(s, was);
    // gerade angegangen: "Bild aus" ist vorbei; Apps/Eingänge lesen (höchstens alle 6 h)
    const off = ['off', 'unavailable', 'unknown', undefined];
    if (tvIsOn() && off.includes(was?.state)) {
      if (tvx.bild_aus) tvxSet({ bild_aus: false });
      setTimeout(() => tvxDiscover().catch(err => log('Fernseher-Apps lesen:', err.message)), 20000);
    }
    return;
  }
  tvWatchState(s.entity_id, was);
  // Sonnenaufgang startet (Lichtwecker oder Test) -> ggf. Fernseher zur Weckzeit
  if (C.cfg.wecker?.test && s.entity_id === C.cfg.wecker.test && s.state === 'on' && was && was.state !== 'on') weckerTv().catch(err => log('Wecker-Fernseher:', err.message));
  // Wecker-Helfer tauchen in HA auf (Paket gerade eingespielt) -> Einstellungen übertragen
  if (C.allow.get(s.entity_id)?.kind === 'wecker' && (!was || was.missing) && !s.missing) weckerSoon();
  put(s.entity_id, slim(s));
  klimaSample(s.entity_id, s.state);
}

function setMeta(patch) {
  Object.assign(meta, patch);
  meta.beat = Date.now();
  put('_meta', { ...meta });
}

function startBackend() {
  if (HA_URL && HA_TOKEN) {
    const { HA } = require('./ha');
    backend = new HA(HA_URL, HA_TOKEN, C.cfg);
    meta.mode = 'live';
    log('Modus: echt (Home Assistant)');
  } else {
    backend = new Sim(C.cfg);
    meta.mode = 'test';
    log('Modus: TEST (HA_URL/HA_TOKEN nicht gesetzt) – Home Assistant wird simuliert');
  }
  backend.on('state', onState);
  backend.on('status', st => {
    if (st.connected !== meta.connected || st.error !== meta.error) log('Status:', st.connected ? 'verbunden' : 'getrennt', st.error || '');
    setMeta({ connected: st.connected, error: st.error });
    if (st.connected) {
      klimaBackfill().catch(err => log('Klima-Verlauf', err.message));
      weckerSoon();
      kalender().catch(err => log('Kalender:', err.message));
      tvDiscover().catch(err => log('Fernseher suchen:', err.message));
    }
  });
  backend.start();
}

// ----------------------------------------------------------------------
// Raumklima: Werte alle 10 Minuten in den 24-h-Verlauf (_klima)
// ----------------------------------------------------------------------
const KEEP_MS = 24 * 3600000, STEP_MS = 10 * 60000;
let klima = { series: {} };
const klimaIds = () => [C.cfg.klima.temperatur, C.cfg.klima.luftfeuchte, C.cfg.klima.co2].filter(Boolean);

function klimaSample(id, value, force) {
  if (!klimaIds().includes(id)) return;
  const v = parseFloat(value);
  if (!Number.isFinite(v)) return;
  const arr = klima.series[id] || (klima.series[id] = []);
  const now = Date.now();
  const last = arr[arr.length - 1];
  if (last && now - last[0] < STEP_MS && !force) { last[1] = Math.round(v * 10) / 10; }   // aktuellen Punkt nachziehen
  else arr.push([now, Math.round(v * 10) / 10]);
  klimaTrim();
  put('_klima', klima);
}
function klimaTrim() {
  const min = Date.now() - KEEP_MS;
  for (const id of Object.keys(klima.series)) {
    if (!klimaIds().includes(id)) { delete klima.series[id]; continue; }
    klima.series[id] = klima.series[id].filter(p => p[0] >= min);
  }
}
// nach dem Start: Lücken aus dem HA-Verlauf (bzw. Simulator) füllen
async function klimaBackfill() {
  const missing = klimaIds().filter(id => (klima.series[id] || []).length < 12);
  if (!missing.length) return;
  const h = await backend.history(missing, 24);
  for (const id of missing) {
    const pts = (h[id] || []);
    if (!pts.length) continue;
    // auf 10-Minuten-Schritte verdichten
    const out = [];
    for (const p of pts.sort((a, b) => a[0] - b[0])) {
      const l = out[out.length - 1];
      if (l && p[0] - l[0] < STEP_MS) l[1] = p[1]; else out.push([p[0], p[1]]);
    }
    const merged = [...out, ...(klima.series[id] || [])].sort((a, b) => a[0] - b[0]);
    klima.series[id] = merged;
  }
  klimaTrim();
  put('_klima', klima);
}

// ----------------------------------------------------------------------
// Wetter (Open-Meteo, ohne Schlüssel) – alle 20 Minuten, für beide Geräte zwischengespeichert
// ----------------------------------------------------------------------
async function weather() {
  const w = C.cfg.wetter;
  if (!w) return;
  const q = new URLSearchParams({
    latitude: w.lat, longitude: w.lon, timezone: 'Europe/Berlin', forecast_days: 2,
    current: 'temperature_2m,apparent_temperature,weather_code,is_day',
    hourly: 'temperature_2m,weather_code,is_day,precipitation',
    daily: 'sunrise,sunset,temperature_2m_min,temperature_2m_max,weather_code',
  });
  const r = await fetch('https://api.open-meteo.com/v1/forecast?' + q, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error('Open-Meteo ' + r.status);
  const d = await r.json();
  const nowIso = d.current.time;
  const start = d.hourly.time.findIndex(t => t > nowIso);
  const hours = [];
  for (let i = Math.max(0, start); i < d.hourly.time.length && hours.length < 6; i++) {
    hours.push({ h: +d.hourly.time[i].slice(11, 13), t: Math.round(d.hourly.temperature_2m[i]), code: d.hourly.weather_code[i], day: d.hourly.is_day[i] });
  }
  // erste Stunde mit Niederschlag in den nächsten 24 h (für "Regen ab 2 Uhr")
  let regen = '';
  for (let i = Math.max(0, start - 1); i < Math.min(d.hourly.time.length, start + 24); i++) {
    if ((d.hourly.precipitation[i] || 0) >= 0.2) { regen = String(+d.hourly.time[i].slice(11, 13)); break; }
  }
  put('_wetter', {
    ort: w.ort, regen_ab: regen,
    heute: { min: Math.round(d.daily.temperature_2m_min[0]), max: Math.round(d.daily.temperature_2m_max[0]), code: d.daily.weather_code[0] },
    now: { t: Math.round(d.current.temperature_2m), feels: Math.round(d.current.apparent_temperature), code: d.current.weather_code, day: d.current.is_day },
    hours,
    sunset: (d.daily.sunset || [])[0] || '', sunrise: (d.daily.sunrise || [])[0] || '',
    at: new Date().toISOString(),
  });
}

// ----------------------------------------------------------------------
// Kalender: Testmodus = Testtermine aus der Konfiguration; echt = calendar.… aus HA (REST), alle 10 Minuten
// Format pro Termin: { d, t, e, n, w } oder ganztägig über mehrere Tage { s, to, n, w }
// ----------------------------------------------------------------------
let kalIds = null;   // zuletzt gefundene calendar.… (nur lesen)
async function kalender() {
  const K = C.cfg.kalender;
  const test = () => put('_kalender', { termine: K.testtermine, test: true, farben: K.farben });
  if (meta.mode === 'test') return test();
  if (!meta.connected) return;
  // automatisch: alle Kalender, die der HA-Benutzer sehen kann (+ eingetragene Zuordnung), sonst nur die eingetragenen
  let quellen = K.quellen.slice();
  if (K.automatisch) {
    // ohne eingerichtete Kalender-Integration antwortet HA mit 404 -> keine Kalender
    const list = await backend.rest('/api/calendars').catch(err => { if (err.status === 404) return []; throw err; });
    const known = new Map(K.quellen.map(q => [q.entity_id, q.wer]));
    quellen = (Array.isArray(list) ? list : []).map(c => String(c.entity_id || ''))
      .filter(id => /^calendar\.[a-z0-9_]+$/.test(id)).slice(0, 12)
      .map(id => ({ entity_id: id, wer: known.get(id) || K.standard }));
  }
  const ids = quellen.map(q => q.entity_id).join(', ');
  if (ids !== kalIds) { kalIds = ids; log('Kalender:', ids || 'keine gefunden – Testtermine bleiben'); }
  if (!quellen.length) return test();
  const pad = n => String(n).padStart(2, '0');
  const day = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const now = new Date(), from = new Date(now.getFullYear(), now.getMonth() - 1, 1), to = new Date(now.getFullYear(), now.getMonth() + 3, 1);
  const out = [];
  for (const q of quellen) {
    let evs;
    try { evs = await backend.rest(`/api/calendars/${q.entity_id}?start=${encodeURIComponent(from.toISOString())}&end=${encodeURIComponent(to.toISOString())}`); }
    catch (err) { log('Kalender', q.entity_id, err.message); continue; }
    for (const ev of Array.isArray(evs) ? evs : []) {
      const n = String(ev.summary || '').slice(0, 60);
      if (ev.start?.date) {
        const s = ev.start.date, e = new Date(ev.end?.date || s); e.setDate(e.getDate() - 1);
        const toD = day(e);
        out.push(toD > s ? { s, to: toD, n, w: q.wer } : { d: s, t: '', e: '', n, w: q.wer });
      } else if (ev.start?.dateTime) {
        const s = new Date(ev.start.dateTime), e = new Date(ev.end?.dateTime || ev.start.dateTime);
        out.push({ d: day(s), t: hm(s), e: hm(e), n, w: q.wer });
      }
    }
  }
  put('_kalender', { termine: out.slice(0, 400), test: false, farben: K.farben, quellen: quellen.length });
}

// ----------------------------------------------------------------------
// Lichtwecker: Wecker-Einstellungen der App (home_settings "wecker") -> Helfer in HA (die Automation läuft lokal in HA).
// Der erste eingeschaltete Wecker der Liste bestimmt Zeit und Tage. "Morgen aussetzen" -> input_boolean aussetzen.
// Gesetzt wird nur, was abweicht. Auslöser: Änderung in der App (PocketBase-Hook -> POST /wecker), Verbinden, alle 15 Min.
// ----------------------------------------------------------------------
const DEF_WECKER = { alarms: [{ zeit: '5:00', tage: [0, 1, 2, 3, 4], an: true }], vorlauf: 15, aussetzen: '' };
let weckerT = null, weckerBusy = false;
function weckerSoon(ms = 800) { clearTimeout(weckerT); weckerT = setTimeout(() => weckerSync().catch(err => log('Wecker:', err.message)), ms); }
async function weckerSync() {
  const wk = C.cfg.wecker;
  if (!wk.ok || !meta.connected) return;
  if (weckerBusy) return weckerSoon(2000);
  weckerBusy = true;
  try {
    const f = encodeURIComponent('key="wecker"');
    const r = await api('GET', `/api/collections/home_settings/records?filter=${f}&perPage=1&skipTotal=1`);
    const w = r.items[0]?.data || DEF_WECKER;
    const a = (Array.isArray(w.alarms) ? w.alarms : []).find(x => x && x.an && Array.isArray(x.tage) && x.tage.length && /^\d{1,2}:\d{2}$/.test(String(x.zeit)));
    const pad = n => String(n).padStart(2, '0');
    const [hh, mm] = a ? String(a.zeit).split(':').map(Number) : [5, 0];
    const zeit = `${pad(hh)}:${pad(mm)}:00`;
    const vorlauf = Math.max(0, Math.min(30, Math.round(Number(w.vorlauf) || 0)));
    // aussetzen gilt, wenn der ausgesetzte Tag ein aktiver Wecktag ist und dessen Weckzeit noch bevorsteht
    const now = new Date(), today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    let skip = false;
    if (a && /^\d{4}-\d{2}-\d{2}$/.test(String(w.aussetzen || ''))) {
      const [y, mo, d] = w.aussetzen.split('-').map(Number), sd = new Date(y, mo - 1, d, hh, mm);
      skip = a.tage.includes((sd.getDay() + 6) % 7) && (w.aussetzen > today || (w.aussetzen === today && now < sd));
    }
    const want = [[wk.aktiv, !!a], ...wk.tage.map((id, i) => [id, !!a && a.tage.includes(i)])];
    if (wk.aussetzen) want.push([wk.aussetzen, skip]);
    const calls = [];
    for (const [id, on] of want) if (states.get(id)?.state !== (on ? 'on' : 'off')) calls.push(['input_boolean', on ? 'turn_on' : 'turn_off', id, {}]);
    if (states.get(wk.zeit)?.state !== zeit) calls.push(['input_datetime', 'set_datetime', wk.zeit, { time: zeit }]);
    if (wk.vorlauf && Number(states.get(wk.vorlauf)?.state) !== vorlauf) calls.push(['input_number', 'set_value', wk.vorlauf, { value: vorlauf }]);
    let n = 0;
    for (const [dom, svc, id, data] of calls) {
      if (!states.has(id) || states.get(id).missing) continue;   // Paket noch nicht eingespielt
      await backend.call(dom, svc, [id], data);
      n++;
    }
    if (n) log(`Wecker übertragen (${n}): ${a ? zeit.slice(0, 5) + ' · Tage ' + a.tage.map(i => ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][i]).join(',') + ' · Vorlauf ' + vorlauf + ' Min' : 'aus'}${skip ? ' · einmal aussetzen' : ''}`);
  } finally { weckerBusy = false; }
}

// ----------------------------------------------------------------------
// Fernseher zuverlässig einschalten: im Standby schläft das Netzwerk des Fernsehers, media_player.turn_on allein
// klappt dann selten. Darum Magic Packet (Wake on LAN) + turn_on (+ ADB-Wakeup) alle 2 s, bis er an ist (max. 25 s).
// Normalweg ist das HA-Skript fernseher.an_skript (script.wir_tv_an aus ha/packages/wir.yaml); fehlt es, macht
// wir-home dasselbe selbst. Läuft eine Einschalt-Routine, steht in _meta "tv_wake" (Zeitpunkt) – die App zeigt dann
// "Fernseher wird gestartet …"; klappt es nicht, "tv_fail" (dezenter Hinweis).
// Ausschalten aus der App: per ADB in den Android-Schlaf (KEYCODE_SLEEP) statt Power-Taste – dann bleibt das WLAN wach
// und ADB-Wakeup (KEYCODE_WAKEUP) holt ihn zurück; die Power-Taste schickt den Xiaomi in den Tiefschlaf (nur Fernbedienung).
// ----------------------------------------------------------------------
const TV_OFF = ['off', 'standby', 'unavailable', 'unknown'];
const WAKE_MS = 45000, WAKE_STEP = 2000;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const intern = { adb: '', wol: '' };      // gefundene interne Entitäten (nie an die App)
// Ist der Fernseher WIRKLICH an? media_player.fernseher (Android TV Remote) hat assumed_state: nach turn_on steht er sofort
// auf "an", auch wenn der Fernseher gar nicht aufwacht. Gibt es die ADB-Entität, zählt deshalb nur sie (Bildschirm an =
// nicht off/unavailable/unknown; "standby" ist dort der Bildschirmschoner, also an).
const tvIsOn = () => {
  const tv = C.cfg.fernseher;
  if (!tv) return false;
  if (intern.adb && states.get(intern.adb)) return !['off', 'unavailable', 'unknown'].includes(states.get(intern.adb).state);
  return !!states.get(tv.entity_id) && !TV_OFF.includes(states.get(tv.entity_id).state);
};
// für die App: echter Zustand in _meta.tv_an (true/false), null = unbekannt (dann gilt media_player.fernseher)
function tvEcht() {
  const v = intern.adb && states.get(intern.adb) ? tvIsOn() : null;
  if (v !== meta.tv_an) setMeta({ tv_an: v });
}
const skriptDa = () => { const id = C.cfg.fernseher?.an_skript; return !!id && !!states.get(id) && !states.get(id).missing; };

// ADB- und Wake-on-LAN-Entität: aus der Konfiguration oder "auto" (ADB = media_player mit adb_response, WOL = button.wake_on_lan_…)
async function tvDiscover() {
  const tv = C.cfg.fernseher;
  if (!tv || !backend.overview) return;
  const want = tv.intern;
  let found = { adb: want.adb === 'auto' ? '' : want.adb, wol: want.wol === 'auto' ? '' : want.wol };
  if (want.adb === 'auto' || want.wol === 'auto') {
    const { entities } = await backend.overview();
    // ADB: hat das Attribut adb_response – außer der Fernseher schläft (dann "unavailable" ohne Attribute):
    // dann am Namen der Integration erkennen ("Android TV …") bzw. die zuletzt gefundene behalten
    const adbs = entities.filter(e => e.id.startsWith('media_player.'));
    if (want.adb === 'auto') found.adb = (adbs.find(e => e.attrs.includes('adb_response')) || adbs.find(e => e.id === intern.adb)
      || adbs.find(e => /^media_player\.android_tv_/.test(e.id) || /^Android TV /.test(e.name)))?.id || '';
    // alle Wake-on-LAN-Knöpfe (der Fernseher kann mehrere Schnittstellen/MACs haben), mit Komma getrennt
    if (want.wol === 'auto') found.wol = entities.filter(e => /^button\..*wake_?on_?lan/.test(e.id)).map(e => e.id).sort().join(',');
  }
  if (found.adb !== intern.adb || found.wol !== intern.wol) {
    log('Fernseher intern:', 'ADB', found.adb || '–', '· WOL', found.wol || '–');
    Object.assign(intern, found);
    backend.setConfig(C.cfg, intern.adb ? [intern.adb] : []);
    put('_config', publicConfig());
    if (!intern.adb) put('_tv', {});
  }
}

// Android-Schlaf per ADB; geht das nicht (keine ADB-Entität, Fehler), wie bisher die Power-Taste.
// Vorher Pause (Musik-Apps wie Spotify spielen im Android-Schlaf sonst weiter – das ist nur bei "Bild aus" gewollt).
function tvSleep() {
  const tv = C.cfg.fernseher;
  const power = () => backend.call('media_player', 'turn_off', [tv.entity_id], {});
  if (tvx.bild_aus) tvxSet({ bild_aus: false });
  if (!intern.adb) return power();
  return backend.call('androidtv', 'adb_command', [intern.adb], { command: 'input keyevent 127; input keyevent 223' }, 10000)
    .then(() => backend.call('homeassistant', 'update_entity', [intern.adb], {}).catch(() => {}))
    .catch(err => { log('ADB-Schlaf fehlgeschlagen, Power-Taste:', err.message); return power(); });
}

let waking = null;
// variante: 'auto' (Skript, sonst selbst alles), zum Messen auch 'tv' (nur turn_on), 'wol' (alle Knöpfe),
// 'wol0'/'wol1' (nur dieser eine Knopf), 'wol_adb', 'skript', 'adb' (nur ADB-Wakeup)
function tvWake(variante = 'auto') {
  if (waking) return waking;
  const tv = C.cfg.fernseher, t0 = Date.now();
  const fire = (d, s, id) => { if (id) backend.call(d, s, id.split(','), {}).catch(() => {}); };
  const one = /^wol(\d)$/.exec(variante), wol = one ? intern.wol.split(',')[+one[1]] || '' : intern.wol;
  const useSkript = variante === 'skript' || (variante === 'auto' && skriptDa());
  setMeta({ tv_wake: new Date().toISOString(), tv_fail: '' });
  waking = (async () => {
    if (useSkript) fire('script', 'turn_on', tv.an_skript);
    for (let n = 0; Date.now() - t0 < WAKE_MS; n++) {
      // ADB-Wakeup aus dem Android-Schlaf (im Schlaf kommt etwa jeder zweite Befehl an, darum bei jedem Schritt)
      if (['auto', 'adb', 'wol_adb'].includes(variante) && intern.adb) backend.call('androidtv', 'adb_command', [intern.adb], { command: 'input keyevent 224' }, 8000).catch(() => {});
      if (variante === 'adb') fire('homeassistant', 'update_entity', intern.adb);
      else if (!useSkript) {
        if (variante !== 'tv') fire('button', 'press', wol);
        fire('media_player', 'turn_on', tv.entity_id);
        if (['auto', 'wol_adb'].includes(variante)) fire('media_player', 'turn_on', intern.adb);
      }
      // ADB-Zustand sofort neu abfragen (sonst erst beim nächsten Abfrage-Intervall der Integration)
      if (!useSkript) fire('homeassistant', 'update_entity', intern.adb);
      const until = t0 + (n + 1) * WAKE_STEP;
      while (Date.now() < until && !tvIsOn()) await sleep(100);
      if (tvIsOn()) return Date.now() - t0;
    }
    return 0;
  })().then(ms => {
    log(ms ? `Fernseher an nach ${(ms / 1000).toFixed(1)} s (${useSkript ? 'Skript' : variante})` : `Fernseher nach ${WAKE_MS / 1000} s nicht an (${useSkript ? 'Skript' : variante})`);
    setMeta({ tv_wake: '', tv_fail: ms ? '' : new Date().toISOString() });
    return ms;
  }).finally(() => { waking = null; });
  return waking;
}
// Skript läuft in HA (z. B. aus "Filmabend") -> App zeigt "wird gestartet …", Ende ohne Erfolg -> Hinweis
let skriptT0 = 0;
function tvWatchState(id, was) {
  const tv = C.cfg.fernseher;
  if (!tv || waking) return;
  const s = states.get(id);
  if (id === tv.an_skript && s.state === 'on' && was?.state !== 'on') { skriptT0 = Date.now(); setMeta({ tv_wake: new Date().toISOString(), tv_fail: '' }); }
  if (id === tv.an_skript && s.state === 'off' && was?.state === 'on' && skriptT0) {
    const ms = Date.now() - skriptT0; skriptT0 = 0;
    log(tvIsOn() ? `Fernseher an (HA-Skript, ${(ms / 1000).toFixed(1)} s)` : 'Fernseher: HA-Skript ohne Erfolg beendet');
    setMeta({ tv_wake: '', tv_fail: tvIsOn() ? '' : new Date().toISOString() });
  }
  if ((id === tv.entity_id || id === intern.adb) && tvIsOn() && meta.tv_fail) setMeta({ tv_fail: '' });
}

// ----------------------------------------------------------------------
// ADB (nur wir-home, nie die App): feste Lese-Befehle über androidtv.adb_command, nacheinander (Warteschlange).
// Die Antwort steht danach im Attribut adb_response der ADB-Entität.
// ----------------------------------------------------------------------
let adbQ = Promise.resolve(), adbSeq = 0, adbMark = 0;
function adb(command, timeoutMs = 20000) {
  const run = async () => {
    if (!intern.adb) throw new Error('keine ADB-Entität');
    // Kennung vorneweg: ohne sie stünde bei einer verspäteten/fehlenden Antwort noch die vorige im Attribut
    // (so bekam Twitch einmal das Spotify-APK)
    const mark = `__wir${Date.now().toString(36)}${(adbMark++).toString(36)}__`;
    await backend.call('androidtv', 'adb_command', [intern.adb], { command: `echo ${mark}; ${command}` }, timeoutMs);
    // die Zustandsänderung kommt über das Abo – kurz darauf warten
    const t0 = Date.now();
    let r = '';
    while (!(r = String(states.get(intern.adb)?.attributes?.adb_response ?? '')).startsWith(mark) && Date.now() - t0 < 3000) await sleep(100);
    if (!r.startsWith(mark)) throw new Error('keine ADB-Antwort');
    return r.slice(mark.length).replace(/^\r?\n/, '');
  };
  const p = adbQ.then(run, run);
  adbQ = p.catch(() => {});
  return p;
}

// ----------------------------------------------------------------------
// "Läuft gerade" mit Titel und Position: wir-home liest per ADB die Media-Session des Fernsehers (+ Laufzeit des
// Fernsehers, um die Position auf "jetzt" umzurechnen) – nur solange der Fernseher an ist und Zuhause offen ist (die
// App meldet sich per "tv.watch" alle 30 s), höchstens alle 10 s. Ergebnis in home_state "_tv".
// ----------------------------------------------------------------------
const ADB_CMD = 'dumpsys media_session; cat /proc/uptime';
const POLL_MS = 10000, WATCH_MS = 45000;
let watchUntil = 0, adbBusy = false, adbErr = '', lastRaw = '', adbLast = 0;

// dumpsys media_session -> Sitzungen (Paket, Zustand, Position, Titel/Untertitel/Beschreibung)
// Android 9 gibt von den Metadaten nur "size" und die Beschreibung aus – eine Gesamtdauer steht dort nicht.
function parseSessions(raw) {
  const out = [];
  const txt = String(raw || '');
  const up = parseFloat((txt.match(/\n\s*(\d+\.\d+)\s+\d+\.\d+\s*$/) || [])[1]);   // /proc/uptime (Sekunden seit Start)
  const blocks = txt.split(/\n(?=\s*package=)/).slice(1);
  for (const b of blocks) {
    const g = re => (b.match(re) || [])[1];
    const pk = g(/package=([\w.]+)/);
    if (!pk) continue;
    const st = Number(g(/state=PlaybackState \{state=(\d+)/) ?? -1);
    let desc = g(/metadata:[^\n]*?description=([^\n]*)/) || '';
    const parts = desc.split(', ').map(x => (x === 'null' ? '' : x.trim()));
    // MediaDescription.toString() = "Titel, Untertitel, Beschreibung" (Titel kann selbst Kommas enthalten)
    const beschreibung = parts.length >= 3 ? parts.pop() : '';
    const untertitel = parts.length >= 2 ? parts.pop() : '';
    const titel = parts.join(', ');
    // Position: Stand bei "updated" (ms seit Start); spielt sie, läuft sie mit "speed" weiter
    const p = Number(g(/state=PlaybackState \{[^}]*?position=(-?\d+)/)), upd = Number(g(/state=PlaybackState \{[^}]*?updated=(\d+)/));
    const speed = Number(g(/state=PlaybackState \{[^}]*?speed=([\d.]+)/) ?? 1);
    let pos = Number.isFinite(p) && p >= 0 ? p : -1;
    if (pos >= 0 && st === 3 && Number.isFinite(up) && Number.isFinite(upd) && up * 1000 >= upd) pos += (up * 1000 - upd) * speed;
    out.push({ paket: pk, aktiv: /active=true/.test(b), zustand: st, titel, untertitel, beschreibung, pos: pos >= 0 ? Math.round(pos / 1000) : -1 });
  }
  return out;
}
// Staffel/Folge aus Texten wie "S2:F4", "S2 E4", "Staffel 2, Folge 4", "Season 2 Episode 4"
function staffelFolge(t) {
  const m = String(t || '').match(/\b(?:S|Staffel|Season)\s*(\d{1,2})\s*[:.,·|-]?\s*(?:E|F|Folge|Episode|Ep\.?)\s*(\d{1,3})\b/i);
  return m ? { staffel: +m[1], folge: +m[2] } : null;
}
function mediaInfo(raw) {
  // nur, was die App wirklich liefert: Titel und/oder Position (Netflix z. B. nur die Position)
  const all = parseSessions(raw).filter(s => s.titel || s.untertitel || s.pos >= 0);
  // spielend (3) vor pausiert (2) vor dem Rest, aktive Sitzung bevorzugt
  const rank = s => (s.zustand === 3 ? 4 : s.zustand === 2 ? 2 : 0) + (s.aktiv ? 1 : 0);
  const s = all.sort((a, b) => rank(b) - rank(a))[0];
  if (!s || rank(s) < 2) return {};
  const sf = staffelFolge(s.titel) || staffelFolge(s.untertitel) || staffelFolge(s.beschreibung);
  // pos = Sekunden zum Zeitpunkt "at" (-1 = liefert die App nicht); die App zählt bei "spielt" selbst weiter
  return { paket: s.paket, titel: s.titel.slice(0, 120), untertitel: s.untertitel.slice(0, 120), staffel: sf?.staffel || 0, folge: sf?.folge || 0,
    spielt: s.zustand === 3, pos: s.pos, at: new Date().toISOString() };
}
// Zeitstempel "at" nur bei echter Änderung neu setzen – sonst würde home_state alle 10 s geschrieben
let tvLast = '';
function tvMedia(raw) {
  lastRaw = raw;
  const info = tvIsOn() ? mediaInfo(raw) : {};
  const { at, pos, ...rest } = info;
  // Position: nur schreiben, wenn sie von der weitergezählten abweicht (Spulen, Pause) – > 3 s
  const prev = cache.get('_tv') ? JSON.parse(cache.get('_tv')) : {};
  const sig = JSON.stringify(rest);
  const erwartet = prev.pos >= 0 ? prev.pos + (prev.spielt ? (Date.now() - Date.parse(prev.at)) / 1000 : 0) : -1;
  if (sig === tvLast && (pos ?? -1) >= 0 === erwartet >= 0 && Math.abs((pos ?? -1) - erwartet) <= 3) return;
  tvLast = sig;
  put('_tv', info);
}
async function tvPoll(force) {
  if (!intern.adb || !meta.connected || adbBusy || logosBusy) return;
  if (!tvIsOn()) { if (cache.get('_tv') !== '{}') { tvLast = ''; put('_tv', {}); } return; }
  if (!force && Date.now() > watchUntil) return;
  adbBusy = true; adbLast = Date.now();
  try {
    tvMedia(await adb(ADB_CMD));
    adbErr = '';
  } catch (err) {
    if (err.message !== adbErr) log('Titel per ADB nicht lesbar:', err.message);   // jede Fehlerart nur einmal
    adbErr = err.message;
  } finally { adbBusy = false; }
}

// ----------------------------------------------------------------------
// App-Logos vom Fernseher (home/tvlogos.js) -> PocketBase home_logos (geschützte Dateien). Einmal täglich, sobald der
// Fernseher an ist, oder per Knopf in den Einstellungen ("tv.logos"). Nur geänderte App-Versionen werden neu gelesen.
// Stand in home_state "_logos" (die App lädt die Bilder nur neu, wenn sich "stand" ändert).
// ----------------------------------------------------------------------
const tvlogos = require('./tvlogos');
const LOGO_TAG_MS = 24 * 3600000;
let logosBusy = null;
async function pbForm(method, p, form, retry = true) {
  if (!token || Date.now() - tokenAt > 3600000) await auth();
  const r = await fetch(PB + p, { method, headers: { Authorization: token }, body: form });
  if (r.status === 401 && retry) { token = null; return pbForm(method, p, form, false); }
  if (!r.ok) throw new Error(`${method} ${p} -> ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
function logosRefresh(force) {
  if (logosBusy) return logosBusy;
  const tv = C.cfg.fernseher;
  if (!tv || meta.mode !== 'live' || !intern.adb || !tvIsOn()) return Promise.resolve(null);
  const pakete = [...new Set(tv.apps.map(a => a.paket).filter(Boolean))];
  const alt = JSON.parse(cache.get('_logos') || '{}');
  put('_logos', { ...alt, laeuft: true });
  logosBusy = tvlogos.refresh(pakete, {
    adb: cmd => adb(cmd),
    call: (d, s, ids, data) => backend.call(d, s, ids, data, 300000),
    signPath: p => backend.signPath(p),
    haBase: HA_URL.replace(/\/+$/, ''),
    adbEntity: intern.adb,
    log,
    async list() {
      const r = await api('GET', '/api/collections/home_logos/records?perPage=200&skipTotal=1');
      return Object.fromEntries(r.items.map(x => [x.paket, x]));
    },
    async save(paket, rec, img) {
      const f = new FormData();
      f.set('paket', paket);
      for (const [k, v] of Object.entries(rec)) f.set(k, String(v));
      if (img) f.set('bild', new Blob([img.buf], { type: img.typ }), `${paket.replace(/\W/g, '_')}.${img.ext}`);
      const ex = (await this.list())[paket];
      if (ex) await pbForm('PATCH', `/api/collections/home_logos/records/${ex.id}`, f);
      else await pbForm('POST', '/api/collections/home_logos/records', f);
    },
    // App nicht (mehr) installiert -> altes Logo weg (die Kachel zeigt dann wieder nur Name + Farbe)
    async remove(paket) {
      const ex = (await this.list())[paket];
      if (ex) await api('DELETE', `/api/collections/home_logos/records/${ex.id}`);
    },
  }, force).then(erg => {
    // nur Fehler (z. B. HA-Weg gesperrt) -> Stand nicht weiterzählen, in einer Stunde erneut (logosFaellig)
    const ok = erg.some(([, r]) => !r.startsWith('Fehler'));
    put('_logos', { stand: ok ? new Date().toISOString() : alt.stand || '', fehler_at: ok ? '' : new Date().toISOString(), laeuft: false, ergebnis: erg.map(([p, r]) => `${p}: ${r}`) });
    return erg;
  }).catch(err => {
    log('Logos:', err.message);
    put('_logos', { ...alt, laeuft: false });
    return null;
  }).finally(() => { logosBusy = null; });
  return logosBusy;
}
function logosFaellig() {
  const { stand: st, fehler_at: fe } = JSON.parse(cache.get('_logos') || '{}');
  if (fe && Date.now() - Date.parse(fe) < 3600000) return;
  if (!st || Date.now() - Date.parse(st) > LOGO_TAG_MS) logosRefresh(false);
}

// ----------------------------------------------------------------------
// Fernseher-Extras per ADB: weitere installierte Apps, Eingänge (HDMI), Text eingeben, Bild aus (Ton an), Bildschirmfoto.
// Stand für die App in home_state "_tvx": { apps: [{ paket, name, farbe }], eingaenge: [{ key, name }], bild_aus,
// bildschirm: { laeuft, at, fehler } }. Die Listen liest wir-home vom Fernseher, sobald er an ist (höchstens alle 6 h).
// ----------------------------------------------------------------------
const APP_INFO = {   // bekannte Apps: Name + Farbe (sonst aus dem Paketnamen gebildet)
  'com.android.vending': ['Play Store', '#34a853'], 'com.crunchyroll.crunchyroid': ['Crunchyroll', '#f47521'],
  'com.google.android.videos': ['Google TV', '#4285f4'], 'com.internet.tvbrowser': ['TV Browser', '#7b5cff'],
  'com.mediatek.wwtv.tvcenter': ['Live-TV', '#2fd4c4'], 'com.mitv.gallery': ['Galerie', '#a99bff'],
  'com.surfshark.vpnclient.android': ['Surfshark', '#1ebfbf'], 'de.prosiebensat1digital.seventv': ['Joyn', '#ff3c78'],
  'de.telekom.magentatv.atv': ['MagentaTV', '#e20074'], 'de.toggo': ['TOGGO', '#ff6a00'],
  'com.xiaomi.mitv.mediaexplorer': ['Medien (USB)', '#ffb36b'],
};
// System-Apps ohne Nutzen als Kachel
const APP_WEG = new Set(['com.mitv.tvhome.atv', 'com.mitv.tvhome.mitvplus', 'com.xiaomi.mitv.tvmanager', 'com.google.android.music',
  'com.google.android.play.games', 'com.android.tv.settings']);
const appName = p => {
  const teile = p.split('.').filter(t => !['com', 'de', 'tv', 'android', 'app', 'atv', 'mobile', 'www', 'org', 'net', 'apps', 'leanback'].includes(t));
  const t = teile[teile.length - 1] || p;
  return t.charAt(0).toUpperCase() + t.slice(1);
};
let tvx = { apps: [], eingaenge: [], bild_aus: false, bildschirm: null };
const tvxIds = new Map();   // Eingang key -> TV-Input-ID (nur intern)
let tvxAt = 0;
function tvxSet(patch) { Object.assign(tvx, patch); put('_tvx', tvx); }

async function tvxDiscover(force) {
  if (!intern.adb || !tvIsOn() || (!force && Date.now() - tvxAt < 6 * 3600000)) return;
  tvxAt = Date.now();
  const out = await adb(`cmd package query-activities --brief -a android.intent.action.MAIN -c android.intent.category.LEANBACK_LAUNCHER; echo =====; dumpsys tv_input | grep HDMIInputService/HW; echo =====; settings get global ${HELL_KEY}`);
  const [teilA, teilB = '', teilC = ''] = out.split('=====');
  const hell = parseInt(teilC.trim(), 10);
  if (Number.isFinite(hell)) tvxSet({ helligkeit: hell });
  const fest = new Set(C.cfg.fernseher.apps.map(a => a.paket).filter(Boolean));
  const pakete = [...new Set([...teilA.matchAll(/^\s*([a-zA-Z][\w.]+)\/\S+/gm)].map(m => m[1]))].filter(p => !fest.has(p) && !APP_WEG.has(p));
  const apps = pakete.map(p => ({ paket: p, name: APP_INFO[p]?.[0] || appName(p), farbe: APP_INFO[p]?.[1] || '#7b5cff' }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de')).slice(0, 40);
  // HDMI-Eingänge in Reihenfolge der Hardware-Nummer = HDMI 1, 2, 3
  const hw = [...new Map([...teilB.matchAll(/([\w.]+\/[\w.]*HDMIInputService\/HW(\d+))/g)].map(m => [+m[2], m[1]])).entries()].sort((a, b) => a[0] - b[0]);
  tvxIds.clear();
  const eingaenge = hw.slice(0, 4).map(([, id], i) => { tvxIds.set('hdmi' + (i + 1), id); return { key: 'hdmi' + (i + 1), name: 'HDMI ' + (i + 1) }; });
  if (!pakete.length && !hw.length) { tvxAt = 0; return; }   // Antwort unvollständig -> später erneut
  tvxSet({ apps, eingaenge });
  log(`Fernseher: ${apps.length} weitere Apps, ${eingaenge.length} HDMI-Eingänge`);
}

// Text für "input text": nur druckbare ASCII-Zeichen (Umlaute umschreiben), Leerzeichen als %s, in '…' für die Shell
function adbText(t) {
  const s = t.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '');
  return "'" + s.replace(/%/g, '').replace(/ /g, '%s').replace(/'/g, "'\\''") + "'";
}

async function tvxRun(x) {
  const fail = msg => { const e = new Error(msg); e.status = 400; throw e; };
  if (x.art === 'bild') {
    if (x.aus) {
      if (!tvIsOn()) fail('Der Fernseher ist aus');
      await adb('input keyevent 223');   // Android-Schlaf: Bild aus, Musik-Apps spielen weiter
      tvxSet({ bild_aus: true, bild_aus_at: new Date().toISOString() });
    } else {
      tvxSet({ bild_aus: false });
      tvWake('adb');
    }
    return;
  }
  if (x.art === 'bildschirm') { if (!tvIsOn()) fail('Der Fernseher ist aus'); bildschirmFoto(); return; }
  if (x.art === 'starten') {
    if (!tvx.apps.some(a => a.paket === x.paket)) fail('App nicht auf dem Fernseher');
    const go = () => adb(`monkey -p ${x.paket} -c android.intent.category.LEANBACK_LAUNCHER 1`);
    if (tvIsOn()) await go();
    else tvWake().then(ms => ms && sleep(1500).then(go)).catch(err => log('App-Start nach Einschalten:', err.message));
    return;
  }
  if (!tvIsOn()) fail('Der Fernseher ist aus');
  if (x.art === 'helligkeit') return tvHelligkeit(x.wert);
  if (x.art === 'eingang') {
    if (x.eingang === 'tv') return void await adb('input keyevent 3');
    if (!tvxIds.size) await tvxDiscover(true);   // nach einem Neustart sind die internen IDs weg
    const id = tvxIds.get(x.eingang);
    if (!id) fail('Eingang unbekannt');
    await adb(`am start -a android.intent.action.VIEW -d content://android.media.tv/passthrough/${encodeURIComponent(id)}`);
    return;
  }
  if (x.art === 'text') {
    const teile = [];
    if (x.loeschen) teile.push('input keyevent ' + Array(x.loeschen).fill(67).join(' '));
    if (x.text) teile.push('input text ' + adbText(x.text));
    if (x.enter) teile.push('input keyevent 66');
    await adb(teile.join('; '));
  }
}

// Bildschirmfoto: screencap auf dem Fernseher -> über HA abholen -> PocketBase home_logos (Eintrag "_bildschirm", geschützt).
// Läuft im Hintergrund (dauert ein paar Sekunden); die App sieht den Fortschritt in _tvx.bildschirm.
// Hinweis: Streaming-Apps mit Kopierschutz (Netflix, Prime …) liefern dabei nur ein schwarzes Bild.
let shotBusy = false;
async function bildschirmFoto() {
  if (shotBusy) return;
  shotBusy = true;
  tvxSet({ bildschirm: { ...(tvx.bildschirm || {}), laeuft: true, fehler: '' } });
  try {
    await adb('screencap -p /sdcard/wir-bild.png', 30000);
    const buf = await tvlogos.holen('/sdcard/wir-bild.png', 'bild', {
      call: (d, s, ids, data) => backend.call(d, s, ids, data, 120000), signPath: p => backend.signPath(p),
      haBase: HA_URL.replace(/\/+$/, ''), adbEntity: intern.adb,
    });
    adb('rm -f /sdcard/wir-bild.png').catch(() => {});
    if (buf.length < 1000 || buf.readUInt32BE(0) !== 0x89504e47) throw new Error('kein Bild');
    const f = new FormData();
    f.set('paket', '_bildschirm'); f.set('version', String(Date.now())); f.set('art', 'bildschirm');
    f.set('bild', new Blob([buf], { type: 'image/png' }), 'bildschirm.png');
    const r = await api('GET', `/api/collections/home_logos/records?filter=${encodeURIComponent('paket="_bildschirm"')}&perPage=1&skipTotal=1`);
    if (r.items[0]) await pbForm('PATCH', `/api/collections/home_logos/records/${r.items[0].id}`, f);
    else await pbForm('POST', '/api/collections/home_logos/records', f);
    tvxSet({ bildschirm: { laeuft: false, at: new Date().toISOString(), fehler: '' } });
  } catch (err) {
    log('Bildschirmfoto:', err.message);
    tvxSet({ bildschirm: { ...(tvx.bildschirm || {}), laeuft: false, fehler: 'Bildschirmfoto hat nicht geklappt' } });
  } finally { shotBusy = false; }
}

// ----------------------------------------------------------------------
// Kino-Licht (Einstellung home_settings "fernseher".kinolicht): läuft etwas auf dem Fernseher, dimmen die eingeschalteten
// Lampen sanft auf 12 %; bei Pause oder Aus kommt die vorherige Helligkeit zurück (nur, wenn niemand inzwischen von Hand
// an der Lampe war). Zustand aus der ADB-Entität (playing / paused / idle / off).
// ----------------------------------------------------------------------
const KINO_PCT = 12;
let tvSet = { at: 0, data: {} }, kinoT = null;
const kinoMem = new Map();   // entity_id -> Helligkeit (0–255) vor dem Dimmen
async function tvSettings() {
  if (Date.now() - tvSet.at < 60000) return tvSet.data;
  const r = await api('GET', `/api/collections/home_settings/records?filter=${encodeURIComponent('key="fernseher"')}&perPage=1&skipTotal=1`);
  tvSet = { at: Date.now(), data: r.items[0]?.data || {} };
  return tvSet.data;
}
function kinoLicht(s, was) {
  const now = s?.state, before = was?.state;
  if (now === before || meta.mode !== 'live') return;
  clearTimeout(kinoT);
  // kurz warten: beim Spulen/Umschalten wechselt der Zustand oft hin und her
  kinoT = setTimeout(async () => {
    const st = states.get(intern.adb)?.state;
    try {
      if (!(await tvSettings()).kinolicht) { kinoMem.clear(); return; }
      if (st === 'playing') {
        for (const l of C.cfg.lampen) {
          const ls = states.get(l.entity_id);
          if (ls?.state !== 'on' || kinoMem.has(l.entity_id)) continue;
          const b = Number(ls.attributes?.brightness) || 0;
          if (b && b <= Math.round(KINO_PCT * 2.55) + 3) continue;   // schon dunkel genug
          kinoMem.set(l.entity_id, b);
          await backend.call('light', 'turn_on', [l.entity_id], { brightness_pct: KINO_PCT, transition: 4 });
        }
        if (kinoMem.size) log('Kino-Licht: gedimmt');
      } else if (kinoMem.size) {
        for (const [id, b] of kinoMem) {
          const ls = states.get(id), jetzt = Number(ls?.attributes?.brightness) || 0;
          // nur zurück, wenn die Lampe noch an ist und noch "unsere" Helligkeit hat
          if (ls?.state === 'on' && Math.abs(jetzt - Math.round(KINO_PCT * 2.55)) <= 6 && b) await backend.call('light', 'turn_on', [id], { brightness: b, transition: 3 });
        }
        kinoMem.clear();
        log('Kino-Licht: zurück');
      }
    } catch (err) { log('Kino-Licht:', err.message); }
  }, 3000);
}

// ----------------------------------------------------------------------
// Fernseher beim Wecken (Wecker-Einstellungen "tv": { an, app, lautstaerke }): startet der Sonnenaufgang (Lichtwecker in
// HA oder "Weckvorgang testen"), schaltet wir-home den Fernseher zur Weckzeit ein, öffnet die App und stellt die
// Lautstärke ein. Beim Test (Weckzeit noch weit weg) nach der Testdauer.
// ----------------------------------------------------------------------
// App öffnen und Lautstärke setzen (Fernseher ist an) – für Wecker und Szenen
async function tvAppVol(appName, vol) {
  const tv = C.cfg.fernseher;
  const app = tv.apps.find(a => a.name === appName);
  if (app) {
    const { calls } = conf.check(C, { entity_id: tv.entity_id, service: 'tv.app', data: { app: app.name } }, states);
    for (const c of calls) await backend.call(c.domain, c.service, c.entity_ids, c.data).catch(err => log('App öffnen:', err.message));
    await sleep(3000);
  }
  if (vol != null) {
    const v = Math.max(0, Math.min(tv.max_lautstaerke, Math.round(Number(vol) || 0)));
    for (const c of volumeSteps([{ domain: 'media_player', service: 'volume_set', entity_ids: [tv.entity_id], data: { volume_level: v / tv.max_lautstaerke } }]))
      await backend.call(c.domain, c.service, c.entity_ids, c.data).catch(() => {});
  }
}

// Bildhelligkeit des Fernsehers (Xiaomi: globale Einstellung picture_brightness, 0–100, 50 = Werkseinstellung)
const HELL_KEY = 'picture_brightness';
async function tvHelligkeit(n) {
  n = Math.max(0, Math.min(100, Math.round(n)));
  await adb(`settings put global ${HELL_KEY} ${n}`);
  tvxSet({ helligkeit: n });
}

// Szene mit "fernseher": einschalten (das HA-Skript läuft parallel – bei "Gute Nacht" ggf. noch die alte Version, die
// den Fernseher zuerst ausschaltet, darum kurz warten), dann App, Lautstärke, Bildhelligkeit
async function tvSzene(sz) {
  const f = sz.fernseher;
  await sleep(4000);
  const an = tvIsOn() || await tvWake();
  if (!an) return log(`Szene ${sz.name}: Fernseher ging nicht an`);
  await sleep(2500);
  if (f.helligkeit != null) await tvHelligkeit(f.helligkeit).catch(err => log('Helligkeit:', err.message));
  await tvAppVol(f.app, f.lautstaerke);
  log(`Szene ${sz.name}: Fernseher an${f.app ? ' · ' + f.app : ''}${f.lautstaerke != null ? ' · Lautstärke ' + f.lautstaerke : ''}${f.helligkeit != null ? ' · Helligkeit ' + f.helligkeit : ''}`);
}

let weckTvT = null;
async function weckerTv() {
  const tv = C.cfg.fernseher, wk = C.cfg.wecker;
  if (!tv || meta.mode !== 'live') return;
  const r = await api('GET', `/api/collections/home_settings/records?filter=${encodeURIComponent('key="wecker"')}&perPage=1&skipTotal=1`);
  const t = r.items[0]?.data?.tv;
  if (!t?.an) return;
  const z = String(states.get(wk.zeit)?.state || '');
  let ms = Infinity;
  if (/^\d{2}:\d{2}/.test(z)) {
    const [h, m] = z.split(':').map(Number), at = new Date(); at.setHours(h, m, 0, 0);
    if (at - Date.now() < -120000) at.setDate(at.getDate() + 1);
    ms = Math.max(0, at - Date.now());
  }
  if (ms > 35 * 60000) ms = wk.test_sekunden * 1000;   // Test-Sonnenaufgang
  clearTimeout(weckTvT);
  log(`Wecker: Fernseher in ${Math.round(ms / 1000)} s (${t.app || 'ohne App'}, Lautstärke ${t.lautstaerke})`);
  weckTvT = setTimeout(async () => {
    try {
      const an = tvIsOn() || await tvWake();
      if (!an) return log('Wecker: Fernseher ging nicht an');
      await sleep(2500);
      await tvAppVol(t.app, t.lautstaerke);
      log('Wecker: Fernseher an' + (t.app ? ' · ' + t.app : ''));
    } catch (err) { log('Wecker-Fernseher:', err.message); }
  }, ms);
}

// ----------------------------------------------------------------------
// Befehle von PocketBase (nur localhost)
// ----------------------------------------------------------------------
const hits = new Map(); // user -> Zeitstempel
function rateOk(user) {
  const now = Date.now();
  const arr = (hits.get(user) || []).filter(t => now - t < 10000);
  const all = [...hits.values()].reduce((n, a) => n + a.filter(t => now - t < 10000).length, 0);
  if (arr.length >= 30 || all >= 60) { hits.set(user, arr); return false; }
  arr.push(now);
  hits.set(user, arr);
  return true;
}

// Fernseher ohne "Lautstärke setzen" (Android TV Remote kann nur lauter/leiser): Zielwert in Tastendrücke umrechnen
const VOLUME_SET = 4;
function volumeSteps(calls) {
  const tv = C.cfg.fernseher;
  return calls.map(c => {
    if (!tv || c.domain !== 'media_player' || c.service !== 'volume_set' || c.entity_ids[0] !== tv.entity_id) return c;
    const s = states.get(tv.entity_id);
    const f = s?.attributes?.supported_features;
    if (typeof f !== 'number' || (f & VOLUME_SET) || !tv.remote) return c;
    const diff = Math.round((c.data.volume_level - (Number(s.attributes.volume_level) || 0)) * tv.max_lautstaerke);
    if (!diff) return null;
    return { domain: 'remote', service: 'send_command', entity_ids: [tv.remote], data: { command: diff > 0 ? 'VOLUME_UP' : 'VOLUME_DOWN', num_repeats: Math.min(30, Math.abs(diff)), delay_secs: 0.05 } };
  }).filter(Boolean);
}

async function handle(cmd) {
  if (!cmd || typeof cmd.user !== 'string' || !cmd.user) { const e = new Error('Kein Nutzer'); e.status = 401; throw e; }
  if (!rateOk(cmd.user)) { const e = new Error('Zu viele Befehle – kurz warten'); e.status = 429; throw e; }
  // Szene: entweder HA-Szene/Skript oder die Aktionen aus der Konfiguration (jede einzeln gegen die Freigabeliste geprüft)
  let calls, label;
  const sz = cmd.scene ? C.cfg.szenen.find(x => x.key === cmd.scene) : null;
  if (cmd.scene && !sz) { const e = new Error('Szene nicht freigegeben'); e.status = 400; throw e; }
  if (sz) {
    calls = sz.entity_id ? conf.check(C, { entity_id: sz.entity_id, service: sz.entity_id.split('.')[0] + '.turn_on' }, states).calls
      : sz.aktionen.flatMap(a => conf.check(C, a, states).calls);
    label = `Szene ${sz.name}`;
  }
  let wake = false, watch = false, logos = false, x = null;
  if (!sz) ({ calls, label, wake, watch, logos, tvx: x } = conf.check(C, cmd, states));
  if (x) {
    if (meta.mode !== 'live' || !intern.adb) { const e = new Error('Geht nur mit dem echten Fernseher (ADB)'); e.status = 400; throw e; }
    await tvxRun(x);
    return { ok: true, label };
  }
  if (logos) {
    if (meta.mode !== 'live') { const e = new Error('Im Testmodus gibt es keine Logos'); e.status = 400; throw e; }
    if (!intern.adb) { const e = new Error('Android Debug Bridge in HA fehlt'); e.status = 400; throw e; }
    if (!tvIsOn()) { const e = new Error('Dafür muss der Fernseher an sein'); e.status = 400; throw e; }
    logosRefresh(false);
    return { ok: true, label };
  }
  if (watch) { watchUntil = Date.now() + WATCH_MS; if (cache.get('_tv') === undefined || Date.now() - adbLast > POLL_MS) tvPoll(); return { ok: true, label: '' }; }
  if (!meta.connected) { const e = new Error(meta.mode === 'test' ? 'Testmodus startet noch' : 'Home Assistant nicht verbunden'); e.status = 503; throw e; }
  // Fernseher einschalten -> Einschalt-Routine (läuft im Hintergrund weiter, die App sieht den Fortschritt in _meta)
  const tv = C.cfg.fernseher;
  if (tv && meta.mode === 'live' && calls.length === 1 && calls[0].domain === 'media_player' && calls[0].service === 'turn_on' && calls[0].entity_ids[0] === tv.entity_id && !tvIsOn()) {
    tvWake();
    return { ok: true, label };
  }
  // Fernseher ausschalten -> Android-Schlaf per ADB (aus dem ihn die Einschalt-Routine wieder holt)
  if (tv && meta.mode === 'live' && intern.adb && calls.length === 1 && calls[0].domain === 'media_player' && calls[0].service === 'turn_off' && calls[0].entity_ids[0] === tv.entity_id) {
    await tvSleep();
    return { ok: true, label };
  }
  // App bei ausgeschaltetem Fernseher: erst wecken, dann die App starten
  if (wake && meta.mode === 'live') {
    tvWake().then(async ms => {
      if (!ms) return;
      await sleep(1500);
      for (const c of calls) await backend.call(c.domain, c.service, c.entity_ids, c.data).catch(err => log('App-Start nach Einschalten:', err.message));
    });
    return { ok: true, label };
  }
  if (wake) calls.unshift({ domain: 'media_player', service: 'turn_on', entity_ids: [tv.entity_id], data: {}, optional: true });
  for (const c of volumeSteps(calls)) {
    if (c.wait) await new Promise(r => setTimeout(r, c.wait));
    try { await backend.call(c.domain, c.service, c.entity_ids, c.data); }
    catch (err) {
      if (c.optional) { log('optional fehlgeschlagen:', c.domain + '.' + c.service, err.message); continue; }
      const e = new Error(err.message || 'Fehler von Home Assistant'); e.status = 502; throw e;
    }
  }
  // Szene mit Fernseher: im Hintergrund einschalten, App öffnen, Lautstärke + Bildhelligkeit setzen
  if (sz?.fernseher && tv && meta.mode === 'live') tvSzene(sz).catch(err => log(`Szene ${sz.name} – Fernseher:`, err.message));
  // aktive Szene merken (Markierung in der App); Licht von Hand geändert -> keine Szene mehr aktiv (wie in der Vorlage)
  if (sz) setMeta({ scene: sz.key, scene_at: new Date().toISOString() });
  else if (calls[0].domain === 'light' && meta.scene) setMeta({ scene: '', scene_at: '' });
  return { ok: true, label };
}

const server = http.createServer((req, res) => {
  const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
  // Wecker-Einstellungen wurden in der App geändert (pb_hooks/wir_zuhause.pb.js) -> zu HA übertragen
  if (req.method === 'POST' && req.url === '/wecker') { weckerSoon(300); req.resume(); return send(200, { ok: true }); }
  // Diagnose (nur lokal auf dem VPS, z. B. per ssh + curl): Fernseher-nahe Entitäten
  if (req.method === 'GET' && req.url === '/diag/entities') {
    if (!backend?.overview) return send(400, { message: 'nur im echten Modus' });
    return backend.overview().then(r => send(200, { intern, ...r }), err => send(502, { message: err.message }));
  }
  // Diagnose Fernseher: Einschalten messen (?v=auto|tv|wol|wol_adb|skript), Ausschalten, Media-Session lesen
  const u = new URL(req.url, 'http://x');
  if (req.method === 'POST' && u.pathname === '/diag/tv-an') {
    if (meta.mode !== 'live' || !C.cfg.fernseher) return send(400, { message: 'nur im echten Modus' });
    if (tvIsOn()) return send(409, { message: 'Fernseher ist schon an' });
    const v = u.searchParams.get('v') || 'auto';
    if (!/^(auto|tv|adb|wol\d?|wol_adb|skript)$/.test(v)) return send(400, { message: 'Variante?' });
    return tvWake(v).then(ms => send(200, { ok: !!ms, ms, variante: v, skript: skriptDa(), intern }));
  }
  if (req.method === 'POST' && u.pathname === '/diag/tv-aus') {
    const tv = C.cfg.fernseher, t0 = Date.now();
    return tvSleep().then(async () => {
      for (let n = 0; tvIsOn() && Date.now() - t0 < 25000; n++) {
        if (n % 10 === 0 && intern.adb) backend.call('homeassistant', 'update_entity', [intern.adb], {}).catch(() => {});
        await sleep(200);
      }
      send(200, { aus: !tvIsOn(), ms: Date.now() - t0 });
    }, err => send(502, { message: err.message }));
  }
  // Magic Packet mit eigener Zieladresse testen (MAC nur als Parameter, steht nirgends im Repo)
  if (req.method === 'POST' && u.pathname === '/diag/wol') {
    const mac = u.searchParams.get('mac') || '', ziel = u.searchParams.get('ziel') || '';
    if (!/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(mac) || (ziel && !/^\d{1,3}(\.\d{1,3}){3}$/.test(ziel))) return send(400, { message: 'mac/ziel?' });
    const t0 = Date.now();
    return backend.send({ type: 'call_service', domain: 'wake_on_lan', service: 'send_magic_packet', service_data: { mac, ...(ziel ? { broadcast_address: ziel } : {}) } })
      .then(async () => {
        while (!tvIsOn() && Date.now() - t0 < 25000) { backend.call('homeassistant', 'update_entity', [intern.adb], {}).catch(() => {}); await sleep(2000); }
        send(200, { an: tvIsOn(), ms: Date.now() - t0 });
      }, err => send(502, { message: err.message }));
  }
  // beliebiger ADB-Befehl (nur lokal, zum Untersuchen der Standby-Einstellungen)
  if (req.method === 'POST' && u.pathname === '/diag/adb') {
    const command = u.searchParams.get('cmd') || '';
    if (!intern.adb || !command) return send(400, { message: 'cmd?' });
    return adb(command, 30000).then(r => send(200, { antwort: r }), err => send(502, { message: err.message }));
  }
  if (req.method === 'POST' && u.pathname === '/diag/logos') {
    if (!intern.adb || !tvIsOn()) return send(400, { message: 'Fernseher aus oder keine ADB-Entität' });
    return logosRefresh(u.searchParams.get('force') === '1').then(r => send(200, { ergebnis: r }));
  }
  if (req.method === 'POST' && u.pathname === '/diag/medien') {
    if (!intern.adb) return send(400, { message: 'keine ADB-Entität', intern });
    adbErr = '';
    return tvPoll(true).then(() => send(200, { fehler: adbErr, info: lastRaw ? mediaInfo(lastRaw) : null, sitzungen: parseSessions(lastRaw), roh: lastRaw.slice(0, 8000) }));
  }
  if (req.method !== 'POST' || req.url !== '/cmd') return send(404, { message: 'Nicht gefunden' });
  let body = '';
  req.on('data', ch => { body += ch; if (body.length > 10000) req.destroy(); });
  req.on('end', async () => {
    let cmd;
    try { cmd = JSON.parse(body); } catch (_) { return send(400, { message: 'Ungültige Anfrage' }); }
    try { send(200, await handle(cmd)); }
    catch (err) {
      if (err.status === 400) log('abgelehnt:', String(cmd.service).slice(0, 40), String(cmd.entity_id).slice(0, 80), '-', err.message);
      send(err.status || 500, { message: err.message || 'Fehler' });
    }
  });
});

// ----------------------------------------------------------------------
// Start
// ----------------------------------------------------------------------
async function main() {
  C = readConfig();
  for (let i = 0; ; i++) {
    try { await loadRecords(); break; }
    catch (err) { log('PocketBase noch nicht bereit:', err.message); await new Promise(r => setTimeout(r, Math.min(30000, 2000 * (i + 1)))); }
  }
  try { klima = JSON.parse(cache.get('_klima') || 'null') || { series: {} }; } catch (_) { klima = { series: {} }; }
  if (!klima.series) klima = { series: {} };
  klimaTrim();
  try { Object.assign(tvx, JSON.parse(cache.get('_tvx') || '{}')); } catch (_) { /* leer lassen */ }
  if (tvx.bildschirm?.laeuft) tvx.bildschirm.laeuft = false;
  put('_config', publicConfig());
  setMeta({ connected: false, error: '' });
  // Datensätze von Geräten, die nicht mehr in der Konfiguration stehen, bleiben liegen – die App zeigt nur Konfiguriertes.

  server.listen(PORT, '127.0.0.1', () => log(`wir-home hört auf 127.0.0.1:${PORT}`));
  startBackend();

  // Herzschlag: die App erkennt daran, ob der Dienst läuft
  setInterval(() => setMeta({}), 30000);
  // Klima: auch ohne Änderung alle 10 Minuten einen Punkt
  setInterval(() => { for (const id of klimaIds()) { const s = states.get(id); if (s) klimaSample(id, s.state, true); } }, STEP_MS);
  const wx = () => weather().catch(err => log('Wetter:', err.message));
  wx(); setInterval(wx, 20 * 60000);
  const kal = () => kalender().catch(err => log('Kalender:', err.message));
  if (meta.mode === 'test') kal();   // echt: nach dem Verbinden
  setInterval(kal, 10 * 60000);
  // Wecker zur Sicherheit alle 15 Minuten abgleichen (falls ein Hinweis von PocketBase verloren ging)
  setInterval(() => weckerSoon(0), 15 * 60000);
  // Fernseher: Titel abfragen (nur wenn Zuhause offen und TV an), interne Entitäten nachsuchen, solange sie fehlen
  setInterval(() => tvPoll(), POLL_MS);
  setInterval(() => { if (meta.connected && (!intern.adb || !intern.wol)) tvDiscover().catch(() => {}); }, 2 * 60000);
  // weitere Apps / Eingänge vom Fernseher (höchstens alle 6 h, nur wenn er an ist)
  setInterval(() => { if (meta.connected && tvIsOn()) tvxDiscover().catch(err => log('Fernseher-Apps lesen:', err.message)); }, 2 * 60000);

  // Konfiguration beobachten (Auto-Deploy startet den Dienst bei Änderungen ohnehin neu)
  let reloadTimer = null;
  fs.watchFile(CONFIG, { interval: 5000 }, () => {
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      try {
        C = readConfig();
        backend.setConfig(C.cfg);
        put('_config', publicConfig());
        klimaTrim();
        log('Konfiguration neu geladen');
        if (meta.mode === 'test') for (const s of backend.states.values()) onState(s);
        wx(); kal(); tvDiscover().catch(() => {});
      } catch (err) { log('Konfiguration fehlerhaft, alte bleibt aktiv:', err.message); }
    }, 500);
  });
}

process.on('SIGTERM', () => { flush().finally(() => process.exit(0)); });
main().catch(err => { console.error(err); process.exit(1); });
