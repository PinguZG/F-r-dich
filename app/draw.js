// Zusammen zeichnen (27.10.2026): Galerie (#s-draw) + gemeinsame Zeichenfläche (#s-canvas).
// Jedes Bild hat feste Größe (1200×1600) und mehrere Ebenen. Jeder Strich wird nach dem Absetzen über
// /api/draw/{id}/stroke gespeichert (Server vergibt die Reihenfolge seq) und kommt per Realtime bei der anderen
// Person an. Während des Zeichnens gehen Zwischenpunkte + Cursor über /api/draw/{id}/live (nur weitergereicht).
// Das Bild entsteht immer gleich: alle nicht rückgängig gemachten Striche in seq-Reihenfolge auf ihre Ebene.
// Pinsel: Stift, Bleistift (körnig, fester Zufall pro Strich), Marker, Airbrush, Radierer; dazu Füllen,
// gerade Linie/Ellipse durch Halten am Strichende, Pipette durch langes Halten ohne Bewegung.
(() => {
  const pb = window.WIR_PB;
  const $ = id => document.getElementById(id);
  const myId = () => (pb.authStore.record || pb.authStore.model)?.id;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const pbMs = s => s ? Date.parse(String(s).replace(' ', 'T')) : 0;
  const post = (path, body) => pb.send(path, { method: 'POST', body, requestKey: null });
  const store = { get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch (_) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} } };
  const W = 1200, H = 1600;
  const mkCanvas = (w = W, h = H, opts) => { const c = document.createElement('canvas'); c.width = w; c.height = h; c._ctx = c.getContext('2d', opts); return c; };

  // ======================================================================
  // Pinsel
  // ======================================================================
  const TOOLS = {
    pen:    { ico: '🖊️', name: 'Stift',    size: 10, op: 1 },
    pencil: { ico: '✏️', name: 'Bleistift', size: 6,  op: 0.9 },
    marker: { ico: '🖍️', name: 'Marker',   size: 30, op: 0.6 },
    air:    { ico: '💨', name: 'Airbrush', size: 90, op: 0.5 },
    eraser: { ico: '🩹', name: 'Radierer', size: 40, op: 1 },
    fill:   { ico: '🪣', name: 'Füllen',   size: 0,  op: 1 },
  };
  const DEFAULT_PALETTE = ['#1f1a24', '#ffffff', '#e0457b', '#ff7ab8', '#f26d5b', '#f7a072', '#f5c518', '#34d399', '#14b8c4', '#3b9eff', '#7b5cff', '#8a5a3c'];
  const pref = Object.assign({ tool: 'pen', color: '#e0457b', sizes: {}, ops: {} }, store.get('wir-draw-pref') || {});
  const savePref = () => store.set('wir-draw-pref', pref);
  const sizeOf = t => pref.sizes[t] ?? TOOLS[t].size;
  const opOf = t => pref.ops[t] ?? TOOLS[t].op;
  let palette = store.get('wir-draw-palette') || DEFAULT_PALETTE.slice();
  let recent = store.get('wir-draw-recent') || [];

  // fester Zufall pro Strich (gleiches Ergebnis auf beiden Geräten und beim Neuzeichnen)
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const widthAt = (d, p) => Math.max(0.6, d.s * (0.25 + 0.75 * p));
  const strokeAlpha = d => d.t === 'marker' ? d.o * 0.85 : d.o;

  // malt die Punkte ab Index `from` (Paint-Zustand st hält Zufall + Fortschritt) auf ctx – immer mit Deckkraft 1,
  // die Deckkraft des Strichs kommt erst beim Zusammensetzen dazu (so dunkeln Überlappungen im selben Strich nicht nach)
  function paint(ctx, d, st, final) {
    const P = d.p, n = P.length / 3;
    const col = d.t === 'eraser' ? '#000' : d.c;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = col; ctx.fillStyle = col;
    if (d.k === 'l' || d.k === 'e') {
      ctx.lineWidth = d.s;
      ctx.beginPath();
      if (d.k === 'l') { ctx.moveTo(P[0], P[1]); ctx.lineTo(P[3], P[4]); }
      else ctx.ellipse(P[0], P[1], Math.max(1, Math.abs(P[3])), Math.max(1, Math.abs(P[4])), 0, 0, Math.PI * 2);
      ctx.stroke(); ctx.restore(); st.done = n; return;
    }
    const pt = i => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
    const stamp = d.t === 'pencil' || d.t === 'air';
    if (n === 1 && final) {
      const [x, y, p] = pt(0);
      if (stamp) stampSeg(ctx, d, st, x, y, x, y, p); else { ctx.beginPath(); ctx.arc(x, y, widthAt(d, p) / 2, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore(); st.done = 1; return;
    }
    for (let i = Math.max(1, st.done || 1); i < n; i++) {
      const [x0, y0, p0] = pt(i - 1), [x1, y1, p1] = pt(i);
      const m1x = (x0 + x1) / 2, m1y = (y0 + y1) / 2;
      let sx, sy;
      if (i === 1) { sx = x0; sy = y0; } else { const [xa, ya] = pt(i - 2); sx = (xa + x0) / 2; sy = (ya + y0) / 2; }
      if (stamp) stampSeg(ctx, d, st, sx, sy, m1x, m1y, (p0 + p1) / 2, x0, y0);
      else {
        ctx.lineWidth = widthAt(d, (p0 + p1) / 2);
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(x0, y0, m1x, m1y); ctx.stroke();
      }
      st.done = i + 1;
    }
    if (final && n > 1) {
      const [xa, ya] = pt(n - 2), [x1, y1, p1] = pt(n - 1);
      const mx = (xa + x1) / 2, my = (ya + y1) / 2;
      if (stamp) stampSeg(ctx, d, st, mx, my, x1, y1, p1);
      else { ctx.lineWidth = widthAt(d, p1); ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(x1, y1); ctx.stroke(); }
    }
    ctx.restore();
  }
  // Bleistift (Körnung) und Airbrush (weiche Tupfer) entlang einer Strecke, optional über Kontrollpunkt (cx, cy)
  function stampSeg(ctx, d, st, ax, ay, bx, by, p, cx, cy) {
    if (!st.rand) st.rand = rng(d.r || 1);
    const R = st.rand, w = widthAt(d, p), air = d.t === 'air';
    if (cx == null) { cx = (ax + bx) / 2; cy = (ay + by) / 2; }
    const len = Math.hypot(cx - ax, cy - ay) + Math.hypot(bx - cx, by - cy);
    const step = air ? Math.max(1, w * 0.12) : Math.max(0.7, w * 0.25);
    const steps = Math.max(1, Math.ceil(len / step));
    for (let k = 0; k < steps; k++) {
      const t = k / steps, u = 1 - t;
      const x = u * u * ax + 2 * u * t * cx + t * t * bx, y = u * u * ay + 2 * u * t * cy + t * t * by;
      if (air) {
        const r = w / 2;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, hexA(d.c, 0.09)); g.addColorStop(1, hexA(d.c, 0));
        ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
      } else {
        const dots = Math.max(2, Math.round(w * 0.9));
        ctx.globalAlpha = 0.5;
        for (let j = 0; j < dots; j++) {
          const a = R() * Math.PI * 2, rr = Math.sqrt(R()) * w / 2, s = 0.8 + R() * 1.1;
          ctx.fillRect(x + Math.cos(a) * rr - s / 2, y + Math.sin(a) * rr - s / 2, s, s);
        }
        ctx.globalAlpha = 1;
      }
    }
  }
  function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }

  // ======================================================================
  // Zustand eines offenen Bildes
  // ======================================================================
  let drawing = null;           // drawings-Record
  let strokes = [];             // drawing_strokes (sortiert nach seq)
  let layerCv = new Map();      // Ebene -> Canvas
  let appliedSeq = 0;
  let curLayer = '';
  const scratch = mkCanvas(), partnerCv = mkCanvas(), work = mkCanvas();
  let fillCv = null;
  let dirtyThumb = false, thumbTimer = 0, rerenderTimer = 0;
  let viewLocked = false;
  let unsubs = [];
  const layers = () => (Array.isArray(drawing?.layers) && drawing.layers.length ? drawing.layers : [{ id: 'l1', name: 'Ebene 1', visible: true, opacity: 1 }]);

  function layerCanvas(id) {
    let c = layerCv.get(id);
    if (!c) { c = mkCanvas(); layerCv.set(id, c); }
    return c;
  }

  // Strich fertig auf seine Ebene setzen
  function apply(s) {
    const d = s.data;
    if (!d || !layers().some(l => l.id === s.layer)) return;
    const lc = layerCanvas(s.layer)._ctx;
    if (d.k === 'f') { fillAt(lc, d); return; }
    const sc = scratch._ctx;
    sc.clearRect(0, 0, W, H);
    paint(sc, d, {}, true);
    lc.save();
    lc.globalAlpha = strokeAlpha(d);
    lc.globalCompositeOperation = d.t === 'eraser' ? 'destination-out' : 'source-over';
    lc.drawImage(scratch, 0, 0);
    lc.restore();
    sc.clearRect(0, 0, W, H);
  }

  function rerender() {
    for (const c of layerCv.values()) c._ctx.clearRect(0, 0, W, H);
    appliedSeq = 0;
    for (const s of strokes) { if (!s.undone) apply(s); appliedSeq = Math.max(appliedSeq, s.seq); }
    if (live) redrawLive();
    requestDraw();
  }
  const rerenderSoon = () => { clearTimeout(rerenderTimer); rerenderTimer = setTimeout(() => { if (!live) rerender(); else rerenderSoon(); }, 250); };

  // Füllen: Grenzen aus allen sichtbaren Ebenen, Farbe auf die Ebene des Strichs
  function fillAt(lc, d) {
    if (!fillCv) fillCv = mkCanvas(W, H, { willReadFrequently: true });
    const fc = fillCv._ctx;
    composite(fc, false);
    const img = fc.getImageData(0, 0, W, H).data;
    const x0 = Math.floor(d.x), y0 = Math.floor(d.y);
    if (x0 < 0 || y0 < 0 || x0 >= W || y0 >= H) return;
    const i0 = (y0 * W + x0) * 4, tr = img[i0], tg = img[i0 + 1], tb = img[i0 + 2], ta = img[i0 + 3], tol = d.tol ?? 32;
    const same = i => Math.abs(img[i] - tr) <= tol && Math.abs(img[i + 1] - tg) <= tol && Math.abs(img[i + 2] - tb) <= tol && Math.abs(img[i + 3] - ta) <= tol;
    const mask = new Uint8Array(W * H);
    const stack = [y0 * W + x0];
    mask[y0 * W + x0] = 1;
    while (stack.length) {
      const p = stack.pop(), x = p % W, y = (p - x) / W;
      const nb = [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1];
      for (const q of nb) if (q >= 0 && !mask[q] && same(q * 4)) { mask[q] = 1; stack.push(q); }
    }
    const out = fc.createImageData(W, H), o = out.data;
    const n = parseInt(d.c.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    for (let p = 0; p < W * H; p++) {
      // 1 px aufweiten, damit keine helle Kante an Linien bleibt
      const x = p % W;
      const m = mask[p] || (x > 0 && mask[p - 1]) || (x < W - 1 && mask[p + 1]) || (p >= W && mask[p - W]) || (p < W * (H - 1) && mask[p + W]);
      if (m) { const k = p * 4; o[k] = r; o[k + 1] = g; o[k + 2] = b; o[k + 3] = 255; }
    }
    fc.putImageData(out, 0, 0);
    lc.save(); lc.globalAlpha = d.o; lc.drawImage(fillCv, 0, 0); lc.restore();
  }

  // alle sichtbaren Ebenen auf weißem Papier zusammensetzen
  function composite(ctx, withLive) {
    ctx.save();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    for (const l of layers()) {
      if (!l.visible) continue;
      ctx.globalAlpha = l.opacity ?? 1;
      ctx.drawImage(layerSource(l.id, withLive), 0, 0);
    }
    ctx.restore();
  }
  // Ebene inkl. laufendem eigenen/fremden Strich (nur für die Anzeige)
  function layerSource(id, withLive) {
    const c = layerCanvas(id);
    const mine = withLive && live && liveLayer() === id, theirs = withLive && partnerLive && partnerLive.layer === id;
    if (!mine && !theirs) return c;
    const w = work._ctx;
    w.clearRect(0, 0, W, H); w.drawImage(c, 0, 0);
    const put = (src, d) => { w.save(); w.globalAlpha = strokeAlpha(d); w.globalCompositeOperation = d.t === 'eraser' ? 'destination-out' : 'source-over'; w.drawImage(src, 0, 0); w.restore(); };
    if (theirs) put(partnerCv, partnerLive.data);
    if (mine) put(scratch, live.data);
    return work;
  }

  // ======================================================================
  // Anzeige: Ansicht (Zoom/Verschieben/Drehen) + Zeichnen pro Frame
  // ======================================================================
  const view = { s: 0.3, r: 0, x: 0, y: 0 };      // Bildschirm = Verschieben ∘ Drehen ∘ Skalieren (Bild)
  let cv = null, ctx = null, dpr = 1, vw = 0, vh = 0, drawQueued = false;
  const toScreen = (x, y) => { const c = Math.cos(view.r), s = Math.sin(view.r); return [view.x + view.s * (x * c - y * s), view.y + view.s * (x * s + y * c)]; };
  const toDoc = (sx, sy) => { const c = Math.cos(-view.r), s = Math.sin(-view.r), x = (sx - view.x) / view.s, y = (sy - view.y) / view.s; return [x * c - y * s, x * s + y * c]; };

  function resize() {
    if (!cv) return;
    const r = cv.parentElement.getBoundingClientRect();
    stageRect = r;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    vw = r.width; vh = r.height;
    cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
    cv.style.width = vw + 'px'; cv.style.height = vh + 'px';
    requestDraw();
  }
  function fit() {
    if (!vw) resize();
    const top = 64, side = 70, bottom = 20;
    view.r = 0;
    view.s = Math.min((vw - side - 16) / W, (vh - top - bottom) / H);
    view.x = side + (vw - side - 16 - W * view.s) / 2;
    view.y = top + (vh - top - bottom - H * view.s) / 2;
    requestDraw();
  }
  function requestDraw() {
    if (drawQueued) return;
    drawQueued = true;
    requestAnimationFrame(() => { drawQueued = false; drawFrame(); });
  }
  function drawFrame() {
    if (!ctx || !drawing) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    const c = Math.cos(view.r), s = Math.sin(view.r);
    ctx.setTransform(dpr * view.s * c, dpr * view.s * s, -dpr * view.s * s, dpr * view.s * c, dpr * view.x, dpr * view.y);
    ctx.shadowColor = 'rgba(0,0,0,.18)'; ctx.shadowBlur = 30 / Math.max(0.05, view.s) * view.s; ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    ctx.shadowColor = 'transparent';
    ctx.imageSmoothingQuality = 'high';
    for (const l of layers()) {
      if (!l.visible) continue;
      ctx.globalAlpha = l.opacity ?? 1;
      ctx.drawImage(layerSource(l.id, true), 0, 0);
    }
    ctx.globalAlpha = 1;
    // Vorschau für Linie/Ellipse (Quick-Shape)
    placeCursor();
  }

  // ======================================================================
  // Eingabe: Zeichnen, Gesten, Pipette, Quick-Shape
  // ======================================================================
  let live = null;              // eigener laufender Strich { data, layer, st, sid, pts, sent, lastMove, moved, shape }
  const liveLayer = () => live?.layer;
  const pointers = new Map();   // pointerId -> { x, y, type }
  let stageRect = { left: 0, top: 0 };
  const ox = ev => ev.clientX - stageRect.left, oy = ev => ev.clientY - stageRect.top;
  let gesture = null, penAt = 0, holdTimer = 0, lastTap = 0, tapUndoTimer = 0;
  const STREAM = 0.45;          // Glättung (0 = keine)

  const cid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const canDraw = () => drawing && !drawing.locked;

  function startStroke(e) {
    const tool = pref.tool;
    const [x, y] = toDoc(ox(e), oy(e));
    if (tool === 'fill') {
      commit({ k: 'f', t: 'fill', c: pref.color, s: 1, o: opOf('pen'), r: 1, x, y, tol: 32 }, curLayer);
      useColor(pref.color);
      return;
    }
    const p = e.pointerType === 'pen' ? Math.max(0.05, e.pressure || 0.5) : 1;
    live = {
      data: { k: 's', t: tool, c: pref.color, s: sizeOf(tool), o: opOf(tool), r: (Math.random() * 2147483647) | 0, p: [x, y, p] },
      layer: curLayer, st: {}, sid: cid(), sent: 0, sx: x, sy: y, lx: ox(e), ly: oy(e), t0: performance.now(), path: 0, still: performance.now(),
    };
    scratch._ctx.clearRect(0, 0, W, H);
    armHold(e);
    requestDraw();
  }
  function addPoint(e) {
    if (!live || live.shape) { if (live?.shape) moveShape(e); return; }
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    const P = live.data.p;
    for (const ev of (evs.length ? evs : [e])) {
      const [rx, ry] = toDoc(ox(ev), oy(ev));
      const lx = P[P.length - 3], ly = P[P.length - 2];
      const x = lx + (rx - lx) * (1 - STREAM), y = ly + (ry - ly) * (1 - STREAM);
      const dist = Math.hypot(x - lx, y - ly);
      if (dist < 1.2 / Math.max(0.3, view.s)) continue;
      if (P.length >= 8997) { endStroke(); return; }
      const p = ev.pointerType === 'pen' ? Math.max(0.05, ev.pressure || 0.5) : 1;
      P.push(Math.round(x * 10) / 10, Math.round(y * 10) / 10, Math.round(p * 100) / 100);
      live.path += dist;
    }
    if (Math.hypot(ox(e) - live.lx, oy(e) - live.ly) > 4) { live.lx = ox(e); live.ly = oy(e); live.still = performance.now(); armHold(e); }
    paint(scratch._ctx, live.data, live.st, false);
    sendLive();
    requestDraw();
  }
  // Halten: am Anfang ohne Bewegung = Pipette, nach Bewegung = gerade Linie / Ellipse
  function armHold(e) {
    clearTimeout(holdTimer);
    const hx = ox(e), hy = oy(e);
    holdTimer = setTimeout(() => {
      if (!live) return;
      if (live.path < 6 && live.data.p.length <= 6) { pickColor(hx, hy); cancelStroke(); return; }
      if (live.path > 30 && live.data.t !== 'eraser') snapShape();
    }, live && live.path > 30 ? 550 : 500);
  }
  function snapShape() {
    const P = live.data.p, n = P.length / 3;
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    for (let i = 0; i < n; i++) { minx = Math.min(minx, P[i * 3]); maxx = Math.max(maxx, P[i * 3]); miny = Math.min(miny, P[i * 3 + 1]); maxy = Math.max(maxy, P[i * 3 + 1]); }
    const ex = P[(n - 1) * 3], ey = P[(n - 1) * 3 + 1];
    const closed = Math.hypot(ex - P[0], ey - P[1]) < Math.max(30, live.path * 0.15) && live.path > 120;
    const d = live.data;
    if (closed) live.data = { ...d, k: 'e', p: [(minx + maxx) / 2, (miny + maxy) / 2, 1, (maxx - minx) / 2, (maxy - miny) / 2, 1] };
    else live.data = { ...d, k: 'l', p: [P[0], P[1], 1, ex, ey, 1] };
    live.shape = true; live.st = {};
    scratch._ctx.clearRect(0, 0, W, H);
    paint(scratch._ctx, live.data, live.st, true);
    navigator.vibrate?.(10);
    requestDraw();
  }
  function moveShape(e) {
    const [x, y] = toDoc(ox(e), oy(e)), d = live.data;
    if (d.k === 'l') { d.p[3] = x; d.p[4] = y; }
    else { d.p[3] = Math.abs(x - d.p[0]); d.p[4] = Math.abs(y - d.p[1]); }
    scratch._ctx.clearRect(0, 0, W, H);
    live.st = {};
    paint(scratch._ctx, d, live.st, true);
    requestDraw();
  }
  function endStroke() {
    clearTimeout(holdTimer);
    if (!live) return;
    const l = live;
    paint(scratch._ctx, l.data, l.st, true);
    post(`/api/draw/${drawing.id}/live`, { t: 'end', sid: l.sid }).catch(() => {});
    live = null;
    scratch._ctx.clearRect(0, 0, W, H);
    commit(l.data, l.layer, l.sid);
    useColor(l.data.c);
  }
  function cancelStroke() {
    clearTimeout(holdTimer);
    if (!live) return;
    post(`/api/draw/${drawing.id}/live`, { t: 'end', sid: live.sid }).catch(() => {});
    live = null;
    scratch._ctx.clearRect(0, 0, W, H);
    requestDraw();
  }

  // Strich sofort lokal zeigen, dann speichern
  async function commit(data, layer, sid = cid()) {
    const tmp = { id: 'tmp-' + sid, cid: sid, seq: appliedSeq + 0.5, author: myId(), layer, data, undone: false, pending: true };
    strokes.push(tmp);
    apply(tmp);
    requestDraw();
    markDirty();
    try {
      const r = await post(`/api/draw/${drawing.id}/stroke`, { layer, data, cid: sid });
      const i = strokes.indexOf(tmp);
      const dup = strokes.find(s => s.id === r.id);
      if (i >= 0) { if (dup) strokes.splice(i, 1); else strokes[i] = r; }   // Realtime kann schneller gewesen sein
      strokes.sort((a, b) => a.seq - b.seq);
      if (r.seq < appliedSeq) rerenderSoon();
      appliedSeq = Math.max(appliedSeq, r.seq);
    } catch (err) {
      const k = strokes.indexOf(tmp); if (k >= 0) strokes.splice(k, 1);
      rerender();
      toast(err?.status === 423 ? '🔒 Das Bild ist gesperrt' : 'Nicht gespeichert: ' + UI.errText(err));
    }
  }

  // Live-Punkte an die andere Person (gebündelt)
  let liveTimer = 0;
  function sendLive() {
    if (liveTimer || !live) return;
    liveTimer = setTimeout(() => {
      liveTimer = 0;
      if (!live || live.shape) return;
      const P = live.data.p, n = P.length / 3;
      if (n <= live.sent) return;
      const i = live.sent;
      live.sent = n;
      const d = { ...live.data, p: P.slice(i * 3) };
      post(`/api/draw/${drawing.id}/live`, { t: 'pts', sid: live.sid, layer: live.layer, i, data: d }).catch(() => {});
      post(`/api/draw/${drawing.id}/live`, { t: 'cur', x: P[(n - 1) * 3], y: P[(n - 1) * 3 + 1] }).catch(() => {});
    }, 70);
  }

  function pickColor(sx, sy) {
    const [x, y] = toDoc(sx, sy);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    if (!fillCv) fillCv = mkCanvas(W, H, { willReadFrequently: true });
    composite(fillCv._ctx, false);
    const px = fillCv._ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
    setColor('#' + [px[0], px[1], px[2]].map(v => v.toString(16).padStart(2, '0')).join(''));
    toast('💧 Farbe übernommen');
  }

  // ---------- Gesten (zwei/drei Finger), Mausrad ----------
  function gestureStart() {
    const ps = [...pointers.values()];
    const [a, b] = ps;
    gesture = {
      n: ps.length, maxN: Math.max(gesture?.maxN || 0, ps.length), t0: gesture?.t0 || performance.now(), moved: gesture?.moved || 0,
      cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, dist: Math.hypot(b.x - a.x, b.y - a.y), ang: Math.atan2(b.y - a.y, b.x - a.x),
      v: { ...view },
    };
  }
  function gestureMove() {
    const ps = [...pointers.values()];
    if (ps.length < 2 || !gesture) return;
    const [a, b] = ps;
    const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, dist = Math.hypot(b.x - a.x, b.y - a.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
    gesture.moved = Math.max(gesture.moved, Math.abs(dist - gesture.dist), Math.hypot(cx - gesture.cx, cy - gesture.cy));
    if (viewLocked) return;
    const g = gesture, s = Math.min(8, Math.max(0.05, g.v.s * dist / g.dist));
    let dr = ang - g.ang;
    if (Math.abs(dr) < 0.12) dr = 0;              // kleine Drehungen ignorieren (nur bewusstes Drehen)
    const r = g.v.r + dr;
    // Punkt unter dem Startmittelpunkt bleibt unter den Fingern
    view.s = g.v.s; view.r = g.v.r; view.x = g.v.x; view.y = g.v.y;
    const [dx, dy] = toDoc(g.cx, g.cy);
    view.s = s; view.r = r;
    const c = Math.cos(r), sn = Math.sin(r);
    view.x = cx - s * (dx * c - dy * sn);
    view.y = cy - s * (dx * sn + dy * c);
    requestDraw();
  }
  function gestureEnd() {
    const g = gesture;
    gesture = null;
    if (!g || g.moved > 12 || performance.now() - g.t0 > 350) return;
    if (g.maxN >= 3) { redo(); return; }
    // zwei Finger tippen = rückgängig; zweimal schnell = einpassen
    const now = performance.now();
    if (now - lastTap < 400) { clearTimeout(tapUndoTimer); lastTap = 0; if (!viewLocked) fit(); return; }
    lastTap = now;
    tapUndoTimer = setTimeout(() => undo(), 320);
  }

  function bindStage() {
    const stage = $('dwStage');
    stage.addEventListener('pointerdown', e => {
      stageRect = stage.getBoundingClientRect();
      if (e.pointerType === 'mouse' && e.button === 1) { e.preventDefault(); pointers.set(e.pointerId, { x: ox(e), y: oy(e), pan: true }); stage.setPointerCapture(e.pointerId); return; }
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.pointerType === 'pen') penAt = performance.now();
      if (e.pointerType === 'touch' && performance.now() - penAt < 1500) return;   // Handballen beim Stift ignorieren
      try { stage.setPointerCapture(e.pointerId); } catch (_) {}
      pointers.set(e.pointerId, { x: ox(e), y: oy(e), type: e.pointerType });
      if (pointers.size >= 2) {
        // zweiter Finger kurz nach dem ersten: kein Strich, sondern Geste
        if (live && performance.now() - live.t0 < 260) cancelStroke();
        else if (live) return;
        gestureStart();
        return;
      }
      if (!canDraw()) { if (drawing?.locked) toast('🔒 Das Bild ist gesperrt'); return; }
      startStroke(e);
    });
    stage.addEventListener('pointermove', e => {
      const p = pointers.get(e.pointerId);
      if (!p) { if (e.pointerType === 'pen' || e.pointerType === 'mouse') sendCursorHover(e); return; }
      if (p.pan) { if (!viewLocked) { view.x += ox(e) - p.x; view.y += oy(e) - p.y; requestDraw(); } p.x = ox(e); p.y = oy(e); return; }
      p.x = ox(e); p.y = oy(e);
      if (gesture) { gestureMove(); return; }
      if (live) addPoint(e);
    });
    const up = e => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      pointers.delete(e.pointerId);
      if (gesture) { if (pointers.size < 2) gestureEnd(); return; }
      if (p.pan) return;
      if (live) { if (e.type === 'pointercancel') cancelStroke(); else endStroke(); }
    };
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);
    stage.addEventListener('contextmenu', e => e.preventDefault());
    stage.addEventListener('touchstart', e => { if (e.cancelable) e.preventDefault(); }, { passive: false });
    stage.addEventListener('wheel', e => {
      e.preventDefault();
      if (viewLocked) return;
      const zoom = e.ctrlKey || e.deltaMode === 1 || (Math.abs(e.deltaY) >= 50 && !e.deltaX);
      if (zoom) {
        const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0025));
        const [dx, dy] = toDoc(ox(e), oy(e));
        view.s = Math.min(8, Math.max(0.05, view.s * f));
        const c = Math.cos(view.r), s = Math.sin(view.r);
        view.x = ox(e) - view.s * (dx * c - dy * s);
        view.y = oy(e) - view.s * (dx * s + dy * c);
      } else { view.x -= e.deltaX; view.y -= e.deltaY; }
      requestDraw();
    }, { passive: false });
    // Safari-Trackpad (gesturechange) nicht als Seiten-Zoom
    stage.addEventListener('gesturestart', e => e.preventDefault());
    window.addEventListener('resize', () => { if (drawing && $('s-canvas').classList.contains('active')) resize(); });
    document.addEventListener('keydown', e => {
      if (!drawing || !$('s-canvas').classList.contains('active') || e.target.matches('input, textarea')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
      else if (e.key === '0' && !viewLocked) fit();
    });
  }

  let curSent = 0;
  function sendCursorHover(e) {
    if (!drawing || performance.now() - curSent < 120) return;
    curSent = performance.now();
    const [x, y] = toDoc(ox(e), oy(e));
    if (x < -50 || y < -50 || x > W + 50 || y > H + 50) return;
    post(`/api/draw/${drawing.id}/live`, { t: 'cur', x, y }).catch(() => {});
  }

  // ======================================================================
  // Partner: Live-Strich + Cursor
  // ======================================================================
  let partnerLive = null, partnerCur = null, curHide = 0;
  function onLive(msg) {
    if (!drawing || msg.from === myId()) return;
    if (msg.t === 'cur') { partnerCur = [msg.x, msg.y]; clearTimeout(curHide); curHide = setTimeout(() => { partnerCur = null; placeCursor(); }, 3000); placeCursor(); return; }
    if (msg.t === 'pts') {
      if (!partnerLive || partnerLive.sid !== msg.sid) {
        if (msg.i !== 0) return;
        partnerLive = { sid: msg.sid, layer: msg.layer, data: { ...msg.data, p: [] }, st: {} };
        partnerCv._ctx.clearRect(0, 0, W, H);
      }
      const P = partnerLive.data.p;
      if (msg.i !== P.length / 3) return;     // Lücke -> warten auf den fertigen Strich
      P.push(...msg.data.p);
      paint(partnerCv._ctx, partnerLive.data, partnerLive.st, false);
      requestDraw();
      return;
    }
    if (msg.t === 'end' || msg.t === 'bye') {
      // kurz stehen lassen, bis der gespeicherte Strich per Realtime da ist
      const sid = msg.sid;
      setTimeout(() => { if (partnerLive && (msg.t === 'bye' || partnerLive.sid === sid)) { partnerLive = null; partnerCv._ctx.clearRect(0, 0, W, H); requestDraw(); } }, msg.t === 'bye' ? 0 : 1500);
      if (msg.t === 'bye') { partnerCur = null; placeCursor(); }
    }
  }
  function redrawLive() {
    if (live) { scratch._ctx.clearRect(0, 0, W, H); live.st = {}; paint(scratch._ctx, live.data, live.st, !!live.shape); }
  }
  function placeCursor() {
    const dot = $('dwCursor');
    if (!dot) return;
    if (!partnerCur) { dot.hidden = true; return; }
    const [x, y] = toScreen(partnerCur[0], partnerCur[1]);
    dot.hidden = false;
    dot.style.transform = `translate(${x}px,${y}px)`;
    dot.style.setProperty('--c', window.WIR_HEARTS?.partner || '#3b9eff');
  }

  // gespeicherte Striche per Realtime
  function onStroke(ev) {
    const r = ev.record;
    if (!drawing || r.drawing !== drawing.id) return;
    const i = strokes.findIndex(s => s.id === r.id || (r.cid && s.cid === r.cid));
    if (ev.action === 'create') {
      if (i >= 0) { if (strokes[i].pending) { strokes[i] = r; strokes.sort((a, b) => a.seq - b.seq); } return; }
      strokes.push(r);
      strokes.sort((a, b) => a.seq - b.seq);
      if (partnerLive && partnerLive.sid === r.cid) { partnerLive = null; partnerCv._ctx.clearRect(0, 0, W, H); }
      if (r.seq > appliedSeq && !r.undone) { apply(r); appliedSeq = r.seq; requestDraw(); }
      else rerenderSoon();
    } else if (ev.action === 'update') {
      if (i >= 0) { const was = strokes[i].undone; strokes[i] = r; if (was !== r.undone) rerenderSoon(); }
    } else if (ev.action === 'delete' && i >= 0) { strokes.splice(i, 1); rerenderSoon(); }
  }
  function onDrawingChange(ev) {
    if (!drawing || ev.record.id !== drawing.id) return;
    if (ev.action === 'delete') { toast('Das Bild wurde gelöscht'); closeCanvas(); UI.show('s-draw'); return; }
    const before = JSON.stringify(drawing.layers);
    drawing = ev.record;
    if (JSON.stringify(drawing.layers) !== before) { ensureLayer(); rerenderSoon(); renderLayers(); }
    renderTop();
  }

  // ======================================================================
  // Rückgängig / Wiederholen (pro Person, auf dem Server)
  // ======================================================================
  async function undo() {
    if (!canDraw()) return;
    try {
      const r = await post(`/api/draw/${drawing.id}/undo`, {});
      if (!r.stroke) { toast('Nichts zum Rückgängigmachen'); return; }
      const s = strokes.find(x => x.id === r.stroke.id);
      if (s) s.undone = true;
      rerender(); markDirty();
    } catch (err) { toast(UI.errText(err)); }
  }
  async function redo() {
    if (!canDraw()) return;
    try {
      const r = await post(`/api/draw/${drawing.id}/redo`, {});
      if (!r.stroke) { toast('Nichts zum Wiederholen'); return; }
      const s = strokes.find(x => x.id === r.stroke.id);
      if (s) s.undone = false;
      rerender(); markDirty();
    } catch (err) { toast(UI.errText(err)); }
  }

  // ======================================================================
  // Vorschaubild (Galerie) – gebündelt, nach kurzer Ruhe
  // ======================================================================
  function markDirty() { dirtyThumb = true; clearTimeout(thumbTimer); thumbTimer = setTimeout(saveThumb, 5000); }
  async function saveThumb() {
    if (!dirtyThumb || !drawing) return;
    if (live) { thumbTimer = setTimeout(saveThumb, 3000); return; }
    dirtyThumb = false;
    const t = mkCanvas(450, 600);
    composite(fillCv?._ctx ? fillCv._ctx : (fillCv = mkCanvas(W, H, { willReadFrequently: true }))._ctx, false);
    t._ctx.drawImage(fillCv, 0, 0, 450, 600);
    const blob = await new Promise(r => t.toBlob(r, 'image/jpeg', 0.85));
    if (!blob) return;
    const fd = new FormData();
    fd.append('thumb', blob, 'thumb.jpg');
    await pb.send(`/api/draw/${drawing.id}/thumb`, { method: 'POST', body: fd, requestKey: null }).catch(console.error);
  }

  async function exportBlob(type = 'image/png') {
    const c = mkCanvas();
    composite(c._ctx, false);
    return new Promise(r => c.toBlob(r, type, 0.92));
  }

  // ======================================================================
  // Öffnen / Schließen
  // ======================================================================
  function ensureLayer() {
    const ls = layers();
    if (!ls.some(l => l.id === curLayer)) curLayer = ls[ls.length - 1].id;
  }

  async function openDrawing(id) {
    closeCanvas();
    UI.show('s-canvas');
    toast('Lade …');
    try {
      drawing = await pb.collection('drawings').getOne(id);
      strokes = await pb.collection('drawing_strokes').getFullList({ filter: pb.filter('drawing = {:d}', { d: id }), sort: 'seq', batch: 500 });
    } catch (err) { toast('Konnte nicht laden: ' + UI.errText(err)); return; }
    layerCv = new Map();
    curLayer = store.get('wir-draw-layer-' + id) || '';
    ensureLayer();
    viewLocked = !!store.get('wir-draw-viewlock');
    resize(); fit();
    rerender();
    renderTop(); renderTools();
    toast('');
    unsubs.push(await pb.realtime.subscribe('draw/' + id, e => { try { onLive(typeof e === 'string' ? JSON.parse(e) : e); } catch (_) {} }).catch(() => null));
    unsubs.push(await pb.collection('drawing_strokes').subscribe('*', onStroke, { filter: pb.filter('drawing = {:d}', { d: id }) }).catch(() => null));
    unsubs.push(await pb.collection('drawings').subscribe(id, onDrawingChange).catch(() => null));
  }
  function closeCanvas() {
    if (drawing) {
      if (dirtyThumb) saveThumb();
      post(`/api/draw/${drawing.id}/live`, { t: 'bye' }).catch(() => {});
    }
    for (const u of unsubs) { try { u?.(); } catch (_) {} }
    unsubs = [];
    clearTimeout(thumbTimer);
    live = null; partnerLive = null; partnerCur = null; pointers.clear(); gesture = null;
    drawing = null;
  }

  // ======================================================================
  // Oberfläche: Kopfleiste, Regler, Sheets
  // ======================================================================
  let toastTimer = 0;
  function toast(t) {
    const b = $('dwToast');
    b.textContent = t; b.hidden = !t;
    clearTimeout(toastTimer);
    if (t && t !== 'Lade …') toastTimer = setTimeout(() => { b.hidden = true; }, 1800);
  }
  function renderTop() {
    if (!drawing) return;
    $('dwTitle').textContent = drawing.title || 'Unser Bild';
    $('dwLockBar').hidden = !drawing.locked;
    if (drawing.locked) {
      const who = drawing.locked_by === myId() ? 'dir' : (window.WIR_LOOK?.partner()?.name || 'Schatz');
      $('dwLockBar').textContent = `🔒 Gesperrt von ${who}`;
    }
    $('s-canvas').classList.toggle('locked', !!drawing.locked);
    $('dwMoreLock').textContent = drawing.locked ? '🔓 Bild entsperren' : '🔒 Bild sperren';
    $('dwMoreView').textContent = viewLocked ? '🔓 Ansicht entsperren' : '📌 Ansicht sperren';
    $('dwViewLockIco').hidden = !viewLocked;
    $('dwRename').value = drawing.title || '';
  }
  const sizeToSlider = s => Math.round(Math.sqrt((s - 1) / 199) * 100);
  const sliderToSize = v => Math.round((1 + 199 * (v / 100) ** 2) * 10) / 10;
  function renderTools() {
    const t = pref.tool;
    $('dwToolBtn').textContent = TOOLS[t].ico;
    $('dwColorBtn').style.background = pref.color;
    $('dwSize').value = sizeToSlider(sizeOf(t === 'fill' ? 'pen' : t));
    $('dwOpacity').value = Math.round(opOf(t === 'fill' ? 'pen' : t) * 100);
    $('dwSide').classList.toggle('off', t === 'fill');
    document.querySelectorAll('[data-dwtool]').forEach(b => b.classList.toggle('on', b.dataset.dwtool === t));
    const dot = $('dwSizeDot'), px = Math.max(4, Math.min(40, sizeOf(t) * view.s));
    dot.style.width = dot.style.height = px + 'px';
    dot.style.background = t === 'eraser' ? 'transparent' : pref.color;
  }
  function setColor(c) {
    pref.color = c.toLowerCase(); savePref();
    if (pref.tool === 'eraser') pref.tool = 'pen';
    renderTools(); renderColor();
  }
  function useColor(c) {
    recent = [c, ...recent.filter(x => x !== c)].slice(0, 10);
    store.set('wir-draw-recent', recent);
  }

  // ---------- Farbwähler: Sättigung/Helligkeit-Feld + Farbton-Regler + Hex, Palette, Zuletzt ----------
  const hsv = { h: 330, s: 0.7, v: 0.88 };
  function hexToHsv(hex) {
    const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { h: (h * 60 + 360) % 360, s: mx ? d / mx : 0, v: mx };
  }
  function hsvToHex({ h, s, v }) {
    const f = n => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
    return '#' + [f(5), f(3), f(1)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
  }
  function drawSV() {
    const c = $('dwSV'), x = c.getContext('2d'), w = c.width, h = c.height;
    x.fillStyle = `hsl(${hsv.h},100%,50%)`; x.fillRect(0, 0, w, h);
    const g1 = x.createLinearGradient(0, 0, w, 0); g1.addColorStop(0, '#fff'); g1.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g1; x.fillRect(0, 0, w, h);
    const g2 = x.createLinearGradient(0, 0, 0, h); g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(1, '#000');
    x.fillStyle = g2; x.fillRect(0, 0, w, h);
    const k = $('dwSVKnob');
    k.style.left = hsv.s * 100 + '%'; k.style.top = (1 - hsv.v) * 100 + '%';
    k.style.background = pref.color;
  }
  function renderColor() {
    if ($('dwColorSheet').hidden) return;
    Object.assign(hsv, hexToHsv(pref.color));
    $('dwHue').value = Math.round(hsv.h);
    $('dwHex').value = pref.color;
    $('dwColorNow').style.background = pref.color;
    drawSV();
    const sw = (c, onLong) => {
      const b = el('button', 'dw-sw' + (c === pref.color ? ' on' : ''));
      b.type = 'button'; b.style.background = c; b.setAttribute('aria-label', c);
      b.addEventListener('click', () => setColor(c));
      if (onLong) {
        let t = 0;
        b.addEventListener('pointerdown', () => { t = setTimeout(() => { t = 0; onLong(); }, 600); });
        b.addEventListener('pointerup', () => clearTimeout(t));
        b.addEventListener('pointerleave', () => clearTimeout(t));
        b.addEventListener('contextmenu', e => e.preventDefault());
      }
      return b;
    };
    $('dwPalette').replaceChildren(...palette.map(c => sw(c, () => { if (confirm('Farbe aus der Palette entfernen?')) { palette = palette.filter(x => x !== c); store.set('wir-draw-palette', palette); renderColor(); } })));
    const add = el('button', 'dw-sw add', '＋'); add.type = 'button'; add.setAttribute('aria-label', 'Farbe speichern');
    add.addEventListener('click', () => { if (!palette.includes(pref.color)) { palette.push(pref.color); store.set('wir-draw-palette', palette.slice(-24)); renderColor(); } });
    $('dwPalette').append(add);
    $('dwRecent').replaceChildren(...recent.map(c => sw(c)));
    $('dwRecentWrap').hidden = !recent.length;
  }
  function bindColor() {
    const sv = $('dwSV');
    const pick = e => {
      const r = sv.getBoundingClientRect();
      hsv.s = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      hsv.v = 1 - Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      pref.color = hsvToHex(hsv); savePref(); renderTools();
      $('dwHex').value = pref.color; $('dwColorNow').style.background = pref.color;
      drawSV();
    };
    let down = false;
    sv.addEventListener('pointerdown', e => { down = true; sv.setPointerCapture(e.pointerId); pick(e); });
    sv.addEventListener('pointermove', e => { if (down) pick(e); });
    sv.addEventListener('pointerup', () => { down = false; renderColor(); });
    sv.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
    $('dwHue').addEventListener('input', () => {
      hsv.h = +$('dwHue').value; pref.color = hsvToHex(hsv); savePref(); renderTools();
      $('dwHex').value = pref.color; $('dwColorNow').style.background = pref.color; drawSV();
    });
    $('dwHex').addEventListener('change', () => { const v = $('dwHex').value.trim(); if (/^#?[0-9a-f]{6}$/i.test(v)) setColor(v.startsWith('#') ? v : '#' + v); });
  }

  // ---------- Ebenen ----------
  async function saveLayers(list) {
    try { drawing = await post(`/api/draw/${drawing.id}/meta`, { layers: list }); ensureLayer(); rerender(); renderLayers(); }
    catch (err) { toast(err?.status === 423 ? '🔒 Das Bild ist gesperrt' : UI.errText(err)); }
  }
  function renderLayers() {
    if (!drawing || $('dwLayerSheet').hidden) return;
    const ls = layers();
    $('dwLayers').replaceChildren(...ls.slice().reverse().map(l => {
      const idx = ls.indexOf(l);
      const row = el('div', 'dw-layer' + (l.id === curLayer ? ' on' : ''));
      const eye = el('button', 'dw-eye', l.visible ? '👁️' : '🚫'); eye.type = 'button'; eye.setAttribute('aria-label', 'Ein/aus');
      eye.addEventListener('click', () => saveLayers(ls.map(x => x.id === l.id ? { ...x, visible: !x.visible } : x)));
      const prev = el('canvas', 'dw-lprev'); prev.width = 45; prev.height = 60;
      const pc = prev.getContext('2d'); pc.fillStyle = '#fff'; pc.fillRect(0, 0, 45, 60); pc.drawImage(layerCanvas(l.id), 0, 0, 45, 60);
      const mid = el('div', 'dw-lmid');
      const name = el('button', 'dw-lname', l.name); name.type = 'button';
      name.addEventListener('click', () => { curLayer = l.id; store.set('wir-draw-layer-' + drawing.id, l.id); renderLayers(); });
      const op = el('input'); op.type = 'range'; op.min = 0; op.max = 100; op.value = Math.round((l.opacity ?? 1) * 100); op.setAttribute('aria-label', 'Deckkraft');
      op.addEventListener('input', () => { l.opacity = op.value / 100; requestDraw(); });
      op.addEventListener('change', () => saveLayers(ls.map(x => x.id === l.id ? { ...x, opacity: op.value / 100 } : x)));
      mid.append(name, op);
      const tools = el('div', 'dw-ltools');
      const btn = (t, label, fn, off) => { const b = el('button', '', t); b.type = 'button'; b.disabled = !!off; b.setAttribute('aria-label', label); b.addEventListener('click', fn); return b; };
      const swap = (a, b) => { const c = ls.slice(); [c[a], c[b]] = [c[b], c[a]]; saveLayers(c); };
      tools.append(
        btn('▲', 'Nach oben', () => swap(idx, idx + 1), idx === ls.length - 1),
        btn('▼', 'Nach unten', () => swap(idx, idx - 1), idx === 0),
        btn('🗑', 'Löschen', () => { if (ls.length > 1 && confirm(`„${l.name}“ löschen?`)) saveLayers(ls.filter(x => x.id !== l.id)); }, ls.length < 2),
      );
      row.append(eye, prev, mid, tools);
      return row;
    }));
  }

  // ---------- Kopfleiste + Sheets verdrahten ----------
  function bindUi() {
    $('dwBack').addEventListener('click', () => { closeCanvas(); UI.show('s-draw'); loadGallery(); });
    $('dwUndo').addEventListener('click', undo);
    $('dwRedo').addEventListener('click', redo);
    $('dwToolBtn').addEventListener('click', () => UI.sheet('dwToolSheet'));
    $('dwColorBtn').addEventListener('click', () => { UI.sheet('dwColorSheet'); setTimeout(renderColor, 30); });
    $('dwLayerBtn').addEventListener('click', () => { UI.sheet('dwLayerSheet'); setTimeout(renderLayers, 30); });
    $('dwMore').addEventListener('click', () => { renderTop(); UI.sheet('dwMoreSheet'); });
    $('dwTitle').addEventListener('click', () => { renderTop(); UI.sheet('dwMoreSheet'); });
    $('dwTools').replaceChildren(...Object.entries(TOOLS).map(([k, t]) => {
      const b = el('button', 'dw-tool'); b.type = 'button'; b.dataset.dwtool = k;
      b.append(el('span', '', t.ico), el('b', '', t.name));
      b.addEventListener('click', () => { pref.tool = k; savePref(); renderTools(); UI.sheet('dwToolSheet', false); });
      return b;
    }));
    $('dwSize').addEventListener('input', () => { const t = pref.tool === 'fill' ? 'pen' : pref.tool; pref.sizes[t] = sliderToSize(+$('dwSize').value); savePref(); renderTools(); });
    $('dwOpacity').addEventListener('input', () => { const t = pref.tool === 'fill' ? 'pen' : pref.tool; pref.ops[t] = Math.max(0.02, +$('dwOpacity').value / 100); savePref(); });
    $('dwAddLayer').addEventListener('click', () => {
      const ls = layers();
      if (ls.length >= 12) { toast('Höchstens 12 Ebenen'); return; }
      let n = ls.length + 1; while (ls.some(l => l.name === 'Ebene ' + n)) n++;
      const id = 'l' + Date.now().toString(36);
      curLayer = id; store.set('wir-draw-layer-' + drawing.id, id);
      saveLayers([...ls, { id, name: 'Ebene ' + n, visible: true, opacity: 1 }]);
    });
    $('dwRenameSave').addEventListener('click', async () => {
      try { drawing = await post(`/api/draw/${drawing.id}/meta`, { title: $('dwRename').value }); renderTop(); toast('Gespeichert ✓'); }
      catch (err) { toast(UI.errText(err)); }
    });
    $('dwMoreLock').addEventListener('click', async () => {
      try { drawing = await post(`/api/draw/${drawing.id}/meta`, { locked: !drawing.locked }); renderTop(); UI.sheet('dwMoreSheet', false); }
      catch (err) { toast(UI.errText(err)); }
    });
    $('dwMoreView').addEventListener('click', () => { viewLocked = !viewLocked; store.set('wir-draw-viewlock', viewLocked); renderTop(); UI.sheet('dwMoreSheet', false); });
    $('dwMoreFit').addEventListener('click', () => { fit(); UI.sheet('dwMoreSheet', false); });
    $('dwMoreExport').addEventListener('click', async () => {
      const blob = await exportBlob('image/png');
      const name = (drawing.title || 'bild').replace(/[^\wäöüÄÖÜß -]/g, '').trim() + '.png';
      const file = new File([blob], name, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file] }); return; } catch (_) { return; } }
      const a = el('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    });
    $('dwMoreMem').addEventListener('click', async () => {
      try {
        toast('Speichere …');
        const blob = await exportBlob('image/jpeg');
        const fd = new FormData();
        fd.append('image', blob, 'zeichnung.jpg');
        fd.append('caption', ('🎨 ' + (drawing.title || '')).trim().slice(0, 200));
        fd.append('author', myId());
        fd.append('order', -Date.now() % 1e9);
        await pb.collection('photos').create(fd);
        toast('In Erinnerungen gespeichert ✓');
        UI.sheet('dwMoreSheet', false);
      } catch (err) { toast(UI.errText(err)); }
    });
    $('dwMoreDel').addEventListener('click', async () => {
      if (!confirm(`„${drawing.title}“ wirklich löschen? Das geht nicht rückgängig.`)) return;
      try { const id = drawing.id; closeCanvas(); await pb.collection('drawings').delete(id); UI.show('s-draw'); loadGallery(); }
      catch (err) { toast(UI.errText(err)); }
    });
    bindColor();
  }

  // ======================================================================
  // Galerie
  // ======================================================================
  let token = '';
  async function loadGallery() {
    try { token = await pb.files.getToken(); } catch (_) {}
    const list = await pb.collection('drawings').getFullList({ sort: '-updated', expand: 'last_by' });
    const box = $('dwGallery');
    const add = el('button', 'dw-card dw-new glass'); add.type = 'button';
    add.append(el('span', 'dw-plus', '＋'), el('b', '', 'Neues Bild'));
    add.addEventListener('click', newDrawing);
    box.replaceChildren(add, ...list.map(d => {
      const b = el('button', 'dw-card glass'); b.type = 'button';
      const pic = el('div', 'dw-thumb');
      if (d.thumb) { const i = el('img'); i.alt = ''; i.loading = 'lazy'; i.src = pb.files.getURL(d, d.thumb, { token }); pic.append(i); }
      if (d.locked) pic.append(el('span', 'dw-lock', '🔒'));
      const who = d.expand?.last_by?.id === myId() ? 'du' : d.expand?.last_by?.name || '';
      b.append(pic, el('b', '', d.title || 'Unser Bild'), el('small', '', [who, ago(pbMs(d.last_at || d.updated))].filter(Boolean).join(' · ')));
      b.addEventListener('click', () => openDrawing(d.id));
      return b;
    }));
    const n = list.length;
    if ($('homeDrawInfo')) $('homeDrawInfo').textContent = '';
    return n;
  }
  function ago(ms) {
    const s = Math.round((Date.now() - ms) / 1000);
    if (s < 90) return 'gerade';
    if (s < 3600) return `vor ${Math.round(s / 60)} Min.`;
    if (s < 86400) return `vor ${Math.round(s / 3600)} Std.`;
    const d = Math.round(s / 86400); return d === 1 ? 'gestern' : `vor ${d} Tagen`;
  }
  async function newDrawing() {
    try {
      const n = (await pb.collection('drawings').getList(1, 1)).totalItems + 1;
      const d = await post('/api/draw/new', { title: 'Bild ' + n });
      openDrawing(d.id);
    } catch (err) { alert('Ging nicht: ' + UI.errText(err)); }
  }

  // ======================================================================
  // Start
  // ======================================================================
  let started = false;
  document.addEventListener('wir:show', e => {
    document.body.classList.toggle('drawing', e.detail === 's-canvas');
    if (e.detail !== 's-canvas' && drawing) closeCanvas();
    if (started && e.detail === 's-draw') loadGallery().catch(console.error);
    if (e.detail === 's-canvas') setTimeout(resize, 30);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && drawing) { if (live) endStroke(); saveThumb(); post(`/api/draw/${drawing.id}/live`, { t: 'bye' }).catch(() => {}); }
    else if (!document.hidden && drawing) { pb.collection('drawing_strokes').getFullList({ filter: pb.filter('drawing = {:d}', { d: drawing.id }), sort: 'seq', batch: 500 }).then(s => { strokes = s; rerender(); }).catch(() => {}); }
  });
  document.addEventListener('wir:started', () => {
    started = true;
    pb.collection('drawings').subscribe('*', () => { if ($('s-draw').classList.contains('active')) loadGallery().catch(() => {}); }).catch(() => {});
  });
  cv = $('dwCanvas'); ctx = cv.getContext('2d');
  bindStage(); bindUi(); renderTools();
  window.WIR_DRAW = {
    open: openDrawing, gallery: loadGallery,
    state: () => ({ id: drawing?.id, n: strokes.filter(s => !s.undone).length, layers: layers().length, locked: !!drawing?.locked, partnerLive: !!partnerLive, cursor: !!partnerCur }),
  };
})();
