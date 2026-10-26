// Push-Benachrichtigungen für Wir und die Spiele-App (/shared/push.js). Jedes Abo merkt sich seine App
// (push_subs.app = window.WIR_APP.name), damit wir-push Spiel-Pushs an die Spiele-App und alles andere an Wir schickt.
// Gleicher VAPID-Schlüssel für beide Apps. Zeigt den Stand in #pushState, Knopf #pushBtn2.
// Stellt window.WIR_PUSH = { sync, drop } bereit (drop beim Abmelden).
(() => {
  const pb = window.WIR_PB;
  const $ = id => document.getElementById(id);
  const me = () => (pb.authStore.record || pb.authStore.model)?.id;
  const APP = window.WIR_APP?.name || 'wir';
  const TITLE = window.WIR_APP?.title || 'Wir';

  const VAPID_PUBLIC_KEY = 'BFC5kOFZukTWvDdPBC__t2Mr0CvHR_CFy4QVMz13XZYJFwA1Z0UgRNer3zuYJlFiidYTBQpj8vsa3tonUB5l3Ag';
  const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  let pushActive = false, started = false;

  function keyBytes(s) {
    const b = atob((s + '='.repeat((4 - s.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(b, c => c.charCodeAt(0));
  }

  async function currentSub() {
    const reg = await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
  }

  async function saveSub(sub) {
    const j = sub.toJSON();
    const mine = await pb.collection('push_subs').getFullList({ filter: pb.filter('endpoint = {:e}', { e: j.endpoint }) });
    if (mine.length) return;
    await pb.collection('push_subs').create({ user: me(), app: APP, endpoint: j.endpoint, keys: j.keys, ua: navigator.userAgent.slice(0, 300) });
  }

  const notUnique = err => err?.response?.data?.endpoint?.code === 'validation_not_unique';

  function renderPush(note) {
    if (!$('pushState')) return;
    const can = pushSupported() && Notification.permission !== 'denied';
    $('pushBtn2').hidden = pushActive || !can;
    let txt;
    if (pushActive) txt = 'Auf diesem Handy aktiv ✓';
    else if (!pushSupported()) txt = standalone() ? 'Dieses Gerät kann leider keine Benachrichtigungen 🥺'
      : 'Öffne die App über das Symbol auf dem Home-Bildschirm, dann kannst du sie hier aktivieren.';
    else if (Notification.permission === 'denied') txt = `Blockiert – erlaube sie in den iPhone-Einstellungen → Mitteilungen → ${TITLE}.`;
    else txt = 'Noch aus auf diesem Handy.';
    $('pushState').textContent = note || txt;
  }

  // beim Start: vorhandene Subscription (ggf. neu) speichern
  async function syncPush() {
    pushActive = false;
    if (pushSupported() && Notification.permission === 'granted') {
      const sub = await currentSub();
      if (sub) {
        try { await saveSub(sub); pushActive = true; }
        catch (err) {
          // gehört noch zum anderen Account (z.B. nach Abmelden) -> neu anfordern lassen
          if (notUnique(err)) await sub.unsubscribe().catch(() => {});
          else console.error(err);
        }
      }
    }
    renderPush();
  }

  async function enablePush(btn) {
    // requestPermission muss direkt im Tap passieren (iOS)
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { renderPush(perm === 'denied' ? null : 'Nicht erlaubt – du kannst es jederzeit nochmal versuchen.'); return; }
    try {
      const reg = await navigator.serviceWorker.ready;
      const opts = { userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) };
      let sub = await reg.pushManager.getSubscription() || await reg.pushManager.subscribe(opts);
      try { await saveSub(sub); }
      catch (err) {
        if (!notUnique(err)) throw err;
        await sub.unsubscribe();
        sub = await reg.pushManager.subscribe(opts);
        await saveSub(sub);
      }
      pushActive = true;
      renderPush();
      const r = btn.getBoundingClientRect();
      UI.burst(r.left + r.width / 2, r.top + r.height / 2, 18);
    } catch (err) {
      console.error(err);
      renderPush('Aktivieren fehlgeschlagen: ' + UI.errText(err));
    }
  }
  $('pushBtn2')?.addEventListener('click', () => enablePush($('pushBtn2')));

  async function dropPush() {
    if (!pushSupported()) return;
    const sub = await currentSub();
    if (!sub) return;
    const recs = await pb.collection('push_subs').getFullList({ filter: pb.filter('endpoint = {:e}', { e: sub.endpoint }) });
    await Promise.all(recs.map(r => pb.collection('push_subs').delete(r.id)));
    await sub.unsubscribe();
  }

  document.addEventListener('wir:show', e => { if (started && e.detail === 's-settings') renderPush(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !started || !pb.authStore.isValid) return;
    syncPush().catch(console.error);
  });
  document.addEventListener('wir:started', () => { if (!started) { started = true; syncPush().catch(console.error); } });

  window.WIR_PUSH = { sync: syncPush, drop: dropPush };
})();
