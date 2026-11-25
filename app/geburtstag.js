/* Geburtstags-Diashow auf der Startseite (Ida, 26.11.): ab 0:00 Uhr laufen alle Erinnerungen automatisch durch,
   darunter „Alles Gute zum Geburtstag“. Jedes Jahr am 26.11. Daniel sieht die Vorschau schon 14 Tage vorher.
   Fotos: Collection photos (wie Reiter „Erinnerungen“), nur lesen. Datum/Uhrzeit vom Gerät. */
(function () {
  const MONTH = 10, DAY = 26;                       // 26. November (Monat 0-basiert)
  const PREVIEW_DAYS = 14, SLIDE_MS = 1000, DAY_MS = 864e5;   // jede Sekunde ein neues Bild (Streifen läuft von rechts nach links)
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
  const url = p => pb().files.getURL(p, p.image, { thumb: '600x0', token });
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
  const pre = i => { if (list.length) { const im = new Image(); im.src = url(list[i % list.length]); } };
  function put(slide, p) { const im = slide.firstElementChild; im.alt = p.caption || 'Erinnerung'; im.src = url(p); }
  function tick() {
    if (document.hidden || !box || !box.isConnected || !list.length) return;
    const home = document.getElementById('s-home'); if (home && !home.classList.contains('active')) return;
    const sl = box.querySelectorAll('.bd-s'), cur = sl[front], nxt = sl[1 - front];
    nxt.style.transition = 'none'; nxt.style.transform = 'translateX(100%)';
    put(nxt, list[idx % list.length]);
    void nxt.offsetWidth;
    nxt.style.transition = 'transform .6s ease'; cur.style.transition = 'transform .6s ease';
    nxt.style.transform = 'translateX(0)'; cur.style.transform = 'translateX(-100%)';
    front = 1 - front; idx = (idx + 1) % list.length; pre(idx + 1);
  }
  function start() {
    clearInterval(timer); if (!box) return;
    if (!list.length) return;
    const sl = box.querySelectorAll('.bd-s');
    sl[0].style.transform = 'translateX(0)'; sl[1].style.transform = 'translateX(100%)';
    put(sl[0], list[0]); front = 0; idx = 1 % list.length; pre(idx); pre(idx + 1);
    timer = setInterval(tick, SLIDE_MS);
  }
  function mount(st) {
    const home = document.getElementById('s-home'); if (!home) return;
    box = document.createElement('div'); box.id = 'bdBox'; box.className = 'bd';
    box.innerHTML = (st === 'preview' ? '<div class="bd-prev">Vorschau für dich: Ida sieht das erst am 26.11. ab 0:00 Uhr.</div>' : '') +
      '<div class="bd-card"><div class="bd-cam"><div class="bd-win"><div class="bd-s"><img alt="" decoding="async"></div><div class="bd-s"><img alt="" decoding="async"></div></div>' +
      '<img class="bd-camimg" src="/img/geburtstag-kamera.png" alt="Kamera" decoding="async"></div></div>' +
      '<div class="bd-txt glass"><b>Alles Gute zum Geburtstag 💗</b><span>Ich liebe dich mehr als alles andere</span></div>';
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
