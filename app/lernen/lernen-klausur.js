/* Lernen: Original-Prüfungsblätter (PDF aus lern_dateien) ansehen, mit Stift/Marker/Text beschriften. (19.11.2026)
   Wird von lernen.js erst beim Öffnen von „Prüfungen“ geladen. pdf.js liegt lokal in /lernen/vendor/.
   Notizen: Koordinaten relativ zur Seite (0..10000), localStorage + Collection lern_notizen (je Datei ein Datensatz). */
(function () {
  'use strict';
  const AREA = { elek: ['Elektrotechnik', 'GA2', 90], netz: ['Netzwerktechnik', 'GA1', 90], wiso: ['WiSO', 'WiSo', 60] };
  const GA = { ga2: 'elek', ga1: 'netz', wiso: 'wiso' };
  const KIND = { aufg: 'Aufgaben', beleg: 'Belegsatz', bogen: 'Antwortbogen', loes: 'Lösung', extra: 'Zusatz' };
  const KORD = ['aufg', 'beleg', 'bogen', 'loes', 'extra'];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const COLORS = ['#1c1c1e', '#d62828', '#1d4ed8', '#15803d', '#ffd60a'];
  const WIDTHS = [['dünn', 1.8], ['mittel', 3.2], ['dick', 5.5]];
  const TSIZES = [['klein', 0.017], ['mittel', 0.024], ['groß', 0.034]];

  // ---------- Dateien -> Prüfungen ----------
  function parse(r) {
    const n = (r.titel || '') + ' ' + (r.datei || '');
    const g = /(GA\s*[12]|WiSo)/i.exec(n), m = /AP([SW])(\d{2})(\d{2})?/i.exec(n);
    if (!g || !m) return null;
    const area = GA[g[1].replace(/\s/g, '').toLowerCase()], s = m[1].toUpperCase() === 'S', y1 = +m[2];
    const kind = /beleg/i.test(n) ? 'beleg' : /l[öoÖ_]?e?sungsb/i.test(n) ? 'bogen' : /l[öo_]?e?sung/i.test(n) ? 'loes' : /kopie|seite|farbe/i.test(n) ? 'extra' : 'aufg';
    return {
      area, kind, term: 'AP' + m[1].toUpperCase() + m[2] + (m[3] || ''), sort: 2000 + y1 + (s ? 0.4 : 0.9),
      label: s ? 'Sommer 20' + m[2] : 'Winter ' + m[2] + '/' + (m[3] || String(y1 + 1).padStart(2, '0'))
    };
  }
  function exams(files) {
    const map = {};
    (files || []).forEach(r => {
      const p = parse(r); if (!p) return;
      const k = p.area + '|' + p.term, e = map[k] = map[k] || { key: k, area: p.area, term: p.term, label: p.label, sort: p.sort, docs: {}, extra: [] };
      if (p.kind === 'extra') e.extra.push(r); else e.docs[p.kind] = r;
    });
    return Object.values(map).sort((a, b) => b.sort - a.sort);
  }

  // ---------- Zustand der Werkzeuge (pro Gerät) ----------
  const S = Object.assign({ tool: 'hand', color: 1, w: 1, ts: 1, po: false }, (() => { try { return JSON.parse(localStorage.getItem('ln-kl-ui') || '{}'); } catch (_) { return {}; } })());
  S.tool = 'hand';
  const saveUi = () => { try { localStorage.setItem('ln-kl-ui', JSON.stringify({ color: S.color, w: S.w, ts: S.ts, po: S.po })); } catch (_) {} };

  // ---------- pdf.js ----------
  let pdfP = null;
  function needPdf() {
    if (window.pdfjsLib) return Promise.resolve();
    return pdfP || (pdfP = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = '/lernen/vendor/pdf.min.js';
      s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/lernen/vendor/pdf.worker.min.js'; res(); };
      s.onerror = () => { pdfP = null; rej(new Error('pdf.js')); };
      document.head.append(s);
    }));
  }
  async function getBuf(pb, rec) {
    const key = '/__kl/' + rec.id + '/' + rec.datei;
    let cache = null; try { cache = await caches.open('wir-klausur'); const hit = await cache.match(key); if (hit) return await hit.arrayBuffer(); } catch (_) {}
    const tk = await pb.files.getToken(), res = await fetch(pb.files.getURL(rec, rec.datei, { token: tk }));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    try { cache && await cache.put(key, res.clone()); } catch (_) {}
    return await res.arrayBuffer();
  }

  // ---------- Notizen speichern ----------
  const annKey = id => 'ln-ann:' + id;
  const annLocal = id => { try { return JSON.parse(localStorage.getItem(annKey(id))); } catch (_) { return null; } };
  const hasAnn = id => { const a = annLocal(id); return !!a && Object.values(a.p || {}).some(p => (p.s && p.s.length) || (p.t && p.t.length) || (p.a && Object.values(p.a).some(v => (v.t || '').trim()))); };
  const remote = {}, timers = {};
  async function pull(ctx, fid) {
    try { const r = await ctx.pb.collection('lern_notizen').getFirstListItem(ctx.pb.filter('fileId = {:f}', { f: fid }), { requestKey: null }); remote[fid] = r.id; return r.data && r.data.p ? r.data : null; }
    catch (_) { return null; }
  }
  async function push(ctx, fid, ann) {
    if (!navigator.onLine) return;
    try {
      const body = { user: ctx.uid(), fileId: fid, data: ann };
      if (remote[fid]) await ctx.pb.collection('lern_notizen').update(remote[fid], { data: ann }, { requestKey: null });
      else { const r = await ctx.pb.collection('lern_notizen').create(body, { requestKey: null }); remote[fid] = r.id; }
    } catch (_) { if (!remote[fid]) { const r = await pull(ctx, fid); if (r) push(ctx, fid, ann); } }
  }
  function queue(ctx, fid, ann, now) {
    clearTimeout(timers[fid]);
    if (now) push(ctx, fid, ann); else timers[fid] = setTimeout(() => push(ctx, fid, ann), 1800);
  }

  // ---------- Antwortzeilen auf Prüfungsseiten erkennen ----------
  // Sucht waagerechte Linien (auch Scans: leicht hell/wellig), gruppiert gleich abständige Linien zu Antwortblöcken, verwirft Tabellen (senkrechte Linien).
  // data = RGBA (Breite W, Höhe H). Ergebnis in Anteilen der Seitenbreite/-höhe; stabil über Geräte (immer gleiche Auflösung).
  function detectFields(data, W, H) {
    const m = new Uint8Array(W * H);
    for (let i = 0, p = 0; p < W * H; p++, i += 4) m[p] = (data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11) < 235 ? 1 : 0;
    const D = new Uint8Array(W * H);                                  // senkrecht um 2 Pixel verdickt (wellige Scanlinien)
    for (let y = 0; y < H; y++) for (let k = -2; k <= 2; k++) { const yy = y + k; if (yy < 0 || yy >= H) continue; for (let x = 0; x < W; x++) if (m[yy * W + x]) D[y * W + x] = 1; }
    const rows = [];
    for (let y = 0; y < H; y++) {                                      // Zeile = breit (≥ 40 % der Seite) und dicht gefüllt (Linie, nicht Text)
      let c = 0; const o = y * W; for (let x = 0; x < W; x++) c += D[o + x];
      if (c < W * 0.4 * 0.7) continue;
      const lo = Math.floor(c * 0.02), hi = Math.floor(c * 0.98); let k = 0, xl = 0, xh = 0;
      for (let x = 0; x < W; x++) if (D[o + x]) { if (k === lo) xl = x; if (k === hi) { xh = x; break; } k++; }
      const ext = xh - xl + 1;
      if (ext > W * 0.4 && c * 0.96 / ext > 0.7) rows.push({ y, x0: xl, x1: xh });
    }
    const lines = [];
    rows.forEach(r => { const l = lines[lines.length - 1]; if (l && r.y - l.ye <= 6) { l.ye = r.y; l.x0 = Math.min(l.x0, r.x0); l.x1 = Math.max(l.x1, r.x1); } else lines.push({ y: r.y, ye: r.y, x0: r.x0, x1: r.x1 }); });
    lines.forEach(l => { l.y = Math.round((l.y + l.ye) / 2); });
    const blocks = []; let cur = null;
    const lo = W * 0.028, hi = W * 0.075;
    lines.forEach((l, i) => {
      const sp = i ? l.y - lines[i - 1].y : 0;
      if (cur && sp >= lo && sp <= hi && (cur.sp == null || Math.abs(sp - cur.sp) <= cur.sp * 0.22)) { cur.lines.push(l); cur.sp = cur.sp == null ? sp : (cur.sp * (cur.lines.length - 2) + sp) / (cur.lines.length - 1); }
      else { if (cur && cur.lines.length >= 2) blocks.push(cur); cur = { lines: [l], sp: null }; }
    });
    if (cur && cur.lines.length >= 2) blocks.push(cur);
    const out = [];
    blocks.forEach(b => {
      const y0 = b.lines[0].y, y1 = b.lines[b.lines.length - 1].y, x0 = Math.min(...b.lines.map(l => l.x0)), x1 = Math.max(...b.lines.map(l => l.x1));
      let vert = false;                                              // Tabelle? (senkrechte Linie über den ganzen Block)
      for (let x = Math.max(2, x0); x <= Math.min(W - 3, x1) && !vert; x += 2) { let c = 0; for (let y = y0; y <= y1; y++) { const o = y * W + x; if (m[o] || m[o + 1] || m[o - 1] || m[o + 2] || m[o - 2]) c++; } if (c > (y1 - y0) * 0.7) vert = true; }
      if (vert) return;
      const sp = (y1 - y0) / (b.lines.length - 1);
      out.push({ k: 'f' + Math.round(y0 / W * 1000), x: Math.max(0, x0 - 2) / W, w: Math.min(W, x1 + 2) / W - Math.max(0, x0 - 2) / W, y: y0 / H, h: (y1 - y0) / H, sp: sp / W, n: b.lines.length });
    });
    return out;
  }

  // ---------- Ein Dokument (PDF) in einem Fenster ----------
  function mkDoc(ctx, rec, host, hooks) {
    const pb = ctx.pb, fid = rec.id;
    let ann = annLocal(fid) || { ts: 0, p: {} };
    const D = { rec, pages: [], z: 1, dead: false, hist: [], ready: false };
    const sc = document.createElement('div'); sc.className = 'ks'; sc.innerHTML = '<div class="kv-load">Lade …</div>';
    host.append(sc);
    const pg$ = i => { const p = (ann.p[i] = ann.p[i] || { s: [], t: [] }); if (!p.a) p.a = {}; return p; };
    const touch = () => { ann.ts = Date.now(); try { localStorage.setItem(annKey(fid), JSON.stringify(ann)); } catch (_) {} queue(ctx, fid, ann); hooks.onHist(); };
    let io = null, ro = null, chain = Promise.resolve(), editing = null;

    function setMode() {
      sc.dataset.tool = S.tool;
      sc.dataset.draw = (S.tool === 'pen' || S.tool === 'marker' || S.tool === 'eraser') ? '1' : '0';
      sc.dataset.po = S.po ? '1' : '0';
    }
    D.setMode = setMode;

    // --- Zeichnen ---
    function strokePath(c, st, W, H) {
      const p = st.p; if (!p.length) return;
      c.save(); c.globalAlpha = st.a || 1; c.strokeStyle = st.c; c.fillStyle = st.c; c.lineWidth = st.w * W / 1000; c.lineCap = 'round'; c.lineJoin = 'round';
      if (p.length < 4) { c.beginPath(); c.arc(p[0] / 1e4 * W, p[1] / 1e4 * H, c.lineWidth / 2, 0, 7); c.fill(); }
      else {
        c.beginPath(); c.moveTo(p[0] / 1e4 * W, p[1] / 1e4 * H);
        for (let i = 2; i < p.length - 2; i += 2) c.quadraticCurveTo(p[i] / 1e4 * W, p[i + 1] / 1e4 * H, (p[i] + p[i + 2]) / 2e4 * W, (p[i + 1] + p[i + 3]) / 2e4 * H);
        c.lineTo(p[p.length - 2] / 1e4 * W, p[p.length - 1] / 1e4 * H); c.stroke();
      }
      c.restore();
    }
    function ink(pg) {
      if (!pg.ok) return;
      const cv = pg.ki, W = cv.width, H = cv.height, c = cv.getContext('2d');
      c.clearRect(0, 0, W, H); (pg$(pg.i).s).forEach(st => strokePath(c, st, W, H));
    }
    function texts(pg) {
      const L = pg.kt; L.innerHTML = '';
      pg$(pg.i).t.forEach((tx, idx) => {
        const d = document.createElement('div'); d.className = 'kx'; d.textContent = tx.t;
        d.style.cssText = `left:${tx.x / 100}%;top:${tx.y / 100}%;color:${tx.c};--ts:${tx.s}`; d.dataset.idx = idx;
        d.addEventListener('click', ev => { ev.stopPropagation(); if (S.tool === 'text') editText(pg, tx); else if (S.tool === 'eraser') { const a = pg$(pg.i).t, k = a.indexOf(tx); a.splice(k, 1); D.hist.push({ op: 'tdel', i: pg.i, tx, k }); texts(pg); touch(); } });
        L.append(d);
      });
    }
    function editText(pg, tx, x, y) {
      closeEdit();
      const isNew = !tx; tx = tx || { x: Math.round(x * 1e4), y: Math.round(y * 1e4), t: '', c: COLORS[S.color], s: TSIZES[S.ts][1] };
      const old = tx.t, ta = document.createElement('textarea'); ta.className = 'kx-in'; ta.value = tx.t; ta.rows = 1;
      ta.style.cssText = `left:${tx.x / 100}%;top:${tx.y / 100}%;color:${tx.c};--ts:${tx.s}`;
      const fit = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; const w = Math.max(...ta.value.split('\n').map(l => l.length), 6); ta.style.width = (w + 2) + 'ch'; };
      ta.addEventListener('input', fit);
      ta.addEventListener('keydown', e => { if (e.key === 'Escape') ta.blur(); });
      ta.addEventListener('blur', () => {
        const v = ta.value.replace(/\s+$/, ''), a = pg$(pg.i).t, k = a.indexOf(tx);
        editing = null; ta.remove();
        if (isNew) { if (v) { tx.t = v; a.push(tx); D.hist.push({ op: 'tadd', i: pg.i, tx }); touch(); } }
        else if (!v) { a.splice(k, 1); D.hist.push({ op: 'tdel', i: pg.i, tx, k }); touch(); }
        else if (v !== old) { tx.t = v; D.hist.push({ op: 'tedit', i: pg.i, tx, old }); touch(); }
        texts(pg);
      });
      editing = { ta, tx }; pg.kt.append(ta); fit(); ta.focus();
      if (!isNew) { [...pg.kt.children].forEach(d => { if (d.dataset.idx == pg$(pg.i).t.indexOf(tx)) d.style.visibility = 'hidden'; }); }
    }
    function closeEdit() { if (editing) editing.ta.blur(); }

    // --- Antwortfelder auf den Linien ---
    function fields(pg) {
      const L = pg.kf; if (!L || !pg.fl) return; L.innerHTML = '';
      pg.fl.forEach(f => {
        const v = pg$(pg.i).a[f.k] || { n: '', t: '' };
        const box = document.createElement('div'); box.className = 'kf-b';
        box.style.cssText = `left:${(f.x * 100).toFixed(3)}%;top:${(f.y * 100).toFixed(3)}%;width:${(f.w * 100).toFixed(3)}%;height:${(f.h * 100).toFixed(3)}%;--sp:${f.sp.toFixed(5)}`;
        box.innerHTML = '<input class="kf-n" data-f="n" placeholder="Nr." maxlength="12" inputmode="text" autocapitalize="off" autocomplete="off" aria-label="Aufgabennummer"><textarea class="kf-t" data-f="t" spellcheck="false" aria-label="Antwort"></textarea>';
        const inp = box.children[0], ta = box.children[1]; inp.value = v.n || ''; ta.value = v.t || '';
        const set = () => { const a = pg$(pg.i).a; a[f.k] = { n: inp.value, t: ta.value }; if (!a[f.k].n.trim() && !a[f.k].t.trim()) delete a[f.k]; touch(); };
        inp.addEventListener('input', set); ta.addEventListener('input', set);
        L.append(box);
      });
    }
    function detect(pg) {
      if (pg.fl) return Promise.resolve();
      chain = chain.then(async () => {
        if (D.dead || pg.fl) return;
        try {
          const W = 1000, vp = pg.page.getViewport({ scale: W / pg.w }), cv = document.createElement('canvas'); cv.width = W; cv.height = Math.round(vp.height);
          const cx = cv.getContext('2d', { willReadFrequently: true }); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
          await pg.page.render({ canvasContext: cx, viewport: vp }).promise;
          pg.h = pg.w * cv.height / W; pg.fl = detectFields(cx.getImageData(0, 0, W, cv.height).data, W, cv.height);
          cv.width = cv.height = 1;
        } catch (_) { pg.fl = []; }
        fields(pg);
      });
      return chain;
    }
    D.fieldTexts = () => {
      const out = [];
      D.pages.forEach(pg => { const a = (ann.p[pg.i] || {}).a || {}; Object.keys(a).sort((x, y) => (+x.slice(1)) - (+y.slice(1))).forEach(k => { const v = a[k]; if ((v.t || '').trim() || (v.n || '').trim()) out.push({ page: pg.i, n: (v.n || '').trim(), t: (v.t || '').trim() }); }); });
      return out;
    };

    function hitStroke(st, x, y, r, W, H) {
      const p = st.p;
      for (let i = 0; i < p.length; i += 2) { const dx = p[i] / 1e4 * W - x, dy = p[i + 1] / 1e4 * H - y; if (dx * dx + dy * dy < r * r) return true; }
      return false;
    }
    function bind(pg) {
      const el = pg.el; let cur = null, wasEdit = false, moved = false, sx = 0, sy = 0, erased = null;
      const pos = e => { const r = el.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, r]; };
      el.addEventListener('pointerdown', e => {
        const t = S.tool; wasEdit = !!editing; moved = false;
        if (t === 'hand' || e.target.closest('.kx,.kx-in,.kf-b')) return;
        if (e.pointerType === 'touch' && S.po && t !== 'text') return;
        const [x, y, r] = pos(e); sx = e.clientX; sy = e.clientY;
        if (t === 'pen' || t === 'marker') {
          e.preventDefault(); el.setPointerCapture(e.pointerId);
          const mk = t === 'marker', w = WIDTHS[S.w][1] * (mk ? 4.5 : 1);
          cur = { c: COLORS[S.color], w, a: mk ? 0.4 : 1, p: [Math.round(x * 1e4), Math.round(y * 1e4)], lx: e.clientX, ly: e.clientY };
          ink(pg); strokePath(pg.ki.getContext('2d'), cur, pg.ki.width, pg.ki.height);
        } else if (t === 'eraser') {
          e.preventDefault(); el.setPointerCapture(e.pointerId); erased = []; cur = { er: true }; erase(pg, e, r);
        }
      });
      function erase(pg, e, r) {
        const a = pg$(pg.i).s, W = r.width, H = r.height, x = e.clientX - r.left, y = e.clientY - r.top;
        for (let k = a.length - 1; k >= 0; k--) if (hitStroke(a[k], x, y, 14, W, H)) { erased.push({ st: a[k], k }); a.splice(k, 1); }
        ink(pg);
      }
      el.addEventListener('pointermove', e => {
        if (!cur) { if (Math.hypot(e.clientX - sx, e.clientY - sy) > 8) moved = true; return; }
        if (cur.er) { erase(pg, e, el.getBoundingClientRect()); return; }
        const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e], r = el.getBoundingClientRect(), c = pg.ki.getContext('2d');
        (evs.length ? evs : [e]).forEach(ev => {
          if (Math.hypot(ev.clientX - cur.lx, ev.clientY - cur.ly) < 0.7) return;
          cur.lx = ev.clientX; cur.ly = ev.clientY;
          cur.p.push(Math.round((ev.clientX - r.left) / r.width * 1e4), Math.round((ev.clientY - r.top) / r.height * 1e4));
        });
        ink(pg); strokePath(c, cur, pg.ki.width, pg.ki.height);
      });
      const end = e => {
        if (cur) {
          if (cur.er) { if (erased.length) { D.hist.push({ op: 'del', i: pg.i, items: erased.slice().reverse() }); touch(); } }
          else { const st = { c: cur.c, w: cur.w, a: cur.a, p: cur.p }; pg$(pg.i).s.push(st); D.hist.push({ op: 'add', i: pg.i, st }); touch(); ink(pg); }
          cur = null; erased = null; return;
        }
        if (S.tool === 'text' && !moved && !wasEdit && e.type === 'pointerup' && !e.target.closest('.kx,.kx-in,.kf-b')) { const [x, y] = pos(e); editText(pg, null, x, y); }
      };
      el.addEventListener('pointerup', end); el.addEventListener('pointercancel', e => { if (cur) { cur = null; ink(pg); } });
    }

    // --- Seiten rendern ---
    function render(pg) {
      chain = chain.then(async () => {
        if (D.dead || !pg.vis) return;
        const cssW = pg.el.clientWidth; if (!cssW) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2), tw = Math.min(Math.round(cssW * dpr), 2400);
        if (!pg.fl && !pg.fd) { pg.fd = true; detect(pg); }
        if (pg.ok && pg.rw === tw) { ink(pg); return; }
        const vp = pg.page.getViewport({ scale: tw / pg.w }), cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height); cv.className = 'kc';
        try { await pg.page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise; } catch (_) { return; }
        if (D.dead || !pg.vis) return;
        pg.el.replaceChild(cv, pg.kc); pg.kc = cv; pg.rw = tw; pg.ok = true;
        pg.ki.width = cv.width; pg.ki.height = cv.height; ink(pg);
      });
    }
    function release(pg) { if (!pg.ok) return; pg.kc.width = pg.kc.height = 1; pg.ki.width = pg.ki.height = 1; pg.ok = false; }
    D.setZoom = z => { D.z = z; sc.style.setProperty('--z', z); D.pages.forEach(pg => { pg.ok = false; if (pg.vis) render(pg); }); };
    D.fit = () => D.setZoom(innerWidth < 700 ? 1.6 : 1);

    // --- Aktionen von außen ---
    D.undo = () => {
      const h = D.hist.pop(); if (!h) return; const pg = D.pages[h.i - 1], d = pg$(h.i);
      if (h.op === 'add') d.s.splice(d.s.indexOf(h.st), 1);
      else if (h.op === 'del') h.items.forEach(it => d.s.splice(it.k, 0, it.st));
      else if (h.op === 'tadd') d.t.splice(d.t.indexOf(h.tx), 1);
      else if (h.op === 'tdel') d.t.splice(h.k, 0, h.tx);
      else if (h.op === 'tedit') h.tx.t = h.old;
      else if (h.op === 'clear') { d.s = h.s; d.t = h.t; }
      ink(pg); texts(pg); touch();
    };
    D.visiblePage = () => {
      const r = sc.getBoundingClientRect(), mid = r.top + r.height / 3;
      return D.pages.find(p => { const b = p.el.getBoundingClientRect(); return b.bottom > mid; }) || D.pages[0];
    };
    D.clearPage = () => { const pg = D.visiblePage(); if (!pg) return false; const d = pg$(pg.i); if (!d.s.length && !d.t.length) return false; D.hist.push({ op: 'clear', i: pg.i, s: d.s, t: d.t }); d.s = []; d.t = []; ink(pg); texts(pg); touch(); return true; };
    D.flush = () => { clearTimeout(timers[fid]); push(ctx, fid, ann); };
    D.show = v => { sc.style.display = v ? '' : 'none'; };
    D.destroy = () => { D.dead = true; try { io && io.disconnect(); ro && ro.disconnect(); D.pdf && D.pdf.destroy(); } catch (_) {} sc.remove(); };

    (async () => {
      try {
        await needPdf();
        const buf = await getBuf(pb, rec);
        D.pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
        const wrap = document.createElement('div'); wrap.className = 'kpg';
        for (let i = 1; i <= D.pdf.numPages; i++) {
          const page = await D.pdf.getPage(i), v = page.getViewport({ scale: 1 });
          const el = document.createElement('div'); el.className = 'kp'; el.style.aspectRatio = v.width + ' / ' + v.height;
          el.innerHTML = '<canvas class="kc"></canvas><canvas class="ki"></canvas><div class="kt"></div><span class="kn">' + i + ' / ' + D.pdf.numPages + '</span><div class="kf"></div>';
          const pg = { i, page, el, w: v.width, kc: el.children[0], ki: el.children[1], kt: el.children[2], kf: el.children[4], ok: false, vis: false, h: v.height };
          D.pages.push(pg); wrap.append(el); bind(pg); texts(pg);
        }
        sc.innerHTML = ''; sc.append(wrap); setMode();
        io = new IntersectionObserver(es => es.forEach(en => { const pg = D.pages[+en.target.dataset.i - 1]; pg.vis = en.isIntersecting; if (pg.vis) render(pg); else release(pg); }), { root: sc, rootMargin: '700px 0px' });
        ro = new ResizeObserver(es => es.forEach(en => { const pg = D.pages[+en.target.dataset.i - 1]; en.target.style.setProperty('--pw', en.contentRect.width + 'px'); if (pg.vis && pg.rw !== Math.min(Math.round(en.contentRect.width * Math.min(devicePixelRatio || 1, 2)), 2400)) { pg.ok = false; render(pg); } }));
        D.pages.forEach(pg => { pg.el.dataset.i = pg.i; io.observe(pg.el); ro.observe(pg.el); });
        D.fit(); D.ready = true; hooks.onReady();
        const r = await pull(ctx, fid);
        if (r && (r.ts || 0) > (ann.ts || 0) && !D.dead) { ann = r; try { localStorage.setItem(annKey(fid), JSON.stringify(ann)); } catch (_) {} D.pages.forEach(pg => { ink(pg); texts(pg); fields(pg); }); }
      } catch (e) {
        sc.innerHTML = '<div class="kv-load">Konnte die Datei nicht laden (' + esc(e && e.message || 'Fehler') + '). Netz prüfen. <button type="button" class="ln-btn soft sm" data-k="retry">Nochmal</button></div>';
        sc.querySelector('[data-k=retry]').onclick = () => { D.dead = true; sc.remove(); hooks.onRetry(); };
      }
    })();
    return D;
  }

  // ---------- Vollbild-Viewer für eine Prüfung ----------
  function openExam(ctx, ex, tab) {
    document.querySelector('.kv')?.remove();
    const av = KORD.filter(k => k === 'extra' ? ex.extra.length : ex.docs[k]);
    const recOf = k => k === 'extra' ? ex.extra[0] : ex.docs[k];
    let active = tab && av.includes(tab) ? tab : (av.find(k => k !== 'loes') || av[0]), split = false, sure = false, timer = null, tick = null;
    const docs = {}, A = AREA[ex.area];
    const root = document.createElement('div'); root.className = 'kv';
    root.innerHTML = `<header class="kv-top"><button type="button" class="kv-b" data-k="back">‹ Zurück</button><b class="kv-title">${esc(A[1])} · ${esc(ex.label)}</b><button type="button" class="kv-b" data-k="copyans">Antworten kopieren</button><span class="kv-timer" data-k="time"></span></header>
      <nav class="kv-tabs"></nav>
      <div class="kv-tools">
        ${[['hand', 'Hand'], ['pen', 'Stift'], ['marker', 'Marker'], ['text', 'Text'], ['eraser', 'Radierer']].map(([k, n]) => `<button type="button" class="kv-b tl" data-t="${k}">${n}</button>`).join('')}
        <i class="kv-sep"></i><span class="kv-cols">${COLORS.map((c, i) => `<button type="button" class="kv-dot" data-c="${i}" style="--c:${c}" aria-label="Farbe ${i + 1}"></button>`).join('')}</span>
        <button type="button" class="kv-b" data-k="w"></button><button type="button" class="kv-b" data-k="ts"></button>
        <i class="kv-sep"></i><button type="button" class="kv-b" data-k="undo">↶ Zurück</button><button type="button" class="kv-b" data-k="clear">Seite leeren</button>
        <i class="kv-sep"></i><button type="button" class="kv-b" data-k="zm">−</button><button type="button" class="kv-b" data-k="zp">+</button><button type="button" class="kv-b" data-k="zf">Breite</button>
        <i class="kv-sep"></i><button type="button" class="kv-b" data-k="po"></button><button type="button" class="kv-b" data-k="timer">Timer ▶</button><button type="button" class="kv-b sp" data-k="split">Nebeneinander</button>
      </div><div class="kv-panes"></div>`;
    document.body.append(root); document.body.classList.add('kv-open');
    const panes = root.querySelector('.kv-panes'), tabsEl = root.querySelector('.kv-tabs');
    function getDoc(k) {
      if (docs[k]) return docs[k];
      const host = document.createElement('div'); host.className = 'kv-pane'; panes.append(host);
      const d = mkDoc(ctx, recOf(k), host, { onHist: upd, onReady: upd, onRetry: () => { d.destroy(); host.remove(); delete docs[k]; layout(); } });
      d.host = host; return docs[k] = d;
    }
    function shown() {
      if (split && innerWidth >= 900) { const left = av.includes('aufg') ? 'aufg' : av[0], right = active !== left ? active : (av.find(k => k !== left && k !== 'loes') || left); return left === right ? [left] : [left, right]; }
      return [active];
    }
    function layout() {
      const sh = shown(); Object.keys(docs).forEach(k => { docs[k].host.style.display = sh.includes(k) ? '' : 'none'; });
      sh.forEach(k => getDoc(k)); panes.classList.toggle('two', sh.length === 2);
      sh.forEach(k => { docs[k].host.style.display = ''; docs[k].setMode(); });
      tabsEl.innerHTML = av.map(k => `<button type="button" class="${k === active ? 'on' : ''}${k === 'loes' ? ' warn' : ''}" data-tab="${k}">${k === 'loes' && sure ? 'Wirklich ansehen?' : KIND[k]}${hasAnn(recOf(k).id) ? '<i></i>' : ''}</button>`).join('');
      upd();
    }
    const cur = () => docs[shown().slice(-1)[0]] || docs[active];
    async function copyAnswers() {
      const out = [`Prüfung: ${A[1]} ${ex.label} (${ex.term.replace('AP', 'AP ')})`, `Bearbeitet am ${new Date().toLocaleDateString('de-DE')}`, ''];
      av.filter(k => k !== 'beleg' && k !== 'loes').forEach(k => {
        const d = docs[k]; const fl = d && d.fieldTexts ? d.fieldTexts() : (() => { const a = annLocal(recOf(k).id); const r = []; a && Object.keys(a.p || {}).sort((x, y) => x - y).forEach(i => Object.values(a.p[i].a || {}).forEach(v => { if ((v.t || '').trim() || (v.n || '').trim()) r.push({ page: +i, n: (v.n || '').trim(), t: (v.t || '').trim() }); })); return r; })();
        fl.forEach(f => out.push(`Aufgabe ${f.n || '?'} (Seite ${f.page}, ${KIND[k]}):`, f.t || '(leer)', ''));
        const a = annLocal(recOf(k).id), tx = [];
        a && Object.keys(a.p || {}).sort((x, y) => x - y).forEach(i => (a.p[i].t || []).slice().sort((u, v) => u.y - v.y).forEach(t => tx.push(`Seite ${i}: ${t.t}`)));
        if (tx.length) out.push(`Text-Notizen auf ${KIND[k]}:`, ...tx, '');
      });
      const txt = out.join('\n').trim() + '\n', b = root.querySelector('[data-k=copyans]'), old = 'Antworten kopieren';
      let ok = false; try { await navigator.clipboard.writeText(txt); ok = true; } catch (_) {}
      if (ok) { b.textContent = 'Kopiert ✓'; setTimeout(() => { b.textContent = old; }, 2500); return; }
      root.querySelector('.kv-copy')?.remove();
      const m = document.createElement('div'); m.className = 'kv-copy'; m.innerHTML = '<div class="ln-sub">Text markieren und kopieren, dann im Chat einfügen.</div><textarea readonly rows="12"></textarea><button type="button" class="kv-b" data-k="copyclose">Schließen</button>'; m.querySelector('textarea').value = txt; root.append(m); m.querySelector('textarea').select();
    }
    function upd() {
      root.querySelectorAll('.tl').forEach(b => b.classList.toggle('on', b.dataset.t === S.tool));
      root.querySelectorAll('.kv-dot').forEach(b => b.classList.toggle('on', +b.dataset.c === S.color));
      root.querySelector('[data-k=w]').textContent = 'Strich: ' + WIDTHS[S.w][0]; root.querySelector('[data-k=ts]').textContent = 'Text: ' + TSIZES[S.ts][0];
      root.querySelector('[data-k=po]').textContent = S.po ? 'Nur Stift: an' : 'Nur Stift: aus'; root.querySelector('[data-k=po]').classList.toggle('on', S.po);
      root.querySelector('[data-k=split]').hidden = innerWidth < 900 || av.length < 2; root.querySelector('[data-k=split]').classList.toggle('on', split);
      const d = cur(); root.querySelector('[data-k=undo]').disabled = !(d && d.hist.length);
    }
    function clock() {
      const el = root.querySelector('[data-k=time]'), b = root.querySelector('[data-k=timer]');
      if (!timer) { el.textContent = ''; b.textContent = 'Timer ▶'; return; }
      const s = Math.round((timer - Date.now()) / 1000), a = Math.abs(s);
      el.textContent = (s < 0 ? '+' : '') + Math.floor(a / 60) + ':' + String(a % 60).padStart(2, '0'); el.classList.toggle('over', s < 0); b.textContent = 'Timer ■';
    }
    const close = () => { Object.values(docs).forEach(d => { d.flush(); d.destroy(); }); clearInterval(tick); root.remove(); document.body.classList.remove('kv-open'); removeEventListener('resize', layout); ctx.onClose && ctx.onClose(); };
    root.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return; const k = b.dataset.k, d = cur();
      if (b.dataset.tab) {
        if (b.dataset.tab === 'loes' && active !== 'loes' && !sure) { sure = true; layout(); setTimeout(() => { if (sure) { sure = false; layout(); } }, 4000); return; }
        sure = false; active = b.dataset.tab; layout(); return;
      }
      if (b.dataset.t) { S.tool = b.dataset.t; Object.values(docs).forEach(x => x.setMode()); upd(); return; }
      if (b.dataset.c) { S.color = +b.dataset.c; saveUi(); upd(); return; }
      if (k === 'copyans') copyAnswers();
      else if (k === 'copyclose') root.querySelector('.kv-copy')?.remove();
      else if (k === 'back') close();
      else if (k === 'w') { S.w = (S.w + 1) % 3; saveUi(); upd(); }
      else if (k === 'ts') { S.ts = (S.ts + 1) % 3; saveUi(); upd(); }
      else if (k === 'po') { S.po = !S.po; saveUi(); Object.values(docs).forEach(x => x.setMode()); upd(); }
      else if (k === 'undo') d && d.undo();
      else if (k === 'clear') { if (b.dataset.sure) { d && d.clearPage(); delete b.dataset.sure; b.textContent = 'Seite leeren'; } else { b.dataset.sure = '1'; b.textContent = 'Sicher?'; setTimeout(() => { delete b.dataset.sure; b.textContent = 'Seite leeren'; }, 3000); } }
      else if (k === 'zm' && d) d.setZoom(Math.max(1, +(d.z - 0.25).toFixed(2)));
      else if (k === 'zp' && d) d.setZoom(Math.min(3.5, +(d.z + 0.25).toFixed(2)));
      else if (k === 'zf' && d) d.setZoom(1);
      else if (k === 'split') { split = !split; layout(); }
      else if (k === 'timer') { timer = timer ? null : Date.now() + A[2] * 60000; clock(); }
    });
    addEventListener('resize', layout);
    tick = setInterval(clock, 1000);
    layout();
    return { close };
  }

  // ---------- Liste ----------
  async function upload(ctx, files, msg) {
    const have = new Set((ctx.getFiles() || []).map(r => r.titel)); let ok = 0, skip = 0, bad = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i], titel = f.name.replace(/\.[^.]+$/, '').slice(0, 190);
      msg.textContent = `Lade hoch … ${i + 1} / ${files.length}`;
      if (have.has(titel)) { skip++; continue; }
      if (!/\.pdf$/i.test(f.name) || f.size > 31457280) { bad++; continue; }
      const p = parse({ titel, datei: f.name }), fd = new FormData();
      fd.append('user', ctx.uid()); fd.append('titel', titel); fd.append('bereich', p ? p.area : 'alle'); fd.append('datei', f);
      try { await ctx.pb.collection('lern_dateien').create(fd, { requestKey: null }); ok++; } catch (_) { bad++; }
    }
    msg.textContent = `${ok} hochgeladen${skip ? ', ' + skip + ' schon da' : ''}${bad ? ', ' + bad + ' nicht möglich (nur PDF bis 30 MB)' : ''}.`;
    if (ok) await ctx.reload();
  }
  function list(el, ctx, st) {
    const all = exams(ctx.getFiles()), area = st.area || 'elek';
    const ex = all.filter(e => e.area === area), cnt = a => all.filter(e => e.area === a).length;
    if (st.open) {
      const o = st.open; st.open = null; const e = all.find(x => x.area === o.area && x.term === o.term);
      if (e) setTimeout(() => openExam(ctx, e, o.tab), 0); else st.miss = true;
    }
    el.innerHTML = `<div class="ln-card glass kl-top"><div class="ln-seg">${Object.keys(AREA).map(a => `<button type="button" data-a="${a}" class="${a === area ? 'on' : ''}">${AREA[a][0]} ${cnt(a) || ''}</button>`).join('')}</div>
        <div class="ln-sub">Original-Blätter wie in der Prüfung: auf den Antwortzeilen direkt tippen (oben „Nr.“ = Aufgabennummer), mit Stift oder Text beschriften, oben „Antworten kopieren“ zur Korrektur. Lösung bleibt zu, bis du sie öffnest.</div>
        ${st.miss ? '<div class="ln-note">Diese Prüfung ist noch nicht hochgeladen. Unten die PDFs auswählen.</div>' : ''}</div>
      ${ex.length ? `<div class="kl-grid">${ex.map(e => `<button type="button" class="kl-row glass" data-e="${esc(e.key)}"><div class="kl-h"><b>${esc(e.label)}</b><small>${esc(e.term.replace('AP', 'AP '))}</small></div>
          <div class="kl-chips">${KORD.filter(k => k === 'extra' ? e.extra.length : e.docs[k]).map(k => `<span class="kl-c${k === 'loes' ? ' w' : ''}">${KIND[k]}${hasAnn((k === 'extra' ? e.extra[0] : e.docs[k]).id) ? ' ✎' : ''}</span>`).join('')}</div></button>`).join('')}</div>`
        : '<div class="ln-card glass ln-empty">Für diesen Bereich ist noch nichts hochgeladen.</div>'}
      <details class="ln-card glass kl-up"${all.length ? '' : ' open'}><summary>Prüfungs-PDFs hochladen</summary>
        <div class="ln-sub">Alle PDFs auf einmal markieren (am PC im Browser am einfachsten). Name wie „01 - GA2 - APW2122 - Belegsatz.pdf“, dann wird alles automatisch richtig einsortiert. Liegt privat auf deinem Server.</div>
        <label class="ln-btn soft sm" style="cursor:pointer;display:inline-block">PDFs wählen<input class="sr-only" id="klFile" type="file" accept=".pdf,application/pdf" multiple></label>
        <div class="ln-note" id="klMsg"></div></details>`;
    el.querySelector('.ln-seg').onclick = e => { const b = e.target.closest('button'); if (b) { st.area = b.dataset.a; st.miss = false; list(el, ctx, st); } };
    el.querySelectorAll('.kl-row').forEach(b => b.onclick = () => openExam(ctx, all.find(x => x.key === b.dataset.e)));
    const inp = el.querySelector('#klFile'); inp.onchange = () => { if (inp.files.length) upload(ctx, [...inp.files], el.querySelector('#klMsg')); };
  }

  window.LERN_KL = { detectFields, list, open: (ctx, a, term, tab) => { const e = exams(ctx.getFiles()).find(x => x.area === a && x.term === term); if (e) { openExam(ctx, e, tab); return true; } return false; }, parse, exams };
})();
