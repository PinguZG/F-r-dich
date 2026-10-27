// Poker (Texas Hold'em, nur Spielgeld): zu zweit (Heads-up, asynchron mit Push „Du bist dran“) oder gegen 1–3 KI.
// Alles Wichtige macht der Server (/api/poker…, pb_hooks/poker_lib.js): mischen, austeilen, bewerten, auszahlen.
// Hier wird nur angezeigt; eigene Karten kommen nur über GET /api/poker/{id}, Gegnerkarten erst beim Showdown.
(() => {
  const pb = window.WIR_PB;
  const $ = id => document.getElementById(id);
  const myId = () => (pb.authStore.record || pb.authStore.model)?.id;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const post = (path, body = {}) => pb.send(path, { method: 'POST', body });
  const fmt = n => Number(n).toLocaleString('de-DE');
  const errText = err => err?.response?.message || UI.errText(err);
  const SUIT = { s: '♠', h: '♥', d: '♦', c: '♣' };
  const RANK = { T: '10', J: 'B', Q: 'D', K: 'K', A: 'A' };
  const STREET = { preflop: 'Vor dem Flop', flop: 'Flop', turn: 'Turn', river: 'River', showdown: 'Showdown', over: 'Vorbei' };

  let mode = 'ai', data = null, t = null, busy = false, started = false;
  let bots = 2, buyin = 200;
  try { bots = +localStorage.getItem('wir-poker-bots') || 2; } catch (_) {}

  function card(c) {
    if (!c) { const b = el('div', 'pcard back'); return b; }
    const d = el('div', 'pcard' + (c[1] === 'h' || c[1] === 'd' ? ' red' : ''));
    const tl = el('span', 'pc-corner');
    tl.append(el('b', '', RANK[c[0]] || c[0]), el('i', '', SUIT[c[1]]));
    d.append(tl, el('span', 'pc-suit', SUIT[c[1]]));
    return d;
  }

  async function load() {
    try {
      data = await pb.send('/api/poker', {});
      t = data[mode] || null;
      render();
      hub();
    } catch (err) { $('pkMsg').textContent = errText(err); }
  }
  async function refresh() {
    if (!t) return load();
    try { t = await pb.send('/api/poker/' + t.id, {}); if (t.status === 'done') { t = null; return load(); } render(); hub(); }
    catch (_) { await load(); }
  }

  // ======================================================================
  // Anzeige
  // ======================================================================
  function render() {
    document.querySelectorAll('[data-pkseg]').forEach(b => b.classList.toggle('on', b.dataset.pkseg === mode));
    const waiting = t && t.status === 'waiting';
    $('pkStart').hidden = !!t;
    $('pkWait').hidden = !waiting;
    $('pkTable').hidden = !t || waiting;
    $('pkBots').hidden = mode !== 'ai';
    document.querySelectorAll('#pkBots [data-bots]').forEach(b => b.classList.toggle('on', +b.dataset.bots === bots));
    $('pkLeave').hidden = !t;
    const lim = data?.limits;
    $('pkStartInfo').textContent = lim ? `Platz nehmen: ${lim.buyin.min}–${lim.buyin.max} Coins (Blinds ${lim.sb}/${lim.bb}) · heute noch ${fmt(lim.lossLeft)} Coins Verlust möglich` : '';
    if (waiting) {
      const host = t.p1 === myId();
      $('pkWaitText').textContent = host ? `Warte auf ${window.WIR_LOOK?.partner()?.name || 'deinen Schatz'} … 💌` : `${window.WIR_LOOK?.partner()?.name || 'Dein Schatz'} lädt dich ein – Buy-in ${t.pub?.hostChips || t.buyin} Chips`;
      $('pkJoin').hidden = host;
      return;
    }
    if (!t) return;
    const me = t.me;
    // Gegner oben, ich unten
    const opp = $('pkOpp');
    opp.replaceChildren(...t.seats.map((p, i) => i === me ? null : seat(p, i)).filter(Boolean));
    $('pkBoard').replaceChildren(...[0, 1, 2, 3, 4].map(k => t.board[k] ? card(t.board[k]) : el('div', 'pcard slot')));
    $('pkPot').textContent = `Pot ${fmt(t.pot)}`;
    $('pkStreet').textContent = `Hand ${t.hand} · ${STREET[t.street] || ''}`;
    const mine = t.seats[me];
    $('pkMe').replaceChildren(seat(mine, me, true));
    $('pkHole').replaceChildren(...(t.hole.length ? t.hole.map(card) : [card(null), card(null)]));
    // Ergebnis
    const res = t.result;
    $('pkResult').hidden = !res;
    if (res) { $('pkResult').textContent = res.text; $('pkResult').className = 'bj-banner ' + (res.winners.some(w => w.seat === me) ? 'win' : 'lose'); }
    $('pkNext').hidden = t.street !== 'showdown';
    renderControls();
    $('pkLog').textContent = (t.log || []).slice(-4).join('\n');
  }

  function seat(p, i, mine) {
    const d = el('div', 'pk-seat' + (t.turn === i ? ' turn' : '') + (p.folded ? ' folded' : '') + (p.out ? ' out' : ''));
    const top = el('div', 'pk-who');
    top.append(el('b', '', mine ? 'Du' : p.name), el('small', '', p.bot ? p.bot : (i === t.button ? 'Dealer' : '')));
    if (i === t.button) top.append(el('span', 'pk-dealer', 'D'));
    const chips = el('div', 'pk-chips');
    chips.append(el('span', 'coin'), document.createTextNode(' ' + fmt(p.chips)));
    d.append(top, chips);
    if (!mine) {
      const cs = el('div', 'pk-cards');
      if (p.shown) cs.append(...p.shown.map(card)); else if (p.cards && !p.folded) cs.append(card(null), card(null));
      d.append(cs);
    }
    if (p.bet) d.append(el('div', 'pk-bet', `Einsatz ${fmt(p.bet)}`));
    if (p.allin) d.append(el('div', 'pk-tag', 'All-in'));
    else if (p.folded) d.append(el('div', 'pk-tag', 'Passt'));
    return d;
  }

  function renderControls() {
    const L = t?.legal;
    $('pkActions').hidden = !L;
    $('pkWaitTurn').hidden = !!L || t.street === 'showdown';
    if (!L) { $('pkWaitTurn').textContent = t.turn >= 0 ? `${t.seats[t.turn]?.name || ''} ist dran …` : ''; return; }
    $('pkFold').hidden = !L.fold;
    $('pkCheck').hidden = !L.check;
    $('pkCall').hidden = !L.call;
    $('pkCall').textContent = `Mitgehen ${fmt(L.call)}`;
    const r = L.raise;
    $('pkRaiseBox').hidden = !r;
    if (r) {
      const s = $('pkRaise');
      s.min = r.min; s.max = r.max; s.step = Math.max(1, t.bb / 2);
      if (+s.value < r.min || +s.value > r.max) s.value = r.min;
      $('pkRaiseBtn').textContent = (+s.value >= r.max ? 'All-in ' : (t.curBet ? 'Erhöhen auf ' : 'Setzen ')) + fmt(+s.value);
    }
    document.querySelectorAll('#pkActions button, #pkRaise').forEach(b => { b.disabled = busy; });
  }
  $('pkRaise').addEventListener('input', renderControls);
  document.querySelectorAll('[data-pkquick]').forEach(b => b.addEventListener('click', () => {
    const r = t?.legal?.raise; if (!r) return;
    const q = b.dataset.pkquick, s = $('pkRaise');
    s.value = q === 'all' ? r.max : Math.max(r.min, Math.min(r.max, t.curBet + Math.round(t.pot * (q === 'half' ? 0.5 : 1))));
    renderControls();
  }));

  async function send(type, to) {
    if (busy || !t) return;
    busy = true; renderControls();
    $('pkMsg').textContent = '';
    try { t = await post(`/api/poker/${t.id}/act`, { type, to, v: t.v }); }
    catch (err) { $('pkMsg').textContent = errText(err); await refresh(); }
    busy = false;
    render(); hub();
    if (t?.result?.winners?.some(w => w.seat === t.me)) { const b = $('pkTable').getBoundingClientRect(); UI.burst(b.left + b.width / 2, b.top + 80, 18); }
  }
  $('pkFold').addEventListener('click', () => send('fold'));
  $('pkCheck').addEventListener('click', () => send('check'));
  $('pkCall').addEventListener('click', () => send('call'));
  $('pkRaiseBtn').addEventListener('click', () => send('raise', +$('pkRaise').value));

  $('pkNext').addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    try { t = await post(`/api/poker/${t.id}/next`, { v: t.v }); if (t.status === 'done') { $('pkMsg').textContent = 'Der Tisch ist zu Ende – Chips sind ausgezahlt 💗'; t = null; await load(); } }
    catch (err) { $('pkMsg').textContent = errText(err); await refresh(); }
    busy = false;
    render(); hub();
  });

  $('pkNew').addEventListener('click', async () => {
    const lim = data?.limits;
    const amt = Math.min(lim?.buyin.max || 200, Math.max(lim?.buyin.min || 50, Math.min(buyin, window.WIR_COINS?.balance() ?? buyin, lim?.lossLeft ?? buyin)));
    if (!confirm(`Platz nehmen für ${amt} Coins?\n\nDu bekommst ${amt} Chips. Beim Aufstehen werden deine Chips 1:1 zurück in Coins getauscht.\nGuthaben: ${fmt(window.WIR_COINS?.balance() ?? 0)}`)) return;
    try { t = await post('/api/poker/new', { mode, bots, buyin: amt }); window.WIR_COINS?.loadMe?.(); $('pkMsg').textContent = ''; }
    catch (err) { $('pkMsg').textContent = errText(err); }
    render(); hub();
  });
  $('pkJoin').addEventListener('click', async () => {
    const amt = Math.min(200, window.WIR_COINS?.balance() ?? 200);
    if (!confirm(`Platz nehmen für ${amt} Coins? Beim Aufstehen werden die Chips zurückgetauscht.`)) return;
    try { t = await post(`/api/poker/${t.id}/join`, { buyin: amt }); window.WIR_COINS?.loadMe?.(); }
    catch (err) { $('pkMsg').textContent = errText(err); }
    render(); hub();
  });
  $('pkLeave').addEventListener('click', async () => {
    if (!t || !confirm(t.status === 'waiting' ? 'Einladung zurückziehen?' : 'Aufstehen? Eine laufende Hand gilt als gepasst, deine Chips werden ausgezahlt.')) return;
    try { await post(`/api/poker/${t.id}/leave`); window.WIR_COINS?.loadMe?.(); t = null; $('pkMsg').textContent = 'Aufgestanden – Chips ausgezahlt 💗'; await load(); }
    catch (err) { $('pkMsg').textContent = errText(err); }
  });
  document.querySelectorAll('[data-pkseg]').forEach(b => b.addEventListener('click', () => { mode = b.dataset.pkseg; t = data?.[mode] || null; render(); }));
  document.querySelectorAll('#pkBots [data-bots]').forEach(b => b.addEventListener('click', () => {
    bots = +b.dataset.bots; try { localStorage.setItem('wir-poker-bots', bots); } catch (_) {}
    render();
  }));
  // Karten in der Übersicht öffnen den passenden Modus
  document.querySelectorAll('[data-poker-mode]').forEach(b => b.addEventListener('click', () => { mode = b.dataset.pokerMode; }, true));

  // ======================================================================
  // Übersicht + „Wer ist dran?“
  // ======================================================================
  let wasTurn = false;
  function hub() {
    const duo = data?.duo, ai = data?.ai;
    const duoMine = mode === 'duo' && t ? t : duo;
    const myTurn = !!(duoMine && duoMine.legal) || !!(duo && duo.status === 'waiting' && duo.p1 !== myId());
    window.WIR_BADGE?.('gbPokerAi', ai ? 'Läuft' : '', ai ? 'run' : '');
    if (myTurn !== wasTurn) document.dispatchEvent(new CustomEvent('wir:turn', { detail: { k: 'poker', on: myTurn, waiting: !!duo && !myTurn } }));
    wasTurn = myTurn;
  }

  document.addEventListener('wir:show', e => {
    if (!started) return;
    if (e.detail === 's-poker') { $('pkMsg').textContent = ''; load(); }
    if (e.detail === 's-games') load();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && started) load(); });
  document.addEventListener('wir:started', () => {
    started = true;
    load();
    pb.collection('poker_tables').subscribe('*', () => { if (!busy) (data?.[mode] && t ? refresh() : load()).catch?.(() => {}); }).catch(() => {});
  });
})();
