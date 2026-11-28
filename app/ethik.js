// Ethik (Lernen → Ida): Klausur KAE1 – Übersicht und Karteikarten. Inhalte: app/lernen/ethik-data.js (jede Karte mit Quelle: PDF-Kürzel + Seite).
// Speicher: lokal (Offline) + Collection lern_vokabeln (nur eigene Zeilen, kein neues Schema). Gleiche Technik wie politik.js.
// Karte: wordId 'eth:<id>', level 0–2 (Schlecht/Okay/Sehr gut).
(() => {
  const pb = window.WIR_PB;
  if (!pb) return;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const meRec = () => pb.authStore.record || pb.authStore.model;
  const uid = () => meRec()?.id;
  const $ = id => document.getElementById(id);
  const LV = { 0: 'Schlecht', 1: 'Okay', 2: 'Sehr gut' };
  const ORDER = [2, 1, 0];

  let D = null, CARDS = [], ST = { w: {}, q: {}, ids: {} }, el = null, flushing = false;
  const E = { tab: 'uebersicht', thema: 'alle', open: null, sel: [0, 1, 2], deck: null, dkey: '', dpos: 0, busy: false };
  const SKEY = () => 'lernen-eth-v1-' + uid();
  const load = () => { try { const j = JSON.parse(localStorage.getItem(SKEY()) || 'null'); if (j) ST = Object.assign({ w: {}, q: {}, ids: {} }, j); } catch (_) {} };
  const persist = () => { try { localStorage.setItem(SKEY(), JSON.stringify(ST)); } catch (_) {} };
  const loadScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Laden fehlgeschlagen')); document.head.append(s); });

  const lvl = c => ST.w[c.id];
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // ---------- Speichern / Sync ----------
  function queue(k, l) { ST.q[k] = l; persist(); flush(); }
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
    const rows = await pb.collection('lern_vokabeln').getFullList({ requestKey: null, batch: 500, filter: 'wordId ~ "eth:"' });
    ST.w = {}; ST.ids = {};
    rows.forEach(r => { if (r.wordId.startsWith('eth:')) { ST.w[r.wordId.slice(4)] = r.level; ST.ids[r.wordId] = r.id; } });
    persist();
    return true;
  }
  const setLevel = (c, l) => { ST.w[c.id] = l; queue('eth:' + c.id, l); };

  // ---------- Daten ----------
  const prep = () => {
    D = window.WIR_ETHIK; CARDS = [];
    D.themen.forEach(t => t.karten.forEach((k, i) => CARDS.push({ id: t.id + '-' + (i + 1), thema: t.id, q: k[0], a: k[1], s: k[2] || '', i: CARDS.length })));
  };
  const poolOf = () => CARDS.filter(c => E.thema === 'alle' || c.thema === E.thema);
  const counts = pool => { const c = { all: pool.length, neu: 0, 0: 0, 1: 0, 2: 0 }; pool.forEach(x => { const l = lvl(x); if (l === undefined) c.neu++; else c[l]++; }); return c; };

  // ---------- Kopf ----------
  function head() {
    const c = counts(CARDS), pc = v => c.all ? v / c.all * 100 : 0;
    return `<section class="en-hero">
        <div class="en-hero-row"><div class="en-hero-t"><small>${esc(D.fach)}</small><h2>${esc(D.anlass)}</h2></div></div>
        <div class="en-bar"><span class="g" style="width:${pc(c[2])}%"></span><span class="m" style="width:${pc(c[1])}%"></span><span class="b" style="width:${pc(c[0])}%"></span></div>
        <div class="en-meta">${c[1] + c[2]} von ${c.all} Karten gekonnt</div>
      </section>
      <div class="ln-seg en-tabs">${[['uebersicht', 'Übersicht'], ['karten', 'Karteikarten']].map(([k, n2]) => `<button type="button" data-po="tab" data-x="${k}" class="${E.tab === k ? 'on' : ''}">${n2}</button>`).join('')}</div>`;
  }
  function render() {
    if (!el) return;
    el.innerHTML = '<div class="en-wrap">' + head() + '<div id="poBody" class="en-body"></div></div>';
    ({ uebersicht: vUeber, karten: vKarten })[E.tab]($('poBody'));
  }

  // ---------- Übersicht ----------
  function vUeber(b) {
    b.innerHTML = `<div class="po-note">${esc(D.stand)}</div><div class="po-note">${esc(D.hinweis)}</div>` + D.themen.map(t => {
      const open = E.open === t.id;
      return `<section class="po-th ${open ? 'open' : ''}"><button type="button" class="po-thh" data-po="open" data-id="${esc(t.id)}"><span><b>${esc(t.name)}</b><small>${esc(t.untertitel || '')}</small></span><i>${open ? '–' : '+'}</i></button>
        ${open ? '<div class="po-thb">' + t.sektionen.map(s => `<h4>${esc(s.h)}</h4><ul>${s.punkte.map(p => `<li>${esc(p)}</li>`).join('')}</ul>${s.q ? `<small class="et-q">Quelle: ${esc(s.q)}</small>` : ''}`).join('') +
          `<button type="button" class="ln-btn po-tk" data-po="gokarten" data-x="${esc(t.id)}">Karteikarten dazu</button></div>` : ''}</section>`;
    }).join('');
  }

  // ---------- Karteikarten ----------
  const tabsHtml = () => `<div class="kk-tabs">${ORDER.map(x => `<button type="button" class="kk-tab t${x} ${E.sel.includes(x) ? 'on' : ''}" data-po="sel" data-l="${x}" aria-pressed="${E.sel.includes(x)}">${LV[x]}</button>`).join('')}</div>`;
  const inSel = c => { const l = lvl(c); return E.sel.includes(l === undefined ? 0 : l); };
  function deck() {
    const key = E.thema + '|' + [...E.sel].sort().join('');
    if (!E.deck || E.dkey !== key) { E.dkey = key; E.dpos = 0; E.deck = shuffle(poolOf().filter(inSel).map(c => c.i)); }
    return E.deck;
  }
  function vKarten(b) {
    const chips = `<div class="en-chips">${[['alle', 'Alle']].concat(D.themen.map(t => [t.id, t.name])).map(([k, n]) => `<button type="button" data-po="thema" data-x="${esc(k)}" class="${E.thema === k ? 'on' : ''}">${esc(n)}</button>`).join('')}</div>`;
    const d = deck();
    if (!d.length) { b.innerHTML = chips + `<div class="kk kk-none">${tabsHtml()}<div class="kk-empty">Hier sind gerade keine Karten.</div></div>`; return; }
    if (E.dpos >= d.length) { b.innerHTML = chips + `<div class="kk kk-none">${tabsHtml()}<div class="kk-empty"><b>Runde geschafft</b><button type="button" class="ln-btn" data-po="again">Nochmal</button></div></div>`; return; }
    const c = CARDS[d[E.dpos]], l = lvl(c), n = E.dpos + 1;
    const face = (cls, side, body) => `<div class="kk-face ${cls}"><div class="kk-head"><span>${side}</span><span>${n} / ${d.length}</span></div><div class="kk-mid">${body}</div></div>`;
    b.innerHTML = chips + `<div class="kk" id="poKK" data-l="${l === undefined ? 'n' : l}" style="--kf:Quicksand,sans-serif">${tabsHtml()}
      <div class="kk-card" id="poCard" data-po="kflip" role="button" tabindex="0" aria-label="Karte umdrehen"><div class="kk-in">
        ${face('', 'Frage', `<div class="kk-big kk-txt">${esc(c.q)}</div>`)}${face('kk-back', 'Antwort', `<div class="kk-txt kk-ans">${esc(c.a)}</div>${c.s ? `<div class="et-q">Quelle: ${esc(c.s)}</div>` : ''}`)}
      </div></div></div>
      <div class="kk-rate">${ORDER.map(x => `<button type="button" class="r${x}" data-po="rate" data-l="${x}">${LV[x]}</button>`).join('')}</div>`;
  }
  function rate(l, btn) {
    if (E.busy) return;
    const c = CARDS[E.deck[E.dpos]]; if (!c) return;
    setLevel(c, l); E.busy = true; btn?.classList.add('hit');
    const k = $('poKK'); if (k) k.dataset.l = l;
    setTimeout(() => { E.busy = false; E.dpos++; if (el && E.tab === 'karten') render(); }, 260);
  }
  function toggleSel(l) {
    const i = E.sel.indexOf(l);
    if (i >= 0) { if (E.sel.length === 1) { const k = $('poKK'); if (k) { k.classList.remove('wig'); void k.offsetWidth; k.classList.add('wig'); } return; } E.sel.splice(i, 1); }
    else E.sel.push(l);
    render();
  }
  function onClick(e) {
    const t = e.target.closest('[data-po]'); if (!t) return;
    const d = t.dataset;
    switch (d.po) {
      case 'tab': E.tab = d.x; render(); break;
      case 'open': E.open = E.open === d.id ? null : d.id; render(); break;
      case 'gokarten': E.tab = 'karten'; E.thema = d.x; E.deck = null; render(); break;
      case 'thema': E.thema = d.x; E.deck = null; render(); break;
      case 'kflip': $('poCard')?.classList.toggle('flip'); break;
      case 'sel': toggleSel(+d.l); break;
      case 'rate': rate(+d.l, t); break;
      case 'again': E.deck = null; render(); break;
    }
  }
  const onKey = e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.id === 'poCard') { e.preventDefault(); $('poCard')?.classList.toggle('flip'); } };

  async function mount(target) {
    el = target; el.onclick = onClick; el.onkeydown = onKey; el.onchange = null;
    el.innerHTML = '<div class="ln-empty">Lade …</div>';
    try { if (!window.WIR_ETHIK) await loadScript('/lernen/ethik-data.js'); } catch (_) { el.innerHTML = '<div class="ln-empty">Konnte nicht geladen werden. Bitte einmal mit Netz öffnen.</div>'; return; }
    if (!D) prep();
    load();
    E.tab = 'uebersicht';
    render();
    try { if (await pull() && el === target) render(); } catch (e) { console.warn('[ethik] offline/sync', e?.message); }
  }
  function unmount() { if (el) { el.onclick = null; el.onkeydown = null; } el = null; }
  window.addEventListener('online', flush);
  window.WIR_ETHIK_UI = { mount, unmount };
})();
