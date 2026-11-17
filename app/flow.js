// Flow (17.11.2026): weiche Tipp-Welle an jeder Berührung (Knöpfe, Kacheln, Reiter, Chips), nur Optik.
(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const SEL = 'button,a,[data-go],.st-tile,.tab-btn,.pack-btn,[role=button]';
  document.addEventListener('pointerdown', e => {
    if (!e.target.closest?.(SEL) || e.target.closest('input,textarea,select,.switch,canvas,.glass-heart')) return;
    const r = document.createElement('i'); r.className = 'flow-rip';
    r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px';
    document.body.append(r); setTimeout(() => r.remove(), 700);
  }, { passive: true });
})();
