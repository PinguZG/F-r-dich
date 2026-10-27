// Schach gegen KI: Stockfish 10 (WebAssembly, GPL-3, lib/stockfish/) läuft als Web Worker im Browser und wird erst beim
// ersten Öffnen geladen (der Service Worker cacht ihn danach). 5 Stufen, Farbe wählbar, Partie bleibt beim Schließen
// erhalten (localStorage). Das Ergebnis prüft der Server (/api/games/chessai/result spielt die Zugliste nach) und
// vergibt Coins; Tipps (bester Zug) kosten Coins (/api/shop/tip). Brett-Optik wie beim Duell (games.js).
(() => {
  const pb = window.WIR_PB;
  const $ = id => document.getElementById(id);
  const myId = () => (pb.authStore.record || pb.authStore.model)?.id;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const post = (path, body = {}) => pb.send(path, { method: 'POST', body });
  const FILES = 'abcdefgh';
  const DE = { N: 'S', B: 'L', R: 'T', Q: 'D', K: 'K' };
  const sanDe = san => String(san).replace(/[NBRQK]/g, c => DE[c]);
  const LEVELS = {
    1: { name: 'Anfänger', skill: 0, go: 'depth 1', random: 0.35 },
    2: { name: 'Leicht', skill: 3, go: 'depth 3', random: 0.1 },
    3: { name: 'Mittel', skill: 8, go: 'movetime 400' },
    4: { name: 'Stark', skill: 14, go: 'movetime 800' },
    5: { name: 'Meister', skill: 20, go: 'movetime 1500' },
  };
  const key = () => 'wir-chessai-' + myId();
  let g = null;              // { ref, level, color, moves: [san] }
  let chess = null, sel = null, targets = [], thinking = false, hint = null;
  let level = 3, color = 'w', games = [], users = [];
  try { level = +localStorage.getItem('wir-chessai-level') || 3; } catch (_) {}

  // ======================================================================
  // Stockfish im Web Worker
  // ======================================================================
  let engine = null, engineReady = null, waiting = null;
  function getEngine() {
    if (engineReady) return engineReady;
    engineReady = new Promise((resolve, reject) => {
      try { engine = new Worker('/lib/stockfish/stockfish.js'); } catch (err) { reject(err); return; }
      engine.onmessage = e => {
        const line = String(e.data || '');
        if (line === 'uciok') engine.postMessage('isready');
        else if (line === 'readyok') resolve(engine);
        else if (line.startsWith('bestmove') && waiting) { const w = waiting; waiting = null; w(line.split(' ')[1]); }
      };
      engine.onerror = err => reject(err);
      engine.postMessage('uci');
    });
    return engineReady;
  }
  async function bestMove(fen, skill, go) {
    const e = await getEngine();
    return new Promise(res => {
      waiting = res;
      e.postMessage('ucinewgame');
      e.postMessage(`setoption name Skill Level value ${skill}`);
      e.postMessage('position fen ' + fen);
      e.postMessage('go ' + go);
    });
  }

  // ======================================================================
  // Zustand
  // ======================================================================
  const newRef = () => 'ai' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  function save() { try { if (g) localStorage.setItem(key(), JSON.stringify(g)); else localStorage.removeItem(key()); } catch (_) {} }
  function load() {
    try { g = JSON.parse(localStorage.getItem(key()) || 'null'); } catch (_) { g = null; }
    rebuild();
  }
  function rebuild() {
    chess = new Chess();
    if (g) for (const m of g.moves) chess.move(m);
    sel = null; targets = []; hint = null;
  }
  const over = () => chess && (chess.game_over());
  const myTurn = () => g && !over() && chess.turn() === g.color && !thinking;

  function start() {
    const c = color === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : color;
    g = { ref: newRef(), level, color: c, moves: [] };
    save(); rebuild(); render();
    if (c === 'b') aiMove();
  }

  async function aiMove() {
    if (!g || over()) return finish();
    thinking = true; render();
    const L = LEVELS[g.level];
    let mv = null;
    try {
      const legal = chess.moves({ verbose: true });
      if (L.random && Math.random() < L.random) { const m = legal[Math.floor(Math.random() * legal.length)]; mv = m.from + m.to + (m.promotion || ''); }
      else mv = await bestMove(chess.fen(), L.skill, L.go);
    } catch (err) { $('caMsg').textContent = 'Die KI konnte nicht geladen werden: ' + (err?.message || err); thinking = false; render(); return; }
    await new Promise(r => setTimeout(r, 250));
    const m = mv && chess.move({ from: mv.slice(0, 2), to: mv.slice(2, 4), promotion: mv[4] || 'q' });
    if (m) { g.moves.push(m.san); save(); }
    thinking = false;
    render();
    if (over()) finish();
  }

  function play(from, to, promotion) {
    const m = chess.move({ from, to, promotion });
    if (!m) return;
    g.moves.push(m.san); save();
    sel = null; targets = []; hint = null;
    render();
    if (over()) finish(); else aiMove();
  }

  let finishing = false;
  async function finish(resign) {
    if (!g || finishing) return;
    finishing = true;
    try {
      const r = await post('/api/games/chessai/result', { ref: g.ref, level: g.level, color: g.color, moves: g.moves, resign: !!resign });
      const res = r.game.result;
      $('caMsg').textContent = res === 'win' ? `Gewonnen gegen ${LEVELS[g.level].name}! 🎉` + (r.coins ? ` +${r.coins} Coins` : '')
        : res === 'loss' ? (resign ? 'Aufgegeben – nächstes Mal 💗' : 'Die KI hat gewonnen 🤖') : 'Remis 🤝';
      if (res === 'win') { const b = $('caBoard').getBoundingClientRect(); UI.burst(b.left + b.width / 2, b.top + b.height / 2, 26); }
      g = null; save();
      loadGames().catch(() => {});
    } catch (err) { $('caMsg').textContent = 'Ergebnis speichern ging nicht: ' + UI.errText(err); }
    finishing = false;
    render();
  }

  // ======================================================================
  // Anzeige
  // ======================================================================
  function render() {
    $('caStart').hidden = !!g;
    $('caGame').hidden = !g;
    document.querySelectorAll('#caLevels [data-level]').forEach(b => b.classList.toggle('on', +b.dataset.level === level));
    document.querySelectorAll('#caColors [data-color]').forEach(b => b.classList.toggle('on', b.dataset.color === color));
    $('caResign').hidden = !g;
    renderTally();
    if (!g) return;
    $('caAi').textContent = `🤖 ${LEVELS[g.level].name}`;
    $('caYou').textContent = `Du · ${g.color === 'w' ? 'Weiß' : 'Schwarz'}`;
    $('caStatus').textContent = thinking ? 'Die KI denkt nach …' : chess.in_check() ? 'Schach! Du bist am Zug' : 'Du bist am Zug';
    $('caStatus').classList.toggle('hot', myTurn());
    $('caTip').disabled = !myTurn();
    $('caTip').querySelector('small').textContent = `💡 Tipp · ${window.WIR_SHOP?.tipPrice('chessai') ?? 15}`;
    renderBoard();
    const moves = g.moves;
    const rows = [];
    for (let i = 0; i < moves.length; i += 2) rows.push(`${i / 2 + 1}. ${sanDe(moves[i])} ${moves[i + 1] ? sanDe(moves[i + 1]) : ''}`);
    $('caMoves').textContent = rows.slice(-6).join('   ') || 'Noch keine Züge';
  }

  function renderBoard() {
    const { pieceSvg, PIECE_NAME } = window.WIR_CHESSUI;
    const flip = g.color === 'b';
    const grid = chess.board();
    const hist = chess.history({ verbose: true });
    const lm = hist[hist.length - 1];
    let checkSq = null;
    if (chess.in_check()) grid.forEach((row, r) => row.forEach((p, f) => { if (p && p.type === 'k' && p.color === chess.turn()) checkSq = FILES[f] + (8 - r); }));
    const cells = [];
    for (let i = 0; i < 64; i++) {
      const r = flip ? 7 - Math.floor(i / 8) : Math.floor(i / 8);
      const f = flip ? 7 - (i % 8) : i % 8;
      const sq = FILES[f] + (8 - r);
      const p = grid[r][f];
      const b = el('button', 'sq ' + ((r + f) % 2 ? 'dark' : 'light'));
      b.type = 'button'; b.dataset.sq = sq;
      if (lm && (lm.from === sq || lm.to === sq)) b.classList.add('last');
      if (sel === sq) b.classList.add('sel');
      if (checkSq === sq) b.classList.add('check');
      if (hint && (hint.from === sq || hint.to === sq)) b.classList.add('hint');
      const t = targets.find(m => m.to === sq);
      if (t) b.classList.add(p || t.flags.includes('e') ? 'cap' : 'dot');
      if (p) b.append(pieceSvg(p.type, p.color));
      if (i % 8 === 0) b.append(el('i', 'co rk', String(8 - r)));
      if (i >= 56) b.append(el('i', 'co fl', FILES[f]));
      b.setAttribute('aria-label', sq + (p ? ' ' + PIECE_NAME[p.type] : ''));
      cells.push(b);
    }
    $('caBoard').replaceChildren(...cells);
    $('caBoard').classList.toggle('my-turn', myTurn());
  }

  $('caBoard').addEventListener('click', e => {
    const b = e.target.closest('.sq');
    if (!b || !myTurn()) return;
    const sq = b.dataset.sq;
    const tgt = targets.filter(m => m.to === sq);
    if (sel && tgt.length) {
      if (tgt.some(m => m.flags.includes('p'))) return promo(sel, sq);
      return play(sel, sq);
    }
    const p = chess.get(sq);
    if (p && p.color === g.color && sel !== sq) { sel = sq; targets = chess.moves({ square: sq, verbose: true }); }
    else { sel = null; targets = []; }
    renderBoard();
  });

  function promo(from, to) {
    const { pieceSvg, PIECE_NAME } = window.WIR_CHESSUI;
    $('promoList').replaceChildren(...['q', 'r', 'b', 'n'].map(t => {
      const b = el('button', 'promo-btn');
      b.type = 'button';
      b.append(pieceSvg(t, g.color), el('span', '', PIECE_NAME[t]));
      b.addEventListener('click', () => { UI.sheet('promoSheet', false); play(from, to, t); });
      return b;
    }));
    UI.sheet('promoSheet');
  }

  // 💡 bester Zug (kostet Coins), Stockfish auf voller Stärke
  $('caTip').addEventListener('click', async () => {
    if (!myTurn()) return;
    const r = await window.WIR_SHOP?.buyTip('chessai', g.ref);
    if (!r) return;
    $('caStatus').textContent = 'Suche den besten Zug …';
    const mv = await bestMove(chess.fen(), 20, 'movetime 900').catch(() => null);
    if (!mv) return;
    hint = { from: mv.slice(0, 2), to: mv.slice(2, 4) };
    sel = hint.from; targets = chess.moves({ square: sel, verbose: true });
    render();
    $('caStatus').textContent = `💡 Tipp: ${hint.from} → ${hint.to}`;
  });

  document.querySelectorAll('#caLevels [data-level]').forEach(b => b.addEventListener('click', () => {
    level = +b.dataset.level;
    try { localStorage.setItem('wir-chessai-level', level); } catch (_) {}
    render();
  }));
  document.querySelectorAll('#caColors [data-color]').forEach(b => b.addEventListener('click', () => { color = b.dataset.color; render(); }));
  $('caStartBtn').addEventListener('click', () => { $('caMsg').textContent = ''; getEngine().catch(() => {}); start(); });
  $('caResign').addEventListener('click', () => { if (g && confirm('Wirklich aufgeben?')) finish(true); });

  // ======================================================================
  // Bilanz (beide)
  // ======================================================================
  async function loadGames() {
    [games, users] = await Promise.all([
      pb.collection('chessai_games').getFullList({ sort: '-created' }),
      pb.collection('users').getFullList({ fields: 'id,name' }),
    ]);
    renderTally();
    window.WIR_BADGE?.('gbChessai', g ? 'Läuft' : '', g ? 'run' : '');
    $('gcChessaiStatus').textContent = g ? `${LEVELS[g.level].name} · Zug ${Math.floor(g.moves.length / 2) + 1}` : '';
  }
  function renderTally() {
    const box = $('caTally');
    if (!box) return;
    box.replaceChildren(...users.map(u => {
      const mine = games.filter(x => x.user === u.id);
      const best = Math.max(0, ...mine.filter(x => x.result === 'win').map(x => x.level));
      const row = el('div', 'ledger-row');
      const t = el('div', 'lr-text');
      t.append(el('span', '', u.id === myId() ? 'Du' : u.name),
        el('small', '', `${mine.filter(x => x.result === 'win').length} Siege · ${mine.filter(x => x.result === 'draw').length} Remis · ${mine.filter(x => x.result === 'loss').length} Niederlagen`
          + (best ? ` · stärkster Sieg: ${LEVELS[best].name}` : '') + (mine.some(x => x.hints) ? ' · 💡' : '')));
      row.append(t);
      return row;
    }));
  }

  let started = false;
  document.addEventListener('wir:show', e => {
    if (!started) return;
    if (e.detail === 's-chessai') { load(); render(); if (g && !over() && chess.turn() !== g.color && !thinking) aiMove(); getEngine().catch(() => {}); }
    if (e.detail === 's-games') loadGames().catch(() => {});
  });
  document.addEventListener('wir:started', () => { started = true; load(); loadGames().catch(() => {}); });
})();
