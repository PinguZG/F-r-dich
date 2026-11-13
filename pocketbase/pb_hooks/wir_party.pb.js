/// <reference path="../pb_data/types.d.ts" />
// Zusammen spielen: Partien (party_games) und Züge (party_steps) werden NUR über diese Routen geschrieben.
// Prüfungen (immer serverseitig): Mitspielende, Reihenfolge der Runde, ein Zug pro Person und Runde, Art des Zugs (Text/Zeichnung),
// Größe, Zeitlimit (+30 s Kulanz; danach füllt der Cron „übersprungen“ ein). Coins nur am Ende, höchstens 3 Partien pro Tag.

routerAdd('POST', '/api/party/new', (e) => {
  const P = require(`${__hooks}/party_lib.js`);
  const wir = require(`${__hooks}/wir_lib.js`);
  const b = e.requestInfo().body || {};
  const mode = String(b.mode || '');
  const M = P.MODES[mode];
  if (!M) throw new BadRequestError('Unbekannter Modus');
  const s = b.settings && typeof b.settings === 'object' ? b.settings : {};
  const uid = e.auth.id, partner = wir.partnerOf(e.app, uid).id;
  const active = e.app.countRecords('party_games', $dbx.exp("status = 'playing' AND (p1 = {:u} OR p2 = {:u})", { u: uid }));
  if (active >= P.MAX_ACTIVE) throw new BadRequestError('Es laufen schon ' + P.MAX_ACTIVE + ' Partien. Beende oder lösche eine.');
  const today = e.app.countRecords('party_games', $dbx.exp('p1 = {:u} AND created >= {:t}', { u: uid, t: wir.toPb(Date.now() - 86400000) }));
  if (today >= P.MAX_NEW_PER_DAY) throw new BadRequestError('Für heute reicht es – morgen geht es weiter.');
  const rounds = P.num(s.rounds, M.min, M.max, M.def);
  const turn = P.num(s.turn_s, 0, 600, 90);
  const g = new Record(e.app.findCollectionByNameOrId('party_games'));
  g.set('mode', mode); g.set('p1', uid); g.set('p2', partner); g.set('status', 'playing');
  g.set('rounds', rounds); g.set('round', 0);
  g.set('turn_s', turn === 0 ? 0 : Math.max(20, turn));
  g.set('brush', s.brush === 'pen' ? 'pen' : 'free');
  g.set('look_s', P.num(s.look_s, 3, 15, 5)); g.set('fps', P.num(s.fps, 2, 12, 6));
  g.set('paused', false);
  g.set('deadline', turn > 0 ? wir.toPb(Date.now() + Math.max(20, turn) * 1000 + P.GRACE) : '');
  e.app.save(g);
  P.push(e.app, partner, 'party:new:' + g.id, `🎨 ${P.nameOf(e.app, uid)} startet „${M.name}“`, 'Spielst du mit?');
  return e.json(200, g);
}, $apis.requireAuth('users'));

routerAdd('POST', '/api/party/{id}/step', (e) => {
  const P = require(`${__hooks}/party_lib.js`);
  const wir = require(`${__hooks}/wir_lib.js`);
  const id = e.request.pathValue('id'), uid = e.auth.id;
  const b = e.requestInfo().body || {};
  const text = String(b.text || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 200);
  let files = [];
  try { files = e.findUploadedFiles('image') || []; } catch (_) { files = []; }   // JSON-Anfrage (Text-Zug): keine Dateien
  let out = null;
  e.app.runInTransaction((tx) => {
    const g = P.load(tx, id);
    const idx = P.idxOf(g, uid);
    if (g.getString('status') !== 'playing') throw new BadRequestError('Die Partie ist schon zu Ende.');
    const r = g.getInt('round'), mode = g.getString('mode');
    const dl = wir.fromPb(g.getString('deadline'));
    if (dl && !g.getBool('paused') && Date.now() > dl) throw new ApiError(409, 'Die Zeit ist abgelaufen.');
    const chain = P.chainOf(idx, r), kind = P.kindOf(mode, r);
    let dup = true;
    try { tx.findFirstRecordByFilter('party_steps', 'game = {:g} && chain = {:c} && idx = {:i}', { g: id, c: chain, i: r }); } catch (_) { dup = false; }
    if (dup) throw new ApiError(409, 'Du hast diese Runde schon abgegeben.');
    const s = new Record(tx.findCollectionByNameOrId('party_steps'));
    s.set('game', id); s.set('chain', chain); s.set('idx', r); s.set('author', uid); s.set('kind', kind);
    if (kind === 'text') {
      if (!text) throw new BadRequestError('Bitte schreib etwas.');
      s.set('text', text);
    } else {
      if (!files || !files.length) throw new BadRequestError('Die Zeichnung fehlt.');
      if (files[0].size > 1000000) throw new BadRequestError('Die Zeichnung ist zu groß.');
      s.set('image', files[0]);
    }
    tx.save(s);
    out = s;
    const n = tx.countRecords('party_steps', $dbx.exp('game = {:g} AND idx = {:i}', { g: id, i: r }));
    if (n >= 2) P.nextRound(tx, g, uid);
    else tx.save(g);      // Partie „anfassen“ (updated), kein Push: die andere Person ist ja selbst noch dran
  });
  return e.json(200, out);
}, $apis.requireAuth('users'));

routerAdd('POST', '/api/party/{id}/fav', (e) => {
  const P = require(`${__hooks}/party_lib.js`);
  const g = P.load(e.app, e.request.pathValue('id'));
  P.idxOf(g, e.auth.id);
  const b = e.requestInfo().body || {};
  let s;
  try { s = e.app.findRecordById('party_steps', String(b.step || '')); } catch (_) { throw new NotFoundError('Zug nicht gefunden'); }
  if (s.getString('game') !== g.id) throw new BadRequestError('Falsche Partie');
  s.set('fav', !s.getBool('fav'));
  e.app.save(s);
  return e.json(200, s);
}, $apis.requireAuth('users'));

routerAdd('POST', '/api/party/{id}/pause', (e) => {
  const P = require(`${__hooks}/party_lib.js`);
  const wir = require(`${__hooks}/wir_lib.js`);
  const g = P.load(e.app, e.request.pathValue('id'));
  P.idxOf(g, e.auth.id);
  if (g.getString('status') !== 'playing') throw new BadRequestError('Die Partie ist schon zu Ende.');
  const pause = !!(e.requestInfo().body || {}).paused;
  g.set('paused', pause);
  const t = g.getInt('turn_s');
  g.set('deadline', pause || t <= 0 ? '' : wir.toPb(Date.now() + t * 1000 + P.GRACE));
  e.app.save(g);
  return e.json(200, g);
}, $apis.requireAuth('users'));

routerAdd('POST', '/api/party/{id}/delete', (e) => {
  const P = require(`${__hooks}/party_lib.js`);
  const g = P.load(e.app, e.request.pathValue('id'));
  P.idxOf(g, e.auth.id);
  e.app.delete(g);
  return e.json(200, { ok: true });
}, $apis.requireAuth('users'));

cronAdd('wir_party_tick', '* * * * *', () => {
  try { require(`${__hooks}/party_lib.js`).tick($app); } catch (err) { $app.logger().error('party tick', 'error', String(err)); }
});
cronAdd('wir_party_cleanup', '11 4 * * *', () => {
  try { require(`${__hooks}/party_lib.js`).cleanup($app); } catch (err) { $app.logger().error('party cleanup', 'error', String(err)); }
});
