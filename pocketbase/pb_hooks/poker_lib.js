// Poker-Tische für wir_poker.pb.js. Regeln in poker.js. Nur Spielgeld: Einkauf (Buy-in) und Auszahlung laufen über
// coins.book() mit Grund "poker" und zählen zum Casino-Tageslimit (casino_lib.js). Mischen mit sicherem Zufall,
// verdeckte Karten nur im versteckten Feld state; der Client bekommt seine eigenen Karten nur über GET /api/poker/{id}.

const coins = require(`${__hooks}/coins_lib.js`);
const casino = require(`${__hooks}/casino_lib.js`);
const wir = require(`${__hooks}/wir_lib.js`);
const P = require(`${__hooks}/poker.js`);

const CONF = { buyin: { min: 50, max: 200 }, sb: 5, bb: 10, botChips: 200 };
const BOTS = [
  { name: 'Mimi 🐱', style: 'tight' },
  { name: 'Bruno 🐻', style: 'loose' },
  { name: 'Foxi 🦊', style: 'fox' },
];

const rnd = n => casino.rnd(n);
const nameOf = (app, id) => { try { return app.findRecordById('users', id).getString('name') || 'Schatz'; } catch (_) { return 'Schatz'; } };
const conflict = m => new ApiError(409, m || 'Der Tisch hat sich inzwischen geändert.');
function readJson(rec, f) { try { const t = rec.getString(f); return t ? JSON.parse(t) : null; } catch (_) { return null; } }

function buyinAmount(app, uid, want) {
  const left = casino.lossLeft(app, uid);
  const bal = coins.ensureWallet(app, uid) && app.findRecordById('coin_wallets', coins.ensureWallet(app, uid).id).getInt('balance');
  const amt = Math.min(CONF.buyin.max, Math.max(CONF.buyin.min, Math.floor(Number(want) || CONF.buyin.max)), left, bal);
  if (amt < CONF.buyin.min) throw new ApiError(400, left < CONF.buyin.min ? 'Casino-Tageslimit erreicht – morgen geht’s weiter 💗' : 'Zu wenig Heart Coins für einen Platz (mind. 50)');
  return amt;
}

// öffentlicher Stand (für alle am Tisch gleich) + persönliche Sicht (eigene Karten, erlaubte Aktionen)
function pubOf(rec, s) {
  return {
    mode: rec.getString('mode'), status: rec.getString('status'), v: rec.getInt('v'),
    hand: s.hand, street: s.street, board: s.board, pot: P.pot(s), curBet: s.curBet, button: s.button, turn: s.turn, sb: s.sb, bb: s.bb,
    seats: s.seats.map((p, i) => ({ id: p.id, name: p.name, bot: p.bot ? P.STYLES[p.bot.style]?.name || '' : '', chips: p.chips, bet: p.bet, folded: p.folded, allin: p.allin, out: p.out, cards: p.hole.length,
      shown: s.street === 'showdown' && s.result && s.result.shown[i] ? s.result.shown[i] : null })),
    result: s.street === 'showdown' ? s.result : null, log: s.log.slice(-8),
  };
}
function viewFor(rec, uid) {
  const s = readJson(rec, 'state');
  const pub = rec.getString('status') === 'waiting' ? readJson(rec, 'pub') : pubOf(rec, s);
  const me = s ? s.seats.findIndex(p => p.id === uid) : -1;
  return Object.assign({ id: rec.id, p1: rec.getString('p1'), p2: rec.getString('p2'), buyin: rec.getInt('buyin') }, pub, {
    me, hole: me >= 0 && s ? s.seats[me].hole : [], legal: me >= 0 && s ? P.legal(s, me) : null,
  });
}

function store(app, rec, s) {
  rec.set('state', s);
  rec.set('pub', pubOf(rec, s));
  rec.set('v', rec.getInt('v') + 1);
  app.save(rec);
}

// KI spielt, bis ein Mensch dran ist oder die Hand vorbei ist
function runBots(s) {
  let guard = 0;
  while (s.turn >= 0 && s.seats[s.turn].bot && guard++ < 60) P.act(s, s.turn, P.botDecide(s, s.turn, rnd));
}

function current(app, uid) {
  const rows = app.findRecordsByFilter('poker_tables', "(p1 = {:u} || p2 = {:u}) && status != 'done'", '-created', 10, 0, { u: uid });
  const out = { limits: { lossLeft: casino.lossLeft(app, uid), buyin: CONF.buyin, sb: CONF.sb, bb: CONF.bb } };
  for (const r of rows) { const k = r.getString('mode'); if (!out[k]) out[k] = viewFor(r, uid); }
  return out;
}

function newTable(app, uid, body) {
  const mode = body.mode === 'duo' ? 'duo' : 'ai';
  let rec;
  app.runInTransaction((tx) => {
    const open = tx.findRecordsByFilter('poker_tables', "(p1 = {:u} || p2 = {:u}) && status != 'done' && mode = {:m}", '', 1, 0, { u: uid, m: mode });
    if (open.length) throw conflict('Da läuft schon ein Tisch.');
    if (mode === 'duo') {
      const other = tx.findRecordsByFilter('poker_tables', "mode = 'duo' && status != 'done'", '', 1, 0);
      if (other.length) throw conflict('Ihr habt schon einen Tisch.');
    }
    const amt = buyinAmount(tx, uid, body.buyin);
    rec = new Record(tx.findCollectionByNameOrId('poker_tables'));
    rec.set('mode', mode); rec.set('p1', uid); rec.set('buyin', amt); rec.set('v', 0);
    if (mode === 'duo') {
      const partner = wir.partnerOf(tx, uid);
      rec.set('p2', partner.id); rec.set('status', 'waiting');
      rec.set('pub', { mode, status: 'waiting', host: uid, hostChips: amt, seats: [] });
      tx.save(rec);
    } else {
      const n = Math.max(1, Math.min(3, Math.floor(Number(body.bots) || 2)));
      const players = [{ id: uid, name: nameOf(tx, uid), chips: amt }, ...BOTS.slice(0, n).map((b, i) => ({ id: 'bot' + i, name: b.name, chips: CONF.botChips, bot: { style: b.style } }))];
      const s = P.newState(players, { sb: CONF.sb, bb: CONF.bb });
      rec.set('status', 'playing');
      tx.save(rec);
      P.newHand(s, rnd); runBots(s);
      store(tx, rec, s);
    }
    coins.book(tx, { user: uid, amount: -amt, reason: 'poker', label: `♠️ Poker: Platz genommen (${amt})`, ref: rec.id, key: `poker:${rec.id}:in:${uid}` });
  });
  if (mode === 'duo') require(`${__hooks}/spiele_lib.js`).push(app, rec.getString('p2'), 'poker', `♠️ ${nameOf(app, uid)} lädt dich zum Poker ein`, `Heads-up – nimm Platz (Buy-in bis ${CONF.buyin.max} Coins)`);
  return viewFor(app.findRecordById('poker_tables', rec.id), uid);
}

function load(tx, id, uid) {
  let rec;
  try { rec = tx.findRecordById('poker_tables', id); } catch (_) { throw new NotFoundError('Tisch nicht gefunden'); }
  if (rec.getString('p1') !== uid && rec.getString('p2') !== uid) throw new ForbiddenError('Nicht dein Tisch');
  return rec;
}

function join(app, uid, id, body) {
  let rec;
  app.runInTransaction((tx) => {
    rec = load(tx, id, uid);
    if (rec.getString('mode') !== 'duo' || rec.getString('status') !== 'waiting' || rec.getString('p2') !== uid) throw conflict('Hier kannst du nicht Platz nehmen.');
    const amt = buyinAmount(tx, uid, body.buyin);
    const host = rec.getString('p1');
    const s = P.newState([{ id: host, name: nameOf(tx, host), chips: rec.getInt('buyin') }, { id: uid, name: nameOf(tx, uid), chips: amt }], { sb: CONF.sb, bb: CONF.bb });
    rec.set('status', 'playing');
    P.newHand(s, rnd);
    store(tx, rec, s);
    coins.book(tx, { user: uid, amount: -amt, reason: 'poker', label: `♠️ Poker: Platz genommen (${amt})`, ref: rec.id, key: `poker:${rec.id}:in:${uid}` });
  });
  notifyTurn(app, rec, uid);
  return viewFor(app.findRecordById('poker_tables', rec.id), uid);
}

function notifyTurn(app, rec, uid) {
  if (rec.getString('mode') !== 'duo' || rec.getString('status') !== 'playing') return;
  const s = readJson(rec, 'state');
  const lib = require(`${__hooks}/spiele_lib.js`);
  const other = rec.getString('p1') === uid ? rec.getString('p2') : rec.getString('p1');
  const oi = s.seats.findIndex(p => p.id === other);
  if (s.turn === oi) lib.push(app, other, 'poker', '♠️ Poker: Du bist dran', s.log[s.log.length - 1] || '');
  else if (s.street === 'showdown' && s.result) lib.push(app, other, 'poker', '♠️ Poker: Hand vorbei', s.result.text);
}

function act(app, uid, id, body) {
  let rec;
  app.runInTransaction((tx) => {
    rec = load(tx, id, uid);
    if (rec.getString('status') !== 'playing') throw conflict('Der Tisch ist nicht aktiv.');
    if (Number(body.v) !== rec.getInt('v')) throw conflict();
    const s = readJson(rec, 'state');
    const me = s.seats.findIndex(p => p.id === uid);
    try { P.act(s, me, { type: String(body.type || ''), to: body.to }); } catch (err) { throw new BadRequestError(String(err.message || err)); }
    runBots(s);
    store(tx, rec, s);
  });
  notifyTurn(app, rec, uid);
  return viewFor(app.findRecordById('poker_tables', rec.id), uid);
}

// nächste Hand (nach dem Showdown); ist nur noch eine Person mit Chips übrig -> Tisch beenden und auszahlen
function next(app, uid, id, body) {
  let rec, ended = false;
  app.runInTransaction((tx) => {
    rec = load(tx, id, uid);
    if (rec.getString('status') !== 'playing') throw conflict('Der Tisch ist nicht aktiv.');
    if (Number(body.v) !== rec.getInt('v')) throw conflict();
    const s = readJson(rec, 'state');
    if (s.street !== 'showdown') throw conflict('Die Hand läuft noch.');
    const humanBust = s.seats.some(p => !p.bot && p.chips <= 0);
    if (humanBust || !P.newHand(s, rnd)) { ended = true; return cashOut(tx, rec, s); }
    runBots(s);
    store(tx, rec, s);
  });
  if (!ended) notifyTurn(app, rec, uid);
  return viewFor(app.findRecordById('poker_tables', rec.id), uid);
}

// Auszahlen (Chips 1:1 zurück in Coins) und Tisch schließen
function cashOut(tx, rec, s) {
  for (const p of s.seats) if (!p.bot && p.chips > 0) {
    coins.book(tx, { user: p.id, amount: p.chips, reason: 'poker', label: `♠️ Poker: ausgezahlt (${p.chips})`, ref: rec.id, key: `poker:${rec.id}:out:${p.id}` });
  }
  for (const p of s.seats) if (!p.bot) {
    const buy = rec.getString('p1') === p.id || rec.getString('mode') === 'ai' ? rec.getInt('buyin') : 0;
    require(`${__hooks}/activity_lib.js`).log(tx, p.id, 'game', 'poker', `Poker ${rec.getString('mode') === 'duo' ? 'zu zweit' : 'gegen KI'} beendet – ${p.chips} Chips ausgezahlt${buy ? ` (Einsatz ${buy})` : ''}`);
  }
  rec.set('status', 'done');
  store(tx, rec, s);
}

// Aufstehen: laufende Hand gilt als gepasst (Einsätze bleiben im Pot und gehen an die anderen), dann auszahlen
function leave(app, uid, id) {
  let rec;
  app.runInTransaction((tx) => {
    rec = load(tx, id, uid);
    const st = rec.getString('status');
    if (st === 'done') return;
    if (st === 'waiting') {
      coins.book(tx, { user: rec.getString('p1'), amount: rec.getInt('buyin'), reason: 'poker', label: '♠️ Poker: Einladung zurückgezogen', ref: rec.id, key: `poker:${rec.id}:out:${rec.getString('p1')}` });
      rec.set('status', 'done'); tx.save(rec); return;
    }
    const s = readJson(rec, 'state');
    if (['preflop', 'flop', 'turn', 'river'].includes(s.street)) {
      const me = s.seats.findIndex(p => p.id === uid);
      // alle Einsätze der laufenden Hand an den/die Übrigen (wie Aufgeben)
      const others = s.seats.filter((p, i) => i !== me && !p.out && !p.folded);
      const potNow = P.pot(s);
      if (others.length) { const share = Math.floor(potNow / others.length); others.forEach((p, k) => { p.chips += share + (k === 0 ? potNow - share * others.length : 0); }); }
      for (const p of s.seats) { p.bet = 0; p.total = 0; }
      s.street = 'showdown'; s.turn = -1;
      s.result = { winners: [], shown: {}, text: `${s.seats[me].name} ist aufgestanden` };
    }
    cashOut(tx, rec, s);
  });
  if (rec.getString('mode') === 'duo') {
    const other = rec.getString('p1') === uid ? rec.getString('p2') : rec.getString('p1');
    require(`${__hooks}/spiele_lib.js`).push(app, other, 'poker', '♠️ Poker beendet', `${nameOf(app, uid)} ist aufgestanden – deine Chips sind ausgezahlt`);
  }
  return { ok: true };
}

module.exports = { current, newTable, join, act, next, leave, viewFor, CONF };
