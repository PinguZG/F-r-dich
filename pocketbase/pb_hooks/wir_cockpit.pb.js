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
  const raw = JSON.stringify(dash);
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
  const keys = Object.keys(src).filter(k => /^d{4}-d{2}-d{2}$/.test(k)).sort().slice(-62);
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
  rec.set('data', { days });
  rec.set('sent_at', Number(body.sentAt) || Date.now());
  e.app.save(rec);
  return e.json(200, { ok: true });
});
