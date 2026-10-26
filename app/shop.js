// Shop (im Coin-Sheet, Reiter „Shop“): Profilrahmen, Benachrichtigungs-Bomben, Tipp-Preise. Dazu Rahmen-Auswahl in den
// Einstellungen und der Hinweis beim Empfang einer Bombe. Preise/Regeln kommen vom Server (GET /api/shop/catalog,
// pb_hooks/shop_lib.js); gekauft und gebucht wird nur dort. Nutzt die PocketBase-Verbindung von app.js.
(() => {
  const pb = window.WIR_PB;
  const $ = id => document.getElementById(id);
  const myId = () => (pb.authStore.record || pb.authStore.model)?.id;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const post = (path, body = {}) => pb.send(path, { method: 'POST', body });
  const fmt = n => Number(n).toLocaleString('de-DE');
  const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 12)).replace(/[^A-Za-z0-9_-]/g, '');
  const errText = err => err?.response?.message || UI.errText(err);
  const partnerName = () => window.WIR_LOOK?.partner()?.name || 'Schatz';
  const hm = ms => new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
  let cat = null, started = false;

  async function loadCatalog() {
    cat = await pb.send('/api/shop/catalog', {});
    window.WIR_COINS?.setBalance(cat.balance, false);
    render();
    renderFrameSetting();
    return cat;
  }

  // Kauf bestätigen (Preis + Guthaben), dann buchen
  function confirmBuy(name, price) {
    const bal = window.WIR_COINS?.balance() ?? cat?.balance ?? 0;
    if (bal < price) { alert(`${name} kostet ${fmt(price)} Coins – du hast ${fmt(bal)}. Noch ein bisschen sammeln 💗`); return false; }
    return confirm(`${name} für ${fmt(price)} Coins kaufen?\n\nGuthaben: ${fmt(bal)} → danach ${fmt(bal - price)} Coins`);
  }

  // ======================================================================
  // Shop-Reiter
  // ======================================================================
  const TIER = { einfach: 'Einfach', besonders: 'Besonders', animiert: 'Animiert ✨' };
  function render() {
    const box = $('shopBox');
    if (!box || !cat) return;
    const me = window.WIR_LOOK?.me();
    box.replaceChildren();

    // Profilrahmen
    box.append(el('h3', 'coin-sub', '🖼️ Profilrahmen'), el('p', 'shop-hint', 'Einmal kaufen, für immer behalten. Erscheint überall an deinem Profilbild – auch bei ' + partnerName() + '.'));
    const grid = el('div', 'frame-grid');
    for (const f of cat.prices.frames) {
      const owned = cat.owned.includes(f.key), on = cat.frame === f.key;
      const b = el('button', 'frame-item glass' + (on ? ' on' : ''));
      b.type = 'button';
      const av = el('span', 'avatar md');
      window.WIR_LOOK?.paintAvatar(av, me ? { ...me, frame: f.key } : { frame: f.key });
      b.append(av, el('b', '', f.name), el('small', '', owned ? (on ? 'Angelegt ✓' : 'Anlegen') : `${TIER[f.tier]} · ${fmt(f.price)}`));
      b.addEventListener('click', () => owned ? setFrame(on ? '' : f.key) : buyFrame(f));
      grid.append(b);
    }
    box.append(grid);

    // Bomben
    const left = cat.prices.bombsPerDay - cat.bombsToday;
    box.append(el('h3', 'coin-sub', '💣 Benachrichtigungs-Bomben'),
      el('p', 'shop-hint', `Ganz viele Pushs hintereinander an ${partnerName()}. Heute noch ${Math.max(0, left)} von ${cat.prices.bombsPerDay}.`
        + (cat.quietNow ? ` Gerade ist Nachtruhe – deine Bombe geht um ${hm(cat.sendAt)} Uhr los.` : '')));
    const hb = cat.prices.bombs.heart, mb = cat.prices.bombs.msg;
    const heart = el('button', 'bomb-item glass');
    heart.type = 'button';
    heart.append(el('span', 'bi-ico', '❤️'), el('span', 'bi-text'), el('span', 'si-price'));
    heart.querySelector('.bi-text').append(el('b', '', hb.name), el('small', '', `${hb.count}× „❤️“`));
    heart.querySelector('.si-price').append(el('span', 'coin'), document.createTextNode(fmt(hb.price)));
    heart.disabled = left <= 0;
    heart.addEventListener('click', () => buyBomb('heart'));
    const msg = el('div', 'bomb-item glass msg');
    const top = el('div', 'bi-row');
    top.append(el('span', 'bi-ico', '💬'), el('span', 'bi-text'), el('span', 'si-price'));
    top.querySelector('.bi-text').append(el('b', '', mb.name), el('small', '', `${mb.count}× dein Text`));
    top.querySelector('.si-price').append(el('span', 'coin'), document.createTextNode(fmt(mb.price)));
    const inp = el('input', 'mem-input');
    inp.id = 'bombText'; inp.maxLength = mb.maxLen; inp.placeholder = `Dein Text (max. ${mb.maxLen} Zeichen)`;
    const go = el('button', 'mem-btn', '💣 Zünden');
    go.type = 'button'; go.disabled = left <= 0;
    go.addEventListener('click', () => buyBomb('msg', inp.value));
    msg.append(top, inp, go);
    box.append(heart, msg, el('div', 'mem-status', ''));
    box.lastChild.id = 'shopStatus';

    // Tipps
    const t = cat.prices.tips;
    box.append(el('h3', 'coin-sub', '💡 Tipps'), el('p', 'shop-hint', 'Kaufst du direkt im Spiel über „💡 Tipp“. Ergebnisse mit Tipp bekommen in der Rangliste ein 💡. Im Duell gegeneinander gibt es keine Tipps.'));
    const ul = el('div', 'tip-list');
    for (const [ico, name, p] of [['🃏', 'Solitär: nächster sinnvoller Zug', t.solitaire], ['🔢', 'Sudoku: deckt ein Feld auf', t.sudoku], ['♟️', 'Schach gegen KI: bester Zug', t.chessai]]) {
      const r = el('div', 'ledger-row');
      const tx = el('div', 'lr-text');
      tx.append(el('span', '', ico + ' ' + name));
      const pr = el('b', 'lr-amt');
      pr.append(el('span', 'coin'), document.createTextNode(' ' + p));
      r.append(tx, pr);
      ul.append(r);
    }
    box.append(ul);
  }
  const status = t => { if ($('shopStatus')) $('shopStatus').textContent = t; };

  async function buyFrame(f) {
    if (!confirmBuy(`Profilrahmen „${f.name}“`, f.price)) return;
    try {
      const r = await post('/api/shop/frame', { frame: f.key });
      window.WIR_COINS?.setBalance(r.balance);
      await window.WIR_LOOK?.reload();
      await loadCatalog();
      UI.burst(window.innerWidth / 2, window.innerHeight / 2, 18);
      status(`„${f.name}“ gehört jetzt dir und ist angelegt ✓`);
    } catch (err) { status(errText(err)); }
  }

  async function setFrame(key) {
    try {
      await post('/api/shop/frame/set', { frame: key });
      await window.WIR_LOOK?.reload();
      await loadCatalog();
    } catch (err) { status(errText(err)); }
  }

  let bombKey = '';
  async function buyBomb(kind, text = '') {
    const b = cat.prices.bombs[kind];
    if (kind === 'msg' && !text.trim()) { status('Schreib erst einen Text 💬'); $('bombText')?.focus(); return; }
    if (!confirmBuy(`${b.name} an ${partnerName()}`, b.price)) return;
    bombKey = bombKey || newKey();
    try {
      const r = await post('/api/shop/bomb', { kind, text, key: bombKey });
      bombKey = '';
      window.WIR_COINS?.setBalance(r.balance);
      window.WIR_FX?.puff(window.innerWidth / 2, window.innerHeight / 2, ['#ff5fa2', '#e0457b'], 20);
      await loadCatalog();
      status(r.delayed ? `💣 Angenommen – wegen Nachtruhe geht sie um ${hm(r.sendAt)} Uhr los.` : `💣 Gezündet! ${partnerName()} bekommt gleich ${b.count} Pushs.`);
    } catch (err) {
      if (err?.status !== 0) bombKey = '';
      status(errText(err));
    }
  }

  // ======================================================================
  // Einstellungen: Rahmen wählen / abnehmen
  // ======================================================================
  function renderFrameSetting() {
    const box = $('frameSet');
    if (!box || !cat) return;
    const me = window.WIR_LOOK?.me();
    const owned = cat.prices.frames.filter(f => cat.owned.includes(f.key));
    box.replaceChildren();
    if (!owned.length) { box.append(el('p', 'mem-note', 'Noch keine Rahmen – im Shop (Spiele → Coins oben rechts) gibt es welche 💗')); return; }
    const row = el('div', 'frame-pick');
    for (const f of [{ key: '', name: 'Ohne' }, ...owned]) {
      const b = el('button', 'frame-chip' + (cat.frame === f.key ? ' on' : ''));
      b.type = 'button';
      const av = el('span', 'avatar sm');
      window.WIR_LOOK?.paintAvatar(av, me ? { ...me, frame: f.key } : { frame: f.key });
      b.append(av, el('small', '', f.name));
      b.addEventListener('click', () => setFrame(f.key));
      row.append(b);
    }
    box.append(row);
  }

  // ======================================================================
  // Bombe empfangen: witziger Hinweis + Herzen, sobald sie losgeht
  // ======================================================================
  const seenKey = () => 'wir-bombs-seen-' + myId();
  function seen() { try { return JSON.parse(localStorage.getItem(seenKey()) || '[]'); } catch (_) { return []; } }
  function markSeen(id) { try { localStorage.setItem(seenKey(), JSON.stringify([id, ...seen()].slice(0, 30))); } catch (_) {} }
  const timers = new Map();
  function onBomb(b) {
    if (!b || b.to !== myId() || seen().includes(b.id) || timers.has(b.id)) return;
    const wait = (b.send_after || 0) - Date.now();
    if (wait > 6 * 3600000) return;
    const fire = () => {
      timers.delete(b.id);
      if (seen().includes(b.id)) return;
      markSeen(b.id);
      const from = window.WIR_LOOK?.partner()?.name || 'Dein Schatz';
      bombToast(b.kind === 'heart' ? `💣 ${from} hat eine Herz-Bombe gezündet` : `💣 ${from} hat eine Nachrichten-Bombe gezündet: „${b.text}“`);
      const h = window.WIR_HEARTS || { partner: '#ff5fa2' };
      window.WIR_FX?.rain([h.partner, '#ff5fa2'], 3500, 22);
    };
    if (wait > 0) timers.set(b.id, setTimeout(fire, wait)); else if (wait > -15 * 60000) fire(); else markSeen(b.id);
  }
  let toastTimer = 0;
  function bombToast(text) {
    let t = $('bombToast');
    if (!t) { t = el('div', 'coin-toast glass bomb-toast'); t.id = 'bombToast'; document.body.append(t); }
    t.textContent = text;
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 5000);
  }

  // Tipp im Spiel kaufen (Bestätigung mit Preis + Guthaben); liefert die Server-Antwort oder null
  async function buyTip(game, ref, extra = {}) {
    if (!cat) await loadCatalog().catch(() => {});
    const price = cat?.prices.tips[game];
    const name = { solitaire: 'Solitär-Tipp', sudoku: 'Sudoku-Tipp', chessai: 'Schach-Tipp' }[game];
    if (!price || !confirmBuy(`💡 ${name}`, price)) return null;
    try {
      const r = await post('/api/shop/tip', { game, ref, key: newKey(), ...extra });
      window.WIR_COINS?.setBalance(r.balance);
      return r;
    } catch (err) { alert(errText(err)); return null; }
  }

  async function start() {
    started = true;
    loadCatalog().catch(console.error);
    try { (await pb.collection('bombs').getList(1, 5, { sort: '-created', filter: pb.filter('to = {:me}', { me: myId() }) })).items.forEach(onBomb); } catch (_) {}
    pb.collection('bombs').subscribe('*', e => { if (e.action === 'create') onBomb(e.record); }).catch(console.error);
  }
  document.addEventListener('wir:shop', () => { if (started) loadCatalog().catch(console.error); });
  document.addEventListener('wir:show', e => { if (started && e.detail === 's-settings') loadCatalog().catch(console.error); });
  document.addEventListener('wir:users', () => { if (cat) { render(); renderFrameSetting(); } });
  document.addEventListener('wir:started', () => { if (!started) start(); });

  window.WIR_SHOP = { tipPrice: g => cat?.prices.tips[g], confirmBuy, newKey, buyTip, reload: loadCatalog };
})();
