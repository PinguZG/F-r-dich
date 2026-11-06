// Update-Hinweis + „App neu laden“ für Wir und die Spiele-App (/shared/update.js).
// Registriert den Service Worker der App (/sw.js). Ändert sich dort CACHE, erscheint oben
// „✨ Neue Version – tippen zum Aktualisieren“. Knopf #reloadBtn (Einstellungen) lädt sofort neu.
(() => {
  const updateBar = document.createElement('button');
  updateBar.className = 'update-bar';
  updateBar.type = 'button';
  updateBar.textContent = '✨ Neue Version';
  updateBar.addEventListener('click', reloadApp);
  document.body.append(updateBar);
  document.getElementById('reloadBtn')?.addEventListener('click', reloadApp);

  let swReg = null;
  async function reloadApp() {
    updateBar.textContent = '✨ Lädt …';
    try {
      if (swReg) {
        await swReg.update().catch(() => {});
        swReg.waiting?.postMessage({ type: 'SKIP_WAITING' });
      }
    } finally {
      location.reload();
    }
  }

  // laufende Version (Cache-Name aus sw.js) für die Einstellungen: [data-wir-version] füllen, window.WIR_VERSION + Ereignis wir:version
  function showVersion(v) {
    if (!v) return;
    window.WIR_VERSION = v;
    document.querySelectorAll('[data-wir-version]').forEach(el => { el.textContent = v; });
    document.dispatchEvent(new CustomEvent('wir:version', { detail: v }));
  }
  async function readVersion() {
    const sw = navigator.serviceWorker?.controller;
    if (sw) {
      const v = await new Promise(res => {
        const t = setTimeout(() => res(''), 1500);
        navigator.serviceWorker.addEventListener('message', function on(e) {
          if (e.data?.type !== 'VERSION') return;
          clearTimeout(t); navigator.serviceWorker.removeEventListener('message', on); res(e.data.v);
        });
        sw.postMessage({ type: 'VERSION' });
      });
      if (v) return showVersion(v);
    }
    // ältere sw.js ohne Antwort: der eigene Cache heißt wie die Version
    try { showVersion((await caches.keys()).filter(k => /^wir-v\d+$/.test(k)).sort((a, b) => parseInt(b.slice(5)) - parseInt(a.slice(5)))[0] || ''); } catch (_) {}
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
    readVersion();
    navigator.serviceWorker.addEventListener('controllerchange', () => readVersion());
    const hadController = !!navigator.serviceWorker.controller;
    // Wand-Tablet (Zuhause im Vollbild, niemand tippt den Hinweis an): nach 1 Min. ohne Berührung selbst neu laden
    let idleT = 0;
    const autoReload = () => {
      clearTimeout(idleT);
      idleT = setTimeout(() => { if (document.body.classList.contains('zh-full') && !document.hidden) reloadApp(); else autoReload(); }, 60000);
    };
    const showUpdate = () => {
      updateBar.classList.add('show');
      if (idleT) return;
      autoReload();
      ['pointerdown', 'keydown'].forEach(t => document.addEventListener(t, () => { if (idleT) autoReload(); }, { passive: true }));
    };
    navigator.serviceWorker.ready.then(reg => {
      swReg = reg;
      if (reg.waiting && hadController) showUpdate();
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => {
          if ((w.state === 'installed' || w.state === 'activated') && hadController) showUpdate();
        });
      });
      // regelmäßig nach einer neuen Version schauen
      setInterval(() => reg.update().catch(() => {}), 10 * 60000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) showUpdate(); });
  }
})();
