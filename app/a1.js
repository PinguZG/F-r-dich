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
})();
