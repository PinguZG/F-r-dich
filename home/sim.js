// Testmodus: simuliert Home Assistant mit den Daten und dem Verhalten der Vorlage (docs/zuhause/dashboard-demo-aurora.html):
// Lampen, Geräte mit Verbrauch, Fernseher (Apps, Lautstärke 0–50, Play/Pause), Routinen, Klima, Fenster/Tür.
// Kurze Verzögerung und gelegentliche Fehler. Gleiche Schnittstelle wie ha.js.
'use strict';
const { EventEmitter } = require('events');

const FAIL_RATE = Number(process.env.SIM_FAIL_RATE ?? 0.03);
const wait = ms => new Promise(r => setTimeout(r, ms));
const iso = (t = Date.now()) => new Date(t).toISOString();
const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };

function kelvinRgb(k) {
  const t = k / 100;
  const c = v => Math.max(0, Math.min(255, Math.round(v)));
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [c(r), c(g), c(b)];
}

// Klima-Kurve: Tagesgang um die Werte der Vorlage (21,4° · 48 % · 640 ppm)
function climate(t, kind) {
  const h = (t / 3600000 + 1) % 24;
  const day = Math.sin((h - 9) / 24 * 2 * Math.PI);
  const n = Math.sin(t / 2.3e6) * 0.15 + Math.sin(t / 5.1e6) * 0.1;
  if (kind === 'temp') return Math.round((21.1 + 0.5 * day + n) * 10) / 10;
  if (kind === 'hum') return Math.round(48 - 2 * day + n * 4);
  if (kind === 'co2') return Math.round(640 + 60 * day + n * 80);
  return 0;
}

class Sim extends EventEmitter {
  constructor(cfg) {
    super();
    this.mode = 'test';
    this.states = new Map();
    this.kwh = 1.8;
    this.setConfig(cfg);
  }

  setConfig(cfg) {
    this.cfg = cfg;
    const now = Date.now();
    const put = (id, state, attributes, changed) => {
      if (!id || this.states.has(id)) return;
      this.states.set(id, { entity_id: id, state, attributes, last_changed: iso(changed || now - 3600000), last_updated: iso() });
    };
    cfg.lampen.forEach(l => put(l.entity_id, l.test.an ? 'on' : 'off', {
      friendly_name: l.name, brightness: Math.round(l.test.helligkeit * 2.55), color_mode: 'rgb', rgb_color: hexRgb(l.test.farbe),
      supported_color_modes: ['color_temp', 'rgb'], min_color_temp_kelvin: 2202, max_color_temp_kelvin: 6535,
    }));
    cfg.geraete.forEach(g => put(g.entity_id, g.test_an ? 'on' : 'off', { friendly_name: g.name }));
    cfg.routinen.forEach(r => put(r.entity_id, r.test_an ? 'on' : 'off', { friendly_name: r.name, last_triggered: null }));
    cfg.szenen.forEach(s => s.entity_id && put(s.entity_id, iso(now - 86400000), { friendly_name: s.name }));
    const tv = cfg.fernseher;
    if (tv) {
      const app = tv.apps[0];
      put(tv.entity_id, 'playing', {
        friendly_name: tv.name, volume_level: 12 / tv.max_lautstaerke, is_volume_muted: false,
        app_name: app?.name || '', source: app?.name || '', media_title: app?.test || '',
        media_duration: 2640, media_position: 1120, media_position_updated_at: iso(),
      });
      if (tv.remote) put(tv.remote, 'on', { friendly_name: tv.name, current_activity: app?.paket || '' });
      if (tv.cast) put(tv.cast, 'playing', { friendly_name: tv.name + ' (Cast)', app_name: app?.name || '', media_title: app?.test || '' });
    }
    const DC = { fenster: 'window', tuer: 'door', bewegung: 'motion' };
    cfg.sensoren.forEach(s => put(s.entity_id, s.test_offen_min ? 'on' : 'off', { friendly_name: s.name, device_class: DC[s.art] || '' },
      s.test_offen_min ? now - s.test_offen_min * 60000 : now - 5 * 3600000));
    // Lichtwecker-Helfer (werden von wir-home aus den App-Einstellungen gesetzt)
    const wk = cfg.wecker;
    if (wk) {
      put(wk.aktiv, 'off', { friendly_name: 'Wecker aktiv' });
      put(wk.aussetzen, 'off', { friendly_name: 'Wecker aussetzen' });
      wk.tage.forEach(id => put(id, 'off', {}));
      put(wk.zeit, '00:00:00', { has_date: false, has_time: true });
      put(wk.vorlauf, '0.0', { min: 0, max: 30 });
      if (wk.test) put(wk.test, 'off', { friendly_name: 'Sonnenaufgang' });
    }
    const k = cfg.klima;
    put(k.temperatur, String(climate(now, 'temp')), { unit_of_measurement: '°C' });
    put(k.luftfeuchte, String(climate(now, 'hum')), { unit_of_measurement: '%' });
    put(k.co2, String(climate(now, 'co2')), { unit_of_measurement: 'ppm' });
    put(k.strom_heute, String(this.kwh), { unit_of_measurement: 'kWh' });
    put(k.leistung, String(this.watt()), { unit_of_measurement: 'W' });
  }

  // Verbrauch wie in der Vorlage: Lampen Helligkeit × 0,09 W, Fernseher 42 W, Geräte laut Konfiguration
  watt() {
    let w = 0;
    for (const l of this.cfg.lampen) { const s = this.states.get(l.entity_id); if (s?.state === 'on') w += Math.round((s.attributes.brightness || 0) / 2.55) * 0.09; }
    const tv = this.cfg.fernseher && this.states.get(this.cfg.fernseher.entity_id);
    if (tv && tv.state !== 'off') w += 42;
    for (const g of this.cfg.geraete) if (this.states.get(g.entity_id)?.state === 'on') w += g.watt;
    return Math.round(w);
  }

  start() {
    setTimeout(() => {
      this.emit('status', { connected: true, error: '' });
      for (const s of this.states.values()) this.emit('state', s);
    }, 300);
    this.timer = setInterval(() => this.tick(), 60000);
  }

  stop() { clearInterval(this.timer); }

  set(id, state, attrs) {
    const old = this.states.get(id);
    if (!old) return;
    const s = { ...old, state, attributes: { ...old.attributes, ...(attrs || {}) }, last_updated: iso() };
    if (old.state !== state) s.last_changed = iso();
    this.states.set(id, s);
    this.emit('state', s);
    const k = this.cfg.klima;
    if (k.leistung && id !== k.leistung && id !== k.strom_heute) {
      const w = String(this.watt());
      if (this.states.get(k.leistung)?.state !== w) this.set(k.leistung, w);
    }
  }

  tick() {
    const t = Date.now(), k = this.cfg.klima;
    if (k.temperatur) this.set(k.temperatur, String(climate(t, 'temp')));
    if (k.luftfeuchte) this.set(k.luftfeuchte, String(climate(t, 'hum')));
    if (k.co2) this.set(k.co2, String(climate(t, 'co2')));
    this.kwh = Math.round((this.kwh + this.watt() / 60000) * 100) / 100;
    if (k.strom_heute) this.set(k.strom_heute, String(this.kwh));
  }

  async history(ids, hours = 24) {
    const out = {}, now = Date.now(), k = this.cfg.klima;
    for (const id of ids) {
      const kind = id === k.temperatur ? 'temp' : id === k.luftfeuchte ? 'hum' : id === k.co2 ? 'co2' : '';
      if (!kind) continue;
      const pts = [];
      for (let t = now - hours * 3600000; t <= now; t += 10 * 60000) pts.push([t, climate(t, kind)]);
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
    if (data.rgb_color) { a.rgb_color = data.rgb_color; a.color_mode = 'rgb'; a.color_temp_kelvin = null; }
    if (data.color_temp_kelvin) { a.color_temp_kelvin = data.color_temp_kelvin; a.color_mode = 'color_temp'; a.rgb_color = kelvinRgb(data.color_temp_kelvin); }
    this.set(id, 'on', a);
  }

  // Sonnenaufgang wie im HA-Paket: dunkles Orange -> Kaltweiß, in drei Stufen über "dauer" Sekunden
  sunrise(dauer) {
    clearTimeout(this.sunT);
    const steps = [[1, [255, 50, 0]], [25, [255, 110, 20]], [65, null, 3000], [100, null, 6000]];
    const run = i => {
      if (i >= steps.length) return;
      const [b, rgb, k] = steps[i];
      for (const l of this.cfg.lampen) this.lamp(l.entity_id, rgb ? { brightness_pct: b, rgb_color: rgb } : { brightness_pct: b, color_temp_kelvin: k }, true);
      this.sunT = setTimeout(() => run(i + 1), i === 0 ? 2000 : (dauer - 2) / 3 * 1000);
    };
    run(0);
  }

  tvCall(id, s, service, data) {
    const tv = this.cfg.fernseher, a = s.attributes, step = 1 / tv.max_lautstaerke;
    const vol = v => Math.max(0, Math.min(1, Math.round(v * tv.max_lautstaerke) / tv.max_lautstaerke));
    const app = name => tv.apps.find(x => x.name === name);
    switch (service) {
      case 'turn_off': return this.set(id, 'off');
      case 'turn_on': return this.set(id, s.state === 'off' ? 'playing' : s.state);
      case 'volume_up': return this.set(id, s.state, { volume_level: vol(a.volume_level + step), is_volume_muted: false });
      case 'volume_down': return this.set(id, s.state, { volume_level: vol(a.volume_level - step), is_volume_muted: false });
      case 'volume_set': return this.set(id, s.state, { volume_level: vol(data.volume_level), is_volume_muted: false });
      case 'volume_mute': return this.set(id, s.state, { is_volume_muted: !!data.is_volume_muted });
      case 'media_play_pause':
        if (s.state === 'off') throw new Error('Der Fernseher ist aus');
        return this.set(id, s.state === 'playing' ? 'paused' : 'playing');
      case 'media_next_track': case 'media_previous_track': return this.set(id, s.state, { media_position: 0, media_position_updated_at: iso() });
      case 'select_source': {
        const ap = app(data.source);
        return this.set(id, 'playing', ap ? { source: ap.name, app_name: ap.name, media_title: ap.test } : { source: data.source, app_name: '', media_title: data.source });
      }
    }
  }

  async call(domain, service, ids, data) {
    await wait(120 + Math.random() * 300);
    if (Math.random() < FAIL_RATE) throw new Error('Testmodus: Home Assistant hat nicht geantwortet');
    const tv = this.cfg.fernseher;
    for (const id of ids) {
      const s = this.states.get(id);
      if (!s) throw new Error('Unbekanntes Gerät ' + id);
      if (domain === 'light') this.lamp(id, data, service === 'toggle' ? s.state !== 'on' : service === 'turn_on');
      else if (domain === 'media_player') this.tvCall(id, s, service, data);
      else if (domain === 'remote') {
        if (service === 'turn_on' && tv) {
          // App-Start über die Activity: passende App im Fernseher anzeigen
          const ap = tv.apps.find(a => a.start === data.activity);
          if (ap) {
            this.set(tv.entity_id, 'playing', { source: ap.name, app_name: ap.paket || ap.name, app_id: ap.paket || '', media_title: ap.test, media_position: 0 });
            this.set(id, 'on', { current_activity: ap.paket || '' });
            if (tv.cast) this.set(tv.cast, 'playing', { app_name: ap.name, media_title: ap.test });
          }
        }
      } else if (domain === 'automation') {
        if (service === 'trigger') this.set(id, s.state, { last_triggered: iso() });
        else this.set(id, service === 'turn_on' ? 'on' : 'off');
      } else if (domain === 'input_datetime') this.set(id, String(data.time || '00:00:00'));
      else if (domain === 'input_number') this.set(id, (Number(data.value) || 0).toFixed(1));
      else if (domain === 'script' && id === this.cfg.wecker?.test) this.sunrise(Number(data.variables?.dauer) || 60);
      else if (domain === 'scene' || domain === 'script') this.set(id, iso());
      else this.set(id, service === 'turn_on' ? 'on' : 'off');
    }
  }
}

module.exports = { Sim, kelvinRgb };
