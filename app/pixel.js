// Pixel-Grafiken (27.11.2026): 14 Lerntiere (je Fach eins, 3 Entwicklungsstufen, 4 Stimmungen) + 12 Stimmungskatzen.
// Alles wird als kleines Raster (Pixel für Pixel) per Canvas gezeichnet und als Bild-URL zurückgegeben – kein Bildmaterial nötig, offline-fähig.
// Nutzung: WIR_PIXEL.animal('fuchs', { mood: 'happy'|'ok'|'meh'|'sad', stage: 0|1|2 }) -> data-URL; WIR_PIXEL.cat(0..11) -> data-URL.
(() => {
  const AW = 26, AH = 24;
  const mk = (w, h) => { const g = Array.from({ length: h }, () => Array(w).fill('.')); g.W = w; g.H = h; return g; };
  const put = (g, x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < g.W && y >= 0 && y < g.H) g[y][x] = c; };
  const put2 = (g, x, y, c) => { put(g, x, y, c); put(g, g.W - 1 - x, y, c); };
  const rect = (g, x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(g, x + i, y + j, c); };
  const rect2 = (g, x, y, w, h, c) => { rect(g, x, y, w, h, c); rect(g, g.W - x - w, y, w, h, c); };
  const ell = (g, cx, cy, rx, ry, c, only) => {
    for (let y = 0; y < g.H; y++) for (let x = 0; x < g.W; x++) {
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 && (!only || g[y][x] === only)) g[y][x] = c;
    }
  };
  const ell2 = (g, cx, cy, rx, ry, c) => { ell(g, cx, cy, rx, ry, c); ell(g, g.W - 1 - cx, cy, rx, ry, c); };
  const pat = (g, x0, y0, rows, map) => rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') put(g, x0 + i, y0 + j, map[ch] || ch); }));
  // spitzes Ohr (beidseitig): Spitze bei (ax, ay), h Zeilen, außen c, innen in
  const earTri = (g, ax, ay, h, c, inn) => {
    for (let i = 0; i < h; i++) {
      const x0 = ax - (i >> 1), w = i + 1, y = ay + i;
      rect(g, x0, y, w, 1, c); rect(g, g.W - x0 - w, y, w, 1, c);
      if (inn && i >= 2 && w > 2) { rect(g, x0 + 1, y, w - 2, 1, inn); rect(g, g.W - x0 - w + 1, y, w - 2, 1, inn); }
    }
  };
  const outline = g => {
    const add = [];
    for (let y = 0; y < g.H; y++) for (let x = 0; x < g.W; x++) {
      if (g[y][x] !== '.') continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const c = (g[y + dy] || [])[x + dx]; return c && c !== '.' && c !== 'o'; })) add.push([x, y]);
    }
    add.forEach(([x, y]) => { g[y][x] = 'o'; });
  };
  const COMMON = { k: '#4a3640', w: '#ffffff', p: '#ff9fb2', c: '#8ed0f5', h: '#ff6f9d', m: '#7a4a4a', f: '#ff9fc4', y: '#ffd45e', g: '#7fc96b', s: '#ffe98a' };
  const paint = (g, pal) => {
    const cv = document.createElement('canvas'); cv.width = g.W; cv.height = g.H;
    const ctx = cv.getContext('2d');
    for (let y = 0; y < g.H; y++) for (let x = 0; x < g.W; x++) {
      const c = g[y][x]; if (c === '.') continue;
      ctx.fillStyle = pal[c] || COMMON[c] || '#f0f'; ctx.fillRect(x, y, 1, 1);
    }
    return cv.toDataURL('image/png');
  };

  // ---------- gemeinsamer Körper: runder „Loaf“ aus Kopf + Bauch ----------
  const base = (g, rx) => {
    ell(g, 12.5, 15, rx || 9, 6, 'b');
    ell(g, 12.5, 18.5, 5, 2.6, 'l');
    for (let y = 20; y < 22; y++) for (let x = 0; x < g.W; x++) if (g[y][x] === 'b') g[y][x] = 'd';
    ell2(g, 8, 21.4, 2.2, 1.2, 'd');
  };

  // ---------- Tiere ----------
  // eyes: linke Augenposition [x,y] (2 px breit; rechts gespiegelt), mouth: [x,y] (4 px breit), eyeCol: Augenfarbe
  const SP = {
    fuchs: { name: 'Fuchs', pal: { o: '#7a4527', b: '#f2a43c', d: '#dc8528', l: '#fff0cf', a: '#8a4a22', n: '#4a2a1a' }, eyes: [8, 13], mouth: [11, 16],
      draw(g) { ell(g, 22, 17, 3.2, 4.2, 'b'); rect(g, 23, 20, 3, 2, 'l'); base(g); earTri(g, 6, 4, 6, 'b', 'a'); rect2(g, 5, 19, 3, 1, 'a'); put(g, 12, 15, 'n'); put(g, 13, 15, 'n'); } },
    katze: { name: 'Tigerkatze', pal: { o: '#6b4528', b: '#cf9f6c', d: '#b37f4c', l: '#f6e3c8', a: '#f4a6b5', x: '#94623a', n: '#e88a9c' }, eyes: [8, 13], mouth: [11, 16],
      draw(g) { ell(g, 22, 17, 2.2, 4.4, 'b'); put(g, 23, 15, 'x'); put(g, 23, 18, 'x'); base(g); earTri(g, 6, 4, 6, 'b', 'a'); rect(g, 12, 10, 1, 2, 'x'); rect(g, 13, 10, 1, 2, 'x'); rect(g, 10, 10, 1, 1, 'x'); rect(g, 15, 10, 1, 1, 'x');
        rect2(g, 3, 15, 2, 1, 'x'); rect2(g, 3, 18, 2, 1, 'x'); put(g, 12, 15, 'n'); put(g, 13, 15, 'n'); } },
    hase: { name: 'Hase', pal: { o: '#9a8274', b: '#fbf5ef', d: '#e7dccf', l: '#ffffff', a: '#ffb6c6', n: '#f59ab0' }, eyes: [8, 13], mouth: [11, 16],
      draw(g) { ell(g, 22, 19, 2.2, 2.2, 'w'); ell2(g, 8.5, 5.5, 2.1, 4.8, 'b'); ell2(g, 8.5, 6, 1, 3.2, 'a'); base(g); put(g, 12, 15, 'n'); put(g, 13, 15, 'n'); } },
    panda: { name: 'Panda', pal: { o: '#3b3a40', b: '#f7f4ee', d: '#e0dcd2', l: '#ffffff', x: '#3b3a40', n: '#3b3a40' }, eyes: [8, 13], mouth: [11, 16], eyeCol: 'w',
      draw(g) { base(g); ell2(g, 6.5, 10, 2.6, 2.6, 'x'); ell2(g, 4.5, 17.5, 1.8, 3.2, 'x'); ell2(g, 8, 21.4, 2.2, 1.2, 'x'); ell2(g, 8.5, 13.6, 2.7, 2.4, 'x'); put(g, 12, 15, 'n'); put(g, 13, 15, 'n'); } },
    hamster: { name: 'Hamster', pal: { o: '#9a6a3a', b: '#f2c47e', d: '#dba45c', l: '#fff1d6', a: '#ffb0b8', x: '#d68f48', n: '#f59ab0' }, eyes: [8, 13], mouth: [11, 16],
      draw(g) { base(g, 9.5); ell2(g, 7, 9.4, 2.3, 2.3, 'b'); ell2(g, 7, 9.6, 1.2, 1.2, 'a'); ell(g, 12.5, 10.4, 5.5, 2.2, 'x', 'b'); ell2(g, 5, 17, 2, 2, 'l'); put(g, 12, 15, 'n'); put(g, 13, 15, 'n'); } },
    baer: { name: 'Bär', pal: { o: '#5c3326', b: '#b0694f', d: '#935240', l: '#dba07f', a: '#6e3d2f', n: '#3d2119' }, eyes: [8, 13], mouth: [11, 17],
      draw(g) { base(g); ell2(g, 6.5, 9.6, 2.5, 2.5, 'b'); ell2(g, 6.5, 9.8, 1.2, 1.2, 'l'); ell(g, 12.5, 16.4, 4.3, 2.7, 'l'); rect(g, 11, 15, 4, 1, 'n'); put(g, 12, 14, 'n'); put(g, 13, 14, 'n'); } },
    hund: { name: 'Hund', pal: { o: '#6d4a2b', b: '#ebcda3', d: '#cfab7d', l: '#fff4e2', x: '#8d5c38', n: '#3a2619' }, eyes: [8, 13], mouth: [11, 16],
      draw(g) { ell(g, 23, 17, 1.8, 3.6, 'x'); base(g); ell2(g, 4.2, 12, 2.4, 4.6, 'x'); ell(g, 16.5, 12.6, 2.6, 2.4, 'x', 'b'); put(g, 12, 15, 'n'); put(g, 13, 15, 'n'); put(g, 11, 15, 'n'); put(g, 14, 15, 'n'); } },
    frosch: { name: 'Frosch', pal: { o: '#3f7a2c', b: '#92d46c', d: '#72b84d', l: '#ecf9d2', a: '#ffffff' }, eyes: [7, 8], mouth: [11, 15],
      draw(g) { base(g); ell2(g, 7.5, 9, 3.3, 3, 'b'); ell2(g, 7.5, 9, 2.4, 2.2, 'a'); rect2(g, 5, 20, 4, 1, 'd'); } },
    pinguin: { name: 'Pinguin', pal: { o: '#2b3550', b: '#5d6e92', d: '#46567a', l: '#fbfbff', y: '#f7a634', n: '#f7a634' }, eyes: [8, 12], mouth: [11, 16], noMouth: true,
      draw(g) { base(g); ell(g, 12.5, 14.6, 7, 5.2, 'l'); ell2(g, 4, 17, 1.6, 3.4, 'd'); rect(g, 12, 15, 2, 1, 'y'); rect(g, 12, 16, 2, 1, 'y'); ell2(g, 8, 21.4, 2.2, 1.2, 'y'); } },
    eule: { name: 'Eule', pal: { o: '#5a3f27', b: '#a07a55', d: '#80603f', l: '#f3e4c8', x: '#c69d73', y: '#f0a93c' }, eyes: [8, 13], mouth: [11, 16], noMouth: true,
      draw(g) { base(g); earTri(g, 5, 6, 4, 'b'); ell2(g, 8.6, 13.4, 3.6, 3.3, 'l'); ell2(g, 4, 18, 2, 3.8, 'd'); for (let i = 0; i < 3; i++) { put(g, 10 + i * 2, 19, 'x'); put(g, 11 + i * 2, 21, 'x'); } rect(g, 12, 15, 2, 1, 'y'); rect(g, 12, 16, 2, 1, 'y'); ell2(g, 8, 21.4, 2.2, 1.2, 'y'); } },
    schwein: { name: 'Schwein', pal: { o: '#a8586d', b: '#f8b9c6', d: '#e79bab', l: '#ffd9e0', a: '#e98aa0', n: '#c95d78' }, eyes: [8, 13], mouth: [11, 18],
      draw(g) { base(g); earTri(g, 6, 5, 5, 'b', 'a'); ell(g, 12.5, 16.2, 3.8, 2.4, 'a'); put(g, 11, 16, 'n'); put(g, 14, 16, 'n'); put(g, 11, 17, 'n'); put(g, 14, 17, 'n'); put(g, 23, 17, 'a'); put(g, 24, 16, 'a'); put(g, 24, 15, 'a'); put(g, 23, 14, 'a'); } },
    kueken: { name: 'Küken', pal: { o: '#a0731e', b: '#ffe27c', d: '#f3c94d', l: '#fff4b5', y: '#f59b2f', n: '#f59b2f' }, eyes: [8, 13], mouth: [11, 17], noMouth: true,
      draw(g) { base(g); ell2(g, 4, 17, 2, 3.4, 'd'); rect(g, 12, 7, 2, 2, 'b'); put(g, 11, 8, 'b'); put(g, 14, 8, 'b'); put(g, 12, 6, 'b'); put(g, 13, 6, 'b'); rect(g, 12, 15, 2, 1, 'y'); rect(g, 12, 16, 2, 1, 'y'); ell2(g, 8, 21.4, 2.2, 1.2, 'y'); } },
    koala: { name: 'Koala', pal: { o: '#5f6675', b: '#aab1bf', d: '#8e96a6', l: '#eceff5', n: '#3a3a44' }, eyes: [7, 12], mouth: [11, 18],
      draw(g) { base(g); ell2(g, 4.2, 10, 3.8, 3.8, 'b'); ell2(g, 4.2, 10, 2.1, 2.1, 'l'); rect(g, 12, 14, 2, 3, 'n'); } },
    einhorn: { name: 'Einhorn', pal: { o: '#a77bb0', b: '#fff5fb', d: '#efd6ea', l: '#ffffff', a: '#ffc2dc', x: '#ffd45e', n: '#f59ab0', q: '#ff9ccd', r: '#b5a4f5', t: '#9fdcff' }, eyes: [8, 13], mouth: [11, 16],
      draw(g) { ell(g, 22.5, 17, 2.4, 4.4, 'q'); rect(g, 22, 18, 2, 2, 'r'); rect(g, 23, 20, 2, 2, 't'); base(g); earTri(g, 6, 5, 5, 'b', 'a'); ell(g, 4.6, 12.5, 1.8, 3.6, 'q'); rect(g, 3, 13, 1, 4, 'r'); rect(g, 5, 15, 1, 3, 't');
        rect(g, 12, 3, 2, 2, 'x'); rect(g, 11, 5, 4, 2, 'x'); rect(g, 10, 7, 6, 2, 'x'); put(g, 12, 5, 'q'); put(g, 14, 7, 'q'); put(g, 11, 8, 'q'); put(g, 12, 15, 'n'); put(g, 13, 15, 'n'); } },
  };
  const KEYS = Object.keys(SP);

  const face = (g, sp, mood) => {
    const [ex, ey] = sp.eyes, ec = sp.eyeCol || 'k', mm = 'm';
    const eye = x => {
      if (mood === 'happy') { put(g, x, ey, ec); put(g, x + 1, ey, ec); put(g, x - 1, ey + 1, ec); put(g, x + 2, ey + 1, ec); }
      else if (mood === 'meh') { rect(g, x - 1, ey, 4, 1, ec); rect(g, x, ey + 1, 2, 1, ec); }
      else { rect(g, x, ey, 2, 2, ec); if (ec === 'k') put(g, x + 1, ey, 'w'); }
    };
    eye(ex); eye(g.W - ex - 2);
    if (mood === 'sad') { rect(g, ex, ey + 2, 1, 3, 'c'); rect(g, g.W - ex - 1, ey + 2, 1, 3, 'c'); put(g, ex, ey + 5, 'c'); put(g, g.W - ex - 1, ey + 5, 'c'); }
    if (mood === 'happy' || mood === 'ok') { rect(g, ex - 1, ey + 3, 2, 1, 'p'); rect(g, g.W - ex - 1, ey + 3, 2, 1, 'p'); }
    if (sp.noMouth) return;
    const [mx, my] = sp.mouth;
    if (mood === 'happy') { put(g, mx, my, mm); put(g, mx + 3, my, mm); put(g, mx + 1, my + 1, mm); put(g, mx + 2, my + 1, mm); }
    else if (mood === 'ok') { put(g, mx + 1, my + 1, mm); put(g, mx + 2, my + 1, mm); }
    else if (mood === 'meh') rect(g, mx, my + 1, 4, 1, mm);
    else { put(g, mx, my + 1, mm); put(g, mx + 3, my + 1, mm); put(g, mx + 1, my, mm); put(g, mx + 2, my, mm); }
  };
  const effects = (g, mood) => {
    if (mood === 'happy') pat(g, 20, 0, ['.h.h.', 'hhhhh', '.hhh.', '..h..'], {});
    if (mood === 'meh') pat(g, 21, 6, ['.c.', 'ccc', 'ccc', '.c.'], {});
  };
  const flower = (g, cx, cy, col) => { put(g, cx, cy - 1, col); put(g, cx - 1, cy, col); put(g, cx + 1, cy, col); put(g, cx, cy + 1, col); put(g, cx, cy, 'y'); };
  const acc = (g, stage) => {
    if (stage === 1) { flower(g, 18, 9, 'f'); put(g, 20, 10, 'g'); put(g, 16, 10, 'g'); }
    if (stage >= 2) {
      for (let x = 5; x <= 20; x++) put(g, x, 10, 'g');
      [[6, 'f'], [10, 'w'], [15, 'w'], [19, 'f']].forEach(([cx, col]) => flower(g, cx, 9, col));
      pat(g, 2, 5, ['.s.', 'sss', '.s.'], {}); pat(g, 22, 8, ['.s.', 'sss', '.s.'], {});
    }
  };

  const cache = new Map();
  function animal(key, opt) {
    const sp = SP[key] || SP[KEYS[0]], mood = (opt && opt.mood) || 'ok', stage = (opt && opt.stage) || 0;
    const ck = key + '|' + mood + '|' + stage;
    if (cache.has(ck)) return cache.get(ck);
    const g = mk(AW, AH);
    sp.draw(g); outline(g); face(g, sp, mood); effects(g, mood); acc(g, stage);
    const url = paint(g, sp.pal); cache.set(ck, url); return url;
  }

  // ---------- Stimmungskatzen (12) ----------
  const CW = 22, CH = 20;
  const CAT_PAL = { o: '#6d5a72', b: '#faf6f1', d: '#ece4dc', p: '#f7a8bd', k: '#6d5a72', c: '#a9d4ea', C: '#7fb3cf', r: '#ee5a6f', h: '#f78fb0', B: '#bcdcee' };
  const CAT_NAMES = ['Verlegen', 'Mies drauf', 'Müde', 'Neutral', 'Weinen', 'Glücklich', 'Schüchtern', 'Sauer', 'Trällern', 'Verliebt', 'Überrascht', 'Singen'];
  const NOTE1 = ['..kk.', '..k.k', '..k..', '..k..', '.kk..', 'kkk..', '.k...'];
  const NOTE2 = ['.kkkkk', '.k...k', '.k...k', '.k...k', 'kk..kk', 'kk..kk'];
  function cat(i) {
    i = Math.max(0, Math.min(11, i | 0));
    const ck = 'cat' + i; if (cache.has(ck)) return cache.get(ck);
    const g = mk(CW, CH);
    ell(g, 10.5, 13.4, 8.2, 5.6, 'b'); for (let x = 0; x < CW; x++) if (g[18][x] === 'b') g[18][x] = 'd';
    rect(g, 18, 16, 3, 2, 'b'); put(g, 21, 15, 'b'); put(g, 21, 14, 'b'); put(g, 20, 14, 'b');
    earTri(g, 5, 4, 5, 'b', 'p');
    outline(g);
    pat(g, 0, 11, ['oo'], {}); pat(g, 0, 13, ['oo'], {}); pat(g, 20, 11, ['oo'], {}); pat(g, 20, 13, ['oo'], {});
    const dots = (y) => { put(g, 7, y, 'k'); put(g, 7, y + 1, 'k'); put(g, 14, y, 'k'); put(g, 14, y + 1, 'k'); };
    const blush = (y) => { rect(g, 5, y, 2, 1, 'p'); rect(g, 15, y, 2, 1, 'p'); };
    switch (i) {
      case 0: dots(11); blush(13); break;
      case 1: for (let y = 8; y < 11; y++) for (let x = 0; x < CW; x++) if (g[y][x] === 'b') g[y][x] = 'B'; dots(12); for (let j = 0; j < 3; j++) rect(g, 16 + j * 2, 1, 1, 4, j === 1 ? 'C' : 'c'); break;
      case 2: rect(g, 6, 12, 3, 1, 'k'); rect(g, 13, 12, 3, 1, 'k'); break;
      case 3: dots(12); break;
      case 4: rect(g, 7, 11, 2, 7, 'c'); rect(g, 13, 11, 2, 7, 'c'); break;
      case 5: pat(g, 6, 11, ['k.', '.k', 'k.'], {}); pat(g, 14, 11, ['.k', 'k.', '.k'], {}); blush(14); break;
      case 6: dots(11); for (let y = 12; y < 15; y++) for (let x = 4; x < 18; x++) if (((x - y) % 4 + 4) % 4 < 2) put(g, x, y, 'p'); break;
      case 7: pat(g, 6, 11, ['kk', '.k'], {}); pat(g, 14, 11, ['kk', 'k.'], {}); pat(g, 15, 0, ['rr.rr', 'r...r', '.....', 'r...r', 'rr.rr'], {}); dots(13); break;
      case 8: dots(12); pat(g, 8, 0, NOTE1, {}); break;
      case 9: dots(12); blush(14); pat(g, 8, 1, ['.h.h.', 'hhhhh', '.hhh.', '..h..'], {}); break;
      case 10: pat(g, 6, 11, ['kkk', 'k.k', 'kkk'], {}); pat(g, 13, 11, ['kkk', 'k.k', 'kkk'], {}); break;
      case 11: dots(12); pat(g, 8, 0, NOTE2, {}); break;
    }
    const url = paint(g, CAT_PAL); cache.set(ck, url); return url;
  }
  // Stimmung 0–100 -> passende Katze
  const catForMood = v => v == null ? 3 : v < 12 ? 4 : v < 25 ? 1 : v < 38 ? 3 : v < 50 ? 2 : v < 62 ? 0 : v < 72 ? 8 : v < 82 ? 5 : v < 92 ? 11 : 9;

  window.WIR_PIXEL = { animal, cat, catForMood, CAT_NAMES, KEYS, names: Object.fromEntries(KEYS.map(k => [k, SP[k].name])) };
})();
