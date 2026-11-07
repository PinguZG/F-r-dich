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
