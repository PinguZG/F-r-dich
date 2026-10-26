// Texas Hold'em (No Limit) – reine Spiel-Logik ohne PocketBase, für poker_lib.js (und Tests in Node).
// Karten: "As", "Td", "7c" … (Rang 23456789TJQKA + Farbe s h d c). Zufall wird von außen übergeben (rnd(n) -> 0…n-1).
// Zustand s: { seats:[{id,name,bot,chips,hole,bet,total,folded,allin,acted,out}], button, sb, bb, deck, board, street,
//   turn, curBet, minRaise, hand, result, log }

const RANKS = '23456789TJQKA';
const SUITS = 'shdc';
const HAND_NAMES = ['Höchste Karte', 'Ein Paar', 'Zwei Paare', 'Drilling', 'Straße', 'Flush', 'Full House', 'Vierling', 'Straight Flush'];
const rv = c => RANKS.indexOf(c[0]) + 2;

function freshDeck(rnd) {
  const d = [];
  for (const r of RANKS) for (const s of SUITS) d.push(r + s);
  for (let i = d.length - 1; i > 0; i--) { const j = rnd(i + 1); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}

// ---------- Handbewertung: bestes Blatt aus 5–7 Karten -> [Kategorie, Kicker …] ----------
function evalHand(cards) {
  const cnt = new Array(15).fill(0), bySuit = { s: [], h: [], d: [], c: [] };
  for (const c of cards) { cnt[rv(c)]++; bySuit[c[1]].push(rv(c)); }
  const straightTop = vals => {
    const has = new Array(15).fill(false);
    for (const v of vals) { has[v] = true; if (v === 14) has[1] = true; }
    for (let top = 14; top >= 5; top--) { let ok = true; for (let k = 0; k < 5; k++) if (!has[top - k]) { ok = false; break; } if (ok) return top; }
    return 0;
  };
  for (const s of SUITS) if (bySuit[s].length >= 5) {
    const sf = straightTop(bySuit[s]);
    if (sf) return [8, sf];
  }
  const groups = [];
  for (let v = 14; v >= 2; v--) if (cnt[v]) groups.push([cnt[v], v]);
  groups.sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const singles = n => { const out = []; for (let v = 14; v >= 2 && out.length < n; v--) if (cnt[v] === 1) out.push(v); return out; };
  if (groups[0][0] === 4) { const k = []; for (let v = 14; v >= 2; v--) if (cnt[v] && v !== groups[0][1]) { k.push(v); break; } return [7, groups[0][1], ...k]; }
  if (groups[0][0] === 3 && groups.length > 1 && groups[1][0] >= 2) return [6, groups[0][1], groups[1][1]];
  for (const s of SUITS) if (bySuit[s].length >= 5) return [5, ...bySuit[s].sort((a, b) => b - a).slice(0, 5)];
  const st = straightTop(cards.map(rv));
  if (st) return [4, st];
  if (groups[0][0] === 3) { const k = []; for (let v = 14; v >= 2 && k.length < 2; v--) if (cnt[v] && v !== groups[0][1]) k.push(v); return [3, groups[0][1], ...k]; }
  if (groups[0][0] === 2 && groups[1] && groups[1][0] === 2) {
    const hi = groups[0][1], lo = groups[1][1];
    let k = 0; for (let v = 14; v >= 2; v--) if (cnt[v] && v !== hi && v !== lo) { k = v; break; }
    return [2, hi, lo, k];
  }
  if (groups[0][0] === 2) { const k = []; for (let v = 14; v >= 2 && k.length < 3; v--) if (cnt[v] && v !== groups[0][1]) k.push(v); return [1, groups[0][1], ...k]; }
  return [0, ...singles(5)];
}
function cmp(a, b) { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) return d; } return 0; }
function handName(score) { return score[0] === 8 && score[1] === 14 ? 'Royal Flush' : HAND_NAMES[score[0]]; }

// ---------- Sitze / Reihenfolge ----------
const inHand = s => s.seats.filter(p => !p.out && !p.folded);
const canAct = p => !p.out && !p.folded && !p.allin;
function nextSeat(s, from, pred) {
  for (let k = 1; k <= s.seats.length; k++) { const i = (from + k) % s.seats.length; if (pred(s.seats[i])) return i; }
  return -1;
}
const live = p => !p.out;
const pot = s => s.seats.reduce((a, p) => a + p.total, 0);

function newState(players, opts = {}) {
  return {
    seats: players.map(p => ({ id: p.id, name: p.name, bot: p.bot || null, chips: p.chips, hole: [], bet: 0, total: 0, folded: false, allin: false, acted: false, out: p.chips <= 0 })),
    button: -1, sb: opts.sb || 5, bb: opts.bb || 10, deck: [], board: [], street: 'idle', turn: -1, curBet: 0, minRaise: opts.bb || 10, hand: 0, result: null, log: [],
  };
}

function log(s, m) { s.log.push(m); if (s.log.length > 40) s.log.splice(0, s.log.length - 40); }

function post(s, i, amount) {
  const p = s.seats[i];
  const a = Math.min(amount, p.chips);
  p.chips -= a; p.bet += a; p.total += a;
  if (p.chips === 0) p.allin = true;
  return a;
}

// neue Hand: Blinds, Karten. Gibt false zurück, wenn weniger als 2 Spieler Chips haben (Spiel vorbei)
function newHand(s, rnd) {
  for (const p of s.seats) { if (p.chips <= 0) p.out = true; Object.assign(p, { hole: [], bet: 0, total: 0, folded: false, allin: false, acted: false }); }
  if (s.seats.filter(live).length < 2) { s.street = 'over'; s.turn = -1; return false; }
  s.hand++;
  s.button = nextSeat(s, s.button < 0 ? rnd(s.seats.length) - 1 + s.seats.length : s.button, live);
  s.deck = freshDeck(rnd); s.board = []; s.result = null; s.street = 'preflop';
  const heads = s.seats.filter(live).length === 2;
  const sbI = heads ? s.button : nextSeat(s, s.button, live);
  const bbI = nextSeat(s, sbI, live);
  post(s, sbI, s.sb); post(s, bbI, s.bb);
  for (let r = 0; r < 2; r++) for (let k = 1; k <= s.seats.length; k++) { const p = s.seats[(s.button + k) % s.seats.length]; if (live(p)) p.hole.push(s.deck.pop()); }
  s.curBet = s.bb; s.minRaise = s.bb;
  s.turn = nextSeat(s, bbI, canAct);
  log(s, `Hand ${s.hand}: Blinds ${s.sb}/${s.bb}`);
  if (s.turn < 0 || !needsAction(s)) advance(s);
  return true;
}

// Welche Aktionen hat Sitz i gerade?
function legal(s, i) {
  if (s.turn !== i || !['preflop', 'flop', 'turn', 'river'].includes(s.street)) return null;
  const p = s.seats[i], toCall = s.curBet - p.bet;
  const maxTo = p.bet + p.chips;
  const minTo = Math.min(maxTo, s.curBet + s.minRaise);
  return {
    fold: toCall > 0, check: toCall <= 0, call: toCall > 0 ? Math.min(toCall, p.chips) : 0,
    raise: maxTo > s.curBet && (p.chips > toCall) ? { min: minTo, max: maxTo } : null, toCall,
  };
}

function act(s, i, a) {
  const L = legal(s, i);
  if (!L) throw new Error('Du bist nicht dran');
  const p = s.seats[i];
  const type = a.type;
  if (type === 'fold') { if (!L.fold) throw new Error('Schieben geht hier'); p.folded = true; log(s, `${p.name} passt`); }
  else if (type === 'check') { if (!L.check) throw new Error('Check geht nicht'); log(s, `${p.name} schiebt`); }
  else if (type === 'call') { if (!L.call) throw new Error('Nichts zu bezahlen'); post(s, i, L.call); log(s, `${p.name} geht mit (${L.call})${p.allin ? ' – All-in' : ''}`); }
  else if (type === 'raise') {
    if (!L.raise) throw new Error('Erhöhen geht nicht');
    let to = Math.floor(Number(a.to) || 0);
    to = Math.max(L.raise.min, Math.min(L.raise.max, to));
    const raiseBy = to - s.curBet;
    post(s, i, to - p.bet);
    if (raiseBy >= s.minRaise) s.minRaise = raiseBy; // ein zu kleines All-in eröffnet keine neue Erhöhung
    if (to > s.curBet) { s.curBet = to; for (const q of s.seats) if (q !== p && canAct(q)) q.acted = false; }
    log(s, `${p.name} erhöht auf ${to}${p.allin ? ' – All-in' : ''}`);
  } else throw new Error('Unbekannte Aktion');
  p.acted = true;
  if (inHand(s).length === 1) return winWithoutShowdown(s);
  if (needsAction(s)) { s.turn = nextSeat(s, i, q => canAct(q) && (!q.acted || q.bet < s.curBet)); return; }
  advance(s);
}

// Muss in dieser Setzrunde noch jemand handeln?
function needsAction(s) {
  const actors = s.seats.filter(canAct);
  if (!actors.length) return false;
  if (actors.length === 1) return actors[0].bet < s.curBet; // alle anderen sind all-in oder raus
  return actors.some(q => !q.acted || q.bet < s.curBet);
}

// nächste Straße bzw. Showdown
function advance(s) {
  for (;;) {
    for (const p of s.seats) { p.bet = 0; p.acted = false; }
    s.curBet = 0; s.minRaise = s.bb;
    const next = { preflop: 'flop', flop: 'turn', turn: 'river', river: 'showdown' }[s.street];
    if (next === 'showdown') return showdown(s);
    s.street = next;
    s.deck.pop(); // Brennkarte
    const n = next === 'flop' ? 3 : 1;
    for (let k = 0; k < n; k++) s.board.push(s.deck.pop());
    log(s, `${{ flop: 'Flop', turn: 'Turn', river: 'River' }[next]}: ${s.board.slice(-n).join(' ')}`);
    // noch jemand, der setzen kann? (sonst Board durchlaufen lassen)
    if (s.seats.filter(canAct).length >= 2) { s.turn = nextSeat(s, s.button, canAct); return; }
  }
}

function winWithoutShowdown(s) {
  const w = inHand(s)[0];
  const amount = pot(s);
  w.chips += amount;
  s.result = { winners: [{ seat: s.seats.indexOf(w), amount, hand: '' }], shown: {}, text: `${w.name} gewinnt ${amount} – alle anderen haben gepasst` };
  log(s, s.result.text);
  s.street = 'showdown'; s.turn = -1;
}

// Showdown mit Side-Pots
function showdown(s) {
  s.street = 'showdown'; s.turn = -1;
  const contenders = inHand(s);
  const score = new Map(contenders.map(p => [p, evalHand([...p.hole, ...s.board])]));
  const levels = [...new Set(s.seats.filter(p => p.total > 0).map(p => p.total))].sort((a, b) => a - b);
  const won = new Map();
  let prev = 0;
  for (const lv of levels) {
    let part = 0;
    for (const p of s.seats) part += Math.max(0, Math.min(p.total, lv) - prev);
    const elig = contenders.filter(p => p.total >= lv);
    prev = lv;
    if (!part) continue;
    if (!elig.length) { // nur Gefoldete auf dieser Stufe -> an den, der am meisten eingezahlt hat
      const top = s.seats.filter(p => p.total >= lv)[0];
      won.set(top, (won.get(top) || 0) + part); continue;
    }
    let best = [];
    for (const p of elig) { if (!best.length || cmp(score.get(p), score.get(best[0])) > 0) best = [p]; else if (cmp(score.get(p), score.get(best[0])) === 0) best.push(p); }
    const share = Math.floor(part / best.length);
    let rest = part - share * best.length;
    // Rest an den ersten Gewinner links vom Button
    const order = best.slice().sort((a, b) => ((s.seats.indexOf(a) - s.button + s.seats.length) % s.seats.length) - ((s.seats.indexOf(b) - s.button + s.seats.length) % s.seats.length));
    for (const p of order) { won.set(p, (won.get(p) || 0) + share + (rest > 0 ? 1 : 0)); if (rest > 0) rest--; }
  }
  const winners = [];
  for (const [p, amount] of won) { p.chips += amount; if (score.has(p)) winners.push({ seat: s.seats.indexOf(p), amount, hand: handName(score.get(p)) }); }
  winners.sort((a, b) => b.amount - a.amount);
  const shown = {};
  for (const p of contenders) shown[s.seats.indexOf(p)] = p.hole;
  const names = winners.map(w => `${s.seats[w.seat].name} gewinnt ${w.amount}${w.hand ? ' mit ' + w.hand : ''}`);
  s.result = { winners, shown, text: names.join(' · ') || 'Unentschieden' };
  log(s, s.result.text);
}

// ---------- KI ----------
const STYLES = {
  tight: { name: 'Vorsichtig', margin: 0.07, raiseAt: 0.66, bluff: 0.03, size: 0.6 },
  loose: { name: 'Draufgänger', margin: -0.05, raiseAt: 0.52, bluff: 0.14, size: 1.0 },
  fox: { name: 'Fuchs', margin: 0.0, raiseAt: 0.58, bluff: 0.08, size: 0.8 },
};

// Gewinnchance per Monte-Carlo gegen die noch aktiven Gegner
function equity(s, i, rnd, sims = 90) {
  const me = s.seats[i];
  const opp = inHand(s).length - 1;
  const known = new Set([...me.hole, ...s.board]);
  const rest = [];
  for (const r of RANKS) for (const su of SUITS) if (!known.has(r + su)) rest.push(r + su);
  let win = 0;
  for (let n = 0; n < sims; n++) {
    const d = rest.slice();
    for (let k = d.length - 1; k > d.length - 1 - (opp * 2 + 5 - s.board.length) && k > 0; k--) { const j = rnd(k + 1); [d[k], d[j]] = [d[j], d[k]]; }
    let pos = d.length;
    const board = s.board.slice();
    while (board.length < 5) board.push(d[--pos]);
    const mine = evalHand([...me.hole, ...board]);
    let best = 1;
    for (let o = 0; o < opp; o++) { const c = cmp(evalHand([d[--pos], d[--pos], ...board]), mine); if (c > 0) { best = 0; break; } if (c === 0) best = Math.min(best, 0.5); }
    win += best;
  }
  return win / sims;
}

function botDecide(s, i, rnd) {
  const p = s.seats[i], st = STYLES[p.bot.style] || STYLES.fox;
  const L = legal(s, i);
  const eq = equity(s, i, rnd);
  const potNow = pot(s);
  const odds = L.toCall > 0 ? L.toCall / (potNow + L.toCall) : 0;
  const r = rnd(1000) / 1000;
  const raiseTo = frac => L.raise ? Math.max(L.raise.min, Math.min(L.raise.max, s.curBet + Math.round(potNow * frac / 5) * 5)) : 0;
  if (L.raise && (eq > st.raiseAt || r < st.bluff)) {
    if (eq > 0.85 && r < 0.3) return { type: 'raise', to: L.raise.max };
    return { type: 'raise', to: raiseTo(st.size * (0.6 + r * 0.6)) };
  }
  if (L.check) return { type: 'check' };
  if (eq > odds + st.margin || (L.toCall <= s.bb && eq > 0.25)) return { type: 'call' };
  return { type: 'fold' };
}

module.exports = { newState, newHand, legal, act, evalHand, cmp, handName, botDecide, equity, STYLES, pot, freshDeck };
