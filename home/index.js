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
  if (s.entity_id === intern.adb) { if (s.attributes?.adb_response !== was?.attributes?.adb_response) tvMedia(s.attributes?.adb_response); return; }
  tvWatchState(s.entity_id, was);
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
// ----------------------------------------------------------------------
const TV_OFF = ['off', 'standby', 'unavailable', 'unknown'];
const WAKE_MS = 25000, WAKE_STEP = 2000;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const intern = { adb: '', wol: '' };      // gefundene interne Entitäten (nie an die App)
const tvIsOn = () => { const tv = C.cfg.fernseher; return !!tv && !!states.get(tv.entity_id) && !TV_OFF.includes(states.get(tv.entity_id).state); };
const skriptDa = () => { const id = C.cfg.fernseher?.an_skript; return !!id && !!states.get(id) && !states.get(id).missing; };

// ADB- und Wake-on-LAN-Entität: aus der Konfiguration oder "auto" (ADB = media_player mit adb_response, WOL = button.wake_on_lan_…)
async function tvDiscover() {
  const tv = C.cfg.fernseher;
  if (!tv || !backend.overview) return;
  const want = tv.intern;
  let found = { adb: want.adb === 'auto' ? '' : want.adb, wol: want.wol === 'auto' ? '' : want.wol };
  if (want.adb === 'auto' || want.wol === 'auto') {
    const { entities } = await backend.overview();
    if (want.adb === 'auto') found.adb = entities.find(e => e.id.startsWith('media_player.') && e.attrs.includes('adb_response'))?.id || '';
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

let waking = null;
// variante: 'auto' (Skript, sonst selbst alles), zum Messen auch 'tv' (nur turn_on), 'wol' (alle Knöpfe),
// 'wol0'/'wol1' (nur dieser eine Knopf), 'wol_adb', 'skript'
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
      if (!useSkript) {
        if (variante !== 'tv') fire('button', 'press', wol);
        fire('media_player', 'turn_on', tv.entity_id);
        if (['auto', 'wol_adb'].includes(variante)) fire('media_player', 'turn_on', intern.adb);
      }
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
  if (id === tv.entity_id && tvIsOn() && meta.tv_fail) setMeta({ tv_fail: '' });
}

// ----------------------------------------------------------------------
// "Läuft gerade" mit Titel: wir-home liest per ADB die Media-Session des Fernsehers – nur diesen einen festen
// Lese-Befehl, nur solange der Fernseher an ist und Zuhause offen ist (die App meldet sich per "tv.watch" alle 30 s),
// höchstens alle 10 s. Ergebnis in home_state "_tv". Die App darf ADB nicht benutzen.
// ----------------------------------------------------------------------
const ADB_CMD = 'dumpsys media_session';
const POLL_MS = 10000, WATCH_MS = 45000;
let watchUntil = 0, adbBusy = false, adbErr = '', lastRaw = '', adbLast = 0;

// dumpsys media_session -> Sitzungen (Paket, Zustand, Titel/Untertitel/Beschreibung)
function parseSessions(raw) {
  const out = [];
  const blocks = String(raw || '').split(/\n(?=\s*package=)/).slice(1);
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
    out.push({ paket: pk, aktiv: /active=true/.test(b), zustand: st, titel, untertitel, beschreibung });
  }
  return out;
}
// Staffel/Folge aus Texten wie "S2:F4", "S2 E4", "Staffel 2, Folge 4", "Season 2 Episode 4"
function staffelFolge(t) {
  const m = String(t || '').match(/\b(?:S|Staffel|Season)\s*(\d{1,2})\s*[:.,·|-]?\s*(?:E|F|Folge|Episode|Ep\.?)\s*(\d{1,3})\b/i);
  return m ? { staffel: +m[1], folge: +m[2] } : null;
}
function mediaInfo(raw) {
  const all = parseSessions(raw).filter(s => s.titel || s.untertitel);
  // spielend (3) vor pausiert (2) vor dem Rest, aktive Sitzung bevorzugt
  const rank = s => (s.zustand === 3 ? 4 : s.zustand === 2 ? 2 : 0) + (s.aktiv ? 1 : 0);
  const s = all.sort((a, b) => rank(b) - rank(a))[0];
  if (!s || rank(s) < 2) return {};
  const sf = staffelFolge(s.titel) || staffelFolge(s.untertitel) || staffelFolge(s.beschreibung);
  return { paket: s.paket, titel: s.titel.slice(0, 120), untertitel: s.untertitel.slice(0, 120), staffel: sf?.staffel || 0, folge: sf?.folge || 0,
    spielt: s.zustand === 3, at: new Date().toISOString() };
}
function tvMedia(raw) {
  if (typeof raw !== 'string') return;
  lastRaw = raw;
  put('_tv', tvIsOn() ? mediaInfo(raw) : {});
}
async function tvPoll(force) {
  if (!intern.adb || !meta.connected || adbBusy) return;
  if (!tvIsOn()) { if (cache.get('_tv') !== '{}') put('_tv', {}); return; }
  if (!force && Date.now() > watchUntil) return;
  adbBusy = true; adbLast = Date.now();
  try {
    await backend.call('androidtv', 'adb_command', [intern.adb], { command: ADB_CMD });
    const s = states.get(intern.adb);
    if (s) tvMedia(s.attributes?.adb_response);
    adbErr = '';
  } catch (err) {
    if (err.message !== adbErr) log('Titel per ADB nicht lesbar:', err.message);   // jede Fehlerart nur einmal
    adbErr = err.message;
  } finally { adbBusy = false; }
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
  let wake = false, watch = false;
  if (!sz) ({ calls, label, wake, watch } = conf.check(C, cmd, states));
  if (watch) { watchUntil = Date.now() + WATCH_MS; if (cache.get('_tv') === undefined || Date.now() - adbLast > POLL_MS) tvPoll(); return { ok: true, label: '' }; }
  if (!meta.connected) { const e = new Error(meta.mode === 'test' ? 'Testmodus startet noch' : 'Home Assistant nicht verbunden'); e.status = 503; throw e; }
  // Fernseher einschalten -> Einschalt-Routine (läuft im Hintergrund weiter, die App sieht den Fortschritt in _meta)
  const tv = C.cfg.fernseher;
  if (tv && meta.mode === 'live' && calls.length === 1 && calls[0].domain === 'media_player' && calls[0].service === 'turn_on' && calls[0].entity_ids[0] === tv.entity_id && !tvIsOn()) {
    tvWake();
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
    if (!/^(auto|tv|wol\d?|wol_adb|skript)$/.test(v)) return send(400, { message: 'Variante?' });
    return tvWake(v).then(ms => send(200, { ok: !!ms, ms, variante: v, skript: skriptDa(), intern }));
  }
  if (req.method === 'POST' && u.pathname === '/diag/tv-aus') {
    const tv = C.cfg.fernseher, t0 = Date.now();
    return backend.call('media_player', 'turn_off', [tv.entity_id], {}).then(async () => {
      while (tvIsOn() && Date.now() - t0 < 15000) await sleep(200);
      send(200, { aus: !tvIsOn(), ms: Date.now() - t0 });
    }, err => send(502, { message: err.message }));
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
