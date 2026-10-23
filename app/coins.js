// Heart Coins: Chip oben, Bottom-Sheet mit Verlauf, Shop (Gutscheine verschenken + Gutschein-Fach), Casino (bald).
// Kontostand und Buchungen macht nur der Server (pb_hooks/wir_coins.pb.js), hier wird nur angezeigt.
// Nutzt die PocketBase-Verbindung von app.js.
(() => {
  const pb = window.WIR_PB || new PocketBase(window.location.origin);
  pb.autoCancellation(false);

  const $ = id => document.getElementById(id);
  const myId = () => (pb.authStore.record || pb.authStore.model)?.id;
  let started = false;
  let users = [];
  const nameOf = id => users.find(u => u.id === id)?.name || 'Schatz';
  const partner = () => users.find(u => u.id !== myId());
  const pname = () => partner()?.name || 'Schatz';

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const post = (path, body = {}) => pb.send(path, { method: 'POST', body });
  const fmt = n => Number(n).toLocaleString('de-DE');
  const pad2 = n => String(n).padStart(2, '0');
  function when(s) {
    const d = new Date(String(s).replace(' ', 'T'));
    const t = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    const days = Math.round((UI.berlinMidnight() - UI.berlinMidnight(d.getTime())) / UI.DAY);
    if (days === 0) return 'heute ' + t;
    if (days === 1) return 'gestern ' + t;
    return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}. ${t}`;
  }
  function errText(err) {
    const d = err?.response?.data;
    if (d && Object.keys(d).length) return Object.values(d).map(v => v.message || JSON.stringify(v)).join(', ');
    return err?.response?.message || err?.message || 'Hat nicht geklappt';
  }
  const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 12));

  // ======================================================================
  // Kontostand + Chip
  // ======================================================================
  let balance = null, info = null;

  function setBalance(n, animate = true) {
    const prev = balance;
    balance = n;
    $('coinBal').textContent = fmt(n);
    $('coinBalBig').textContent = fmt(n);
    if (animate && prev != null && n !== prev) bump(n - prev);
    renderShop();
  }

  function bump(diff) {
    const chip = $('coinChip');
    chip.classList.remove('bump', 'down');
    void chip.offsetWidth;
    chip.classList.add(diff > 0 ? 'bump' : 'down');
    const f = el('span', 'coin-float ' + (diff > 0 ? 'plus' : 'minus'), (diff > 0 ? '+' : '−') + fmt(Math.abs(diff)));
    const r = chip.getBoundingClientRect();
    f.style.left = r.left + r.width / 2 + 'px';
    f.style.top = r.bottom + 'px';
    document.body.append(f);
    setTimeout(() => f.remove(), 1400);
  }

  async function loadMe() {
    info = await pb.send('/api/coins/me', {});
    setBalance(info.balance);
    renderToday();
  }

  let toastTimer = 0;
  function toast(text) {
    let t = $('coinToast');
    if (!t) { t = el('div', 'coin-toast glass'); t.id = 'coinToast'; document.body.append(t); }
    t.textContent = text;
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
  }

  async function dailyBonus() {
    const r = await post('/api/coins/daily');
    if (r.credited) {
      setBalance(r.balance);
      toast(`☀️ Tagesbonus: +${r.amount} Heart Coins`);
    }
  }

  // ======================================================================
  // Sheet: Bereiche
  // ======================================================================
  let tab = 'history', shopTab = 'give';

  function openSheet(t, st) {
    if (t) tab = t;
    if (st) shopTab = st;
    renderTabs();
    UI.sheet('coinSheet', true);
    refresh();
  }

  function renderTabs() {
    document.querySelectorAll('[data-coin-tab]').forEach(b => b.classList.toggle('on', b.dataset.coinTab === tab));
    document.querySelectorAll('#coinSheet [data-pane]').forEach(p => { p.hidden = p.dataset.pane !== tab; });
    document.querySelectorAll('[data-shop-tab]').forEach(b => b.classList.toggle('on', b.dataset.shopTab === shopTab));
    document.querySelectorAll('[data-shop-pane]').forEach(p => { p.hidden = p.dataset.shopPane !== shopTab; });
  }

  function refresh() {
    loadMe().catch(console.error);
    if (tab === 'history') loadLedger(true).catch(console.error);
    if (tab === 'shop') { loadItems().catch(console.error); loadVouchers().catch(console.error); }
  }

  $('coinChip').addEventListener('click', () => openSheet());
  document.querySelectorAll('[data-coin-tab]').forEach(b => b.addEventListener('click', () => { tab = b.dataset.coinTab; renderTabs(); refresh(); }));
  document.querySelectorAll('[data-shop-tab]').forEach(b => b.addEventListener('click', () => { shopTab = b.dataset.shopTab; renderTabs(); }));

  // ======================================================================
  // Verlauf
  // ======================================================================
  const RULES = [
    ['💗', 'Liebe senden', r => `+${r.love.amount} pro Tipp`],
    ['💌', 'Öffne-wenn-Brief schreiben', r => `+${r.openwhen.amount} (ab ${r.openwhen.minLen} Zeichen, ${r.openwhen.max}× am Tag)`],
    ['📸', 'Foto hochladen', r => `+${r.photo.amount} (${r.photo.max}× am Tag)`],
    ['☀️', 'App am Tag zum ersten Mal öffnen', r => `+${r.daily.amount}`],
    ['✓', 'Geschenkten Gutschein erfüllen', r => `+${r.fulfill.amount}`],
  ];

  function renderToday() {
    if (!info) return;
    const r = info.rules, t = info.today;
    const chips = [
      ['💗', t.love * r.love.amount, `${t.love}× Liebe`],
      ['💌', t.openwhen * r.openwhen.amount, `${t.openwhen}/${r.openwhen.max} Briefe`],
      ['📸', t.photo * r.photo.amount, `${t.photo}/${r.photo.max} Fotos`],
    ];
    $('coinToday').replaceChildren(el('small', 'ct-head', 'HEUTE VERDIENT'), ...chips.map(([i, n, l]) => {
      const d = el('div', 'ct-item');
      d.append(el('span', '', i), el('b', '', '+' + fmt(n)), el('small', '', l));
      return d;
    }));
    $('coinRules').replaceChildren(...RULES.map(([i, l, f]) => {
      const li = el('li');
      li.append(el('span', '', i), el('span', '', l), el('b', '', f(r)));
      return li;
    }));
  }

  let ledgerPage = 1;
  async function loadLedger(reset) {
    if (reset) ledgerPage = 1;
    const res = await pb.collection('coin_ledger').getList(ledgerPage, 30, { sort: '-created,-id' });
    const box = $('coinLedger');
    if (reset) box.replaceChildren();
    for (const x of res.items) {
      const row = el('div', 'ledger-row');
      const txt = el('div', 'lr-text');
      txt.append(el('span', '', x.label || x.reason), el('small', '', when(x.created)));
      row.append(txt, el('b', 'lr-amt ' + (x.amount > 0 ? 'plus' : 'minus'), (x.amount > 0 ? '+' : '−') + fmt(Math.abs(x.amount))));
      box.append(row);
    }
    if (!box.children.length) box.append(el('p', 'coin-empty', 'Noch keine Buchungen.'));
    $('coinMore').hidden = res.page >= res.totalPages;
  }
  $('coinMore').addEventListener('click', () => { ledgerPage++; loadLedger(false).catch(console.error); });

  // ======================================================================
  // Shop: verschenken
  // ======================================================================
  let items = [];
  async function loadItems() {
    items = await pb.collection('shop_items').getFullList({ filter: 'active = true', sort: 'price,order' });
    renderShop();
  }

  function voucherCard(v, opts = {}) {
    const c = el('div', 'voucher' + (opts.cls ? ' ' + opts.cls : ''));
    const top = el('div', 'vc-top');
    top.append(el('span', 'vc-emoji', v.emoji || '🎁'), el('span', 'vc-from', opts.line || ''));
    c.append(top, el('b', 'vc-name', v.name));
    if (v.description) c.append(el('p', 'vc-desc', v.description));
    if (v.note) c.append(el('p', 'vc-note', '„' + v.note + '“'));
    if (opts.foot) c.append(opts.foot);
    return c;
  }

  function renderShop() {
    const grid = $('shopGrid');
    if (!grid || !items.length) return;
    $('shopIntro').textContent = `Hier kaufst du nichts für dich: Du verschenkst einen Gutschein an ${pname()} 💗`;
    grid.replaceChildren(...items.map(it => {
      const b = el('button', 'shop-item');
      b.type = 'button';
      const short = balance != null && balance < it.price;
      b.classList.toggle('short', short);
      b.append(el('span', 'si-emoji', it.emoji || '🎁'), el('b', 'si-name', it.name));
      const p = el('span', 'si-price');
      p.append(el('span', 'coin', ''), document.createTextNode(fmt(it.price)));
      b.append(p);
      b.addEventListener('click', () => openGift(it));
      return b;
    }));
  }

  let giftItem = null, giftKey = '';
  function openGift(it) {
    giftItem = it;
    giftKey = newKey();
    const me = nameOf(myId());
    $('giftPreview').replaceChildren(voucherCard(it, { line: `Von ${me} für ${pname()}`, cls: 'big' }));
    $('giftNote').value = '';
    $('giftStatus').textContent = '';
    renderGiftBtn();
    UI.sheet('giftSheet', true);
  }
  function renderGiftBtn() {
    if (!giftItem) return;
    const short = balance != null && balance < giftItem.price;
    $('giftBtn').disabled = short;
    $('giftBtn').textContent = short
      ? `Noch ${fmt(giftItem.price - balance)} Coins sammeln 💗`
      : `🎁 ${pname()} schenken · ${fmt(giftItem.price)}`;
  }

  $('giftForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (!giftItem) return;
    const btn = $('giftBtn');
    btn.disabled = true;
    $('giftStatus').textContent = 'Wird eingepackt …';
    try {
      const r = await post('/api/shop/gift', { item: giftItem.id, note: $('giftNote').value.trim(), key: giftKey });
      setBalance(r.balance);
      const b = btn.getBoundingClientRect();
      UI.burst(b.left + b.width / 2, b.top, 22);
      $('giftStatus').textContent = `Verschenkt! ${pname()} bekommt gleich eine Nachricht 💌`;
      await UI.wait(1300);
      UI.sheet('giftSheet', false);
      giftItem = null;
      shopTab = 'mine';
      renderTabs();
      loadVouchers().catch(console.error);
    } catch (err) {
      $('giftStatus').textContent = errText(err);
      renderGiftBtn();
    }
  });

  // ======================================================================
  // Gutschein-Fach
  // ======================================================================
  let vouchers = [];
  async function loadVouchers() {
    vouchers = await pb.collection('vouchers').getFullList({ sort: '-created' });
    renderVouchers();
  }

  function actionBtn(label, fn) {
    const b = el('button', 'mem-btn vc-btn', label);
    b.type = 'button';
    b.addEventListener('click', async () => {
      b.disabled = true;
      const old = b.textContent;
      b.textContent = '…';
      try { await fn(b); } catch (err) { b.textContent = errText(err); await UI.wait(2200); b.textContent = old; b.disabled = false; }
    });
    return b;
  }

  function renderVouchers() {
    const me = myId();
    const forMe = vouchers.filter(v => v.to === me && v.status !== 'fulfilled');
    const fromMe = vouchers.filter(v => v.from === me && v.status !== 'fulfilled');
    const done = vouchers.filter(v => v.status === 'fulfilled');

    const head = t => el('h3', 'coin-sub', t);
    const boxFor = $('vForMe');
    boxFor.replaceChildren(head('Für dich'));
    if (!forMe.length) boxFor.append(el('p', 'coin-empty', `Noch keine Gutscheine. Vielleicht verschenkt ${pname()} ja bald einen 😉`));
    for (const v of forMe) {
      const foot = el('div', 'vc-foot');
      if (v.status === 'gifted') {
        foot.append(actionBtn('Einlösen 💗', async b => {
          await post(`/api/vouchers/${v.id}/redeem`);
          const r = b.getBoundingClientRect(); UI.burst(r.left + r.width / 2, r.top, 16);
          await loadVouchers();
        }));
      } else {
        foot.append(el('span', 'vc-state', `Eingelöst ${when(v.redeemed_at)} – ${nameOf(v.from)} weiß Bescheid ⏳`));
      }
      boxFor.append(voucherCard(v, { line: `Von ${nameOf(v.from)} für dich`, cls: v.status, foot }));
    }

    const boxFrom = $('vFromMe');
    boxFrom.replaceChildren();
    if (fromMe.length) boxFrom.append(head('Von dir verschenkt'));
    for (const v of fromMe) {
      const foot = el('div', 'vc-foot');
      if (v.status === 'redeemed') {
        foot.append(el('span', 'vc-state hot', `${nameOf(v.to)} löst ihn ein!`));
        foot.append(actionBtn('Erfüllt ✓', async b => {
          await post(`/api/vouchers/${v.id}/fulfill`);
          const r = b.getBoundingClientRect(); UI.burst(r.left + r.width / 2, r.top, 18);
          await loadVouchers();
          loadMe().catch(console.error);
        }));
      } else {
        foot.append(el('span', 'vc-state', 'Noch nicht eingelöst'));
      }
      boxFrom.append(voucherCard(v, { line: `Für ${nameOf(v.to)}`, cls: v.status, foot }));
    }

    $('vDoneWrap').hidden = !done.length;
    $('vDone').replaceChildren(...done.map(v => {
      const row = el('div', 'ledger-row');
      const txt = el('div', 'lr-text');
      txt.append(el('span', '', `${v.emoji || '🎁'} ${v.name}`),
        el('small', '', `${v.from === me ? 'Für ' + nameOf(v.to) : 'Von ' + nameOf(v.from)} · erfüllt ${when(v.fulfilled_at)}`));
      row.append(txt, el('b', 'lr-amt plus', '✓'));
      return row;
    }));

    // Punkt: ein Gutschein wartet aufs Einlösen oder aufs Erfüllen
    const waiting = forMe.filter(v => v.status === 'gifted').length + fromMe.filter(v => v.status === 'redeemed').length;
    $('coinDot').hidden = !waiting;
    $('coinShopDot').hidden = !waiting;
    $('vMineCount').textContent = waiting ? ` (${waiting})` : '';
  }

  // ======================================================================
  // Start, Live-Updates
  // ======================================================================
  async function start() {
    started = true;
    users = await pb.collection('users').getFullList({ fields: 'id,name' }).catch(() => []);
    await loadMe().catch(console.error);
    dailyBonus().catch(console.error);
    loadVouchers().catch(console.error);
    loadItems().catch(console.error);
    pb.collection('coin_wallets').subscribe('*', e => {
      if (e.record.user === myId()) setBalance(e.record.balance);
      if (!$('coinSheet').hidden) { loadMe().catch(console.error); if (tab === 'history') loadLedger(true).catch(console.error); }
    }).catch(console.error);
    pb.collection('vouchers').subscribe('*', () => loadVouchers().catch(console.error)).catch(console.error);
  }

  // Push "Gutschein" -> Sheet direkt im Gutschein-Fach öffnen
  document.addEventListener('wir:go', e => {
    if (String(e.detail).startsWith('coins')) setTimeout(() => openSheet('shop', 'mine'), 350);
  });

  document.addEventListener('visibilitychange', () => {
    if (!started || document.hidden || !pb.authStore.isValid) return;
    dailyBonus().catch(console.error);
    loadMe().catch(console.error);
    loadVouchers().catch(console.error);
  });

  document.addEventListener('wir:started', () => { if (!started) start(); });
})();
