/* Seitenmenü auf/zu: Pfeil, Hintergrund, Esc oder Reiter-Wechsel schließt es */
(() => {
  const b = document.body;
  const set = o => {
    b.classList.toggle('nav-open', o);
    const h = document.getElementById('navHandle'); if (h) h.setAttribute('aria-expanded', String(o));
  };
  document.getElementById('navHandle')?.addEventListener('click', () => set(true));
  document.getElementById('navBackdrop')?.addEventListener('click', () => set(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
  document.addEventListener('wir:show', () => set(false));
})();
