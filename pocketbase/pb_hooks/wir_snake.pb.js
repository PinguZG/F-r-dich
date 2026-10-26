/// <reference path="../pb_data/types.d.ts" />
// Snake (Logik in snake_lib.js).
routerAdd('POST', '/api/games/snake/new', (e) => e.json(200, require(`${__hooks}/snake_lib.js`).snakeNew(e.app, e.auth.id)), $apis.requireAuth('users'));
routerAdd('POST', '/api/games/snake/{id}/finish', (e) => {
  const r = require(`${__hooks}/snake_lib.js`).snakeFinish(e.app, e.auth.id, e.request.pathValue('id'), e.requestInfo().body || {});
  return e.json(200, { game: r.rec, coins: r.coins, record: r.record });
}, $apis.requireAuth('users'));
