// Solitär (Klondike): 1 oder 3 Karten ziehen, Ziehen & Ablegen oder Antippen (legt automatisch ab), Rückgängig, Zeit,
// Punkte, Rangliste. Die Partie (Seed fürs Mischen) gibt der Server aus (/api/games/solitaire/new); gespielt wird im
// Browser, der Stand bleibt im localStorage. Gewinn meldet /api/games/solitaire/{id}/finish (Punkte, Coins, Log, Push).
// Tipp (nächster sinnvoller Zug) kostet Coins (/api/shop/tip). Karten liegen absolut im Brett, Bewegungen per CSS-Transition.
(() => {
  const pb = window.WIR_PB;
  const $ = id => document.getElementById(id);
  const myId = () => (pb.authStore.record || pb.authStore.model)?.id;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const post = (path, body = {}) => pb.send(path, { method: 'POST', body });
  const fmtTime = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const SUITS = ['♠', '♥', '♦', '♣'];
  const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'B', 'D', 'K'];
  const suit = id => Math.floor(id / 13), rank = id => id % 13 + 1, red = id => suit(id) === 1 || suit(id) === 2;
  const key = () => 'wir-sol-' + myId();

  let g = null;          // { id, draw, seed, st, secs, moves, won }
  let undo = [];
  let draw = 1;
  try { draw = +localStorage.getItem('wir-sol-draw') === 3 ? 3 : 1; } catch (_) {}
  const board = $('solBoard');
  const cards = [];      // DOM-Elemente pro Karten-ID
  let L = { cw: 48, ch: 68, gap: 6, top: 80 };
  let hintIds = [];

  // ======================================================================
  // Mischen (mit dem Seed vom Server) + Austeilen
  // ======================================================================
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function deal(seed) {
    const deck = [...Array(52).keys()], r = rng(seed);
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    const tab = [];
    for (let c = 0; c < 7; c++) { tab.push([]); for (let k = 0; k <= c; k++) tab[c].push({ id: deck.pop(), up: k === c }); }
    return { stock: deck, waste: [], found: [[], [], [], []], tab };
  }
  const clone = st => JSON.parse(JSON.stringify(st));
  function save() { try { if (g) localStorage.setItem(key(), JSON.stringify(g)); else localStorage.removeItem(key()); } catch (_) {} }

  // ======================================================================
  // Regeln
  // ======================================================================
  const canFound = (id, pile) => pile.length ? suit(pile[pile.length - 1]) === suit(id) && rank(pile[pile.length - 1]) + 1 === rank(id) : rank(id) === 1;
  const canTab = (id, pile) => { const t = pile[pile.length - 1]; return t ? t.up && red(t.id) !== red(id) && rank(t.id) === rank(id) + 1 : rank(id) === 13; };
  const foundFor = (st, id) => st.found.findIndex(p => canFound(id, p));

  // Wo liegt eine Karte? { zone: 'waste'|'found'|'tab', pile, index }
  function where(st, id) {
    if (st.waste.length && st.waste[st.waste.length - 1] === id) return { zone: 'waste', index: st.waste.length - 1 };
    for (let f = 0; f < 4; f++) if (st.found[f][st.found[f].length - 1] === id) return { zone: 'found', pile: f };
    for (let c = 0; c < 7; c++) { const i = st.tab[c].findIndex(x => x.id === id); if (i >= 0) return st.tab[c][i].up ? { zone: 'tab', pile: c, index: i } : null; }
    return null;
  }
  function takeFrom(st, w) {
    if (w.zone === 'waste') return [st.waste.pop()];
    if (w.zone === 'found') return [st.found[w.pile].pop()];
    return st.tab[w.pile].splice(w.index).map(x => x.id);
  }
  function flipTops(st) { for (const p of st.tab) { const t = p[p.length - 1]; if (t && !t.up) t.up = true; } }

  // Zug versuchen: Ziel { zone: 'found'|'tab', pile }
  function tryMove(id, to) {
    const st = g.st, w = where(st, id);
    if (!w) return false;
    const n = w.zone === 'tab' ? st.tab[w.pile].length - w.index : 1;
    if (to.zone === 'found') { if (n !== 1 || !canFound(id, st.found[to.pile])) return false; }
    else { if ((w.zone === 'tab' && w.pile === to.pile) || !canTab(id, st.tab[to.pile])) return false; }
    snap();
    const moved = takeFrom(st, w);
    if (to.zone === 'found') st.found[to.pile].push(moved[0]);
    else st.tab[to.pile].push(...moved.map(x => ({ id: x, up: true })));
    flipTops(st);
    afterMove();
    return true;
  }
  // Antippen: Foundation, sonst bester Platz im Tableau
  function autoMove(id) {
    const st = g.st, w = where(st, id);
    if (!w) return false;
    const single = w.zone !== 'tab' || w.index === st.tab[w.pile].length - 1;
    if (single && w.zone !== 'found') { const f = foundFor(st, id); if (f >= 0) return tryMove(id, { zone: 'found', pile: f }); }
    const order = [...Array(7).keys()].filter(c => !(w.zone === 'tab' && c === w.pile));
    const filled = order.filter(c => st.tab[c].length), empty = order.filter(c => !st.tab[c].length);
    // König nicht sinnlos von leer zu leer schieben
    const kingFromEmptyBase = w.zone === 'tab' && w.index === 0 && rank(id) === 13;
    for (const c of [...filled, ...(kingFromEmptyBase ? [] : empty)]) if (tryMove(id, { zone: 'tab', pile: c })) return true;
    return false;
  }
  function drawStock() {
    const st = g.st;
    if (!st.stock.length && !st.waste.length) return;
    snap();
    if (!st.stock.length) { st.stock = st.waste.reverse(); st.waste = []; }
    else for (let k = 0; k < g.draw && st.stock.length; k++) st.waste.push(st.stock.pop());
    afterMove();
  }
  function snap() { undo.push({ st: clone(g.st), moves: g.moves }); if (undo.length > 120) undo.shift(); }
  function afterMove() {
    g.moves++;
    hintIds = [];
    save();
    layout();
    renderBar();
    if (g.st.found.every(p => p.length === 13)) won();
  }

  // ======================================================================
  // Tipp: nächster sinnvoller Zug (oder „kein Zug möglich“)
  // ======================================================================
  function findHint(st) {
    const tops = [];
    if (st.waste.length) tops.push(st.waste[st.waste.length - 1]);
    st.tab.forEach(p => { if (p.length) tops.push(p[p.length - 1].id); });
    for (const id of tops) { const f = foundFor(st, id); if (f >= 0) return { ids: [id], text: `${name(id)} auf den Ablagestapel` }; }
    // Tableau-Stapel, der eine verdeckte Karte aufdeckt oder einen König auf ein leeres Feld bringt
    for (let c = 0; c < 7; c++) {
      const p = st.tab[c], i = p.findIndex(x => x.up);
      if (i < 0) continue;
      const id = p[i].id;
      if (i === 0 && rank(id) === 13) continue;
      for (let d = 0; d < 7; d++) if (d !== c && canTab(id, st.tab[d]) && (i > 0 || st.tab[d].length)) return { ids: [id], text: `${name(id)} umlegen` };
    }
    if (st.waste.length) { const id = st.waste[st.waste.length - 1]; for (let d = 0; d < 7; d++) if (canTab(id, st.tab[d])) return { ids: [id], text: `${name(id)} ins Spielfeld` }; }
    if (st.stock.length || st.waste.length) return { ids: [], stock: true, text: 'Eine Karte vom Stapel ziehen' };
    return { ids: [], text: 'Kein Zug möglich 😕' };
  }
  const name = id => RANKS[rank(id)] + SUITS[suit(id)];

  // ======================================================================
  // Darstellung
  // ======================================================================
  function cardEl(id) {
    if (cards[id]) return cards[id];
    const c = el('div', 'sol-card' + (red(id) ? ' red' : ''));
    c.dataset.id = id;
    const f = el('div', 'sc-face');
    const corner = el('span', 'sc-corner');
    corner.append(el('b', '', RANKS[rank(id)]), el('i', '', SUITS[suit(id)]));
    f.append(corner, el('span', 'sc-suit', SUITS[suit(id)]));
    c.append(f, el('div', 'sc-back'));
    board.append(c);
    return (cards[id] = c);
  }

  function measure() {
    const w = board.clientWidth || 360;
    const gap = w < 340 ? 4 : 6;
    const cw = Math.floor((w - gap * 6) / 7);
    L = { cw, ch: Math.round(cw * 1.42), gap, top: Math.round(cw * 1.42) + 14 };
    board.style.setProperty('--cw', cw + 'px');
    board.style.setProperty('--ch', L.ch + 'px');
  }
  const colX = c => c * (L.cw + L.gap);

  function place(id, x, y, z, up, extra = '') {
    const c = cardEl(id);
    c.classList.toggle('up', up);
    c.classList.toggle('hint', hintIds.includes(id));
    c.style.zIndex = z;
    if (!c.classList.contains('dragging')) c.style.transform = `translate(${x}px,${y}px)`;
    c.dataset.zone = extra;
  }

  function layout() {
    if (!g) return;
    measure();
    const st = g.st;
    let z = 1;
    st.stock.forEach((id, i) => place(id, 0, -Math.min(i, 4) * 0.5, z++, false, 'stock'));
    const fanN = g.draw === 3 ? Math.min(3, st.waste.length) : 1;
    st.waste.forEach((id, i) => {
      const k = i - (st.waste.length - fanN);
      place(id, colX(1) + Math.max(0, k) * Math.round(L.cw * 0.28), 0, z++, true, 'waste');
    });
    st.found.forEach((p, f) => p.forEach(id => place(id, colX(3 + f), 0, z++, true, 'found')));
    // Spalten bei Bedarf stauchen, damit alles aufs Brett passt
    const maxH = Math.max(window.innerHeight - 330, L.ch * 3);
    let maxY = 0;
    st.tab.forEach((p, c) => {
      const down = p.filter(x => !x.up).length, up = p.length - down;
      let dDown = Math.round(L.ch * 0.16), dUp = Math.round(L.ch * 0.3);
      const need = down * dDown + Math.max(0, up - 1) * dUp;
      if (need > maxH - L.ch) { const s = (maxH - L.ch) / need; dDown = Math.max(4, dDown * s); dUp = Math.max(12, dUp * s); }
      let y = L.top;
      p.forEach(x => { place(x.id, colX(c), y, z++, x.up, 'tab'); y += x.up ? dUp : dDown; });
      maxY = Math.max(maxY, y);
    });
    board.style.height = Math.max(L.top + L.ch * 2.4, maxY + L.ch - 10) + 'px';
    // Platzhalter
    $('solSlots').replaceChildren(
      slot(0, 0, st.stock.length ? '' : (st.waste.length ? '↻' : '')),
      ...[0, 1, 2, 3].map(f => slot(colX(3 + f), 0, '', 'found')),
      ...[0, 1, 2, 3, 4, 5, 6].map(c => slot(colX(c), L.top, '', 'tab')),
    );
    $('solSlots').firstChild.classList.add('stock');
    $('solSlots').firstChild.classList.toggle('hint', hintStock);
  }
  function slot(x, y, text, cls = '') {
    const s = el('div', 'sol-slot ' + cls, text);
    s.style.transform = `translate(${x}px,${y}px)`;
    return s;
  }
  let hintStock = false;

  function renderBar() {
    $('solTime').textContent = '⏱ ' + fmtTime(g?.secs || 0);
    $('solMoves').textContent = `Züge ${g?.moves || 0}`;
    $('solDrawInfo').textContent = g ? `${g.draw === 3 ? '3 Karten' : '1 Karte'}` : '';
    $('solUndo').disabled = !undo.length;
    const st = g?.st;
    $('solAuto').hidden = !st || st.stock.length || st.waste.length || st.tab.some(p => p.some(x => !x.up)) || st.found.every(p => p.length === 13);
    $('solTip').querySelector('small').textContent = `Tipp · ${window.WIR_SHOP?.tipPrice('solitaire') ?? 5}`;
  }

  function render() {
    $('solStart').hidden = !!g;
    $('solGame').hidden = !g;
    document.querySelectorAll('#solDraw [data-draw]').forEach(b => b.classList.toggle('on', +b.dataset.draw === draw));
    if (!g) return;
    for (const c of cards) c?.remove();
    cards.length = 0;
    layout();
    renderBar();
  }

  // ======================================================================
  // Eingabe: Antippen + Ziehen
  // ======================================================================
  let drag = null;
  board.addEventListener('pointerdown', e => {
    if (!g || g.won) return;
    const c = e.target.closest('.sol-card');
    if (!c) {
      if (e.target.closest('.sol-slot.stock')) drawStock();
      return;
    }
    const id = +c.dataset.id;
    if (c.dataset.zone === 'stock') { drawStock(); return; }
    const w = where(g.st, id);
    if (!w) return;
    e.preventDefault();
    const ids = w.zone === 'tab' ? g.st.tab[w.pile].slice(w.index).map(x => x.id) : [id];
    const els = ids.map(x => cards[x]);
    const base = els.map(x => { const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(x.style.transform) || [0, 0, 0]; return [+m[1], +m[2]]; });
    drag = { id, ids, els, base, sx: e.clientX, sy: e.clientY, moved: false, pid: e.pointerId };
    try { board.setPointerCapture(e.pointerId); } catch (_) {}
  });
  board.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    if (!drag.moved) { drag.moved = true; drag.els.forEach((x, i) => { x.classList.add('dragging'); x.style.zIndex = 500 + i; }); }
    drag.els.forEach((x, i) => { x.style.transform = `translate(${drag.base[i][0] + dx}px,${drag.base[i][1] + dy}px) scale(1.04)`; });
  });
  function endDrag(e) {
    if (!drag) return;
    const d = drag; drag = null;
    d.els.forEach(x => x.classList.remove('dragging'));
    if (!d.moved) { if (!autoMove(d.id)) { UI.shake(cards[d.id]); layout(); } return; }
    // Ziel unter der Mitte der gezogenen Karte
    const r = board.getBoundingClientRect();
    const cx = d.base[0][0] + (e.clientX - d.sx) + L.cw / 2, cy = d.base[0][1] + (e.clientY - d.sy) + L.ch / 2;
    const col = Math.max(0, Math.min(6, Math.floor((cx + L.gap / 2) / (L.cw + L.gap))));
    let ok = false;
    if (cy < L.top - 4 && col >= 3) ok = tryMove(d.id, { zone: 'found', pile: col - 3 });
    else if (cy >= L.top - L.ch / 2) ok = tryMove(d.id, { zone: 'tab', pile: col });
    void r;
    if (!ok) layout();
  }
  board.addEventListener('pointerup', endDrag);
  board.addEventListener('pointercancel', () => { if (drag) { drag.els.forEach(x => x.classList.remove('dragging')); drag = null; layout(); } });
  board.addEventListener('contextmenu', e => e.preventDefault());

  $('solUndo').addEventListener('click', () => {
    const u = undo.pop();
    if (!u || !g) return;
    g.st = u.st; g.moves = u.moves + 1; // Rückgängig zählt als Zug
    hintIds = []; hintStock = false;
    save(); layout(); renderBar();
  });

  // alles Aufgedeckte nacheinander ablegen
  $('solAuto').addEventListener('click', async () => {
    for (let guard = 0; guard < 60 && g && !g.won; guard++) {
      const st = g.st;
      let done = false;
      for (const p of st.tab) { const t = p[p.length - 1]; if (t) { const f = foundFor(st, t.id); if (f >= 0) { tryMove(t.id, { zone: 'found', pile: f }); done = true; break; } } }
      if (!done) break;
      await UI.wait(110);
    }
  });

  $('solTip').addEventListener('click', async () => {
    if (!g || g.won) return;
    const r = await window.WIR_SHOP?.buyTip('solitaire', g.id);
    if (!r) return;
    const h = findHint(g.st);
    hintIds = h.ids; hintStock = !!h.stock;
    layout();
    $('solMsg').textContent = '💡 ' + h.text;
    g.hints = (g.hints || 0) + 1; save();
  });

  // ======================================================================
  // Partie: neu, Zeit, Gewinn
  // ======================================================================
  async function newGame() {
    if (g && !g.won && g.moves && !confirm('Diese Partie abbrechen und neu mischen?')) return;
    $('solMsg').textContent = '';
    try {
      const r = await post('/api/games/solitaire/new', { draw });
      g = { id: r.id, draw: r.draw, seed: r.seed, st: deal(r.seed), secs: 0, moves: 0, won: false, hints: 0 };
      undo = []; hintIds = []; hintStock = false;
      save(); render();
    } catch (err) { $('solMsg').textContent = 'Ging nicht: ' + UI.errText(err); }
  }
  document.querySelectorAll('#solDraw [data-draw]').forEach(b => b.addEventListener('click', () => {
    draw = +b.dataset.draw;
    try { localStorage.setItem('wir-sol-draw', draw); } catch (_) {}
    render();
  }));
  $('solStartBtn').addEventListener('click', newGame);
  $('solNewBtn').addEventListener('click', () => { g = g?.won ? null : g; if (!g) render(); else newGame(); });

  async function won() {
    if (!g || g.won) return;
    g.won = true; save();
    try {
      const r = await post(`/api/games/solitaire/${g.id}/finish`, { seconds: g.secs, moves: g.moves });
      $('solDonePts').textContent = `+${r.game.points} Punkte`;
      $('solDoneText').textContent = `${g.draw === 3 ? '3 Karten' : '1 Karte'} in ${fmtTime(r.game.seconds)} min · ${g.moves} Züge` + (r.game.hints ? ' · 💡' : '') + (r.coins ? ` · +${r.coins} Coins` : '');
      UI.sheet('solDoneSheet');
      UI.burst(window.innerWidth / 2, window.innerHeight / 2, 30);
      g = null; save();
      loadRank().catch(() => {});
    } catch (err) { $('solMsg').textContent = 'Gewinn speichern ging nicht: ' + UI.errText(err); g.won = false; save(); }
  }

  setInterval(() => {
    if (!g || g.won || document.hidden || !$('s-solitaire').classList.contains('active')) return;
    g.secs++;
    $('solTime').textContent = '⏱ ' + fmtTime(g.secs);
    if (g.secs % 5 === 0) save();
  }, 1000);
  window.addEventListener('resize', () => { if (g && $('s-solitaire').classList.contains('active')) layout(); });

  // ======================================================================
  // Rangliste (beide)
  // ======================================================================
  let ranking = [], users = [];
  async function loadRank() {
    [ranking, users] = await Promise.all([
      pb.collection('solitaire_games').getFullList({ filter: 'status = "won"', sort: '-created' }),
      pb.collection('users').getFullList({ fields: 'id,name' }),
    ]);
    const box = $('solRank');
    box.replaceChildren(...users.map(u => {
      const mine = ranking.filter(x => x.user === u.id);
      const best = d => { const l = mine.filter(x => x.draw === d); return l.length ? fmtTime(Math.min(...l.map(x => x.seconds))) : '–'; };
      const row = el('div', 'ledger-row');
      const t = el('div', 'lr-text');
      t.append(el('span', '', u.id === myId() ? 'Du' : u.name),
        el('small', '', `${mine.length}× gelöst · Bestzeit 1 Karte ${best(1)} · 3 Karten ${best(3)}` + (mine.some(x => x.hints) ? ` · ${mine.filter(x => x.hints).length}× mit 💡` : '')));
      row.append(t, el('b', 'lr-amt plus', String(mine.reduce((s, x) => s + x.points, 0))));
      return row;
    }));
    window.WIR_BADGE?.('gbSolitaire', g ? 'Läuft' : 'Neu', g ? 'run' : 'new');
    $('gcSolitaireStatus').textContent = g ? `${g.draw === 3 ? '3 Karten' : '1 Karte'} · ${fmtTime(g.secs)}` : 'Klondike';
  }

  let started = false;
  document.addEventListener('wir:show', e => {
    if (!started) return;
    if (e.detail === 's-solitaire') { $('solMsg').textContent = ''; render(); loadRank().catch(() => {}); }
    if (e.detail === 's-games') loadRank().catch(() => {});
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  document.addEventListener('wir:started', () => {
    started = true;
    try { g = JSON.parse(localStorage.getItem(key()) || 'null'); } catch (_) { g = null; }
    if (g?.won) g = null;
    loadRank().catch(() => {});
  });
})();
