/// <reference path="../pb_data/types.d.ts" />
// Heart Coins + Gutschein-Shop. Coins bucht ausschließlich der Server (Logik in coins_lib.js);
// coin_wallets, coin_ledger, vouchers sind für Clients schreibgeschützt (Regel leer = nur Superuser).
// Gehört nach /home/pingu/pb/pb_hooks/ (zusammen mit coins_lib.js, wir_lib.js).
// Pushs landen in push_queue (Art "gift"), wir-push verschickt sie.

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

// ---------- Gutscheine ----------
routerAdd('POST', '/api/shop/gift', (e) => {
  const coins = require(`${__hooks}/coins_lib.js`);
  const r = coins.gift(e.app, e.auth.id, e.requestInfo().body || {});
  if (!r.dup) {
    coins.pushGift(e.app, r.partner, `🎁 ${coins.nameOf(e.app, e.auth.id)} hat dir einen Gutschein geschenkt: ${r.rec.getString('name')}`,
      r.rec.getString('note') || 'Schau in deine Gutscheine 💗');
  }
  return e.json(200, { voucher: r.rec, balance: r.balance, dup: r.dup });
}, $apis.requireAuth('users'));

routerAdd('POST', '/api/vouchers/{id}/redeem', (e) => {
  const coins = require(`${__hooks}/coins_lib.js`);
  const v = coins.redeem(e.app, e.auth.id, e.request.pathValue('id'));
  coins.pushGift(e.app, v.getString('from'), `🎟️ ${coins.nameOf(e.app, e.auth.id)} löst deinen Gutschein ein: ${v.getString('name')}`,
    'Tippe auf „Erfüllt ✓“, wenn du ihn eingelöst hast 💗');
  return e.json(200, v);
}, $apis.requireAuth('users'));

routerAdd('POST', '/api/vouchers/{id}/fulfill', (e) => {
  const coins = require(`${__hooks}/coins_lib.js`);
  const r = coins.fulfill(e.app, e.auth.id, e.request.pathValue('id'));
  coins.pushGift(e.app, r.rec.getString('to'), `✓ ${coins.nameOf(e.app, e.auth.id)} hat deinen Gutschein erfüllt: ${r.rec.getString('name')}`, '💗');
  return e.json(200, { voucher: r.rec, bonus: r.bonus });
}, $apis.requireAuth('users'));
