// Englisch-Vokabeln (18.11.2026): Reiter „Englisch“ in Lernen → Ida. Übersicht aller Wörter + Karteikarten (v92: Ordner-Reiter
// Kann ich nicht / Kann ich / Kann ich gut, Modi Lernen/Abfrage, Schrift/Richtung/Teil über ⚙︎, Hintergrund-Zeichnungen aus englisch-doodles.js). Wörter: app/lernen/englisch-data.js (window.WIR_VOKABELN_EN), wird beim ersten Öffnen nachgeladen.
// Stand je Wort: lokal gespeichert (Offline) und in die Collection lern_vokabeln geschrieben (nur eigene Zeilen, Regeln serverseitig).
(() => {
  const pb = window.WIR_PB;
  if (!pb) return;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const meRec = () => pb.authStore.record || pb.authStore.model;
  const uid = () => meRec()?.id;
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const LV = { 0: 'Kann ich nicht', 1: 'Kann ich', 2: 'Kann ich gut' };

  let WORDS = null, ST = { w: {}, q: {}, ids: {} }, el = null, flushing = false;
  const E = { tab: 'liste', filter: 'alle', q: '', open: null, mode: 'offen', km: 'lernen', lpos: 0, busy: false, ses: null };
  const SKEY = () => 'lernen-en-v1-' + uid();
  const load = () => { try { const j = JSON.parse(localStorage.getItem(SKEY()) || 'null'); if (j) ST = Object.assign({ w: {}, q: {}, ids: {} }, j); } catch (_) {} };
  const persist = () => { try { localStorage.setItem(SKEY(), JSON.stringify(ST)); } catch (_) {} };

  function loadData() {
    if (window.WIR_VOKABELN_EN) return Promise.resolve();
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = '/lernen/englisch-data.js'; s.onload = res; s.onerror = () => rej(new Error('Laden fehlgeschlagen')); document.head.append(s); });
  }
  const prep = () => { WORDS = window.WIR_VOKABELN_EN.map((r, i) => ({ id: 'en7:' + r[0], i, en: r[0], ipa: r[1], def: r[2], de: r[3], grp: r[4] })); };
  const lvl = w => ST.w[w.id];                       // undefined = neu

  // ---------- Speichern / Sync ----------
  function setLevel(w, l) { ST.w[w.id] = l; ST.q[w.id] = l; persist(); flush(); }
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
    ST.w = {}; ST.ids = {};
    rows.forEach(r => { ST.w[r.wordId] = r.level; ST.ids[r.wordId] = r.id; });
    persist();
    return true;
  }

  // ---------- Ansicht ----------
  const counts = pool => { const c = { all: pool.length, neu: 0, 0: 0, 1: 0, 2: 0 }; pool.forEach(w => { const l = lvl(w); if (l === undefined) c.neu++; else c[l]++; }); return c; };
  const groups = () => [...new Set(WORDS.map(w => w.grp))];
  const dot = w => { const l = lvl(w); return `<i class="en-dot l${l === undefined ? 'n' : l}" title="${l === undefined ? 'Neu' : LV[l]}"></i>`; };

  function head() {
    const c = counts(WORDS);
    return `<div class="ln-card glass"><div class="ln-row"><div class="ln-sp"><h3 style="margin:0">Englisch · Unit 7 Multiculturalism</h3><div class="ln-sub">${c.all} Wörter · ${c[2]} gut · ${c[1]} können · ${c[0]} nicht · ${c.neu} neu</div></div></div>
      <div class="en-bar"><span class="g" style="width:${c.all ? c[2] / c.all * 100 : 0}%"></span><span class="m" style="width:${c.all ? c[1] / c.all * 100 : 0}%"></span><span class="b" style="width:${c.all ? c[0] / c.all * 100 : 0}%"></span></div></div>
      <div class="ln-seg"><button type="button" data-en="tab" data-x="liste" class="${E.tab === 'liste' ? 'on' : ''}">Übersicht</button><button type="button" data-en="tab" data-x="karten" class="${E.tab === 'karten' ? 'on' : ''}">Karteikarten</button></div>`;
  }
  function render() {
    if (!el) return;
    el.innerHTML = '<div class="en-wrap">' + head() + '<div id="enBody"></div></div>';
    (E.tab === 'liste' ? vListe : vKarten)($('enBody'));
  }
  const $ = id => document.getElementById(id);

  function listHtml() {
    const q = E.q.trim().toLowerCase();
    const f = E.filter;
    const pool = WORDS.filter(w => {
      const l = lvl(w);
      if (f === 'neu' && l !== undefined) return false;
      if (f !== 'alle' && f !== 'neu' && l !== +f) return false;
      return !q || (w.en + ' ' + w.de + ' ' + w.def).toLowerCase().includes(q);
    });
    if (!pool.length) return '<div class="ln-empty">Nichts gefunden.</div>';
    let out = '', last = '';
    for (const w of pool) {
      if (w.grp !== last) { last = w.grp; out += `<div class="ln-grp">${esc(w.grp)}</div>`; }
      const open = E.open === w.id;
      out += `<div class="en-row glass ${open ? 'open' : ''}"><button type="button" class="en-top" data-en="open" data-id="${esc(w.id)}">${dot(w)}<span class="en-w"><b>${esc(w.en)}</b>${w.ipa ? ` <small>${esc(w.ipa)}</small>` : ''}<span class="en-de">${esc(w.de)}</span></span></button>
        ${open ? `<div class="en-more"><div class="en-def">${esc(w.def)}</div><div class="en-set">${[0, 1, 2].map(l => `<button type="button" data-en="set" data-id="${esc(w.id)}" data-l="${l}" class="${lvl(w) === l ? 'on l' + l : ''}">${LV[l]}</button>`).join('')}</div></div>` : ''}</div>`;
    }
    return out;
  }
  function vListe(b) {
    const c = counts(WORDS);
    const F = [['alle', `Alle ${c.all}`], ['neu', `Neu ${c.neu}`], ['0', `Nicht ${c[0]}`], ['1', `Kann ich ${c[1]}`], ['2', `Gut ${c[2]}`]];
    b.innerHTML = `<input class="ln-input" id="enQ" type="search" placeholder="Wörter durchsuchen (Englisch oder Deutsch)" value="${esc(E.q)}" autocomplete="off">
      <div class="ln-seg en-filter">${F.map(([k, n]) => `<button type="button" data-en="filter" data-x="${k}" class="${E.filter === k ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div id="enList" class="en-list">${listHtml()}</div>`;
    $('enQ').oninput = e => { E.q = e.target.value; $('enList').innerHTML = listHtml(); };
  }

  // ---------- Karteikarten (Ordner-Reiter, Lernen/Abfrage, Einstellungen) ----------
  const FONTS = [['caveat', 'Handschrift', "Caveat,cursive", ''], ['patrick', 'Schulheft', "'Patrick Hand',cursive", 'Patrick+Hand'],
    ['shadows', 'Zart', "'Shadows Into Light',cursive", 'Shadows+Into+Light'], ['gloria', 'Verspielt', "'Gloria Hallelujah',cursive", 'Gloria+Hallelujah'],
    ['klar', 'Klar', "Quicksand,sans-serif", '']];
  const PREF = 'wir-en-karten';
  const prefs = () => { try { return Object.assign({ font: 'caveat', dir: 'ed', group: 'alle', pics: true }, JSON.parse(localStorage.getItem(PREF) || '{}')); } catch (_) { return { font: 'caveat', dir: 'ed', group: 'alle', pics: true }; } };
  let P = null;
  const savePrefs = () => { try { localStorage.setItem(PREF, JSON.stringify(P)); } catch (_) {} };
  const fontOf = k => FONTS.find(f => f[0] === k) || FONTS[0];
  function loadFont(k) {
    const f = fontOf(k); if (!f[3] || document.getElementById('enf-' + k)) return;
    const l = document.createElement('link'); l.id = 'enf-' + k; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=' + f[3] + '&display=swap'; document.head.append(l);
  }
  let lastDoodle = -1;
  function doodle() {
    const D = window.WIR_EN_DOODLES; if (!D) return '';
    const k = Object.keys(D); let i; do { i = Math.floor(Math.random() * k.length); } while (i === lastDoodle && k.length > 1);
    lastDoodle = i; return D[k[i]];
  }
  let doodleLoading = false;
  function needDoodles() {
    if (window.WIR_EN_DOODLES || doodleLoading) return;
    doodleLoading = true;
    const s = document.createElement('script'); s.src = '/lernen/englisch-doodles.js';
    s.onload = () => { if (el && E.tab === 'karten' && P?.pics) { const d = doodle(); document.querySelectorAll('.kk-dd').forEach(x => x.innerHTML = d); } };
    s.onerror = () => { doodleLoading = false; };
    document.head.append(s);
  }

  const learnDeck = () => WORDS.filter(w => P.group === 'alle' || w.grp === P.group);
  function deckOf() {
    return learnDeck().filter(w => {
      const l = lvl(w);
      if (E.mode === 'alle') return true;
      if (E.mode === 'schwer') return l === undefined || l === 0;
      return l !== 2;
    });
  }
  // eine Karte: Reiter oben (wechseln den Stand, drehen nicht), Karte selbst dreht sich beim Tippen
  function cardHtml(w, hintBack) {
    const l = lvl(w), en = P.dir === 'ed', d = P.pics ? doodle() : '';
    const faceEn = `<div class="kk-big">${esc(w.en)}</div>${w.ipa ? `<div class="kk-ipa">${esc(w.ipa)}</div>` : ''}`;
    const faceDe = `<div class="kk-big">${esc(w.de)}</div>`;
    const front = en ? faceEn : faceDe, back = (en ? faceDe : faceEn) + `<div class="kk-def">${esc(w.def)}</div>`;
    return `<div class="kk" id="enKK" data-l="${l === undefined ? 'n' : l}" style="--kf:${fontOf(P.font)[2]}">
      <div class="kk-tabs">${[0, 1, 2].map(x => `<button type="button" class="kk-tab t${x} ${l === x ? 'on' : ''}" data-en="lv" data-l="${x}">${LV[x]}</button>`).join('')}</div>
      <div class="kk-card" id="enCard" data-en="kflip" role="button" tabindex="0" aria-label="Karte umdrehen"><div class="kk-in">
        <div class="kk-face"><div class="kk-dd">${d}</div><div class="kk-head"><span>${esc(w.grp)}</span><span>${en ? 'Englisch' : 'Deutsch'}</span></div><div class="kk-mid">${front}</div><div class="kk-hint">Tippen zum Umdrehen</div></div>
        <div class="kk-face kk-back"><div class="kk-dd">${d}</div><div class="kk-head"><span>${esc(w.grp)}</span><span>${en ? 'Deutsch' : 'Englisch'}</span></div><div class="kk-mid">${back}</div><div class="kk-hint">${hintBack}</div></div>
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
    const top = `<div class="kk-top"><div class="ln-seg"><button type="button" data-en="km" data-x="lernen" class="${E.km === 'lernen' ? 'on' : ''}">Lernen</button><button type="button" data-en="km" data-x="abfrage" class="${E.km === 'abfrage' ? 'on' : ''}">Abfrage</button></div><label class="kk-pics"><span>Bilder</span><input type="checkbox" class="switch" id="enPics" ${P.pics ? 'checked' : ''} aria-label="Zeichnungen auf den Karten"></label><button type="button" class="kk-gear" data-en="gear" aria-label="Einstellungen">⚙︎</button></div>`;
    if (E.km === 'lernen') {
      const deck = learnDeck(); if (!deck.length) { b.innerHTML = top + '<div class="ln-empty">Keine Wörter in diesem Teil.</div>'; return; }
      E.lpos = Math.min(E.lpos, deck.length - 1);
      const w = deck[E.lpos];
      b.innerHTML = top + `<div class="ln-sub kk-info">Karte ${E.lpos + 1} von ${deck.length} · Reiter = Stand setzen</div>` + cardHtml(w, 'Tippen zum Zurückdrehen') +
        `<div class="kk-nav"><button type="button" class="ln-btn soft" data-en="lprev" aria-label="Zurück">‹</button><button type="button" class="ln-btn soft kk-grow" data-en="kflip">Umdrehen</button><button type="button" class="ln-btn soft" data-en="lnext" aria-label="Weiter">›</button></div>`;
      return;
    }
    const s = E.ses;
    if (!s) {
      const n = deckOf().length;
      const M = [['offen', 'Alle außer „gut“'], ['schwer', 'Neu + nicht'], ['alle', 'Alle']];
      b.innerHTML = top + `<div class="ln-card glass"><h3>Abfrage</h3>
        <div class="ln-sub">Welche Wörter?</div><div class="ln-seg en-filter">${M.map(([k, t]) => `<button type="button" data-en="mode" data-x="${k}" class="${E.mode === k ? 'on' : ''}">${t}</button>`).join('')}</div>
        <div class="ln-sub" style="margin-top:10px">${P.group === 'alle' ? 'Alle Teile' : esc(P.group)} · ${P.dir === 'ed' ? 'Englisch → Deutsch' : 'Deutsch → Englisch'} (ändern über ⚙︎)</div>
        <button class="ln-btn big" type="button" data-en="start" style="margin-top:14px" ${n ? '' : 'disabled'}>${n ? `Start (${n} Wörter)` : 'Hier ist nichts mehr offen'}</button></div>`;
      return;
    }
    if (s.pos >= s.deck.length) {
      b.innerHTML = top + `<div class="ln-card glass ln-count"><b style="font-size:34px">Geschafft</b><span>${s.n} Bewertungen: ${s.r[2]} gut · ${s.r[1]} können · ${s.r[0]} nicht</span></div>
        <button class="ln-btn big" type="button" data-en="start">Nochmal</button><button class="ln-btn big soft" type="button" data-en="end">Zurück</button>`;
      return;
    }
    const w = WORDS[s.deck[s.pos]], left = s.deck.length - s.pos;
    b.innerHTML = top + `<div class="ln-row kk-info"><div class="ln-sub ln-sp">Noch ${left} Karte${left === 1 ? '' : 'n'}</div><button class="ln-link" type="button" data-en="end">Beenden</button></div>` +
      cardHtml(w, 'Wie gut konntest du es? Reiter oben antippen') + `<button type="button" class="ln-btn big soft" data-en="kflip">Umdrehen</button>`;
  }
  function flipCard() { const c = $('enCard'); if (!c || E.busy) return; c.classList.toggle('flip'); }
  function pickLevel(l) {
    if (E.busy) return;
    if (E.km === 'lernen') { const w = learnDeck()[E.lpos]; if (w) { setLevel(w, l); paintTabs(w); } return; }
    const s = E.ses; if (!s) return;
    const c = $('enCard'), k = $('enKK');
    if (!c?.classList.contains('flip')) { k.classList.remove('wig'); void k.offsetWidth; k.classList.add('wig'); return; }   // Abfrage: erst die Lösung ansehen
    const w = WORDS[s.deck[s.pos]];
    setLevel(w, l); paintTabs(w); s.n++; s.r[l]++;
    if (l === 0) s.deck.splice(Math.min(s.deck.length, s.pos + 5), 0, w.i);   // „nicht“: kommt in dieser Runde bald nochmal
    E.busy = true; setTimeout(() => { E.busy = false; s.pos++; if (el && E.tab === 'karten') render(); }, 650);
  }
  function start() {
    E.ses = { deck: shuffle(deckOf().map(w => w.i)), pos: 0, n: 0, r: { 0: 0, 1: 0, 2: 0 } };
    render();
  }

  // Einstellungen (Blatt von unten, hängt am body, damit „fixed“ sicher greift)
  function openSheet() {
    closeSheet();
    const sh = document.createElement('div'); sh.className = 'en-sheet'; sh.id = 'enSheet';
    sh.innerHTML = `<div class="en-sh glass"><div class="ln-row"><b class="ln-sp" style="font-size:17px">Einstellungen</b><button type="button" class="en-shx" data-s="close" aria-label="Schließen">✕</button></div>
      <div class="ln-sub">Schrift auf den Karten</div>
      <div class="en-fonts">${FONTS.map(f => `<button type="button" data-s="font" data-x="${f[0]}" class="${P.font === f[0] ? 'on' : ''}" style="font-family:${f[2]}">${f[1]}</button>`).join('')}</div>
      <div class="ln-sub">Richtung</div>
      <div class="ln-seg"><button type="button" data-s="dir" data-x="ed" class="${P.dir === 'ed' ? 'on' : ''}">Englisch → Deutsch</button><button type="button" data-s="dir" data-x="de" class="${P.dir === 'de' ? 'on' : ''}">Deutsch → Englisch</button></div>
      <div class="ln-sub">Teil</div>
      <select class="ln-input" id="enShGrp"><option value="alle">Alle Teile</option>${groups().map(g => `<option ${P.group === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select></div>`;
    FONTS.forEach(f => loadFont(f[0]));
    document.body.append(sh);
    sh.onclick = e => {
      if (e.target === sh) return closeSheet();
      const t = e.target.closest('[data-s]'); if (!t) return;
      if (t.dataset.s === 'close') return closeSheet();
      if (t.dataset.s === 'font') P.font = t.dataset.x;
      if (t.dataset.s === 'dir') P.dir = t.dataset.x;
      savePrefs(); sh.querySelectorAll(`[data-s="${t.dataset.s}"]`).forEach(x => x.classList.toggle('on', x === t)); render();
    };
    $('enShGrp').onchange = e => { P.group = e.target.value; E.lpos = 0; E.ses = null; savePrefs(); render(); };
  }
  function closeSheet() { $('enSheet')?.remove(); }

  function onClick(e) {
    const t = e.target.closest('[data-en]'); if (!t) return;
    const d = t.dataset;
    switch (d.en) {
      case 'tab': E.tab = d.x; E.ses = null; render(); break;
      case 'filter': E.filter = d.x; E.open = null; render(); break;
      case 'open': E.open = E.open === d.id ? null : d.id; $('enList').innerHTML = listHtml(); break;
      case 'set': { const w = WORDS.find(x => x.id === d.id); if (w) { setLevel(w, +d.l); render(); } break; }
      case 'km': E.km = d.x; E.ses = null; render(); break;
      case 'mode': E.mode = d.x; render(); break;
      case 'gear': openSheet(); break;
      case 'start': start(); break;
      case 'end': E.ses = null; render(); break;
      case 'kflip': flipCard(); break;
      case 'lv': pickLevel(+d.l); break;
      case 'lprev': { const n = learnDeck().length; E.lpos = (E.lpos + n - 1) % n; render(); break; }
      case 'lnext': { const n = learnDeck().length; E.lpos = (E.lpos + 1) % n; render(); break; }
    }
  }
  function onKey(e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.id === 'enCard') { e.preventDefault(); flipCard(); } }

  // Einstieg aus lernen.js: zeigt den Englisch-Bereich im übergebenen Element
  async function mount(target) {
    el = target; el.onclick = onClick; el.onkeydown = onKey;
    el.onchange = e => { if (e.target.id === 'enPics') { P.pics = e.target.checked; savePrefs(); const d = P.pics ? doodle() : ''; document.querySelectorAll('.kk-dd').forEach(x => x.innerHTML = d); } };
    el.innerHTML = '<div class="ln-empty">Lade …</div>';
    try { await loadData(); } catch (_) { el.innerHTML = '<div class="ln-empty">Konnte nicht geladen werden. Bitte einmal mit Netz öffnen.</div>'; return; }
    if (!WORDS) prep();
    load(); E.ses = null; render();
    try { if (await pull() && el === target) render(); } catch (e) { console.warn('[englisch] offline/sync', e?.message); }
  }
  function unmount() { closeSheet(); if (el) { el.onclick = null; el.onkeydown = null; el.onchange = null; } el = null; }
  window.addEventListener('online', flush);
  window.WIR_ENGLISCH = { mount, unmount };
})();
