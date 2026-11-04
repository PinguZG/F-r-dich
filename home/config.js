// Liest home/config.jsonc, prüft sie und baut daraus die Freigabeliste (welche entity_id welche Dienste darf).
'use strict';
const fs = require('fs');

const ENTITY_RE = /^[a-z_]+\.[a-z0-9_]+$/;
const HEX_RE = /^#[0-9a-f]{6}$/i;

// Erlaubte Dienste pro Bereich (domain) – alles andere wird abgelehnt
const SERVICES = {
  light: ['turn_on', 'turn_off', 'toggle'],
  scene: ['turn_on'],
  script: ['turn_on'],
  automation: ['turn_on', 'turn_off', 'trigger'],
  switch: ['turn_on', 'turn_off'],
  input_boolean: ['turn_on', 'turn_off'],
  fan: ['turn_on', 'turn_off'],
  media_player: ['turn_on', 'turn_off', 'volume_set', 'media_play_pause', 'select_source'],
  sensor: [],
  binary_sensor: [],
};

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
  const color = (c, fb) => (HEX_RE.test(String(c || '')) ? String(c).toLowerCase() : fb);
  const list = v => (Array.isArray(v) ? v : []);

  const lampen = list(raw.lampen).slice(0, 8).map((l, i) => ({
    name: str(l.name) || `Lampe ${i + 1}`,
    entity_id: entity(l.entity_id, ['light'], `lampen[${i}]`, str(l.name) || `Lampe ${i + 1}`, 'lampe'),
    farbe: color(l.farbe, '#ffc78f'),
  })).filter(l => l.entity_id);

  const szenen = list(raw.szenen).slice(0, 10).map((s, i) => {
    const name = str(s.name) || `Szene ${i + 1}`;
    const aktion = s.aktion === 'alle_aus' ? 'alle_aus' : '';
    const id = aktion ? '' : entity(s.entity_id, ['scene', 'script'], `szenen[${i}]`, name, 'szene');
    const farben = list(s.farben).map(c => color(c, '')).filter(Boolean).slice(0, 2);
    return { key: 'sz' + i, name, entity_id: id, aktion, icon: str(s.icon, 20) || 'spark', farben };
  }).filter(s => s.entity_id || s.aktion);

  const routinen = list(raw.routinen).slice(0, 12).map((r, i) => ({
    name: str(r.name) || `Routine ${i + 1}`,
    entity_id: entity(r.entity_id, ['automation'], `routinen[${i}]`, str(r.name) || `Routine ${i + 1}`, 'routine'),
    info: str(r.info, 80),
    icon: str(r.icon, 20) || 'clock',
  })).filter(r => r.entity_id);

  const k = raw.klima || {};
  const klima = {
    temperatur: entity(k.temperatur, ['sensor'], 'klima.temperatur', 'Temperatur', 'klima'),
    luftfeuchte: entity(k.luftfeuchte, ['sensor'], 'klima.luftfeuchte', 'Luftfeuchte', 'klima'),
    weitere: list(k.weitere).slice(0, 6).map((w, i) => ({
      name: str(w.name) || `Wert ${i + 1}`,
      entity_id: entity(w.entity_id, ['sensor'], `klima.weitere[${i}]`, str(w.name), 'klima'),
      einheit: str(w.einheit, 12),
      icon: str(w.icon, 20) || 'spark',
      max: Number(w.max) > 0 ? Number(w.max) : 0,
    })).filter(w => w.entity_id),
  };

  const schalter = list(raw.schalter).slice(0, 12).map((s, i) => ({
    name: str(s.name) || `Gerät ${i + 1}`,
    entity_id: entity(s.entity_id, ['switch', 'input_boolean', 'fan'], `schalter[${i}]`, str(s.name) || `Gerät ${i + 1}`, 'schalter'),
    icon: str(s.icon, 20) || 'plug',
    farbe: color(s.farbe, '#ffb38a'),
  })).filter(s => s.entity_id);

  const ARTEN = ['fenster', 'tuer', 'bewegung', 'sonstiges'];
  const sensoren = list(raw.sensoren).slice(0, 12).map((s, i) => ({
    name: str(s.name) || `Sensor ${i + 1}`,
    entity_id: entity(s.entity_id, ['binary_sensor'], `sensoren[${i}]`, str(s.name), 'sensor'),
    art: ARTEN.includes(s.art) ? s.art : 'sonstiges',
  })).filter(s => s.entity_id);

  // Fernseher / Mediaplayer: "apps" = erlaubte Quellen für select_source (genau so geschrieben wie in HA)
  const tv = list(raw.tv).slice(0, 4).map((t, i) => ({
    name: str(t.name) || `Fernseher ${i + 1}`,
    entity_id: entity(t.entity_id, ['media_player'], `tv[${i}]`, str(t.name) || `Fernseher ${i + 1}`, 'tv'),
    apps: list(t.apps).map(a => str(a, 40)).filter(Boolean).slice(0, 12),
    farbe: color(t.farbe, '#c49bff'),
  })).filter(t => t.entity_id);

  const w = raw.wetter || {};
  const wetter = Number.isFinite(+w.lat) && Number.isFinite(+w.lon) && w.lat !== '' && w.lon !== ''
    ? { ort: str(w.ort, 40) || 'Wetter', lat: +w.lat, lon: +w.lon } : null;

  const cfg = { wetter, raum: str(raw.raum, 30) || 'Zimmer', lampen, szenen, routinen, klima, schalter, sensoren, tv };
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

  // Sonderfall: alle Lampen
  if (id === '*lampen') {
    if (domain !== 'light' || !['turn_on', 'turn_off'].includes(service)) bad('Nicht erlaubt');
    if (Object.keys(data).length) bad('Nicht erlaubt');
    const ids = conf.cfg.lampen.map(l => l.entity_id);
    if (!ids.length) bad('Keine Lampen eingetragen');
    return { calls: [{ domain, service, entity_ids: ids, data: {} }], label: `Alle Lampen ${service === 'turn_on' ? 'an' : 'aus'}` };
  }

  const ent = conf.allow.get(id);
  if (!ent) bad('Gerät nicht freigegeben');
  if (ent.domain !== domain) bad('Dienst passt nicht zum Gerät');
  if (!(SERVICES[domain] || []).includes(service)) bad('Dienst nicht erlaubt');
  // Sensoren und Klimawerte kann man nur ansehen
  if (ent.kind === 'klima' || ent.kind === 'sensor') bad('Nur lesbar');

  const clean = {};
  if (domain === 'media_player') {
    const tv = conf.cfg.tv.find(t => t.entity_id === id);
    const keys = Object.keys(data);
    if (service === 'volume_set') {
      const v = data.volume_level;
      if (keys.length !== 1 || typeof v !== 'number' || !(v >= 0 && v <= 1)) bad('Lautstärke 0–1');
      clean.volume_level = Math.round(v * 100) / 100;
    } else if (service === 'select_source') {
      if (keys.length !== 1 || typeof data.source !== 'string' || !tv || !tv.apps.includes(data.source)) bad('App nicht freigegeben');
      clean.source = data.source;
    } else if (keys.length) bad('Keine Zusatzwerte erlaubt');
    const name = ent.name || id;
    const label = {
      turn_on: `${name} an`, turn_off: `${name} aus`, media_play_pause: `${name} Play/Pause`,
      volume_set: `${name} Lautstärke ${Math.round((clean.volume_level || 0) * 100)} %`, select_source: `${name}: ${clean.source}`,
    }[service];
    return { calls: [{ domain, service, entity_ids: [id], data: clean }], label };
  }
  for (const [k, v] of Object.entries(data)) {
    if (domain !== 'light' || service !== 'turn_on') bad('Keine Zusatzwerte erlaubt');
    if (k === 'brightness_pct') {
      if (!Number.isInteger(v) || v < 1 || v > 100) bad('Helligkeit 1–100');
      clean[k] = v;
    } else if (k === 'color_temp_kelvin') {
      if (!Number.isInteger(v) || v < 1500 || v > 9000) bad('Weißton ungültig');
      clean[k] = v;
    } else if (k === 'rgb_color') {
      if (!Array.isArray(v) || v.length !== 3 || !v.every(x => Number.isInteger(x) && x >= 0 && x <= 255)) bad('Farbe ungültig');
      clean[k] = v.slice();
    } else {
      bad('Wert nicht erlaubt: ' + String(k).slice(0, 30));
    }
  }
  if (clean.rgb_color && clean.color_temp_kelvin) bad('Farbe oder Weißton, nicht beides');

  const name = ent.name || id;
  let label = name;
  if (ent.kind === 'lampe') {
    if (service === 'turn_off') label = `${name} aus`;
    else if (service === 'toggle') label = `${name} ${states.get(id)?.state === 'on' ? 'aus' : 'an'}`;
    else if (clean.rgb_color) label = `${name} Farbe`;
    else if (clean.color_temp_kelvin) label = `${name} Weißton ${clean.color_temp_kelvin} K`;
    else if (clean.brightness_pct) label = `${name} ${clean.brightness_pct} %`;
    else label = `${name} an`;
  } else if (ent.kind === 'szene') label = `Szene ${name}`;
  else if (ent.kind === 'routine') label = `Routine ${name} ${{ turn_on: 'aktiv', turn_off: 'inaktiv', trigger: 'ausgeführt' }[service]}`;
  else if (ent.kind === 'schalter') label = `${name} ${service === 'turn_on' ? 'an' : 'aus'}`;

  return { calls: [{ domain, service, entity_ids: [id], data: clean }], label };
}

module.exports = { load, check, parseJsonc, SERVICES };
