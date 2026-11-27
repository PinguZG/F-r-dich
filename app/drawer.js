/* Seitenmenü auf/zu: Pfeil, Hintergrund, Esc oder Reiter-Wechsel schließt es */
(() => {
  const b = document.body;
  const set = o => {
    b.classList.toggle('nav-open', o);
    const h = document.getElementById('navHandle'); if (h) h.setAttribute('aria-expanded', String(o));
  };
  const h = document.getElementById('navHandle');
  // Pfeil frei verschiebbar: gedrückt halten und ziehen; Position wird auf diesem Gerät gemerkt (wir-nav-pos)
  const KEY = 'wir-nav-pos';
  const place = (x, y) => {
    const w = h.offsetWidth || 34, ht = h.offsetHeight || 96;
    x = Math.max(0, Math.min(innerWidth - w, x)); y = Math.max(0, Math.min(innerHeight - ht, y));
    h.classList.add('free'); h.style.left = x + 'px'; h.style.top = y + 'px'; h.style.marginTop = '0';
    return [x, y];
  };
  const restore = () => { try { const p = JSON.parse(localStorage.getItem(KEY) || 'null'); if (p && h) place(p.x * innerWidth, p.y * innerHeight); } catch (_) {} };
  let drag = null, moved = false;
  h?.addEventListener('pointerdown', e => { const r = h.getBoundingClientRect(); drag = { dx: e.clientX - r.left, dy: e.clientY - r.top, sx: e.clientX, sy: e.clientY }; moved = false; h.setPointerCapture?.(e.pointerId); });
  h?.addEventListener('pointermove', e => {
    if (!drag) return;
    if (!moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 8) return;
    moved = true; place(e.clientX - drag.dx, e.clientY - drag.dy);
  });
  const end = () => {
    if (drag && moved) { const r = h.getBoundingClientRect(); try { localStorage.setItem(KEY, JSON.stringify({ x: r.left / innerWidth, y: r.top / innerHeight })); } catch (_) {} }
    drag = null;
  };
  h?.addEventListener('pointerup', end); h?.addEventListener('pointercancel', end);
  h?.addEventListener('click', e => { if (moved) { moved = false; e.preventDefault(); return; } set(true); });
  addEventListener('resize', restore); restore();
  document.getElementById('navBackdrop')?.addEventListener('click', () => set(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
  document.addEventListener('wir:show', () => set(false));
})();
