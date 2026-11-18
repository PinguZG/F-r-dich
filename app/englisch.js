// Englisch-Vokabeln (Lernen → Ida). Wörter in „Vokabelständen“ (app/lernen/englisch-data.js, 5. Feld = Stand), Übersicht + Karteikarten.
// Karteikarten: oben Ordner-Reiter Kann ich nicht / Kann ich / Kann ich gut (setzen den Stand, drehen nicht), Karte dreht sich beim Tippen.
// ⚙︎ = Schrift/Richtung, Schieberegler = Zeichnungen (app/lernen/englisch-doodles.js). Ein Stand lässt sich nach der Prüfung abhaken (erledigt).
// Speicher: lokal (Offline) + Collection lern_vokabeln (nur eigene Zeilen). Wörter: wordId 'en7:<Wort>', level 0–2. Stand: wordId 'stand:<Name>', level 1 = erledigt.
(() => {
  const pb = window.WIR_PB;
  if (!pb) return;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const meRec = () => pb.authStore.record || pb.authStore.model;
  const uid = () => meRec()?.id;
  const $ = id => document.getElementById(id);
  const LV = { 0: 'Kann ich nicht', 1: 'Kann ich', 2: 'Kann ich gut' };

  let WORDS = null, STANDS = [], ST = { w: {}, done: {}, q: {}, ids: {} }, el = null, flushing = false;
  const E = { tab: 'liste', filter: 'alle', q: '', open: null, stand: null, lpos: 0, sure: false };
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
        ${open ? `<div class="en-more">${w.ipa ? `<div class="en-ipa">${esc(w.ipa)}</div>` : ''}<div class="en-def">${esc(w.def)}</div><div class="en-set">${[0, 1, 2].map(l => `<button type="button" data-en="set" data-id="${esc(w.id)}" data-l="${l}" class="${lvl(w) === l ? 'on l' + l : ''}">${LV[l]}</button>`).join('')}</div></div>` : ''}</div>`;
    }).join('');
  }
  function vListe(b) {
    const c = counts(wordsOf(curStand()));
    const F = [['alle', 'Alle'], ['neu', `Neu ${c.neu}`], ['0', `Nicht ${c[0]}`], ['1', `Kann ${c[1]}`], ['2', `Gut ${c[2]}`]];
    b.innerHTML = `<input class="ln-input en-q" id="enQ" type="search" placeholder="Suchen" value="${esc(E.q)}" autocomplete="off">
      <div class="en-chips">${F.map(([k, n]) => `<button type="button" data-en="filter" data-x="${k}" class="${E.filter === k ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div id="enList" class="en-list">${listHtml()}</div>`;
    $('enQ').oninput = e => { E.q = e.target.value; $('enList').innerHTML = listHtml(); };
  }

  // ---------- Karteikarten ----------
  const FONTS = [['caveat', 'Handschrift', "Caveat,cursive", ''], ['patrick', 'Schulheft', "'Patrick Hand',cursive", 'Patrick+Hand'],
    ['shadows', 'Zart', "'Shadows Into Light',cursive", 'Shadows+Into+Light'], ['gloria', 'Verspielt', "'Gloria Hallelujah',cursive", 'Gloria+Hallelujah'],
    ['klar', 'Klar', "Quicksand,sans-serif", '']];
  const PREF = 'wir-en-karten', DEF = { font: 'caveat', dir: 'ed', pics: true };
  const prefs = () => { try { return Object.assign({}, DEF, JSON.parse(localStorage.getItem(PREF) || '{}')); } catch (_) { return Object.assign({}, DEF); } };
  let P = null;
  const savePrefs = () => { try { localStorage.setItem(PREF, JSON.stringify(P)); } catch (_) {} };
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
      <div class="kk-tabs">${[0, 1, 2].map(x => `<button type="button" class="kk-tab t${x} ${l === x ? 'on' : ''}" data-en="lv" data-l="${x}">${LV[x]}</button>`).join('')}</div>
      <div class="kk-card" id="enCard" data-en="kflip" role="button" tabindex="0" aria-label="Karte umdrehen"><div class="kk-in">
        ${face('', en ? 'Englisch' : 'Deutsch', front)}${face('kk-back', en ? 'Deutsch' : 'Englisch', back)}
      </div></div></div>`;
  }
  function paintTabs(w) {
    const k = $('enKK'); if (!k) return; const l = lvl(w);
    k.dataset.l = l === undefined ? 'n' : l;
    k.querySelectorAll('.kk-tab').forEach(t => t.classList.toggle('on', +t.dataset.l === l));
  }
  function vKarten(b) {
    if (!P) P = prefs();
    loadFont(P.font); needDoodles();
    const deck = wordsOf(curStand());
    const top = `<div class="kk-top"><label class="kk-pics"><span>Bilder</span><input type="checkbox" class="switch" id="enPics" ${P.pics ? 'checked' : ''} aria-label="Zeichnungen auf den Karten"></label><button type="button" class="kk-gear" data-en="gear" aria-label="Einstellungen">⚙︎</button></div>`;
    if (!deck.length) { b.innerHTML = top + '<div class="ln-empty">Keine Wörter.</div>'; return; }
    E.lpos = Math.min(E.lpos, deck.length - 1);
    b.innerHTML = top + cardHtml(deck[E.lpos], E.lpos + 1, deck.length) +
      `<div class="kk-nav"><button type="button" class="ln-btn soft" data-en="lprev" aria-label="Vorherige Karte">‹</button><button type="button" class="ln-btn soft kk-grow" data-en="kflip">Umdrehen</button><button type="button" class="ln-btn soft" data-en="lnext" aria-label="Nächste Karte">›</button></div>`;
  }
  function flipCard() { $('enCard')?.classList.toggle('flip'); }
  function pickLevel(l) { const w = wordsOf(curStand())[E.lpos]; if (w) { setLevel(w, l); paintTabs(w); } }

  // Einstellungen (Blatt von unten, am body, damit „fixed“ sicher greift)
  function openSheet() {
    closeSheet();
    const sh = document.createElement('div'); sh.className = 'en-sheet'; sh.id = 'enSheet';
    sh.innerHTML = `<div class="en-sh glass"><div class="ln-row"><b class="ln-sp" style="font-size:17px">Einstellungen</b><button type="button" class="en-shx" data-s="close" aria-label="Schließen">✕</button></div>
      <div class="ln-sub">Schrift</div>
      <div class="en-fonts">${FONTS.map(f => `<button type="button" data-s="font" data-x="${f[0]}" class="${P.font === f[0] ? 'on' : ''}" style="font-family:${f[2]}">${f[1]}</button>`).join('')}</div>
      <div class="ln-sub">Vorderseite</div>
      <div class="ln-seg"><button type="button" data-s="dir" data-x="ed" class="${P.dir === 'ed' ? 'on' : ''}">Englisch</button><button type="button" data-s="dir" data-x="de" class="${P.dir === 'de' ? 'on' : ''}">Deutsch</button></div></div>`;
    FONTS.forEach(f => loadFont(f[0]));
    document.body.append(sh);
    sh.onclick = e => {
      if (e.target === sh) return closeSheet();
      const t = e.target.closest('[data-s]'); if (!t) return;
      if (t.dataset.s === 'close') return closeSheet();
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
      case 'stand': E.stand = d.x; E.lpos = 0; E.open = null; render(); break;
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
      case 'lv': pickLevel(+d.l); break;
      case 'lprev': { const n = wordsOf(curStand()).length; E.lpos = (E.lpos + n - 1) % n; render(); break; }
      case 'lnext': { const n = wordsOf(curStand()).length; E.lpos = (E.lpos + 1) % n; render(); break; }
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
    load(); render();
    try { if (await pull() && el === target) render(); } catch (e) { console.warn('[englisch] offline/sync', e?.message); }
  }
  function unmount() { closeSheet(); if (el) { el.onclick = null; el.onkeydown = null; el.onchange = null; } el = null; }
  window.addEventListener('online', flush);
  window.WIR_ENGLISCH = { mount, unmount };
})();
