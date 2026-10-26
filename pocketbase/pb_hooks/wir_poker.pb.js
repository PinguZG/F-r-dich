/// <reference path="../pb_data/types.d.ts" />
// Poker (Texas Hold'em, nur Spielgeld): zu zweit (Heads-up) oder solo gegen 1–3 KI. Logik in poker_lib.js + poker.js.
// Mischen, Austeilen, Bewertung und Auszahlung nur hier; poker_tables ist für Clients schreibgeschützt, state versteckt.

routerAdd('GET', '/api/poker', (e) => e.json(200, require(`${__hooks}/poker_lib.js`).current(e.app, e.auth.id)), $apis.requireAuth('users'));

routerAdd('GET', '/api/poker/{id}', (e) => {
  const lib = require(`${__hooks}/poker_lib.js`);
  let rec;
  try { rec = e.app.findRecordById('poker_tables', e.request.pathValue('id')); } catch (_) { throw new NotFoundError('Tisch nicht gefunden'); }
  if (rec.getString('p1') !== e.auth.id && rec.getString('p2') !== e.auth.id) throw new ForbiddenError('Nicht dein Tisch');
  return e.json(200, lib.viewFor(rec, e.auth.id));
}, $apis.requireAuth('users'));

routerAdd('POST', '/api/poker/new', (e) => e.json(200, require(`${__hooks}/poker_lib.js`).newTable(e.app, e.auth.id, e.requestInfo().body || {})), $apis.requireAuth('users'));
routerAdd('POST', '/api/poker/{id}/join', (e) => e.json(200, require(`${__hooks}/poker_lib.js`).join(e.app, e.auth.id, e.request.pathValue('id'), e.requestInfo().body || {})), $apis.requireAuth('users'));
routerAdd('POST', '/api/poker/{id}/act', (e) => e.json(200, require(`${__hooks}/poker_lib.js`).act(e.app, e.auth.id, e.request.pathValue('id'), e.requestInfo().body || {})), $apis.requireAuth('users'));
routerAdd('POST', '/api/poker/{id}/next', (e) => e.json(200, require(`${__hooks}/poker_lib.js`).next(e.app, e.auth.id, e.request.pathValue('id'), e.requestInfo().body || {})), $apis.requireAuth('users'));
routerAdd('POST', '/api/poker/{id}/leave', (e) => e.json(200, require(`${__hooks}/poker_lib.js`).leave(e.app, e.auth.id, e.request.pathValue('id'))), $apis.requireAuth('users'));
