// Englisch-Vokabeln (Lernen → Ida). Wörter in „Vokabelständen“ (app/lernen/englisch-data.js, 5. Feld = Stand), Übersicht + Karteikarten.
// Karteikarten: oben Ordner-Reiter Sehr gut / Okay / Schlecht = welche Karten drankommen (mehrfach), Karte dreht sich nur beim Tippen,
// unten drei Knöpfe bewerten und springen zur nächsten Karte.
// ⚙︎ = Schrift/Richtung, Schieberegler = Zeichnungen (app/lernen/englisch-doodles.js). Ein Stand lässt sich nach der Prüfung abhaken (erledigt).
// Speicher: lokal (Offline) + Collection lern_vokabeln (nur eigene Zeilen). Wörter: wordId 'en7:<Wort>', level 0–2. Stand: wordId 'stand:<Name>', level 1 = erledigt.
(() => {
  const pb = window.WIR_PB;
  if (!pb) return;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const meRec = () => pb.authStore.record || pb.authStore.model;
  const uid = () => meRec()?.id;
  const $ = id => document.getElementById(id);
  const LV = { 0: 'Schlecht', 1: 'Okay', 2: 'Sehr gut' };
  const ORDER = [2, 1, 0];                            // Anzeige-Reihenfolge: Sehr gut · Okay · Schlecht

  let WORDS = null, STANDS = [], ST = { w: {}, done: {}, q: {}, ids: {} }, el = null, flushing = false;
  const E = { tab: 'liste', filter: 'alle', q: '', open: null, stand: null, deck: null, dkey: '', dpos: 0, busy: false, sure: false };
  const SKEY = () => 'lernen-en-v1-' + uid();
  const load = () => { try { const j = JSON.parse(localStorage.getItem(SKEY()) || 'null'); if (j) ST = Object.assign({ w: {}, done: {}, q: {}, ids: {} }, j); } catch (_) {} };
  const persist = () => { try { localStorage.setItem(SKEY(), JSON.stringify(ST)); } catch (_) {} };

  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Laden fehlgeschlagen')); document.head.append(s); });
  }
  const prep = () => {
    WORDS = window.WIR_VOKABELN_EN.map((r, i) => ({ id: 'en7:' + r[0], i, en: r[0], ipa: r[1], def: r[2], de: r[3], grp: r[4] }));
    STANDS = [...new Set(WORDS.map(w => w.grp))];
  };
  const lvl = w => ST.w[w.id];                       // undefined = neu
  const isDone = s => !!ST.done[s];

  // ---------- Speichern / Sync ----------
  function queue(k, l) { ST.q[k] = l; persist(); flush(); }
  function setLevel(w, l) { ST.w[w.id] = l; queue(w.id, l); }
  function setDone(s, v) { ST.done[s] = v; queue('stand:' + s, v ? 1 : 0); }
  async function flush() {
    if (flushing || !uid() || !navigator.onLine) return;
    flushing = true;
    try {
      for (const k of Object.keys(ST.q)) {
        const l = ST.q[k], coll = pb.collection('lern_vokabeln');
        try {
          let id = ST.ids[k];
          if (!id) { try { id = (await coll.getFirstListItem(pb.filter('wordId = {:v}', { v: k }), { requestKey: null, fields: 'id' })).id; } catch (x) { if (x.status !== 404) throw x; } }
          if (id) await coll.update(id, { level: l }, { requestKey: null });
          else id = (await coll.create({ user: uid(), wordId: k, level: l }, { requestKey: null })).id;
          ST.ids[k] = id;
          if (ST.q[k] === l) delete ST.q[k]; persist();
        } catch (err) { if (err?.status >= 400 && err.status < 500 && err.status !== 429) { delete ST.q[k]; persist(); } else break; }
      }
    } finally { flushing = false; }
  }
  async function pull() {
    await flush();
    if (Object.keys(ST.q).length) return false;
    const rows = await pb.collection('lern_vokabeln').getFullList({ requestKey: null, batch: 500 });
    ST.w = {}; ST.done = {}; ST.ids = {};
    rows.forEach(r => {
      ST.ids[r.wordId] = r.id;
      if (r.wordId.startsWith('stand:')) ST.done[r.wordId.slice(6)] = r.level === 1; else ST.w[r.wordId] = r.level;
    });
    persist();
    return true;
  }

  // ---------- Kopf: aktueller Vokabelstand ----------
  const curStand = () => E.stand && STANDS.includes(E.stand) ? E.stand : (STANDS.find(s => !isDone(s)) || STANDS[STANDS.length - 1]);
  const wordsOf = s => WORDS.filter(w => w.grp === s);
  const counts = pool => { const c = { all: pool.length, neu: 0, 0: 0, 1: 0, 2: 0 }; pool.forEach(w => { const l = lvl(w); if (l === undefined) c.neu++; else c[l]++; }); return c; };
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const dot = w => { const l = lvl(w); return `<i class="en-dot l${l === undefined ? 'n' : l}"></i>`; };

  function head() {
    const s = curStand(), c = counts(wordsOf(s)), done = isDone(s), pc = v => c.all ? v / c.all * 100 : 0;
    const multi = STANDS.length > 1 ? `<div class="en-stands">${STANDS.map(x => `<button type="button" data-en="stand" data-x="${esc(x)}" class="${x === s ? 'on' : ''} ${isDone(x) ? 'done' : ''}">${esc(x.replace('Vokabelstand ', ''))}</button>`).join('')}</div>` : '';
    return `<section class="en-hero ${done ? 'done' : ''}">
        <div class="en-hero-row"><div class="en-hero-t"><small>Englisch</small><h2>${esc(s)}</h2></div>
          <button type="button" class="en-check ${E.sure ? 'sure' : ''}" data-en="done" aria-label="${done ? 'Wieder öffnen' : 'Abhaken'}">${done ? '✓' : (E.sure ? 'Sicher?' : '✓')}</button></div>
        <div class="en-bar"><span class="g" style="width:${pc(c[2])}%"></span><span class="m" style="width:${pc(c[1])}%"></span><span class="b" style="width:${pc(c[0])}%"></span></div>
        <div class="en-meta">${done ? 'Erledigt · ' : ''}${c[1] + c[2]} von ${c.all} gekonnt</div>${multi}
      </section>
      <div class="ln-seg en-tabs"><button type="button" data-en="tab" data-x="liste" class="${E.tab === 'liste' ? 'on' : ''}">Übersicht</button><button type="button" data-en="tab" data-x="karten" class="${E.tab === 'karten' ? 'on' : ''}">Karteikarten</button></div>`;
  }
  function render() {
    if (!el) return;
    el.innerHTML = '<div class="en-wrap">' + head() + '<div id="enBody" class="en-body"></div></div>';
    (E.tab === 'liste' ? vListe : vKarten)($('enBody'));
  }

  // ---------- Übersicht ----------
  function listHtml() {
    const q = E.q.trim().toLowerCase(), f = E.filter;
    const pool = wordsOf(curStand()).filter(w => {
      const l = lvl(w);
      if (f === 'neu' && l !== undefined) return false;
      if (f !== 'alle' && f !== 'neu' && l !== +f) return false;
      return !q || (w.en + ' ' + w.de + ' ' + w.def).toLowerCase().includes(q);
    });
    if (!pool.length) return '<div class="ln-empty">Nichts gefunden.</div>';
    return pool.map(w => {
      const open = E.open === w.id;
      return `<div class="en-row ${open ? 'open' : ''}"><button type="button" class="en-top" data-en="open" data-id="${esc(w.id)}">${dot(w)}<span class="en-w"><b>${esc(w.en)}</b><span class="en-de">${esc(w.de)}</span></span></button>
        ${open ? `<div class="en-more">${w.ipa ? `<div class="en-ipa">${esc(w.ipa)}</div>` : ''}<div class="en-def">${esc(w.def)}</div><div class="en-set">${ORDER.map(l => `<button type="button" data-en="set" data-id="${esc(w.id)}" data-l="${l}" class="${lvl(w) === l ? 'on l' + l : ''}">${LV[l]}</button>`).join('')}</div></div>` : ''}</div>`;
    }).join('');
  }
  function vListe(b) {
    const c = counts(wordsOf(curStand()));
    const F = [['alle', 'Alle'], ['neu', `Neu ${c.neu}`], ['2', `Sehr gut ${c[2]}`], ['1', `Okay ${c[1]}`], ['0', `Schlecht ${c[0]}`]];
    b.innerHTML = `<input class="ln-input en-q" id="enQ" type="search" placeholder="Suchen" value="${esc(E.q)}" autocomplete="off">
      <div class="en-chips">${F.map(([k, n]) => `<button type="button" data-en="filter" data-x="${k}" class="${E.filter === k ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div id="enList" class="en-list">${listHtml()}</div>`;
    $('enQ').oninput = e => { E.q = e.target.value; $('enList').innerHTML = listHtml(); };
  }

  // ---------- Karteikarten ----------
  const FONTS = [['caveat', 'Handschrift', "Caveat,cursive", ''], ['patrick', 'Schulheft', "'Patrick Hand',cursive", 'Patrick+Hand'],
    ['shadows', 'Zart', "'Shadows Into Light',cursive", 'Shadows+Into+Light'], ['gloria', 'Verspielt', "'Gloria Hallelujah',cursive", 'Gloria+Hallelujah'],
    ['klar', 'Klar', "Quicksand,sans-serif", '']];
  const PREF = 'wir-en-karten', DEF = { font: 'caveat', dir: 'ed', pics: true, sel: [0, 1, 2] };
  const prefs = () => { try { return Object.assign({}, DEF, JSON.parse(localStorage.getItem(PREF) || '{}')); } catch (_) { return Object.assign({}, DEF); } };
  let P = null;
  const savePrefs = () => { try { localStorage.setItem(PREF, JSON.stringify(P)); } catch (_) {} };
  // eigene Farben der drei Stufen (⚙︎): setzt --en-g/-y/-r am Lernen-Screen, Schrift darauf hell/dunkel je nach Helligkeit
  const COL_DEF = { g: '#9fdcb0', y: '#f9dc8a', r: '#f6a39b' };
  const onText = hex => { const n = parseInt(hex.slice(1), 16), L = (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255; return L > 0.6 ? '#3d2f36' : '#ffffff'; };
  function applyColors() {
    const root = $('s-lernen'); if (!root) return;
    if (!P) P = prefs();
    for (const k of ['g', 'y', 'r']) {
      const c = P.colors?.[k];
      if (c && /^#[0-9a-f]{6}$/i.test(c)) { root.style.setProperty('--en-' + k, c); root.style.setProperty('--en-on-' + k, onText(c)); }
      else { root.style.removeProperty('--en-' + k); root.style.removeProperty('--en-on-' + k); }
    }
  }
  const fontOf = k => FONTS.find(f => f[0] === k) || FONTS[0];
  function loadFont(k) {
    const f = fontOf(k); if (!f[3] || $('enf-' + k)) return;
    const l = document.createElement('link'); l.id = 'enf-' + k; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=' + f[3] + '&display=swap'; document.head.append(l);
  }
  let lastDoodle = -1, doodleLoading = false;
  function doodle() {
    const D = window.WIR_EN_DOODLES; if (!D || !P.pics) return '';
    const k = Object.keys(D); let i; do { i = Math.floor(Math.random() * k.length); } while (i === lastDoodle && k.length > 1);
    lastDoodle = i; return D[k[i]];
  }
  const paintDoodle = () => { const d = doodle(); document.querySelectorAll('.kk-dd').forEach(x => x.innerHTML = d); };
  function needDoodles() {
    if (window.WIR_EN_DOODLES || doodleLoading) return;
    doodleLoading = true;
    loadScript('/lernen/englisch-doodles.js').then(() => { if (el && E.tab === 'karten') paintDoodle(); }).catch(() => { doodleLoading = false; });
  }

  function cardHtml(w, n, total) {
    const l = lvl(w), en = P.dir === 'ed', d = doodle();
    const faceEn = `<div class="kk-big">${esc(w.en)}</div>${w.ipa ? `<div class="kk-ipa">${esc(w.ipa)}</div>` : ''}`;
    const faceDe = `<div class="kk-big">${esc(w.de)}</div>`;
    const front = en ? faceEn : faceDe, back = (en ? faceDe : faceEn) + `<div class="kk-def">${esc(w.def)}</div>`;
    const face = (cls, side, body) => `<div class="kk-face ${cls}"><div class="kk-dd">${d}</div><div class="kk-head"><span>${side}</span><span>${n} / ${total}</span></div><div class="kk-mid">${body}</div></div>`;
    return `<div class="kk" id="enKK" data-l="${l === undefined ? 'n' : l}" style="--kf:${fontOf(P.font)[2]}">
      ${tabsHtml()}
      <div class="kk-card" id="enCard" data-en="kflip" role="button" tabindex="0" aria-label="Karte umdrehen"><div class="kk-in">
        ${face('', en ? 'Englisch' : 'Deutsch', front)}${face('kk-back', en ? 'Deutsch' : 'Englisch', back)}
      </div></div></div>`;
  }
  // Reiter oben = welche Karten drankommen (mehrfach wählbar). „Schlecht“ enthält auch noch nicht bewertete Wörter.
  const tabsHtml = () => `<div class="kk-tabs">${ORDER.map(x => `<button type="button" class="kk-tab t${x} ${P.sel.includes(x) ? 'on' : ''}" data-en="sel" data-l="${x}" aria-pressed="${P.sel.includes(x)}">${LV[x]}</button>`).join('')}</div>`;
  const inSel = w => { const l = lvl(w); return P.sel.includes(l === undefined ? 0 : l); };
  function deck() {                                    // Runde: gemischt, neu gebaut wenn Auswahl/Stand wechselt
    const key = curStand() + '|' + [...P.sel].sort().join('');
    if (!E.deck || E.dkey !== key) { E.dkey = key; E.dpos = 0; E.deck = shuffle(wordsOf(curStand()).filter(inSel).map(w => w.i)); }
    return E.deck;
  }
  function vKarten(b) {
    if (!P) P = prefs();
    loadFont(P.font); needDoodles();
    const top = `<div class="kk-top"><label class="kk-pics"><span>Bilder</span><input type="checkbox" class="switch" id="enPics" ${P.pics ? 'checked' : ''} aria-label="Zeichnungen auf den Karten"></label><button type="button" class="kk-gear" data-en="gear" aria-label="Einstellungen">⚙︎</button></div>`;
    const d = deck();
    if (!d.length) { b.innerHTML = top + `<div class="kk kk-none">${tabsHtml()}<div class="kk-empty">Hier sind gerade keine Karten.</div></div>`; return; }
    if (E.dpos >= d.length) {
      b.innerHTML = top + `<div class="kk kk-none">${tabsHtml()}<div class="kk-empty"><b>Runde geschafft</b><button type="button" class="ln-btn" data-en="again">Nochmal</button></div></div>`;
      return;
    }
    b.innerHTML = top + cardHtml(WORDS[d[E.dpos]], E.dpos + 1, d.length) +
      `<div class="kk-rate">${ORDER.map(x => `<button type="button" class="r${x}" data-en="rate" data-l="${x}">${LV[x]}</button>`).join('')}</div>`;
  }
  function flipCard() { $('enCard')?.classList.toggle('flip'); }
  function rate(l, btn) {
    if (E.busy) return;
    const w = WORDS[E.deck[E.dpos]]; if (!w) return;
    setLevel(w, l); E.busy = true; btn?.classList.add('hit');
    const k = $('enKK'); if (k) k.dataset.l = l;
    setTimeout(() => { E.busy = false; E.dpos++; if (el && E.tab === 'karten') render(); }, 260);
  }
  function toggleSel(l) {
    const i = P.sel.indexOf(l);
    if (i >= 0) { if (P.sel.length === 1) { const k = $('enKK'); if (k) { k.classList.remove('wig'); void k.offsetWidth; k.classList.add('wig'); } return; } P.sel.splice(i, 1); }
    else P.sel.push(l);
    savePrefs(); render();
  }

  // Einstellungen (Blatt von unten, am body, damit „fixed“ sicher greift)
  function openSheet() {
    closeSheet();
    const sh = document.createElement('div'); sh.className = 'en-sheet'; sh.id = 'enSheet';
    sh.innerHTML = `<div class="en-sh"><div class="ln-row"><b class="ln-sp" style="font-size:17px">Einstellungen</b><button type="button" class="en-shx" data-s="close" aria-label="Schließen">✕</button></div>
      <div class="ln-sub">Schrift</div>
      <div class="en-fonts">${FONTS.map(f => `<button type="button" data-s="font" data-x="${f[0]}" class="${P.font === f[0] ? 'on' : ''}" style="font-family:${f[2]}">${f[1]}</button>`).join('')}</div>
      <div class="ln-sub">Vorderseite</div>
      <div class="ln-seg"><button type="button" data-s="dir" data-x="ed" class="${P.dir === 'ed' ? 'on' : ''}">Englisch</button><button type="button" data-s="dir" data-x="de" class="${P.dir === 'de' ? 'on' : ''}">Deutsch</button></div>
      <div class="ln-sub">Farben</div>
      <div class="en-cols">${ORDER.map(l => { const k = 'gyr'[2 - l]; return `<label class="en-col"><input type="color" data-col="${k}" value="${(P.colors && P.colors[k]) || COL_DEF[k]}" aria-label="Farbe ${LV[l]}"><span>${LV[l]}</span></label>`; }).join('')}</div>
      <button type="button" class="en-reset" data-s="reset">Standardfarben</button></div>`;
    FONTS.forEach(f => loadFont(f[0]));
    document.body.append(sh);
    sh.oninput = e => { const k = e.target.dataset?.col; if (!k) return; P.colors = Object.assign({}, COL_DEF, P.colors, { [k]: e.target.value }); applyColors(); };
    sh.onchange = e => { if (e.target.dataset?.col) savePrefs(); };
    sh.onclick = e => {
      if (e.target === sh) return closeSheet();
      const t = e.target.closest('[data-s]'); if (!t) return;
      if (t.dataset.s === 'close') return closeSheet();
      if (t.dataset.s === 'reset') { P.colors = null; savePrefs(); applyColors(); sh.querySelectorAll('[data-col]').forEach(i => i.value = COL_DEF[i.dataset.col]); return; }
      P[t.dataset.s] = t.dataset.x; savePrefs();
      sh.querySelectorAll(`[data-s="${t.dataset.s}"]`).forEach(x => x.classList.toggle('on', x === t)); render();
    };
  }
  function closeSheet() { $('enSheet')?.remove(); }

  let sureT = null;
  function onClick(e) {
    const t = e.target.closest('[data-en]'); if (!t) return;
    const d = t.dataset;
    switch (d.en) {
      case 'tab': E.tab = d.x; render(); break;
      case 'stand': E.stand = d.x; E.deck = null; E.open = null; render(); break;
      case 'done': {                                   // Abhaken mit zweitem Tipp bestätigen; erledigt → Tipp öffnet wieder
        const s = curStand();
        if (isDone(s)) { setDone(s, false); E.stand = s; render(); break; }
        if (!E.sure) { E.sure = true; render(); clearTimeout(sureT); sureT = setTimeout(() => { E.sure = false; if (el) render(); }, 3000); break; }
        E.sure = false; clearTimeout(sureT); setDone(s, true); E.stand = s; render(); break;
      }
      case 'filter': E.filter = d.x; E.open = null; render(); break;
      case 'open': E.open = E.open === d.id ? null : d.id; $('enList').innerHTML = listHtml(); break;
      case 'set': { const w = WORDS.find(x => x.id === d.id); if (w) { setLevel(w, +d.l); render(); } break; }
      case 'gear': openSheet(); break;
      case 'kflip': flipCard(); break;
      case 'sel': toggleSel(+d.l); break;
      case 'rate': rate(+d.l, t); break;
      case 'again': E.deck = null; render(); break;
    }
  }
  function onKey(e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.id === 'enCard') { e.preventDefault(); flipCard(); } }
  function onChange(e) { if (e.target.id === 'enPics') { P.pics = e.target.checked; savePrefs(); paintDoodle(); } }

  // Einstieg aus lernen.js: zeigt den Englisch-Bereich im übergebenen Element
  async function mount(target) {
    el = target; el.onclick = onClick; el.onkeydown = onKey; el.onchange = onChange;
    el.innerHTML = '<div class="ln-empty">Lade …</div>';
    try { if (!window.WIR_VOKABELN_EN) await loadScript('/lernen/englisch-data.js'); } catch (_) { el.innerHTML = '<div class="ln-empty">Konnte nicht geladen werden. Bitte einmal mit Netz öffnen.</div>'; return; }
    if (!WORDS) prep();
    load(); applyColors(); render();
    try { if (await pull() && el === target) render(); } catch (e) { console.warn('[englisch] offline/sync', e?.message); }
  }
  function unmount() { closeSheet(); if (el) { el.onclick = null; el.onkeydown = null; el.onchange = null; } el = null; }
  window.addEventListener('online', flush);
  window.WIR_ENGLISCH = { mount, unmount };
})();
