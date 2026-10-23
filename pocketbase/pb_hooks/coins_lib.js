// Heart Coins für wir_coins.pb.js (wird dort per require() geladen).
// Jede Coin-Bewegung läuft über book(): in einer Transaktion, mit eindeutigem Idempotenz-Schlüssel,
// nie unter 0. coin_wallets.balance ist der Cache, coin_ledger die Wahrheit (beide werden immer zusammen geschrieben).

const wir = require(`${__hooks}/wir_lib.js`);

const START = 500;
const EARN = {
  daily: { amount: 20, label: '☀️ Tagesbonus' },
  love: { amount: 1, max: 200, label: '💗 Liebe gesendet' },
  openwhen: { amount: 25, max: 5, minLen: 40, label: '💌 Öffne-wenn-Brief geschrieben' },
  photo: { amount: 5, max: 5, label: '📸 Foto hochgeladen' },
};

// 00:00 Uhr in Berlin (heute) als PocketBase-Zeit
function berlinMidnightPb(now) {
  const b = wir.berlin(now);
  const offset = Date.UTC(b.y, b.m, b.d, b.h, b.min) - Math.floor(now / 60000) * 60000; // 1 oder 2 Std.
  return wir.toPb(Date.UTC(b.y, b.m, b.d) - offset);
}

function findWallet(app, uid) {
  try { return app.findFirstRecordByFilter('coin_wallets', 'user = {:u}', { u: uid }); } catch (_) { return null; }
}

function newLedger(app, o) {
  const r = new Record(app.findCollectionByNameOrId('coin_ledger'));
  r.set('user', o.user);
  r.set('amount', o.amount);
  r.set('reason', o.reason);
  r.set('label', String(o.label || '').slice(0, 140));
  r.set('ref', o.ref || '');
  r.set('key', o.key);
  r.set('balance_after', o.after);
  return r;
}

// Konto anlegen (mit Startguthaben), falls es noch keins gibt
function ensureWallet(app, uid) {
  let w = findWallet(app, uid);
  if (w) return w;
  app.runInTransaction((tx) => {
    w = findWallet(tx, uid);
    if (w) return;
    w = new Record(tx.findCollectionByNameOrId('coin_wallets'));
    w.set('user', uid);
    w.set('balance', START);
    tx.save(w);
    tx.save(newLedger(tx, { user: uid, amount: START, reason: 'start', label: '🎉 Startguthaben', key: 'start:' + uid, after: START }));
  });
  return w;
}

// Eine Buchung. Gibt { ok, dup, balance, entry } zurück.
// dup = true: dieser Schlüssel wurde schon gebucht -> nichts passiert (Idempotenz).
function book(app, o) {
  if (!o.key) throw new Error('book: key fehlt');
  const amount = Math.trunc(Number(o.amount));
  if (!isFinite(amount) || amount === 0) throw new Error('book: Betrag ungültig');
  let out;
  app.runInTransaction((tx) => {
    try {
      const prev = tx.findFirstRecordByFilter('coin_ledger', 'key = {:k}', { k: o.key });
      const w = findWallet(tx, o.user);
      out = { ok: false, dup: true, balance: w ? w.getInt('balance') : 0, entry: prev };
      return;
    } catch (_) { /* noch nicht gebucht */ }
    const w = ensureWallet(tx, o.user);
    const fresh = tx.findRecordById('coin_wallets', w.id); // in der Transaktion neu lesen
    const after = fresh.getInt('balance') + amount;
    if (after < 0) throw new ApiError(400, 'Nicht genug Heart Coins.');
    fresh.set('balance', after);
    tx.save(fresh);
    const entry = newLedger(tx, { ...o, amount, after });
    tx.save(entry); // eindeutiger Index auf key: parallel doppelt -> Fehler -> ganze Transaktion zurück
    out = { ok: true, dup: false, balance: after, entry };
  });
  return out;
}

function countToday(app, uid, reason) {
  const since = berlinMidnightPb(Date.now());
  return app.countRecords('coin_ledger', $dbx.exp('user = {:u} AND reason = {:r} AND created >= {:t}', { u: uid, r: reason, t: since }));
}

// Belohnung für eine liebevolle Aktion (mit Tagesgrenze). Fehler hier dürfen die Aktion selbst nie verhindern.
function earn(app, uid, reason, ref) {
  const e = EARN[reason];
  try {
    if (e.max && countToday(app, uid, reason) >= e.max) return null;
    return book(app, { user: uid, amount: e.amount, reason, label: e.label, ref, key: `${reason}:${ref}` });
  } catch (err) {
    app.logger().error('coins earn', 'reason', reason, 'error', String(err));
    return null;
  }
}

function daily(app, uid) {
  ensureWallet(app, uid);
  const day = wir.berlinDayKey(Date.now(), 0);
  const r = book(app, { user: uid, amount: EARN.daily.amount, reason: 'daily', label: EARN.daily.label, ref: day, key: `daily:${uid}:${day}` });
  return { credited: r.ok, amount: r.ok ? EARN.daily.amount : 0, balance: r.balance };
}

function me(app, uid) {
  const w = ensureWallet(app, uid);
  const today = {};
  for (const k of ['love', 'openwhen', 'photo']) today[k] = countToday(app, uid, k);
  return {
    balance: app.findRecordById('coin_wallets', w.id).getInt('balance'),
    today,
    rules: Object.fromEntries(Object.entries(EARN).map(([k, v]) => [k, { amount: v.amount, max: v.max || 0, minLen: v.minLen || 0 }])),
  };
}

module.exports = { START, EARN, ensureWallet, book, earn, daily, me, countToday, berlinMidnightPb };
