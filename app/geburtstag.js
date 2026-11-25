/* Geburtstags-Diashow auf der Startseite (Ida, 26.11.): ab 0:00 Uhr laufen alle Erinnerungen automatisch durch,
   darunter „Alles Gute zum Geburtstag“. Jedes Jahr am 26.11. Daniel sieht die Vorschau schon 14 Tage vorher.
   Fotos: Collection photos (wie Reiter „Erinnerungen“), nur lesen. Datum/Uhrzeit vom Gerät. */
(function () {
  const MONTH = 10, DAY = 26;                       // 26. November (Monat 0-basiert)
  const PREVIEW_DAYS = 14, SLIDE_MS = 5000, DAY_MS = 864e5;
  const pb = () => window.WIR_PB;
  const me = () => { const p = pb(); return (p && (p.authStore.record || p.authStore.model)) || null; };
  const isDaniel = () => { const u = me(); return !!u && (/daniel/i.test(u.name || '') || /^daniel/i.test(u.email || '')); };
  const bday = () => new Date(new Date().getFullYear(), MONTH, DAY, 0, 0, 0, 0).getTime();
  // 'day' = Geburtstag (alle), 'preview' = nur Daniel vorab, null = nichts
  function state() {
    if (!me()) return null;
    const n = Date.now(), b = bday(), e = b + DAY_MS;
    if (n >= b && n < e) return 'day';
    if (isDaniel() && n >= b - PREVIEW_DAYS * DAY_MS && n < b) return 'preview';
    return null;
  }
  let box = null, list = [], idx = 0, front = 0, timer = null, token = '', loaded = false, loading = false;
  const url = p => pb().files.getURL(p, p.image, { thumb: '900x0', token });
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  async function load() {
    if (loaded || loading) return; loading = true;
    try {
      try { token = await pb().files.getToken(); } catch (_) {}
      list = await pb().collection('photos').getFullList({ sort: 'created', fields: 'id,collectionId,collectionName,image,caption', requestKey: null });
      list = list.filter(p => p.image);
      loaded = true;
    } catch (e) { console.warn('[geburtstag] Fotos nicht geladen', e && e.message); }
    loading = false;
    if (box) start();
  }
  function show(i) {
    if (!box || !list.length) return;
    const imgs = box.querySelectorAll('.bd-i'), nxt = imgs[1 - front], p = list[i % list.length];
    nxt.onload = () => { nxt.classList.add('on'); imgs[front].classList.remove('on'); front = 1 - front; const c = box.querySelector('.bd-cap'); if (c) c.textContent = p.caption || ''; };
    nxt.onerror = () => { idx++; };
    nxt.alt = p.caption || 'Erinnerung'; nxt.src = url(p);
  }
  function start() {
    clearInterval(timer); if (!box) return;
    const stg = box.querySelector('.bd-stage'); if (stg) stg.hidden = !list.length;
    if (!list.length) return;
    show(0); idx = 1;
    timer = setInterval(() => {
      if (document.hidden || !box || !box.isConnected) return;
      const home = document.getElementById('s-home'); if (home && !home.classList.contains('active')) return;
      show(idx); idx = (idx + 1) % list.length;
    }, SLIDE_MS);
  }
  function mount(st) {
    const home = document.getElementById('s-home'); if (!home) return;
    box = document.createElement('div'); box.id = 'bdBox'; box.className = 'bd';
    box.innerHTML = (st === 'preview' ? '<div class="bd-prev">Vorschau für dich: Ida sieht das erst am 26.11. ab 0:00 Uhr.</div>' : '') +
      '<div class="bd-card glass"><div class="bd-stage"><img class="bd-i on" alt="" decoding="async"><img class="bd-i" alt="" decoding="async"></div><div class="bd-cap" aria-live="off"></div>' +
      '<div class="bd-txt"><b>Alles Gute zum Geburtstag 💗</b><span>Ich liebe dich mehr als alles andere</span></div></div>';
    home.insertBefore(box, home.firstChild);
    front = 0; if (loaded) start(); else load();
  }
  function unmount() { clearInterval(timer); timer = null; if (box) box.remove(); box = null; }
  function check() {
    const st = state();
    if (st && !box) mount(st);
    else if (!st && box) unmount();
    else if (st === 'day' && box && box.querySelector('.bd-prev')) { unmount(); mount(st); }    // um 0:00 Vorschau-Hinweis weg
  }
  document.addEventListener('wir:started', () => { check(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  setInterval(check, 4000);                           // trifft 0:00 Uhr auf wenige Sekunden genau
  window.WIR_BDAY = { check, state };
})();
