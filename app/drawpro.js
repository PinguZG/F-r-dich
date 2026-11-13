// Draw Pro – Oberfläche: Pinselbibliothek mit Vorschau, Pinsel-Einstellungen, Stift & Eingabe, Auswahl-Werkzeuge, Symmetrie.
// Nutzt die Engine aus draw.js über window.WIR_DRAWX (läuft danach) und die Pinsel aus brushes.js.
(() => {
  const X = window.WIR_DRAWX, BR = window.WIR_BRUSHES;
  if (!X || !BR) return;
  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const { pref, savePref, W, H } = X;
  const SPECIAL_ORDER = [['fill', 'Füllen'], ['grad', 'Verlauf'], ['line', 'Linie'], ['rect', 'Rechteck'], ['ell', 'Ellipse'], ['text', 'Text'],
    ['sel_rect', 'Rechteck-Auswahl'], ['sel_ell', 'Ellipse-Auswahl'], ['sel_lasso', 'Lasso'], ['sel_wand', 'Zauberstab']];

  // ---------- Sheet-Gerüst ----------
  function mkSheet(id, title) {
    const wrap = el('div', 'sheet-wrap'); wrap.id = id; wrap.hidden = true;
    const bd = el('div', 'sheet-backdrop'); bd.dataset.close = '';
    const sh = el('div', 'sheet dp-sheet'); sh.append(el('div', 'sheet-grip'));
    const x = el('button', 'sheet-x', '✕'); x.type = 'button'; x.dataset.close = ''; x.setAttribute('aria-label', 'Schließen');
    const body = el('div', 'dp-body');
    sh.append(x, el('h2', 'sheet-title', title), body);
    wrap.append(bd, sh); document.body.append(wrap);
    return body;
  }
  const slider = (label, min, max, step, val, on, fmt) => {
    const row = el('label', 'dp-row'); const t = el('span', '', label); const v = el('b', '', fmt ? fmt(val) : String(val));
    const i = el('input'); i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = val;
    i.addEventListener('input', () => { v.textContent = fmt ? fmt(+i.value) : i.value; on(+i.value); });
    row.append(t, v, i); return row;
  };
  const toggle = (label, val, on) => {
    const row = el('label', 'dp-row dp-tg'); const t = el('span', '', label);
    const i = el('input'); i.type = 'checkbox'; i.checked = !!val; i.addEventListener('change', () => on(i.checked));
    row.append(t, i); return row;
  };

  // ---------- Pinsel-Vorschau (S-Strich) ----------
  const pvCache = new Map();
  function preview(id, w = 150, h = 46, bp, color) {
    const c = el('canvas', 'dp-pv'); c.width = w * 2; c.height = h * 2;
    const x = c.getContext('2d'); x.scale(2, 2);
    const col = color || getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#b8165a';
    const hex = /^#[0-9a-f]{6}$/i.test(col) ? col : '#b8165a';
    const d = { k: 's', t: id, c: hex, s: Math.min(BR.def(id).size, 26), o: 1, r: 12345, p: BR.samplePath(w, h) };
    if (bp) d.bp = bp;
    const tmp = X.mkCanvas(w * 2, h * 2); tmp._ctx.scale(2, 2);
    try { X.paint(tmp._ctx, d, {}, true); } catch (_) {}
    x.save();
    if (BR.def(id).erase) { x.fillStyle = 'rgba(140,140,160,.18)'; x.fillRect(0, 0, w, h); x.restore(); x.save(); x.fillStyle = hex; x.globalAlpha = .15; x.fillRect(0, 0, w, h); x.globalAlpha = 1; x.globalCompositeOperation = 'destination-out'; }
    x.scale(.5, .5); x.drawImage(tmp, 0, 0); x.restore();
    return c;
  }

  // ---------- Werkzeug-Sheet: Werkzeuge + Pinselbibliothek ----------
  let cat = BR.cats.includes(pref.cat) ? pref.cat : 'Skizze';
  const toolBody = $('dwTools');
  function renderTools() {
    toolBody.className = 'dp-tools';
    const cur = pref.tool;
    const spec = el('div', 'dp-spec');
    SPECIAL_ORDER.forEach(([k, name]) => {
      const b = el('button', 'dp-sp' + (cur === k ? ' on' : '')); b.type = 'button'; b.dataset.dwtool = k;
      b.append(el('span', '', X.SPECIAL[k].ico), el('small', '', name));
      b.addEventListener('click', () => pick(k));
      spec.append(b);
    });
    const tabs = el('div', 'dp-tabs');
    [...BR.cats, 'Eigene'].forEach(c => {
      const b = el('button', 'dp-tab' + (c === cat ? ' on' : ''), c); b.type = 'button';
      b.addEventListener('click', () => { cat = c; pref.cat = c; renderTools(); });
      tabs.append(b);
    });
    const grid = el('div', 'dp-grid');
    if (cat === 'Eigene') {
      (pref.custom || []).forEach(cb => {
        const b = el('button', 'dp-br'); b.type = 'button';
        b.append(preview(cb.base, 150, 46, cb.bp), el('small', '', cb.name));
        b.addEventListener('click', () => { pref.bp[cb.base] = { ...cb.bp }; pref.sizes[cb.base] = cb.size; pref.ops[cb.base] = cb.op; pick(cb.base); });
        grid.append(b);
      });
      if (!(pref.custom || []).length) grid.append(el('small', 'dp-empty', 'Noch keine eigenen Pinsel – in den Pinsel-Einstellungen speichern.'));
    } else {
      BR.byCat(cat).forEach(b0 => {
        const b = el('button', 'dp-br' + (cur === b0.id ? ' on' : '')); b.type = 'button'; b.dataset.dwtool = b0.id;
        b.append(preview(b0.id, 150, 46, pref.bp[b0.id]), el('small', '', b0.name));
        b.addEventListener('click', () => pick(b0.id));
        grid.append(b);
      });
    }
    const foot = el('div', 'dp-foot');
    const fb = (t, fn) => { const b = el('button', 'dp-fb', t); b.type = 'button'; b.addEventListener('click', fn); return b; };
    foot.append(fb('Pinsel-Einstellungen', () => { UI.sheet('dwToolSheet', false); openBrushSettings(); }),
      fb('Stift & Eingabe', () => { UI.sheet('dwToolSheet', false); openPenSettings(); }));
    const sym = el('div', 'dp-sym'); sym.append(el('span', '', 'Symmetrie'));
    [['off', 'Aus'], ['v', 'Vertikal'], ['h', 'Horizontal'], ['q', 'Beides']].forEach(([k, t]) => {
      const b = el('button', 'dp-chip' + (pref.sym === k ? ' on' : ''), t); b.type = 'button';
      b.addEventListener('click', () => { pref.sym = k; savePref(); renderTools(); X.requestDraw(); });
      sym.append(b);
    });
    toolBody.replaceChildren(spec, tabs, grid, sym, foot);
    // tool-spezifische Optionen
    const opts = el('div', 'dp-opts');
    if (cur === 'fill') opts.append(slider('Toleranz', 0, 120, 1, pref.tol, v => { pref.tol = v; savePref(); }));
    if (cur === 'rect') opts.append(toggle('Gefüllt', pref.fillShape, v => { pref.fillShape = v; savePref(); }));
    if (cur === 'grad') { const row = el('label', 'dp-row dp-tg'); row.append(el('span', '', 'Zweite Farbe')); const i = el('input'); i.type = 'color'; i.value = pref.color2; i.addEventListener('input', () => { pref.color2 = i.value; savePref(); }); row.append(i); opts.append(row); }
    if (opts.children.length) toolBody.append(opts);
  }
  function pick(k) { pref.tool = k; savePref(); X.renderTools(); renderTools(); UI.sheet('dwToolSheet', false); }

  // ---------- Pinsel-Einstellungen ----------
  const brushBody = mkSheet('dwBrushSheet', 'Pinsel-Einstellungen');
  function openBrushSettings() {
    const id = pref.tool, d0 = BR.def(id);
    if (!BR.has(id)) { X.toast('Dieser Pinsel hat keine Parameter'); return; }
    const m = BR.merged({ t: id, bp: pref.bp[id] });
    const set = (key, v) => { pref.bp[id] = { ...(pref.bp[id] || {}), [key]: v }; savePref(); upd(); };
    const pv = el('div', 'dp-pvbox'); const upd = () => pv.replaceChildren(preview(id, 260, 70, pref.bp[id]));
    const pct = v => Math.round(v * 100) + ' %';
    brushBody.replaceChildren(
      el('h3', 'dp-name', d0.name), pv,
      slider('Abstand', 0.02, 2, 0.01, m.sp, v => set('sp', v), pct),
      slider('Streuung', 0, 2, 0.01, m.sc, v => set('sc', v), pct),
      slider('Fluss', 0.02, 1, 0.01, m.fl, v => set('fl', v), pct),
      slider('Härte', 0, 1, 0.01, m.hd, v => set('hd', v), pct),
      slider('Druck → Größe', 0, 1, 0.01, m.pS, v => set('pS', v), pct),
      slider('Druck → Deckkraft', 0, 1, 0.01, m.pO, v => set('pO', v), pct),
      slider('Körnung', 0, 1, 0.01, m.gr, v => set('gr', v), pct),
      slider('Drehung variieren', 0, 1, 0.01, m.rj, v => set('rj', v), pct),
      slider('Stabilisator (Glättung)', 0, 0.9, 0.01, pref.pen.smooth, v => { pref.pen.smooth = v; savePref(); }, pct),
    );
    upd();
    const row = el('div', 'dp-foot');
    const b = (t, fn) => { const x = el('button', 'dp-fb', t); x.type = 'button'; x.addEventListener('click', fn); return x; };
    row.append(
      b('Zurücksetzen', () => { delete pref.bp[id]; savePref(); openBrushSettings(); }),
      b('Als eigenen Pinsel speichern', () => {
        const name = (window.prompt('Name des Pinsels', d0.name + ' 2') || '').trim().slice(0, 24);
        if (!name) return;
        pref.custom = [...(pref.custom || []), { id: 'c' + Date.now().toString(36), name, base: id, bp: { ...(pref.bp[id] || {}) }, size: pref.sizes[id] ?? d0.size, op: pref.ops[id] ?? d0.op }].slice(-24);
        savePref(); X.toast('Gespeichert ✓');
      }),
    );
    brushBody.append(row);
    UI.sheet('dwBrushSheet');
  }

  // ---------- Stift & Eingabe ----------
  const penBody = mkSheet('dwPenSheet', 'Stift & Eingabe');
  function curveCanvas(g) {
    const c = el('canvas', 'dp-curve'); c.width = 120; c.height = 60;
    const x = c.getContext('2d');
    x.strokeStyle = 'rgba(120,120,140,.35)'; x.strokeRect(.5, .5, 119, 59);
    x.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#e0457b'; x.lineWidth = 2; x.beginPath();
    for (let i = 0; i <= 40; i++) { const p = i / 40; const px = p * 120, py = 60 - Math.pow(p, g) * 60; i ? x.lineTo(px, py) : x.moveTo(px, py); }
    x.stroke(); return c;
  }
  function openPenSettings() {
    const seen = !!$('dwPenInd') && !$('dwPenInd').hidden;
    const st = el('div', 'dp-status' + (seen ? ' on' : ''), seen ? 'Apple Pencil / Stift erkannt' : 'Noch kein Stift benutzt – Druck, Neigung und Handballen-Schutz greifen, sobald du mit dem Stift zeichnest.');
    const mkCurve = (label, key) => {
      const box = el('div', 'dp-curvebox'); const cv = curveCanvas(pref.pen[key]);
      const row = slider(label, 0.3, 3, 0.05, pref.pen[key], v => { pref.pen[key] = v; savePref(); box.replaceChild(curveCanvas(v), box.firstChild); }, v => v < 0.95 ? 'weicher' : v > 1.05 ? 'fester' : 'linear');
      box.append(cv, row); return box;
    };
    penBody.replaceChildren(st,
      toggle('Nur Stift zeichnet (Finger schieben & zoomen)', pref.pen.only, v => { pref.pen.only = v; savePref(); }),
      toggle('Geschwindigkeit als Druck (Finger/Maus)', pref.pen.speed, v => { pref.pen.speed = v; savePref(); }),
      toggle('Neigung nutzen (Bleistift, Kohle)', pref.pen.tilt, v => { pref.pen.tilt = v; savePref(); }),
      mkCurve('Druckkurve Größe', 'cs'), mkCurve('Druckkurve Deckkraft', 'co'),
      slider('Stabilisator (Glättung)', 0, 0.9, 0.01, pref.pen.smooth, v => { pref.pen.smooth = v; savePref(); }, v => Math.round(v * 100) + ' %'),
    );
    UI.sheet('dwPenSheet');
  }
  $('dwPenInd')?.addEventListener('click', openPenSettings);
  $('dwSymBtn')?.addEventListener('click', () => { const o = ['off', 'v', 'h', 'q']; pref.sym = o[(o.indexOf(pref.sym) + 1) % 4]; savePref(); X.toast('Symmetrie: ' + ({ off: 'aus', v: 'vertikal', h: 'horizontal', q: 'beides' })[pref.sym]); X.requestDraw(); });
  $('dwExportKind')?.addEventListener('change', e => { X.exportKind = e.target.value; });

  // ---------- Auswahl ----------
  let sel = null;             // { poly, layer, tx, ty, sc, rot, cp, float, img }
  let shape = null;           // laufende Auswahl-Form { tool, pts }
  const bar = $('dwSelBar');
  const polyBox = P => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (let i = 0; i < P.length; i += 3) { x0 = Math.min(x0, P[i]); x1 = Math.max(x1, P[i]); y0 = Math.min(y0, P[i + 1]); y1 = Math.max(y1, P[i + 1]); } return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 }; };
  const matrix = s => {
    const b = polyBox(s.poly), c = Math.cos(s.rot) * s.sc, sn = Math.sin(s.rot) * s.sc;
    return [c, sn, -sn, c, b.cx + s.tx - (c * b.cx - sn * b.cy), b.cy + s.ty - (sn * b.cx + c * b.cy)];
  };
  const xform = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const inside = (P, x, y) => { let r = false; const n = P.length / 3; for (let i = 0, j = n - 1; i < n; j = i++) { const xi = P[i * 3], yi = P[i * 3 + 1], xj = P[j * 3], yj = P[j * 3 + 1]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) r = !r; } return r; };
  const tPoly = s => { const m = matrix(s), out = []; for (let i = 0; i < s.poly.length; i += 3) out.push(...xform(m, s.poly[i], s.poly[i + 1]), 0); return out; };
  const simplify = (pts, eps) => {     // Ramer-Douglas-Peucker auf [x,y,0,…]
    const n = pts.length / 3; if (n < 4) return pts;
    const keep = new Uint8Array(n); keep[0] = keep[n - 1] = 1;
    const st = [[0, n - 1]];
    while (st.length) {
      const [a, b] = st.pop(); let mx = 0, mi = -1;
      const ax = pts[a * 3], ay = pts[a * 3 + 1], bx = pts[b * 3], by = pts[b * 3 + 1], L = Math.hypot(bx - ax, by - ay) || 1;
      for (let i = a + 1; i < b; i++) { const d = Math.abs((by - ay) * pts[i * 3] - (bx - ax) * pts[i * 3 + 1] + bx * ay - by * ax) / L; if (d > mx) { mx = d; mi = i; } }
      if (mx > eps && mi > 0) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
    }
    const out = []; for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i * 3], pts[i * 3 + 1], 0);
    return out;
  };

  function showBar() {
    if (!bar) return;
    bar.hidden = !sel;
    if (!sel) return;
    $('dwSelScale').value = Math.round(sel.sc * 100); $('dwSelRot').value = Math.round(sel.rot * 180 / Math.PI);
    $('dwSelCopy').classList.toggle('on', sel.cp);
  }
  function clearSel() { sel = null; shape = null; showBar(); X.requestDraw(); }
  function makeFloat() {
    if (!sel || sel.float) return;
    sel.float = true;
    const img = X.mkCanvas(), c = img._ctx;
    c.save(); X.polyPath(c, sel.poly); c.clip(); c.drawImage(X.layerCanvas(sel.layer), 0, 0); c.restore();
    sel.img = img;
  }
  async function applySel(m) {
    if (!sel) return;
    const s = sel; const mm = m || matrix(s);
    sel = null; showBar();
    const lay = X.layers().find(l => l.id === s.layer);
    if (!lay || lay.lock) { X.toast('Ebene gesperrt'); X.requestDraw(); return; }
    await X.commit({ k: 'x', t: 'pen', c: '#000000', s: 1, o: 1, r: 1, p: s.poly.slice(0, 3000), m: mm, sl: s.layer, cp: !!s.cp }, s.layer);
    X.requestDraw();
  }
  function setSel(poly) {
    if (poly.length < 9) return;
    sel = { poly: poly.slice(0, 3000), layer: X.curLayer(), tx: 0, ty: 0, sc: 1, rot: 0, cp: false, float: false, img: null };
    showBar(); X.requestDraw();
  }
  const changed = s => s && (s.tx || s.ty || s.sc !== 1 || s.rot);

  function wandPoly(x, y) {
    const sc = 4, w = Math.floor(W / sc), h = Math.floor(H / sc);
    const cv = X.mkCanvas(W, H, { willReadFrequently: true }); X.composite(cv._ctx, false);
    const small = X.mkCanvas(w, h, { willReadFrequently: true }); small._ctx.drawImage(cv, 0, 0, w, h);
    const img = small._ctx.getImageData(0, 0, w, h).data, tol = pref.tol;
    const sx = Math.min(w - 1, Math.max(0, Math.floor(x / sc))), sy = Math.min(h - 1, Math.max(0, Math.floor(y / sc)));
    const i0 = (sy * w + sx) * 4, r = img[i0], g = img[i0 + 1], b = img[i0 + 2];
    const same = i => Math.abs(img[i] - r) <= tol && Math.abs(img[i + 1] - g) <= tol && Math.abs(img[i + 2] - b) <= tol;
    const mask = new Uint8Array(w * h), stack = [sy * w + sx]; mask[sy * w + sx] = 1;
    while (stack.length) {
      const p = stack.pop(), px = p % w, py = (p - px) / w;
      for (const q of [px > 0 ? p - 1 : -1, px < w - 1 ? p + 1 : -1, py > 0 ? p - w : -1, py < h - 1 ? p + w : -1]) if (q >= 0 && !mask[q] && same(q * 4)) { mask[q] = 1; stack.push(q); }
    }
    // Außenkontur (Moore-Nachbarschaft)
    let start = -1; for (let i = 0; i < mask.length; i++) if (mask[i]) { start = i; break; }
    if (start < 0) return [];
    const at = (px, py) => px >= 0 && py >= 0 && px < w && py < h && mask[py * w + px];
    const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
    let cx = start % w, cy = (start - cx) / w, d = 6; const pts = [cx * sc, cy * sc, 0], x0 = cx, y0 = cy; let guard = 0;
    do {
      let found = false;
      for (let k = 0; k < 8; k++) { const nd = (d + 6 + k) % 8, nx = cx + dirs[nd][0], ny = cy + dirs[nd][1]; if (at(nx, ny)) { cx = nx; cy = ny; d = nd; found = true; break; } }
      if (!found) break;
      pts.push(cx * sc, cy * sc, 0);
    } while ((cx !== x0 || cy !== y0) && ++guard < 60000);
    return simplify(pts, 2.2);
  }

  X.selStart = (e, tool, x, y) => {
    if (tool === 'sel_wand') { setSel(wandPoly(x, y)); return; }
    // innerhalb der bestehenden Auswahl: verschieben
    if (sel && inside(tPoly(sel), x, y)) {
      let last = [x, y];
      X.setDrag({
        move: ev => { const [mx, my] = X.toDoc(X.ox(ev), X.oy(ev)); if (!sel) return; makeFloat(); sel.tx += mx - last[0]; sel.ty += my - last[1]; last = [mx, my]; X.requestDraw(); },
        end: () => { X.setDrag(null); },
      });
      return;
    }
    if (sel) { if (changed(sel)) applySel(); else clearSel(); }
    shape = { tool, pts: [x, y], x0: x, y0: y };
    X.setDrag({
      move: ev => {
        const [mx, my] = X.toDoc(X.ox(ev), X.oy(ev));
        if (tool === 'sel_lasso') { const p = shape.pts, n = p.length; if (Math.hypot(mx - p[n - 2], my - p[n - 1]) > 3 / X.view.s) p.push(mx, my); } else shape.pts = [shape.x0, shape.y0, mx, my];
        X.requestDraw();
      },
      end: () => {
        X.setDrag(null);
        const s = shape; shape = null; if (!s) return;
        const p = s.pts; let poly = [];
        if (s.tool === 'sel_lasso') { for (let i = 0; i < p.length; i += 2) poly.push(p[i], p[i + 1], 0); poly = simplify(poly, 1.5); }
        else {
          const [ax, ay, bx, by] = [p[0], p[1], p[p.length - 2], p[p.length - 1]];
          if (Math.abs(bx - ax) < 4 || Math.abs(by - ay) < 4) { X.requestDraw(); return; }
          if (s.tool === 'sel_rect') poly = [ax, ay, 0, bx, ay, 0, bx, by, 0, ax, by, 0];
          else { const cx = (ax + bx) / 2, cy = (ay + by) / 2, rx = Math.abs(bx - ax) / 2, ry = Math.abs(by - ay) / 2; for (let i = 0; i < 48; i++) { const t = i / 48 * 6.2832; poly.push(cx + Math.cos(t) * rx, cy + Math.sin(t) * ry, 0); } }
        }
        setSel(poly);
      },
    });
  };
  X.hole = id => (sel && sel.float && !sel.cp && sel.layer === id) ? sel.poly : null;
  X.overlay = ctx => {
    if (shape) {
      ctx.save(); ctx.lineWidth = 1.5 / X.view.s; ctx.setLineDash([6 / X.view.s, 5 / X.view.s]); ctx.strokeStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 2;
      const p = shape.pts; ctx.beginPath();
      if (shape.tool === 'sel_lasso') { for (let i = 0; i < p.length; i += 2) i ? ctx.lineTo(p[i], p[i + 1]) : ctx.moveTo(p[i], p[i + 1]); }
      else if (shape.tool === 'sel_rect') ctx.rect(p[0], p[1], p[2] - p[0], p[3] - p[1]);
      else ctx.ellipse((p[0] + p[2]) / 2, (p[1] + p[3]) / 2, Math.abs(p[2] - p[0]) / 2, Math.abs(p[3] - p[1]) / 2, 0, 0, 6.2832);
      ctx.stroke(); ctx.restore();
    }
    if (!sel) return;
    if (sel.float && sel.img) { const m = matrix(sel); ctx.save(); ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]); ctx.drawImage(sel.img, 0, 0); ctx.restore(); }
    const P = tPoly(sel);
    ctx.save(); ctx.lineWidth = 2 / X.view.s; ctx.beginPath();
    for (let i = 0; i < P.length; i += 3) i ? ctx.lineTo(P[i], P[i + 1]) : ctx.moveTo(P[i], P[i + 1]);
    ctx.closePath();
    ctx.strokeStyle = '#000'; ctx.setLineDash([7 / X.view.s, 6 / X.view.s]); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineDashOffset = 6.5 / X.view.s; ctx.stroke(); ctx.restore();
  };
  X.toolChanged = t => { if (sel && !X.isSel(t)) { if (changed(sel)) applySel(); else clearSel(); } };

  $('dwSelScale')?.addEventListener('input', e => { if (!sel) return; makeFloat(); sel.sc = +e.target.value / 100; X.requestDraw(); });
  $('dwSelRot')?.addEventListener('input', e => { if (!sel) return; makeFloat(); sel.rot = +e.target.value * Math.PI / 180; X.requestDraw(); });
  $('dwSelCopy')?.addEventListener('click', () => { if (!sel) return; if (sel.float) { X.toast('Erst anwenden, dann kopieren'); return; } sel.cp = !sel.cp; showBar(); });
  $('dwSelOk')?.addEventListener('click', () => { if (changed(sel) || sel?.cp) applySel(); else clearSel(); });
  $('dwSelNo')?.addEventListener('click', clearSel);
  $('dwSelDel')?.addEventListener('click', () => { if (sel) applySel([0, 0, 0, 0, 0, 0]); });
  $('dwSelLayer')?.addEventListener('click', async () => {
    if (!sel) return;
    const ls = X.layers(); if (ls.length >= 12) { X.toast('Höchstens 12 Ebenen'); return; }
    const id = 'l' + Date.now().toString(36), s = sel; sel = null; showBar();
    await X.saveLayers([...ls, { id, name: 'Auswahl', visible: true, opacity: 1 }]);
    await X.commit({ k: 'x', t: 'pen', c: '#000000', s: 1, o: 1, r: 1, p: s.poly.slice(0, 3000), m: matrix(s), sl: s.layer, cp: false }, id);
  });

  // ---------- Start ----------
  const renderBase = X.renderTools;
  X.renderTools = () => { renderBase(); if (!$('dwToolSheet').hidden) renderTools(); };
  $('dwToolBtn')?.addEventListener('click', () => setTimeout(renderTools, 0));
  renderTools();
  document.addEventListener('wir:show', e => { if (e.detail !== 's-canvas') { sel = null; shape = null; showBar(); } });
})();
