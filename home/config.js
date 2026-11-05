// Liest home/config.jsonc, prüft sie und baut daraus die Freigabeliste (welche entity_id welche Dienste darf).
'use strict';
const fs = require('fs');

const ENTITY_RE = /^[a-z_]+\.[a-z0-9_]+$/;
const HEX_RE = /^#[0-9a-f]{6}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^(\d{1,2}:\d{2})?$/;

// Erlaubte Dienste pro Bereich (domain) – alles andere wird abgelehnt
const SERVICES = {
  light: ['turn_on', 'turn_off', 'toggle'],
  scene: ['turn_on'],
  script: ['turn_on'],
  automation: ['turn_on', 'turn_off', 'trigger'],
  switch: ['turn_on', 'turn_off'],
  input_boolean: ['turn_on', 'turn_off'],
  input_datetime: ['set_datetime'],
  input_number: ['set_value'],
  fan: ['turn_on', 'turn_off'],
  media_player: ['turn_on', 'turn_off', 'volume_up', 'volume_down', 'volume_set', 'volume_mute', 'media_play_pause',
    'media_next_track', 'media_previous_track', 'select_source'],
  remote: ['send_command', 'turn_on'],
  sensor: [],
  binary_sensor: [],
  calendar: [],
};
// Fernbedienung: nur Navigationstasten
const REMOTE_KEYS = ['DPAD_UP', 'DPAD_DOWN', 'DPAD_LEFT', 'DPAD_RIGHT', 'DPAD_CENTER', 'BACK', 'HOME', 'MENU', 'SEARCH'];

// nur ganze Kommentarzeilen (// …) entfernen – so bleiben "https://…" in Texten heil
function parseJsonc(text) {
  return JSON.parse(text.split('\n').filter(l => !l.trim().startsWith('//')).join('\n'));
}

const str = (v, max = 60) => String(v == null ? '' : v).trim().slice(0, max);

function load(file) {
  const raw = parseJsonc(fs.readFileSync(file, 'utf8'));
  const errors = [];
  const allow = new Map(); // entity_id -> { domain, name, kind }

  function entity(id, domains, where, name, kind) {
    id = str(id, 120);
    if (!id) return '';
    if (!ENTITY_RE.test(id)) { errors.push(`${where}: "${id}" ist keine gültige entity_id`); return ''; }
    const domain = id.split('.')[0];
    if (!domains.includes(domain)) { errors.push(`${where}: "${id}" muss mit ${domains.map(d => d + '.').join(' oder ')} anfangen`); return ''; }
    allow.set(id, { domain, name, kind });
    return id;
  }
  function internId(v, domain, where) {
    v = str(v, 120);
    if (!v || v === 'auto') return v;
    if (!ENTITY_RE.test(v) || !v.startsWith(domain + '.')) { errors.push(`${where}: "${v}" muss "auto" oder ${domain}.… sein`); return ''; }
    return v;
  }
  const color = (c, fb) => (HEX_RE.test(String(c || '')) ? String(c).toLowerCase() : fb);
  const list = v => (Array.isArray(v) ? v : []);
  const pct = v => Math.max(1, Math.min(100, Math.round(Number(v) || 50)));

  const lampen = list(raw.lampen).slice(0, 8).map((l, i) => {
    const name = str(l.name) || `Lampe ${i + 1}`;
    const t = l.test || {};
    return {
      name, entity_id: entity(l.entity_id, ['light'], `lampen[${i}]`, name, 'lampe'),
      farbe: color(l.farbe, '#ffc78f'),
      test: { an: !!t.an, helligkeit: pct(t.helligkeit), farbe: color(t.farbe, color(l.farbe, '#ffc78f')) },
    };
  }).filter(l => l.entity_id);

  const farbnamen = {};
  for (const [k, v] of Object.entries(raw.farbnamen || {})) if (HEX_RE.test(k)) farbnamen[k.toLowerCase()] = str(v, 20);

  const geraete = list(raw.geraete || raw.schalter).slice(0, 12).map((g, i) => {
    const name = str(g.name) || `Gerät ${i + 1}`;
    return {
      name, entity_id: entity(g.entity_id, ['switch', 'input_boolean', 'fan'], `geraete[${i}]`, name, 'geraet'),
      icon: str(g.icon, 20) || 'bolt', farbe: color(g.farbe, '#ffb35c'),
      watt: Math.max(0, Number(g.watt) || 0), text_an: str(g.text_an, 30), test_an: !!g.test_an,
    };
  }).filter(g => g.entity_id);

  let fernseher = null;
  if (raw.fernseher && raw.fernseher.entity_id) {
    const f = raw.fernseher, name = str(f.name) || 'Fernseher';
    const id = entity(f.entity_id, ['media_player'], 'fernseher', name, 'tv');
    const remote = f.remote ? entity(f.remote, ['remote'], 'fernseher.remote', name, 'remote') : '';
    if (id) {
      fernseher = {
        name, entity_id: id, remote, max_lautstaerke: Math.max(1, Math.min(100, Number(f.max_lautstaerke) || 50)),
        cast: f.cast ? entity(f.cast, ['media_player'], 'fernseher.cast', name, 'cast') : '',
        apps: list(f.apps).slice(0, 16).map(a => ({ name: str(a.name, 30), farbe: color(a.farbe, '#7b5cff'), start: str(a.start, 200), paket: str(a.paket, 120), test: str(a.test, 60) })).filter(a => a.name),
        quellen: list(f.quellen).slice(0, 8).map(q => ({ name: str(q.name, 20), source: str(q.source || q.name, 40), icon: str(q.icon, 10) || 'tv' })).filter(q => q.name),
        an_skript: f.an_skript ? entity(f.an_skript, ['script'], 'fernseher.an_skript', name, 'tvan') : '',
        // nur für wir-home (nie in der Freigabeliste / an die App): "auto" = in HA suchen, sonst entity_id
        intern: {
          adb: internId(f.adb, 'media_player', 'fernseher.adb'),
          wol: internId(f.wol, 'button', 'fernseher.wol'),
        },
      };
    }
  }

  const routinen = list(raw.routinen).slice(0, 8).map((r, i) => {
    const name = str(r.name) || `Routine ${i + 1}`;
    return { name, entity_id: entity(r.entity_id, ['automation'], `routinen[${i}]`, name, 'routine'), info: str(r.info, 40), icon: str(r.icon, 20) || 'clock', test_an: !!r.test_an };
  }).filter(r => r.entity_id);

  const k = raw.klima || {};
  const klima = {};
  for (const key of ['temperatur', 'luftfeuchte', 'co2', 'strom_heute', 'leistung']) klima[key] = entity(k[key], ['sensor'], 'klima.' + key, key, 'klima');

  const ARTEN = ['fenster', 'tuer', 'bewegung', 'sonstiges'];
  const sensoren = list(raw.sensoren).slice(0, 8).map((s, i) => ({
    name: str(s.name) || `Sensor ${i + 1}`,
    entity_id: entity(s.entity_id, ['binary_sensor'], `sensoren[${i}]`, str(s.name), 'sensor'),
    art: ARTEN.includes(s.art) ? s.art : 'sonstiges', test_offen_min: Number(s.test_offen_min) || 0,
  })).filter(s => s.entity_id);

  const kal = raw.kalender || {};
  const WER = ['d', 'i', 'g'];
  const farben = {};
  for (const w of WER) farben[w] = color(kal.farben?.[w], '');
  const kalender = {
    automatisch: !!kal.automatisch, standard: WER.includes(kal.standard) ? kal.standard : 'g', farben,
    quellen: list(kal.quellen).slice(0, 8).map((q, i) => ({ entity_id: entity(q.entity_id, ['calendar'], `kalender.quellen[${i}]`, '', 'kalender'), wer: WER.includes(q.wer) ? q.wer : 'g' })).filter(q => q.entity_id),
    testtermine: list(kal.testtermine).slice(0, 200).map(t => ({
      d: DATE_RE.test(t.d) ? t.d : '', s: DATE_RE.test(t.s) ? t.s : '', to: DATE_RE.test(t.to) ? t.to : '',
      t: TIME_RE.test(t.t || '') ? (t.t || '') : '', e: TIME_RE.test(t.e || '') ? (t.e || '') : '',
      n: str(t.n, 60), w: WER.includes(t.w) ? t.w : 'g',
    })).filter(t => t.n && (t.d || (t.s && t.to))),
  };

  // Szenen: entity_id (scene./script.) oder Aktionen; Aktionen werden beim Laden gegen die Freigabeliste geprüft
  const tmp = { cfg: { lampen, fernseher, geraete }, allow };
  const szenen = list(raw.szenen).slice(0, 10).map((s, i) => {
    const name = str(s.name) || `Szene ${i + 1}`;
    const id = s.entity_id ? entity(s.entity_id, ['scene', 'script'], `szenen[${i}]`, name, 'szene') : '';
    const aktionen = [];
    list(s.aktionen).slice(0, 20).forEach((a, j) => {
      try { check(tmp, { entity_id: a.entity_id, service: a.service, data: a.data || {} }); aktionen.push({ entity_id: a.entity_id, service: a.service, data: a.data || {} }); }
      catch (err) { errors.push(`szenen[${i}].aktionen[${j}]: ${err.message}`); }
    });
    // optional "fernseher": { "an": true, "app": "Netflix", "lautstaerke": 20, "helligkeit": 0 } – macht wir-home per ADB
    let tvs = null;
    if (s.fernseher && fernseher) {
      const f = s.fernseher, num = v => (v === undefined || v === null || v === '' ? null : Math.max(0, Math.min(100, Math.round(Number(v)) || 0)));
      const app = str(f.app, 30);
      if (app && !fernseher.apps.some(a => a.name === app)) errors.push(`szenen[${i}].fernseher.app: "${app}" steht nicht unter fernseher.apps`);
      tvs = { an: f.an !== false, app: fernseher.apps.some(a => a.name === app) ? app : '', lautstaerke: num(f.lautstaerke), helligkeit: num(f.helligkeit) };
    }
    return { key: 'sz' + i, name, icon: str(s.icon, 20) || 'stars', farbe: color(s.farbe, '#7b5cff'), entity_id: id, aktionen, fernseher: tvs };
  }).filter(s => s.entity_id || s.aktionen.length);

  // Lichtwecker-Helfer: nur wir-home setzt sie (aus den Wecker-Einstellungen), die App darf sie nicht schalten
  const wk = raw.wecker || {};
  const wecker = {
    aktiv: entity(wk.aktiv, ['input_boolean'], 'wecker.aktiv', 'Wecker aktiv', 'wecker'),
    aussetzen: entity(wk.aussetzen, ['input_boolean'], 'wecker.aussetzen', 'Wecker aussetzen', 'wecker'),
    zeit: entity(wk.zeit, ['input_datetime'], 'wecker.zeit', 'Weckzeit', 'wecker'),
    vorlauf: entity(wk.vorlauf, ['input_number'], 'wecker.vorlauf', 'Vorlauf', 'wecker'),
    tage: list(wk.tage).slice(0, 7).map((t, i) => entity(t, ['input_boolean'], `wecker.tage[${i}]`, 'Wecker Tag ' + (i + 1), 'wecker')),
    test: wk.test ? entity(wk.test, ['script'], 'wecker.test', 'Sonnenaufgang', 'wecker') : '',
    test_sekunden: Math.max(30, Math.min(300, Math.round(Number(wk.test_sekunden) || 60))),
  };
  wecker.ok = !!(wecker.aktiv && wecker.zeit && wecker.tage.length === 7 && wecker.tage.every(Boolean));

  const w = raw.wetter || {};
  const wetter = Number.isFinite(+w.lat) && Number.isFinite(+w.lon) && w.lat !== '' && w.lon !== ''
    ? { ort: str(w.ort, 40) || 'Wetter', lat: +w.lat, lon: +w.lon } : null;

  const cfg = { wetter, lampen, farbnamen, geraete, fernseher, szenen, routinen, klima, sensoren, kalender, wecker };
  return { cfg, allow, errors };
}

// Prüft einen Befehl aus der App gegen die Freigabeliste.
// Rückgabe: { calls: [{ domain, service, entity_ids, data }], label } oder wirft Error mit .status = 400
function check(conf, cmd, states) {
  const bad = msg => { const e = new Error(msg); e.status = 400; throw e; };
  const [domain, service, extra] = String(cmd.service || '').split('.');
  if (!domain || !service || extra !== undefined) bad('Unbekannter Dienst');
  const id = String(cmd.entity_id || '');
  const data = cmd.data && typeof cmd.data === 'object' && !Array.isArray(cmd.data) ? cmd.data : {};
  const keys = Object.keys(data);
  const only = (...allowed) => { for (const k of keys) if (!allowed.includes(k)) bad('Wert nicht erlaubt: ' + String(k).slice(0, 30)); };
  const cfg = conf.cfg;

  // Sonderfall: alle Lampen
  if (id === '*lampen') {
    if (domain !== 'light' || !['turn_on', 'turn_off'].includes(service)) bad('Nicht erlaubt');
    only();
    const ids = cfg.lampen.map(l => l.entity_id);
    if (!ids.length) bad('Keine Lampen eingetragen');
    return { calls: [{ domain, service, entity_ids: ids, data: {} }], label: `Alle Lampen ${service === 'turn_on' ? 'an' : 'aus'}` };
  }

  // Sonderfall: Weckvorgang testen = Sonnenaufgang-Skript mit fester Dauer (nichts sonst an den Wecker-Helfern)
  if (domain === 'wecker' && service === 'test') {
    only();
    const wk = cfg.wecker;
    if (!wk?.test) bad('Kein Test-Sonnenaufgang eingetragen');
    return { calls: [{ domain: 'script', service: 'turn_on', entity_ids: [wk.test], data: { variables: { dauer: wk.test_sekunden } } }], label: `Test-Sonnenaufgang (${wk.test_sekunden} s)` };
  }

  const ent = conf.allow.get(id);
  if (!ent) bad('Gerät nicht freigegeben');
  const name = ent.name || id;

  // Sonderfall: App auf dem Fernseher starten (nur Apps aus der Konfiguration)
  if (domain === 'tv' && service === 'app') {
    const tv = cfg.fernseher;
    if (!tv || id !== tv.entity_id) bad('Gerät nicht freigegeben');
    only('app');
    const app = tv.apps.find(a => a.name === data.app);
    if (!app) bad('App nicht freigegeben');
    // Fernseher aus -> wake: wir-home weckt ihn erst (Einschalt-Routine) und startet die App, sobald er an ist
    const off = ['off', 'standby', 'unavailable', 'unknown', undefined].includes(states?.get(tv.entity_id)?.state);
    const calls = app.start && tv.remote ? [{ domain: 'remote', service: 'turn_on', entity_ids: [tv.remote], data: { activity: app.start } }]
      : [{ domain: 'media_player', service: 'select_source', entity_ids: [tv.entity_id], data: { source: app.name } }];
    return { calls, label: `${name}: ${app.name}`, app: app.name, wake: off };
  }

  // Sonderfall: "läuft gerade" anfordern, solange Zuhause offen ist (kein Befehl an HA, wir-home fragt dann den Titel ab)
  if (domain === 'tv' && service === 'watch') {
    const tv = cfg.fernseher;
    if (!tv || id !== tv.entity_id) bad('Gerät nicht freigegeben');
    only();
    return { calls: [], label: '', watch: true };
  }

  // Sonderfall: App-Logos vom Fernseher neu einlesen (wir-home liest sie selbst per ADB, die App startet es nur)
  if (domain === 'tv' && service === 'logos') {
    const tv = cfg.fernseher;
    if (!tv || id !== tv.entity_id) bad('Gerät nicht freigegeben');
    only();
    return { calls: [], label: 'App-Logos neu einlesen', logos: true };
  }

  // Fernseher-Extras per ADB (wir-home führt sie selbst aus und prüft Eingang/App gegen die vom Fernseher gelesenen Listen):
  // Bildschirmfoto, Eingang (HDMI), Text eingeben, Bild aus/an (Ton läuft weiter), Bildhelligkeit, weitere installierte App starten
  if (domain === 'tv' && ['bildschirm', 'eingang', 'text', 'bild', 'helligkeit', 'starten'].includes(service)) {
    const tv = cfg.fernseher;
    if (!tv || id !== tv.entity_id) bad('Gerät nicht freigegeben');
    if (service === 'helligkeit') {
      only('wert');
      if (!Number.isInteger(data.wert) || data.wert < 0 || data.wert > 100) bad('Helligkeit 0–100');
      return { calls: [], label: `${tv.name}: Bildhelligkeit ${data.wert}`, tvx: { art: 'helligkeit', wert: data.wert } };
    }
    const name = tv.name;
    if (service === 'bildschirm') { only(); return { calls: [], label: `${name}: Bildschirmfoto`, tvx: { art: 'bildschirm' } }; }
    if (service === 'eingang') {
      only('eingang');
      if (!/^(tv|hdmi\d)$/.test(String(data.eingang))) bad('Eingang?');
      return { calls: [], label: `${name}: ${data.eingang === 'tv' ? 'Smart TV' : 'HDMI ' + data.eingang.slice(4)}`, tvx: { art: 'eingang', eingang: data.eingang } };
    }
    if (service === 'text') {
      only('text', 'enter', 'loeschen');
      const text = typeof data.text === 'string' ? data.text : '';
      if (text.length > 200) bad('Text zu lang');
      const loeschen = data.loeschen == null ? 0 : data.loeschen;
      if (!Number.isInteger(loeschen) || loeschen < 0 || loeschen > 50) bad('Löschen 0–50');
      if (!text && !loeschen && !data.enter) bad('Kein Text');
      return { calls: [], label: `${name}: Text eingegeben`, tvx: { art: 'text', text, enter: !!data.enter, loeschen } };
    }
    if (service === 'bild') {
      only('aus');
      if (typeof data.aus !== 'boolean') bad('Bild aus: ja/nein');
      return { calls: [], label: `${name}: Bild ${data.aus ? 'aus (Ton an)' : 'an'}`, tvx: { art: 'bild', aus: data.aus } };
    }
    only('paket');
    if (!/^[a-zA-Z][\w.]{1,120}$/.test(String(data.paket))) bad('App?');
    return { calls: [], label: `${name}: App ${data.paket}`, tvx: { art: 'starten', paket: data.paket } };
  }

  if (ent.domain !== domain) bad('Dienst passt nicht zum Gerät');
  if (!(SERVICES[domain] || []).includes(service)) bad('Dienst nicht erlaubt');
  if (['klima', 'sensor', 'kalender', 'cast'].includes(ent.kind)) bad('Nur lesbar');
  if (ent.kind === 'wecker') bad('Nur über die Wecker-Einstellungen');
  // App-Start über remote.turn_on nur mit tv.app (prüft die App-Liste)
  if (domain === 'remote' && service === 'turn_on') bad('Dienst nicht erlaubt');

  const clean = {};
  let label = name;
  if (domain === 'light') {
    if (service === 'toggle') only();
    else if (service === 'turn_off') only('transition');
    for (const [k, v] of Object.entries(data)) {
      if (k === 'transition') { if (typeof v !== 'number' || !(v >= 0 && v <= 10)) bad('Übergang 0–10 s'); clean[k] = Math.round(v * 10) / 10; continue; }
      if (k === 'brightness_pct') { if (!Number.isInteger(v) || v < 1 || v > 100) bad('Helligkeit 1–100'); clean[k] = v; }
      else if (k === 'color_temp_kelvin') { if (!Number.isInteger(v) || v < 1500 || v > 9000) bad('Weißton ungültig'); clean[k] = v; }
      else if (k === 'rgb_color') { if (!Array.isArray(v) || v.length !== 3 || !v.every(x => Number.isInteger(x) && x >= 0 && x <= 255)) bad('Farbe ungültig'); clean[k] = v.slice(); }
      else bad('Wert nicht erlaubt: ' + String(k).slice(0, 30));
    }
    if (clean.rgb_color && clean.color_temp_kelvin) bad('Farbe oder Weißton, nicht beides');
    if (service === 'turn_off') label = `${name} aus`;
    else if (service === 'toggle') label = `${name} ${states?.get(id)?.state === 'on' ? 'aus' : 'an'}`;
    else if (clean.brightness_pct) label = `${name} ${clean.brightness_pct} %`;
    else if (clean.rgb_color || clean.color_temp_kelvin) label = `${name} Farbe`;
    else label = `${name} an`;
  } else if (domain === 'media_player') {
    if (service === 'volume_set') {
      only('volume_level');
      if (typeof data.volume_level !== 'number' || !(data.volume_level >= 0 && data.volume_level <= 1)) bad('Lautstärke 0–1');
      clean.volume_level = Math.round(data.volume_level * 100) / 100;
    } else if (service === 'volume_mute') {
      only('is_volume_muted');
      if (typeof data.is_volume_muted !== 'boolean') bad('Stumm: ja/nein');
      clean.is_volume_muted = data.is_volume_muted;
    } else if (service === 'select_source') {
      only('source');
      const q = (cfg.fernseher?.quellen || []).find(x => x.source === data.source);
      if (!q) bad('Quelle nicht freigegeben');
      clean.source = q.source;
    } else only();
    label = {
      turn_on: `${name} an`, turn_off: `${name} aus`, volume_up: `${name} lauter`, volume_down: `${name} leiser`,
      volume_set: `${name} Lautstärke`, volume_mute: `${name} ${clean.is_volume_muted ? 'stumm' : 'Ton an'}`,
      media_play_pause: `${name} Play/Pause`, media_next_track: `${name} weiter`, media_previous_track: `${name} zurück`,
      select_source: `${name}: ${clean.source}`,
    }[service];
  } else if (domain === 'remote') {
    only('command');
    if (!REMOTE_KEYS.includes(data.command)) bad('Taste nicht erlaubt');
    clean.command = data.command;
    label = `${name}: Taste ${data.command}`;
  } else {
    only();
    if (ent.kind === 'szene') label = `Szene ${name}`;
    else if (ent.kind === 'routine') label = `Routine ${name} ${{ turn_on: 'aktiv', turn_off: 'inaktiv', trigger: 'ausgeführt' }[service]}`;
    else label = `${name} ${service === 'turn_on' ? 'an' : 'aus'}`;
  }
  return { calls: [{ domain, service, entity_ids: [id], data: clean }], label };
}

module.exports = { load, check, parseJsonc, SERVICES, REMOTE_KEYS };
