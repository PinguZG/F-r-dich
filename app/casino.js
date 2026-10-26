// Casino (nur Spielgeld): Blackjack. Karten, Zufall und Abrechnung macht der Server (/api/casino/bj…, pb_hooks/wir_casino.pb.js),
// hier wird nur angezeigt und animiert. Nutzt die PocketBase-Verbindung von app.js.
(() => {
  const pb = window.WIR_PB;
  pb.autoCancellation(false);

  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const fmt = n => Number(n).toLocaleString('de-DE');
  const post = (path, body = {}) => pb.send(path, { method: 'POST', body });
  const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 12));
  function errText(err) {
    const d = err?.response?.data;
    if (d && Object.keys(d).length) return Object.values(d).map(v => v.message || JSON.stringify(v)).join(', ');
    return err?.response?.message || err?.message || 'Hat nicht geklappt';
  }

  const STEP = 260; // ms zwischen zwei Karten

  // ======================================================================
  // Karten
  // ======================================================================
  const SUIT = { S: '♠', H: '♥', D: '♦', C: '♣' };
  const RANK = { T: '10', J: 'B', Q: 'D', K: 'K', A: 'A' }; // deutsche Bilder: Bube, Dame, König

  function cardEl(c) {
    if (c === '??') { const b = el('div', 'pcard back'); b.setAttribute('aria-label', 'verdeckte Karte'); return b; }
    const r = RANK[c[0]] || c[0], s = SUIT[c[1]];
    const d = el('div', 'pcard' + (c[1] === 'H' || c[1] === 'D' ? ' red' : ''));
    d.setAttribute('aria-label', r + ' ' + s);
    const tl = el('span', 'pc-corner');
    tl.append(el('b', '', r), el('i', '', s));
    d.append(tl, el('span', 'pc-suit', s));
    return d;
  }

  const scoreText = (sc, live) => (live && sc.soft && sc.total < 21 ? `${sc.total - 10}/${sc.total}` : String(sc.total));

  // ======================================================================
  // Zustand + Anzeige
  // ======================================================================
  let data = null;          // letzte Server-Antwort { round, balance, limits }
  let shown = new Map();    // Position -> Karte (für Animationen)
  let shownRound = '';
  let busy = false;
  let bet = (() => { try { return +localStorage.getItem('wir-bj-bet') || 10; } catch (_) { return 10; } })();

  function render(animate = true) {
    const r = data?.round;
    if (r?.id !== shownRound) { shown = new Map(); shownRound = r?.id || ''; }
    let delay = 0;
    const place = (box, key, c) => {
      const prev = shown.get(key);
      const node = cardEl(c);
      if (animate && prev === undefined) { node.classList.add('deal'); node.style.animationDelay = delay + 'ms'; delay += STEP; }
      else if (animate && prev === '??' && c !== '??') { node.classList.add('flip'); node.style.animationDelay = delay + 'ms'; delay += STEP + 120; }
      shown.set(key, c);
      box.append(node);
    };

    const live = r && r.phase === 'player';
    $('bjEmpty').hidden = !!r;
    $('bjTable').classList.toggle('over', !!r && !live);

    // Dealer
    const dBox = $('bjDealer');
    dBox.replaceChildren();
    if (r) r.dealer.forEach((c, i) => place(dBox, 'd' + i, c));
    $('bjDealerScore').textContent = r ? scoreText(r.dealerScore, live) : '';

    // Hände (bei zwei Händen nebeneinander)
    const hBox = $('bjHands');
    hBox.replaceChildren();
    hBox.classList.toggle('two', !!r && r.hands.length > 1);
    if (r) r.hands.forEach((h, i) => {
      const w = el('div', 'bj-hand');
      if (live && r.hands.length > 1 && i === r.active) w.classList.add('active');
      const cards = el('div', 'bj-cards');
      h.cards.forEach((c, j) => place(cards, `h${i}-${j}`, c));
      const info = el('div', 'bj-label');
      info.append(el('span', 'bj-score', scoreText(h.score, live && !h.done)));
      const chip = el('span', 'bj-stake');
      chip.append(el('span', 'coin'), document.createTextNode(fmt(h.bet) + (h.doubled ? ' ×2' : '')));
      info.append(chip);
      if (h.result) info.append(el('span', 'bj-res ' + h.result, { blackjack: 'Blackjack!', win: 'Gewonnen', push: 'Unentschieden', lose: 'Verloren', bust: 'Über 21' }[h.result]));
      w.append(cards, info);
      hBox.append(w);
    });

    // Ergebnis erst zeigen, wenn alle Karten liegen
    const banner = $('bjBanner');
    banner.hidden = true;
    clearTimeout(render.t);
    if (r && r.phase === 'done') {
      const net = r.payout - r.bet;
      const bj = r.hands.some(h => h.result === 'blackjack');
      banner.className = 'bj-banner ' + (net > 0 ? 'win' : net === 0 ? 'push' : 'lose');
      banner.textContent = net > 0 ? `${bj ? 'Blackjack! ✨' : 'Gewonnen! 💗'} +${fmt(net)}` : net === 0 ? 'Unentschieden – Einsatz zurück' : `Verloren −${fmt(-net)}`;
      render.t = setTimeout(() => {
        banner.hidden = false;
        if (animate && net > 0) { const b = banner.getBoundingClientRect(); UI.burst(b.left + b.width / 2, b.top + b.height / 2, bj ? 24 : 14); }
      }, animate ? delay + 150 : 0);
    }

    renderControls(live);
  }

  function maxBet() {
    if (!data) return 100;
    const l = data.limits;
    return Math.min(l.max, data.balance, l.lossLeft);
  }

  function renderControls(live) {
    $('bjBetBox').hidden = live;
    $('bjActions').hidden = !live;
    const l = data?.limits || { min: 5, max: 100, lossLeft: 300 };
    // Guthaben steht oben rechts im Kopf (Coins-Chip), hier nur falls vorhanden
    $('bjBal')?.replaceChildren(el('span', 'coin'), document.createTextNode(data ? fmt(data.balance) : '…'));
    const top = maxBet();
    bet = Math.max(l.min, Math.min(bet, top));
    $('bjBet').textContent = fmt(bet);
    const canPlay = top >= l.min;
    $('bjDeal').disabled = busy || !canPlay;
    $('bjDeal').textContent = !canPlay
      ? (data && data.limits.lossLeft < l.min ? 'Tageslimit erreicht – morgen wieder 💗' : 'Zu wenig Heart Coins')
      : (data?.round?.phase === 'done' ? `Nochmal · ${fmt(bet)}` : `Austeilen · ${fmt(bet)}`);
    $('bjChips').querySelectorAll('button').forEach(b => { b.disabled = busy || bet + +b.dataset.v > top; });
    $('bjNote').textContent = `Spielgeld – kein echtes Geld · Einsatz ${l.min}–${l.max} · heute noch ${fmt(l.lossLeft)} Coins Verlust möglich`;

    if (live) {
      const r = data.round, h = r.hands[r.active];
      const afford = data.balance >= h.bet && l.lossLeft >= h.bet;
      document.querySelectorAll('.bj-act').forEach(b => {
        const a = b.dataset.act;
        b.hidden = (a === 'double' || a === 'split') && !r.allowed[a];
        b.disabled = busy || !r.allowed[a] || ((a === 'double' || a === 'split') && !afford);
      });
    }
  }

  // Chips 5 / 10 / 25 / 50 / 100
  [5, 10, 25, 50, 100].forEach(v => {
    const b = el('button', 'bj-chip c' + v, String(v));
    b.type = 'button';
    b.dataset.v = v;
    b.addEventListener('click', () => {
      const fresh = $('bjBetBox').dataset.fresh === '1';
      bet = fresh ? v : bet + v;      // erster Chip nach einer Runde ersetzt den Einsatz
      $('bjBetBox').dataset.fresh = '0';
      renderControls(false);
    });
    $('bjChips').append(b);
  });
  $('bjClear').addEventListener('click', () => { bet = data?.limits.min || 5; $('bjBetBox').dataset.fresh = '1'; renderControls(false); });

  function apply(res, animate = true) {
    data = res;
    render(animate);
    // Kontostand im Chip oben erst, wenn das Ergebnis zu sehen ist
    const later = res.round?.phase === 'done' && animate ? 900 : 0;
    setTimeout(() => window.WIR_COINS?.setBalance(res.balance), later);
  }

  async function load() {
    try {
      const res = await pb.send('/api/casino/bj', {});
      // beim Öffnen nichts nachanimieren
      data = res;
      shownRound = res.round?.id || '';
      shown = new Map();
      if (res.round) {
        res.round.dealer.forEach((c, i) => shown.set('d' + i, c));
        res.round.hands.forEach((h, i) => h.cards.forEach((c, j) => shown.set(`h${i}-${j}`, c)));
      }
      render(false);
      $('bjBetBox').dataset.fresh = '1';
    } catch (err) { $('bjMsg').textContent = errText(err); }
  }

  let dealKey = '';
  $('bjDeal').addEventListener('click', async () => {
    if (busy) return;
    busy = true; renderControls(false);
    $('bjMsg').textContent = '';
    try { localStorage.setItem('wir-bj-bet', String(bet)); } catch (_) {}
    dealKey = dealKey || newKey();
    try {
      const res = await post('/api/casino/bj/start', { bet, key: dealKey });
      dealKey = '';
      $('bjBetBox').dataset.fresh = '1';
      busy = false;
      apply(res);
    } catch (err) {
      busy = false;
      if (err?.status !== 0) dealKey = ''; // bei Netzwerkfehler denselben Schlüssel nochmal (keine Doppelrunde)
      $('bjMsg').textContent = errText(err);
      if (err?.status === 409) await load(); else renderControls(false);
    }
  });

  document.querySelectorAll('.bj-act').forEach(b => b.addEventListener('click', async () => {
    const r = data?.round;
    if (busy || !r || r.phase !== 'player') return;
    busy = true; renderControls(true);
    $('bjMsg').textContent = '';
    try {
      const res = await post(`/api/casino/bj/${r.id}/act`, { action: b.dataset.act, v: r.v });
      busy = false;
      apply(res);
    } catch (err) {
      busy = false;
      $('bjMsg').textContent = errText(err);
      await load();
    }
  }));

  // ======================================================================
  // Navigation
  // ======================================================================
  // Spiele-Übersicht: Blackjack-Karte (laufende Runde, Tagespause)
  async function loadInfo() {
    if (!pb.authStore.isValid) return;
    try {
      const res = await pb.send('/api/casino/bj', {});
      const l = res.limits, live = res.round?.phase === 'player';
      $('gcBjStatus').textContent = l.lossLeft < l.min ? 'Pause bis morgen 💗' : `Einsatz ${l.min}–${l.max}`;
      window.WIR_BADGE?.('gbBj', live ? 'Läuft' : '', live ? 'run' : '');
    } catch (_) { /* offline */ }
  }

  document.addEventListener('wir:show', e => {
    if (e.detail === 's-bj') { $('bjMsg').textContent = ''; load(); }
    if (e.detail === 's-games') loadInfo();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && $('s-bj').classList.contains('active') && !busy) load();
  });
})();
