// Sync-Knopf, Schütteln und Effekte für Wir und die Spiele-App (/shared/fx.js, Styles in /shared/fx.css).
// - Herz-Regen per Canvas (pointer-events:none, höchstens MAX Herzen, läuft nur solange etwas zu sehen ist)
// - Wackeln der ganzen App (Klasse auf <html>, Animation auf dem body), „You are in sync“
// - Sync-Knopf #syncTop (oben neben dem Avatar): Halten per Heartbeat an /api/sync/hold, der Server entscheidet den Sync
// - Schütteln: DeviceMotion nur bei sichtbarer App, Lebenszeichen ≤1×/s an /api/shake
// - Realtime auf live_state (ein Datensatz pro Person): Halten/Schütteln/Sync der anderen Person
// Braucht window.WIR_PB, window.UI und die Herzfarben aus /shared/look.js (window.WIR_HEARTS / 'wir:hearts').
// Lokal (nicht *.ts.net) zum Testen: WIR_FX.simulateShake() in der Browser-Konsole.
(() => {
  const pb = window.WIR_PB;
  const $ = id => document.getElementById(id);
  const myId = () => (pb.authStore.record || pb.authStore.model)?.id;
  const reduced = () => UI.reduced();
  const live = location.hostname.endsWith('.ts.net');
  const post = (path, body = {}) => pb.send(path, { method: 'POST', body });
  const hearts = () => window.WIR_HEARTS || { me: '#ff5fa2', partner: '#3b9eff' };
  let started = false;
  let partnerName = 'Schatz';
  const store = { get: k => { try { return localStorage.getItem(k); } catch (_) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} } };

  // ======================================================================
  // Herz-Canvas
  // ======================================================================
  const MAX = 70;
  const canvas = document.createElement('canvas');
  canvas.className = 'fx-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  }
  resize();
  window.addEventListener('resize', resize);

  const parts = [];
  const rains = [];      // { colors, until, rate, acc }
  let raf = 0, last = 0;

  function heartPath(c, s) {
    c.beginPath();
    c.moveTo(0, s * 0.35);
    c.bezierCurveTo(-s * 1.1, -s * 0.35, -s * 0.5, -s * 1.05, 0, -s * 0.45);
    c.bezierCurveTo(s * 0.5, -s * 1.05, s * 1.1, -s * 0.35, 0, s * 0.35);
    c.closePath();
  }
  function add(p) {
    if (parts.length >= (reduced() ? 14 : MAX)) return;
    parts.push(p);
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }
  function spawnRain(color) {
    add({ x: Math.random() * W, y: -20, vx: (Math.random() - 0.5) * 40, vy: 90 + Math.random() * 110, s: 9 + Math.random() * 12,
      r: Math.random() * 0.6 - 0.3, vr: (Math.random() - 0.5) * 1.2, c: color, life: 0, max: (H + 60) / 90 + 2, fall: true });
  }
  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    const now = Date.now();
    for (let i = rains.length - 1; i >= 0; i--) {
      const r = rains[i];
      if (now > r.until) { rains.splice(i, 1); continue; }
      r.acc += dt * r.rate * (reduced() ? 0.25 : 1);
      while (r.acc >= 1) { r.acc--; spawnRain(r.colors[Math.floor(Math.random() * r.colors.length)]); }
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life += dt;
      if (!p.fall) p.vy += 260 * dt; // Puff: fällt langsam nach unten
      p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
      const fade = p.fall ? 1 : Math.max(0, 1 - p.life / p.max);
      if (p.life > p.max || p.y > H + 40 || fade <= 0) { parts.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = 0.9 * fade;
      ctx.translate(p.x, p.y); ctx.rotate(p.r);
      heartPath(ctx, p.s);
      ctx.fillStyle = p.c; ctx.fill();
      ctx.globalAlpha = 0.35 * fade; ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-p.s * 0.35, -p.s * 0.4, p.s * 0.16, 0, 6.3); ctx.fill();
      ctx.restore();
    }
    if (parts.length || rains.length) raf = requestAnimationFrame(frame);
    else { raf = 0; ctx.clearRect(0, 0, W, H); }
  }

  // Herzen von oben regnen lassen (verlängert eine laufende Runde derselben Farben)
  function rain(colors, ms, rate = 14) {
    const key = colors.join();
    const r = rains.find(x => x.colors.join() === key);
    if (r) r.until = Math.max(r.until, Date.now() + ms);
    else rains.push({ colors, until: Date.now() + ms, rate, acc: 1 });
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }
  // kleiner Herz-Puff an einer Stelle
  function puff(x, y, colors, n = 10) {
    for (let i = 0; i < (reduced() ? 3 : n); i++) {
      const a = Math.random() * Math.PI * 2, v = 120 + Math.random() * 160;
      add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, s: 7 + Math.random() * 8, r: 0, vr: (Math.random() - 0.5) * 3,
        c: colors[i % colors.length], life: 0, max: 0.9 + Math.random() * 0.4 });
    }
  }

  // ======================================================================
  // Wackeln + „You are in sync“
  // ======================================================================
  let wobbleUntil = 0, wobbleTimer = 0;
  function wobble(ms) {
    wobbleUntil = Math.max(wobbleUntil, Date.now() + ms);
    document.documentElement.classList.add('fx-wobble');
    clearTimeout(wobbleTimer);
    wobbleTimer = setTimeout(function off() {
      if (Date.now() < wobbleUntil) { wobbleTimer = setTimeout(off, wobbleUntil - Date.now()); return; }
      document.documentElement.classList.remove('fx-wobble');
    }, ms);
  }

  const syncBox = document.createElement('div');
  syncBox.className = 'fx-sync';
  syncBox.setAttribute('aria-live', 'polite');
  syncBox.innerHTML = '<b>You are in sync</b>';
  document.body.append(syncBox);
  let syncTimer = 0;
  function showSync() {
    const h = hearts();
    syncBox.style.setProperty('--fx-a', h.me);
    syncBox.style.setProperty('--fx-b', h.partner);
    syncBox.classList.add('show');
    rain([h.me, h.partner], 4000, 26);
    puff(W / 2, H / 2, [h.me, h.partner], 24);
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => syncBox.classList.remove('show'), 4000);
  }

  // ======================================================================
  // Zustand der anderen Person (live_state per Realtime)
  // ======================================================================
  let partnerHoldUntil = 0, partnerHoldTimer = 0;
  let lastSyncAt = 0, lastShakeSeq = -1;

  // initial = Stand beim Laden: nur übernehmen, keine Effekte nachholen
  function onState(s, initial) {
    if (!s || !s.user) return;
    if ((s.sync_at || 0) > lastSyncAt) {
      lastSyncAt = s.sync_at;
      if (!initial) showSync();   // beide Datensätze tragen denselben sync_at -> nur einmal
    }
    if (s.user === myId()) return;
    // Halten: so lange anzeigen, wie es frisch ist (ohne Heartbeat nach ~3 s weg)
    partnerHoldUntil = s.holding && (!initial || s.hold_until > Date.now()) ? Date.now() + 3200 : 0;
    renderSync();
    clearTimeout(partnerHoldTimer);
    if (partnerHoldUntil) partnerHoldTimer = setTimeout(renderSync, 3300);
    // Schütteln: Herzen in der Farbe der anderen Person + Wackeln, ~3 s über das letzte Lebenszeichen hinaus
    const seq = s.shake_seq || 0;
    if (!initial && lastShakeSeq >= 0 && seq > lastShakeSeq) {
      rain([hearts().partner], 3200, 16);
      if (!reduced()) wobble(3200);
    }
    if (initial || seq > lastShakeSeq) lastShakeSeq = seq;
  }

  async function loadStates() {
    const list = await pb.collection('live_state').getFullList();
    if (lastShakeSeq < 0) lastShakeSeq = 0;   // noch kein Datensatz der anderen Person: jedes Schütteln ist neu
    for (const s of list) onState(s, true);
  }

  // ======================================================================
  // Sync-Knopf: kleiner Herz-Knopf oben links neben dem Avatar (#syncTop)
  // ======================================================================
  const btn = $('syncTop');
  let holding = false, holdTimer = 0, partnerWas = false;

  if (btn) {
    btn.addEventListener('contextmenu', e => e.preventDefault());
    btn.addEventListener('selectstart', e => e.preventDefault());
    btn.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      try { btn.setPointerCapture(e.pointerId); } catch (_) {}
      askShakeOnce();
      startHold();
    });
    // Loslassen – auch wenn der Finger rausgezogen wurde (Pointer-Capture) oder das System abbricht
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(ev, () => stopHold());
    btn.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
    btn.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); startHold(); } });
    btn.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') stopHold(); });
  }

  // kurzer Hinweis oben, wenn die andere Person anfängt zu halten (der Ring allein ist klein)
  let hintBox = null, hintTimer = 0;
  function hint(text) {
    if (!hintBox) { hintBox = document.createElement('div'); hintBox.className = 'fx-hint glass'; document.body.append(hintBox); }
    hintBox.textContent = text;
    requestAnimationFrame(() => hintBox.classList.add('show'));
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => hintBox.classList.remove('show'), 2600);
  }

  function renderSync() {
    if (!btn) return;
    const h = hearts();
    btn.style.setProperty('--sync-me', h.me);
    btn.style.setProperty('--sync-partner', h.partner);
    const theirs = Date.now() < partnerHoldUntil;
    btn.classList.toggle('holding', holding);
    btn.classList.toggle('partner', theirs);
    btn.setAttribute('aria-label', theirs ? `${partnerName} hält gerade – halt mit!` : 'Sync-Knopf – gedrückt halten');
    if (theirs && !partnerWas && !holding) hint(`💞 ${partnerName} hält den Sync-Knopf – halt mit!`);
    partnerWas = theirs;
  }

  async function beatHold(down) {
    try {
      const r = await post('/api/sync/hold', { down });
      if (r.partner) onState(r.partner, false);
      if (r.synced) onState(r.me, false);
    } catch (err) { console.error('sync', err); }
  }
  function startHold() {
    if (holding || !pb.authStore.isValid) return;
    holding = true;
    renderSync();
    beatHold(true);
    clearInterval(holdTimer);
    holdTimer = setInterval(() => { if (holding) beatHold(true); }, 500);
  }
  function stopHold() {
    if (!holding) return;
    holding = false;
    clearInterval(holdTimer);
    renderSync();
    beatHold(false);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopHold(); });
  window.addEventListener('pagehide', () => stopHold());
  document.addEventListener('wir:hearts', renderSync);
  document.addEventListener('wir:users', e => { partnerName = e.detail.partner?.name || 'Schatz'; renderSync(); });

  // ======================================================================
  // Schütteln
  // ======================================================================
  const SHAKE_KEY = 'wir-shake';             // 'on' | 'off'
  const ASKED_KEY = 'wir-shake-asked';
  const needsPermission = () => typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function';
  const supported = () => typeof window.DeviceMotionEvent !== 'undefined';
  // ohne Erlaubnis-Abfrage (Android, Desktop) standardmäßig an, auf dem iPhone erst nach Erlauben
  const shakeOn = () => (store.get(SHAKE_KEY) || (needsPermission() ? 'off' : 'on')) === 'on';
  let motionOn = false;

  async function requestMotion() {
    if (!supported()) return false;
    if (!needsPermission()) return true;
    try { return (await DeviceMotionEvent.requestPermission()) === 'granted'; } catch (_) { return false; }
  }

  // Bewegungssensor nur auswerten, wenn erlaubt und die App sichtbar ist
  function syncMotion() {
    const want = started && shakeOn() && supported() && !document.hidden;
    if (want && !motionOn) { window.addEventListener('devicemotion', onMotion); motionOn = true; }
    if (!want && motionOn) { window.removeEventListener('devicemotion', onMotion); motionOn = false; }
  }
  document.addEventListener('visibilitychange', syncMotion);

  // mehrere kräftige Ausschläge mit Richtungswechsel innerhalb kurzer Zeit (Gehen/normales Bewegen reicht nicht)
  const PEAK = 15;          // m/s² ohne Schwerkraft
  const PEAKS_NEEDED = 4;
  const WINDOW_MS = 900;
  let peaks = [], lastSign = 0, lastPeakAt = 0;
  function onMotion(e) {
    const a = e.acceleration && e.acceleration.x != null ? e.acceleration : null;
    let x, y, z;
    if (a) ({ x, y, z } = a);
    else if (e.accelerationIncludingGravity) { ({ x, y, z } = e.accelerationIncludingGravity); z = (z || 0) - 9.81; }
    else return;
    x = x || 0; y = y || 0; z = z || 0;
    const ax = Math.abs(x) >= Math.abs(y) && Math.abs(x) >= Math.abs(z) ? x : Math.abs(y) >= Math.abs(z) ? y : z;
    const mag = Math.hypot(x, y, z);
    const t = Date.now();
    if (mag < PEAK) return;
    const sign = Math.sign(ax);
    if (sign === lastSign && t - lastPeakAt < 250) return; // derselbe Ausschlag
    lastSign = sign; lastPeakAt = t;
    peaks.push(t);
    peaks = peaks.filter(p => t - p <= WINDOW_MS);
    if (peaks.length >= PEAKS_NEEDED) shaking();
  }

  let lastShakeSent = 0;
  async function shaking() {
    const t = Date.now();
    if (t - lastShakeSent < 1000) return;   // höchstens ~1× pro Sekunde
    lastShakeSent = t;
    try {
      await post('/api/shake');
      puff(W / 2, H * 0.45, [hearts().me], 9); // kleine Bestätigung: ist angekommen
    } catch (err) { console.error('shake', err); }
  }

  // Schalter in den Einstellungen (#shakeSwitch, Text in #shakeState)
  const sw = $('shakeSwitch');
  function renderShake(note) {
    if (!sw) return;
    sw.checked = shakeOn();
    sw.disabled = !supported();
    const st = $('shakeState');
    if (st) st.textContent = note || (!supported() ? 'Dieses Gerät hat keinen Bewegungssensor.'
      : shakeOn() ? 'An – schüttel dein Handy kräftig, dann regnet es bei der anderen Person Herzen 💥' : 'Aus');
  }
  sw?.addEventListener('change', async () => {
    if (sw.checked) {
      const ok = await requestMotion();   // muss direkt im Tippen passieren (iOS)
      store.set(SHAKE_KEY, ok ? 'on' : 'off');
      renderShake(ok ? null : 'Nicht erlaubt – in Safari: Einstellungen → Safari → Bewegung & Ausrichtung, dann nochmal.');
    } else {
      store.set(SHAKE_KEY, 'off');
      renderShake();
    }
    syncMotion();
  });

  // einmalige freundliche Nachfrage beim ersten Antippen des Sync-Knopfs
  let askBox = null;
  function askShakeOnce() {
    if (!needsPermission() || shakeOn() || store.get(ASKED_KEY)) return;
    store.set(ASKED_KEY, '1');
    if (!askBox) {
      askBox = document.createElement('div');
      askBox.className = 'fx-ask glass';
      askBox.innerHTML = '<b>Schütteln erlauben? 💥</b><p>Wenn du dein Handy kräftig schüttelst, regnet es bei der anderen Person Herzen und ihre App wackelt.</p>'
        + '<div class="row"><button class="pack-btn" type="button" data-no>Später</button><button class="mem-btn" type="button" data-yes>Erlauben</button></div>';
      document.body.append(askBox);
      askBox.querySelector('[data-no]').addEventListener('click', () => askBox.classList.remove('show'));
      askBox.querySelector('[data-yes]').addEventListener('click', async () => {
        const ok = await requestMotion();
        store.set(SHAKE_KEY, ok ? 'on' : 'off');
        askBox.classList.remove('show');
        renderShake();
        syncMotion();
      });
    }
    setTimeout(() => askBox.classList.add('show'), 600);
  }

  // iOS: Ist Schütteln an, die (schon erteilte) Erlaubnis beim ersten Tippen still erneuern – ohne Nachfrage
  document.addEventListener('pointerdown', function renew() {
    document.removeEventListener('pointerdown', renew, true);
    if (needsPermission() && shakeOn()) requestMotion().then(ok => { if (!ok) { store.set(SHAKE_KEY, 'off'); renderShake(); } syncMotion(); });
  }, true);

  // ======================================================================
  // Start
  // ======================================================================
  async function start() {
    started = true;
    renderSync();
    renderShake();
    syncMotion();
    await loadStates().catch(console.error);
    pb.collection('live_state').subscribe('*', e => onState(e.record, false)).catch(console.error);
  }
  document.addEventListener('visibilitychange', () => {
    if (!started || document.hidden || !pb.authStore.isValid) return;
    loadStates().catch(console.error);
  });
  document.addEventListener('wir:show', e => { if (started && e.detail === 's-settings') renderShake(); });
  document.addEventListener('wir:started', () => { if (!started) start(); });

  window.WIR_FX = {
    rain, puff, wobble, showSync,
    // nur lokal zum Testen: Schütteln simulieren (in der Live-Version nicht vorhanden)
    ...(live ? {} : { simulateShake: () => { lastShakeSent = 0; return shaking(); } }),
  };
})();
