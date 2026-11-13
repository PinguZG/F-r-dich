// Puzzle (13.11.2026): zusammen (Echtzeit, ein Brett) oder allein; Stufen Leicht/Mittel/Schwer/Profi, Varianten Aufgeteilt/Blind.
// Teile = Canvas mit Puzzleform, Brett mit Zoom/Schieben. Prüfung (Einrasten, Zeit, Coins) macht der Server (wir_puzzle.pb.js).
(() => {
  const pb = window.WIR_PB;
  if (!pb) return;
  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const me = () => (pb.authStore.record || pb.authStore.model)?.id;
  const post = (path, body) => pb.send(path, { method: 'POST', body, requestKey: null });
  const LEVELS = [['easy', 'Leicht', '12'], ['mid', 'Mittel', '48'], ['hard', 'Schwer', '150'], ['pro', 'Profi', '300']];
  const levelName = k => LEVELS.find(l => l[0] === k)?.[1] || k;
  const TOL = { easy: 0.6, mid: 0.45, hard: 0.3, pro: 0.2 };
  let token = '', list = [], cur = null, view = null;

  async function load() {
    try { token = await pb.files.getToken(); } catch (_) {}
    list = await pb.collection('puzzles').getFullList({ sort: '-updated' });
    const n = list.filter(g => g.status === 'playing' && g.partner).length;
    const b = $('gbPuzzle'); if (b) b.textContent = n ? n + ' offen' : '';
  }
  const imgUrl = (g, thumb) => pb.files.getURL(g, g.image, { token, ...(thumb ? { thumb: '200x270' } : {}) });
  const fmt = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');

  // ---------- Übersicht + Neu ----------
  function renderHome() {
    const box = $('pzHome'); if (!box) return;
    const row = el('div', 'pz-new');
    [['together', 'Zusammen'], ['solo', 'Allein']].forEach(([m, t]) => { const b = el('button', 'g-card glass pz-newbtn', ''); b.type = 'button'; b.append(el('b', '', t), el('span', 'pz-plus', '＋')); b.addEventListener('click', () => openNew(m)); row.append(b); });
    const g = el('div', 'py-hist');
    list.forEach(p => {
      const b = el('button', 'py-hc glass'); b.type = 'button';
      const pic = el('div', 'py-hthumb'); const i = el('img'); i.alt = ''; i.loading = 'lazy'; i.src = imgUrl(p, true); pic.append(i);
      const n = (p.state?.p || []).filter(q => q[3]).length, t = (p.state?.p || []).length;
      b.append(pic, el('b', '', `${levelName(p.level)} · ${p.partner ? 'Zusammen' : 'Allein'}`), el('small', '', p.status === 'done' ? 'Fertig ' + fmt(p.seconds) : `${n}/${t}`));
      b.addEventListener('click', () => openPuzzle(p.id)); g.append(b);
    });
    box.replaceChildren(row, g);
  }
  function mkSheet() {
    let w = $('pzSetup');
    if (!w) { w = el('div', 'sheet-wrap'); w.id = 'pzSetup'; w.hidden = true; const bd = el('div', 'sheet-backdrop'); bd.dataset.close = ''; const sh = el('div', 'sheet'); sh.append(el('div', 'sheet-grip')); const x = el('button', 'sheet-x', '✕'); x.type = 'button'; x.dataset.close = ''; const body = el('div', 'py-sheet'); sh.append(x, body); w.append(bd, sh); document.body.append(w); }
    return w.querySelector('.py-sheet');
  }
  const chips = (label, opts, val, on) => { const row = el('div', 'py-set'); row.append(el('span', '', label)); const c = el('div', 'py-chips'); opts.forEach(([v, t]) => { const b = el('button', 'dp-chip' + (v === val ? ' on' : ''), t); b.type = 'button'; b.addEventListener('click', () => { on(v); [...c.children].forEach(x => x.classList.toggle('on', x === b)); }); c.append(b); }); row.append(c); return row; };
  function openNew(mode) {
    const body = mkSheet();
    const s = { level: 'mid', variant: 'normal', rotate: false };
    const rows = [chips('Stufe', LEVELS.map(l => [l[0], `${l[1]} · ${l[2]}`]), s.level, v => { s.level = v; })];
    if (mode === 'together') rows.push(chips('Variante', [['normal', 'Normal'], ['split', 'Aufgeteilt'], ['blind', 'Blind']], s.variant, v => { s.variant = v; }));
    rows.push(chips('Drehen', [[false, 'Aus'], [true, 'An']], s.rotate, v => { s.rotate = v; }));
    const src = el('div', 'py-chips');
    const up = el('label', 'dp-fb pz-up', 'Foto hochladen'); const fi = el('input'); fi.type = 'file'; fi.accept = 'image/*'; fi.className = 'sr-only'; up.append(fi);
    fi.addEventListener('change', () => { if (fi.files[0]) create(mode, s, URL.createObjectURL(fi.files[0])); });
    const mem = el('button', 'dp-fb', 'Erinnerungen'); mem.type = 'button'; mem.addEventListener('click', () => pick(mode, s, 'photos'));
    const dr = el('button', 'dp-fb', 'Zeichnungen'); dr.type = 'button'; dr.addEventListener('click', () => pick(mode, s, 'drawings'));
    src.append(up, mem, dr);
    const grid = el('div', 'pz-pick'); grid.id = 'pzPick';
    body.replaceChildren(el('h2', 'sheet-title', mode === 'together' ? 'Zusammen puzzlen' : 'Allein puzzlen'), ...rows, el('div', 'py-set').appendChild(el('span', '', 'Bild')).parentNode, src, grid);
    UI.sheet('pzSetup');
  }
  async function pick(mode, s, coll) {
    const grid = $('pzPick'); grid.replaceChildren();
    const f = coll === 'photos' ? 'image' : 'thumb';
    const items = (await pb.collection(coll).getList(1, 30, { sort: '-created' }).catch(() => ({ items: [] }))).items.filter(x => x[f]);
    items.forEach(x => { const b = el('button', 'pz-pi'); b.type = 'button'; const i = el('img'); i.alt = ''; i.src = pb.files.getURL(x, x[f], { token, thumb: '200x200' }); b.append(i); b.addEventListener('click', () => create(mode, s, pb.files.getURL(x, x[f], { token }))); grid.append(b); });
    if (!items.length) grid.append(el('small', 'dp-empty', '–'));
  }
  async function create(mode, s, url) {
    UI.sheet('pzSetup', false);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const c = document.createElement('canvas'); c.width = 900; c.height = 1200; const x = c.getContext('2d');
      const k = Math.max(900 / img.width, 1200 / img.height), w = img.width * k, h = img.height * k; x.drawImage(img, (900 - w) / 2, (1200 - h) / 2, w, h);
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
      const fd = new FormData(); fd.append('image', blob, 'puzzle.jpg'); fd.append('level', s.level); fd.append('mode', mode); fd.append('variant', s.variant); fd.append('rotate', String(!!s.rotate));
      const g = await pb.send('/api/puzzle/new', { method: 'POST', body: fd, requestKey: null });
      await load(); openPuzzle(g.id);
    } catch (err) { alert(UI.errText ? UI.errText(err) : 'Ging nicht'); }
  }

  // ---------- Spiel ----------
  const hash = (a, b, c) => { let h = (a * 73856093) ^ (b * 19349663) ^ (c * 83492791); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) & 1) ? 1 : -1; };
  function piecePath(ctx, c, r, cols, rows, u, pad) {
    const sg = { r: c < cols - 1 ? hash(c, r, 0) : 0, b: r < rows - 1 ? hash(c, r, 1) : 0, l: c > 0 ? -hash(c - 1, r, 0) : 0, t: r > 0 ? -hash(c, r - 1, 1) : 0 };
    const x0 = pad, y0 = pad, x1 = pad + u, y1 = pad + u;
    const edge = (ax, ay, bx, by, s) => {
      const dx = bx - ax, dy = by - ay, nx = dy / u, ny = -dx / u;
      if (!s) { ctx.lineTo(bx, by); return; }
      const P = (t, o) => [ax + dx * t + nx * o * u * s, ay + dy * t + ny * o * u * s];
      ctx.lineTo(...P(0.36, 0));
      ctx.bezierCurveTo(...P(0.3, 0.1), ...P(0.3, 0.26), ...P(0.5, 0.26));
      ctx.bezierCurveTo(...P(0.7, 0.26), ...P(0.7, 0.1), ...P(0.64, 0));
      ctx.lineTo(bx, by);
    };
    ctx.beginPath(); ctx.moveTo(x0, y0);
    edge(x0, y0, x1, y0, sg.t); edge(x1, y0, x1, y1, sg.r); edge(x1, y1, x0, y1, sg.b); edge(x0, y1, x0, y0, sg.l);
    ctx.closePath();
  }

  async function openPuzzle(id) {
    cur = id; UI.show('s-puzzleplay');
    await load();
    const g = list.find(x => x.id === id);
    if (!g) return;
    const box = $('pzPlay'); box.replaceChildren(el('p', 'py-wait', 'Lade …'));
    const img = await new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = imgUrl(g); }).catch(() => null);
    if (!img) { box.replaceChildren(el('p', 'py-wait', 'Bild nicht ladbar')); return; }
    start(g, img, box);
  }
  function start(g, img, box) {
    const cols = g.cols, rows = g.rows, tol = TOL[g.level];
    const top = el('div', 'pz-top glass'); const timer = el('b', 'pz-timer', '0:00'), prog = el('small', 'pz-prog', '');
    const bPrev = el('button', 'py-ib', 'Vorschau'), bHint = el('button', 'py-ib', 'Tipp −5'), bDel = el('button', 'py-ib', '🗑');
    [bPrev, bHint, bDel].forEach(b => { b.type = 'button'; });
    top.append(timer, prog, bPrev, bHint, bDel);
    const stage = el('div', 'pz-stage'), board = el('div', 'pz-board'); stage.append(board);
    box.replaceChildren(top, stage);
    const rect = stage.getBoundingClientRect();
    const u = Math.max(14, Math.min(rect.width / (cols + 6), rect.height / (rows + 6)) * 2.2);   // Teilgröße in px bei Zoom 1
    const pad = u * 0.3, cs = u + pad * 2;
    view = { s: Math.min(1, Math.min(rect.width / ((cols + 6) * u), rect.height / ((rows + 6) * u))), x: 0, y: 0 };
    view.x = rect.width / 2 - ((cols / 2) * u) * view.s; view.y = rect.height / 2 - ((rows / 2) * u) * view.s;
    const apply = () => { board.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.s})`; };
    apply();
    const ghost = el('div', 'pz-ghost'); ghost.style.cssText = `width:${cols * u}px;height:${rows * u}px;background-image:url(${imgUrl(g)})`; board.append(ghost);
    const blindHidden = g.variant === 'blind' && g.owner !== me();
    const showGhost = on => { ghost.style.opacity = blindHidden ? 0 : on ? 0.3 : 0; };
    showGhost(g.level === 'easy');
    bPrev.hidden = g.level === 'easy' || g.level === 'pro' || blindHidden;
    bPrev.addEventListener('click', () => { showGhost(true); setTimeout(() => showGhost(false), g.level === 'mid' ? 4000 : 1500); });
    const N = cols * rows; let st = g.state.p.map(q => q.slice());
    const els = [];
    const minePiece = i => g.variant !== 'split' || ((g.owner === me()) === (i % 2 === 0));
    for (let i = 0; i < N; i++) {
      const c = i % cols, r = Math.floor(i / cols);
      const cv = el('canvas', 'pz-piece'); cv.width = cv.height = cs; const x = cv.getContext('2d');
      piecePath(x, c, r, cols, rows, u, pad);
      x.save(); x.clip(); x.drawImage(img, pad - c * u, pad - r * u, cols * u, rows * u); x.restore();
      x.lineWidth = 1.2; x.strokeStyle = 'rgba(255,255,255,.55)'; x.stroke();
      cv.dataset.i = i; cv.style.width = cv.style.height = cs + 'px'; board.append(cv); els.push(cv);
    }
    const place = i => { const q = st[i], e = els[i]; e.style.transform = `translate(${q[0] * u - pad}px,${q[1] * u - pad}px) rotate(${q[2] * 90}deg)`; e.classList.toggle('placed', !!q[3]); e.classList.toggle('lock', !minePiece(i)); e.style.zIndex = q[3] ? 1 : 3; };
    const count = () => { const n = st.filter(q => q[3]).length; prog.textContent = `${n}/${N}`; return n; };
    st.forEach((_, i) => place(i)); count();
    // Zeit
    const t0 = g.started; let done = g.status === 'done';
    clearInterval(view.t); view.t = setInterval(() => { timer.textContent = fmt(done ? g.seconds : Math.round((Date.now() - t0) / 1000)); }, 500); timer.textContent = fmt(done ? g.seconds : Math.round((Date.now() - t0) / 1000));
    // Eingabe: Teil ziehen, Brett schieben/zoomen
    const toBoard = (px, py) => { const r0 = stage.getBoundingClientRect(); return [((px - r0.left - view.x) / view.s) / u, ((py - r0.top - view.y) / view.s) / u]; };
    const ptrs = new Map(); let drag = null, pan = null, pinch = null;
    stage.addEventListener('pointerdown', e => {
      stage.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (ptrs.size === 2) { drag = null; pan = null; const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s: view.s }; return; }
      const t = e.target.closest?.('.pz-piece');
      if (t && !done && !t.classList.contains('placed') && !t.classList.contains('lock')) {
        const i = +t.dataset.i, [bx, by] = toBoard(e.clientX, e.clientY);
        drag = { i, dx: st[i][0] - (bx - 0.5), dy: st[i][1] - (by - 0.5), x0: e.clientX, y0: e.clientY, moved: false }; els[i].style.zIndex = 9;
      } else pan = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    });
    stage.addEventListener('pointermove', e => {
      if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (pinch && ptrs.size === 2) { const [a, b] = [...ptrs.values()]; view.s = Math.max(0.25, Math.min(4, pinch.s * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d)); apply(); return; }
      if (drag) { if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 5) drag.moved = true; const [bx, by] = toBoard(e.clientX, e.clientY); st[drag.i][0] = bx - 0.5 + drag.dx; st[drag.i][1] = by - 0.5 + drag.dy; place(drag.i); }
      else if (pan) { view.x = pan.vx + e.clientX - pan.x; view.y = pan.vy + e.clientY - pan.y; apply(); }
    });
    const up = async e => {
      ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null;
      if (drag) {
        const d = drag; drag = null; const q = st[d.i];
        if (!d.moved && g.rotate) q[2] = (q[2] + 1) % 4;
        const snap = q[2] === 0 && Math.abs(q[0] - (d.i % cols)) <= tol && Math.abs(q[1] - Math.floor(d.i / cols)) <= tol;
        if (snap) { q[0] = d.i % cols; q[1] = Math.floor(d.i / cols); q[3] = 1; navigator.vibrate?.(8); }
        place(d.i); count();
        try { const r = await post(`/api/puzzle/${g.id}/move`, { i: d.i, x: q[0], y: q[1], r: q[2] }); if (r.status === 'done') finish(r); } catch (_) {}
      }
      pan = null;
    };
    stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
    stage.addEventListener('wheel', e => { e.preventDefault(); const f = Math.exp(-e.deltaY * 0.0015), r0 = stage.getBoundingClientRect(), mx = e.clientX - r0.left, my = e.clientY - r0.top; const ns = Math.max(0.25, Math.min(4, view.s * f)); view.x = mx - (mx - view.x) * ns / view.s; view.y = my - (my - view.y) * ns / view.s; view.s = ns; apply(); }, { passive: false });
    stage.addEventListener('touchstart', e => { if (e.cancelable) e.preventDefault(); }, { passive: false });
    // Echtzeit: Änderungen der anderen Person
    const finish = r => { done = true; g.seconds = r.seconds; g.status = 'done'; clearInterval(view.t); timer.textContent = fmt(r.seconds); showDone(g, box); };
    pb.collection('puzzles').unsubscribe(g.id).catch(() => {});
    pb.collection('puzzles').subscribe(g.id, ev => {
      if (cur !== g.id || !ev.record) return;
      ev.record.state.p.forEach((q, i) => { if (drag && drag.i === i) return; if (q.join() !== st[i].join()) { st[i] = q.slice(); place(i); } });
      count();
      if (ev.record.status === 'done' && !done) finish(ev.record);
    }).catch(() => {});
    bHint.addEventListener('click', async () => { try { const r = await post(`/api/puzzle/${g.id}/hint`, {}); r.state.p.forEach((q, i) => { st[i] = q.slice(); place(i); }); count(); if (r.status === 'done') finish(r); } catch (err) { alert(UI.errText(err)); } });
    bDel.addEventListener('click', async () => { if (!confirm('Puzzle löschen?')) return; try { await post(`/api/puzzle/${g.id}/delete`, {}); await load(); UI.show('s-puzzle'); } catch (err) { alert(UI.errText(err)); } });
    if (done) showDone(g, box);
  }
  function showDone(g, box) {
    if (box.querySelector('.pz-done')) return;
    const d = el('div', 'pz-done glass');
    d.append(el('b', '', g.partner ? 'You are in sync' : 'Geschafft'), el('small', '', fmt(g.seconds)), el('span', 'pz-hearts', '💗'));
    const sv = el('button', 'dp-fb', 'In Erinnerungen'); sv.type = 'button';
    sv.addEventListener('click', async () => { sv.disabled = true; try { const blob = await (await fetch(imgUrl(g))).blob(); const fd = new FormData(); fd.append('image', blob, 'puzzle.jpg'); fd.append('caption', '🧩 Puzzle'); fd.append('author', me()); fd.append('order', -Date.now() % 1e9); await pb.collection('photos').create(fd); sv.textContent = 'Gespeichert ✓'; } catch (_) { sv.disabled = false; } });
    const back = el('button', 'py-go', 'Weiter'); back.type = 'button'; back.addEventListener('click', () => { UI.show('s-puzzle'); });
    d.append(sv, back); box.append(d);
    window.WIR_FX?.hearts?.();
  }

  document.addEventListener('wir:show', e => {
    if (e.detail === 's-puzzle') load().then(renderHome).catch(console.error);
    if (e.detail !== 's-puzzleplay' && view) { clearInterval(view.t); if (cur) pb.collection('puzzles').unsubscribe(cur).catch(() => {}); }
  });
  document.addEventListener('wir:started', () => { load().catch(() => {}); });
  window.WIR_PUZZLE = { open: openPuzzle, list: () => list };
})();
