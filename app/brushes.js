// Pinselbibliothek + Stempel-Engine für Zeichnen (Draw Pro). Reine Zeichen-Logik ohne Oberfläche:
//   WIR_BRUSHES.list / byCat / def(id) / paint(ctx, d, st, final) / isErase(d) / alpha(d) / comp(d) / has(id)
// Jeder Pinsel ist ein Datensatz (Spitzenform, Abstand, Streuung, Rotation, Druck→Größe/Deckkraft, Fluss, Härte …).
// Ein Strich speichert nur die Pinsel-ID (d.t) und ggf. geänderte Parameter (d.bp); gleiche Daten = gleiches Bild auf allen Geräten.
// Die vier ersten Pinsel (pen, pencil, marker, air) und fill zeichnet weiter draw.js selbst (alte Striche bleiben unverändert).
(() => {
  const rng = seed => {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  };
  const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const hsl2rgb = (h, s, l) => { const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)); return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)]; };
  const shift = (c, d) => c.map(v => Math.max(0, Math.min(255, Math.round(v + d))));

  // shape: round | soft | grain | bristle | flat | star | heart | dot | spray | hair | glow | ring
  // size/op = Vorgabe; sp = Abstand (× Breite), sc = Streuung (× Breite), fl = Fluss pro Stempel, hd = Härte,
  // pS/pO = Druck→Größe/Deckkraft, gr = Körnung, rj = Rotationsstreuung, rot = follow|fixed|random, ang = Winkel (Grad)
  const B = [
    // Skizze
    { id: 'hb',     name: 'Bleistift HB', cat: 'Skizze', shape: 'grain', size: 5, op: .9, sp: .2, sc: .35, fl: .5, pS: .5, pO: .2, gr: .8 },
    { id: 'p2b',    name: 'Bleistift 2B', cat: 'Skizze', shape: 'grain', size: 8, op: .85, sp: .18, sc: .45, fl: .55, pS: .7, pO: .5, gr: 1, tilt: 1 },
    { id: 'charcoal', name: 'Kohle', cat: 'Skizze', shape: 'grain', size: 22, op: .85, sp: .12, sc: .5, fl: .45, pS: .4, pO: .6, gr: 1, tilt: 1 },
    { id: 'colorpen', name: 'Buntstift', cat: 'Skizze', shape: 'grain', size: 7, op: .9, sp: .16, sc: .4, fl: .6, pS: .4, pO: .4, gr: .7 },
    // Tinte
    { id: 'liner',  name: 'Fineliner', cat: 'Tinte', shape: 'round', size: 4, op: 1, sp: .1, fl: 1, hd: 1, pS: 0, pO: 0 },
    { id: 'calli',  name: 'Kalligrafie', cat: 'Tinte', shape: 'flat', size: 16, op: 1, sp: .06, fl: 1, hd: 1, pS: .2, pO: 0, rot: 'fixed', ang: -40 },
    { id: 'brushpen', name: 'Brushpen', cat: 'Tinte', shape: 'round', size: 14, op: 1, sp: .06, fl: 1, hd: 1, pS: 1, pO: 0 },
    { id: 'ink',    name: 'Tuschepinsel', cat: 'Tinte', shape: 'bristle', size: 24, op: .95, sp: .08, fl: .9, hd: 1, pS: 1, pO: .2, gr: .3 },
    // Malen
    { id: 'water',  name: 'Aquarell', cat: 'Malen', shape: 'soft', size: 46, op: .5, sp: .1, fl: .12, hd: .15, pS: .4, pO: .8, edge: 1, wet: 1 },
    { id: 'gouache', name: 'Gouache', cat: 'Malen', shape: 'round', size: 30, op: .95, sp: .07, fl: .85, hd: .8, pS: .5, pO: .2, gr: .25 },
    { id: 'oil',    name: 'Öl', cat: 'Malen', shape: 'bristle', size: 34, op: 1, sp: .07, fl: .9, hd: 1, pS: .6, pO: 0, jit: 14, mix: 1 },
    { id: 'acryl',  name: 'Acryl', cat: 'Malen', shape: 'bristle', size: 28, op: 1, sp: .08, fl: 1, hd: 1, pS: .5, pO: 0, jit: 6 },
    { id: 'hilite', name: 'Textmarker', cat: 'Malen', shape: 'flat', size: 30, op: .45, sp: .05, fl: 1, hd: 1, pS: 0, pO: 0, rot: 'fixed', ang: 0, comp: 'multiply', solid: 1 },
    // Textur
    { id: 'chalk',  name: 'Kreide', cat: 'Textur', shape: 'grain', size: 26, op: .9, sp: .14, sc: .5, fl: .55, pS: .3, pO: .4, gr: 1, big: 1 },
    { id: 'pastel', name: 'Pastell', cat: 'Textur', shape: 'grain', size: 36, op: .8, sp: .14, sc: .55, fl: .4, pS: .4, pO: .7, gr: .9, big: 1 },
    { id: 'spray',  name: 'Sprühdose', cat: 'Textur', shape: 'spray', size: 60, op: 1, sp: .08, sc: 1, fl: .5, pS: .3, pO: .2 },
    { id: 'splat',  name: 'Sprenkel', cat: 'Textur', shape: 'dot', size: 40, op: 1, sp: .5, sc: 1.2, fl: 1, pS: .2, pO: 0 },
    // Effekte
    { id: 'glitter', name: 'Glitzer', cat: 'Effekte', shape: 'star', size: 34, op: 1, sp: .35, sc: .9, fl: 1, pS: .3, pO: 0, rj: 1, rot: 'random', sparkle: 1, sub: .22 },
    { id: 'stars',  name: 'Sterne', cat: 'Effekte', shape: 'star', size: 30, op: 1, sp: 1.1, sc: .15, fl: 1, pS: .4, pO: 0, rj: .3, rot: 'random' },
    { id: 'hearts', name: 'Herzen', cat: 'Effekte', shape: 'heart', size: 30, op: 1, sp: 1.1, sc: .15, fl: 1, pS: .4, pO: 0, rj: .3, rot: 'random' },
    { id: 'neon',   name: 'Neon', cat: 'Effekte', shape: 'glow', size: 14, op: 1, sp: .06, fl: 1, pS: .3, pO: 0 },
    { id: 'rainbow', name: 'Regenbogen', cat: 'Effekte', shape: 'round', size: 20, op: 1, sp: .06, fl: 1, hd: 1, pS: .5, pO: 0, rainbow: 1 },
    { id: 'fur',    name: 'Fell', cat: 'Effekte', shape: 'hair', size: 40, op: 1, sp: .22, sc: .5, fl: .9, pS: .5, pO: 0, len: 1.1 },
    { id: 'grass',  name: 'Gras', cat: 'Effekte', shape: 'hair', size: 50, op: 1, sp: .3, sc: .4, fl: 1, pS: .3, pO: 0, len: 1.8, up: 1, jit: 25 },
    // Radierer
    { id: 'eraser', name: 'Radierer', cat: 'Radierer', old: 1, erase: 1, size: 40, op: 1 },
    { id: 'ersoft', name: 'Radierer weich', cat: 'Radierer', shape: 'soft', erase: 1, size: 50, op: 1, sp: .1, fl: .25, hd: .2, pS: .5, pO: .6 },
    { id: 'erhard', name: 'Radierer hart', cat: 'Radierer', shape: 'round', erase: 1, size: 24, op: 1, sp: .08, fl: 1, hd: 1, pS: 0, pO: 0 },
    { id: 'ergrain', name: 'Radierer körnig', cat: 'Radierer', shape: 'grain', erase: 1, size: 30, op: 1, sp: .14, sc: .5, fl: .5, pS: .3, pO: .4, gr: 1, big: 1 },
    { id: 'erflat', name: 'Radierer flach', cat: 'Radierer', shape: 'flat', erase: 1, size: 28, op: 1, sp: .06, fl: 1, hd: 1, pS: 0, pO: 0, rot: 'fixed', ang: -45 },
  ];
  const OLD = [
    { id: 'pen', name: 'Stift', cat: 'Tinte', old: 1, size: 10, op: 1 },
    { id: 'pencil', name: 'Bleistift', cat: 'Skizze', old: 1, size: 6, op: .9 },
    { id: 'marker', name: 'Marker', cat: 'Malen', old: 1, size: 30, op: .6 },
    { id: 'air', name: 'Airbrush', cat: 'Malen', old: 1, size: 90, op: .5 },
  ];
  const LIST = [...OLD, ...B];
  const MAP = {}; LIST.forEach(b => { MAP[b.id] = b; });
  const CATS = ['Skizze', 'Tinte', 'Malen', 'Textur', 'Effekte', 'Radierer'];
  // Standardwerte für fehlende Felder
  const DEF = { sp: .15, sc: 0, fl: 1, hd: 1, pS: .5, pO: 0, gr: 0, rj: 0, rot: 'follow', ang: 0 };
  const def = id => MAP[id] || MAP.pen;
  const has = id => !!MAP[id] && !MAP[id].old;
  // Pinsel + Strich-Parameter (d.bp) zusammenführen
  const merged = d => { const b = def(d.t); return Object.assign({}, DEF, b, d.bp || {}); };

  // ---------- Stempel ----------
  function stamp(ctx, b, d, st, x, y, w, ang, p, R) {
    let col = st.col;
    if (b.rainbow) col = hsl2rgb((st.dist * 0.35) % 360, 0.85, 0.55);
    else if (b.jit) col = shift(st.col0, (R() - 0.5) * 2 * b.jit);
    else if (b.sparkle) col = R() < 0.5 ? hsl2rgb(R() * 360, 0.9, 0.7) : st.col0;
    const a = Math.min(1, b.fl * (1 - b.pO + b.pO * p));
    ctx.globalAlpha = a;
    ctx.save(); ctx.translate(x, y);
    const r = w / 2;
    switch (b.shape) {
      case 'round': {
        ctx.fillStyle = rgba(col, 1);
        if (b.hd < 0.95) { const g = ctx.createRadialGradient(0, 0, r * b.hd, 0, 0, r); g.addColorStop(0, rgba(col, 1)); g.addColorStop(1, rgba(col, 0)); ctx.fillStyle = g; }
        ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.2832); ctx.fill();
        if (b.gr) grainDots(ctx, col, r, R, b.gr * 0.5, 0.35, true);
        break;
      }
      case 'soft': {
        const g = ctx.createRadialGradient(0, 0, r * b.hd * 0.6, 0, 0, r);
        g.addColorStop(0, rgba(col, 1)); g.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.2832); ctx.fill();
        if (b.edge) { ctx.globalAlpha = a * 0.7; ctx.strokeStyle = rgba(shift(col, -35), 0.25); ctx.lineWidth = Math.max(1, r * 0.08); ctx.beginPath(); ctx.arc(0, 0, r * 0.92, 0, 6.2832); ctx.stroke(); }
        break;
      }
      case 'grain': grainDots(ctx, col, r, R, b.gr, 1, false, b.big, b.sc); break;
      case 'bristle': {
        const n = Math.max(4, Math.round(w / 3));
        ctx.save(); ctx.rotate(ang + Math.PI / 2);
        for (let i = 0; i < n; i++) {
          const o = ((i + 0.5) / n - 0.5) * w;
          const cc = b.mix || b.jit ? shift(col, (R() - 0.5) * (b.jit || 10)) : col;
          ctx.fillStyle = rgba(cc, 0.55 + R() * 0.45);
          ctx.fillRect(o - 0.7, -Math.max(1.5, w * 0.06) * (0.4 + R() * 0.8), 1.5 + R() * Math.max(1, w / n), Math.max(2, w * 0.12) * (0.4 + R() * 0.8));
        }
        ctx.restore(); break;
      }
      case 'flat': {
        ctx.rotate((b.rot === 'follow' ? ang : 0) + (b.ang || 0) * Math.PI / 180);
        ctx.fillStyle = rgba(col, 1);
        ctx.fillRect(-r, -r * 0.22, w, r * 0.44);
        break;
      }
      case 'star': case 'heart': {
        const sz = (b.sub ? (0.4 + R() * 0.6) * w * 0.55 : w * 0.5);
        ctx.rotate(b.rot === 'random' ? R() * 6.2832 : b.rot === 'follow' ? ang : 0);
        ctx.fillStyle = rgba(col, 1);
        ctx.beginPath();
        if (b.shape === 'star') { for (let i = 0; i < 10; i++) { const rr = i % 2 ? sz * 0.45 : sz, t = i * Math.PI / 5 - Math.PI / 2; i ? ctx.lineTo(Math.cos(t) * rr, Math.sin(t) * rr) : ctx.moveTo(Math.cos(t) * rr, Math.sin(t) * rr); } }
        else { const s = sz / 16; ctx.moveTo(0, 14 * s); ctx.bezierCurveTo(-26 * s, -2 * s, -14 * s, -20 * s, 0, -7 * s); ctx.bezierCurveTo(14 * s, -20 * s, 26 * s, -2 * s, 0, 14 * s); }
        ctx.closePath(); ctx.fill();
        break;
      }
      case 'spray': {
        const n = Math.max(6, Math.round(w * 0.5));
        ctx.fillStyle = rgba(col, 1);
        for (let i = 0; i < n; i++) { const t = R() * 6.2832, rr = Math.sqrt(R()) * r, s = 0.7 + R() * 0.9; ctx.globalAlpha = a * (0.4 + R() * 0.6); ctx.fillRect(Math.cos(t) * rr, Math.sin(t) * rr, s, s); }
        break;
      }
      case 'dot': {
        const n = 1 + Math.floor(R() * 3);
        ctx.fillStyle = rgba(col, 1);
        for (let i = 0; i < n; i++) { const t = R() * 6.2832, rr = R() * r, s = 0.8 + R() * R() * w * 0.14; ctx.beginPath(); ctx.arc(Math.cos(t) * rr, Math.sin(t) * rr, s, 0, 6.2832); ctx.fill(); }
        break;
      }
      case 'hair': {
        const n = Math.max(3, Math.round(w * 0.25)), len = w * (b.len || 1);
        ctx.strokeStyle = rgba(col, 1); ctx.lineCap = 'round';
        for (let i = 0; i < n; i++) {
          const o = (R() - 0.5) * w, ba = b.up ? -Math.PI / 2 + (R() - 0.5) * 0.6 : ang + Math.PI / 2 + (R() - 0.5) * 0.9;
          const cc = b.jit ? shift(col, (R() - 0.5) * b.jit) : col, l = len * (0.4 + R() * 0.6);
          ctx.strokeStyle = rgba(cc, 0.8); ctx.lineWidth = Math.max(0.7, w * 0.035);
          const ox = b.up ? o : Math.cos(ang + Math.PI / 2) * o, oy = b.up ? 0 : Math.sin(ang + Math.PI / 2) * o;
          ctx.beginPath(); ctx.moveTo(ox, oy); ctx.quadraticCurveTo(ox + Math.cos(ba) * l * 0.5 + (R() - 0.5) * l * 0.3, oy + Math.sin(ba) * l * 0.5, ox + Math.cos(ba) * l, oy + Math.sin(ba) * l); ctx.stroke();
        }
        break;
      }
      case 'glow': {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.4);
        g.addColorStop(0, rgba(col, 0.55)); g.addColorStop(0.4, rgba(col, 0.2)); g.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 2.4, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = Math.min(1, a * 1.2);
        ctx.fillStyle = rgba(shift(col, 200), 1); ctx.beginPath(); ctx.arc(0, 0, Math.max(0.8, r * 0.45), 0, 6.2832); ctx.fill();
        break;
      }
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }
  // körnige Spitze: viele kleine Punkte im Kreis (fester Zufall)
  function grainDots(ctx, col, r, R, gr, mul, inside, big, sc) {
    const n = Math.max(4, Math.round(r * (big ? 2.4 : 1.6) * (0.5 + gr)));
    ctx.fillStyle = rgba(col, 1);
    for (let i = 0; i < n; i++) {
      const t = R() * 6.2832, rr = Math.sqrt(R()) * r, s = (inside ? 0.6 : 0.8) + R() * (big ? 2.2 : 1.1);
      ctx.globalAlpha = (0.3 + R() * 0.5 * gr + 0.1) * mul;
      ctx.fillRect(Math.cos(t) * rr - s / 2, Math.sin(t) * rr - s / 2, s, s);
    }
  }

  // ---------- Strich zeichnen (inkrementell, wie draw.js: st.done = fertig gemalte Punkte) ----------
  function paint(ctx, d, st, final) {
    const b = merged(d), P = d.p, n = P.length / 3;
    if (!st.init) {
      st.init = 1; st.R = rng(d.r || 1); st.dist = 0; st.carry = 0;
      st.col0 = hexRgb(d.t && b.erase ? '#000000' : d.c); st.col = st.col0;
    }
    const R = st.R;
    const tl = d.tl || 0;
    const wAt = p => Math.max(0.6, d.s * (1 - b.pS + b.pS * (0.08 + 0.92 * Math.pow(p, d.cs || 1))) * (b.tilt ? 1 + tl * 1.6 : 1));
    const step = w => Math.max(0.6, w * b.sp);
    let lx = st.lx, ly = st.ly;
    const run = (ax, ay, cx, cy, bx, by, p0, p1) => {
      const len = Math.hypot(cx - ax, cy - ay) + Math.hypot(bx - cx, by - cy);
      const pieces = Math.max(1, Math.ceil(len / 2));
      let px = ax, py = ay;
      for (let k = 1; k <= pieces; k++) {
        const t = k / pieces, u = 1 - t;
        const x = u * u * ax + 2 * u * t * cx + t * t * bx, y = u * u * ay + 2 * u * t * cy + t * t * by;
        const seg = Math.hypot(x - px, y - py);
        st.carry += seg; st.dist += seg;
        const p = p0 + (p1 - p0) * t, w = wAt(p), s = step(w);
        if (st.carry >= s) {
          st.carry = 0;
          const ang = Math.atan2(y - py, x - px);
          let sx = x, sy = y;
          if (b.sc) { const t2 = R() * 6.2832, rr = Math.sqrt(R()) * w * b.sc * 0.5; sx += Math.cos(t2) * rr; sy += Math.sin(t2) * rr; }
          stamp(ctx, b, d, st, sx, sy, w, b.rj ? ang + (R() - 0.5) * b.rj * 6.28 : ang, Math.pow(p, d.co || 1), R);
        }
        px = x; py = y;
      }
    };
    if (n === 1) {
      if (final) { const [x, y, p] = P; stamp(ctx, b, d, st, x, y, wAt(p), 0, Math.pow(p, d.co || 1), R); st.done = 1; }
      return;
    }
    const pt = i => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
    for (let i = Math.max(1, st.done || 1); i < n; i++) {
      const [x0, y0, p0] = pt(i - 1), [x1, y1, p1] = pt(i);
      const m1x = (x0 + x1) / 2, m1y = (y0 + y1) / 2;
      let sx, sy;
      if (i === 1) { sx = x0; sy = y0; } else { const [xa, ya] = pt(i - 2); sx = (xa + x0) / 2; sy = (ya + y0) / 2; }
      run(sx, sy, x0, y0, m1x, m1y, p0, (p0 + p1) / 2);
      st.done = i + 1;
    }
    if (final) {
      const [xa, ya, pa] = pt(n - 2), [x1, y1, p1] = pt(n - 1);
      run((xa + x1) / 2, (ya + y1) / 2, (xa + x1) / 2, (ya + y1) / 2, x1, y1, pa, p1);
    }
  }

  // Vorschau-Strich (S-Kurve) für die Bibliothek
  function samplePath(w, h) {
    const p = [];
    for (let i = 0; i <= 28; i++) { const t = i / 28; p.push(Math.round((w * 0.1 + t * w * 0.8) * 10) / 10, Math.round((h / 2 + Math.sin(t * 6.2832) * h * 0.26) * 10) / 10, Math.round((0.25 + 0.75 * Math.sin(t * Math.PI)) * 100) / 100); }
    return p;
  }

  window.WIR_BRUSHES = {
    list: LIST, cats: CATS, def, has, merged, paint, samplePath,
    byCat: c => LIST.filter(b => b.cat === c),
    isErase: d => !!(MAP[d.t] && MAP[d.t].erase) || d.t === 'eraser',
    comp: d => (MAP[d.t] && MAP[d.t].comp) || null,
    // Deckkraft beim Zusammensetzen: „solid“-Pinsel (Textmarker) legen ihre Deckkraft einmal pro Strich auf
    alpha: d => d.o,
    isOld: id => !!MAP[id]?.old,
  };
})();
