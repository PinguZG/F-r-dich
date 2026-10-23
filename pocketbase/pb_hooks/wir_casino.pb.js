/// <reference path="../pb_data/types.d.ts" />
// Casino (nur Spielgeld): Blackjack. Karten, Zufall und Abrechnung macht nur der Server (casino_lib.js, blackjack.js);
// casino_rounds ist für Clients schreibgeschützt, der Kartenstapel steckt im versteckten Feld "state".
// Gehört nach /home/pingu/pb/pb_hooks/ (zusammen mit casino_lib.js, blackjack.js, coins_lib.js, wir_lib.js).

routerAdd('GET', '/api/casino/bj', (e) => {
  const casino = require(`${__hooks}/casino_lib.js`);
  return e.json(200, casino.current(e.app, e.auth.id));
}, $apis.requireAuth('users'));

routerAdd('POST', '/api/casino/bj/start', (e) => {
  const casino = require(`${__hooks}/casino_lib.js`);
  return e.json(200, casino.start(e.app, e.auth.id, e.requestInfo().body || {}));
}, $apis.requireAuth('users'));

routerAdd('POST', '/api/casino/bj/{id}/act', (e) => {
  const casino = require(`${__hooks}/casino_lib.js`);
  return e.json(200, casino.act(e.app, e.auth.id, e.request.pathValue('id'), e.requestInfo().body || {}));
}, $apis.requireAuth('users'));
