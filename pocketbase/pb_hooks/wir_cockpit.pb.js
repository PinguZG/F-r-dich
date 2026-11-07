/// <reference path="../pb_data/types.d.ts" />
// Claude-Cockpit (07.11.2026): der Cockpit-Mod auf Daniels PC schickt hierher, was Claude Code gerade tut.
// Ausweis: Header x-cockpit-key muss dem Inhalt von /home/pingu/pb/cockpit.key entsprechen (Datei nur für pingu,
// nie im Repo). Ohne Datei ist die Route aus. Gespeichert wird in den einen Datensatz der Collection "cockpit";
// die App liest ihn per Realtime (Zuhause → Claude).

routerAdd('POST', '/api/cockpit/status', (e) => {
  let key = '';
  try { key = toString($os.readFile(`${__hooks}/../cockpit.key`)).trim(); } catch (_) { key = ''; }
  const got = String(e.request.header.get('x-cockpit-key') || '');
  if (key.length < 24 || got.length !== key.length) return e.json(403, { ok: false });
  let diff = 0;
  for (let i = 0; i < key.length; i++) diff |= key.charCodeAt(i) ^ got.charCodeAt(i);
  if (diff !== 0) return e.json(403, { ok: false });

  const body = e.requestInfo().body || {};
  const dash = body.dash;
  if (!dash || typeof dash !== 'object' || Array.isArray(dash)) return e.json(400, { ok: false });
  // Nur bekannte Felder übernehmen (wie bei /cowork): Texte gekürzt, Listen begrenzt, Tiefe begrenzt.
  const clean = (v, depth) => {
    if (v == null || typeof v === 'boolean') return v;
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    if (typeof v === 'string') return v.replace(/[\u0000-\u001f]/g, ' ').slice(0, 300);
    if (depth > 5) return null;
    if (Array.isArray(v)) return v.slice(0, 40).map(x => clean(x, depth + 1));
    if (typeof v === 'object') { const o = {}; Object.keys(v).slice(0, 40).forEach(k => { if (/^[A-Za-z0-9_]{1,30}$/.test(k)) o[k] = clean(v[k], depth + 1); }); return o; }
    return null;
  };
  const TOP = ['teamNote', 'team', 'mood', 'pose', 'isPoked', 'status', 'saying', 'agents', 'moreAgents', 'rings', 'tiles', 'chats'];
  const safe = {};
  TOP.forEach(k => { if (k in dash) safe[k] = clean(dash[k], 1); });
  // Helfer-Art nur aus der festen Liste: ein unbekannter Name würde die Grafik in der App abstürzen lassen
  const KINDS = ['pip', 'bubbles', 'inky', 'coral', 'shelly', 'luma', 'generic'];
  ['team', 'agents'].forEach(k => {
    if (!Array.isArray(safe[k])) { delete safe[k]; return; }
    safe[k] = safe[k].filter(x => x && typeof x === 'object')
      .map(x => ({ ...x, kind: KINDS.includes(x.kind) ? x.kind : 'generic' }))
      .filter(x => k !== 'team' || x.kind !== 'generic');
  });
  const raw = JSON.stringify(safe);
  if (raw.length > 50000) return e.json(413, { ok: false });

  const col = e.app.findCollectionByNameOrId('cockpit');
  let rec;
  try { rec = e.app.findRecordById(col, 'cockpitstatus00'); } catch (_) { rec = new Record(col); rec.set('id', 'cockpitstatus00'); }
  rec.set('data', JSON.parse(raw));
  rec.set('sent_at', Number(body.sentAt) || Date.now());
  e.app.save(rec);
  return e.json(200, { ok: true });
});

// Cowork-Status (07.11.2026): das Cowork-Plugin „cockpit-team“ meldet per Hook, was Cowork gerade tut.
// Eigener Schlüssel /home/pingu/pb/cowork.key (nur pingu, nie im Repo; fehlt er, ist die Route aus). Er darf nur
// die kurze Statuszeile im Datensatz `coworkstatus000` setzen: nur bekannte Felder, nur kurze Texte.
routerAdd('POST', '/api/cockpit/cowork', (e) => {
  let key = '';
  try { key = toString($os.readFile(`${__hooks}/../cowork.key`)).trim(); } catch (_) { key = ''; }
  const got = String(e.request.header.get('x-cowork-key') || '');
  if (key.length < 24 || got.length !== key.length) return e.json(403, { ok: false });
  let diff = 0;
  for (let i = 0; i < key.length; i++) diff |= key.charCodeAt(i) ^ got.charCodeAt(i);
  if (diff !== 0) return e.json(403, { ok: false });

  const body = e.requestInfo().body || {};
  const s = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').slice(0, n);
  const out = {
    source: 'cowork',
    id: s(body.id, 80), title: s(body.title, 80), state: s(body.state, 20), text: s(body.text, 80),
    event: s(body.event, 40), tool: s(body.tool, 60), agent: s(body.agent, 60),
  };
  // Kontext und Cache der letzten Cowork-Antwort (nur Zahlen, seit Plugin 0.4.0)
  const n = (v, max) => { const x = Math.round(Number(v)); return Number.isFinite(x) && x >= 0 ? Math.min(x, max) : 0; };
  const ctx = n(body.ctx, 2000000);
  if (ctx > 0) {
    out.ctx = ctx; out.win = n(body.win, 2000000) || 200000;
    out.cread = n(body.cread, 2000000); out.cwrite = n(body.cwrite, 2000000); out.fresh = n(body.fresh, 2000000);
    out.model = s(body.model, 40);
  }
  if (!['idle', 'thinking', 'working'].includes(out.state)) out.state = 'working';

  const col = e.app.findCollectionByNameOrId('cockpit');
  let rec;
  try { rec = e.app.findRecordById(col, 'coworkstatus000'); } catch (_) { rec = new Record(col); rec.set('id', 'coworkstatus000'); }
  rec.set('data', out);
  rec.set('sent_at', Date.now());
  e.app.save(rec);

  // Verbrauch der Antwort (seit Plugin 0.4.3, nur beim Antwort-Ende): pro Tag (Berliner Zeit) aufsummieren, damit
  // Verlauf und Luma Cowork mitzählen. Datensatz coworkverlauf00: { days: { "JJJJ-MM-TT": { turns, units, out, hours[24] } } }
  const t = body.turn;
  if (t && typeof t === 'object' && !Array.isArray(t)) {
    const units = n(t.units, 5e7), outTok = n(t.out, 1e8), msgs = n(t.msgs, 1000);
    if (units > 0 && msgs > 0) {
      const now = new Date();
      const y = now.getUTCFullYear();
      const lastSun = m => { const d = new Date(Date.UTC(y, m + 1, 0)); return d.getUTCDate() - d.getUTCDay(); };
      const dstStart = Date.UTC(y, 2, lastSun(2), 1), dstEnd = Date.UTC(y, 9, lastSun(9), 1);
      const b = new Date(now.getTime() + (now.getTime() >= dstStart && now.getTime() < dstEnd ? 2 : 1) * 3600000);
      const p2 = x => (x < 10 ? '0' : '') + x;
      const key = b.getUTCFullYear() + '-' + p2(b.getUTCMonth() + 1) + '-' + p2(b.getUTCDate());
      let vr;
      try { vr = e.app.findRecordById(col, 'coworkverlauf00'); } catch (_) { vr = new Record(col); vr.set('id', 'coworkverlauf00'); }
      let data = {};
      try { data = JSON.parse(vr.getString('data') || '{}') || {}; } catch (_) { data = {}; }
      const days = data.days && typeof data.days === 'object' ? data.days : {};
      const d = days[key] || { turns: 0, units: 0, out: 0, hours: [] };
      const hours = Array.isArray(d.hours) ? d.hours.slice(0, 24) : [];
      while (hours.length < 24) hours.push(0);
      hours[b.getUTCHours()] += 1;
      days[key] = { turns: (Number(d.turns) || 0) + 1, units: (Number(d.units) || 0) + units, out: (Number(d.out) || 0) + outTok, hours };
      const keep = {};
      Object.keys(days).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort().slice(-62).forEach(k => { keep[k] = days[k]; });
      vr.set('data', { days: keep });
      vr.set('sent_at', Date.now());
      e.app.save(vr);
    }
  }
  return e.json(200, { ok: true });
});

// Verlauf (07.11.2026): der Cockpit-Mod schickt höchstens alle 10 Min. seine Tagesstatistik (bis 60 Tage: Antworten,
// Verbrauch, Helfer, Limit-Spitzen, Stunden). Die App zeigt daraus „Verlauf“ und Luma, den Limit-Coach.
// Gleicher Schlüssel wie /api/cockpit/status; nur Zahlen werden übernommen, Datensatz `cockpitverlauf0`.
routerAdd('POST', '/api/cockpit/verlauf', (e) => {
  let key = '';
  try { key = toString($os.readFile(`${__hooks}/../cockpit.key`)).trim(); } catch (_) { key = ''; }
  const got = String(e.request.header.get('x-cockpit-key') || '');
  if (key.length < 24 || got.length !== key.length) return e.json(403, { ok: false });
  let diff = 0;
  for (let i = 0; i < key.length; i++) diff |= key.charCodeAt(i) ^ got.charCodeAt(i);
  if (diff !== 0) return e.json(403, { ok: false });

  const body = e.requestInfo().body || {};
  const src = body.verlauf && body.verlauf.days;
  if (!src || typeof src !== 'object' || Array.isArray(src)) return e.json(400, { ok: false });
  const num = v => { const x = Number(v); return Number.isFinite(x) && x >= 0 ? Math.min(Math.round(x * 10) / 10, 1e12) : 0; };
  const days = {};
  const keys = Object.keys(src).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort().slice(-62);
  for (const k of keys) {
    const d = src[k] || {};
    const helpers = {};
    if (d.helpers && typeof d.helpers === 'object') {
      Object.keys(d.helpers).filter(h => /^[a-z]{2,16}$/.test(h)).slice(0, 12).forEach(h => { helpers[h] = num(d.helpers[h]); });
    }
    const hours = Array.isArray(d.hours) ? d.hours.slice(0, 24).map(num) : [];
    while (hours.length < 24) hours.push(0);
    days[k] = {
      turns: num(d.turns), out: num(d.out), units: num(d.units), helperUnits: num(d.helperUnits),
      helperAtMain: num(d.helperAtMain), peak5h: num(d.peak5h), peakWeek: num(d.peakWeek), hours, helpers,
    };
  }
  const col = e.app.findCollectionByNameOrId('cockpit');
  let rec;
  try { rec = e.app.findRecordById(col, 'cockpitverlauf0'); } catch (_) { rec = new Record(col); rec.set('id', 'cockpitverlauf0'); }
  // Zusammenführen statt ersetzen: Tage, die nur der Server kennt (z. B. rückwirkend aus den Gesprächsprotokollen
  // eingespielt), bleiben erhalten. Kennen beide einen Tag, gilt je Wert das Größere (der Mod zählt erst seit seinem
  // Start, die Protokolle zählen alles).
  let old = {};
  try { old = (JSON.parse(rec.getString('data') || '{}') || {}).days || {}; } catch (_) { old = {}; }
  const mx = (a, b) => Math.max(Number(a) || 0, Number(b) || 0);
  Object.keys(old).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)).forEach(k => {
    const o = old[k] || {}, nw = days[k];
    if (!nw) { days[k] = o; return; }
    const helpers = { ...(o.helpers || {}) };
    Object.keys(nw.helpers || {}).forEach(h => { helpers[h] = mx(helpers[h], nw.helpers[h]); });
    const oh = Array.isArray(o.hours) ? o.hours : [];
    days[k] = {
      turns: mx(o.turns, nw.turns), out: mx(o.out, nw.out), units: mx(o.units, nw.units), helperUnits: mx(o.helperUnits, nw.helperUnits),
      helperAtMain: mx(o.helperAtMain, nw.helperAtMain), peak5h: mx(o.peak5h, nw.peak5h), peakWeek: mx(o.peakWeek, nw.peakWeek),
      hours: nw.hours.map((v, i) => mx(v, oh[i])), helpers,
    };
  });
  const keep = {};
  Object.keys(days).sort().slice(-62).forEach(k => { keep[k] = days[k]; });
  rec.set('data', { days: keep });
  rec.set('sent_at', Number(body.sentAt) || Date.now());
  e.app.save(rec);
  return e.json(200, { ok: true });
});
