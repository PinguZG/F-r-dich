// Zuhause-Extras (06.11.2026): Abfahrten, Pakete, System-Status – alles NUR hier im Dienst, der Browser fragt über
// PocketBase (pb_hooks/wir_zuhause_extra.pb.js), die den angemeldeten Nutzer mitschickt. Nichts davon landet in home_state
// (das lesen beide) – Pakete und System-Status bekommt nur der Besitzer ("extras.besitzer" in config.jsonc).
// - Abfahrten/Verbindungen/Haltestellensuche: Transitous (api.transitous.org, MOTIS), serverseitig zwischengespeichert,
//   egal wie viele Handys offen sind; alle Anfragen nach außen laufen durch eine Drossel.
// - Pakete: HA-Integration 17TRACK, Aktion seventeentrack.get_packages (Antwort mit packages[]), alle 10 Min.
// - System: VPS-Werte selbst erhoben (systemctl is-active, /proc, statfs, git), HA-Werte per get_states (nur lesen,
//   nur die freigegebenen Entitäten), Backups (PocketBase-API + /home/pingu/backups). Rot > 15 Min. -> Push an den Besitzer.
// Fehler von außen bringen den Dienst nie zum Absturz: Timeouts, try/catch, gleiche Fehlermeldung nur alle 10 Min. im Log.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const conf = require('./config');

const UA = 'wir-home/1.0 (private Paar-App, 2 Nutzer; github.com/PinguZG/F-r-dich)';
const MIN = 60000;

module.exports = function extras({ log, api, configFile, backend, meta }) {
  // ------------------------------------------------------------ Konfiguration (Abschnitt "extras")
  let X = null;
  const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const pair = (v, d) => (Array.isArray(v) && v.length === 2 && v.every(n => Number.isFinite(Number(n))) ? v.map(Number) : d);
  const ENTITY_RE = /^[a-z_]+\.[a-z0-9_]+$/;
  function readConfig() {
    let raw = {};
    try { raw = conf.parseJsonc(fs.readFileSync(configFile, 'utf8')).extras || {}; } catch (err) { log('Extras-Konfiguration:', err.message); }
    const a = raw.abfahrten || {}, p = raw.pakete || {}, s = raw.system || {}, ha = s.ha || {}, sw = s.schwellen || {};
    const ent = v => (typeof v === 'string' && ENTITY_RE.test(v) ? v : '');
    X = {
      besitzer: String(raw.besitzer || '').trim(),
      abf: {
        quelle: String(a.quelle || 'https://api.transitous.org').replace(/\/$/, ''),
        cache: Math.max(30, num(a.cache_sekunden, 60)) * 1000,
        anzahl: Math.min(10, Math.max(1, num(a.anzahl, 5))),
        pro_minute: Math.min(60, Math.max(5, num(a.max_anfragen_pro_minute, 30))),
      },
      pak: { aktiv: p.aktiv !== false, cache: Math.max(2, num(p.cache_minuten, 10)) * MIN, tage: Math.max(0, num(p.zugestellt_tage, 2)) },
      sys: {
        dienste: (Array.isArray(s.dienste) ? s.dienste : []).map(String).filter(d => /^[a-z0-9@._-]+$/i.test(d)).slice(0, 10),
        repo: String(s.repo || '/home/pingu/F-r-dich'),
        pocketbase: String(s.pocketbase || '/home/pingu/pb/pocketbase'),
        backups: String(s.backups || '/home/pingu/backups'),
        ha: {
          cpu_temp: ent(ha.cpu_temp), cpu: ent(ha.cpu), ram: ent(ha.ram), festplatte: ent(ha.festplatte), backup: ent(ha.backup),
          updates: ha.updates === 'update.*' ? 'update.*' : (Array.isArray(ha.updates) ? ha.updates.map(ent).filter(Boolean) : []),
        },
        sw: {
          cpu_temp: pair(sw.cpu_temp, [70, 80]), festplatte: pair(sw.festplatte, [80, 90]), ram: pair(sw.ram, [85, 95]),
          backup_tage: pair(sw.backup_tage, [2, 4]), last: pair(sw.last_pro_kern, [1.5, 3]), cpu: pair(sw.cpu, [85, 95]),
        },
        push: num(s.push_rot_minuten, 15),
      },
    };
  }
  readConfig();

  // gleiche Meldung höchstens alle 10 Minuten ins Log (kein Spam, wenn eine API länger weg ist)
  const said = new Map();
  function warn(k, msg) {
    const t = said.get(k);
    if (t && t.msg === msg && Date.now() - t.at < 10 * MIN) return;
    said.set(k, { msg, at: Date.now() });
    log(k + ':', msg);
  }

  // ------------------------------------------------------------ Drossel für Anfragen nach außen (Transitous)
  let stamps = [];
  async function getJson(url, ms = 12000) {
    const now = Date.now();
    stamps = stamps.filter(t => now - t < MIN);
    if (stamps.length >= X.abf.pro_minute) { const e = new Error('Zu viele Anfragen – gleich wieder'); e.status = 429; throw e; }
    stamps.push(now);
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(ms) });
    if (!r.ok) { const e = new Error('Fahrplan-Dienst ' + r.status); e.status = 502; throw e; }
    return r.json();
  }

  // Zwischenspeicher mit Obergrenze: älteste Einträge fliegen raus; laufende Abfragen werden geteilt
  function memo(max) {
    const m = new Map();
    return {
      get: k => m.get(k),
      set(k, v) { m.delete(k); m.set(k, v); while (m.size > max) m.delete(m.keys().next().value); },
    };
  }
  async function cached(store, key, ttl, load, staleMs = 6 * 3600000) {
    let c = store.get(key);
    const now = Date.now();
    if (c && c.data && now - c.at < ttl) return { ...c.data, at: c.at, stale: false };
    if (!c) { c = { at: 0, data: null, p: null, fail: 0 }; store.set(key, c); }
    // nach einem Fehler nicht bei jedem Aufruf neu versuchen (höchstens alle 30 s)
    if (!c.p && now - c.fail > 30000) {
      c.p = load().then(d => { c.data = d; c.at = Date.now(); }, err => { c.fail = Date.now(); c.err = err; }).finally(() => { c.p = null; });
    }
    if (c.p) await c.p;
    if (c.data && Date.now() - c.at < ttl) return { ...c.data, at: c.at, stale: false };
    if (c.data && Date.now() - c.at < staleMs) return { ...c.data, at: c.at, stale: true };
    const e = c.err || new Error('Gerade keine Daten'); if (!e.status) e.status = 502; throw e;
  }

  // ------------------------------------------------------------ Abfahrten (Transitous / MOTIS)
  const RAIL = ['HIGHSPEED_RAIL', 'LONG_DISTANCE', 'NIGHT_RAIL', 'REGIONAL_FAST_RAIL', 'REGIONAL_RAIL', 'RAIL', 'SUBURBAN', 'SUBWAY', 'METRO', 'TRAM'];
  const art = m => (m === 'BUS' || m === 'COACH' ? 'bus' : RAIL.includes(m) ? 'bahn' : 'sonst');
  const STOP_RE = /^[A-Za-z0-9_:.|-]{3,120}$/;
  const minDiff = (a, b) => (a && b ? Math.round((Date.parse(a) - Date.parse(b)) / MIN) : 0);
  const color = c => (/^[0-9a-f]{6}$/i.test(String(c || '')) ? '#' + c.toLowerCase() : '');
  const depStore = memo(40), planStore = memo(20), placeStore = memo(100);

  async function loadDeps(stop) {
    const q = new URLSearchParams({ stopId: stop, n: '30' });
    const d = await getJson(`${X.abf.quelle}/api/v1/stoptimes?${q}`);
    const list = [];
    for (const s of Array.isArray(d.stopTimes) ? d.stopTimes : []) {
      const p = s.place || {};
      if (!p.departure && !p.scheduledDeparture) continue;
      if (p.pickupType === 'NOT_ALLOWED') continue;   // nur Ankunft (Endhaltestelle)
      list.push({
        linie: String(s.displayName || s.routeShortName || s.tripShortName || '').slice(0, 16),
        ziel: String(s.headsign || s.tripTo?.name || '').slice(0, 60),
        plan: p.scheduledDeparture || p.departure, echt: p.departure || p.scheduledDeparture,
        rt: !!s.realTime, ausfall: !!(s.cancelled || s.tripCancelled || p.cancelled), art: art(s.mode),
        farbe: color(s.routeColor), gleis: String(p.track || p.scheduledTrack || '').slice(0, 8),
      });
    }
    return { name: d.place?.name || '', list };
  }
  function legOut(l) {
    return {
      art: l.mode === 'WALK' ? 'fuss' : art(l.mode), linie: String(l.displayName || l.routeShortName || '').slice(0, 16),
      von: String(l.from?.name || '').slice(0, 50), nach: String(l.to?.name || '').slice(0, 50),
      ab: l.startTime, an: l.endTime, abPlan: l.scheduledStartTime || l.startTime, anPlan: l.scheduledEndTime || l.endTime,
      rt: !!l.realTime, ausfall: !!l.cancelled,
    };
  }
  async function loadPlan(from, to) {
    const q = new URLSearchParams({ fromPlace: from, toPlace: to, numItineraries: '3', detailedTransfers: 'false' });
    const d = await getJson(`${X.abf.quelle}/api/v5/plan?${q}`, 20000);
    if (d.error) { const e = new Error(String(d.error).slice(0, 120)); e.status = 502; throw e; }
    return {
      verbindungen: (d.itineraries || []).slice(0, 3).map(it => {
        const legs = (it.legs || []).filter(l => l.mode !== 'WALK').map(legOut);
        const f = legs[0], z = legs[legs.length - 1];
        return f ? {
          ab: f.ab, abPlan: f.abPlan, an: z.an, anPlan: z.anPlan, umstiege: Math.max(0, legs.length - 1),
          dauer: Math.round((Date.parse(it.endTime) - Date.parse(it.startTime)) / MIN),
          ausfall: legs.some(l => l.ausfall), linien: legs.map(l => ({ art: l.art, linie: l.linie, nach: l.nach, ab: l.ab, abPlan: l.abPlan, ausfall: l.ausfall })),
        } : null;
      }).filter(Boolean),
    };
  }
  async function abfahrten(u) {
    const stop = u.searchParams.get('stop') || '';
    if (!STOP_RE.test(stop)) { const e = new Error('Haltestelle?'); e.status = 400; throw e; }
    const want = new Set((u.searchParams.get('arten') || 'bus,bahn').split(',').filter(a => ['bus', 'bahn'].includes(a)));
    if (want.has('bahn') && want.has('bus')) want.add('sonst');
    const d = await cached(depStore, stop, X.abf.cache, () => loadDeps(stop));
    const now = Date.now();
    const list = d.list.filter(x => want.has(x.art) && Date.parse(x.echt) >= now - 30000).slice(0, X.abf.anzahl)
      .map(x => ({ ...x, delay: x.rt ? minDiff(x.echt, x.plan) : null }));
    const out = { name: d.name, at: d.at, stale: d.stale, abfahrten: list };
    const from = u.searchParams.get('von'), to = u.searchParams.get('nach');
    if (from && to && STOP_RE.test(from) && STOP_RE.test(to) && from !== to) {
      try { out.fahrt = await cached(planStore, from + '>' + to, 2 * MIN, () => loadPlan(from, to)); }
      catch (err) { warn('Fahrt', err.message); out.fahrt = null; }
    }
    return out;
  }

  // Haltestellensuche
  const searches = new Map();   // user -> Zeitstempel (höchstens 20 Suchen/Min. pro Person)
  async function orte(u) {
    const q = String(u.searchParams.get('q') || '').trim().slice(0, 60);
    const user = u.searchParams.get('user') || '';
    if (q.length < 3) return { orte: [] };
    const t = (searches.get(user) || []).filter(x => Date.now() - x < MIN);
    if (t.length >= 20) { const e = new Error('Zu viele Suchen – kurz warten'); e.status = 429; throw e; }
    t.push(Date.now()); searches.set(user, t);
    const d = await cached(placeStore, q.toLowerCase(), 10 * MIN, async () => {
      const r = await getJson(`${X.abf.quelle}/api/v1/geocode?${new URLSearchParams({ text: q, type: 'STOP', language: 'de' })}`);
      // dieselbe Haltestelle kommt aus mehreren Datenquellen -> nur die mit Verkehrsmitteln, je Name einmal
      const seen = new Set(), words = q.toLowerCase().split(/\s+/).filter(Boolean);
      return {
        orte: (Array.isArray(r) ? r : []).filter(x => x.type === 'STOP' && STOP_RE.test(String(x.id || ''))).map(x => {
          const area = (x.areas || []).filter(a => a.adminLevel >= 6 && a.adminLevel <= 8).map(a => a.name)[0] || '';
          const arten = [...new Set((x.modes || []).map(art))].filter(a => a !== 'sonst');
          return { id: x.id, name: String(x.name || '').slice(0, 60), ort: area && !String(x.name).includes(area) ? area : '', arten };
        }).filter(o => {
          const k = (o.name + '|' + o.ort).toLowerCase();
          if (!o.arten.length || seen.has(k)) return false;
          seen.add(k); return true;
        }).map((o, i) => ({ o, i, hit: words.every(w => o.name.toLowerCase().includes(w)) ? 0 : 1 }))
          .sort((a, b) => a.hit - b.hit || a.i - b.i).map(x => x.o).slice(0, 8),
      };
    }, 10 * MIN);
    return { orte: d.orte };
  }

  // ------------------------------------------------------------ Pakete (17TRACK in HA)
  let pak = { at: 0, data: null, p: null, entry: '' };
  const SIM_PAKETE = () => {
    const d = (h) => new Date(Date.now() - h * 3600000).toISOString();
    return [
      { name: 'Kopfhörer', status: 'heute', text: 'In Zustellung – Zustellung heute', zeit: d(2) },
      { name: 'Buch', status: 'unterwegs', text: 'Im Paketzentrum bearbeitet', zeit: d(20) },
      { name: 'Geschenk', status: 'zugestellt', text: 'Zugestellt', zeit: d(26) },
    ];
  };
  function pakStatus(p) {
    const s = String(p.status || '').toLowerCase(), t = String(p.info_text || '').toLowerCase();
    if (s.includes('delivered') && !s.includes('undelivered')) return 'zugestellt';
    if (s.includes('undelivered') || s.includes('alert') || s.includes('expired') || s.includes('exception')) return 'problem';
    if (s.includes('pick')) return 'abholbereit';
    if (/zustellung heute|in zustellung|zustellfahrzeug|out for delivery|delivery today|wird heute/.test(t)) return 'heute';
    if (s.includes('not found')) return 'unbekannt';
    return 'unterwegs';
  }
  async function loadPakete() {
    if (meta.mode !== 'live') return { pakete: SIM_PAKETE(), test: true };
    const be = backend();
    if (!meta.connected || !be?.send) { const e = new Error('Home Assistant nicht verbunden'); e.status = 503; throw e; }
    if (!pak.entry) {
      const entries = await be.send({ type: 'config_entries/get', domain: 'seventeentrack' }, 15000);
      pak.entry = (entries || []).find(x => x.domain === 'seventeentrack' && x.state === 'loaded')?.entry_id || '';
      if (!pak.entry) return { pakete: [], fehlt: true };
    }
    let r;
    try {
      r = await be.send({ type: 'call_service', domain: 'seventeentrack', service: 'get_packages', service_data: { config_entry_id: pak.entry }, return_response: true }, 30000);
    } catch (err) { pak.entry = ''; throw err; }
    const list = r?.response?.packages || [];
    const grenze = Date.now() - X.pak.tage * 86400000;
    const out = [];
    for (const p of Array.isArray(list) ? list : []) {
      const status = pakStatus(p), zeit = p.timestamp || '';
      if (status === 'zugestellt' && (!zeit || Date.parse(zeit) < grenze)) continue;
      out.push({
        // nie die Sendungsnummer ausgeben – nur den selbst vergebenen Namen
        name: String(p.friendly_name || '').slice(0, 50) || 'Paket ohne Namen',
        status, text: String(p.info_text || '').slice(0, 140), ort: String(p.location || '').slice(0, 50), zeit,
      });
    }
    const rang = { heute: 0, problem: 1, abholbereit: 2, unterwegs: 3, unbekannt: 4, zugestellt: 5 };
    out.sort((a, b) => rang[a.status] - rang[b.status] || String(b.zeit).localeCompare(String(a.zeit)));
    return { pakete: out.slice(0, 15) };
  }
  async function pakete() {
    if (!X.pak.aktiv) return { pakete: [], aus: true };
    const now = Date.now();
    if (pak.data && now - pak.at < X.pak.cache) return { ...pak.data, at: pak.at };
    if (!pak.p && now - (pak.fail || 0) > MIN) {
      pak.p = loadPakete().then(d => { pak.data = d; pak.at = Date.now(); }, err => { pak.fail = Date.now(); warn('Pakete', err.message); }).finally(() => { pak.p = null; });
    }
    if (pak.p) await pak.p;
    if (pak.data) return { ...pak.data, at: pak.at, stale: Date.now() - pak.at > X.pak.cache };
    const e = new Error('Pakete gerade nicht abrufbar'); e.status = 502; throw e;
  }

  // ------------------------------------------------------------ System-Status
  const run = (cmd, args, ms = 5000) => new Promise(res => {
    execFile(cmd, args, { timeout: ms, maxBuffer: 64 * 1024 }, (err, out) => res({ err, out: String(out || '') }));
  });
  const ampel = (v, [g, r]) => (!Number.isFinite(v) ? 'n' : v >= r ? 'r' : v >= g ? 'y' : 'g');
  const tageAlt = iso => (iso ? (Date.now() - Date.parse(iso)) / 86400000 : NaN);
  let pbVersion = { at: 0, v: '' };

  // Verlauf für die Kurven im System-Reiter: Last (in % der Kerne), RAM und Speicher (belegt in %), alle 5 Min. ein Punkt,
  // 24 Stunden lang, nur im Speicher (nach einem Neustart fängt die Kurve neu an).
  const KURVE_MS = 5 * MIN, KURVE_N = 288;
  const kurve = [];
  function merke(p) {
    const now = Date.now(), last = kurve[kurve.length - 1];
    if (last && now - last.t < KURVE_MS - 20000) return;
    kurve.push({ t: now, ...p });
    if (kurve.length > KURVE_N) kurve.splice(0, kurve.length - KURVE_N);
  }
  const r1 = v => (Number.isFinite(v) ? Math.round(v * 10) / 10 : null);

  async function vps() {
    const items = [];
    const cores = os.cpus().length || 1, [l1, l5, l15] = os.loadavg();
    const p = { last: r1((l1 / cores) * 100), ram: null, disk: null };
    items.push({ k: 'last', name: 'Last', wert: [l1, l5, l15].map(x => x.toFixed(2).replace('.', ',')).join(' · '), info: `${cores} Kerne`, a: ampel(l5 / cores, X.sys.sw.last) });
    try {
      const mi = Object.fromEntries(fs.readFileSync('/proc/meminfo', 'utf8').split('\n').map(l => l.split(/:\s+/)).filter(x => x[1]).map(([k, v]) => [k, parseInt(v, 10)]));
      const used = 100 - (mi.MemAvailable / mi.MemTotal) * 100;
      p.ram = r1(used);
      items.push({ k: 'vps_ram', name: 'RAM', wert: `${Math.round(used)} %`, info: `${(mi.MemAvailable / 1048576).toFixed(1).replace('.', ',')} von ${(mi.MemTotal / 1048576).toFixed(1).replace('.', ',')} GB frei`, a: ampel(used, X.sys.sw.ram) });
    } catch (_) { items.push({ k: 'vps_ram', name: 'RAM', wert: '–', a: 'n' }); }
    try {
      const s = await fs.promises.statfs('/');
      const used = 100 - (s.bavail / s.blocks) * 100;
      p.disk = r1(used);
      items.push({ k: 'vps_disk', name: 'Speicher', wert: `${(s.bavail * s.bsize / 1e9).toFixed(1).replace('.', ',')} GB frei`, info: `${Math.round(used)} % belegt`, a: ampel(used, X.sys.sw.festplatte) });
    } catch (_) { items.push({ k: 'vps_disk', name: 'Speicher', wert: '–', a: 'n' }); }
    merke(p);
    const up = os.uptime(), d = Math.floor(up / 86400), h = Math.floor(up % 86400 / 3600);
    items.push({ k: 'uptime', name: 'Laufzeit', wert: d ? `${d} T ${h} Std.` : `${h} Std. ${Math.floor(up % 3600 / 60)} Min.`, a: 'g' });
    if (X.sys.dienste.length) {
      const r = await run('systemctl', ['is-active', ...X.sys.dienste]);
      const st = r.out.trim().split('\n');
      X.sys.dienste.forEach((n, i) => {
        const s = (st[i] || 'unbekannt').trim();
        items.push({ k: 'dienst_' + n, name: n, wert: s === 'active' ? 'aktiv' : s, a: s === 'active' ? 'g' : s === 'activating' || s === 'reloading' ? 'y' : 'r', dienst: true });
      });
    }
    const g = await run('git', ['-C', X.sys.repo, 'log', '-1', '--format=%h%x09%cI%x09%s']);
    if (!g.err) {
      const [hash, when, subj] = g.out.trim().split('\t');
      let dep = when;
      try { dep = fs.statSync(path.join(X.sys.repo, '.git', 'ORIG_HEAD')).mtime.toISOString(); } catch (_) {}
      items.push({ k: 'deploy', name: 'Letzter Deploy', wert: hash, zeit: dep, info: String(subj || '').slice(0, 90), a: 'g' });
    }
    if (Date.now() - pbVersion.at > 3600000) {
      const r = await run(X.sys.pocketbase, ['--version']);
      pbVersion = { at: Date.now(), v: (r.out.match(/(\d+\.\d+\.\d+)/) || [])[1] || '' };
    }
    if (pbVersion.v) items.push({ k: 'pbv', name: 'PocketBase', wert: pbVersion.v, a: 'g' });
    return items;
  }

  let haCache = { at: 0, list: null };
  async function haItems() {
    const items = [];
    const H = X.sys.ha;
    if (meta.mode !== 'live') {
      items.push({ k: 'ha', name: 'Verbindung', wert: 'Testmodus', a: 'y' });
      const sim = [['cpu_temp', 'CPU-Temperatur', 48, '°C'], ['cpu', 'CPU', 7, '%'], ['ha_ram', 'RAM', 22, '%'], ['ha_disk', 'Festplatte', 12, '%']];
      for (const [k, name, v, e] of sim) items.push({ k, name, wert: `${v} ${e}`, a: ampel(v, X.sys.sw[k === 'ha_ram' ? 'ram' : k === 'ha_disk' ? 'festplatte' : k]) });
      items.push({ k: 'ha_backup', name: 'HA-Backup', wert: 'Test', zeit: new Date(Date.now() - 8 * 3600000).toISOString(), a: 'g' });
      return { items, updates: [{ name: 'Home Assistant Core', von: '2026.11.0', nach: '2026.11.1' }] };
    }
    items.push({ k: 'ha', name: 'Verbindung', wert: meta.connected ? 'erreichbar' : 'nicht erreichbar', info: meta.connected ? '' : String(meta.error || '').slice(0, 80), a: meta.connected ? 'g' : 'r' });
    if (!meta.connected) return { items, updates: [] };
    if (!haCache.list || Date.now() - haCache.at > 45000) {
      try { haCache = { at: Date.now(), list: await backend().send({ type: 'get_states' }, 20000) }; }
      catch (err) { warn('System/HA', err.message); }
    }
    const all = new Map((haCache.list || []).map(s => [s.entity_id, s]));
    const v = id => { const s = id && all.get(id); const n = s ? parseFloat(s.state) : NaN; return Number.isFinite(n) ? n : NaN; };
    const add = (k, name, id, unit, sw, d = 0) => { if (!id) return; const n = v(id); items.push({ k, name, wert: Number.isFinite(n) ? `${n.toFixed(d).replace('.', ',')} ${unit}` : 'nicht verfügbar', a: ampel(n, sw) }); };
    add('cpu_temp', 'CPU-Temperatur', H.cpu_temp, '°C', X.sys.sw.cpu_temp, 1);
    add('cpu', 'CPU', H.cpu, '%', X.sys.sw.cpu);
    add('ha_ram', 'RAM', H.ram, '%', X.sys.sw.ram);
    add('ha_disk', 'Festplatte', H.festplatte, '%', X.sys.sw.festplatte, 1);
    if (H.backup) {
      const s = all.get(H.backup), ok = s && !['unknown', 'unavailable'].includes(s.state) && !Number.isNaN(Date.parse(s.state));
      items.push({ k: 'ha_backup', name: 'HA-Backup', wert: ok ? '' : 'keins gefunden', zeit: ok ? new Date(s.state).toISOString() : '', a: ok ? ampel(tageAlt(s.state), X.sys.sw.backup_tage) : 'r' });
    }
    const ids = H.updates === 'update.*' ? [...all.keys()].filter(id => id.startsWith('update.')) : H.updates;
    const updates = ids.map(id => all.get(id)).filter(s => s && s.state === 'on').map(s => ({
      name: String(s.attributes?.title || s.attributes?.friendly_name || s.entity_id).replace(/ Update$/, '').slice(0, 50),
      von: String(s.attributes?.installed_version || '').slice(0, 20), nach: String(s.attributes?.latest_version || '').slice(0, 20),
    }));
    items.push({ k: 'updates', name: 'Updates', wert: updates.length ? `${updates.length} verfügbar` : 'aktuell', a: updates.length ? 'y' : 'g' });
    return { items, updates };
  }

  async function backups() {
    const items = [];
    try {
      const list = await api('GET', '/api/backups');
      const last = (list || []).map(b => b.modified).sort().pop();
      const iso = last ? new Date(String(last).replace(' ', 'T')).toISOString() : '';
      items.push({ k: 'pb_backup', name: 'PocketBase-Backup', wert: iso ? '' : 'keins', zeit: iso, info: `${(list || []).length} gespeichert`, a: iso ? ampel(tageAlt(iso), X.sys.sw.backup_tage) : 'r' });
    } catch (err) { items.push({ k: 'pb_backup', name: 'PocketBase-Backup', wert: 'nicht lesbar', a: 'n' }); warn('System/PB-Backups', err.message); }
    try {
      let best = 0, name = '';
      for (const n of await fs.promises.readdir(X.sys.backups)) {
        const st = await fs.promises.stat(path.join(X.sys.backups, n)).catch(() => null);
        if (st && st.mtimeMs > best) { best = st.mtimeMs; name = n; }
      }
      // nur für den Besitzer: Ordnername ohne Datum reicht als Hinweis
      items.push({ k: 'man_backup', name: 'Manuelles Backup', wert: best ? '' : 'keins', zeit: best ? new Date(best).toISOString() : '', info: name.replace(/-?\d{4}-\d{2}-\d{2}.*/, '').slice(0, 40), a: 'g', ohne_ampel: true });
    } catch (_) { items.push({ k: 'man_backup', name: 'Manuelles Backup', wert: 'Ordner fehlt', a: 'n' }); }
    return items;
  }

  const worst = items => (items.some(i => i.a === 'r') ? 'r' : items.some(i => i.a === 'y') ? 'y' : items.some(i => i.a === 'g') ? 'g' : 'n');
  let sysCache = { at: 0, data: null, p: null };
  async function collect() {
    const [v, h, b] = await Promise.all([
      vps().catch(err => { warn('System/VPS', err.message); return []; }),
      haItems().catch(err => { warn('System/HA', err.message); return { items: [], updates: [] }; }),
      backups().catch(() => []),
    ]);
    const gruppen = [
      { k: 'vps', name: 'VPS', items: v, a: worst(v) },
      { k: 'ha', name: 'Home Assistant · Pi', items: h.items, updates: h.updates, a: worst(h.items) },
      { k: 'backup', name: 'Backups', items: b, a: worst(b) },
    ];
    // Testmodus (lokale Vorschau): ausgedachte 24-Stunden-Kurve, damit der Reiter etwas zu zeigen hat
    if (meta.mode !== 'live' && kurve.length < 12) {
      const now = Date.now();
      const test = Array.from({ length: KURVE_N }, (_, i) => {
        const t = now - (KURVE_N - 1 - i) * KURVE_MS, h = new Date(t).getHours() + new Date(t).getMinutes() / 60;
        return { t, last: r1(8 + 10 * Math.max(0, Math.sin((h - 7) / 24 * 2 * Math.PI)) + (i % 7) * 1.3), ram: r1(41 + 6 * Math.sin(i / 23) + (i % 5)), disk: r1(52 + i * 0.004) };
      });
      return { gruppen, a: worst(gruppen.flatMap(g => g.items)), at: now, kurve: test, test: true };
    }
    return { gruppen, a: worst(gruppen.flatMap(g => g.items)), at: Date.now(), kurve: kurve.slice() };
  }
  async function system() {
    if (sysCache.data && Date.now() - sysCache.at < 30000) return sysCache.data;
    if (!sysCache.p) sysCache.p = collect().then(d => { sysCache = { at: Date.now(), data: d, p: null }; alerts(d); return d; }, err => { sysCache.p = null; throw err; });
    return sysCache.p;
  }

  // Rot länger als push_rot_minuten -> ein Push an den Besitzer (höchstens 1× pro Problem und Tag), Erholung kurz melden
  const red = new Map();   // k -> { since, sent, name }
  const day = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
  async function queue(title, body, key) {
    if (!X.besitzer || !X.sys.push) return;
    try {
      const f = encodeURIComponent(`key="${key}"`);
      const r = await api('GET', `/api/collections/push_queue/records?filter=${f}&perPage=1&skipTotal=1`);
      if (r.items.length) return;
      await api('POST', '/api/collections/push_queue/records', { user: X.besitzer, kind: 'system', title, body, key, url: '/', count: 1, send_after: new Date().toISOString().replace('T', ' ') });
    } catch (err) { warn('System-Push', err.message); }
  }
  function alerts(d) {
    if (!X.sys.push) return;
    const now = Date.now(), seen = new Set();
    for (const g of d.gruppen) for (const i of g.items) {
      if (i.a !== 'r') continue;
      seen.add(i.k);
      const r = red.get(i.k) || { since: now, sent: false };
      r.name = `${g.name}: ${i.name}`; r.wert = i.wert || '';
      red.set(i.k, r);
      if (!r.sent && now - r.since >= X.sys.push * MIN) {
        r.sent = true;
        queue(`⚠️ ${r.name}`, `${r.wert ? r.wert + ' · ' : ''}seit ${Math.round((now - r.since) / MIN)} Min. rot`, `sys-${i.k}-${day()}`);
      }
    }
    for (const [k, r] of red) {
      if (seen.has(k)) continue;
      red.delete(k);
      if (r.sent) queue(`✅ ${r.name}`, 'wieder in Ordnung', `sys-ok-${k}-${r.since}`);
    }
  }
  // im Hintergrund alle 2 Minuten prüfen (für den Push), auch wenn niemand die Karte offen hat
  const bg = () => system().catch(err => warn('System', err.message));
  setTimeout(bg, 30000);
  setInterval(bg, 2 * MIN);

  // ------------------------------------------------------------ HTTP (nur 127.0.0.1, von PocketBase aufgerufen)
  function deny(msg = 'Nur für den Besitzer') { const e = new Error(msg); e.status = 403; throw e; }
  const owner = u => { const user = u.searchParams.get('user') || ''; if (!user || !X.besitzer || user !== X.besitzer) deny(); };
  const ROUTES = {
    '/x/rechte': u => ({ besitzer: !!X.besitzer && u.searchParams.get('user') === X.besitzer, pakete: X.pak.aktiv }),
    '/x/abfahrten': abfahrten,
    '/x/orte': orte,
    '/x/pakete': u => { owner(u); return pakete(); },
    '/x/system': u => { owner(u); return system(); },
  };
  function route(req, res, u) {
    const fn = req.method === 'GET' && ROUTES[u.pathname];
    if (!fn) return false;
    const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
    Promise.resolve().then(() => fn(u)).then(r => send(200, r), err => {
      if (!err.status || err.status >= 500) warn('Extras ' + u.pathname, err.message || String(err));
      send(err.status && err.status < 600 ? err.status : 502, { message: err.name === 'TimeoutError' ? 'Zeitüberschreitung' : (err.message || 'Fehler') });
    });
    return true;
  }
  return { route, reload: readConfig };
};
