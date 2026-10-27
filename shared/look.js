// Farbwelt + Herzfarbe für Wir und die Spiele-App (/shared/look.js). Beide stehen im Nutzerprofil
// (users.theme, users.heart_color) und gelten damit in beiden Apps; Änderungen kommen per Realtime an.
// Braucht window.WIR_PB (von der App vor diesem Skript angelegt) und window.UI.
// Stellt window.WIR_LOOK bereit und meldet 'wir:users' ({ me, partner }) und 'wir:hearts' ({ me, partner } als Hex).
(() => {
  const pb = window.WIR_PB;
  const $ = id => document.getElementById(id);
  const myId = () => (pb.authStore.record || pb.authStore.model)?.id;
  let meUser = null, partner = null, started = false;

  // ======================================================================
  // Farbwelt
  // ======================================================================
  const THEMES = {
    rose:        '#fdeef5',
    gluehwein:   '#3e0d1e',
    mondnacht:   '#210635',
    zuckerwatte: '#F4E7F8',
    pfirsich:    '#fffaf6',
    lavendel:    '#f8f2ff',
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
  function paintAvatar(el, u, label) {
    if (!el) return;
    if (u?.avatar) {
      el.style.backgroundImage = `url("${pb.files.getURL(u, u.avatar, { thumb: '200x200' })}")`;
      el.classList.add('has');
    } else {
      el.style.backgroundImage = '';
      el.classList.remove('has');
    }
    el.textContent = initial(u);
    // Profilrahmen aus dem Shop (users.frame)
    for (const c of [...el.classList]) if (c.startsWith('fr-')) el.classList.remove(c);
    if (u?.frame) el.classList.add('fr-' + u.frame);
    el.setAttribute('aria-label', (u?.name || '') + (label || ''));
  }

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
    window.WIR_HEARTS = { me: c.me.hex, partner: c.partner.hex }; // Spiele
    document.dispatchEvent(new CustomEvent('wir:hearts', { detail: { me: c.me.hex, partner: c.partner.hex } }));
    const box = $('heartColors');
    if (!box) return;
    box.replaceChildren(...HEART_COLORS.map(col => {
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
      publish();
      st.textContent = col.name + ' ist jetzt deine Herzfarbe ✓';
      const r = btn.getBoundingClientRect();
      UI.burst(r.left + r.width / 2, r.top + r.height / 2, 10);
    } catch (err) {
      const taken = err?.response?.data?.heart_color?.code === 'validation_not_unique';
      st.textContent = taken ? 'Die hat sich gerade ' + (partner?.name || 'Schatz') + ' geschnappt 💗' : 'Speichern fehlgeschlagen: ' + UI.errText(err);
      await loadUsers().catch(console.error);
    }
  }

  // ======================================================================
  // Nutzer laden + weitermelden
  // ======================================================================
  function publish() {
    renderHearts();
    document.dispatchEvent(new CustomEvent('wir:users', { detail: { me: meUser, partner } }));
  }

  async function loadUsers() {
    const users = await pb.collection('users').getFullList();
    meUser = users.find(u => u.id === myId()) || null;
    partner = users.find(u => u.id !== myId()) || null;
    if (meUser?.theme && meUser.theme !== document.documentElement.dataset.theme) applyTheme(meUser.theme);
    publish();
  }

  // eigenes Profil wurde in der App geändert (z. B. neues Profilbild)
  function setMe(u) { meUser = u; publish(); }

  async function start() {
    started = true;
    await loadUsers().catch(console.error);
    pb.collection('users').subscribe('*', () => loadUsers().catch(console.error)).catch(console.error);
  }

  document.addEventListener('wir:show', e => { if (started && e.detail === 's-settings' && $('heartColorStatus')) $('heartColorStatus').textContent = ''; });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !started || !pb.authStore.isValid) return;
    loadUsers().catch(console.error);
  });
  document.addEventListener('wir:started', () => { if (!started) start(); });

  // Profil schon vor dem Laden zeigen (Login liegt im localStorage)
  if (pb.authStore.isValid) meUser = pb.authStore.record || pb.authStore.model;

  window.WIR_LOOK = {
    paintAvatar, applyTheme, setMe, reload: loadUsers,
    me: () => meUser, partner: () => partner, HEART_COLORS,
  };
})();
