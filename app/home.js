// Startseite + Einstellungen: Farbwelt, Zusammen-Timer ("Zusammen seit" für beide in shared_settings),
// Profilbilder. Nutzt die PocketBase-Verbindung von app.js.
(() => {
  const pb = window.WIR_PB || new PocketBase(window.location.origin);
  pb.autoCancellation(false);

  const $ = id => document.getElementById(id);
  const myId = () => (pb.authStore.record || pb.authStore.model)?.id;
  const DAY = 86400000;
  const DEFAULT_SINCE = '2026-04-10';
  let started = false;
  let meUser = null, partner = null;

  function errText(err) {
    const d = err?.response?.data;
    if (d && Object.keys(d).length) {
      return Object.entries(d).map(([k, v]) => k + ': ' + (v.message || JSON.stringify(v))).join(', ');
    }
    return err?.response?.message || err?.message || 'unbekannter Fehler';
  }

  // ======================================================================
  // Farbwelt
  // ======================================================================
  const THEMES = {
    rose:        '#fdeef5',
    gluehwein:   '#3e0d1e',
    mondnacht:   '#210635',
    zuckerwatte: '#F4E7F8',
  };
  function applyTheme(t) {
    if (!THEMES[t]) t = 'rose';
    document.documentElement.dataset.theme = t;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEMES[t]);
    document.querySelectorAll('.swatch').forEach(b => b.classList.toggle('on', b.dataset.theme === t));
    try { localStorage.setItem('wir-theme', t); } catch (_) {}
  }
  applyTheme(document.documentElement.dataset.theme || 'rose');

  document.querySelectorAll('.swatch').forEach(b => b.addEventListener('click', async () => {
    applyTheme(b.dataset.theme);
    if (!myId()) return;
    try { meUser = await pb.collection('users').update(myId(), { theme: b.dataset.theme }); }
    catch (err) { console.error('Farbwelt speichern', err); }
  }));

  // ======================================================================
  // Profilbilder
  // ======================================================================
  const initial = u => (u?.name || u?.email || '?').trim().charAt(0).toUpperCase();
  function paintAvatar(el, u) {
    if (!el) return;
    if (u?.avatar) {
      el.style.backgroundImage = `url("${pb.files.getURL(u, u.avatar, { thumb: '200x200' })}")`;
      el.classList.add('has');
    } else {
      el.style.backgroundImage = '';
      el.classList.remove('has');
    }
    el.textContent = initial(u);
    el.setAttribute('aria-label', (u?.name || '') + (el.id === 'meBtn' ? ' – Einstellungen' : ''));
  }

  function renderPeople() {
    paintAvatar($('meBtn'), meUser);
    paintAvatar($('avMe'), meUser);
    paintAvatar($('avMe2'), meUser);
    paintAvatar($('avSettings'), meUser);
    paintAvatar($('avPartner'), partner);
    paintAvatar($('avPartner2'), partner);
    $('nameMe').textContent = meUser?.name || 'Ich';
    $('namePartner').textContent = partner?.name || 'Schatz';
    $('setName').textContent = meUser?.name || '';
    $('lovePartnerLabel').textContent = partner?.name || 'Schatz';
    $('avatarRemove').hidden = !meUser?.avatar;
    renderHearts();
  }

  async function loadPeople() {
    const users = await pb.collection('users').getFullList();
    meUser = users.find(u => u.id === myId()) || null;
    partner = users.find(u => u.id !== myId()) || null;
    renderPeople();
    if (meUser?.theme && meUser.theme !== document.documentElement.dataset.theme) applyTheme(meUser.theme);
  }

  $('avatarFile').addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      $('avatarStatus').textContent = 'Lade hoch …';
      const fd = new FormData();
      fd.append('avatar', await UI.shrink(f, 512, 0.88), 'avatar.jpg');
      meUser = await pb.collection('users').update(myId(), fd);
      renderPeople();
      $('avatarStatus').textContent = 'Gespeichert ✓';
      const r = $('avSettings').getBoundingClientRect();
      UI.burst(r.left + r.width / 2, r.top + r.height / 2, 14);
    } catch (err) {
      $('avatarStatus').textContent = 'Hochladen fehlgeschlagen: ' + errText(err);
    }
    e.target.value = '';
  });

  $('avatarRemove').addEventListener('click', async () => {
    if (!confirm('Profilbild entfernen?')) return;
    try {
      meUser = await pb.collection('users').update(myId(), { avatar: null });
      renderPeople();
      $('avatarStatus').textContent = 'Entfernt ✓';
    } catch (err) {
      $('avatarStatus').textContent = 'Ging nicht: ' + errText(err);
    }
  });

  // ======================================================================
  // Herzfarbe – jede Farbe nur für EINE Person (Unique-Index users.heart_color auf dem Server)
  // ======================================================================
  const HEART_COLORS = [
    { key: 'rosa',     name: 'Rosa',     hex: '#ff5fa2' },
    { key: 'kirsche',  name: 'Kirsche',  hex: '#e11d48' },
    { key: 'koralle',  name: 'Koralle',  hex: '#ff7f50' },
    { key: 'pfirsich', name: 'Pfirsich', hex: '#ffab5e' },
    { key: 'sonne',    name: 'Sonne',    hex: '#f5c518' },
    { key: 'mint',     name: 'Mint',     hex: '#34d399' },
    { key: 'tuerkis',  name: 'Türkis',   hex: '#14b8c4' },
    { key: 'himmel',   name: 'Himmel',   hex: '#3b9eff' },
    { key: 'ozean',    name: 'Ozean',    hex: '#4f5bd5' },
    { key: 'lavendel', name: 'Lavendel', hex: '#a78bfa' },
    { key: 'flieder',  name: 'Flieder',  hex: '#d946ef' },
    { key: 'beere',    name: 'Beere',    hex: '#9d174d' },
  ];
  const colorOf = k => HEART_COLORS.find(c => c.key === k);

  // gewählte Farbe, sonst automatisch eine freie (nach Anlegedatum: zuerst Rosa, dann Himmel)
  function heartColors() {
    const people = [meUser, partner].filter(Boolean).sort((a, b) => (a.created || '').localeCompare(b.created || ''));
    const taken = new Set(people.map(u => u.heart_color).filter(colorOf));
    const out = {};
    for (const u of people) {
      let k = colorOf(u.heart_color) ? u.heart_color : null;
      if (!k) { k = ['rosa', 'himmel', ...HEART_COLORS.map(c => c.key)].find(x => !taken.has(x)); taken.add(k); }
      out[u.id] = colorOf(k);
    }
    return { me: out[meUser?.id] || HEART_COLORS[0], partner: out[partner?.id] || HEART_COLORS[7] };
  }

  let heartKey = '';
  function renderHearts() {
    const c = heartColors();
    const key = c.me.key + '/' + c.partner.key + '/' + (partner?.avatar || '') + (partner?.name || '');
    if (key === heartKey) return;
    heartKey = key;
    document.dispatchEvent(new CustomEvent('wir:hearts', { detail: { me: c.me.hex, partner: c.partner.hex } }));
    $('heartColors').replaceChildren(...HEART_COLORS.map(col => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'hc-btn';
      b.style.setProperty('--c', col.hex);
      const mine = col.key === c.me.key, theirs = col.key === c.partner.key;
      b.classList.toggle('on', mine);
      b.classList.toggle('taken', theirs);
      b.setAttribute('aria-pressed', mine);
      b.setAttribute('aria-label', col.name + (theirs ? ' – hat schon ' + (partner?.name || 'Schatz') : ''));
      b.title = col.name;
      if (theirs) {
        const av = document.createElement('span');
        av.className = 'avatar hc-av';
        paintAvatar(av, partner);
        b.append(av);
      }
      b.addEventListener('click', () => pickHeart(col, theirs, b));
      return b;
    }));
  }

  async function pickHeart(col, theirs, btn) {
    const st = $('heartColorStatus');
    if (theirs) { st.textContent = col.name + ' hat schon ' + (partner?.name || 'Schatz') + ' 💗 – such dir eine andere aus.'; UI.shake(btn); return; }
    if (meUser?.heart_color === col.key) return;
    try {
      meUser = await pb.collection('users').update(myId(), { heart_color: col.key });
      renderHearts();
      st.textContent = col.name + ' ist jetzt deine Herzfarbe ✓';
      const r = btn.getBoundingClientRect();
      UI.burst(r.left + r.width / 2, r.top + r.height / 2, 10);
    } catch (err) {
      const taken = err?.response?.data?.heart_color?.code === 'validation_not_unique';
      st.textContent = taken ? 'Die hat sich gerade ' + (partner?.name || 'Schatz') + ' geschnappt 💗' : 'Speichern fehlgeschlagen: ' + errText(err);
      await loadPeople().catch(console.error);
    }
  }

  // ======================================================================
  // Zusammen-Timer
  // ======================================================================
  let since = DEFAULT_SINCE;
  let sinceRec = null;
  const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const valid = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

  function setText(id, v) {
    const e = $(id);
    const s = String(v);
    if (e.textContent !== s) e.textContent = s;
  }

  function tick() {
    const [y, m, d] = since.split('-').map(Number);
    const nowW = UI.berlinWall(Date.now());      // Berliner Uhrzeit als Rechenwert
    const startW = Date.UTC(y, m - 1, d);         // 00:00 am Starttag
    let Y = 0, M = 0, D = 0, h = 0, mi = 0, s = 0, total = 0;
    if (nowW >= startW) {
      total = Math.floor((nowW - startW) / DAY);
      const n = new Date(nowW);
      Y = n.getUTCFullYear() - y;
      M = n.getUTCMonth() - (m - 1);
      D = n.getUTCDate() - d;
      if (D < 0) { M--; D += new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 0)).getUTCDate(); }
      if (M < 0) { Y--; M += 12; }
      const rest = nowW % DAY;
      h = Math.floor(rest / 3600000);
      mi = Math.floor(rest % 3600000 / 60000);
      s = Math.floor(rest % 60000 / 1000);
    }
    setText('dayCount', total);
    setText('tY', Y); setText('tM', M); setText('tD', D);
    setText('th', h); setText('tm', mi); setText('ts', s);
  }

  function renderSince() {
    const [y, m, d] = since.split('-').map(Number);
    $('sinceText').textContent = `Seit ${d}. ${MONTHS[m - 1]} ${y}`;
    if (document.activeElement !== $('sinceInput')) $('sinceInput').value = since;
    tick();
  }

  async function loadSince() {
    try {
      sinceRec = await pb.collection('shared_settings').getFirstListItem('key = "together_since"');
      if (valid(sinceRec.value)) since = sinceRec.value;
    } catch (err) {
      if (err?.status !== 404) throw err;
      sinceRec = null;
    }
    renderSince();
  }

  $('sinceInput').addEventListener('change', async () => {
    const v = $('sinceInput').value;
    if (!valid(v)) return;
    if (v > new Date().toISOString().slice(0, 10)) { $('sinceStatus').textContent = 'Bitte kein Datum in der Zukunft 💭'; return; }
    try {
      const data = { value: v, updated_by: myId() };
      sinceRec = sinceRec
        ? await pb.collection('shared_settings').update(sinceRec.id, data)
        : await pb.collection('shared_settings').create({ key: 'together_since', ...data });
      since = v;
      renderSince();
      $('sinceStatus').textContent = 'Gespeichert ✓ – gilt für euch beide';
    } catch (err) {
      $('sinceStatus').textContent = 'Speichern fehlgeschlagen: ' + errText(err);
    }
  });

  renderSince();
  // jede Sekunde, aber nur wenn die App sichtbar ist
  setInterval(() => { if (!document.hidden) tick(); }, 1000);

  // ======================================================================
  // Start
  // ======================================================================
  async function start() {
    started = true;
    await Promise.all([loadPeople(), loadSince()].map(p => p.catch(console.error)));
    pb.collection('users').subscribe('*', () => loadPeople().catch(console.error)).catch(console.error);
    pb.collection('shared_settings').subscribe('*', () => loadSince().catch(console.error)).catch(console.error);
  }

  document.addEventListener('wir:show', e => {
    if (!started) return;
    if (e.detail === 's-settings') { $('avatarStatus').textContent = ''; $('sinceStatus').textContent = ''; $('heartColorStatus').textContent = ''; }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !started || !pb.authStore.isValid) return;
    loadPeople().catch(console.error);
    loadSince().catch(console.error);
  });

  // Profil schon vor dem Laden der restlichen Daten zeigen (Login liegt im localStorage)
  if (pb.authStore.isValid) { meUser = pb.authStore.record || pb.authStore.model; renderPeople(); }
  document.addEventListener('wir:started', () => { if (!started) start(); });
})();
