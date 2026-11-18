// Englisch-Vokabeln (18.11.2026): Reiter „Englisch“ in Lernen → Ida. Übersicht aller Wörter + Karteikarten mit drei Knöpfen
// (Kann ich nicht / Kann ich / Kann ich gut). Wörter: app/lernen/englisch-data.js (window.WIR_VOKABELN_EN), wird beim ersten Öffnen nachgeladen.
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
  const E = { tab: 'liste', filter: 'alle', q: '', open: null, mode: 'offen', dir: 'ed', group: 'alle', ses: null };
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

  function deckOf() {
    return WORDS.filter(w => {
      if (E.group !== 'alle' && w.grp !== E.group) return false;
      const l = lvl(w);
      if (E.mode === 'alle') return true;
      if (E.mode === 'schwer') return l === undefined || l === 0;
      return l !== 2;
    });
  }
  function vKarten(b) {
    const s = E.ses;
    if (!s) {
      const n = deckOf().length;
      const M = [['offen', 'Alle außer „gut“'], ['schwer', 'Neu + nicht'], ['alle', 'Alle']];
      b.innerHTML = `<div class="ln-card glass"><h3>Karteikarten</h3>
        <div class="ln-sub">Wörter</div><div class="ln-seg en-filter">${M.map(([k, t]) => `<button type="button" data-en="mode" data-x="${k}" class="${E.mode === k ? 'on' : ''}">${t}</button>`).join('')}</div>
        <div class="ln-sub" style="margin-top:12px">Richtung</div><div class="ln-seg"><button type="button" data-en="dir" data-x="ed" class="${E.dir === 'ed' ? 'on' : ''}">Englisch → Deutsch</button><button type="button" data-en="dir" data-x="de" class="${E.dir === 'de' ? 'on' : ''}">Deutsch → Englisch</button></div>
        <div class="ln-sub" style="margin-top:12px">Teil</div><select class="ln-input" id="enGrp"><option value="alle">Alle Teile</option>${groups().map(g => `<option ${E.group === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select>
        <button class="ln-btn big" type="button" data-en="start" style="margin-top:16px" ${n ? '' : 'disabled'}>${n ? `Start (${n} Wörter)` : 'Hier ist nichts mehr offen'}</button></div>`;
      $('enGrp').onchange = e => { E.group = e.target.value; render(); };
      return;
    }
    if (s.pos >= s.deck.length) {
      b.innerHTML = `<div class="ln-card glass ln-count"><b style="font-size:34px">Geschafft</b><span>${s.n} Bewertungen: ${s.r[2]} gut · ${s.r[1]} können · ${s.r[0]} nicht</span></div>
        <button class="ln-btn big" type="button" data-en="start">Nochmal</button><button class="ln-btn big soft" type="button" data-en="end">Zurück</button>`;
      return;
    }
    const w = WORDS[s.deck[s.pos]], front = E.dir === 'ed';
    const fq = front ? `<div class="q">${esc(w.en)}</div>${w.ipa ? `<div class="en-ipa">${esc(w.ipa)}</div>` : ''}` : `<div class="q">${esc(w.de)}</div>`;
    const back = front ? `<div class="a"><b>${esc(w.de)}</b></div><div class="en-def">${esc(w.def)}</div>` : `<div class="a"><b>${esc(w.en)}</b>${w.ipa ? ` <span class="en-ipa">${esc(w.ipa)}</span>` : ''}</div><div class="en-def">${esc(w.def)}</div>`;
    b.innerHTML = `<div class="ln-row"><div class="ln-sub ln-sp">Noch ${s.deck.length - s.pos} Karte${s.deck.length - s.pos === 1 ? '' : 'n'} ${dot(w)}</div><button class="ln-link" type="button" data-en="end">Beenden</button></div>
      <div class="en-card glass ${s.flip ? 'flip' : ''}" ${s.flip ? '' : 'data-en="flip" role="button" tabindex="0"'}><div class="tag">${esc(w.grp)}</div>${fq}${s.flip ? `<hr>${back}` : '<div class="ln-hint" style="margin-top:18px">Tippen zum Umdrehen</div>'}</div>
      ${s.flip ? `<div class="ln-acts en-acts"><button class="ln-btn no" type="button" data-en="rate" data-l="0">Kann ich nicht</button><button class="ln-btn soft" type="button" data-en="rate" data-l="1">Kann ich</button><button class="ln-btn ok" type="button" data-en="rate" data-l="2">Kann ich gut</button></div>` : '<button class="ln-btn big soft" type="button" data-en="flip">Antwort zeigen</button>'}`;
  }

  function start() {
    const deck = shuffle(deckOf().map(w => w.i));
    E.ses = { deck, pos: 0, flip: false, n: 0, r: { 0: 0, 1: 0, 2: 0 } };
    render();
  }
  function rate(l) {
    const s = E.ses, w = WORDS[s.deck[s.pos]];
    setLevel(w, l); s.n++; s.r[l]++;
    if (l === 0) s.deck.splice(Math.min(s.deck.length, s.pos + 5), 0, w.i);   // „nicht“: kommt in dieser Runde bald nochmal
    s.pos++; s.flip = false; render();
  }

  function onClick(e) {
    const t = e.target.closest('[data-en]'); if (!t) return;
    const d = t.dataset;
    switch (d.en) {
      case 'tab': E.tab = d.x; E.ses = null; render(); break;
      case 'filter': E.filter = d.x; E.open = null; render(); break;
      case 'open': E.open = E.open === d.id ? null : d.id; $('enList').innerHTML = listHtml(); break;
      case 'set': { const w = WORDS.find(x => x.id === d.id); if (w) { setLevel(w, +d.l); render(); } break; }
      case 'mode': E.mode = d.x; render(); break;
      case 'dir': E.dir = d.x; render(); break;
      case 'start': start(); break;
      case 'end': E.ses = null; render(); break;
      case 'flip': if (E.ses && !E.ses.flip) { E.ses.flip = true; render(); } break;
      case 'rate': if (E.ses?.flip) rate(+d.l); break;
    }
  }
  function onKey(e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[data-en=flip]')) { e.preventDefault(); onClick(e); } }

  // Einstieg aus lernen.js: zeigt den Englisch-Bereich im übergebenen Element
  async function mount(target) {
    el = target; el.onclick = onClick; el.onkeydown = onKey;
    el.innerHTML = '<div class="ln-empty">Lade …</div>';
    try { await loadData(); } catch (_) { el.innerHTML = '<div class="ln-empty">Konnte nicht geladen werden. Bitte einmal mit Netz öffnen.</div>'; return; }
    if (!WORDS) prep();
    load(); E.ses = null; render();
    try { if (await pull() && el === target) render(); } catch (e) { console.warn('[englisch] offline/sync', e?.message); }
  }
  function unmount() { if (el) { el.onclick = null; el.onkeydown = null; } el = null; }
  window.addEventListener('online', flush);
  window.WIR_ENGLISCH = { mount, unmount };
})();
