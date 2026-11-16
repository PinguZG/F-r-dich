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
