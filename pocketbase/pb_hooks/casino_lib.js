// Casino für wir_casino.pb.js (wird dort per require() geladen). Nur Spielgeld (Heart Coins), nie echtes Geld.
// Zufall: kryptografisch sicher ($security), Einsätze/Gewinne laufen über coins.book() (Transaktion + Idempotenz-Schlüssel).
// Schutz: Einsatz 5–100 pro Runde, Tageslimit für Verluste (Berliner Tag) über alle Casino-Spiele.

const coins = require(`${__hooks}/coins_lib.js`);
const BJ = require(`${__hooks}/blackjack.js`);

const LIMITS = { min: 5, max: 100, dailyLoss: 300 };
const CASINO_REASONS = ['bj'];

function conflict(msg) { return new ApiError(409, msg || 'Die Runde hat sich inzwischen geändert.'); }

// sichere ganze Zufallszahl 0 … n-1 (ohne Verzerrung durch Verwerfen)
function rnd(n) {
  const RANGE = 4294967296; // 2^32
  const lim = RANGE - (RANGE % n);
  for (;;) {
    const x = parseInt($security.randomStringWithAlphabet(8, '0123456789abcdef'), 16);
    if (x < lim) return x % n;
  }
}

function readJson(rec, field) {
  try { const s = rec.getString(field); return s ? JSON.parse(s) : null; } catch (_) { return null; }
}

// Netto heute im Casino (negativ = Verlust); offene Einsätze zählen schon als Verlust
function netToday(app, uid) {
  const since = coins.berlinMidnightPb(Date.now());
  const rows = app.findRecordsByFilter('coin_ledger',
    'user = {:u} && created >= {:t} && (' + CASINO_REASONS.map((r, i) => `reason = {:r${i}}`).join(' || ') + ')',
    '', 5000, 0, Object.assign({ u: uid, t: since }, ...CASINO_REASONS.map((r, i) => ({ ['r' + i]: r }))));
  return rows.reduce((a, r) => a + r.getInt('amount'), 0);
}

function lossLeft(app, uid) { return Math.max(0, LIMITS.dailyLoss + Math.min(0, netToday(app, uid))); }

function balanceOf(app, uid) {
  const w = coins.ensureWallet(app, uid);
  return app.findRecordById('coin_wallets', w.id).getInt('balance');
}

// Einsatz buchen; prüft Tageslimit (Kontostand prüft book selbst)
function stake(app, uid, amount, key, label, ref) {
  if (lossLeft(app, uid) < amount) {
    throw new ApiError(400, `Tageslimit erreicht: Heute darfst du nur noch ${lossLeft(app, uid)} Coins einsetzen. Morgen geht es weiter.`);
  }
  return coins.book(app, { user: uid, amount: -amount, reason: 'bj', label, ref, key });
}

const RESULT_TEXT = { blackjack: 'Blackjack!', win: 'Gewonnen', push: 'Unentschieden', lose: 'Verloren', bust: 'Überkauft' };

function finish(app, rec, s) {
  const payout = BJ.totalPayout(s), bet = BJ.totalBet(s);
  if (payout > 0) {
    coins.book(app, { user: rec.getString('user'), amount: payout, reason: 'bj', label: payout > bet ? '🃏 Blackjack-Gewinn' : '🃏 Blackjack: Einsatz zurück', ref: rec.id, key: `bj:${rec.id}:payout` });
  }
  rec.set('status', 'done');
  rec.set('payout', payout);
  const texts = s.hands.map(h => RESULT_TEXT[h.result] || h.result);
  rec.set('result', texts.join(' · ') + ` (${payout - bet >= 0 ? '+' : '−'}${Math.abs(payout - bet)})`);
}

function out(app, uid, rec) {
  const s = readJson(rec, 'state');
  return {
    round: rec ? Object.assign({ id: rec.id, status: rec.getString('status'), result: rec.getString('result') }, s ? BJ.view(s) : {}) : null,
    balance: balanceOf(app, uid),
    limits: Object.assign({ lossLeft: lossLeft(app, uid) }, LIMITS),
  };
}

function current(app, uid) {
  const [r] = app.findRecordsByFilter('casino_rounds', "user = {:u} && game = 'blackjack'", '-created', 1, 0, { u: uid });
  if (!r) return { round: null, balance: balanceOf(app, uid), limits: Object.assign({ lossLeft: lossLeft(app, uid) }, LIMITS) };
  return out(app, uid, r);
}

function start(app, uid, body) {
  const bet = Number(body.bet);
  if (!Number.isInteger(bet) || bet < LIMITS.min || bet > LIMITS.max) throw new BadRequestError(`Einsatz zwischen ${LIMITS.min} und ${LIMITS.max} Coins`);
  const ckey = String(body.key || '');
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(ckey)) throw new BadRequestError('key fehlt');

  let rec;
  app.runInTransaction((tx) => {
    // gleiche Anfrage nochmal (Doppeltipp/Wiederholung) -> dieselbe Runde
    try { rec = tx.findFirstRecordByFilter('casino_rounds', 'ckey = {:k}', { k: `${uid}:${ckey}` }); return; } catch (_) { /* neu */ }
    const [open] = tx.findRecordsByFilter('casino_rounds', "user = {:u} && game = 'blackjack' && status = 'active'", '', 1, 0, { u: uid });
    if (open) throw conflict('Es läuft noch eine Runde.');
    rec = new Record(tx.findCollectionByNameOrId('casino_rounds'));
    rec.set('user', uid);
    rec.set('game', 'blackjack');
    rec.set('status', 'active');
    rec.set('bet', bet);
    rec.set('payout', 0);
    rec.set('ckey', `${uid}:${ckey}`);
    tx.save(rec);
    stake(tx, uid, bet, `bj:${rec.id}:bet`, '🃏 Blackjack-Einsatz', rec.id);
    const s = BJ.deal(bet, rnd);
    if (s.phase === 'done') finish(tx, rec, s);
    rec.set('state', s);
    tx.save(rec);
  });
  return out(app, uid, rec);
}

function act(app, uid, id, body) {
  const action = String(body.action || '');
  if (['hit', 'stand', 'double', 'split'].indexOf(action) < 0) throw new BadRequestError('Unbekannte Aktion');
  let rec;
  app.runInTransaction((tx) => {
    try { rec = tx.findRecordById('casino_rounds', id); } catch (_) { throw new NotFoundError('Runde nicht gefunden'); }
    if (rec.getString('user') !== uid) throw new ForbiddenError('Nicht deine Runde');
    if (rec.getString('status') !== 'active') throw conflict('Die Runde ist schon vorbei.');
    const s = readJson(rec, 'state');
    if (body.v != null && Number(body.v) !== s.v) throw conflict();
    if (!BJ.allowed(s)[action]) throw new BadRequestError('Das geht gerade nicht.');
    if (action === 'double' || action === 'split') {
      const extra = s.hands[s.active].bet;
      stake(tx, uid, extra, `bj:${rec.id}:${action}:${s.active}`, action === 'double' ? '🃏 Blackjack: verdoppelt' : '🃏 Blackjack: geteilt', rec.id);
      rec.set('bet', rec.getInt('bet') + extra);
    }
    BJ.act(s, action);
    if (s.phase === 'done') finish(tx, rec, s);
    rec.set('state', s);
    tx.save(rec);
  });
  return out(app, uid, rec);
}

module.exports = { LIMITS, rnd, netToday, lossLeft, current, start, act };
