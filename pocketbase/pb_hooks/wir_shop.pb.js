/// <reference path="../pb_data/types.d.ts" />
// Neuer Shop (Tipps, Profilrahmen, Bomben), Solitär und Schach gegen KI. Logik + PREISE in shop_lib.js, Spiele in solo_lib.js.
// Alle neuen Collections sind für Clients schreibgeschützt; gebucht wird nur über coins.book().

routerAdd('GET', '/api/shop/catalog', (e) => {
  return e.json(200, require(`${__hooks}/shop_lib.js`).catalog(e.app, e.auth.id));
}, $apis.requireAuth('users'));

routerAdd('POST', '/api/shop/tip', (e) => {
  return e.json(200, require(`${__hooks}/shop_lib.js`).buyTip(e.app, e.auth.id, e.requestInfo().body || {}));
}, $apis.requireAuth('users'));

routerAdd('POST', '/api/shop/frame', (e) => {
  return e.json(200, require(`${__hooks}/shop_lib.js`).buyFrame(e.app, e.auth.id, e.requestInfo().body || {}));
}, $apis.requireAuth('users'));

routerAdd('POST', '/api/shop/frame/set', (e) => {
  return e.json(200, require(`${__hooks}/shop_lib.js`).setFrame(e.app, e.auth.id, e.requestInfo().body || {}));
}, $apis.requireAuth('users'));

routerAdd('POST', '/api/shop/bomb', (e) => {
  return e.json(200, require(`${__hooks}/shop_lib.js`).buyBomb(e.app, e.auth.id, e.requestInfo().body || {}));
}, $apis.requireAuth('users'));

// Rahmen am Profil nur über die Routen oben (gekaufte Rahmen); direktes Setzen über die users-API verhindern
onRecordUpdateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    const before = e.record.original().getString('frame'), after = e.record.getString('frame');
    if (before !== after) throw new ForbiddenError('Profilrahmen bitte im Shop auswählen.');
  }
  e.next();
}, 'users');

// ---------- Solitär ----------
routerAdd('POST', '/api/games/solitaire/new', (e) => {
  return e.json(200, require(`${__hooks}/solo_lib.js`).solitaireNew(e.app, e.auth.id, e.requestInfo().body || {}));
}, $apis.requireAuth('users'));

routerAdd('POST', '/api/games/solitaire/{id}/finish', (e) => {
  const r = require(`${__hooks}/solo_lib.js`).solitaireFinish(e.app, e.auth.id, e.request.pathValue('id'), e.requestInfo().body || {});
  return e.json(200, { game: r.rec, coins: r.coins });
}, $apis.requireAuth('users'));

// ---------- Schach gegen KI ----------
routerAdd('POST', '/api/games/chessai/result', (e) => {
  const r = require(`${__hooks}/solo_lib.js`).chessaiResult(e.app, e.auth.id, e.requestInfo().body || {});
  return e.json(200, { game: r.rec, coins: r.coins });
}, $apis.requireAuth('users'));
