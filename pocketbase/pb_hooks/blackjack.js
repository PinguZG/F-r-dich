// Blackjack-Regeln (rein, ohne Datenbank): wird von casino_lib.js geladen, läuft aber auch in Node (Tests).
// Regeln: 6 Decks, jede Runde frisch gemischt. Dealer steht auf allen 17 (auch Soft 17), schaut bei Ass/Zehn
// sofort nach Blackjack. Blackjack zahlt 3:2 (aufgerundet). Verdoppeln auf zwei beliebigen Karten, auch nach dem Teilen
// (außer geteilte Asse). Einmal teilen bei zwei gleichwertigen Karten (z. B. K + D); geteilte Asse bekommen je eine Karte.
// 21 nach dem Teilen ist kein Blackjack. Keine Versicherung, kein Aufgeben.
// Karten: "AS" = Pik-Ass, "TH" = Herz-Zehn … (Rang A23456789TJQK, Farbe S H D C)

const RANKS = 'A23456789TJQK';
const SUITS = 'SHDC';
const DECKS = 6;

// rnd(n) liefert eine ganze Zufallszahl 0 … n-1 (auf dem Server kryptografisch sicher)
function newShoe(rnd) {
  const shoe = [];
  for (let d = 0; d < DECKS; d++) for (const s of SUITS) for (const r of RANKS) shoe.push(r + s);
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    const t = shoe[i]; shoe[i] = shoe[j]; shoe[j] = t;
  }
  return shoe;
}

function cardValue(c) {
  const r = c[0];
  if (r === 'A') return 11;
  if ('TJQK'.indexOf(r) >= 0) return 10;
  return Number(r);
}

function score(cards) {
  let total = 0, aces = 0;
  for (const c of cards) { total += cardValue(c); if (c[0] === 'A') aces++; }
  while (total > 21 && aces) { total -= 10; aces--; }
  return { total, soft: aces > 0 };
}

const isBlackjack = (cards) => cards.length === 2 && score(cards).total === 21;

function deal(bet, rnd) {
  const s = {
    shoe: newShoe(rnd),
    dealer: [],
    hands: [{ cards: [], bet, done: false, doubled: false, fromSplit: false, splitAces: false, result: '', payout: 0 }],
    active: 0,
    phase: 'player',
    v: 1,
  };
  const draw = () => s.shoe.pop();
  s.hands[0].cards.push(draw()); s.dealer.push(draw());
  s.hands[0].cards.push(draw()); s.dealer.push(draw());
  // Blackjack auf einer Seite -> sofort abrechnen (Dealer schaut bei Ass/Zehn nach)
  if (isBlackjack(s.hands[0].cards) || isBlackjack(s.dealer)) {
    s.hands[0].done = true;
    settle(s);
  }
  return s;
}

function hand(s) { return s.hands[s.active]; }

// Was darf die aktive Hand gerade? (Bezahlbarkeit prüft casino_lib)
function allowed(s) {
  if (s.phase !== 'player') return { hit: false, stand: false, double: false, split: false };
  const h = hand(s);
  const two = h.cards.length === 2;
  return {
    hit: true,
    stand: true,
    double: two && !h.splitAces,
    split: two && s.hands.length === 1 && cardValue(h.cards[0]) === cardValue(h.cards[1]),
  };
}

// Eine Aktion. Vorher muss casino_lib einen Mehreinsatz (double/split = noch einmal h.bet) gebucht haben.
function act(s, action) {
  const ok = allowed(s);
  if (!ok[action]) throw new Error('Das geht gerade nicht.');
  const draw = () => s.shoe.pop();
  const h = hand(s);
  if (action === 'hit') {
    h.cards.push(draw());
    if (score(h.cards).total >= 21) h.done = true;
  } else if (action === 'stand') {
    h.done = true;
  } else if (action === 'double') {
    h.bet *= 2;
    h.doubled = true;
    h.cards.push(draw());
    h.done = true;
  } else if (action === 'split') {
    const aces = h.cards[0][0] === 'A';
    const second = { cards: [h.cards.pop()], bet: h.bet, done: false, doubled: false, fromSplit: true, splitAces: aces, result: '', payout: 0 };
    h.fromSplit = true;
    h.splitAces = aces;
    s.hands.push(second);
    for (const x of s.hands) {
      x.cards.push(draw());
      if (aces || score(x.cards).total === 21) x.done = true;
    }
  }
  s.v++;
  while (s.active < s.hands.length && s.hands[s.active].done) s.active++;
  if (s.active >= s.hands.length) { s.active = s.hands.length - 1; settle(s); }
  return s;
}

// Dealer spielt (falls nötig) und alle Hände werden abgerechnet
function settle(s) {
  const draw = () => s.shoe.pop();
  const playerBJ = s.hands.length === 1 && !s.hands[0].fromSplit && isBlackjack(s.hands[0].cards);
  const dealerBJ = isBlackjack(s.dealer);
  const live = s.hands.some(h => score(h.cards).total <= 21);
  if (!dealerBJ && !playerBJ && live) {
    while (score(s.dealer).total < 17) s.dealer.push(draw());
  }
  const d = score(s.dealer).total;
  for (const h of s.hands) {
    const p = score(h.cards).total;
    if (playerBJ && !dealerBJ) { h.result = 'blackjack'; h.payout = h.bet + Math.ceil(h.bet * 1.5); }
    else if (playerBJ && dealerBJ) { h.result = 'push'; h.payout = h.bet; }
    else if (dealerBJ) { h.result = 'lose'; h.payout = 0; }
    else if (p > 21) { h.result = 'bust'; h.payout = 0; }
    else if (d > 21 || p > d) { h.result = 'win'; h.payout = h.bet * 2; }
    else if (p === d) { h.result = 'push'; h.payout = h.bet; }
    else { h.result = 'lose'; h.payout = 0; }
  }
  s.phase = 'done';
  s.v++;
  return s;
}

const totalBet = (s) => s.hands.reduce((a, h) => a + h.bet, 0);
const totalPayout = (s) => s.hands.reduce((a, h) => a + h.payout, 0);

// Was der Client sehen darf: Stapel nie, verdeckte Dealer-Karte erst nach dem Spiel
function view(s) {
  const done = s.phase === 'done';
  const dealer = done ? s.dealer.slice() : [s.dealer[0], '??'];
  return {
    phase: s.phase,
    v: s.v,
    active: s.active,
    dealer,
    dealerScore: done ? score(s.dealer) : score([s.dealer[0]]),
    hands: s.hands.map(h => ({
      cards: h.cards.slice(), bet: h.bet, done: h.done, doubled: h.doubled, fromSplit: h.fromSplit,
      score: score(h.cards), result: h.result, payout: h.payout,
    })),
    allowed: allowed(s),
    bet: totalBet(s),
    payout: done ? totalPayout(s) : 0,
  };
}

module.exports = { RANKS, SUITS, newShoe, score, cardValue, isBlackjack, deal, allowed, act, settle, view, totalBet, totalPayout };
