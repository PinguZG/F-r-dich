// Herzstadt – Oberfläche. Regeln + Würfeln laufen auf dem Server (pb_hooks/mono.js, gleiche Datei wie /lib/mono.js),
// hier wird nur angezeigt und die Aktion an /api/games/mono/{id}/act geschickt.
(() => {
  const pb = window.WIR_PB || new PocketBase(window.location.origin);
  pb.autoCancellation(false);
  const M = window.Mono;
  const B = M.BOARD;

  const $ = id => document.getElementById(id);
  const myId = () => (pb.authStore.record || pb.authStore.model)?.id;
  let started = false;
  let users = [];
  let games = [];      // alle Partien (für Bilanz/Verlauf)
  let g = null;        // aktuelle Partie
  let busy = false;
  const shownPos = [0, 0];   // angezeigte Positionen (für das Laufen der Figuren)
  let stepTimer = null;

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  function errText(err) {
    const d = err?.response?.data;
    if (d && Object.keys(d).length) return Object.entries(d).map(([k, v]) => k + ': ' + (v.message || JSON.stringify(v))).join(', ');
    return err?.response?.message || err?.message || 'unbekannter Fehler';
  }
  const eur = n => n.toLocaleString('de-DE') + ' €';
  const pad2 = n => String(n).padStart(2, '0');
  const fmtDay = s => { const d = new Date(String(s).replace(' ', 'T')); return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.`; };
  const userById = id => users.find(u => u.id === id);
  const partner = () => users.find(u => u.id !== myId());
  const pname = () => partner()?.name || 'Schatz';

  // Spieler-Index 0/1 -> Nutzer
  const ids = () => g ? [g.p1, g.p2] : [];
  const meIdx = () => ids().indexOf(myId());
  const S = () => g?.state;
  const nameOf = p => p === meIdx() ? 'Du' : userById(ids()[p])?.name || pname();
  const colorOf = p => {
    const h = window.WIR_HEARTS || { me: '#ff5fa2', partner: '#3b9eff' };
    return p === meIdx() ? h.me : h.partner;
  };
  const amWaiting = () => !!g && g.status === 'active' && M.waiting(S()).includes(meIdx());

  function avatar(u) {
    const a = el('span', 'avatar');
    a.textContent = (u?.name || '?').charAt(0).toUpperCase();
    if (u?.avatar) { a.style.backgroundImage = `url("${pb.files.getURL(u, u.avatar, { thumb: '200x200' })}")`; a.classList.add('has'); }
    return a;
  }

  // ======================================================================
  // Laden
  // ======================================================================
  async function load() {
    const [us, list] = await Promise.all([
      pb.collection('users').getFullList({ fields: 'id,name,avatar,collectionId,collectionName' }),
      pb.collection('mono_games').getFullList({ sort: '-created', fields: 'id,p1,p2,status,winner,created,updated' }),
    ]);
    users = us;
    games = list;
    const cur = games.find(x => x.status === 'active');
    const prev = g;
    g = cur ? await pb.collection('mono_games').getOne(cur.id) : null;
    if (g && (!prev || prev.id !== g.id)) { shownPos[0] = S().players[0].pos; shownPos[1] = S().players[1].pos; }
    render();
  }

  // ======================================================================
  // Brett
  // ======================================================================
  // Feld i -> Zeile/Spalte im 11×11-Raster (Los unten rechts, dann im Uhrzeigersinn)
  function cellPos(i) {
    if (i <= 10) return { r: 11, c: 11 - i, side: 'b' };
    if (i <= 20) return { r: 11 - (i - 10), c: 1, side: 'l' };
    if (i <= 30) return { r: 1, c: 1 + (i - 20), side: 't' };
    return { r: 1 + (i - 30), c: 11, side: 'r' };
  }

  function renderBoard() {
    const s = S();
    const cells = [];
    for (let i = 0; i < 40; i++) {
      const f = B[i], p = cellPos(i);
      const b = el('button', `mo-cell side-${p.side}` + ([0, 10, 20, 30].includes(i) ? ' corner' : ''));
      b.type = 'button';
      b.dataset.i = i;
      b.style.gridRow = p.r;
      b.style.gridColumn = p.c;
      if (f.t === 'street') { const strip = el('i', 'strip'); strip.style.background = M.GROUPS[f.g].color; b.append(strip); }
      b.append(el('span', 'e', f.e));
      const owner = s?.own[i];
      if (owner != null) {
        const o = el('i', 'own');
        o.style.background = colorOf(owner);
        b.append(o);
        if (s.mort[i]) b.classList.add('mort');
      }
      const h = s ? M.houses(s, i) : 0;
      if (h) {
        const hs = el('span', 'hs' + (h === 5 ? ' hotel' : ''));
        for (let k = 0; k < (h === 5 ? 1 : h); k++) hs.append(el('i'));
        hs.setAttribute('aria-label', h === 5 ? 'Hotel' : h + ' Häuser');
        b.append(hs);
      }
      if (s) [0, 1].forEach(pl => {
        if (shownPos[pl] === i) {
          const t = el('span', 'tok tok' + pl);
          t.style.background = colorOf(pl);
          if (s.players[pl].jail && i === 10) t.classList.add('jailed');
          b.append(t);
        }
      });
      if (s?.pend?.f === i && (s.phase === 'buy' || s.phase === 'auction')) b.classList.add('focus');
      b.setAttribute('aria-label', f.n);
      cells.push(b);
    }
    cells.push(renderCenter());
    $('moBoard').replaceChildren(...cells);
  }

  function die(n) {
    const d = el('span', 'die');
    const on = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }[n] || [];
    for (let k = 0; k < 9; k++) d.append(el('i', on.includes(k) ? 'pip' : ''));
    return d;
  }

  function renderCenter() {
    const s = S();
    const c = el('div', 'mo-center');
    c.append(el('div', 'mo-title', 'Herzstadt'));
    if (s?.dice) {
      const dice = el('div', 'mo-dice' + (rolledNow ? ' roll' : ''));
      dice.append(die(s.dice[0]), die(s.dice[1]));
      c.append(dice);
    }
    c.append(el('div', 'mo-state', statusText()));
    const card = s?.card;
    if (card && Date.now() - card.t < 6 * 3600000) {
      const k = el('div', 'mo-card ' + (card.d === 'c' ? 'chance' : 'chest'));
      k.append(el('b', '', card.d === 'c' ? '🎁 Überraschung' : '💌 Liebesbrief'), el('span', '', M.DECKS[card.d][card.i].x));
      c.append(k);
    }
    return c;
  }
  let rolledNow = false;

  function statusText() {
    const s = S();
    if (!s) return '';
    const me = meIdx();
    if (s.winner != null) return s.winner === me ? 'Du hast gewonnen! 🎉' : `${pname()} hat gewonnen`;
    const who = s.turn === me ? 'Du bist' : `${pname()} ist`;
    switch (s.phase) {
      case 'roll': return s.players[s.turn].jail ? `${who} im Gefängnis 🔒` : `${who} am Zug 🎲`;
      case 'buy': return `${B[s.pend.f].e} ${B[s.pend.f].n} – kaufen?`;
      case 'auction': return `🔨 Versteigerung: ${B[s.pend.f].n}`;
      case 'debt': return s.pend.who === me ? 'Du musst zahlen ⚠️' : `${pname()} muss zahlen`;
      case 'end': return s.turn === me ? 'Zug beenden' : `${pname()} ist noch dran`;
      default: return '';
    }
  }

  // Figuren Feld für Feld laufen lassen
  function animateTokens() {
    clearTimeout(stepTimer);
    const s = S();
    if (!s) return;
    let moving = false;
    [0, 1].forEach(p => {
      const target = s.players[p].pos;
      if (shownPos[p] === target) return;
      const ahead = (target - shownPos[p] + 40) % 40;
      if (ahead > 12 || UI.reduced()) shownPos[p] = target;   // Sprung (z. B. Gefängnis, 3 zurück)
      else { shownPos[p] = (shownPos[p] + 1) % 40; moving = true; }
    });
    renderBoard();
    if (moving) stepTimer = setTimeout(animateTokens, 140);
  }

  // ======================================================================
  // Spieler, Aktionen, Grundstücke, Verlauf
  // ======================================================================
  function renderPlayers() {
    const s = S();
    const wait = M.waiting(s);
    $('moPlayers').replaceChildren(...[meIdx(), 1 - meIdx()].map(p => {
      const pl = s.players[p];
      const d = el('div', 'mo-pl' + (wait.includes(p) ? ' turn' : ''));
      d.style.setProperty('--pc', colorOf(p));
      const info = el('div', 'mo-pl-info');
      info.append(el('b', '', nameOf(p)), el('span', 'mo-cash', eur(pl.cash)));
      const extra = el('small', '', [
        pl.jail ? '🔒 im Gefängnis' : '',
        pl.cards.length ? `🔓×${pl.cards.length}` : '',
        `Vermögen ${eur(M.worth(s, p))}`,
      ].filter(Boolean).join(' · '));
      info.append(extra);
      d.append(avatar(userById(ids()[p])), info);
      return d;
    }));
  }

  function btn(label, cls, onClick, disabled) {
    const b = el('button', cls, label);
    b.type = 'button';
    b.disabled = !!disabled;
    b.addEventListener('click', onClick);
    return b;
  }

  function renderActions() {
    const s = S(), me = meIdx(), box = $('moActions');
    const pl = s.players[me];
    const items = [];
    if (s.winner != null) { box.replaceChildren(); return; }
    if (s.phase === 'auction') {
      const f = B[s.pend.f];
      if (s.pend.bids[me] == null) {
        const row = el('div', 'mo-bid');
        const inp = el('input', 'mem-input');
        inp.type = 'number'; inp.min = 0; inp.max = pl.cash; inp.inputMode = 'numeric'; inp.placeholder = 'Dein Gebot (0 = passen)';
        row.append(inp, btn('Bieten 🔨', 'mem-btn', () => act({ type: 'bid', amount: Math.floor(+inp.value || 0) })));
        items.push(el('p', 'mo-hint', `${f.e} ${f.n} (Listenpreis ${eur(f.p)}). Verdeckt bieten – ${pname()} sieht dein Gebot erst am Ende. Du hast ${eur(pl.cash)}.`), row);
      } else items.push(el('p', 'mo-hint', `Dein Gebot (${eur(s.pend.bids[me])}) ist abgegeben – warte auf ${pname()} 💭`));
    } else if (s.phase === 'debt') {
      if (s.pend.who === me) {
        const pd = s.pend;
        items.push(el('p', 'mo-hint', `Du musst ${eur(pd.amt)} zahlen (${pd.why}), hast aber nur ${eur(pl.cash)}. Tippe unten deine Grundstücke an: Häuser verkaufen oder Hypothek aufnehmen. Möglich wären insgesamt ${eur(M.raisable(s, me))}.`));
        items.push(btn(`Bezahlen (${eur(pd.amt)})`, 'mem-btn', () => act({ type: 'pay' }), pl.cash < pd.amt));
        if (M.raisable(s, me) < pd.amt) items.push(btn('Pleite – aufgeben 🏳️', 'pack-btn', () => resign()));
      } else items.push(el('p', 'mo-hint', `${pname()} muss erst Geld auftreiben …`));
    } else if (s.turn !== me) {
      items.push(el('p', 'mo-hint', `${pname()} ist dran – du bekommst eine Nachricht, wenn du wieder würfeln darfst 💗`));
    } else if (s.phase === 'roll') {
      items.push(btn('🎲 Würfeln', 'mem-btn mo-roll', () => act({ type: 'roll' })));
      if (pl.jail) {
        const row = el('div', 'row');
        row.append(btn('50 € zahlen', 'pack-btn', () => act({ type: 'jailpay' }), pl.cash < 50));
        if (pl.cards.length) row.append(btn('🔓 Karte nutzen', 'pack-btn', () => act({ type: 'jailcard' })));
        items.push(row, el('p', 'mo-hint', `Im Gefängnis: Pasch würfeln, 50 € zahlen oder Karte nutzen. Versuch ${pl.jail}/3.`));
      }
    } else if (s.phase === 'buy') {
      const f = B[s.pend.f];
      const row = el('div', 'row');
      row.append(btn(`Kaufen (${eur(f.p)})`, 'mem-btn', () => act({ type: 'buy' }), pl.cash < f.p),
        btn('Versteigern', 'pack-btn', () => act({ type: 'decline' })));
      items.push(el('p', 'mo-hint', `${f.e} ${f.n} gehört noch niemandem. ${f.t === 'street' ? 'Miete ab ' + eur(f.r[0]) : ''}`), row);
      items.push(btn('Details ansehen', 'link-btn', () => openField(s.pend.f)));
    } else if (s.phase === 'end') {
      items.push(btn('Zug beenden ✓', 'mem-btn', () => act({ type: 'end' })));
    }
    box.replaceChildren(...items);
  }

  function renderTrade() {
    const s = S(), me = meIdx(), t = s.trade, box = $('moTradeBox');
    box.hidden = !t;
    $('moTradeBtn').disabled = !!t || s.phase === 'auction' || s.winner != null;
    if (!t) return;
    const fromMe = t.from === me;
    const head = el('b', '', fromMe ? `🤝 Dein Angebot an ${pname()}` : `🤝 ${pname()} möchte tauschen`);
    const give = el('p', '', `${fromMe ? 'Du gibst' : pname() + ' gibt'}: ${M.tradeText(t.give)}`);
    const get = el('p', '', `${fromMe ? 'Du bekommst' : 'Du gibst'}: ${M.tradeText(t.get)}`);
    const row = el('div', 'row');
    if (fromMe) row.append(btn('Zurückziehen', 'pack-btn', () => act({ type: 'trade_cancel' })));
    else row.append(btn('Ablehnen', 'pack-btn', () => act({ type: 'trade_decline' })), btn('Annehmen 🤝', 'mem-btn', () => act({ type: 'trade_accept' })));
    box.replaceChildren(head, give, get, row);
  }

  function renderMine() {
    const s = S(), me = meIdx();
    const mine = Object.keys(s.own).map(Number).filter(i => s.own[i] === me).sort((a, b) => a - b);
    if (!mine.length) { $('moMine').replaceChildren(el('div', 'empty-note', 'Noch keine Grundstücke')); return; }
    $('moMine').replaceChildren(...mine.map(i => {
      const f = B[i];
      const b = el('button', 'mo-prop' + (s.mort[i] ? ' mort' : ''));
      b.type = 'button';
      b.style.setProperty('--gc', f.t === 'street' ? M.GROUPS[f.g].color : 'var(--ink-faint)');
      const h = M.houses(s, i);
      b.append(el('span', 'e', f.e), el('b', '', f.n),
        el('small', '', s.mort[i] ? 'Hypothek' : h === 5 ? '🏨 Hotel' : h ? '⌂'.repeat(h) : f.t === 'street' && M.ownsGroup(s, me, f.g) ? 'ganze Gruppe ✓' : ''));
      b.addEventListener('click', () => openField(i));
      return b;
    }));
  }

  function renderLog() {
    const s = S();
    $('moLog').replaceChildren(...s.log.slice(-40).reverse().map(l => el('p', '', l.m)));
  }

  function renderNone() {
    const done = games.filter(x => x.status !== 'active').slice(0, 8);
    $('moHist').replaceChildren(...done.map(x => {
      const row = el('div', 'date');
      const won = x.winner === myId();
      row.append(el('span', 'ico', won ? '🏆' : '💗'));
      const d = el('div');
      d.append(el('b', '', won ? 'Du hast gewonnen' : `${userById(x.winner)?.name || pname()} hat gewonnen`), el('small', '', fmtDay(x.updated)));
      row.append(d);
      return row;
    }));
  }

  function render() {
    renderHub();
    $('moNone').hidden = !!g;
    $('moGame').hidden = !g;
    if (!g) { renderNone(); return; }
    renderPlayers();
    renderActions();
    renderTrade();
    renderMine();
    renderLog();
    animateTokens();
  }

  function renderHub() {
    if (!started) return;
    let st = 'Neue Partie starten';
    if (g) {
      const s = S();
      if (s.trade && s.trade.from !== meIdx()) st = `🤝 ${pname()} möchte tauschen`;
      else if (amWaiting()) st = s.phase === 'auction' ? '🔨 Dein Gebot fehlt' : s.phase === 'debt' ? '⚠️ Du musst zahlen' : 'Du bist am Zug';
      else st = `${pname()} ist dran`;
      st += ` · ${eur(s.players[meIdx()].cash)}`;
    }
    $('gcMonoStatus').textContent = st;
    $('gcMonoStatus').classList.toggle('hot', amWaiting());
    const done = games.filter(x => x.status !== 'active');
    const tiles = [
      { l: 'DU', v: done.filter(x => x.winner === myId()).length, t: 'me' },
      { l: 'PARTIEN', v: done.length, t: 'mid' },
      { l: pname().toUpperCase(), v: done.filter(x => x.winner && x.winner !== myId()).length, t: 'them' },
    ];
    $('gcMonoTiles').replaceChildren(...tiles.map(t => { const d = el('div', 'score-tile ' + t.t); d.append(el('b', '', String(t.v)), el('small', '', t.l)); return d; }));
    const dot = $('navGameDot');
    dot.dataset.m = amWaiting() || (g && S().trade && S().trade.from !== meIdx()) ? '1' : '';
    dot.hidden = !(dot.dataset.g || dot.dataset.m);
  }

  // ======================================================================
  // Feld-Details
  // ======================================================================
  function openField(i) {
    const s = S(), me = meIdx(), f = B[i];
    const body = $('moFieldBody');
    const head = el('div', 'mo-fh');
    head.style.background = f.t === 'street' ? M.GROUPS[f.g].color : 'var(--chip)';
    head.append(el('span', 'e', f.e), el('b', '', f.n));
    const x = el('button', 'sheet-x', '✕'); x.type = 'button'; x.dataset.close = ''; x.setAttribute('aria-label', 'Schließen');
    const parts = [el('div', 'sheet-grip'), x, head];
    const rows = [];
    const row = (a, b, strong) => { const r = el('div', 'mo-row' + (strong ? ' strong' : '')); r.append(el('span', '', a), el('b', '', b)); rows.push(r); };
    const owner = s?.own[i];
    if (M.isProp(i)) {
      row('Kaufpreis', eur(f.p));
      if (f.t === 'street') {
        const h = M.houses(s, i);
        row('Miete', eur(f.r[0]), h === 0 && !(owner != null && M.ownsGroup(s, owner, f.g)));
        row('… mit ganzer Farbgruppe', eur(f.r[0] * 2), h === 0 && owner != null && M.ownsGroup(s, owner, f.g));
        for (let k = 1; k <= 4; k++) row(`… mit ${k} ${k === 1 ? 'Haus' : 'Häusern'}`, eur(f.r[k]), h === k);
        row('… mit Hotel', eur(f.r[5]), h === 5);
        row('Haus / Hotel kostet', eur(f.h));
      } else if (f.t === 'station') {
        [1, 2, 3, 4].forEach(k => row(`${k} Bahnhof${k > 1 ? 'e' : ''}`, eur(M.STATION_RENT[k])));
      } else {
        row('1 Werk', '4× Augenzahl'); row('beide Werke', '10× Augenzahl');
      }
      row('Hypothekwert', eur(M.mortgageValue(i)));
      row('Besitz', owner == null ? 'Bank' : owner === me ? 'Du' + (s.mort[i] ? ' (Hypothek)' : '') : pname() + (s.mort[i] ? ' (Hypothek)' : ''), true);
    } else {
      const info = {
        go: 'Jedes Mal, wenn du hier vorbeikommst, gibt es 200 €.',
        chest: 'Zieh einen Liebesbrief 💌.', chance: 'Zieh eine Überraschung 🎁.',
        tax: `Zahle ${f.amt ? eur(f.amt) : ''} an die Bank.`, jail: 'Nur zu Besuch – oder eben drin 🔒.',
        parking: 'Einfach ausruhen. Hier passiert nichts.', gojail: 'Ab ins Gefängnis, ohne über Los zu gehen.',
      }[f.t];
      rows.push(el('p', 'mem-note', info || ''));
    }
    parts.push(...rows);

    // eigene Grundstücke: bauen, verkaufen, Hypothek
    if (s && g.status === 'active' && owner === me && M.isProp(i)) {
      const acts = el('div', 'mo-field-acts');
      const h = M.houses(s, i);
      if (f.t === 'street') {
        const full = M.ownsGroup(s, me, f.g);
        if (full && h < 5 && !s.mort[i]) acts.append(btn(h === 4 ? `🏨 Hotel bauen (${eur(f.h)})` : `🏠 Haus bauen (${eur(f.h)})`, 'mem-btn', () => fieldAct('build', i)));
        if (h > 0) acts.append(btn(`${h === 5 ? 'Hotel' : 'Haus'} verkaufen (+${eur(f.h / 2)})`, 'pack-btn', () => fieldAct('sell', i)));
        if (!full) acts.append(el('p', 'mem-note', 'Zum Bauen brauchst du alle Straßen dieser Farbe.'));
      }
      if (!s.mort[i] && !M.groupHasHouses(s, i)) acts.append(btn(`🏦 Hypothek aufnehmen (+${eur(M.mortgageValue(i))})`, 'pack-btn', () => fieldAct('mortgage', i)));
      if (s.mort[i]) acts.append(btn(`🏦 Hypothek ablösen (−${eur(M.unmortgageCost(i))})`, 'pack-btn', () => fieldAct('unmortgage', i)));
      acts.append(el('div', 'mem-status', ''));
      parts.push(acts);
    }
    body.replaceChildren(...parts);
    UI.sheet('moFieldSheet');
  }
  async function fieldAct(type, i) {
    const ok = await act({ type, field: i }, $('moFieldBody').querySelector('.mo-field-acts .mem-status'));
    if (ok && !$('moFieldSheet').hidden) openField(i);
  }
  $('moBoard').addEventListener('click', e => {
    const c = e.target.closest('.mo-cell');
    if (c) openField(+c.dataset.i);
  });

  // ======================================================================
  // Tauschen
  // ======================================================================
  function tradeList(box, owner) {
    const s = S();
    const fields = Object.keys(s.own).map(Number).filter(i => s.own[i] === owner).sort((a, b) => a - b);
    if (!fields.length) { box.replaceChildren(el('small', 'mo-none', 'keine Grundstücke')); return; }
    box.replaceChildren(...fields.map(i => {
      const l = el('label', 'mo-tr-item');
      const c = el('input'); c.type = 'checkbox'; c.value = i;
      c.disabled = M.groupHasHouses(s, i);
      const dot = el('i'); dot.style.background = B[i].t === 'street' ? M.GROUPS[B[i].g].color : 'var(--ink-faint)';
      l.append(c, dot, el('span', '', `${B[i].e} ${B[i].n}${s.mort[i] ? ' (H)' : ''}`));
      return l;
    }));
  }
  $('moTradeBtn').addEventListener('click', () => {
    const s = S(), me = meIdx();
    tradeList($('moTrGive'), me);
    tradeList($('moTrGet'), 1 - me);
    $('moTrGetHead').textContent = `Von ${pname()}`;
    $('moTrGiveCash').value = ''; $('moTrGetCash').value = '';
    $('moTrGiveCash').max = s.players[me].cash; $('moTrGetCash').max = s.players[1 - me].cash;
    $('moTrGiveCardRow').hidden = !s.players[me].cards.length; $('moTrGiveCard').checked = false;
    $('moTrGetCardRow').hidden = !s.players[1 - me].cards.length; $('moTrGetCard').checked = false;
    $('moTrErr').textContent = '';
    UI.sheet('moTradeSheet');
  });
  $('moTradeForm').addEventListener('submit', async e => {
    e.preventDefault();
    const pickF = box => [...box.querySelectorAll('input:checked')].map(c => +c.value);
    const t = {
      type: 'trade',
      give: { f: pickF($('moTrGive')), cash: Math.floor(+$('moTrGiveCash').value || 0), cards: $('moTrGiveCard').checked ? 1 : 0 },
      get: { f: pickF($('moTrGet')), cash: Math.floor(+$('moTrGetCash').value || 0), cards: $('moTrGetCard').checked ? 1 : 0 },
    };
    if (await act(t, $('moTrErr'))) UI.sheet('moTradeSheet', false);
  });

  // ======================================================================
  // Aktionen
  // ======================================================================
  async function act(body, msgEl) {
    if (busy || !g) return false;
    busy = true;
    const msg = msgEl || $('moMsg');
    msg.textContent = '';
    document.querySelectorAll('#moActions button').forEach(b => { b.disabled = true; });
    try {
      g = await pb.send(`/api/games/mono/${g.id}/act`, { method: 'POST', body: { ...body, v: S().v } });
      rolledNow = body.type === 'roll';
      busy = false;
      if (g.status !== 'active') await load();
      else render();
      rolledNow = false;
      if (S()?.winner === meIdx()) UI.burst(window.innerWidth / 2, window.innerHeight / 3, 30);
      return true;
    } catch (err) {
      busy = false;
      msg.textContent = errText(err);
      await load().catch(console.error);
      return false;
    }
  }
  function resign() {
    if (!confirm('Wirklich aufgeben? ' + pname() + ' gewinnt dann die Partie.')) return;
    act({ type: 'bankrupt' });
  }
  $('moResignBtn').addEventListener('click', resign);
  $('moRulesBtn').addEventListener('click', () => UI.sheet('moRulesSheet'));
  $('moNewBtn').addEventListener('click', async () => {
    $('moNewMsg').textContent = '';
    try {
      await pb.send('/api/games/mono/new', { method: 'POST' });
      g = null;
      await load();
      UI.burst(window.innerWidth / 2, window.innerHeight / 3, 16);
    } catch (err) {
      $('moNewMsg').textContent = 'Ging nicht: ' + errText(err);
      await load().catch(console.error);
    }
  });

  // ======================================================================
  // Start, Live-Updates
  // ======================================================================
  let reloadT = null;
  async function start() {
    started = true;
    await load().catch(console.error);
    pb.collection('mono_games').subscribe('*', e => {
      if (busy) return;
      // gleiche Partie: Stand direkt übernehmen (kein Extra-Request), sonst neu laden
      if (g && e.record.id === g.id && e.action === 'update' && e.record.state?.v > S().v) {
        g = e.record;
        if (g.status !== 'active') { clearTimeout(reloadT); reloadT = setTimeout(() => load().catch(console.error), 300); }
        else render();
        return;
      }
      clearTimeout(reloadT);
      reloadT = setTimeout(() => load().catch(console.error), 300);
    }).catch(console.error);
  }
  document.addEventListener('wir:show', e => {
    if (!started) return;
    if (e.detail === 's-mono') { $('moMsg').textContent = ''; render(); }
    if (e.detail === 's-games') renderHub();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !started || !pb.authStore.isValid) return;
    load().catch(console.error);
  });
  document.addEventListener('wir:started', () => { if (!started) start(); });
})();
