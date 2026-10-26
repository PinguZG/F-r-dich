// Snake: Herzen sammeln, alle 5 Herzen ein Level schneller. Steuerung: wischen auf dem Feld, Pfeiltasten auf dem Bildschirm
// (im ⋯-Menü abschaltbar) oder Tastatur (Pfeile/WASD, Leertaste = Pause). Pausiert automatisch beim Verlassen; der Stand
// bleibt im Gerät gespeichert. Ergebnis prüft der Server (pb_hooks/snake_lib.js), Coins gibt es dort genau einmal pro Runde.
(() => {
  const pb = window.WIR_PB;
  const $ = id => document.getElementById(id);
  const myId = () => (pb.authStore.record || pb.authStore.model)?.id;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const post = (path, body = {}) => pb.send(path, { method: 'POST', body });
  const key = () => 'wir-snake-' + myId();
  const N = 17, PER_LEVEL = 5;
  const levelOf = h => 1 + Math.floor(h / PER_LEVEL);
  const speedOf = lv => Math.max(65, 170 - (lv - 1) * 13); // ms pro Schritt
  const scoreOf = h => { let s = 0; for (let i = 0; i < h; i++) s += 10 * levelOf(i); return s; };
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  let g = null, running = false, best = 0, started = false, acc = 0, last = 0, queue = [];

  const save = () => { try { if (g && !g.over) localStorage.setItem(key(), JSON.stringify(g)); else localStorage.removeItem(key()); } catch (_) {} };
  const isActive = () => $('s-snake').classList.contains('active');

  function spawnFood() {
    const free = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!g.snake.some(s => s[0] === x && s[1] === y)) free.push([x, y]);
    g.food = free[Math.floor(Math.random() * free.length)] || [0, 0];
  }

  async function newGame() {
    if (g && !g.over && g.hearts && !confirm('Diese Runde abbrechen und neu starten?')) return;
    $('snMsg').textContent = '';
    try {
      const r = await post('/api/games/snake/new');
      const m = Math.floor(N / 2);
      g = { id: r.id, snake: [[m, m], [m - 1, m], [m - 2, m]], dir: [1, 0], hearts: 0, secs: 0, over: false };
      queue = []; spawnFood(); save();
      render(); showOverlay('Bereit? Wische oder drück einen Pfeil 🐍', 'Los ▶');
    } catch (err) { $('snMsg').textContent = 'Ging nicht: ' + UI.errText(err); }
  }

  // ======================================================================
  // Spiel-Schleife
  // ======================================================================
  function play() {
    if (!g || g.over) return;
    running = true; last = performance.now(); acc = 0;
    $('snOverlay').hidden = true;
    requestAnimationFrame(frame);
  }
  function pause(text) {
    if (!running) return;
    running = false; save();
    showOverlay(text || 'Pause ⏸', 'Weiter ▶');
  }
  function showOverlay(text, btn) {
    $('snOverlayText').textContent = text;
    $('snResume').textContent = btn;
    $('snOverlay').hidden = false;
  }
  function frame(t) {
    if (!running) return;
    acc += Math.min(250, t - last); last = t;
    const sp = speedOf(levelOf(g.hearts));
    while (acc >= sp && running) { acc -= sp; step(); }
    if (running) { draw(acc / sp); requestAnimationFrame(frame); }
  }

  function step() {
    const nd = queue.shift();
    if (nd) g.dir = nd;
    const h = g.snake[0], nx = h[0] + g.dir[0], ny = h[1] + g.dir[1];
    const eat = g.food && nx === g.food[0] && ny === g.food[1];
    const body = eat ? g.snake : g.snake.slice(0, -1);
    if (nx < 0 || ny < 0 || nx >= N || ny >= N || body.some(s => s[0] === nx && s[1] === ny)) return gameOver();
    g.prev = g.snake.map(s => s.slice());
    g.snake.unshift([nx, ny]);
    if (!eat) g.snake.pop();
    else {
      const lvBefore = levelOf(g.hearts);
      g.hearts++;
      navigator.vibrate?.(8);
      spawnFood();
      if (levelOf(g.hearts) > lvBefore) {
        $('snMsg').textContent = `Level ${levelOf(g.hearts)} 🚀 – schneller!`;
        const r = $('snBoard').getBoundingClientRect(); UI.burst(r.left + r.width / 2, r.top + r.height / 2, 14);
      }
      bar();
    }
  }

  async function gameOver() {
    running = false;
    g.over = true;
    draw(1);
    UI.shake?.($('snBoard'));
    const res = { hearts: g.hearts, seconds: Math.round(g.secs), id: g.id };
    save();
    showOverlay(`Game over – ${scoreOf(res.hearts)} Punkte`, 'Nochmal 🐍');
    try {
      const r = await post(`/api/games/snake/${res.id}/finish`, { hearts: res.hearts, seconds: res.seconds });
      $('snDoneTitle').textContent = r.record ? 'Neuer Rekord! 🏆' : 'Game over';
      $('snDonePts').textContent = `${r.game.score} Punkte`;
      $('snDoneText').textContent = `${res.hearts} 💗 · Level ${r.game.level} · ${fmt(r.game.seconds)} min` + (r.coins ? ` · +${r.coins} Coins` : '');
      UI.sheet('snDoneSheet');
      if (r.record) UI.burst(window.innerWidth / 2, window.innerHeight / 2, 30);
      loadRank().catch(() => {});
    } catch (err) { $('snMsg').textContent = 'Ergebnis speichern ging nicht: ' + UI.errText(err); }
  }
  const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  setInterval(() => { if (running && g) { g.secs++; if (g.secs % 3 === 0) save(); } }, 1000);

  // ======================================================================
  // Zeichnen
  // ======================================================================
  const cv = $('snBoard'), ctx = cv.getContext('2d');
  let cell = 20, colors = {};
  function resize() {
    const w = Math.round(cv.getBoundingClientRect().width) || 320;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = w * dpr; cv.height = w * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cell = w / N;
    const cs = getComputedStyle(document.documentElement);
    colors = { a: cs.getPropertyValue('--accent').trim() || '#e0457b', b: cs.getPropertyValue('--accent2').trim() || '#ff8fb8', ink: cs.getPropertyValue('--ink').trim() || '#5a2340' };
    draw(1);
  }
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); ctx.fill(); }
  function draw(t) {
    const w = cell * N;
    ctx.clearRect(0, 0, w, w);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if ((x + y) % 2 === 0) { ctx.fillStyle = 'rgba(255,255,255,.38)'; ctx.fillRect(x * cell, y * cell, cell, cell); }
    if (!g) return;
    if (g.food) {
      const pulse = 0.82 + 0.08 * Math.sin(performance.now() / 180);
      ctx.font = `${Math.round(cell * pulse)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji"`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('💗', g.food[0] * cell + cell / 2, g.food[1] * cell + cell / 2 + 1);
    }
    const prev = g.prev && running ? g.prev : null;
    const n = g.snake.length;
    for (let i = n - 1; i >= 0; i--) {
      let [x, y] = g.snake[i];
      if (prev && prev[i]) { x = prev[i][0] + (x - prev[i][0]) * t; y = prev[i][1] + (y - prev[i][1]) * t; }
      ctx.globalAlpha = 1 - (i / n) * 0.35;
      ctx.fillStyle = i === 0 ? colors.a : i % 2 ? colors.b : colors.a;
      const pad = i === 0 ? 0.5 : 1.5;
      rr(x * cell + pad, y * cell + pad, cell - pad * 2, cell - pad * 2, cell * 0.38);
      if (i === 0) {
        ctx.globalAlpha = 1;
        const [dx, dy] = g.dir, cx = x * cell + cell / 2, cy = y * cell + cell / 2;
        for (const s of [-1, 1]) {
          const ex = cx + dx * cell * 0.15 + -dy * s * cell * 0.2, ey = cy + dy * cell * 0.15 + dx * s * cell * 0.2;
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, cell * 0.14, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#2a1020'; ctx.beginPath(); ctx.arc(ex + dx * cell * 0.04, ey + dy * cell * 0.04, cell * 0.07, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  // ======================================================================
  // Steuerung
  // ======================================================================
  function turn(name) {
    if (!g || g.over) return;
    const d = DIRS[name]; if (!d) return;
    const ref = queue.length ? queue[queue.length - 1] : g.dir;
    if ((d[0] === -ref[0] && d[1] === -ref[1]) || (d[0] === ref[0] && d[1] === ref[1])) return;
    if (queue.length < 3) queue.push(d);
    if (!running) play();
  }
  let sx = 0, sy = 0, down = false;
  cv.addEventListener('pointerdown', e => { down = true; sx = e.clientX; sy = e.clientY; try { cv.setPointerCapture(e.pointerId); } catch (_) {} });
  cv.addEventListener('pointermove', e => {
    if (!down) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    sx = e.clientX; sy = e.clientY;
  });
  for (const ev of ['pointerup', 'pointercancel']) cv.addEventListener(ev, () => { down = false; });
  cv.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
  document.querySelectorAll('#snPad [data-dir]').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); turn(b.dataset.dir); }));
  document.addEventListener('keydown', e => {
    if (!isActive() || e.target.closest('input,textarea') || document.querySelector('.sheet-wrap:not([hidden])')) return;
    const k = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' }[e.key];
    if (k) { e.preventDefault(); if (!g || g.over) return; turn(k); return; }
    if (e.key === ' ' || e.key === 'p' || e.key === 'Enter') {
      e.preventDefault();
      if (!g || g.over) newGame(); else if (running) pause(); else play();
    }
  });
  $('snResume').addEventListener('click', () => { if (!g || g.over) newGame(); else play(); });
  $('snStartBtn').addEventListener('click', newGame);
  $('snNewBtn').addEventListener('click', () => { UI.sheet('menu-snake', false); newGame(); });
  $('snPauseBtn').addEventListener('click', () => running ? pause() : play());

  // Pfeiltasten ein/aus
  let pad = true;
  try { pad = localStorage.getItem('wir-snake-pad') !== '0'; } catch (_) {}
  const applyPad = () => { $('snPad').hidden = !pad; $('snPadToggle').checked = pad; };
  $('snPadToggle').addEventListener('change', e => { pad = e.target.checked; try { localStorage.setItem('wir-snake-pad', pad ? '1' : '0'); } catch (_) {} applyPad(); });
  applyPad();

  // ======================================================================
  // Anzeige
  // ======================================================================
  function bar() {
    $('snScore').textContent = '⭐ ' + (g ? scoreOf(g.hearts) : 0);
    $('snLevel').textContent = 'Level ' + (g ? levelOf(g.hearts) : 1);
    $('snBest').textContent = '🏆 ' + best;
  }
  function render() {
    const playing = !!g;
    $('snStart').hidden = playing;
    $('snGame').hidden = !playing;
    bar();
    if (playing) {
      requestAnimationFrame(resize);
      if (!running) showOverlay(g.over ? `Game over – ${scoreOf(g.hearts)} Punkte` : 'Pausiert ⏸', g.over ? 'Nochmal 🐍' : 'Weiter ▶');
    }
  }

  async function loadRank() {
    const [rounds, users] = await Promise.all([
      pb.collection('snake_games').getFullList({ filter: 'status = "done"', sort: '-score', fields: 'user,score,hearts,level' }),
      pb.collection('users').getFullList({ fields: 'id,name' }),
    ]);
    best = Math.max(0, ...rounds.filter(r => r.user === myId()).map(r => r.score));
    $('snRank').replaceChildren(...users.map(u => {
      const mine = rounds.filter(x => x.user === u.id);
      const top = mine[0];
      const row = el('div', 'ledger-row');
      const t = el('div', 'lr-text');
      t.append(el('span', '', u.id === myId() ? 'Du' : u.name),
        el('small', '', mine.length ? `${mine.length} Runden · bestes Level ${Math.max(...mine.map(x => x.level))} · ${mine.reduce((s, x) => s + x.hearts, 0)} 💗 gesammelt` : 'noch keine Runde'));
      row.append(t, el('b', 'lr-amt plus', top ? String(top.score) : '–'));
      return row;
    }));
    bar();
    window.WIR_BADGE?.('gbSnake', g && !g.over ? 'Pausiert' : 'Neu', g && !g.over ? 'run' : 'new');
    $('gcSnakeStatus').textContent = g && !g.over ? `Level ${levelOf(g.hearts)} · pausiert` : best ? `Rekord ${best}` : 'Herzen sammeln';
  }

  window.addEventListener('resize', () => { if (g && isActive()) resize(); });
  document.addEventListener('wir:show', e => {
    if (e.detail !== 's-snake') { if (running) pause(); }
    if (!started) return;
    if (e.detail === 's-snake') { $('snMsg').textContent = ''; render(); loadRank().catch(() => {}); }
    if (e.detail === 's-games') loadRank().catch(() => {});
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && running) pause(); });
  window.addEventListener('pagehide', save);
  document.addEventListener('wir:started', () => {
    started = true;
    try { g = JSON.parse(localStorage.getItem(key()) || 'null'); } catch (_) { g = null; }
    if (g?.over) g = null;
    loadRank().catch(() => {});
  });
})();
