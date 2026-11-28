// Fernschalter „Küss mich“ (28.11.2026): Daniel schaltet in den Einstellungen ein Pop-up auf Idas Seite an/aus.
// Zustand liegt serverseitig in app_flags (key „kuss“, on). Nur Daniel darf ihn ändern (API-Regel). Bei Ida erscheint mitten auf dem Bildschirm ein großes Pop-up
// ohne Schließen-Knopf, solange der Schalter an ist; wird er ausgeschaltet, verschwindet es sofort (Live-Update + Abfrage alle 30 s / beim Zurückkehren in die App).
(() => {
  const pb = window.WIR_PB;
  if (!pb) return;
  const $ = id => document.getElementById(id);
  const me = () => pb.authStore.record || pb.authStore.model;
  const isDaniel = () => { const u = me(); return !!u && (/daniel/i.test(u.name || '') || /^daniel/i.test(u.email || '')); };
  let rec = null, ov = null;

  async function fetchFlag() {
    try { rec = await pb.collection('app_flags').getFirstListItem('key = "kuss"', { requestKey: null }); }
    catch (e) { if (e.status === 404) rec = null; else return; }
    apply();
  }
  function apply() {
    const on = !!(rec && rec.on);
    const sw = $('kussSwitch'); if (sw && document.activeElement !== sw) sw.checked = on;
    if (!pb.authStore.isValid || isDaniel() || !on) { if (ov) { ov.remove(); ov = null; document.body.classList.remove('kuss-on'); } return; }
    if (ov) return;
    ov = document.createElement('div'); ov.id = 'kussOv'; ov.setAttribute('role', 'alertdialog'); ov.setAttribute('aria-label', 'Küss mich');
    ov.innerHTML = '<div class="kuss-box"><div class="kuss-lips" aria-hidden="true">💋</div><div class="kuss-t">Küss mich</div></div>';
    document.body.appendChild(ov); document.body.classList.add('kuss-on');
  }
  async function setFlag(on) {
    try {
      if (rec) rec = await pb.collection('app_flags').update(rec.id, { on }, { requestKey: null });
      else rec = await pb.collection('app_flags').create({ key: 'kuss', on }, { requestKey: null });
    } catch (e) { const sw = $('kussSwitch'); if (sw) sw.checked = !on; alert('Ging nicht: ' + (e?.message || e)); }
  }
  function mountSwitch() {
    const card = $('kussCard'); if (card) card.hidden = !(pb.authStore.isValid && isDaniel());
    const sw = $('kussSwitch'); if (sw && !sw.dataset.b) { sw.dataset.b = '1'; sw.addEventListener('change', () => setFlag(sw.checked)); }
  }
  async function start() {
    mountSwitch(); await fetchFlag();
    try { await pb.collection('app_flags').subscribe('*', e => { if (e.record?.key === 'kuss') { rec = e.action === 'delete' ? null : e.record; apply(); } }); } catch (_) {}
  }
  document.addEventListener('wir:started', start);
  document.addEventListener('wir:show', e => { if (e.detail === 's-settings') mountSwitch(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && pb.authStore.isValid) fetchFlag(); });
  setInterval(() => { if (!document.hidden && pb.authStore.isValid) fetchFlag(); }, 30000);
  if (pb.authStore.isValid) fetchFlag();
})();
