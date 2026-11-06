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

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
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
