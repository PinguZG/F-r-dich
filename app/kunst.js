// Kunst / Experimentelles Gestalten (Lernen → Ida): Stoff, Bilder, Prüfungsfragen, Karteikarten (Text + Bild) und Originale.
// Inhalte: app/lernen/kunst-data.js, Bilder: app/lernen/kunst/*.jpg.
// Speicher: lokal (Offline) + Collection lern_vokabeln (nur eigene Zeilen, kein neues Schema). Karte: wordId 'kun:<id>', level 0–2.
(() => {
  const pb = window.WIR_PB;
  if (!pb) return;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const meRec = () => pb.authStore.record || pb.authStore.model;
  const uid = () => meRec()?.id;
  const $ = id => document.getElementById(id);
  const LV = { 0: 'Schlecht', 1: 'Okay', 2: 'Sehr gut' };
  const ORDER = [2, 1, 0];
  const IMG = f => '/lernen/kunst/' + encodeURIComponent(f) + '.jpg';

  let D = null, CARDS = [], ST = { w: {}, q: {}, ids: {} }, el = null, flushing = false;
  const E = { tab: 'stoff', thema: 'imp', bthema: 'alle', open: null, fopen: null, sel: [0, 1, 2], deck: null, dkey: '', dpos: 0, busy: false, ctype: 'alle', zoom: null };
  const SKEY = () => 'lernen-kun-v1-' + uid();
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
    const rows = await pb.collection('lern_vokabeln').getFullList({ requestKey: null, batch: 500, filter: 'wordId ~ "kun:"' });
    ST.w = {}; ST.ids = {};
    rows.forEach(r => { ST.w[r.wordId.slice(4)] = r.level; ST.ids[r.wordId] = r.id; });
    persist();
    return true;
  }
  const setLevel = (c, l) => { ST.w[c.id] = l; queue('kun:' + c.id, l); };

  // ---------- Daten ----------
  const prep = () => {
    D = window.WIR_KUNST; CARDS = [];
    D.themen.forEach(t => t.karten.forEach((k, i) => CARDS.push({ id: t.id + '-' + (i + 1), thema: t.id, kind: 'text', q: k[0], a: k[1], i: CARDS.length })));
    D.bilder.forEach(b => CARDS.push({ id: 'b-' + b.f, thema: b.th, kind: 'bild', b, i: CARDS.length }));
  };
  const poolOf = () => CARDS.filter(c => (E.thema === 'alle' || c.thema === E.thema) && (E.ctype === 'alle' || c.kind === E.ctype));
  const counts = pool => { const c = { all: pool.length, neu: 0, 0: 0, 1: 0, 2: 0 }; pool.forEach(x => { const l = lvl(x); if (l === undefined) c.neu++; else c[l]++; }); return c; };
  const themaName = id => D.themen.find(t => t.id === id)?.name || id;

  // ---------- Kopf ----------
  const TABS = [['stoff', 'Stoff'], ['bilder', 'Bilder'], ['fragen', 'Fragen'], ['karten', 'Karten'], ['original', 'Originale']];
  function head() {
    const c = counts(CARDS), pc = v => c.all ? v / c.all * 100 : 0;
    return `<section class="en-hero">
        <div class="en-hero-row"><div class="en-hero-t"><small>${esc(D.fach)} · ${esc(D.anlass)}</small><h2>Kunst</h2></div></div>
        <div class="en-bar"><span class="g" style="width:${pc(c[2])}%"></span><span class="m" style="width:${pc(c[1])}%"></span><span class="b" style="width:${pc(c[0])}%"></span></div>
        <div class="en-meta">${c[1] + c[2]} von ${c.all} Karten gekonnt</div>
      </section>
      <div class="ln-seg en-tabs ku-tabs">${TABS.map(([k, n]) => `<button type="button" data-ku="tab" data-x="${k}" class="${E.tab === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
  }
  function render() {
    if (!el) return;
    el.innerHTML = '<div class="en-wrap">' + head() + '<div id="kuBody" class="en-body"></div></div>' + zoomHtml();
    ({ stoff: vStoff, bilder: vBilder, fragen: vFragen, karten: vKarten, original: vOrig })[E.tab]($('kuBody'));
  }
  const themaChips = (key, all) => `<div class="en-chips">${(all ? [['alle', 'Alle']] : []).concat(D.themen.map(t => [t.id, t.name])).map(([k, n]) => `<button type="button" data-ku="${key}" data-x="${esc(k)}" class="${E[key === 'bthema' ? 'bthema' : 'thema'] === k ? 'on' : ''}">${esc(n)}</button>`).join('')}</div>`;
  const imgBtn = (b, cls = '') => `<button type="button" class="ku-img ${cls}" data-ku="zoom" data-x="${esc(b.f)}" aria-label="${esc(b.t)} vergrößern"><img src="${IMG(b.f)}" alt="${esc(b.k + ': ' + b.t)}" loading="lazy" decoding="async"></button>`;
  const cap = b => `<span class="ku-cap"><b>${esc(b.k)}</b><span>${esc(b.t)}${b.j ? ', ' + esc(b.j) : ''}</span></span>`;
  function zoomHtml() {
    const b = E.zoom && D.bilder.find(x => x.f === E.zoom); if (!b) return '';
    return `<div class="ku-zoom" data-ku="unzoom" role="dialog" aria-label="Bild"><img src="${IMG(b.f)}" alt="${esc(b.t)}"><div class="ku-zc"><b>${esc(b.k)}</b><span>${esc(b.t)}${b.j ? ', ' + esc(b.j) : ''}</span>${b.m ? '<small>' + esc(b.m) + '</small>' : ''}</div></div>`;
  }
  function table(t) {
    return `<div class="ku-tw"><div class="ku-tt">${esc(t.titel)}</div><div class="ku-ts"><table class="ku-t"><thead><tr>${t.kopf.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${t.zeilen.map(r => `<tr>${r.map((c, i) => i === 0 ? `<th scope="row">${esc(c)}</th>` : `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
  }

  // ---------- Stoff ----------
  function vStoff(b) {
    const t = D.themen.find(x => x.id === E.thema) || D.themen[0];
    const bilder = D.bilder.filter(x => x.th === t.id);
    b.innerHTML = `<div class="po-note">${esc(D.hinweis)}</div>` + themaChips('thema', false) +
      `<div class="ku-head"><b>${esc(t.name)}</b><small>${esc(t.untertitel)}</small></div>` +
      D.tabellen.filter(x => x.th === t.id).map(table).join('') +
      t.sektionen.map((s, i) => {
        const k = t.id + i, open = E.open === k;
        return `<section class="po-th ${open ? 'open' : ''}"><button type="button" class="po-thh" data-ku="open" data-id="${esc(k)}"><span><b>${esc(s.h)}</b></span><i>${open ? '–' : '+'}</i></button>${open ? `<div class="po-thb"><ul>${s.punkte.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>` : ''}</section>`;
      }).join('') +
      `<div class="ku-strip-h">Bilder zu diesem Thema</div><div class="ku-strip">${bilder.map(x => imgBtn(x, 'sm') + '').join('')}</div>` +
      `<button type="button" class="ln-btn po-tk" data-ku="gokarten" data-x="${esc(t.id)}">Karteikarten dazu</button>`;
  }

  // ---------- Bilder ----------
  function vBilder(b) {
    const list = D.bilder.filter(x => E.bthema === 'alle' || x.th === E.bthema);
    b.innerHTML = themaChips('bthema', true) + `<div class="ku-grid">${list.map(x => `<figure class="ku-fig">${imgBtn(x)}<figcaption>${cap(x)}</figcaption></figure>`).join('')}</div>`;
  }

  // ---------- Fragen ----------
  function vFragen(b) {
    b.innerHTML = `<div class="po-note">So kam es im Unterricht dran. Tippe auf eine Frage, überlege zuerst selbst, dann siehst du die Antwort.</div>` + D.themen.map(t =>
      `<div class="ku-strip-h">${esc(t.name)}</div>` + t.aufgaben.map((a, i) => {
        const k = t.id + '-f' + i, open = E.fopen === k;
        return `<section class="po-th ${open ? 'open' : ''}"><button type="button" class="po-thh" data-ku="fopen" data-id="${esc(k)}"><span><b>${esc(a[0])}</b></span><i>${open ? '–' : '+'}</i></button>${open ? `<div class="po-thb"><p class="ku-a">${esc(a[1])}</p></div>` : ''}</section>`;
      }).join('')).join('');
  }

  // ---------- Karteikarten ----------
  const tabsHtml = () => `<div class="kk-tabs">${ORDER.map(x => `<button type="button" class="kk-tab t${x} ${E.sel.includes(x) ? 'on' : ''}" data-ku="sel" data-l="${x}" aria-pressed="${E.sel.includes(x)}">${LV[x]}</button>`).join('')}</div>`;
  const inSel = c => { const l = lvl(c); return E.sel.includes(l === undefined ? 0 : l); };
  function deck() {
    const key = E.thema + '|' + E.ctype + '|' + [...E.sel].sort().join('');
    if (!E.deck || E.dkey !== key) { E.dkey = key; E.dpos = 0; E.deck = shuffle(poolOf().filter(inSel).map(c => c.i)); }
    return E.deck;
  }
  function vKarten(b) {
    const chips = `<div class="en-chips">${[['alle', 'Alle']].concat(D.themen.map(t => [t.id, t.name])).map(([k, n]) => `<button type="button" data-ku="thema" data-x="${esc(k)}" class="${E.thema === k ? 'on' : ''}">${esc(n)}</button>`).join('')}</div>` +
      `<div class="en-chips">${[['alle', 'Text + Bild'], ['text', 'Nur Text'], ['bild', 'Nur Bilder']].map(([k, n]) => `<button type="button" data-ku="ctype" data-x="${k}" class="${E.ctype === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    const d = deck();
    if (!d.length) { b.innerHTML = chips + `<div class="kk kk-none">${tabsHtml()}<div class="kk-empty">Hier sind gerade keine Karten.</div></div>`; return; }
    if (E.dpos >= d.length) { b.innerHTML = chips + `<div class="kk kk-none">${tabsHtml()}<div class="kk-empty"><b>Runde geschafft</b><button type="button" class="ln-btn" data-ku="again">Nochmal</button></div></div>`; return; }
    const c = CARDS[d[E.dpos]], l = lvl(c), n = E.dpos + 1;
    const face = (cls, side, body) => `<div class="kk-face ${cls}"><div class="kk-head"><span>${side}</span><span>${n} / ${d.length}</span></div><div class="kk-mid">${body}</div></div>`;
    const front = c.kind === 'bild' ? `<img class="ku-kimg" src="${IMG(c.b.f)}" alt="Gemälde"><div class="ku-kq">Wer? Was? Wann? Epoche?</div>` : `<div class="kk-big kk-txt">${esc(c.q)}</div>`;
    const back = c.kind === 'bild' ? `<div class="kk-txt kk-ans"><b>${esc(c.b.k)}</b><br>${esc(c.b.t)}${c.b.j ? ' (' + esc(c.b.j) + ')' : ''}<br><small>${esc(themaName(c.thema))}${c.b.m ? ' · ' + esc(c.b.m) : ''}</small></div>` : `<div class="kk-txt kk-ans">${esc(c.a)}</div>`;
    b.innerHTML = chips + `<div class="kk" id="kuKK" data-l="${l === undefined ? 'n' : l}" style="--kf:Quicksand,sans-serif">${tabsHtml()}
      <div class="kk-card" id="kuCard" data-ku="kflip" role="button" tabindex="0" aria-label="Karte umdrehen"><div class="kk-in">
        ${face('', 'Frage', front)}${face('kk-back', 'Antwort', back)}
      </div></div></div>
      <div class="kk-rate">${ORDER.map(x => `<button type="button" class="r${x}" data-ku="rate" data-l="${x}">${LV[x]}</button>`).join('')}</div>`;
  }
  function rate(l, btn) {
    if (E.busy) return;
    const c = CARDS[E.deck[E.dpos]]; if (!c) return;
    setLevel(c, l); E.busy = true; btn?.classList.add('hit');
    const k = $('kuKK'); if (k) k.dataset.l = l;
    setTimeout(() => { E.busy = false; E.dpos++; if (el && E.tab === 'karten') render(); }, 260);
  }
  function toggleSel(l) {
    const i = E.sel.indexOf(l);
    if (i >= 0) { if (E.sel.length === 1) { const k = $('kuKK'); if (k) { k.classList.remove('wig'); void k.offsetWidth; k.classList.add('wig'); } return; } E.sel.splice(i, 1); }
    else E.sel.push(l);
    render();
  }

  // ---------- Originale ----------
  function vOrig(b) {
    b.innerHTML = `<div class="po-note">Die Unterlagen im Original. PDFs öffnen sich im Browser.</div>` +
      D.originale.map(o => `<a class="ku-doc glass" href="${esc(o.f)}" target="_blank" rel="noopener"><b>${esc(o.n)}</b><small>${esc(o.d)}</small><span>PDF öffnen</span></a>`).join('') +
      D.notizen.map(n => `<div class="ku-strip-h">${esc(n.n)}</div><a href="${esc(n.f)}" target="_blank" rel="noopener" class="ku-note"><img src="${esc(n.f)}" alt="${esc(n.n)}" loading="lazy"></a>`).join('');
  }

  function onClick(e) {
    const t = e.target.closest('[data-ku]'); if (!t) return;
    const d = t.dataset;
    switch (d.ku) {
      case 'tab': E.tab = d.x; render(); break;
      case 'thema': E.thema = d.x; E.deck = null; E.open = null; render(); break;
      case 'bthema': E.bthema = d.x; render(); break;
      case 'ctype': E.ctype = d.x; E.deck = null; render(); break;
      case 'open': E.open = E.open === d.id ? null : d.id; render(); break;
      case 'fopen': E.fopen = E.fopen === d.id ? null : d.id; render(); break;
      case 'gokarten': E.tab = 'karten'; E.thema = d.x; E.deck = null; render(); break;
      case 'zoom': E.zoom = d.x; el.querySelector('.ku-zoom')?.remove(); el.insertAdjacentHTML('beforeend', zoomHtml()); break;
      case 'unzoom': E.zoom = null; el.querySelector('.ku-zoom')?.remove(); break;
      case 'kflip': $('kuCard')?.classList.toggle('flip'); break;
      case 'sel': toggleSel(+d.l); break;
      case 'rate': rate(+d.l, t); break;
      case 'again': E.deck = null; render(); break;
    }
  }
  const onKey = e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.id === 'kuCard') { e.preventDefault(); $('kuCard')?.classList.toggle('flip'); }
    if (e.key === 'Escape' && E.zoom) { E.zoom = null; el?.querySelector('.ku-zoom')?.remove(); }
  };

  async function mount(target) {
    el = target; el.onclick = onClick; el.onkeydown = onKey; el.onchange = null;
    el.innerHTML = '<div class="ln-empty">Lade …</div>';
    try { if (!window.WIR_KUNST) await loadScript('/lernen/kunst-data.js'); } catch (_) { el.innerHTML = '<div class="ln-empty">Konnte nicht geladen werden. Bitte einmal mit Netz öffnen.</div>'; return; }
    if (!D) prep();
    load(); E.zoom = null;
    render();
    try { if (await pull() && el === target) render(); } catch (e) { console.warn('[kunst] offline/sync', e?.message); }
  }
  function unmount() { if (el) { el.onclick = null; el.onkeydown = null; } el = null; }
  window.addEventListener('online', flush);
  window.WIR_KUNST_UI = { mount, unmount };
})();
