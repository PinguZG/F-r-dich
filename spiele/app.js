// Spiele-App: Login, Start (wer ist dran, Coins, letzte Aktivitäten), Ziele aus Pushs, Einstellungen.
// Eigener Origin (:8443), aber DIESELBE PocketBase wie Wir: Die API liegt unter window.WIR_APP.api (https://wir.geep-flops.ts.net).
// Legt window.WIR_PB an (für /shared/… und die Spiele-Skripte) und meldet 'wir:started', sobald eingeloggt.
(() => {
  const pb = new PocketBase(window.WIR_APP.api);
  pb.autoCancellation(false);
  window.WIR_PB = pb;

  const $ = id => document.getElementById(id);
  const me = () => (pb.authStore.record || pb.authStore.model)?.id;
  let started = false;
  let users = [];
  const nameOf = id => id === me() ? 'Du' : users.find(u => u.id === id)?.name || 'Schatz';

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  function debounce(fn, ms = 600) {
    let t;
    return () => { clearTimeout(t); t = setTimeout(() => fn().catch(console.error), ms); };
  }
  const pbMs = s => s ? Date.parse(String(s).replace(' ', 'T')) : 0;
  const fmtTime = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const LEVEL = { easy: 'Leicht', medium: 'Mittel', hard: 'Schwer' };
  const DE = { N: 'S', B: 'L', R: 'T', Q: 'D', K: 'K' };
  const sanDe = san => String(san).replace(/[NBRQK]/g, c => DE[c]);

  // ======================================================================
  // Profil oben + Einstellungen + Start
  // ======================================================================
  function renderPeople(e) {
    const { me: u, partner: p } = e?.detail || { me: window.WIR_LOOK?.me(), partner: window.WIR_LOOK?.partner() };
    const L = window.WIR_LOOK;
    L.paintAvatar($('meBtn'), u, ' – Einstellungen');
    L.paintAvatar($('avSettings'), u);
    L.paintAvatar($('avMe'), u);
    L.paintAvatar($('avPartner'), p);
    $('setName').textContent = u?.name || '';
    $('nameMe').textContent = 'Du';
    $('namePartner').textContent = p?.name || 'Schatz';
    $('startHello').textContent = `Hallo ${u?.name || ''} 💗`.replace('  ', ' ');
  }
  document.addEventListener('wir:users', renderPeople);
  if (pb.authStore.isValid) renderPeople({ detail: { me: pb.authStore.record || pb.authStore.model, partner: null } });

  $('wirLink').href = window.WIR_APP.wirUrl;

  // ======================================================================
  // Start: letzte Aktivitäten (aus den Spielen, Sudoku, Gutscheinen und dem eigenen Coin-Verlauf)
  // ======================================================================
  async function loadFeed() {
    const [chess, ttt, sudoku, mono, ledger, vouchers] = await Promise.all([
      pb.collection('chess_games').getList(1, 6, { sort: '-updated', fields: 'id,white,black,status,winner,turn,moves,updated' }).then(r => r.items),
      pb.collection('ttt_games').getList(1, 6, { sort: '-updated', filter: 'mode = "pvp"' }).then(r => r.items),
      pb.collection('sudoku_scores').getList(1, 6, { sort: '-created' }).then(r => r.items),
      pb.collection('mono_games').getList(1, 3, { sort: '-updated', fields: 'id,status,updated' }).then(r => r.items).catch(() => []),
      pb.collection('coin_ledger').getList(1, 6, { sort: '-created,-id' }).then(r => r.items),
      pb.collection('vouchers').getList(1, 4, { sort: '-updated' }).then(r => r.items).catch(() => []),
    ].map(p => p.catch(() => [])));
    const out = [];
    for (const g of chess) {
      const last = (g.moves || [])[g.moves?.length - 1];
      let t;
      if (g.status === 'active') t = last ? `${nameOf(last.color === 'w' ? g.white : g.black)} spielte ${sanDe(last.san)}` : 'Neue Partie gestartet';
      else t = g.winner ? `${nameOf(g.winner)} ${g.winner === me() ? 'hast' : 'hat'} gewonnen` : 'Remis';
      out.push({ at: g.updated, ico: '♟️', t: 'Schach: ' + t, go: 's-chess' });
    }
    for (const g of ttt) {
      const t = g.status === 'active' ? `${nameOf(g.turn)} ${g.turn === me() ? 'bist' : 'ist'} am Zug`
        : g.winner ? `${nameOf(g.winner)} ${g.winner === me() ? 'hast' : 'hat'} gewonnen` : 'Unentschieden';
      out.push({ at: g.updated, ico: '⭕', t: 'Tic Tac Toe: ' + t, go: 's-ttt' });
    }
    for (const s of sudoku) {
      out.push({ at: s.created, ico: '🧩', t: `${nameOf(s.user)} ${s.user === me() ? 'hast' : 'hat'} ein Sudoku gelöst (${LEVEL[s.difficulty] || ''}, ${fmtTime(s.seconds)} min, +${s.points})`, go: 's-sudoku' });
    }
    for (const g of mono) {
      const t = g.status === 'active' ? 'Partie läuft' : 'Partie beendet';
      out.push({ at: g.updated, ico: '🏙️', t: 'Herzstadt: ' + t, go: 's-mono' });
    }
    for (const x of ledger) {
      out.push({ at: x.created, ico: x.amount > 0 ? '🪙' : '💸', t: `${x.label || x.reason} (${x.amount > 0 ? '+' : '−'}${Math.abs(x.amount)})`, coins: true });
    }
    for (const v of vouchers) {
      const t = v.status === 'fulfilled' ? 'erfüllt ✓' : v.status === 'redeemed' ? 'eingelöst' : v.from === me() ? `an ${nameOf(v.to)} verschenkt` : `von ${nameOf(v.from)} bekommen`;
      out.push({ at: v.updated, ico: v.emoji || '🎁', t: `Gutschein „${v.name}“ ${t}`, go: 'shop:vouchers' });
    }
    out.sort((a, b) => pbMs(b.at) - pbMs(a.at));
    renderFeed(out.slice(0, 10));
  }
  const reloadFeed = debounce(loadFeed, 800);

  function ago(s) {
    const sec = Math.round((Date.now() - pbMs(s)) / 1000);
    if (sec < 60) return 'gerade eben';
    if (sec < 3600) return 'vor ' + Math.floor(sec / 60) + ' Min.';
    if (sec < 86400) return 'vor ' + Math.floor(sec / 3600) + ' Std.';
    const days = Math.floor(sec / 86400);
    return days === 1 ? 'gestern' : `vor ${days} Tagen`;
  }

  function renderFeed(list) {
    const box = $('feed');
    if (!list.length) { box.replaceChildren(el('div', 'empty-note', 'Noch nichts passiert – fang ein Spiel an 🎲')); return; }
    box.replaceChildren(...list.map(x => {
      const row = el('button', 'date feed-row');
      row.type = 'button';
      row.append(el('span', 'ico', x.ico));
      const d = el('div');
      d.append(el('b', '', x.t), el('small', '', ago(x.at)));
      row.append(d);
      row.addEventListener('click', () => x.coins ? window.WIR_COINS?.openSheet() : goTo(x.go));
      return row;
    }));
  }

  // ======================================================================
  // Aus einer Benachrichtigung heraus öffnen
  // ======================================================================
  function goTo(target) {
    if (!target) return;
    const orig = target;
    if (target.startsWith('shop')) target = 's-shop';
    target = UI.resolve(target);
    if (!$(target)?.classList.contains('page')) target = 's-games';
    UI.show(target);
    $(target).scrollTop = 0;
    document.dispatchEvent(new CustomEvent('wir:go', { detail: orig }));
  }

  // Ziel aus der URL (/#go=...) – wird vom Service Worker beim Öffnen gesetzt
  const startGo = new URLSearchParams(location.hash.slice(1)).get('go');
  if (startGo) history.replaceState(null, '', location.pathname + location.search);
  window.addEventListener('hashchange', () => {
    const go = new URLSearchParams(location.hash.slice(1)).get('go');
    if (!go) return;
    history.replaceState(null, '', location.pathname + location.search);
    if (pb.authStore.isValid && started) goTo(go);
  });
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data?.go && pb.authStore.isValid && started) goTo(e.data.go);
    });
  }

  // ======================================================================
  // Laden, Live-Updates, Login
  // ======================================================================
  async function enter(target) {
    users = await pb.collection('users').getFullList({ fields: 'id,name' }).catch(() => []);
    started = true;
    document.dispatchEvent(new CustomEvent('wir:started'));
    loadFeed().catch(console.error);
    for (const c of ['chess_games', 'ttt_games', 'sudoku_scores', 'mono_games', 'coin_ledger', 'vouchers']) {
      pb.collection(c).subscribe('*', reloadFeed).catch(() => {});
    }
    UI.show('s-games');
    if (target) goTo(target);
  }

  document.addEventListener('wir:show', e => { if (started && e.detail === 's-games') reloadFeed(); });

  $('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    $('err').textContent = '';
    try {
      await pb.collection('users').authWithPassword($('loginEmail').value.trim(), $('loginPass').value);
      $('loginPass').value = '';
      const r = $('lockCard').getBoundingClientRect();
      UI.burst(r.left + r.width / 2, r.top + r.height / 2, 24);
      await UI.wait(500);
      renderPeople({ detail: { me: pb.authStore.record || pb.authStore.model, partner: null } });
      enter(startGo);
    } catch {
      UI.shake($('lockCard'));
      $('err').textContent = 'Hmm, nicht ganz … versuch’s nochmal 💭';
    }
  });

  $('logoutBtn').addEventListener('click', async () => {
    if (!confirm('Wirklich abmelden?')) return;
    // dieses Handy soll keine Spiel-Benachrichtigungen für den alten Account mehr bekommen
    await window.WIR_PUSH?.drop().catch(console.error);
    pb.authStore.clear();
    location.reload();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !pb.authStore.isValid || !started) return;
    loadFeed().catch(console.error);
  });

  async function boot() {
    if (!pb.authStore.isValid) { UI.show('s-lock'); return; }
    UI.show('s-games');
    try {
      await pb.collection('users').authRefresh();
    } catch (err) {
      // nur bei ungültigem Login abmelden – offline einfach weitermachen
      if ([401, 403, 404].includes(err?.status)) {
        pb.authStore.clear();
        UI.show('s-lock');
        return;
      }
    }
    enter(startGo);
  }

  // erst starten, wenn alle Skripte geladen sind (die hören auf 'wir:started')
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
