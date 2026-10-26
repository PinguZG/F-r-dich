// Herzspur: Lichtrennen zu zweit, live (wie Tron). Jede Person fährt eine Spur in ihrer Herzfarbe; wer gegen die Wand
// oder eine Spur fährt, verliert die Runde. Best of 5 (wer zuerst 3 hat). Das Gerät der einladenden Person (Host, p1)
// rechnet mit 10 Ticks/s und schickt nach jedem Tick die Köpfe der letzten Ticks; das andere Gerät schickt nur
// Richtungswechsel. Nachrichten laufen über /api/trail/{id}/msg als PocketBase-Realtime (Topic "trail/<id>").
(() => {
  const pb = window.WIR_PB;
  const $ = id => document.getElementById(id);
  const myId = () => (pb.authStore.record || pb.authStore.model)?.id;
  const post = (path, body = {}) => pb.send(path, { method: 'POST', body });
  const COLS = 24, ROWS = 34, TICK = 100, WIN = 3;
  const DIRS = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
  const OPP = { u: 'd', d: 'u', l: 'r', r: 'l' };

  let m = null;               // Match-Datensatz
  let host = false, me = 0;   // me: 0 = p1, 1 = p2
  let grid = null, heads = [[0, 0], [0, 0]], dirs = ['u', 'd'], want = ['u', 'd'];
  let score = [0, 0], round = 0, running = false, tick = 0, hist = [];
  let loop = 0, otherReady = false, lastHeard = 0, readyTimer = 0, unsub = null, started = false;
  const canvas = $('trCanvas'), ctx = canvas.getContext('2d');
  const colors = () => { const h = window.WIR_HEARTS || { me: '#ff5fa2', partner: '#3b9eff' }; return me === 0 ? [h.me, h.partner] : [h.partner, h.me]; };

  // ======================================================================
  // Zeichnen
  // ======================================================================
  let cell = 12;
  function size() {
    const w = Math.min(canvas.parentElement.clientWidth || 360, 440);
    cell = Math.floor(w / COLS);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.style.width = cell * COLS + 'px'; canvas.style.height = cell * ROWS + 'px';
    canvas.width = cell * COLS * dpr; canvas.height = cell * ROWS * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function draw() {
    if (!grid) return;
    const c = colors();
    ctx.clearRect(0, 0, cell * COLS, cell * ROWS);
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) if ((x + y) % 2) ctx.fillRect(x * cell, y * cell, cell, cell);
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const v = grid[y * COLS + x];
      if (!v) continue;
      ctx.fillStyle = c[v - 1];
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
    }
    ctx.globalAlpha = 1;
    heads.forEach(([x, y], i) => {
      ctx.fillStyle = c[i];
      ctx.shadowColor = c[i]; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(x * cell + cell / 2, y * cell + cell / 2, cell * 0.62, 0, 6.3); ctx.fill();
      ctx.shadowBlur = 0;
    });
  }
  function boom(x, y, color) {
    const r = canvas.getBoundingClientRect();
    window.WIR_FX?.puff(r.left + x * cell + cell / 2, r.top + y * cell + cell / 2, [color, '#fff', '#ff5fa2'], 22);
    UI.burst(r.left + x * cell, r.top + y * cell, 10);
  }

  // ======================================================================
  // Runde
  // ======================================================================
  function resetRound() {
    if (!host) dirs = ['u', 'd'];
    grid = new Uint8Array(COLS * ROWS);
    heads = [[4, ROWS - 6], [COLS - 5, 5]];
    dirs = ['u', 'd']; want = ['u', 'd'];
    tick = 0; hist = [];
    heads.forEach(([x, y], i) => { grid[y * COLS + x] = i + 1; });
    draw();
  }
  function countdown(ms) {
    resetRound();
    running = false;
    const end = Date.now() + ms;
    const box = $('trCount');
    box.hidden = false;
    (function step() {
      const left = Math.ceil((end - Date.now()) / 1000);
      box.textContent = left > 0 ? String(left) : 'Los! 💗';
      if (left > 0) setTimeout(step, 120);
      else setTimeout(() => { box.hidden = true; }, 500);
    })();
  }

  // Host: ein Tick
  function step() {
    if (!running) return;
    tick++;
    const next = heads.map(([x, y], i) => {
      if (want[i] !== OPP[dirs[i]]) dirs[i] = want[i];
      const [dx, dy] = DIRS[dirs[i]];
      return [x + dx, y + dy];
    });
    const crash = next.map(([x, y]) => x < 0 || y < 0 || x >= COLS || y >= ROWS || grid[y * COLS + x] !== 0);
    if (next[0][0] === next[1][0] && next[0][1] === next[1][1]) { crash[0] = crash[1] = true; }
    next.forEach(([x, y], i) => { if (!crash[i]) grid[y * COLS + x] = i + 1; });
    heads = next.map((h, i) => (crash[i] ? heads[i] : h));
    hist.push([tick, heads[0][0], heads[0][1], heads[1][0], heads[1][1]]);
    if (hist.length > 5) hist.shift();
    send({ t: 'f', n: tick, h: heads });
    draw();
    if (crash[0] || crash[1]) endRound(crash[0] && crash[1] ? -1 : crash[0] ? 1 : 0, next, crash);
  }

  function endRound(w, next, crash) {
    running = false;
    clearInterval(loop);
    if (w >= 0) score[w]++;
    const c = colors();
    (crash || []).forEach((cr, i) => { if (cr) { const [x, y] = next[i]; boom(Math.max(0, Math.min(COLS - 1, x)), Math.max(0, Math.min(ROWS - 1, y)), c[i]); } });
    const done = score[0] >= WIN || score[1] >= WIN;
    send({ t: 'end', w, s: score, done });
    showEnd(w, done);
    post(`/api/trail/${m.id}/result`, { s1: score[0], s2: score[1] }).catch(() => {});
    if (!done) setTimeout(() => startRound(), 2600);
  }

  function startRound() {
    if (!host || !m) return;
    round++;
    send({ t: 'cd', round, ms: 3000 });
    countdown(3000);
    setTimeout(() => { if (!m) return; running = true; clearInterval(loop); loop = setInterval(step, TICK); }, 3000);
  }

  function showEnd(w, done) {
    renderScore();
    const name = i => i === me ? 'Du' : (window.WIR_LOOK?.partner()?.name || 'Schatz');
    const txt = w < 0 ? 'Beide gecrasht – unentschieden 💥' : `${name(w)} ${w === me ? 'gewinnst' : 'gewinnt'} die Runde`;
    $('trStatus').textContent = done ? (score[me] >= WIN ? 'Du hast das Match gewonnen! 🏆' : `${name(1 - me)} hat das Match gewonnen 💗`) : txt;
    if (done) {
      if (score[me] >= WIN) UI.burst(window.innerWidth / 2, window.innerHeight / 3, 30);
      setTimeout(() => { m = null; leaveTopic(); render(); loadStats(); }, 3500);
    }
  }
  const renderScore = () => { $('trScore').textContent = `${score[me]} : ${score[1 - me]}`; };

  // ======================================================================
  // Nachrichten
  // ======================================================================
  function send(data) { if (m) post(`/api/trail/${m.id}/msg`, data).catch(() => {}); }

  function onMsg(d) {
    lastHeard = Date.now();
    if (d.t === 'leave') { $('trStatus').textContent = 'Die andere Person hat das Match verlassen 💭'; stop(); return; }
    if (d.t === 'ready' || d.t === 'accept') {
      if (host && !otherReady) { otherReady = true; score = [0, 0]; round = 0; renderScore(); startRound(); }
      return;
    }
    if (host) {
      if (d.t === 'dir' && DIRS[d.d]) want[1] = d.d;
      return;
    }
    // Gast
    if (d.t === 'cd') { clearInterval(readyTimer); countdown(d.ms); $('trStatus').textContent = `Runde ${d.round}`; }
    else if (d.t === 'f') {
      const h = d.h;
      if (!grid) resetRound();
      h.forEach(([x, y], i) => { if (x >= 0 && y >= 0 && x < COLS && y < ROWS) grid[y * COLS + x] = i + 1; });
      // fehlende Zwischenschritte (bei 1 Feld pro Tick) auffüllen
      heads.forEach(([px, py], i) => {
        const [x, y] = h[i];
        if (Math.abs(x - px) + Math.abs(y - py) > 1) for (let k = 1; k < Math.abs(x - px) + Math.abs(y - py); k++) {
          const ix = px + Math.sign(x - px) * Math.min(k, Math.abs(x - px)), iy = py + (Math.abs(x - px) >= k ? 0 : Math.sign(y - py) * (k - Math.abs(x - px)));
          if (ix >= 0 && iy >= 0 && ix < COLS && iy < ROWS) grid[iy * COLS + ix] = i + 1;
        }
      });
      heads = h;
      draw();
    } else if (d.t === 'end') {
      score = d.s;
      if (d.w >= 0 || d.w === -1) { const c = colors(); heads.forEach(([x, y], i) => { if (d.w === -1 || d.w !== i) boom(x, y, c[i]); }); }
      showEnd(d.w, d.done);
    }
  }

  // eigene Richtung
  function turn(d) {
    if (!m || !DIRS[d]) return;
    if (host) want[0] = d;
    else { if (d === OPP[dirs[1]] || d === dirs[1]) return; dirs[1] = d; send({ t: 'dir', d }); } // Umkehren verhindert auch der Host
  }
  document.querySelectorAll('[data-trdir]').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); turn(b.dataset.trdir); }));
  window.addEventListener('keydown', e => {
    if (!$('s-trail').classList.contains('active')) return;
    const d = { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r' }[e.key];
    if (d) { e.preventDefault(); turn(d); }
  });
  // Wischen auf dem Spielfeld
  let sw = null;
  canvas.addEventListener('pointerdown', e => { sw = [e.clientX, e.clientY]; e.preventDefault(); });
  canvas.addEventListener('pointermove', e => {
    if (!sw) return;
    const dx = e.clientX - sw[0], dy = e.clientY - sw[1];
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'd' : 'u'));
    sw = [e.clientX, e.clientY];
  });
  canvas.addEventListener('pointerup', () => { sw = null; });
  canvas.addEventListener('touchmove', e => e.preventDefault(), { passive: false });

  // ======================================================================
  // Match: einladen, annehmen, verbinden, beenden
  // ======================================================================
  async function joinTopic() {
    leaveTopic();
    unsub = await pb.realtime.subscribe('trail/' + m.id, onMsg).catch(() => null);
    host = m.p1 === myId(); me = host ? 0 : 1;
    otherReady = false; lastHeard = Date.now(); score = [m.s1 || 0, m.s2 || 0];
    resetRound(); renderScore();
    $('trStatus').textContent = host ? 'Warte, bis beide bereit sind …' : 'Verbinde …';
    clearInterval(readyTimer);
    readyTimer = setInterval(() => { if (!running) send({ t: 'ready' }); }, 1000);
    send({ t: 'ready' });
  }
  function leaveTopic() { try { unsub?.(); } catch (_) {} unsub = null; clearInterval(readyTimer); clearInterval(loop); running = false; }
  function stop() { leaveTopic(); m = null; setTimeout(() => { render(); loadStats(); }, 2500); }

  async function load() {
    const r = await pb.send('/api/trail', {});
    m = r.match;
    render();
    if (m?.status === 'playing' && $('s-trail').classList.contains('active')) joinTopic();
  }

  function render() {
    const p = window.WIR_LOOK?.partner()?.name || 'Schatz';
    $('trLobby').hidden = !!(m && m.status === 'playing');
    $('trGame').hidden = !(m && m.status === 'playing');
    $('trInvite').hidden = !!m;
    $('trAccept').hidden = !(m && m.status === 'invited' && m.p2 === myId());
    $('trLobbyText').textContent = !m ? `Fordere ${p} heraus – ihr fahrt live gegeneinander.`
      : m.status === 'invited' ? (m.p1 === myId() ? `Warte auf ${p} … 🏁` : `${p} will Herzspur spielen!`) : '';
    $('trCancel').hidden = !m;
    size(); draw();
    window.WIR_BADGE?.('gbTrail', m?.status === 'invited' && m.p2 === myId() ? 'Du bist dran' : m ? 'Läuft' : 'Neu', m?.status === 'invited' && m.p2 === myId() ? 'hot' : m ? 'run' : 'new');
  }

  $('trInvite').addEventListener('click', async () => {
    try { m = await post('/api/trail/invite'); render(); $('trLobbyText').textContent += ' Sie bekommt eine Einladung per Push.'; }
    catch (err) { $('trLobbyText').textContent = UI.errText(err); }
  });
  $('trAccept').addEventListener('click', async () => {
    try { m = await post(`/api/trail/${m.id}/accept`); render(); joinTopic(); }
    catch (err) { $('trLobbyText').textContent = UI.errText(err); await load(); }
  });
  $('trCancel').addEventListener('click', async () => {
    if (!m || !confirm('Match beenden?')) return;
    try { await post(`/api/trail/${m.id}/leave`); } catch (_) {}
    leaveTopic(); m = null; render(); loadStats();
  });

  // App geschlossen / Bildschirm gewechselt -> sauber abbrechen
  function bail() {
    if (!m || m.status !== 'playing') return;
    try { fetch(pb.buildURL(`/api/trail/${m.id}/leave`), { method: 'POST', keepalive: true, headers: { Authorization: pb.authStore.token } }); } catch (_) {}
    leaveTopic(); m = null;
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) bail(); });
  window.addEventListener('pagehide', bail);
  // Verbindung weg? (5 s nichts von der anderen Seite während des Spiels)
  setInterval(() => {
    if (!m || m.status !== 'playing' || !unsub) return;
    send({ t: 'ping' });
    if (Date.now() - lastHeard > 6000) { $('trStatus').textContent = 'Verbindung weg – Match abgebrochen 💭'; post(`/api/trail/${m.id}/leave`).catch(() => {}); stop(); }
  }, 1500);

  // ======================================================================
  // Statistik
  // ======================================================================
  async function loadStats() {
    const rows = await pb.collection('trail_matches').getFullList({ filter: 'status = "done"', sort: '-created' }).catch(() => []);
    const won = rows.filter(r => r.winner === myId()).length;
    $('trStats').textContent = rows.length ? `Siege ${won} · Niederlagen ${rows.length - won}` : 'Noch kein Match gespielt';
    $('gcTrailStatus').textContent = rows.length ? `${won}:${rows.length - won} Matches` : 'Lichtrennen live';
  }

  document.addEventListener('wir:show', e => {
    if (!started) return;
    if (e.detail === 's-trail') load().catch(() => {});
    else if (m && m.status === 'playing' && unsub) { post(`/api/trail/${m.id}/leave`).catch(() => {}); leaveTopic(); m = null; }
    if (e.detail === 's-games') { load().catch(() => {}); loadStats(); }
  });
  if (!location.hostname.endsWith('.ts.net')) window.WIR_TRAIL = () => ({ host, me, running, tick, score, round, otherReady, heads, m: m && m.status });
  window.addEventListener('resize', () => { if ($('s-trail').classList.contains('active')) { size(); draw(); } });
  document.addEventListener('wir:started', () => {
    started = true;
    load().catch(() => {}); loadStats();
    pb.collection('trail_matches').subscribe('*', e => {
      if (unsub) return;
      if (e.record.status === 'playing' && $('s-trail').classList.contains('active') && m?.id === e.record.id) { m = e.record; render(); joinTopic(); return; }
      load().catch(() => {});
    }).catch(() => {});
  });
})();
