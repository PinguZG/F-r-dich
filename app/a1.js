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
