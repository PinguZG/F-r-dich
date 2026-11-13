// Zusammen spielen (13.11.2026): Garlic-Phone-artige Zeichenspiele für zwei. Modi: Normal, Complement, Story, Animation, Knock Off.
// Alle Regeln und Prüfungen liegen auf dem Server (pb_hooks/wir_party.pb.js, party_lib.js); hier nur Oberfläche.
// Gezeichnet wird mit der Draw-Pro-Engine im lokalen Modus (WIR_DRAW.openLocal) – das Ergebnis ist ein Bild pro Zug.
(() => {
  const pb = window.WIR_PB;
  if (!pb) return;
  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const me = () => (pb.authStore.record || pb.authStore.model)?.id;
  const partnerName = () => window.WIR_LOOK?.partner?.()?.name || 'Schatz';
  const W = 1200, H = 1600;
  const store = { get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch (_) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} } };
  const post = (path, body) => pb.send(path, { method: 'POST', body, requestKey: null });
  const pbMs = s => s ? Date.parse(String(s).replace(' ', 'T')) : 0;
  const GRACE = 30000;

  const ICO = {
    normal: '<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 013 3L8 19z"/><path d="M14.5 6.5l3 3"/>',
    complement: '<circle cx="12" cy="12" r="8"/><path d="M12 4v16"/><path d="M12 4a8 8 0 010 16" fill="currentColor" fill-opacity=".25"/>',
    story: '<path d="M4 5.5C6.5 4 9.5 4 12 5.5 14.5 4 17.5 4 20 5.5V19c-2.5-1.5-5.5-1.5-8 0-2.5-1.5-5.5-1.5-8 0z"/><path d="M12 5.5V19"/>',
    animation: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="M10 9.5v5l4.5-2.5z" fill="currentColor"/>',
    knockoff: '<rect x="4" y="4" width="11" height="11" rx="2"/><rect x="9" y="9" width="11" height="11" rx="2" fill="currentColor" fill-opacity=".2"/>',
  };
  const svg = k => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'ico-line'); s.innerHTML = ICO[k]; return s; };
  const MODES = [
    { id: 'normal', name: 'Normal', rounds: [2, 8, 4] }, { id: 'complement', name: 'Complement', rounds: null },
    { id: 'story', name: 'Story', rounds: [4, 10, 6] }, { id: 'animation', name: 'Animation', rounds: [4, 12, 8] }, { id: 'knockoff', name: 'Knock Off', rounds: [2, 6, 4] },
  ];
  const modeName = id => MODES.find(m => m.id === id)?.name || id;
  const WORDS = ['Pinguin im Sommerurlaub', 'ein müdes Sofa', 'Pizza auf Weltreise', 'Drache beim Zahnarzt', 'verliebter Toaster', 'Oktopus als DJ', 'Wolke mit Sonnenbrille', 'Schnecke im Rennauto',
    'Kaktus bei der Hochzeit', 'Bär auf dem Einrad', 'singende Banane', 'Mond macht Yoga', 'Robbe im Büro', 'Katze als Königin', 'Gespenst beim Backen', 'Eis am Stiel im Winter', 'Hase mit Fernglas',
    'Frosch beim Friseur', 'tanzender Regenschirm', 'Walross mit Hut', 'Herz auf Abenteuer', 'Igel im Schaumbad', 'Rakete aus Kuchen', 'Hund im Raumanzug', 'Gurke macht Sport', 'Eichhörnchen am Strand',
    'Roboter kocht Nudeln', 'Sonnenblume mit Kopfhörern', 'Giraffe im Aufzug', 'Pinguin und Eisbär beim Date', 'schlafender Vulkan', 'Zebra im Pyjama', 'Spaghetti-Monster', 'Biene mit Handtasche'];

  // ---------- Zustand ----------
  let games = [], steps = new Map();     // gameId -> Steps
  let token = '', cur = null, tick = 0, undo = [];
  const imgUrl = s => pb.files.getURL(s, s.image, { token });
  const idxOf = g => g.p1 === me() ? 0 : 1;
  const kindOf = (mode, r) => (mode === 'normal' || mode === 'story') ? (r % 2 === 0 ? 'text' : 'draw') : mode === 'complement' ? (r === 0 ? 'text' : 'draw') : 'draw';
  const chainOf = (g, r) => (idxOf(g) + r) % 2;
  const stepAt = (id, chain, idx) => (steps.get(id) || []).find(s => s.chain === chain && s.idx === idx);
  const myTurn = g => g.status === 'playing' && !stepAt(g.id, chainOf(g, g.round), g.round);
  const dueMs = g => (g.deadline && !g.paused) ? pbMs(g.deadline) - GRACE : 0;

  async function load() {
    try { token = await pb.files.getToken(); } catch (_) {}
    games = await pb.collection('party_games').getFullList({ sort: '-updated' });
    const all = await pb.collection('party_steps').getFullList({ batch: 500, sort: 'idx' }).catch(() => []);
    steps = new Map();
    for (const s of all) { if (!steps.has(s.game)) steps.set(s.game, []); steps.get(s.game).push(s); }
    badge();
  }
  function badge() {
    const n = games.filter(myTurn).length;
    const b = $('gbParty');
    if (b) { b.textContent = n ? 'Du bist dran' : ''; b.hidden = !n; }
  }

  // ---------- Startseite ----------
  function renderHome() {
    const box = $('pyHome');
    if (!box) return;
    const grid = el('div', 'py-modes');
    MODES.forEach(m => {
      const b = el('button', 'g-card glass py-mode'); b.type = 'button';
      b.append(el('span', 'gc-ico py-ico').appendChild(svg(m.id)).parentNode, el('b', '', m.name));
      b.addEventListener('click', () => openSetup(m));
      grid.append(b);
    });
    const parts = [grid];
    const playing = games.filter(g => g.status === 'playing'), done = games.filter(g => g.status === 'done');
    if (playing.length) {
      parts.push(el('h3', 'g-group', 'Laufend'));
      const l = el('div', 'py-list');
      playing.forEach(g => l.append(gameRow(g)));
      parts.push(l);
    }
    if (done.length) {
      parts.push(el('h3', 'g-group', 'Verlauf'));
      const l = el('div', 'py-hist');
      done.forEach(g => l.append(histCard(g)));
      parts.push(l);
    }
    box.replaceChildren(...parts);
  }
  function gameRow(g) {
    const b = el('button', 'py-row glass'); b.type = 'button';
    const turn = myTurn(g);
    b.append(el('span', 'py-ic', '').appendChild(svg(g.mode)).parentNode, el('b', '', modeName(g.mode)),
      el('small', '', g.paused ? 'Pausiert' : `Runde ${g.round + 1}/${g.rounds}`));
    if (turn) b.append(el('i', 'g-badge py-turn', 'Du bist dran'));
    b.addEventListener('click', () => openGame(g.id));
    return b;
  }
  function histCard(g) {
    const b = el('button', 'py-hc glass'); b.type = 'button';
    const list = steps.get(g.id) || [];
    const last = list.filter(s => s.image).sort((a, c) => c.idx - a.idx)[0];
    const pic = el('div', 'py-hthumb');
    if (last) { const i = el('img'); i.alt = ''; i.loading = 'lazy'; i.src = imgUrl(last); pic.append(i); }
    b.append(pic, el('b', '', modeName(g.mode)), el('small', '', new Date(pbMs(g.updated)).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })));
    b.addEventListener('click', () => openGame(g.id));
    return b;
  }

  // ---------- Einstellungen / Start ----------
  function mkSheet(id) {
    let w = $(id);
    if (!w) {
      w = el('div', 'sheet-wrap'); w.id = id; w.hidden = true;
      const bd = el('div', 'sheet-backdrop'); bd.dataset.close = '';
      const sh = el('div', 'sheet'); sh.append(el('div', 'sheet-grip'));
      const x = el('button', 'sheet-x', '✕'); x.type = 'button'; x.dataset.close = ''; x.setAttribute('aria-label', 'Schließen');
      const body = el('div', 'py-sheet'); sh.append(x, body); w.append(bd, sh); document.body.append(w);
    }
    return w.querySelector('.py-sheet');
  }
  const chips = (label, opts, val, on) => {
    const row = el('div', 'py-set'); row.append(el('span', '', label));
    const c = el('div', 'py-chips');
    opts.forEach(([v, t]) => { const b = el('button', 'dp-chip' + (v === val ? ' on' : ''), t); b.type = 'button'; b.addEventListener('click', () => { on(v); [...c.children].forEach(x => x.classList.toggle('on', x === b)); }); c.append(b); });
    row.append(c); return row;
  };
  function openSetup(m) {
    const body = mkSheet('pySetup');
    const saved = store.get('wir-party-set') || {};
    const s = { turn_s: saved.turn_s ?? 90, brush: saved.brush || 'free', look_s: saved.look_s || 5, rounds: m.rounds ? Math.min(m.rounds[1], Math.max(m.rounds[0], saved['r_' + m.id] || m.rounds[2])) : 3 };
    const t = el('h2', 'sheet-title', m.name);
    const rows = [t, chips('Zeit pro Zug', [[0, 'Aus'], [45, '45 s'], [90, '90 s'], [180, '3 min'], [300, '5 min']], s.turn_s, v => { s.turn_s = v; })];
    if (m.rounds) { const opts = []; for (let r = m.rounds[0]; r <= m.rounds[1]; r++) opts.push([r, String(r)]); rows.push(chips(m.id === 'animation' ? 'Bilder' : 'Runden', opts, s.rounds, v => { s.rounds = v; })); }
    rows.push(chips('Pinsel', [['free', 'Frei'], ['pen', 'Nur Stift']], s.brush, v => { s.brush = v; }));
    if (m.id === 'knockoff') rows.push(chips('Original sichtbar', [[3, '3 s'], [5, '5 s'], [8, '8 s'], [12, '12 s']], s.look_s, v => { s.look_s = v; }));
    const go = el('button', 'py-go', 'Starten'); go.type = 'button';
    go.addEventListener('click', async () => {
      go.disabled = true;
      store.set('wir-party-set', { ...saved, turn_s: s.turn_s, brush: s.brush, look_s: s.look_s, ['r_' + m.id]: s.rounds });
      try {
        const g = await post('/api/party/new', { mode: m.id, settings: s });
        UI.sheet('pySetup', false);
        await load(); openGame(g.id);
      } catch (err) { alert(UI.errText(err)); go.disabled = false; }
    });
    body.replaceChildren(...rows, go);
    UI.sheet('pySetup');
  }

  // ---------- Partie ----------
  async function openGame(id) {
    cur = id; UI.show('s-partygame');
    await load();
    renderGame();
  }
  function stopTick() { clearInterval(tick); tick = 0; }
  function renderGame() {
    stopTick();
    const box = $('pyGame');
    const g = games.find(x => x.id === cur);
    if (!g) { box.replaceChildren(el('p', 'py-empty', 'Partie nicht gefunden')); return; }
    const head = el('div', 'py-head');
    head.append(el('h2', '', modeName(g.mode)));
    const tools = el('div', 'py-tools');
    if (g.status === 'playing') {
      const pz = el('button', 'py-ib', g.paused ? 'Weiter' : 'Pause'); pz.type = 'button';
      pz.addEventListener('click', async () => { try { await post(`/api/party/${g.id}/pause`, { paused: !g.paused }); await load(); renderGame(); } catch (err) { alert(UI.errText(err)); } });
      tools.append(pz);
    }
    const del = el('button', 'py-ib', '🗑'); del.type = 'button'; del.setAttribute('aria-label', 'Partie löschen');
    del.addEventListener('click', async () => { if (!confirm('Partie wirklich löschen?')) return; try { await post(`/api/party/${g.id}/delete`, {}); await load(); UI.show('s-party'); } catch (err) { alert(UI.errText(err)); } });
    tools.append(del); head.append(tools);
    const body = el('div', 'py-body');
    box.replaceChildren(head, body);
    if (g.status === 'done') { renderReveal(g, body); return; }
    const sub = el('p', 'py-sub', g.paused ? 'Pausiert' : `Runde ${g.round + 1} von ${g.rounds}`);
    body.append(sub);
    if (g.paused) return;
    const clock = el('div', 'py-clock'); body.append(clock);
    const due = dueMs(g);
    let auto = null;
    if (due) { const upd = () => { const left = Math.max(0, Math.ceil((due - Date.now()) / 1000)); clock.textContent = Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0'); clock.classList.toggle('low', left <= 10); if (auto && left <= 0) { const f = auto; auto = null; f(); } }; upd(); tick = setInterval(upd, 500); }
    if (!myTurn(g)) { body.append(el('p', 'py-wait', `Warte auf ${partnerName()} …`)); return; }
    auto = renderTurn(g, body, due);
  }

  // Was sehe ich in meiner Runde?
  function contextOf(g) {
    const r = g.round, chain = chainOf(g, r), prev = r > 0 ? stepAt(g.id, chain, r - 1) : null;
    return { r, chain, prev, all: (steps.get(g.id) || []).filter(s => s.chain === chain && s.idx < r).sort((a, b) => a.idx - b.idx) };
  }
  function renderTurn(g, body, due) {
    const { r, chain, prev, all } = contextOf(g);
    const kind = kindOf(g.mode, r);
    if (g.mode === 'story' && all.length) {
      const strip = el('div', 'py-strip');
      all.forEach(s => strip.append(stepView(s, true)));
      body.append(strip);
    } else if (prev && g.mode !== 'complement' && g.mode !== 'animation' && g.mode !== 'knockoff') body.append(stepView(prev));
    if (kind === 'text') {
      const ta = el('textarea', 'mem-input py-text'); ta.maxLength = 200; ta.rows = 3;
      ta.placeholder = r === 0 ? 'Ein Satz oder Thema' : 'Beschreibe das Bild';
      const row = el('div', 'py-actions');
      if (r === 0) { const rnd = el('button', 'dp-fb', 'Zufall'); rnd.type = 'button'; rnd.addEventListener('click', () => { ta.value = WORDS[Math.floor(Math.random() * WORDS.length)]; }); row.append(rnd); }
      const ok = el('button', 'py-go', 'Abgeben'); ok.type = 'button';
      const send = async auto => {
        const t = ta.value.trim();
        if (!t) { if (!auto) ta.focus(); return; }
        ok.disabled = true;
        try { await post(`/api/party/${g.id}/step`, { text: t }); await load(); renderGame(); } catch (err) { alert(UI.errText(err)); ok.disabled = false; }
      };
      ok.addEventListener('click', () => send(false));
      row.append(ok);
      body.append(ta, row);
      return due ? () => { if (cur === g.id && $('s-partygame').classList.contains('active')) send(true); } : null;
    }
    // Zeichnen
    const info = drawInfo(g, r, chain, all);
    if (info.text) body.append(el('p', 'py-prompt', info.text));
    if (info.note) body.append(el('p', 'py-sub', info.note));
    const go = el('button', 'py-go', 'Zeichnen'); go.type = 'button';
    const start = async () => {
      const refs = [];
      for (const rf of info.refs) { try { refs.push({ img: await loadImg(imgUrl(rf.step)), alpha: rf.alpha }); } catch (_) {} }
      if (info.look) { const ok = await lookFirst(info.refs[0]?.step, g.look_s); if (!ok) return; refs.length = 0; }
      const until = due || 0;
      const blob = await WIR_DRAW.openLocal({ title: info.title, refs, clip: info.clip, brush: g.brush, until, back: 's-partygame' });
      if (!blob) { renderGame(); return; }
      go.disabled = true;
      try {
        const fd = new FormData();
        fd.append('image', blob, 'zug.' + (blob.type === 'image/webp' ? 'webp' : 'png'));
        await pb.send(`/api/party/${g.id}/step`, { method: 'POST', body: fd, requestKey: null });
      } catch (err) { alert(UI.errText(err)); }
      await load(); UI.show('s-partygame'); renderGame();
    };
    go.addEventListener('click', start);
    body.append(go);
    return null;
  }
  const loadImg = url => new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = url; });
  function drawInfo(g, r, chain, all) {
    const prev = all[all.length - 1];
    const o = { title: 'Zeichnen', text: '', note: '', refs: [], clip: null, look: false };
    if (g.mode === 'normal' || g.mode === 'story') { o.text = prev?.text || ''; o.title = o.text; }
    else if (g.mode === 'complement') {
      if (r === 1) { o.text = prev?.text || ''; o.title = o.text; o.clip = [0, 0, W / 2, H]; o.note = 'Linke Hälfte'; }
      else { o.clip = [W / 2, 0, W, H]; o.note = 'Rechte Hälfte ergänzen'; o.refs = prev ? [{ step: prev, alpha: 1 }] : []; o.title = 'Ergänzen'; }
    } else if (g.mode === 'animation') {
      o.title = `Bild ${r + 1}/${g.rounds}`; o.refs = all.slice(-2).reverse().map((s, i) => ({ step: s, alpha: i ? 0.12 : 0.3 })).reverse();
      o.note = r === 0 ? 'Erstes Bild' : '';
    } else if (g.mode === 'knockoff') {
      if (r === 0) { o.title = 'Zeichne etwas'; o.note = 'Wird gleich nachgezeichnet'; o.text = ''; }
      else { o.title = 'Aus dem Gedächtnis'; o.refs = prev ? [{ step: prev, alpha: 1 }] : []; o.look = true; o.note = `${g.look_s} s ansehen`; }
    }
    return o;
  }
  // Knock Off: Original kurz zeigen, dann verschwindet es
  function lookFirst(step, secs) {
    return new Promise(res => {
      if (!step) { res(true); return; }
      const ov = el('div', 'py-look');
      const img = el('img'); img.alt = ''; img.src = imgUrl(step);
      const t = el('div', 'py-looktime');
      ov.append(img, t); document.body.append(ov);
      let left = secs; t.textContent = left;
      const iv = setInterval(() => { left--; t.textContent = left; if (left <= 0) { clearInterval(iv); ov.remove(); res(true); } }, 1000);
      ov.addEventListener('click', e => { if (e.target === ov) { clearInterval(iv); ov.remove(); res(false); } });
    });
  }
  function stepView(s, small) {
    const c = el('div', 'py-step' + (small ? ' sm' : ''));
    if (s.kind === 'text') c.append(el('p', 'py-prompt', s.text));
    else if (s.kind === 'draw' && s.image) { const i = el('img'); i.alt = ''; i.src = imgUrl(s); c.append(i); }
    else c.append(el('p', 'py-sub', '—'));
    return c;
  }

  // ---------- Aufdeckung ----------
  function renderReveal(g, body) {
    const name = u => u === me() ? 'Du' : partnerName();
    const chains = [0, 1].map(c => (steps.get(g.id) || []).filter(s => s.chain === c).sort((a, b) => a.idx - b.idx));
    let ci = 0;
    const tabs = el('div', 'dp-tabs');
    const view = el('div', 'py-reveal');
    const draw = () => {
      [...tabs.children].forEach((b, i) => b.classList.toggle('on', i === ci));
      const list = chains[ci];
      view.replaceChildren();
      if (!list.length) { view.append(el('p', 'py-sub', 'Leer')); return; }
      const first = list[0];
      view.append(el('p', 'py-sub', `Gestartet von ${name(first.author).toLowerCase() === 'du' ? 'dir' : partnerName()}`));
      if (g.mode === 'animation') { animView(g, list, view); return; }
      if (g.mode === 'complement') { complementView(g, list, view); return; }
      if (g.mode === 'knockoff') { knockView(g, list, view, name); return; }
      // normal + story: Schritt für Schritt aufdecken
      let shown = 0;
      const col = el('div', g.mode === 'story' ? 'py-comic' : 'py-chain');
      const next = el('button', 'py-go', 'Weiter'); next.type = 'button';
      const add = () => {
        const s = list[shown++];
        const card = el('div', 'py-rcard glass');
        card.append(el('small', '', name(s.author)), stepView(s));
        const hb = el('button', 'py-heart' + (s.fav ? ' on' : ''), '♥'); hb.type = 'button'; hb.setAttribute('aria-label', 'Lieblingsschritt');
        hb.addEventListener('click', async () => { try { const r = await post(`/api/party/${g.id}/fav`, { step: s.id }); s.fav = r.fav; hb.classList.toggle('on', !!r.fav); } catch (_) {} });
        card.append(hb); col.append(card);
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (shown >= list.length) { next.remove(); actions(); }
      };
      const actions = () => {
        const row = el('div', 'py-actions');
        const sv = el('button', 'dp-fb', 'In Erinnerungen'); sv.type = 'button';
        sv.addEventListener('click', async () => { sv.disabled = true; try { await saveToMemories(await renderStrip(list), `🎨 ${modeName(g.mode)}`); sv.textContent = 'Gespeichert ✓'; } catch (err) { alert(UI.errText(err)); sv.disabled = false; } });
        row.append(sv); view.append(row);
      };
      next.addEventListener('click', add);
      view.append(col, next); add();
    };
    ['Kette 1', 'Kette 2'].forEach((t, i) => { const b = el('button', 'dp-tab', t); b.type = 'button'; b.addEventListener('click', () => { ci = i; draw(); }); tabs.append(b); });
    body.append(tabs, view); draw();
  }
  async function composeComplement(list) {
    const c = document.createElement('canvas'); c.width = 600; c.height = 800;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 600, 800);
    x.globalCompositeOperation = 'multiply';
    for (const s of list.filter(s => s.image)) { try { x.drawImage(await loadImg(imgUrl(s)), 0, 0, 600, 800); } catch (_) {} }
    return c;
  }
  async function complementView(g, list, view) {
    const theme = list.find(s => s.kind === 'text');
    if (theme) view.append(el('p', 'py-prompt', theme.text));
    const c = await composeComplement(list); c.className = 'py-canvas'; view.append(c);
    const row = el('div', 'py-actions'); const sv = el('button', 'dp-fb', 'In Erinnerungen'); sv.type = 'button';
    sv.addEventListener('click', async () => { sv.disabled = true; try { await saveToMemories(await new Promise(r => c.toBlob(r, 'image/jpeg', .9)), '🎨 Complement'); sv.textContent = 'Gespeichert ✓'; } catch (err) { alert(UI.errText(err)); sv.disabled = false; } });
    row.append(sv); view.append(row);
  }
  function knockView(g, list, view, name) {
    const grid = el('div', 'py-knock');
    list.forEach((s, i) => { const c = el('div', 'py-rcard glass'); c.append(el('small', '', (i === 0 ? 'Original · ' : 'Nachgezeichnet · ') + name(s.author)), stepView(s)); grid.append(c); });
    view.append(grid);
  }
  async function animView(g, list, view) {
    const frames = list.filter(s => s.image);
    if (!frames.length) { view.append(el('p', 'py-sub', 'Keine Bilder')); return; }
    const imgs = await Promise.all(frames.map(s => loadImg(imgUrl(s)).catch(() => null)));
    const c = el('canvas', 'py-canvas'); c.width = 600; c.height = 800; view.append(c);
    const x = c.getContext('2d');
    let i = 0, fps = g.fps || 6, playing = true, timer = 0;
    const show = () => { x.fillStyle = '#fff'; x.fillRect(0, 0, 600, 800); if (imgs[i]) x.drawImage(imgs[i], 0, 0, 600, 800); };
    const loop = () => { clearInterval(timer); timer = setInterval(() => { if (!$('s-partygame').classList.contains('active')) { clearInterval(timer); return; } if (playing) { i = (i + 1) % imgs.length; show(); } }, 1000 / fps); };
    show(); loop();
    const row = el('div', 'py-actions');
    const pp = el('button', 'dp-fb', 'Pause'); pp.type = 'button'; pp.addEventListener('click', () => { playing = !playing; pp.textContent = playing ? 'Pause' : 'Abspielen'; });
    const sl = el('input'); sl.type = 'range'; sl.min = 2; sl.max = 12; sl.value = fps; sl.setAttribute('aria-label', 'Bilder pro Sekunde'); sl.addEventListener('input', () => { fps = +sl.value; fl.textContent = fps + ' fps'; loop(); });
    const fl = el('small', '', fps + ' fps');
    row.append(pp, sl, fl); view.append(row);
    const row2 = el('div', 'py-actions');
    const ex = el('button', 'dp-fb', 'Als Animation speichern'); ex.type = 'button';
    ex.addEventListener('click', async () => {
      ex.disabled = true; ex.textContent = 'Erzeuge …';
      try {
        const blob = await makeApng(imgs.filter(Boolean), Math.round(1000 / fps));
        const file = new File([blob], 'animation.png', { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file] }); } catch (_) {} }
        else { const a = el('a'); a.href = URL.createObjectURL(blob); a.download = 'animation.png'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
        ex.textContent = 'Als Animation speichern';
      } catch (err) { alert('Ging nicht: ' + err.message); }
      ex.disabled = false;
    });
    const mem = el('button', 'dp-fb', 'In Erinnerungen'); mem.type = 'button';
    mem.addEventListener('click', async () => { mem.disabled = true; try { await saveToMemories(await makeApng(imgs.filter(Boolean), Math.round(1000 / fps)), '🎞️ Animation', 'animation.png'); mem.textContent = 'Gespeichert ✓'; } catch (err) { alert(UI.errText(err)); mem.disabled = false; } });
    row2.append(ex, mem); view.append(row2);
  }
  // Strip als ein Bild (Comic / Kette) für die Erinnerungen
  async function renderStrip(list) {
    const items = list.filter(s => s.kind !== 'skip');
    const pw = 600, ph = 800, gap = 16, th = 90;
    const c = document.createElement('canvas'); c.width = pw + gap * 2;
    const hs = items.map(s => s.kind === 'draw' ? ph : th);
    c.height = gap + hs.reduce((a, b) => a + b + gap, 0);
    const x = c.getContext('2d'); x.fillStyle = '#fff7fb'; x.fillRect(0, 0, c.width, c.height);
    let y = gap;
    for (const s of items) {
      if (s.kind === 'draw') { try { x.fillStyle = '#fff'; x.fillRect(gap, y, pw, ph); x.drawImage(await loadImg(imgUrl(s)), gap, y, pw, ph); } catch (_) {} y += ph + gap; }
      else { x.fillStyle = '#b8165a'; x.font = '700 26px Quicksand, system-ui, sans-serif'; x.textBaseline = 'middle'; wrapText(x, s.text, gap, y + th / 2, pw, 32); y += th + gap; }
    }
    return new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
  }
  function wrapText(x, t, px, py, maxW, lh) {
    const words = String(t).split(' '); const lines = []; let line = '';
    for (const w of words) { const test = line ? line + ' ' + w : w; if (x.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test; }
    lines.push(line);
    lines.slice(0, 3).forEach((l, i, a) => x.fillText(l, px, py + (i - (a.length - 1) / 2) * lh));
  }
  async function saveToMemories(blob, caption, fname) {
    const fd = new FormData();
    fd.append('image', blob, fname || 'spiel.jpg');
    fd.append('caption', caption.slice(0, 200)); fd.append('author', me()); fd.append('order', -Date.now() % 1e9);
    await pb.collection('photos').create(fd);
  }

  // ---------- APNG (animiertes PNG, ohne Bibliothek) ----------
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const u32 = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  function chunk(type, data) {
    const t = new TextEncoder().encode(type), out = new Uint8Array(12 + data.length);
    out.set(u32(data.length), 0); out.set(t, 4); out.set(data, 8);
    const crcIn = new Uint8Array(4 + data.length); crcIn.set(t, 0); crcIn.set(data, 4);
    out.set(u32(crc32(crcIn)), 8 + data.length); return out;
  }
  function readChunks(buf) {
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength), out = []; let p = 8;
    while (p < buf.length) { const len = dv.getUint32(p), type = String.fromCharCode(...buf.slice(p + 4, p + 8)); out.push({ type, data: buf.slice(p + 8, p + 8 + len) }); p += 12 + len; }
    return out;
  }
  async function makeApng(imgs, delayMs) {
    const parts = [];
    const frames = [];
    for (const im of imgs) {
      const c = document.createElement('canvas'); c.width = 600; c.height = 800;
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 600, 800); x.drawImage(im, 0, 0, 600, 800);
      const png = new Uint8Array(await (await new Promise(r => c.toBlob(r, 'image/png'))).arrayBuffer());
      frames.push(readChunks(png));
    }
    parts.push(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]));
    parts.push(chunk('IHDR', frames[0].find(c => c.type === 'IHDR').data));
    parts.push(chunk('acTL', new Uint8Array([...u32(frames.length), ...u32(0)])));
    let seq = 0;
    frames.forEach((ch, i) => {
      const ctl = new Uint8Array(26); const dv = new DataView(ctl.buffer);
      dv.setUint32(0, seq++); dv.setUint32(4, 600); dv.setUint32(8, 800); dv.setUint32(12, 0); dv.setUint32(16, 0); dv.setUint16(20, delayMs); dv.setUint16(22, 1000); ctl[24] = 0; ctl[25] = 0;
      parts.push(chunk('fcTL', ctl));
      const idat = ch.filter(c => c.type === 'IDAT');
      if (i === 0) idat.forEach(c => parts.push(chunk('IDAT', c.data)));
      else idat.forEach(c => { const d = new Uint8Array(4 + c.data.length); new DataView(d.buffer).setUint32(0, seq++); d.set(c.data, 4); parts.push(chunk('fdAT', d)); });
    });
    parts.push(chunk('IEND', new Uint8Array(0)));
    return new Blob(parts, { type: 'image/png' });
  }

  // ---------- Start ----------
  document.addEventListener('wir:show', e => {
    if (e.detail === 's-party') load().then(renderHome).catch(console.error);
    if (e.detail !== 's-partygame') stopTick();
  });
  document.addEventListener('wir:started', async () => {
    try { await load(); } catch (_) { return; }
    const upd = async () => { await load().catch(() => {}); if ($('s-party')?.classList.contains('active')) renderHome(); else if ($('s-partygame')?.classList.contains('active') && !$('s-canvas')?.classList.contains('active')) { const ok = $('pyGame')?.querySelector('textarea')?.value; if (!ok) renderGame(); } };
    pb.collection('party_games').subscribe('*', upd).catch(() => {});
    pb.collection('party_steps').subscribe('*', upd).catch(() => {});
  });
  window.WIR_PARTY = { reload: load, games: () => games, open: openGame, makeApng };
})();
