/// <reference path="../pb_data/types.d.ts" />
// Foto-Swipen: ein Like pro Rechtsswipe. Der Server zählt, der Client kann keine Zahlen setzen.
routerAdd('POST', '/api/wir/photo-like', (e) => {
  const body = e.requestInfo().body || {};
  const photoId = String(body.photo || '');
  if (!/^[a-z0-9]{15}$/.test(photoId)) return e.json(400, { error: 'Foto fehlt' });
  try { e.app.findRecordById('photos', photoId); } catch (_) { return e.json(404, { error: 'Foto nicht gefunden' }); }
  const uid = e.auth.id;
  let rec = null;
  try { rec = e.app.findFirstRecordByFilter('photo_likes', 'photo = {:p} && user = {:u}', { p: photoId, u: uid }); } catch (_) {}
  if (!rec) {
    rec = new Record(e.app.findCollectionByNameOrId('photo_likes'));
    rec.set('photo', photoId); rec.set('user', uid); rec.set('count', 0);
  }
  rec.set('count', (rec.getInt('count') || 0) + 1);
  e.app.save(rec);
  return e.json(200, { photo: photoId, user: uid, count: rec.getInt('count') });
}, $apis.requireAuth('users'));
