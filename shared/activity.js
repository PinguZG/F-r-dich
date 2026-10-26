// Aktivität: sammelt besuchte Bereiche (mit Dauer) und Gesehen-Ereignisse und schickt sie gebündelt
// höchstens einmal pro Minute an /api/act/beat (pb_hooks/wir_activity.pb.js). Die Antwort enthält den Online-Status
// beider Personen -> grüner Punkt an Profilbildern mit Klasse .js-partner-av. Dazu die Konsole (Einstellungen → Konsole).
// Gemeinsam für Wir und die Spiele-App (/shared/activity.js); nutzt window.WIR_PB der App.
(() => {
  const pb = window.WIR_PB;
  const $ = id => document.getElementById(id);
  const myId = () => (pb.authStore.record || pb.authStore.model)?.id;
  let started = false;

  // ======================================================================
  // Sammeln + Herzschlag
  // ======================================================================
  const BEAT_MS = 60 * 1000;
  let buf = [];
  let cur = null;            // { a: Bereich, s: Start }
  let beatTimer = 0;
  let presence = [];

  const activeScreen = () => document.querySelector('.screen.page.active')?.id || '';

  function detailOf(a) {
    if (a === 's-tab') return $('tabTitle')?.textContent || '';
    return '';
  }

  function closeView(t = Date.now()) {
    if (!cur) return;
    if (t - cur.s >= 2000) buf.push({ t: 'view', a: cur.a, d: detailOf(cur.a), s: cur.s, e: t });
    cur = null;
  }
  function openView(a) {
    if (!a || document.hidden) return;
    cur = { a, s: Date.now() };
  }

  async function beat(state = 'open') {
    if (!pb.authStore.isValid) return;
    // laufende Ansicht bis jetzt mitschicken, danach weiterzählen
    const t = Date.now();
    if (cur) { const a = cur.a; closeView(t); if (state !== 'close') cur = { a, s: t }; }
    const events = buf.splice(0, 60);
    try {
      const r = await fetch(pb.buildURL('/api/act/beat'), {
        method: 'POST',
        keepalive: true,
        headers: { 'content-type': 'application/json', Authorization: pb.authStore.token },
        body: JSON.stringify({ state, events }),
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      setPresence(j.presence);
    } catch (_) {
      buf = events.concat(buf).slice(-150); // später nochmal versuchen
    }
  }

  function schedule() {
    clearInterval(beatTimer);
    beatTimer = setInterval(() => { if (!document.hidden) beat(); }, BEAT_MS);
  }

  document.addEventListener('wir:show', e => {
    if (!started) return;
    const a = e.detail;
    if (cur?.a === a) return;
    closeView();
    openView(document.getElementById(a)?.classList.contains('page') ? a : '');
    if (buf.length >= 20) beat();
  });

  // Fotos (Erinnerungen) und Bilder in Reitern (Wir): beim Öffnen im Großbild
  const origLightbox = UI.lightbox;
  if ($('lightbox')) UI.lightbox = (src, cap, actions) => {
    if (started) {
      const a = activeScreen();
      if (a === 's-memories' || a === 's-tab') buf.push({ t: 'seen', a: a === 's-tab' ? 'tab' : 'photo', d: (a === 's-tab' ? ($('tabTitle')?.textContent || '') + ': ' : '') + String(cap || '').replace(/^\s*–\s*/, 'von '), s: Date.now() });
    }
    return origLightbox(src, cap, actions);
  };

  document.addEventListener('visibilitychange', () => {
    if (!started || !pb.authStore.isValid) return;
    if (document.hidden) { beat('close'); }
    else { openView(activeScreen()); beat(); schedule(); }
  });
  window.addEventListener('pagehide', () => { if (started && !document.hidden) beat('close'); });

  // ======================================================================
  // Online-Punkt am Profilbild der anderen Person
  // ======================================================================
  function setPresence(p) {
    if (!Array.isArray(p)) return;
    presence = p;
    const other = p.find(x => x.id !== myId());
    for (const a of document.querySelectorAll('.js-partner-av')) {
      a.classList.toggle('is-online', !!other?.online);
      a.title = other ? (other.online ? `${other.name} ist gerade online` : '') : '';
    }
  }
  async function loadPresence() {
    try { setPresence((await pb.send('/api/act/presence', {})).presence); } catch (_) {}
  }

  // ======================================================================
  // Konsole
  // ======================================================================
  const out = $('termOut');
  const pad2 = n => String(n).padStart(2, '0');
  const toDate = s => new Date(String(s).replace(' ', 'T'));
  const hm = d => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const dm = d => `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.`;
  const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const when = s => { const d = toDate(s); return `${dm(d)} ${hm(d)}`; };
  function dur(secs) {
    secs = Math.max(0, Math.round(secs));
    if (secs < 60) return secs + ' s';
    const m = Math.round(secs / 60);
    if (m < 60) return m + ' min';
    return `${Math.floor(m / 60)} h ${m % 60} min`;
  }
  function ago(s) {
    const sec = (Date.now() - toDate(s).getTime()) / 1000;
    if (sec < 90) return 'gerade eben';
    if (sec < 3600) return `vor ${Math.round(sec / 60)} min`;
    if (sec < 86400) return `vor ${Math.round(sec / 3600)} h`;
    return `am ${when(s)}`;
  }
  const AREA = {
    's-home': 'Start', 's-memories': 'Erinnerungen', 's-plans': 'Dates', 's-dates': 'Unsere Daten', 's-meetings': 'Treffen',
    's-clay': 'Clay Date', 's-clay-done': 'Unsere Figuren', 's-tab': 'Reiter', 's-newtab': 'Neuer Reiter', 's-openwhen': 'Öffne wenn',
    's-wir': 'Wir zwei', 's-games': 'Spiele', 's-chess': 'Schach', 's-sudoku': 'Sudoku', 's-ttt': 'Tic Tac Toe', 's-mono': 'Herzstadt',
    's-bj': 'Blackjack', 's-settings': 'Einstellungen', 's-console': 'Konsole',
    's-duo': 'Zu zweit', 's-brain': 'Denkspiele', 's-casino': 'Casino', 's-shop': 'Shop', 's-date': 'Date', 's-grocery': 'Einkaufsliste',
  };
  const GAMES = ['s-games', 's-chess', 's-sudoku', 's-ttt', 's-mono', 's-bj', 's-duo', 's-brain', 's-casino', 's-shop'];

  function line(text, cls) {
    const d = document.createElement('div');
    d.className = 'tl' + (cls ? ' ' + cls : '');
    d.textContent = text;
    out.append(d);
  }
  const scrollDown = () => { out.scrollTop = out.scrollHeight; };

  function fmtEntry(x) {
    const t = hm(toDate(x.time));
    const w = x.who.padEnd(7).slice(0, 7);
    switch (x.kind) {
      case 'open': return `${t} ${w}▶ App geöffnet`;
      case 'close': return `${t} ${w}■ App geschlossen · ${dur(x.secs)} online`;
      case 'view': {
        const name = AREA[x.area] || x.area;
        const icon = GAMES.indexOf(x.area) >= 0 ? '🎲' : '·';
        return `${t} ${w}${icon} ${name}${x.detail ? ' „' + x.detail + '“' : ''} · ${dur(x.secs)}`;
      }
      case 'seen': {
        const what = { openwhen: 'Öffne-wenn-Brief geöffnet', photo: 'Foto angesehen', tab: 'Bild im Reiter angesehen' }[x.area] || 'gesehen';
        return `${t} ${w}👀 ${what}${x.detail ? ': ' + x.detail : ''}`;
      }
      case 'game': return `${t} ${w}🎲 ${x.detail}`;
      case 'fx': return `${t} ${w}${x.area === 'shake' ? '💥' : '💞'} ${x.detail}`;
      default: return `${t} ${w}${x.kind} ${x.detail || ''}`;
    }
  }

  async function cmdLog(args) {
    let limit = 60, user = '';
    for (const a of args) { if (/^\d+$/.test(a)) limit = Math.min(300, +a); else user = a; }
    const rows = await pb.send('/api/console/log', { query: { limit, user } });
    if (!rows.length) { line('(keine Einträge)', 'dim'); return; }
    let day = '';
    for (const x of rows) {
      const d = toDate(x.time), k = dm(d);
      if (k !== day) { day = k; line(`── ${WD[d.getDay()]} ${k} ──`, 'dim'); }
      line(fmtEntry(x), x.kind === 'open' || x.kind === 'close' ? 'em' : '');
    }
  }

  async function cmdOnline() {
    const rows = await pb.send('/api/console/online', {});
    rows.forEach((p, i) => {
      if (i) line('');
      line(`${p.name}  ${p.online ? '● online' : '○ offline'}`, p.online ? 'ok' : 'em');
      line(`  zuletzt online: ${p.online ? 'jetzt' : p.last_seen ? ago(p.last_seen) : 'noch nie'}`);
      if (!p.sessions.length) return;
      line('  Sitzungen:', 'dim');
      for (const s of p.sessions) {
        const a = toDate(s.start), b = toDate(s.end);
        line(`  ${dm(a)} ${hm(a)} – ${s.open ? 'jetzt' : hm(b)}  ${dur(s.open ? (Date.now() - a) / 1000 : s.secs)}`);
      }
    });
  }

  // Weitere Befehle stehen nur in pocketbase/ANLEITUNG.md
  async function cmdToday() {
    const rows = await pb.send('/api/console/log', { query: { limit: 300 } });
    const mid = UI.berlinMidnight();
    const per = {};
    for (const x of rows) {
      if (toDate(x.time).getTime() < mid) continue;
      const p = per[x.who] || (per[x.who] = { online: 0, opens: 0, areas: {} });
      if (x.kind === 'open') p.opens++;
      if (x.kind === 'close') p.online += x.secs;
      if (x.kind === 'view') p.areas[x.area] = (p.areas[x.area] || 0) + x.secs;
    }
    const names = Object.keys(per);
    if (!names.length) { line('(heute noch nichts)', 'dim'); return; }
    for (const n of names) {
      const p = per[n];
      line(`${n}: ${p.opens}× geöffnet, ${dur(p.online)} online (abgeschlossene Sitzungen)`, 'em');
      Object.entries(p.areas).sort((a, b) => b[1] - a[1]).slice(0, 6)
        .forEach(([a, s]) => line(`  ${(AREA[a] || a).padEnd(14)} ${dur(s)}`));
    }
  }

  const CMDS = { '/online': cmdOnline, '/log': cmdLog, '/heute': cmdToday };

  $('termForm').addEventListener('submit', async e => {
    e.preventDefault();
    const input = $('termInput');
    const raw = input.value.trim();
    input.value = '';
    if (!raw) return;
    line('> ' + raw, 'cmd');
    const [c, ...args] = raw.split(/\s+/);
    const cmd = c.toLowerCase();
    if (cmd === '/clear') { out.replaceChildren(); return; }
    const fn = CMDS[cmd];
    if (!fn) { line('Unbekannter Befehl'); scrollDown(); return; }
    try { await fn(args); } catch (err) { line('Fehler: ' + (err?.response?.message || err?.message || err), 'err'); }
    scrollDown();
  });
  $('term').addEventListener('click', e => { if (!e.target.closest('.term-out') || !getSelection().toString()) $('termInput').focus(); });

  // ======================================================================
  // Start
  // ======================================================================
  function start() {
    started = true;
    openView(activeScreen());
    beat();
    schedule();
  }
  document.addEventListener('wir:show', e => { if ((e.detail === 's-home' || e.detail === 's-games') && started) loadPresence(); });
  document.addEventListener('wir:started', () => { if (!started) start(); });
})();
