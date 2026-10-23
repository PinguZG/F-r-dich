/// <reference path="../pb_data/types.d.ts" />
// Heart Coins. Coins bucht ausschließlich der Server (Logik in coins_lib.js);
// coin_wallets und coin_ledger sind für Clients schreibgeschützt (Regel leer = nur Superuser).
// Gehört nach /home/pingu/pb/pb_hooks/ (zusammen mit coins_lib.js, wir_lib.js).

// ---------- Verdienen: liebevolle Aktionen ----------
onRecordAfterCreateSuccess((e) => {
  const t = e.record.getString('type');
  if (t === 'love' || t === 'heart') {
    const coins = require(`${__hooks}/coins_lib.js`);
    coins.earn(e.app, e.record.getString('from'), 'love', e.record.id);
  }
  e.next();
}, 'pings');

onRecordAfterCreateSuccess((e) => {
  const coins = require(`${__hooks}/coins_lib.js`);
  const text = e.record.getString('text').trim();
  if (Array.from(text).length >= coins.EARN.openwhen.minLen) coins.earn(e.app, e.record.getString('author'), 'openwhen', e.record.id);
  e.next();
}, 'open_when_messages');

onRecordAfterCreateSuccess((e) => {
  const coins = require(`${__hooks}/coins_lib.js`);
  coins.earn(e.app, e.record.getString('author'), 'photo', e.record.id);
  e.next();
}, 'photos', 'clay_photos');

// ---------- Kontostand + Tagesbonus ----------
routerAdd('GET', '/api/coins/me', (e) => {
  const coins = require(`${__hooks}/coins_lib.js`);
  return e.json(200, coins.me(e.app, e.auth.id));
}, $apis.requireAuth('users'));

routerAdd('POST', '/api/coins/daily', (e) => {
  const coins = require(`${__hooks}/coins_lib.js`);
  return e.json(200, coins.daily(e.app, e.auth.id));
}, $apis.requireAuth('users'));
