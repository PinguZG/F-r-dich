// Startseite + Einstellungen: Zusammen-Timer ("Zusammen seit" für beide in shared_settings), Profilbilder.
// Farbwelt + Herzfarbe kommen aus /shared/look.js (gelten auch in der Spiele-App). Nutzt die PocketBase-Verbindung von app.js.
(() => {
  const pb = window.WIR_PB;
  const $ = id => document.getElementById(id);
  const myId = () => (pb.authStore.record || pb.authStore.model)?.id;
  const DAY = 86400000;
  const DEFAULT_SINCE = '2026-04-10';
  let started = false;
  let meUser = null, partner = null;
  const errText = UI.errText;

  // ======================================================================
  // Profilbilder (Personen lädt /shared/look.js und meldet sie mit 'wir:users')
  // ======================================================================
  const paintAvatar = (el, u) => WIR_LOOK.paintAvatar(el, u, el?.id === 'meBtn' ? ' – Einstellungen' : '');

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
  }
  document.addEventListener('wir:users', e => { meUser = e.detail.me; partner = e.detail.partner; renderPeople(); });

  $('avatarFile').addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      $('avatarStatus').textContent = 'Lade hoch …';
      const fd = new FormData();
      fd.append('avatar', await UI.shrink(f, 512, 0.88), 'avatar.jpg');
      WIR_LOOK.setMe(await pb.collection('users').update(myId(), fd));
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
      WIR_LOOK.setMe(await pb.collection('users').update(myId(), { avatar: null }));
      $('avatarStatus').textContent = 'Entfernt ✓';
    } catch (err) {
      $('avatarStatus').textContent = 'Ging nicht: ' + errText(err);
    }
  });

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
  }

  function renderSince() {
    const [y, m, d] = since.split('-').map(Number);
    $('sinceText').textContent = `Zusammen seit ${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`;
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
      $('sinceStatus').textContent = 'Gespeichert ✓';
    } catch (err) {
      $('sinceStatus').textContent = 'Speichern fehlgeschlagen: ' + errText(err);
    }
  });

  renderSince();
  // Tageszähler: einmal pro Minute reicht (keine laufenden Sekunden)
  setInterval(() => { if (!document.hidden) tick(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });

  // ======================================================================
  // Start
  // ======================================================================
  async function start() {
    started = true;
    await loadSince().catch(console.error);
    pb.collection('shared_settings').subscribe('*', () => loadSince().catch(console.error)).catch(console.error);
  }

  document.addEventListener('wir:show', e => {
    if (!started) return;
    if (e.detail === 's-settings') { $('avatarStatus').textContent = ''; $('sinceStatus').textContent = ''; }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !started || !pb.authStore.isValid) return;
    loadSince().catch(console.error);
  });

  // Profil schon vor dem Laden der restlichen Daten zeigen (Login liegt im localStorage)
  if (pb.authStore.isValid) { meUser = pb.authStore.record || pb.authStore.model; renderPeople(); }
  document.addEventListener('wir:started', () => { if (!started) start(); });
})();
