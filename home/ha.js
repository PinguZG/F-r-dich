// Echte Verbindung zu Home Assistant über dessen WebSocket-API (dauerhaft, mit automatischem Wiederverbinden).
// Gleiche Schnittstelle wie sim.js: Ereignisse 'state' und 'status', call(), history().
// Adresse und Token kommen aus /etc/wir-home.env und werden NIE ausgegeben.
'use strict';
const { EventEmitter } = require('events');
const WebSocket = require('ws');

class HA extends EventEmitter {
  constructor(url, token, cfg) {
    super();
    this.mode = 'live';
    this.wsUrl = url.replace(/\/+$/, '').replace(/^http/, 'ws') + '/api/websocket';
    this.token = token;
    this.ids = new Set();
    this.seq = 0;
    this.pending = new Map();
    this.ws = null;
    this.ready = false;
    this.backoff = 2000;
    this.setConfig(cfg);
  }

  setConfig(cfg) {
    this.cfg = cfg;
    this.ids = new Set(cfg.allowIds);
    if (this.ready) this.loadStates().catch(() => {});
  }

  start() { this.connect(); }
  stop() { this.stopped = true; this.ws?.terminate(); }

  status(connected, error) {
    this.ready = connected;
    this.emit('status', { connected, error: error || '' });
  }

  connect() {
    if (this.stopped) return;
    let ws;
    try { ws = new WebSocket(this.wsUrl, { handshakeTimeout: 10000 }); }
    catch (_) { this.status(false, 'HA-Adresse ungültig'); return this.retry(); }
    this.ws = ws;
    let alive = true;
    ws.on('message', buf => {
      let m; try { m = JSON.parse(buf); } catch (_) { return; }
      if (m.type === 'auth_required') ws.send(JSON.stringify({ type: 'auth', access_token: this.token }));
      else if (m.type === 'auth_invalid') { this.status(false, 'Token abgelehnt'); ws.close(); }
      else if (m.type === 'auth_ok') this.onAuth();
      else if (m.type === 'pong') alive = true;
      else if (m.type === 'result') {
        const p = this.pending.get(m.id);
        if (p) { this.pending.delete(m.id); clearTimeout(p.timer); m.success ? p.res(m.result) : p.rej(new Error(m.error?.message || 'Fehler von Home Assistant')); }
      } else if (m.type === 'event' && m.event?.event_type === 'state_changed') {
        const s = m.event.data?.new_state;
        if (s && this.ids.has(s.entity_id)) this.emit('state', s);
      }
    });
    ws.on('open', () => {
      this.ping = setInterval(() => {
        if (!alive) { ws.terminate(); return; }
        alive = false;
        try { ws.send(JSON.stringify({ id: ++this.seq, type: 'ping' })); } catch (_) {}
      }, 30000);
    });
    ws.on('close', () => {
      clearInterval(this.ping);
      for (const p of this.pending.values()) { clearTimeout(p.timer); p.rej(new Error('Verbindung zu Home Assistant getrennt')); }
      this.pending.clear();
      if (this.ready) this.status(false, 'Verbindung getrennt');
      this.ready = false;
      this.retry();
    });
    ws.on('error', err => {
      // Fehlermeldung ohne Adresse
      if (!this.ready) this.status(false, 'Home Assistant nicht erreichbar (' + (err.code || 'Fehler') + ')');
    });
  }

  retry() {
    if (this.stopped || this.retryTimer) return;
    this.retryTimer = setTimeout(() => { this.retryTimer = null; this.connect(); }, this.backoff);
    this.backoff = Math.min(60000, this.backoff * 2);
  }

  send(msg, timeoutMs = 10000) {
    return new Promise((res, rej) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return rej(new Error('Home Assistant nicht verbunden'));
      const id = ++this.seq;
      const timer = setTimeout(() => { this.pending.delete(id); rej(new Error('Home Assistant antwortet nicht')); }, timeoutMs);
      this.pending.set(id, { res, rej, timer });
      this.ws.send(JSON.stringify({ id, ...msg }));
    });
  }

  async onAuth() {
    this.backoff = 2000;
    try {
      await this.send({ type: 'subscribe_events', event_type: 'state_changed' });
      await this.loadStates();
      this.status(true, '');
    } catch (err) {
      this.status(false, err.message);
      this.ws?.close();
    }
  }

  async loadStates() {
    const all = await this.send({ type: 'get_states' });
    const seen = new Set();
    for (const s of all) if (this.ids.has(s.entity_id)) { seen.add(s.entity_id); this.emit('state', s); }
    // eingetragen, aber in HA nicht vorhanden -> als "unbekannt" anzeigen
    for (const id of this.ids) if (!seen.has(id)) this.emit('state', { entity_id: id, state: 'unavailable', attributes: {}, last_changed: new Date().toISOString() });
  }

  async call(domain, service, ids, data) {
    if (!this.ready) throw new Error('Home Assistant nicht verbunden');
    await this.send({ type: 'call_service', domain, service, service_data: data || {}, target: { entity_id: ids } });
  }

  // Verlauf (für die Klima-Kurve nach einem Neustart)
  async history(ids, hours = 24) {
    if (!this.ready || !ids.length) return {};
    const end = new Date(), start = new Date(end - hours * 3600000);
    const r = await this.send({
      type: 'history/history_during_period', start_time: start.toISOString(), end_time: end.toISOString(),
      entity_ids: ids, minimal_response: true, no_attributes: true, significant_changes_only: false,
    }, 30000);
    const out = {};
    for (const id of ids) {
      out[id] = (r?.[id] || []).map(p => {
        const t = p.lu != null ? p.lu * 1000 : Date.parse(p.last_changed || p.last_updated);
        return [t, parseFloat(p.s ?? p.state)];
      }).filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]));
    }
    return out;
  }
}

module.exports = { HA };
