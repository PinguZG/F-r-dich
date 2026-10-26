/// <reference path="../pb_data/types.d.ts" />
// Sync-Knopf + Schütteln (Logik in sync_lib.js). live_state ist für Clients nur lesbar, geschrieben wird nur hier.
// Pushs landen in push_queue (Arten "sync" und "shake"), wir-push verschickt sie.

// Halten: { down: true } als Heartbeat alle ~0,5 s, { down: false } beim Loslassen
routerAdd('POST', '/api/sync/hold', (e) => {
  const sync = require(`${__hooks}/sync_lib.js`);
  return e.json(200, sync.hold(e.app, e.auth.id, e.requestInfo().body || {}));
}, $apis.requireAuth('users'));

// Schütteln: Lebenszeichen höchstens ~1×/s, solange geschüttelt wird
routerAdd('POST', '/api/shake', (e) => {
  const sync = require(`${__hooks}/sync_lib.js`);
  return e.json(200, sync.shake(e.app, e.auth.id));
}, $apis.requireAuth('users'));
