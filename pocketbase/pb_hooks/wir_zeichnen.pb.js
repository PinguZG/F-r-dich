/// <reference path="../pb_data/types.d.ts" />
// Zusammen zeichnen: Bilder (drawings) und Striche (drawing_strokes) werden NUR über diese Routen geschrieben.
// Jeder Strich bekommt in einer Transaktion die nächste Nummer (seq). Rückgängig/Wiederholen gilt pro Person.
// Live-Zwischenstände (Punkte während des Zeichnens, Cursor) laufen über /live als Realtime-Nachricht
// (Topic "draw/<id>") nur an die andere Person – ohne Datenbank, wie bei Herzspur. Hilfen in zeichnen_lib.js.

routerAdd('POST', '/api/draw/new', (e) => {
  const Z = require(`${__hooks}/zeichnen_lib.js`);
  const b = e.requestInfo().body || {};
  const r = new Record(e.app.findCollectionByNameOrId('drawings'));
  const title = String(b.title || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 80) || 'Unser Bild';
  r.set('title', title); r.set('author', e.auth.id); r.set('w', Z.W); r.set('h', Z.H);
  r.set('layers', Z.DEFAULT_LAYERS); r.set('seq', 0);
  r.set('last_by', e.auth.id); r.set('last_at', new DateTime());
  e.app.save(r);
  Z.notify(e.app, e.auth.id, `🎨 ${Z.nameOf(e.app, e.auth.id)} hat ein neues Bild angefangen`, `„${title}“ – zeichnest du mit?`);
  return e.json(200, r);
}, $apis.requireAuth('users'));

routerAdd('POST', '/api/draw/{id}/stroke', (e) => {
  const Z = require(`${__hooks}/zeichnen_lib.js`);
  const wir = require(`${__hooks}/wir_lib.js`);
  const id = e.request.pathValue('id'), uid = e.auth.id;
  const b = e.requestInfo().body || {};
  const data = Z.cleanStroke(b.data);
  const cid = String(b.cid || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
  let out = null, pause = false, title = '';
  e.app.runInTransaction((tx) => {
    const d = Z.load(tx, id);
    if (d.getBool('locked')) throw new ApiError(423, 'Das Bild ist gesperrt.');
    let layers = [];
    try { layers = JSON.parse(d.getString('layers') || '[]'); } catch (_) {}
    const layer = String(b.layer || '');
    if (!Array.isArray(layers) || !layers.some(l => l.id === layer)) throw new BadRequestError('Ebene gibt es nicht');
    // doppelt geschickt (z. B. nach Funkloch)? -> den vorhandenen Strich zurückgeben
    if (cid) { try { out = tx.findFirstRecordByFilter('drawing_strokes', 'drawing = {:d} && cid = {:c}', { d: id, c: cid }); return; } catch (_) {} }
    const seq = d.getInt('seq') + 1;
    const lastAt = wir.fromPb(d.getString('last_at'));
    pause = !lastAt || Date.now() - lastAt > Z.PAUSE;
    title = d.getString('title');
    d.set('seq', seq); d.set('last_by', uid); d.set('last_at', new DateTime());
    tx.save(d);
    // neuer Strich -> eigene rückgängig gemachte Striche können nicht mehr wiederholt werden
    for (const old of tx.findRecordsByFilter('drawing_strokes', 'drawing = {:d} && author = {:u} && undone = true && dead = false', '', 500, 0, { d: id, u: uid })) {
      old.set('dead', true); tx.save(old);
    }
    const s = new Record(tx.findCollectionByNameOrId('drawing_strokes'));
    s.set('drawing', id); s.set('author', uid); s.set('seq', seq); s.set('layer', layer); s.set('data', data); s.set('cid', cid);
    tx.save(s);
    out = s;
  });
  if (pause) {
    try { Z.notify(e.app, uid, `🎨 ${Z.nameOf(e.app, uid)} zeichnet an „${title}“`, 'Malst du mit?'); }
    catch (err) { e.app.logger().error('draw push', 'error', String(err)); }
  }
  return e.json(200, out);
}, $apis.requireAuth('users'));

// Rückgängig: letzter eigener Strich; Wiederholen: zuletzt rückgängig gemachter eigener Strich
routerAdd('POST', '/api/draw/{id}/undo', (e) => {
  const Z = require(`${__hooks}/zeichnen_lib.js`);
  const id = e.request.pathValue('id'), uid = e.auth.id;
  const d = Z.load(e.app, id);
  if (d.getBool('locked')) throw new ApiError(423, 'Das Bild ist gesperrt.');
  const rows = e.app.findRecordsByFilter('drawing_strokes', 'drawing = {:d} && author = {:u} && undone = false', '-seq', 1, 0, { d: id, u: uid });
  if (!rows.length) return e.json(200, { stroke: null });
  rows[0].set('undone', true); rows[0].set('undone_at', Date.now());
  e.app.save(rows[0]);
  return e.json(200, { stroke: rows[0] });
}, $apis.requireAuth('users'));

routerAdd('POST', '/api/draw/{id}/redo', (e) => {
  const Z = require(`${__hooks}/zeichnen_lib.js`);
  const id = e.request.pathValue('id'), uid = e.auth.id;
  const d = Z.load(e.app, id);
  if (d.getBool('locked')) throw new ApiError(423, 'Das Bild ist gesperrt.');
  const rows = e.app.findRecordsByFilter('drawing_strokes', 'drawing = {:d} && author = {:u} && undone = true && dead = false', '-undone_at', 1, 0, { d: id, u: uid });
  if (!rows.length) return e.json(200, { stroke: null });
  rows[0].set('undone', false);
  e.app.save(rows[0]);
  return e.json(200, { stroke: rows[0] });
}, $apis.requireAuth('users'));

// Titel, Ebenen, Sperre
routerAdd('POST', '/api/draw/{id}/meta', (e) => {
  const Z = require(`${__hooks}/zeichnen_lib.js`);
  const d = Z.load(e.app, e.request.pathValue('id'));
  const b = e.requestInfo().body || {};
  if (b.title != null) d.set('title', String(b.title).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 80) || 'Unser Bild');
  if (b.layers != null) {
    if (d.getBool('locked')) throw new ApiError(423, 'Das Bild ist gesperrt.');
    d.set('layers', Z.cleanLayers(b.layers));
  }
  if (b.locked != null) { d.set('locked', !!b.locked); d.set('locked_by', b.locked ? e.auth.id : ''); }
  e.app.save(d);
  return e.json(200, d);
}, $apis.requireAuth('users'));

// Vorschaubild für die Galerie (PNG/JPEG, vom Gerät gerendert)
routerAdd('POST', '/api/draw/{id}/thumb', (e) => {
  const Z = require(`${__hooks}/zeichnen_lib.js`);
  const d = Z.load(e.app, e.request.pathValue('id'));
  const files = e.findUploadedFiles('thumb');
  if (!files || !files.length) throw new BadRequestError('Kein Bild');
  d.set('thumb', files[0]);
  e.app.save(d);
  return e.json(200, { ok: true });
}, $apis.requireAuth('users'));

// Live: Punkte während des Zeichnens, Cursor, „fertig“ – nur weiterreichen, nichts speichern
routerAdd('POST', '/api/draw/{id}/live', (e) => {
  const Z = require(`${__hooks}/zeichnen_lib.js`);
  const id = e.request.pathValue('id');
  Z.load(e.app, id);
  const b = e.requestInfo().body || {};
  const t = String(b.t || '');
  if (['cur', 'pts', 'end', 'bye'].indexOf(t) < 0) throw new BadRequestError('unbekannt');
  const msg = { t, from: e.auth.id };
  if (t === 'cur') { msg.x = +b.x || 0; msg.y = +b.y || 0; }
  if (t === 'pts' || t === 'end') {
    msg.sid = String(b.sid || '').slice(0, 40);
    if (t === 'pts') {
      msg.layer = String(b.layer || '').slice(0, 20);
      msg.i = b.i | 0;
      try { msg.data = Z.cleanStroke(b.data); } catch (_) { throw new BadRequestError('Ungültig'); }
    }
  }
  return e.json(200, { sent: Z.relay(e.app, id, e.auth.id, msg) });
}, $apis.requireAuth('users'));
