// Shop: Gutscheine mit Heart Coins für die andere Person kaufen (nie für sich selbst), Gutschein-Fach mit
// Einlösen / Erfüllt. Kaufen, Einlösen und Erfüllen prüft und bucht nur der Server
// (/api/shop/gift, /api/vouchers/{id}/redeem|fulfill in pb_hooks/wir_coins.pb.js). Nutzt die PocketBase-Verbindung von app.js.
(() => {
  const pb = window.WIR_PB;
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
  const when = s => window.WIR_COINS.when(s);
  function errText(err) {
    const d = err?.response?.data;
    if (d && Object.keys(d).length) return Object.values(d).map(v => v.message || JSON.stringify(v)).join(', ');
    return err?.response?.message || err?.message || 'Hat nicht geklappt';
  }
  const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 12));
  const balance = () => window.WIR_COINS?.balance();

  // ======================================================================
  // Bereiche: Verschenken / Gutscheine
  // ======================================================================
  let shopTab = 'give';
  function renderTabs() {
    document.querySelectorAll('[data-shop-tab]').forEach(b => b.classList.toggle('on', b.dataset.shopTab === shopTab));
    document.querySelectorAll('[data-shop-pane]').forEach(p => { p.hidden = p.dataset.shopPane !== shopTab; });
  }
  document.querySelectorAll('[data-shop-tab]').forEach(b => b.addEventListener('click', () => { shopTab = b.dataset.shopTab; renderTabs(); }));

  // ======================================================================
  // Verschenken
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
    $('shopIntro').textContent = `Hier kaufst du nichts für dich: Du verschenkst einen Gutschein an ${pname()} 💗`;
    if (!items.length) { grid.replaceChildren(el('p', 'coin-empty', 'Gerade gibt es keine Gutscheine.')); return; }
    const bal = balance();
    grid.replaceChildren(...items.map(it => {
      const b = el('button', 'shop-item');
      b.type = 'button';
      b.classList.toggle('short', bal != null && bal < it.price);
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
    $('giftPreview').replaceChildren(voucherCard(it, { line: `Von ${nameOf(myId())} für ${pname()}`, cls: 'big' }));
    $('giftNote').value = '';
    $('giftStatus').textContent = '';
    renderGiftBtn();
    UI.sheet('giftSheet', true);
  }
  function renderGiftBtn() {
    if (!giftItem) return;
    const bal = balance();
    const short = bal != null && bal < giftItem.price;
    $('giftBtn').disabled = short;
    $('giftBtn').textContent = short
      ? `Noch ${fmt(giftItem.price - bal)} Coins sammeln 💗`
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
      window.WIR_COINS?.setBalance(r.balance);
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
    $('navShopDot').hidden = !waiting;
    $('vMineCount').textContent = waiting ? ` (${waiting})` : '';
    document.dispatchEvent(new CustomEvent('wir:vouchers', { detail: vouchers }));
  }

  // ======================================================================
  // Start, Live-Updates
  // ======================================================================
  async function start() {
    started = true;
    users = await pb.collection('users').getFullList({ fields: 'id,name' }).catch(() => []);
    renderTabs();
    loadVouchers().catch(console.error);
    loadItems().catch(console.error);
    pb.collection('vouchers').subscribe('*', () => loadVouchers().catch(console.error)).catch(console.error);
  }

  document.addEventListener('wir:balance', () => { if (started) { renderShop(); renderGiftBtn(); } });
  document.addEventListener('wir:show', e => {
    if (started && e.detail === 's-shop') { loadItems().catch(console.error); loadVouchers().catch(console.error); }
  });
  // Push "Gutschein" -> Gutschein-Fach
  document.addEventListener('wir:go', e => {
    if (String(e.detail).startsWith('shop')) { shopTab = String(e.detail).endsWith('vouchers') ? 'mine' : 'give'; renderTabs(); }
  });
  document.addEventListener('visibilitychange', () => {
    if (!started || document.hidden || !pb.authStore.isValid) return;
    loadVouchers().catch(console.error);
  });

  document.addEventListener('wir:started', () => { if (!started) start(); });
})();
