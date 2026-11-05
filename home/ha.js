// Echte Verbindung zu Home Assistant über dessen WebSocket-API (dauerhaft, mit automatischem Wiederverbinden).
// Gleiche Schnittstelle wie sim.js: Ereignisse 'state' und 'status', call(), history().
// - Abo NUR auf die freigegebenen Entitäten (subscribe_entities mit entity_ids) – HA schickt nichts anderes.
// - Wiederverbinden mit wachsendem Abstand (2 s … 60 s, mit Zufall), tote Verbindungen per Ping nach ≤ 30 s erkannt.
// Adresse und Token kommen aus /etc/wir-home.env und werden NIE ausgegeben.
'use strict';
const { EventEmitter } = require('events');
const WebSocket = require('ws');

const PING_MS = 20000, PONG_MS = 10000;
const iso = t => (typeof t === 'number' ? new Date(t * 1000).toISOString() : '');

class HA extends EventEmitter {
  constructor(url, token, cfg) {
    super();
    this.mode = 'live';
    this.base = url.replace(/\/+$/, '');
    this.wsUrl = this.base.replace(/^http/, 'ws') + '/api/websocket';
    this.token = token;
    this.ids = new Set();
    this.seq = 0;
    this.pending = new Map();
    this.ws = null;
    this.ready = false;
    this.backoff = 2000;
    this.cur = new Map();     // entity_id -> letzter vollständiger Zustand (für die Änderungs-Diffs von HA)
    this.setConfig(cfg);
  }

  setConfig(cfg) {
    const ids = [...cfg.allowIds].sort().join(',');
    this.cfg = cfg;
    const changed = ids !== [...this.ids].sort().join(',');
    this.ids = new Set(cfg.allowIds);
    // andere Entitäten -> neu abonnieren (einfachster saubere Weg: Verbindung neu aufbauen)
    if (changed && this.ws) { this.backoff = 500; this.ws.close(); }
  }

  start() { this.connect(); }
  stop() { this.stopped = true; clearTimeout(this.retryTimer); this.ws?.terminate(); }

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
    let pongT = null;
    ws.on('message', buf => {
      let m; try { m = JSON.parse(buf); } catch (_) { return; }
      if (m.type === 'auth_required') ws.send(JSON.stringify({ type: 'auth', access_token: this.token }));
      else if (m.type === 'auth_invalid') { this.authBad = true; this.status(false, 'Token abgelehnt'); ws.close(); }
      else if (m.type === 'auth_ok') { this.authBad = false; this.onAuth(ws); }
      else if (m.type === 'pong') { clearTimeout(pongT); pongT = null; }
      else if (m.type === 'result') {
        const p = this.pending.get(m.id);
        if (p) { this.pending.delete(m.id); clearTimeout(p.timer); m.success ? p.res(m.result) : p.rej(new Error(m.error?.message || 'Fehler von Home Assistant')); }
      } else if (m.type === 'event' && m.id === this.subId && m.event) this.onEntities(m.event);
    });
    ws.on('open', () => {
      this.ping = setInterval(() => {
        if (pongT) return;
        pongT = setTimeout(() => ws.terminate(), PONG_MS);   // keine Antwort -> Verbindung tot
        try { ws.send(JSON.stringify({ id: ++this.seq, type: 'ping' })); } catch (_) {}
      }, PING_MS);
    });
    ws.on('close', () => {
      clearInterval(this.ping); clearTimeout(pongT);
      for (const p of this.pending.values()) { clearTimeout(p.timer); p.rej(new Error('Verbindung zu Home Assistant getrennt')); }
      this.pending.clear();
      this.subId = null;
      if (this.ws === ws) this.ws = null;
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
    // falsches Token: seltener probieren (HA sperrt sonst die IP nach vielen Fehlversuchen)
    const base = this.authBad ? Math.max(this.backoff, 60000) : this.backoff;
    const ms = Math.round(base * (0.8 + Math.random() * 0.4));
    this.retryTimer = setTimeout(() => { this.retryTimer = null; this.connect(); }, ms);
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

  async onAuth(ws) {
    try {
      this.cur.clear();
      this.seen = new Set();
      const id = this.seq + 1;
      this.subId = id;
      await this.send({ type: 'subscribe_entities', entity_ids: [...this.ids] });
      if (this.ws !== ws) return;
      // eingetragen, aber in HA (noch) nicht vorhanden -> als "nicht erreichbar" anzeigen
      setTimeout(() => {
        if (this.ws !== ws) return;
        for (const eid of this.ids) if (!this.cur.has(eid)) this.emit('state', { entity_id: eid, state: 'unavailable', attributes: {}, last_changed: new Date().toISOString(), missing: true });
      }, 1500);
      this.backoff = 2000;
      this.status(true, '');
    } catch (err) {
      this.status(false, err.message);
      ws.close();
    }
  }

  // kompaktes Format von subscribe_entities: a = neu/vollständig, c = Änderungen (+ / -), r = entfernt
  onEntities(ev) {
    for (const [eid, s] of Object.entries(ev.a || {})) {
      if (!this.ids.has(eid)) continue;
      const st = { entity_id: eid, state: String(s.s), attributes: s.a || {}, last_changed: iso(s.lc) || new Date().toISOString() };
      this.cur.set(eid, st);
      this.emit('state', st);
    }
    for (const [eid, d] of Object.entries(ev.c || {})) {
      const old = this.cur.get(eid);
      if (!old || !this.ids.has(eid)) continue;
      const st = { ...old, attributes: { ...old.attributes } };
      const plus = d['+'] || {}, minus = d['-'] || {};
      if (plus.s !== undefined) st.state = String(plus.s);
      if (plus.lc !== undefined) st.last_changed = iso(plus.lc);
      Object.assign(st.attributes, plus.a || {});
      for (const k of minus.a || []) delete st.attributes[k];
      this.cur.set(eid, st);
      this.emit('state', st);
    }
    for (const eid of ev.r || []) {
      if (!this.ids.has(eid)) continue;
      this.cur.delete(eid);
      this.emit('state', { entity_id: eid, state: 'unavailable', attributes: {}, last_changed: new Date().toISOString(), missing: true });
    }
  }

  async call(domain, service, ids, data) {
    if (!this.ready) throw new Error('Home Assistant nicht verbunden');
    await this.send({ type: 'call_service', domain, service, service_data: data || {}, target: { entity_id: ids } });
  }

  // Diagnose: Überblick über Fernseher-nahe Entitäten (nur IDs, Zustand, Namen und Attribut-Namen – keine Werte)
  async overview() {
    if (!this.ready) throw new Error('Home Assistant nicht verbunden');
    const [all, svc] = await Promise.all([this.send({ type: 'get_states' }, 30000), this.send({ type: 'get_services' }, 30000)]);
    return {
      services: Object.fromEntries(['wake_on_lan', 'androidtv', 'androidtv_remote', 'button'].map(d => [d, Object.keys(svc[d] || {})])),
      entities: all.filter(s => /^(media_player|remote|button|script|switch)\./.test(s.entity_id))
        .map(s => ({ id: s.entity_id, state: s.state, name: s.attributes?.friendly_name || '', attrs: Object.keys(s.attributes || {}) })),
    };
  }

  // REST (nur lesen): Kalender-Liste und Termine
  async rest(path) {
    const r = await fetch(this.base + path, { headers: { Authorization: 'Bearer ' + this.token }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) { const e = new Error('HA ' + r.status); e.status = r.status; throw e; }
    return r.json();
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
