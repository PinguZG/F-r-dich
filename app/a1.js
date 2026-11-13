// Design A1 (27.10.2026): kleine Verdrahtungen für die neue Oberfläche, ohne die Logik der Bereiche anzufassen.
// - „+“-Knopf in Erinnerungen öffnet das Hochlade-Sheet (Bildunterschrift + Fotos wählen, Upload macht app.js)
// - Kachel „Shop“ auf Start öffnet den Shop im Coins-Sheet
// - data-scroll="<id>" an einem data-go-Knopf scrollt nach dem Seitenwechsel zu diesem Abschnitt
(() => {
  const $ = id => document.getElementById(id);

  $('memFab')?.addEventListener('click', () => {
    UI.sheet('memUpSheet');
    setTimeout(() => $('caption')?.focus(), 350);
  });
  // Fotos gewählt -> Sheet zu, Fortschritt steht in Erinnerungen (#memStatus)
  $('fileInput')?.addEventListener('change', () => UI.sheet('memUpSheet', false));

  document.addEventListener('click', e => {
    if (e.target.closest('[data-shop]')) { window.WIR_COINS?.openSheet('shop'); return; }
    const b = e.target.closest('[data-go][data-scroll]');
    if (b) setTimeout(() => $(b.dataset.scroll)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 80);
  });

  // Wischen (13.11.2026): links/rechts wechselt zwischen den fünf Hauptreitern der unteren Leiste.
  // Nur auf den Hauptseiten (nicht Unterseiten, nicht Zuhause mit eigener Navigation), nicht in Eingaben/Zeichenfläche/
  // waagerecht scrollbaren Bereichen und nicht bei offenem Sheet. Es wird der Leistenknopf geklickt – die Seitenlogik bleibt unberührt.
  const ORDER = ['s-home', 's-memories', 's-zuhause', 's-games', 's-wir'];
  let sw = null;
  const blocked = el => !!el.closest('input,textarea,select,canvas,.sheet-wrap,[data-noswipe],.folder-bar,.theme-picker,.g-grid');
  const hScroll = el => { for (let n = el; n && n !== document.body; n = n.parentElement) if (n.scrollWidth > n.clientWidth + 8 && /(auto|scroll)/.test(getComputedStyle(n).overflowX)) return true; return false; };
  document.addEventListener('touchstart', e => {
    sw = null;
    if (e.touches.length !== 1 || blocked(e.target) || hScroll(e.target)) return;
    const cur = ORDER.find(id => $(id)?.classList.contains('active'));
    if (!cur || cur === 's-zuhause' || document.querySelector('.sheet-wrap.open')) return;
    sw = { x: e.touches[0].clientX, y: e.touches[0].clientY, cur, t: Date.now() };
  }, { passive: true });
  document.addEventListener('touchend', e => {
    if (!sw) return;
    const t = e.changedTouches[0], dx = t.clientX - sw.x, dy = t.clientY - sw.y, s = sw; sw = null;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.8 || Date.now() - s.t > 700) return;
    const i = ORDER.indexOf(s.cur) + (dx < 0 ? 1 : -1);
    if (i < 0 || i >= ORDER.length) return;
    document.querySelector(`.tab-btn[data-go="${ORDER[i]}"]`)?.click();
  }, { passive: true });
})();

// Start (13.11.2026): große Uhr + Datum (Berliner Zeit) und „Wiedersehen in N Tagen“ aus dem nächsten Date (extra.js: WIR_COUNTDOWN)
(() => {
  const $ = id => document.getElementById(id);
  const tf = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hour12: false });
  const df = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'long', day: 'numeric', month: 'long' });
  const set = (id, t) => { const e = $(id); if (e && e.textContent !== t) e.textContent = t; };
  function tick() {
    const d = new Date();
    set('stClock', tf.format(d));
    set('stDate', df.format(d));
  }
  function meet() {
    const ms = window.WIR_COUNTDOWN?.next?.();
    const btn = $('stMeet');
    if (!btn) return;
    if (!ms) { set('stMeetText', 'Date planen'); btn.dataset.plan = '1'; return; }
    delete btn.dataset.plan;
    const n = Math.round((UI.berlinMidnight(ms) - UI.berlinMidnight()) / UI.DAY);
    set('stMeetText', n <= 0 ? 'Heute Wiedersehen' : n === 1 ? 'Wiedersehen morgen' : `Wiedersehen in ${n} Tagen`);
  }
  $('stMeet')?.addEventListener('click', e => { if (e.currentTarget.dataset.plan) { e.stopPropagation(); window.WIR_DATES?.openForm?.(); } }, true);
  const all = () => { tick(); meet(); };
  all();
  setInterval(() => { if (!document.hidden) all(); }, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) all(); });
  document.addEventListener('wir:show', all);
  document.addEventListener('wir:started', () => { all(); setTimeout(all, 1500); });
  // extra.js füllt #homeMeet, sobald die Dates geladen sind
  const hm = $('homeMeet');
  if (hm) new MutationObserver(meet).observe(hm, { subtree: true, childList: true, characterData: true, attributes: true });
})();
