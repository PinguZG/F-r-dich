// Spiele: Schach (asynchron gegeneinander), Sudoku (generiert, Rangliste), Tic Tac Toe (KI + gegeneinander).
// Züge gehen über die Server-Routen /api/games/... (pb_hooks/wir_spiele.pb.js), die alles prüfen.
// Nutzt die PocketBase-Verbindung von app.js.
(() => {
  const pb = window.WIR_PB || new PocketBase(window.location.origin);
  pb.autoCancellation(false);

  const $ = id => document.getElementById(id);
  const myId = () => (pb.authStore.record || pb.authStore.model)?.id;
  let started = false;
  let users = [];
  const userById = id => users.find(u => u.id === id);
  const partner = () => users.find(u => u.id !== myId());
  const pname = () => partner()?.name || 'Schatz';
  const isActive = id => $(id)?.classList.contains('active');

  function errText(err) {
    const d = err?.response?.data;
    if (d && Object.keys(d).length) {
      return Object.entries(d).map(([k, v]) => k + ': ' + (v.message || JSON.stringify(v))).join(', ');
    }
    return err?.response?.message || err?.message || 'unbekannter Fehler';
  }
  function debounce(fn, ms = 300) {
    let t;
    return () => { clearTimeout(t); t = setTimeout(() => fn().catch(console.error), ms); };
  }
  const post = (path, body = {}) => pb.send(path, { method: 'POST', body });
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const pad2 = n => String(n).padStart(2, '0');
  const fmtTime = s => `${Math.floor(s / 60)}:${pad2(s % 60)}`;
  const fmtDay = s => { const d = new Date(String(s).replace(' ', 'T')); return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.`; };

  function avatar(u, cls = 'sm') {
    const a = el('span', 'avatar ' + cls);
    a.textContent = (u?.name || '?').charAt(0).toUpperCase();
    if (u?.avatar) {
      a.style.backgroundImage = `url("${pb.files.getURL(u, u.avatar, { thumb: '200x200' })}")`;
      a.classList.add('has');
    }
    return a;
  }

  // Spielstand-Kacheln: [{ label, value, tone: 'me' | 'mid' | 'them' }]
  function tiles(box, items) {
    box.replaceChildren(...items.map(t => {
      const d = el('div', 'score-tile ' + (t.tone || 'mid'));
      d.append(el('b', '', String(t.value)), el('small', '', t.label));
      return d;
    }));
  }

  // ======================================================================
  // Eigene SVGs: Spiel-Icons + runde Schachfiguren
  // ======================================================================
  const NS = 'http://www.w3.org/2000/svg';
  const BASE = '<rect x="22" y="78" width="56" height="12" rx="6"/>';
  const PIECE_SHAPES = {
    p: '<circle cx="50" cy="30" r="13"/><path d="M38 50h24l7 28H31z"/><rect x="34" y="44" width="32" height="9" rx="4.5"/>',
    r: '<path d="M27 18h11v8h6v-8h12v8h6v-8h11v22H27z"/><path d="M33 40h34l4 38H29z"/><path class="dt" fill="none" d="M34 52h32"/>',
    n: '<path d="M68 78H31c0-12 6-20 14-27-6 2-13 3-18-2-5-6 0-13 6-18 4-6 8-12 14-15l2-7 7 8c11 4 18 16 17 33-1 12-6 21-5 28z"/><circle class="dtf" cx="44" cy="33" r="3.8"/>',
    b: '<circle cx="50" cy="13" r="6"/><path d="M50 19c13 10 18 22 13 34H37c-5-12 0-24 13-34z"/><rect x="35" y="52" width="30" height="9" rx="4.5"/><path d="M41 61h18l7 17H34z"/><path class="dt" fill="none" d="M56 29l-9 11"/>',
    q: '<circle cx="22" cy="28" r="6"/><circle cx="50" cy="17" r="6"/><circle cx="78" cy="28" r="6"/><path d="M24 34l11 30h30l11-30-14 14-12-24-12 24z"/><path d="M35 64h30l4 14H31z"/>',
    k: '<path d="M46 5h8v8h8v8h-8v9h-8v-9h-8v-8h8z"/><path d="M50 40c-6-10-22-9-22 5 0 10 9 14 10 19h24c1-5 10-9 10-19 0-14-16-15-22-5z"/><path d="M38 64h24l5 14H33z"/>',
  };
  (function sprite() {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    svg.innerHTML = Object.entries(PIECE_SHAPES).map(([k, s]) => `<symbol id="pc-${k}" viewBox="0 0 100 100">${s}${BASE}</symbol>`).join('');
    document.body.prepend(svg);
  })();
  const PIECE_NAME = { p: 'Bauer', n: 'Springer', b: 'Läufer', r: 'Turm', q: 'Dame', k: 'König' };
  function pieceSvg(type, color) {
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 100 100');
    s.setAttribute('class', 'pc pc-' + color);
    s.innerHTML = `<use href="#pc-${type}"/>`;
    return s;
  }

  const ICONS = {
    chess: '<svg viewBox="0 0 100 100"><g class="gi-fill">' + PIECE_SHAPES.n + BASE + '</g></svg>',
    sudoku: '<svg viewBox="0 0 100 100"><rect x="14" y="14" width="72" height="72" rx="16" class="gi-soft"/><path class="gi-line" d="M38 18v64M62 18v64M18 38h64M18 62h64"/><text x="26" y="34" class="gi-txt">1</text><text x="50" y="58" class="gi-txt">5</text><text x="74" y="82" class="gi-txt">9</text></svg>',
    ttt: '<svg viewBox="0 0 100 100"><path class="gi-line" d="M38 16v68M62 16v68M16 38h68M16 62h68"/><path class="gi-x" d="M20 20l12 12M32 20L20 32M68 68l12 12M80 68L68 80"/><circle class="gi-o" cx="50" cy="50" r="7"/><circle class="gi-o" cx="74" cy="26" r="7"/></svg>',
  };
  document.querySelectorAll('[data-icon]').forEach(e => { e.innerHTML = ICONS[e.dataset.icon] || ''; });

  // ======================================================================
  // Schach
  // ======================================================================
  const DE = { N: 'S', B: 'L', R: 'T', Q: 'D', K: 'K' };
  const sanDe = san => String(san).replace(/[NBRQK]/g, c => DE[c]);
  const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const FILES = 'abcdefgh';

  let chessList = [];   // alle Partien ohne Zugliste (für Bilanz)
  let cg = null;        // aktuelle bzw. letzte Partie mit Zugliste
  let chess = null;     // chess.js-Stand von cg
  let chSel = null, chTargets = [], chBusy = false;

  async function loadChess() {
    chessList = await pb.collection('chess_games').getFullList({ sort: '-created', fields: 'id,white,black,status,reason,winner,turn,draw_offer,created,updated' });
    const cur = chessList.find(g => g.status === 'active') || chessList[0];
    cg = cur ? await pb.collection('chess_games').getOne(cur.id) : null;
    rebuildChess();
    renderChess();
    renderHub();
  }

  function rebuildChess() {
    chess = new Chess();
    for (const m of cg?.moves || []) chess.move(m.san);
    chSel = null; chTargets = [];
  }

  const myColor = () => !cg ? 'w' : cg.white === myId() ? 'w' : 'b';
  const chessMine = () => cg && (cg.white === myId() || cg.black === myId());
  const myChessTurn = () => cg?.status === 'active' && cg.turn === myId();

  function chessResultText(g) {
    const winnerName = g.winner === myId() ? 'Du' : userById(g.winner)?.name || pname();
    const won = g.winner === myId();
    switch (g.status) {
      case 'checkmate': return won ? 'Schachmatt – du hast gewonnen 🎉' : `Schachmatt – ${winnerName} hat gewonnen`;
      case 'resigned': return won ? `${pname()} hat aufgegeben – du gewinnst 🎉` : 'Du hast aufgegeben';
      case 'stalemate': return 'Patt – unentschieden 🤝';
      case 'agreed': return 'Remis vereinbart 🤝';
      case 'draw': return { threefold: 'Remis durch dreifache Wiederholung 🤝', insufficient: 'Remis – zu wenig Material 🤝', fifty: 'Remis nach der 50-Züge-Regel 🤝' }[g.reason] || 'Remis 🤝';
      default: return '';
    }
  }

  function chessStatus() {
    if (!cg) return 'Noch keine Partie – leg los! ♟️';
    if (cg.status !== 'active') return chessResultText(cg);
    const check = chess.in_check();
    if (myChessTurn()) return check ? 'Schach! Du bist am Zug' : 'Du bist am Zug';
    return check ? `Schach! ${pname()} ist am Zug` : `${pname()} ist am Zug`;
  }

  function lastMove() { const m = cg?.moves || []; return m[m.length - 1]; }

  function renderChessBoard() {
    const board = $('chBoard');
    const flip = myColor() === 'b';
    const grid = chess.board(); // [0] = Reihe 8
    const lm = lastMove();
    let checkSq = null;
    if (chess.in_check()) {
      grid.forEach((row, r) => row.forEach((p, f) => { if (p && p.type === 'k' && p.color === chess.turn()) checkSq = FILES[f] + (8 - r); }));
    }
    const cells = [];
    for (let i = 0; i < 64; i++) {
      const r = flip ? 7 - Math.floor(i / 8) : Math.floor(i / 8);
      const f = flip ? 7 - (i % 8) : i % 8;
      const sq = FILES[f] + (8 - r);
      const p = grid[r][f];
      const b = el('button', 'sq ' + ((r + f) % 2 ? 'dark' : 'light'));
      b.type = 'button';
      b.dataset.sq = sq;
      if (lm && (lm.from === sq || lm.to === sq)) b.classList.add('last');
      if (chSel === sq) b.classList.add('sel');
      if (checkSq === sq) b.classList.add('check');
      const t = chTargets.find(m => m.to === sq);
      if (t) b.classList.add(p || t.flags.includes('e') ? 'cap' : 'dot');
      if (p) b.append(pieceSvg(p.type, p.color));
      if (i % 8 === 0) b.append(el('i', 'co rk', String(8 - r)));
      if (i >= 56) b.append(el('i', 'co fl', FILES[f]));
      b.setAttribute('aria-label', sq + (p ? ' ' + PIECE_NAME[p.type] + (p.color === 'w' ? ' weiß' : ' schwarz') : ''));
      cells.push(b);
    }
    board.replaceChildren(...cells);
    board.classList.toggle('my-turn', myChessTurn());
  }

  function capturedBy(color) {
    // Figuren, die "color" geschlagen hat
    return (cg?.moves || []).filter(m => m.captured && m.color === color).map(m => m.captured)
      .sort((a, b) => VALUE[b] - VALUE[a]);
  }

  function renderPlayer(box, u, color) {
    const caps = capturedBy(color);
    const diff = caps.reduce((s, t) => s + VALUE[t], 0) - capturedBy(color === 'w' ? 'b' : 'w').reduce((s, t) => s + VALUE[t], 0);
    const name = el('div', 'chp-name');
    name.append(el('b', '', u?.id === myId() ? 'Du' : u?.name || pname()), el('small', '', color === 'w' ? 'Weiß' : 'Schwarz'));
    const capBox = el('div', 'chp-caps');
    caps.forEach(t => capBox.append(pieceSvg(t, color === 'w' ? 'b' : 'w')));
    if (diff > 0) capBox.append(el('span', 'chp-plus', '+' + diff));
    const turn = cg?.status === 'active' && cg.turn === u?.id;
    box.classList.toggle('turn', !!turn);
    box.replaceChildren(avatar(u), name, capBox);
  }

  function renderChessMoves() {
    const moves = cg?.moves || [];
    const box = $('chMoves');
    if (!moves.length) { box.replaceChildren(el('div', 'empty-note', 'Noch keine Züge')); return; }
    const rows = [];
    for (let i = 0; i < moves.length; i += 2) {
      const row = el('div', 'mv-row');
      row.append(el('span', 'mv-no', (i / 2 + 1) + '.'), el('span', 'mv', sanDe(moves[i].san)), el('span', 'mv', moves[i + 1] ? sanDe(moves[i + 1].san) : ''));
      rows.push(row);
    }
    box.replaceChildren(...rows);
    const last = box.querySelectorAll('.mv');
    last[moves.length - 1]?.classList.add('now');
    box.scrollTop = box.scrollHeight;
  }

  function chessTally() {
    const done = chessList.filter(g => g.status !== 'active');
    const won = done.filter(g => g.winner === myId()).length;
    const lost = done.filter(g => g.winner && g.winner !== myId()).length;
    return { won, lost, draw: done.length - won - lost };
  }

  function renderChess() {
    if (!chess) rebuildChess();
    const me = userById(myId()), you = partner();
    const top = myColor() === 'w' ? 'b' : 'w';
    renderPlayer($('chTop'), you, top);
    renderPlayer($('chBottom'), me, myColor());
    renderChessBoard();
    $('chStatus').textContent = chessStatus();
    $('chStatus').classList.toggle('hot', myChessTurn());

    const active = cg?.status === 'active' && chessMine();
    $('chActions').hidden = !active;
    $('chNew').hidden = active;
    const offer = active ? cg.draw_offer : '';
    $('chOffer').hidden = !offer;
    if (offer) {
      const mine = offer === myId();
      $('chOfferText').textContent = mine ? `🤝 Du hast ${pname()} ein Remis angeboten` : `🤝 ${pname()} bietet dir ein Remis an`;
      $('chOfferBtns').hidden = mine;
      $('chDrawWithdraw').hidden = !mine;
    }
    $('chDrawBtn').disabled = !!offer;
    renderChessMoves();

    const t = chessTally();
    tiles($('chTiles'), [
      { label: 'DU', value: t.won, tone: 'me' },
      { label: 'REMIS', value: t.draw },
      { label: pname().toUpperCase(), value: t.lost, tone: 'them' },
    ]);
    const hist = chessList.filter(g => g.status !== 'active').slice(0, 6);
    $('chHist').replaceChildren(...hist.map(g => {
      const row = el('div', 'date');
      const win = g.winner === myId(), lose = g.winner && !win;
      row.append(el('span', 'ico', win ? '🏆' : lose ? '💗' : '🤝'));
      const d = el('div');
      d.append(el('b', '', chessResultText(g).replace(/ 🎉| 🤝/g, '')), el('small', '', `${fmtDay(g.updated)} · du hattest ${g.white === myId() ? 'Weiß' : 'Schwarz'}`));
      row.append(d);
      return row;
    }));
  }

  $('chBoard').addEventListener('click', e => {
    const b = e.target.closest('.sq');
    if (!b || chBusy || !myChessTurn()) return;
    const sq = b.dataset.sq;
    const target = chTargets.filter(m => m.to === sq);
    if (chSel && target.length) {
      if (target.some(m => m.flags.includes('p'))) choosePromotion(chSel, sq);
      else doChessMove(chSel, sq);
      return;
    }
    const p = chess.get(sq);
    if (p && p.color === myColor() && chSel !== sq) {
      chSel = sq;
      chTargets = chess.moves({ square: sq, verbose: true });
    } else {
      chSel = null; chTargets = [];
    }
    renderChessBoard();
  });

  function choosePromotion(from, to) {
    $('promoList').replaceChildren(...['q', 'r', 'b', 'n'].map(t => {
      const b = el('button', 'promo-btn');
      b.type = 'button';
      b.append(pieceSvg(t, myColor()), el('span', '', PIECE_NAME[t]));
      b.addEventListener('click', () => { UI.sheet('promoSheet', false); doChessMove(from, to, t); });
      return b;
    }));
    UI.sheet('promoSheet');
  }

  async function doChessMove(from, to, promotion) {
    const ply = cg.moves.length;
    const m = chess.move({ from, to, promotion });
    if (!m) return;
    // sofort zeigen, Server entscheidet
    cg.moves = [...cg.moves, { san: m.san, from: m.from, to: m.to, piece: m.piece, color: m.color, captured: m.captured, promotion: m.promotion }];
    cg.turn = '';
    chSel = null; chTargets = [];
    chBusy = true;
    $('chMsg').textContent = '';
    renderChess();
    try {
      cg = await post(`/api/games/chess/${cg.id}/move`, { from, to, promotion, ply });
      rebuildChess();
      const ix = chessList.findIndex(g => g.id === cg.id);
      if (ix >= 0) chessList[ix] = { ...chessList[ix], ...cg };
      renderChess();
      renderHub();
      if (cg.status !== 'active' && cg.winner === myId()) burstAt($('chBoard'));
    } catch (err) {
      $('chMsg').textContent = 'Zug ging nicht: ' + errText(err);
      await loadChess().catch(console.error);
    } finally {
      chBusy = false;
    }
  }

  async function chessAction(path, body, confirmText) {
    if (confirmText && !confirm(confirmText)) return;
    $('chMsg').textContent = '';
    try {
      await post(`/api/games/chess/${cg.id}/${path}`, body);
      await loadChess();
    } catch (err) {
      $('chMsg').textContent = 'Ging nicht: ' + errText(err);
      await loadChess().catch(console.error);
    }
  }
  $('chResignBtn').addEventListener('click', () => chessAction('resign', {}, 'Wirklich aufgeben?'));
  $('chDrawBtn').addEventListener('click', () => chessAction('draw', { action: 'offer' }, `${pname()} ein Remis anbieten?`));
  $('chDrawAccept').addEventListener('click', () => chessAction('draw', { action: 'accept' }));
  $('chDrawDecline').addEventListener('click', () => chessAction('draw', { action: 'decline' }));
  $('chDrawWithdraw').addEventListener('click', () => chessAction('draw', { action: 'withdraw' }));

  async function newChess(color) {
    $('chMsg').textContent = '';
    try {
      await post('/api/games/chess/new', color ? { color } : {});
      await loadChess();
      burstAt($('chBoard'), 12);
    } catch (err) {
      $('chMsg').textContent = 'Neue Partie ging nicht: ' + errText(err);
      await loadChess().catch(console.error);
    }
  }
  $('chNewBtn').addEventListener('click', () => newChess());
  document.querySelectorAll('.ch-color [data-color]').forEach(b => b.addEventListener('click', () => newChess(b.dataset.color)));

  function burstAt(node, n = 22) {
    const r = node.getBoundingClientRect();
    UI.burst(r.left + r.width / 2, r.top + r.height / 2, n);
  }

  // ======================================================================
  // Sudoku
  // ======================================================================
  const LEVELS = { easy: 'Leicht', medium: 'Mittel', hard: 'Schwer' };
  const SD_TARGET = { easy: 38, medium: 31, hard: 25 };   // Vorgaben
  const SD_MAX = { easy: 50, medium: 37, hard: 31 };      // muss zu pb_hooks/spiele_lib.js passen
  const box = (r, c) => Math.floor(r / 3) * 3 + Math.floor(c / 3);

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // Backtracking mit Bitmasken. fill=true: zufällig füllen und Lösung stehen lassen; sonst Lösungen zählen (bis limit)
  function sdSearch(g, limit, fill) {
    const R = new Int32Array(9), C = new Int32Array(9), X = new Int32Array(9);
    for (let i = 0; i < 81; i++) if (g[i]) {
      const b = 1 << g[i], r = (i / 9) | 0, c = i % 9;
      R[r] |= b; C[c] |= b; X[box(r, c)] |= b;
    }
    let count = 0;
    const rec = () => {
      let best = -1, bm = 0, bn = 10;
      for (let i = 0; i < 81; i++) {
        if (g[i]) continue;
        const r = (i / 9) | 0, c = i % 9;
        const m = ~(R[r] | C[c] | X[box(r, c)]) & 0x3FE;
        let n = 0, t = m;
        while (t) { t &= t - 1; n++; }
        if (n < bn) { bn = n; bm = m; best = i; if (n <= 1) break; }
      }
      if (best < 0) { count++; return count >= limit; }
      if (bn === 0) return false;
      const r = (best / 9) | 0, c = best % 9, x = box(r, c);
      const ds = [];
      for (let d = 1; d <= 9; d++) if (bm & (1 << d)) ds.push(d);
      if (fill) shuffle(ds);
      for (const d of ds) {
        const b = 1 << d;
        g[best] = d; R[r] |= b; C[c] |= b; X[x] |= b;
        const stop = rec();
        if (stop && fill) return true;
        g[best] = 0; R[r] &= ~b; C[c] &= ~b; X[x] &= ~b;
        if (stop) return true;
      }
      return false;
    };
    rec();
    return count;
  }

  function sdGenerate(level) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const sol = new Int8Array(81);
      sdSearch(sol, 1, true);
      const puz = Int8Array.from(sol);
      let givens = 81;
      for (const i of shuffle([...Array(81).keys()])) {
        if (givens <= SD_TARGET[level]) break;
        const v = puz[i];
        puz[i] = 0;
        if (sdSearch(Int8Array.from(puz), 2, false) !== 1) puz[i] = v;
        else givens--;
      }
      if (givens <= SD_MAX[level]) return { puzzle: puz.join(''), solution: sol.join('') };
    }
    throw new Error('Rätsel konnte nicht erzeugt werden');
  }

  let sd = null;          // { id, difficulty, puzzle, solution, cells:int[], notes:int[], elapsed, mistakes, show_errors }
  let sdSel = -1, sdNoteMode = false, sdUndoStack = [], sdBusy = false;
  let sdScores = [];
  const sdKey = () => 'wir-sudoku-' + myId();

  function sdFromRec(r) {
    return {
      id: r.id, difficulty: r.difficulty, puzzle: r.puzzle, solution: r.solution,
      cells: r.cells.split('').map(Number),
      notes: Array.isArray(r.notes) && r.notes.length === 81 ? r.notes.map(n => n | 0) : Array(81).fill(0),
      elapsed: r.elapsed || 0, mistakes: r.mistakes || 0, show_errors: !!r.show_errors,
    };
  }
  const sdData = () => ({
    difficulty: sd.difficulty, puzzle: sd.puzzle, solution: sd.solution, cells: sd.cells.join(''),
    notes: sd.notes, elapsed: sd.elapsed, mistakes: sd.mistakes, show_errors: sd.show_errors,
  });

  async function loadSudoku() {
    const [prog, scores] = await Promise.all([
      pb.collection('sudoku_progress').getFullList({ filter: pb.filter('user = {:u}', { u: myId() }) }),
      pb.collection('sudoku_scores').getFullList({ sort: '-created' }),
    ]);
    sdScores = scores;
    const rec = prog[0];
    if (!rec) { sd = null; try { localStorage.removeItem(sdKey()); } catch (_) {} }
    else if (!sd || sd.id !== rec.id || rec.elapsed > sd.elapsed) {
      sd = sdFromRec(rec);
      // ungespeicherter Stand auf diesem Handy ist neuer? -> den nehmen
      try {
        const local = JSON.parse(localStorage.getItem(sdKey()) || 'null');
        if (local && local.id === rec.id && local.puzzle === rec.puzzle && local.elapsed > rec.elapsed) { sd = local; sdDirty = true; sdSaveSoon(); }
      } catch (_) {}
      sdUndoStack = [];
    }
    renderSudoku();
    renderRank();
    renderHub();
  }

  let sdDirty = false, sdSaveT = null, sdSaving = null;
  function sdLocal() { try { if (sd) localStorage.setItem(sdKey(), JSON.stringify(sd)); } catch (_) {} }
  function sdSaveSoon(ms = 1500) {
    sdDirty = true;
    sdLocal();
    clearTimeout(sdSaveT);
    sdSaveT = setTimeout(() => sdSave().catch(console.error), ms);
  }
  async function sdSave() {
    clearTimeout(sdSaveT);
    if (!sd || !sd.id || !sdDirty) return;
    if (sdSaving) await sdSaving.catch(() => {});
    sdDirty = false;
    sdSaving = pb.collection('sudoku_progress').update(sd.id, sdData());
    try { await sdSaving; } catch (err) { sdDirty = true; throw err; } finally { sdSaving = null; }
  }

  async function sdStart(level) {
    if (sdBusy) return;
    sdBusy = true;
    $('sdGenMsg').textContent = 'Rätsel wird gemischt … 🎲';
    await UI.wait(30);
    try {
      const g = sdGenerate(level);
      const data = {
        user: myId(), difficulty: level, puzzle: g.puzzle, solution: g.solution, cells: g.puzzle,
        notes: Array(81).fill(0), elapsed: 0, mistakes: 0, show_errors: sd?.show_errors ?? true,
      };
      const old = await pb.collection('sudoku_progress').getFullList({ filter: pb.filter('user = {:u}', { u: myId() }) });
      const rec = old[0] ? await pb.collection('sudoku_progress').update(old[0].id, data) : await pb.collection('sudoku_progress').create(data);
      sd = sdFromRec(rec);
      sdSel = -1; sdUndoStack = []; sdNoteMode = false; sdDirty = false;
      sdLocal();
      $('sdGenMsg').textContent = '';
      renderSudoku();
      renderHub();
    } catch (err) {
      $('sdGenMsg').textContent = 'Ging nicht: ' + errText(err);
    } finally {
      sdBusy = false;
    }
  }
  document.querySelectorAll('.sd-level').forEach(b => b.addEventListener('click', () => sdStart(b.dataset.level)));
  $('sdNewBtn').addEventListener('click', async () => {
    if (!confirm('Dieses Rätsel abbrechen und ein neues anfangen?')) return;
    try {
      if (sd?.id) await pb.collection('sudoku_progress').delete(sd.id);
    } catch (err) { console.error(err); }
    sd = null;
    try { localStorage.removeItem(sdKey()); } catch (_) {}
    renderSudoku();
    renderHub();
  });

  function renderSudoku() {
    $('sdStart').hidden = !!sd;
    $('sdGame').hidden = !sd;
    if (!sd) return;
    $('sdLevel').textContent = LEVELS[sd.difficulty];
    $('sdTime').textContent = '⏱ ' + fmtTime(sd.elapsed);
    $('sdMist').textContent = 'Fehler ' + sd.mistakes;
    $('sdShowErr').checked = sd.show_errors;
    $('sdNotes').classList.toggle('on', sdNoteMode);
    $('sdNotes').setAttribute('aria-pressed', sdNoteMode);
    renderSdGrid();
    renderSdPad();
  }

  function renderSdGrid() {
    const selVal = sdSel >= 0 ? sd.cells[sdSel] : 0;
    const sr = Math.floor(sdSel / 9), sc = sdSel % 9;
    const cells = [];
    for (let i = 0; i < 81; i++) {
      const r = Math.floor(i / 9), c = i % 9;
      const b = el('button', 'sd-cell');
      b.type = 'button';
      b.dataset.i = i;
      if (c % 3 === 2 && c < 8) b.classList.add('br');
      if (r % 3 === 2 && r < 8) b.classList.add('bb');
      const v = sd.cells[i];
      if (sd.puzzle[i] !== '0') b.classList.add('given');
      if (sdSel >= 0) {
        if (i === sdSel) b.classList.add('sel');
        else if (r === sr || c === sc || box(r, c) === box(sr, sc)) b.classList.add('peer');
        if (v && v === selVal && i !== sdSel) b.classList.add('same');
      }
      if (v) {
        b.textContent = v;
        if (sd.show_errors && String(v) !== sd.solution[i]) b.classList.add('err');
      } else if (sd.notes[i]) {
        const n = el('span', 'sd-notes');
        for (let d = 1; d <= 9; d++) n.append(el('i', selVal === d && sd.notes[i] & (1 << d) ? 'hl' : '', sd.notes[i] & (1 << d) ? String(d) : ''));
        b.append(n);
      }
      cells.push(b);
    }
    $('sdGrid').replaceChildren(...cells);
  }

  function renderSdPad() {
    const counts = Array(10).fill(0);
    sd.cells.forEach((v, i) => { if (v && String(v) === sd.solution[i]) counts[v]++; });
    $('sdPad').replaceChildren(...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => {
      const b = el('button', 'sd-num' + (counts[d] >= 9 ? ' done' : ''));
      b.type = 'button';
      b.dataset.d = d;
      b.append(el('b', '', String(d)), el('small', '', counts[d] >= 9 ? '✓' : String(9 - counts[d])));
      return b;
    }));
  }

  const sdEditable = i => i >= 0 && sd.puzzle[i] === '0';
  const sdSnap = () => sdUndoStack.push({ cells: sd.cells.slice(), notes: sd.notes.slice() }) > 200 && sdUndoStack.shift();

  $('sdGrid').addEventListener('click', e => {
    const b = e.target.closest('.sd-cell');
    if (!b) return;
    sdSel = +b.dataset.i;
    renderSdGrid();
  });

  const sdSolved = () => sd && sd.cells.every((v, k) => String(v) === sd.solution[k]);
  function sdInput(d) {
    if (sdSolved()) { sdFinish(); return; } // Speichern war fehlgeschlagen -> nochmal
    if (!sd || !sdEditable(sdSel)) return;
    const i = sdSel;
    if (sdNoteMode) {
      if (sd.cells[i]) return;
      sdSnap();
      sd.notes[i] ^= 1 << d;
    } else {
      if (sd.cells[i] === d) return;
      sdSnap();
      sd.cells[i] = d;
      sd.notes[i] = 0;
      if (String(d) !== sd.solution[i]) {
        sd.mistakes++;
        if (sd.show_errors) UI.shake($('sdGrid').children[i]);
      } else {
        // passende Notizen in Zeile/Spalte/Block entfernen
        const r = Math.floor(i / 9), c = i % 9;
        for (let j = 0; j < 81; j++) {
          const rj = Math.floor(j / 9), cj = j % 9;
          if (rj === r || cj === c || box(rj, cj) === box(r, c)) sd.notes[j] &= ~(1 << d);
        }
      }
    }
    renderSudoku();
    sdSaveSoon();
    if (sdSolved()) sdFinish();
  }
  $('sdPad').addEventListener('click', e => { const b = e.target.closest('.sd-num'); if (b) sdInput(+b.dataset.d); });
  $('sdErase').addEventListener('click', () => {
    if (!sd || !sdEditable(sdSel) || (!sd.cells[sdSel] && !sd.notes[sdSel])) return;
    sdSnap();
    sd.cells[sdSel] = 0; sd.notes[sdSel] = 0;
    renderSudoku(); sdSaveSoon();
  });
  $('sdUndo').addEventListener('click', () => {
    const s = sdUndoStack.pop();
    if (!s || !sd) return;
    sd.cells = s.cells; sd.notes = s.notes;
    renderSudoku(); sdSaveSoon();
  });
  $('sdNotes').addEventListener('click', () => { sdNoteMode = !sdNoteMode; renderSudoku(); });
  $('sdShowErr').addEventListener('change', () => { if (!sd) return; sd.show_errors = $('sdShowErr').checked; renderSudoku(); sdSaveSoon(); });

  async function sdFinish() {
    const done = sd;
    try {
      const score = await post('/api/games/sudoku/finish', { cells: done.cells.join(''), elapsed: done.elapsed, mistakes: done.mistakes });
      sd = null;
      try { localStorage.removeItem(sdKey()); } catch (_) {}
      $('sdDonePts').textContent = '+' + score.points + ' Punkte';
      $('sdDoneText').textContent = `${LEVELS[score.difficulty]} in ${fmtTime(score.seconds)} min` +
        (score.mistakes ? ` · ${score.mistakes} ${score.mistakes === 1 ? 'Fehler' : 'Fehler'}` : ' · ohne Fehler ✨');
      UI.sheet('sdDoneSheet');
      UI.burst(window.innerWidth / 2, window.innerHeight / 2, 30);
      await loadSudoku();
    } catch (err) {
      $('sdMist').textContent = 'Speichern ging nicht – tipp eine Zahl';
      console.error(err);
    }
  }

  // läuft nur, wenn Sudoku offen und die App sichtbar ist
  setInterval(() => {
    if (!sd || document.hidden || !isActive('s-sudoku') || sdSolved()) return;
    sd.elapsed++;
    $('sdTime').textContent = '⏱ ' + fmtTime(sd.elapsed);
    if (sd.elapsed % 15 === 0) sdSaveSoon(100); else sdLocal();
  }, 1000);

  function renderRank() {
    const people = [userById(myId()), partner()].filter(Boolean);
    const stats = people.map(u => {
      const mine = sdScores.filter(s => s.user === u.id);
      const per = {};
      for (const l of Object.keys(LEVELS)) {
        const ls = mine.filter(s => s.difficulty === l);
        per[l] = { n: ls.length, best: ls.length ? Math.min(...ls.map(s => s.seconds)) : null };
      }
      return { u, points: mine.reduce((s, x) => s + x.points, 0), solved: mine.length, per };
    });
    const lead = stats.length === 2 && stats[0].points !== stats[1].points ? (stats[0].points > stats[1].points ? 0 : 1) : -1;
    const card = el('div', 'rank-card glass');
    const head = el('div', 'rank-row rank-head');
    head.append(el('span', ''));
    stats.forEach((s, k) => {
      const h = el('span', 'rank-who');
      h.append(avatar(s.u), el('b', '', (k === lead ? '👑 ' : '') + (s.u.id === myId() ? 'Du' : s.u.name)));
      head.append(h);
    });
    card.append(head);
    const row = (label, fn, strong) => {
      const r = el('div', 'rank-row' + (strong ? ' strong' : ''));
      r.append(el('span', 'rank-lbl', label));
      stats.forEach(s => r.append(el('span', 'rank-val', fn(s))));
      card.append(r);
    };
    row('Punkte', s => String(s.points), true);
    row('Gelöst', s => String(s.solved));
    for (const [l, name] of Object.entries(LEVELS)) row(name, s => s.per[l].n ? `${s.per[l].n}× · ⏱ ${fmtTime(s.per[l].best)}` : '–');
    $('sdRank').replaceChildren(card);
  }

  // ======================================================================
  // Tic Tac Toe
  // ======================================================================
  const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  const winLine = b => LINES.find(l => b[l[0]] !== '-' && b[l[0]] === b[l[1]] && b[l[0]] === b[l[2]]) || null;
  let tttGames = [];
  let tttSeg = 'ai', tttLevel = 'easy';
  try { tttLevel = localStorage.getItem('wir-ttt-level') || 'easy'; } catch (_) {}
  const ai = { board: Array(9).fill('-'), turn: 'x', starter: 'x', done: false, line: null };

  async function loadTtt() {
    tttGames = await pb.collection('ttt_games').getFullList({ sort: '-created' });
    renderTtt();
    renderHub();
  }
  const pvpGame = () => tttGames.find(g => g.mode === 'pvp');
  const myTttTurn = () => { const g = pvpGame(); return g?.status === 'active' && g.turn === myId(); };

  function markSvg(m, color) {
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 100 100');
    s.setAttribute('class', 'mark mark-' + m);
    s.style.setProperty('--mc', color);
    s.innerHTML = m === 'x' ? '<path d="M28 28l44 44M72 28L28 72"/>' : '<circle cx="50" cy="50" r="24"/>';
    return s;
  }

  function renderBoard(boxEl, board, colors, line, clickable) {
    const cells = board.map((v, i) => {
      const b = el('button', 'ttt-cell');
      b.type = 'button';
      b.dataset.i = i;
      b.disabled = !clickable || v !== '-';
      if (v !== '-') b.append(markSvg(v, colors[v]));
      return b;
    });
    boxEl.replaceChildren(...cells);
    if (line) {
      const c = i => [(i % 3) * 100 / 3 + 100 / 6, Math.floor(i / 3) * 100 / 3 + 100 / 6];
      const [x1, y1] = c(line[0]), [x2, y2] = c(line[2]);
      const s = document.createElementNS(NS, 'svg');
      s.setAttribute('viewBox', '0 0 100 100');
      s.setAttribute('class', 'win-line');
      s.innerHTML = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" pathLength="100"/>`;
      boxEl.append(s);
    }
    boxEl.classList.toggle('playable', !!clickable);
  }

  const hearts = () => window.WIR_HEARTS || { me: '#ff5fa2', partner: '#3b9eff' };

  function renderTtt() {
    document.querySelectorAll('[data-tseg]').forEach(b => b.classList.toggle('on', b.dataset.tseg === tttSeg));
    $('tttAiPane').hidden = tttSeg !== 'ai';
    $('tttPvpPane').hidden = tttSeg !== 'pvp';
    document.querySelectorAll('#tttLevels [data-level]').forEach(b => b.classList.toggle('on', b.dataset.level === tttLevel));

    // gegen die KI
    const res = tttGames.filter(g => g.mode === 'ai' && g.level === tttLevel);
    tiles($('tttAiTiles'), [
      { label: 'DU', value: res.filter(g => g.result === 'win').length, tone: 'me' },
      { label: 'UNENTSCHIEDEN', value: res.filter(g => g.result === 'draw').length },
      { label: 'KI', value: res.filter(g => g.result === 'loss').length, tone: 'them' },
    ]);
    const aiColors = { x: hearts().me, o: 'var(--ink-faint)' };
    renderBoard($('tttAiBoard'), ai.board, aiColors, ai.line, !ai.done && ai.turn === 'x');
    $('tttAiStatus').textContent = ai.done
      ? (ai.line ? (ai.board[ai.line[0]] === 'x' ? 'Du hast gewonnen 🎉' : 'Die KI hat gewonnen 🤖') : 'Unentschieden 🤝')
      : ai.turn === 'x' ? 'Du bist dran ✕' : 'KI denkt nach …';
    $('tttAiNew').hidden = !ai.done;

    // gegeneinander
    const pvp = tttGames.filter(g => g.mode === 'pvp' && g.status !== 'active');
    const won = pvp.filter(g => g.winner === myId()).length, lost = pvp.filter(g => g.winner && g.winner !== myId()).length;
    tiles($('tttPvpTiles'), [
      { label: 'DU', value: won, tone: 'me' },
      { label: 'UNENTSCHIEDEN', value: pvp.length - won - lost },
      { label: pname().toUpperCase(), value: lost, tone: 'them' },
    ]);
    const g = pvpGame();
    const board = (g?.board || '---------').split('');
    const colors = g ? { x: g.x === myId() ? hearts().me : hearts().partner, o: g.o === myId() ? hearts().me : hearts().partner } : { x: hearts().me, o: hearts().partner };
    const line = g?.status === 'won' && Array.isArray(g.line) && g.line.length === 3 ? g.line : null;
    renderBoard($('tttPvpBoard'), board, colors, line, myTttTurn() && !tttBusy);
    const myMark = g && (g.x === myId() ? '✕' : '◯');
    let st;
    if (!g) st = 'Noch kein Spiel – fang eins an 💗';
    else if (g.status === 'active') st = g.turn === myId() ? `Du bist am Zug ${myMark}` : `${pname()} ist am Zug`;
    else if (g.status === 'won') st = g.winner === myId() ? 'Du hast gewonnen 🎉' : `${pname()} hat gewonnen`;
    else if (g.status === 'resigned') st = g.winner === myId() ? `${pname()} hat aufgegeben – du gewinnst 🎉` : 'Du hast aufgegeben';
    else st = 'Unentschieden 🤝';
    $('tttPvpStatus').textContent = st;
    $('tttPvpStatus').classList.toggle('hot', myTttTurn());
    $('tttPvpNew').hidden = g?.status === 'active';
    $('tttPvpResign').hidden = g?.status !== 'active';
  }

  document.querySelectorAll('[data-tseg]').forEach(b => b.addEventListener('click', () => { tttSeg = b.dataset.tseg; renderTtt(); }));
  document.querySelectorAll('#tttLevels [data-level]').forEach(b => b.addEventListener('click', () => {
    tttLevel = b.dataset.level;
    try { localStorage.setItem('wir-ttt-level', tttLevel); } catch (_) {}
    aiReset();
  }));

  // ---------- KI ----------
  function minimax(b, player, depth) {
    const l = winLine(b);
    if (l) return { score: b[l[0]] === 'o' ? 10 - depth : depth - 10 };
    if (!b.includes('-')) return { score: 0 };
    let best = null;
    for (let i = 0; i < 9; i++) {
      if (b[i] !== '-') continue;
      b[i] = player;
      const r = minimax(b, player === 'o' ? 'x' : 'o', depth + 1);
      b[i] = '-';
      if (!best || (player === 'o' ? r.score > best.score : r.score < best.score)) best = { score: r.score, i };
    }
    return best;
  }
  function finding(b, mark) {
    for (const l of LINES) {
      const v = l.map(i => b[i]);
      if (v.filter(x => x === mark).length === 2 && v.includes('-')) return l[v.indexOf('-')];
    }
    return -1;
  }
  function aiPick(b) {
    const free = b.map((v, i) => v === '-' ? i : -1).filter(i => i >= 0);
    const rnd = () => free[Math.floor(Math.random() * free.length)];
    if (tttLevel === 'easy') {
      const w = finding(b, 'o');
      return w >= 0 && Math.random() < 0.5 ? w : rnd();
    }
    if (tttLevel === 'medium') {
      const w = finding(b, 'o'); if (w >= 0) return w;
      const k = finding(b, 'x'); if (k >= 0) return k;
      if (Math.random() < 0.4) return minimax(b.slice(), 'o', 0).i;
      return b[4] === '-' && Math.random() < 0.6 ? 4 : rnd();
    }
    if (free.length === 9) return [0, 2, 4, 6, 8][Math.floor(Math.random() * 5)];
    return minimax(b.slice(), 'o', 0).i;
  }

  function aiCheckEnd() {
    const l = winLine(ai.board);
    if (!l && ai.board.includes('-')) return false;
    ai.done = true;
    ai.line = l;
    const result = !l ? 'draw' : ai.board[l[0]] === 'x' ? 'win' : 'loss';
    post('/api/games/ttt/ai', { level: tttLevel, result, board: ai.board.join(''), line: l || [] })
      .then(() => loadTtt()).catch(console.error);
    if (result === 'win') setTimeout(() => burstAt($('tttAiBoard')), 350);
    return true;
  }

  function aiReset() {
    ai.starter = ai.starter === 'x' ? 'o' : 'x';
    ai.board = Array(9).fill('-');
    ai.done = false; ai.line = null;
    ai.turn = ai.starter;
    renderTtt();
    if (ai.turn === 'o') aiMove();
  }
  function aiMove() {
    setTimeout(() => {
      if (ai.done || ai.turn !== 'o') return;
      ai.board[aiPick(ai.board)] = 'o';
      ai.turn = 'x';
      aiCheckEnd();
      renderTtt();
    }, 450);
  }
  $('tttAiBoard').addEventListener('click', e => {
    const b = e.target.closest('.ttt-cell');
    if (!b || ai.done || ai.turn !== 'x' || ai.board[+b.dataset.i] !== '-') return;
    ai.board[+b.dataset.i] = 'x';
    ai.turn = 'o';
    if (!aiCheckEnd()) aiMove();
    renderTtt();
  });
  $('tttAiNew').addEventListener('click', aiReset);
  ai.starter = 'o'; // aiReset dreht -> erstes Spiel fängst du an
  ai.board = Array(9).fill('-');

  // ---------- gegeneinander ----------
  let tttBusy = false;
  $('tttPvpBoard').addEventListener('click', async e => {
    const b = e.target.closest('.ttt-cell');
    const g = pvpGame();
    if (!b || tttBusy || !myTttTurn()) return;
    const i = +b.dataset.i;
    const board = g.board.split('');
    if (board[i] !== '-') return;
    const ply = board.filter(c => c !== '-').length;
    board[i] = g.x === myId() ? 'x' : 'o';
    g.board = board.join('');
    g.turn = '';
    tttBusy = true;
    $('tttMsg').textContent = '';
    renderTtt();
    try {
      const rec = await post(`/api/games/ttt/${g.id}/move`, { cell: i, ply });
      tttGames = tttGames.map(x => x.id === rec.id ? rec : x);
      tttBusy = false;
      renderTtt();
      renderHub();
      if (rec.status === 'won' && rec.winner === myId()) setTimeout(() => burstAt($('tttPvpBoard')), 350);
    } catch (err) {
      tttBusy = false;
      $('tttMsg').textContent = 'Ging nicht: ' + errText(err);
      await loadTtt().catch(console.error);
    }
  });
  $('tttPvpNew').addEventListener('click', async () => {
    $('tttMsg').textContent = '';
    try { await post('/api/games/ttt/new'); await loadTtt(); }
    catch (err) { $('tttMsg').textContent = 'Ging nicht: ' + errText(err); await loadTtt().catch(console.error); }
  });
  $('tttPvpResign').addEventListener('click', async () => {
    if (!confirm('Wirklich aufgeben?')) return;
    try { await post(`/api/games/ttt/${pvpGame().id}/resign`); await loadTtt(); }
    catch (err) { $('tttMsg').textContent = 'Ging nicht: ' + errText(err); }
  });

  // ======================================================================
  // Übersicht
  // ======================================================================
  function renderHub() {
    if (!started) return;
    // Schach
    let cs;
    if (cg?.status === 'active') {
      const zug = Math.floor((cg.moves?.length || 0) / 2) + 1;
      if (cg.draw_offer && cg.draw_offer !== myId()) cs = `🤝 ${pname()} bietet Remis an`;
      else cs = (cg.turn === myId() ? 'Du bist am Zug' : `${pname()} ist am Zug`) + ` · Zug ${zug}`;
    } else cs = 'Neue Partie starten';
    $('gcChessStatus').textContent = cs;
    $('gcChessStatus').classList.toggle('hot', myChessTurn());
    const t = chessTally();
    tiles($('gcChessTiles'), [
      { label: 'DU', value: t.won, tone: 'me' },
      { label: 'REMIS', value: t.draw },
      { label: pname().toUpperCase(), value: t.lost, tone: 'them' },
    ]);

    // Sudoku
    $('gcSudokuStatus').textContent = sd ? `Sudoku: ${LEVELS[sd.difficulty]}, ${fmtTime(sd.elapsed)} min` : 'Leicht · Mittel · Schwer';
    const pts = id => sdScores.filter(s => s.user === id).reduce((a, s) => a + s.points, 0);
    tiles($('gcSudokuTiles'), [
      { label: 'DU', value: pts(myId()), tone: 'me' },
      { label: 'GELÖST', value: sdScores.length },
      { label: pname().toUpperCase(), value: partner() ? pts(partner().id) : 0, tone: 'them' },
    ]);

    // Tic Tac Toe
    const g = pvpGame();
    $('gcTttStatus').textContent = g?.status === 'active'
      ? (g.turn === myId() ? 'Du bist am Zug' : `${pname()} ist am Zug`)
      : 'Gegen KI oder gegeneinander';
    $('gcTttStatus').classList.toggle('hot', myTttTurn());
    const pvp = tttGames.filter(x => x.mode === 'pvp' && x.status !== 'active');
    const won = pvp.filter(x => x.winner === myId()).length, lost = pvp.filter(x => x.winner && x.winner !== myId()).length;
    tiles($('gcTttTiles'), [
      { label: 'DU', value: won, tone: 'me' },
      { label: 'UNENTSCHIEDEN', value: pvp.length - won - lost },
      { label: pname().toUpperCase(), value: lost, tone: 'them' },
    ]);

    document.querySelector('[data-game="chess"] .gc-play').textContent = cg?.status === 'active' ? '▶' : '+';
    $('navGameDot').hidden = !(myChessTurn() || myTttTurn() || (cg?.status === 'active' && cg.draw_offer && cg.draw_offer !== myId()));
  }

  // ======================================================================
  // Start, Live-Updates
  // ======================================================================
  async function loadUsers() { users = await pb.collection('users').getFullList({ fields: 'id,name,avatar,collectionId,collectionName,heart_color,created' }); }

  async function loadAll() {
    await loadUsers().catch(console.error);
    await Promise.all([loadChess(), loadSudoku(), loadTtt()].map(p => p.catch(console.error)));
  }

  async function start() {
    started = true;
    await loadAll();
    renderHub();
    const rc = debounce(loadChess), rt = debounce(loadTtt), rs = debounce(loadSudoku);
    pb.collection('chess_games').subscribe('*', e => {
      // eigene Antwort ist schon da; nur fremde Änderungen nachladen
      if (chBusy && e.record.id === cg?.id) return;
      rc();
    }).catch(console.error);
    pb.collection('ttt_games').subscribe('*', () => { if (!tttBusy) rt(); }).catch(console.error);
    pb.collection('sudoku_scores').subscribe('*', rs).catch(console.error);
  }

  document.addEventListener('wir:show', e => {
    if (!started) return;
    const id = e.detail;
    if (id !== 's-sudoku' && sdDirty) sdSave().catch(console.error);
    if (id === 's-games') renderHub();
    if (id === 's-chess') { $('chMsg').textContent = ''; renderChess(); }
    if (id === 's-sudoku') { renderSudoku(); renderRank(); }
    if (id === 's-ttt') { $('tttMsg').textContent = ''; renderTtt(); }
  });

  document.addEventListener('visibilitychange', () => {
    if (!started || !pb.authStore.isValid) return;
    if (document.hidden) { if (sdDirty) sdSave().catch(console.error); return; }
    loadAll().catch(console.error);
  });
  window.addEventListener('pagehide', () => { if (sdDirty) sdSave().catch(() => {}); });

  document.addEventListener('wir:started', () => { if (!started) start(); });
})();
