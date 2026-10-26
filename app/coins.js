// Heart Coins: Chip oben rechts im Spielebereich, Bottom-Sheet mit Verlauf + Shop (shop.js). Kontostand und Buchungen macht
// nur der Server (pb_hooks/wir_coins.pb.js), hier wird nur angezeigt. Nutzt die PocketBase-Verbindung von app.js.
(() => {
  const pb = window.WIR_PB;
  const $ = id => document.getElementById(id);
  const myId = () => (pb.authStore.record || pb.authStore.model)?.id;
  let started = false;

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

  // ======================================================================
  // Kontostand + Chip
  // ======================================================================
  let balance = null, info = null;

  function setBalance(n, animate = true) {
    const prev = balance;
    balance = n;
    for (const id of ['coinBal', 'coinBalBig', 'startCoinBal', 'shopBal']) if ($(id)) $(id).textContent = fmt(n);
    if (animate && prev != null && n !== prev) bump(n - prev);
    document.dispatchEvent(new CustomEvent('wir:balance', { detail: n }));
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
  // Sheet: Verlauf
  // ======================================================================
  // Bereiche: Verlauf / Shop (shop.js füllt #shopBox und hört auf 'wir:shop')
  let tab = 'history';
  function renderTabs() {
    document.querySelectorAll('[data-coin-tab]').forEach(b => b.classList.toggle('on', b.dataset.coinTab === tab));
    document.querySelectorAll('#coinSheet [data-pane]').forEach(p => { p.hidden = p.dataset.pane !== tab; });
    if (tab === 'shop') document.dispatchEvent(new CustomEvent('wir:shop'));
  }
  function openSheet(t) {
    if (typeof t === 'string') tab = t;
    renderTabs();
    UI.sheet('coinSheet', true);
    loadMe().catch(console.error);
    if (tab === 'history') loadLedger(true).catch(console.error);
  }
  $('coinChip').addEventListener('click', () => openSheet());
  document.querySelectorAll('[data-coin-tab]').forEach(b => b.addEventListener('click', () => {
    tab = b.dataset.coinTab; renderTabs();
    if (tab === 'history') loadLedger(true).catch(console.error);
  }));

  // Chip oben rechts nur im Spielebereich (Übersicht + alle Spiele)
  document.addEventListener('wir:show', e => {
    const p = $(e.detail);
    $('coinChip').hidden = !(p && (e.detail === 's-games' || p.dataset.area === 'games'));
  });

  const RULES = [
    ['💗', 'Liebe senden', r => `+${r.love.amount} pro Tipp`],
    ['💌', 'Öffne-wenn-Brief schreiben', r => `+${r.openwhen.amount} (ab ${r.openwhen.minLen} Zeichen, ${r.openwhen.max}× am Tag)`],
    ['📸', 'Foto hochladen', r => `+${r.photo.amount} (${r.photo.max}× am Tag)`],
    ['☀️', 'App am Tag zum ersten Mal öffnen', r => `+${r.daily.amount}`],
    ['✓', 'Geschenkten Gutschein erfüllen', r => `+${r.fulfill?.amount || 0}`],
  ];

  function renderToday() {
    if (!info) return;
    const r = info.rules, t = info.today;
    const chips = [
      ['💗', t.love * r.love.amount, `${t.love}× Liebe`],
      ['💌', t.openwhen * r.openwhen.amount, `${t.openwhen}/${r.openwhen.max} Briefe`],
      ['📸', t.photo * r.photo.amount, `${t.photo}/${r.photo.max} Fotos`],
    ];
    const row = () => chips.map(([i, n, l]) => {
      const d = el('div', 'ct-item');
      d.append(el('span', '', i), el('b', '', '+' + fmt(n)), el('small', '', l));
      return d;
    });
    $('coinToday').replaceChildren(el('small', 'ct-head', 'HEUTE VERDIENT'), ...row());
    if ($('startCoinToday')) $('startCoinToday').replaceChildren(...row());
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
  // Start, Live-Updates
  // ======================================================================
  async function start() {
    started = true;
    await loadMe().catch(console.error);
    dailyBonus().catch(console.error);
    pb.collection('coin_wallets').subscribe('*', e => {
      if (e.record.user === myId()) setBalance(e.record.balance);
      if (!$('coinSheet').hidden) { loadMe().catch(console.error); loadLedger(true).catch(console.error); }
    }).catch(console.error);
  }

  document.addEventListener('wir:show', e => { if (started && e.detail === 's-games') loadMe().catch(console.error); });
  document.addEventListener('visibilitychange', () => {
    if (!started || document.hidden || !pb.authStore.isValid) return;
    dailyBonus().catch(console.error);
    loadMe().catch(console.error);
  });

  // für casino.js + shop.js
  window.WIR_COINS = { openSheet, setBalance, balance: () => balance, when, fmt, loadMe };

  document.addEventListener('wir:started', () => { if (!started) start(); });
})();
