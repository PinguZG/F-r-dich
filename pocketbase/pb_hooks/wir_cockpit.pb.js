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

// Cowork-Status (07.11.2026, Testversion): das Cowork-Plugin „cockpit-team“ meldet per Hook, was Cowork gerade tut.
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
    diag: { uname: s(body.uname, 200), host: s(body.host, 80), pwd: s(body.pwd, 200), user: s(body.user, 40), dir: s(body.dir, 200) },
  };
  if (!['idle', 'thinking', 'working'].includes(out.state)) out.state = 'working';

  const col = e.app.findCollectionByNameOrId('cockpit');
  let rec;
  try { rec = e.app.findRecordById(col, 'coworkstatus000'); } catch (_) { rec = new Record(col); rec.set('id', 'coworkstatus000'); }
  rec.set('data', out);
  rec.set('sent_at', Date.now());
  e.app.save(rec);
  return e.json(200, { ok: true });
});
