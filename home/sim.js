// Testmodus: simuliert Home Assistant komplett (Lampen, Szenen, Routinen, Schalter, Sensoren, Klima mit Verlauf),
// mit kurzer Verzögerung und gelegentlichen Fehlern. Gleiche Schnittstelle wie ha.js.
'use strict';
const { EventEmitter } = require('events');

const FAIL_RATE = Number(process.env.SIM_FAIL_RATE ?? 0.04);
const wait = ms => new Promise(r => setTimeout(r, ms));
const iso = (t = Date.now()) => new Date(t).toISOString();

function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
// Farbtemperatur (Kelvin) -> RGB (Näherung nach Tanner Helland)
function kelvinRgb(k) {
  const t = k / 100;
  const c = v => Math.max(0, Math.min(255, Math.round(v)));
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [c(r), c(g), c(b)];
}

// Klima-Kurve: Tagesgang + etwas Rauschen
function climate(t, kind) {
  const h = (t / 3600000 + 1) % 24; // ungefähr Ortszeit
  const day = Math.sin((h - 9) / 24 * 2 * Math.PI);
  const n = Math.sin(t / 2.3e6) * 0.18 + Math.sin(t / 5.1e6) * 0.12;
  if (kind === 'temp') return Math.round((20.9 + 0.9 * day + n) * 10) / 10;
  if (kind === 'hum') return Math.round(48 - 4 * day + n * 8);
  return 0;
}

class Sim extends EventEmitter {
  constructor(cfg) {
    super();
    this.mode = 'test';
    this.states = new Map();
    this.setConfig(cfg);
  }

  setConfig(cfg) {
    this.cfg = cfg;
    const now = Date.now();
    const keep = id => this.states.get(id);
    const put = (id, state, attributes) => {
      if (keep(id)) return;
      this.states.set(id, { entity_id: id, state, attributes, last_changed: iso(now - Math.random() * 3600000), last_updated: iso() });
    };
    cfg.lampen.forEach((l, i) => put(l.entity_id, i === 1 ? 'off' : 'on', {
      friendly_name: l.name, brightness: Math.round(255 * [0.7, 0.45, 0.58, 0.5][i % 4]), color_mode: 'rgb',
      rgb_color: hexRgb(l.farbe), supported_color_modes: ['color_temp', 'rgb'], min_color_temp_kelvin: 2202, max_color_temp_kelvin: 6535,
    }));
    cfg.szenen.forEach(s => s.entity_id && put(s.entity_id, iso(now - 86400000), { friendly_name: s.name }));
    cfg.routinen.forEach((r, i) => put(r.entity_id, i < 2 ? 'on' : 'off', {
      friendly_name: r.name, last_triggered: i === 2 ? null : iso(now - (i + 1) * 5.3 * 3600000),
    }));
    cfg.schalter.forEach((s, i) => put(s.entity_id, i % 2 ? 'on' : 'off', { friendly_name: s.name }));
    cfg.tv.forEach(t => put(t.entity_id, 'off', { friendly_name: t.name, volume_level: 0.18, source: t.apps[0] || '', app_name: t.apps[0] || '' }));
    const DC = { fenster: 'window', tuer: 'door', bewegung: 'motion' };
    cfg.sensoren.forEach(s => put(s.entity_id, 'off', { friendly_name: s.name, device_class: DC[s.art] || '' }));
    if (cfg.klima.temperatur) put(cfg.klima.temperatur, String(climate(now, 'temp')), { unit_of_measurement: '°C', device_class: 'temperature' });
    if (cfg.klima.luftfeuchte) put(cfg.klima.luftfeuchte, String(climate(now, 'hum')), { unit_of_measurement: '%', device_class: 'humidity' });
    cfg.klima.weitere.forEach(w => put(w.entity_id, String(this.extraStart(w)), { unit_of_measurement: w.einheit }));
  }

  extraStart(w) {
    const u = (w.einheit || '').toLowerCase();
    if (u === 'ppm') return 620;
    if (u === 'kwh') return 1.8;
    if (u === 'w') return 42;
    if (u === '°c') return 21;
    return w.max ? Math.round(w.max * 0.4) : 50;
  }

  start() {
    setTimeout(() => {
      this.emit('status', { connected: true, error: '' });
      for (const s of this.states.values()) this.emit('state', s);
    }, 300);
    // Klima, Sensoren und Zusatzwerte leben langsam vor sich hin
    this.timer = setInterval(() => this.tick(), 60000);
  }

  stop() { clearInterval(this.timer); }

  set(id, state, attrs) {
    const old = this.states.get(id);
    if (!old) return;
    const changed = old.state !== state;
    const s = { ...old, state, attributes: { ...old.attributes, ...(attrs || {}) }, last_updated: iso() };
    if (changed) s.last_changed = iso();
    this.states.set(id, s);
    this.emit('state', s);
  }

  tick() {
    const t = Date.now(), k = this.cfg.klima;
    if (k.temperatur) this.set(k.temperatur, String(climate(t, 'temp')));
    if (k.luftfeuchte) this.set(k.luftfeuchte, String(climate(t, 'hum')));
    for (const w of k.weitere) {
      const cur = parseFloat(this.states.get(w.entity_id)?.state) || this.extraStart(w);
      const base = this.extraStart(w);
      const next = cur + (base - cur) * 0.1 + (Math.random() - 0.5) * base * 0.06;
      this.set(w.entity_id, String(Math.round(next * 10) / 10));
    }
    for (const s of this.cfg.sensoren) {
      const cur = this.states.get(s.entity_id)?.state;
      if (s.art === 'bewegung') { if (Math.random() < 0.15) this.set(s.entity_id, cur === 'on' ? 'off' : 'on'); }
      else if (Math.random() < 0.04) this.set(s.entity_id, cur === 'on' ? 'off' : 'on');
    }
  }

  // 24-h-Verlauf für die Klima-Sensoren (im Testmodus ausgedacht)
  async history(ids, hours = 24) {
    const out = {}, now = Date.now(), k = this.cfg.klima;
    for (const id of ids) {
      const pts = [];
      for (let t = now - hours * 3600000; t <= now; t += 10 * 60000) {
        const v = id === k.temperatur ? climate(t, 'temp') : id === k.luftfeuchte ? climate(t, 'hum')
          : this.extraStart(k.weitere.find(w => w.entity_id === id) || {}) * (0.85 + 0.3 * Math.abs(Math.sin(t / 5e6)));
        pts.push([t, Math.round(v * 10) / 10]);
      }
      out[id] = pts;
    }
    return out;
  }

  lamp(id, data, on) {
    const old = this.states.get(id);
    if (!old) return;
    if (!on) return this.set(id, 'off');
    const a = {};
    if (data.brightness_pct) a.brightness = Math.round(data.brightness_pct * 2.55);
    else if (old.state === 'off' && !old.attributes.brightness) a.brightness = 180;
    if (data.rgb_color) { a.rgb_color = data.rgb_color; a.color_mode = 'rgb'; a.color_temp_kelvin = null; }
    if (data.color_temp_kelvin) { a.color_temp_kelvin = data.color_temp_kelvin; a.color_mode = 'color_temp'; a.rgb_color = kelvinRgb(data.color_temp_kelvin); }
    this.set(id, 'on', a);
  }

  // Szenen-Vorgaben im Testmodus (nach Position in der Liste)
  scene(index) {
    const L = this.cfg.lampen.map(l => l.entity_id);
    const P = [
      [[1, 55, 2400], [0], [1, 40, [255, 95, 168]]],          // gemütlich
      [[0], [0], [1, 25, [140, 90, 255]]],                    // Film
      [[1, 100, 3800], [1, 80, 4000], [0]],                   // Lesen
      [[0], [0], [1, 6, [143, 123, 255]]],                    // Gute Nacht
    ][index % 4];
    L.forEach((id, i) => {
      const p = P[i % P.length];
      if (!p[0]) return this.lamp(id, {}, false);
      const d = { brightness_pct: p[1] };
      if (Array.isArray(p[2])) d.rgb_color = p[2]; else d.color_temp_kelvin = p[2];
      this.lamp(id, d, true);
    });
  }

  // Fernseher im Testmodus: an = die zuletzt gewählte App läuft, Titel sind ausgedacht
  tv(id, s, service, data) {
    const TITLES = { netflix: ['Stranger Things', 'Wednesday', 'The Crown'], youtube: ['Lo-Fi Beats', 'Kochvideo: Pasta'], prime: ['The Boys', 'Reacher'] };
    const titleFor = app => {
      const k = Object.keys(TITLES).find(x => String(app).toLowerCase().includes(x));
      const l = TITLES[k] || ['Live-TV'];
      return l[Math.floor(Math.random() * l.length)];
    };
    if (service === 'turn_off') return this.set(id, 'off', { media_title: null });
    if (service === 'turn_on') return this.set(id, 'playing', { media_title: titleFor(s.attributes.source) });
    if (service === 'volume_set') return this.set(id, s.state, { volume_level: data.volume_level });
    if (service === 'select_source') return this.set(id, 'playing', { source: data.source, app_name: data.source, media_title: titleFor(data.source) });
    if (service === 'media_play_pause') {
      if (s.state === 'off') throw new Error('Der Fernseher ist aus');
      return this.set(id, s.state === 'playing' ? 'paused' : 'playing');
    }
  }

  async call(domain, service, ids, data) {
    await wait(120 + Math.random() * 330);
    if (Math.random() < FAIL_RATE) throw new Error('Testmodus: Home Assistant hat nicht geantwortet');
    for (const id of ids) {
      const s = this.states.get(id);
      if (!s) throw new Error('Unbekanntes Gerät ' + id);
      if (domain === 'light') this.lamp(id, data, service === 'toggle' ? s.state !== 'on' : service === 'turn_on');
      else if (domain === 'scene' || domain === 'script') {
        this.set(id, iso());
        this.scene(this.cfg.szenen.findIndex(x => x.entity_id === id));
      } else if (domain === 'automation') {
        if (service === 'trigger') { this.set(id, s.state, { last_triggered: iso() }); }
        else this.set(id, service === 'turn_on' ? 'on' : 'off');
      } else if (domain === 'media_player') this.tv(id, s, service, data);
      else this.set(id, service === 'turn_on' ? 'on' : 'off');
    }
  }
}

module.exports = { Sim, kelvinRgb };
