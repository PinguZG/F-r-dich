const CACHE = 'spiele-v2'; // bei jeder neuen Version der Spiele-App erhöhen -> Update-Hinweis
const SHELL = [
  '/', '/index.html', '/style.css', '/games.css', '/coins.css', '/casino.css',
  '/app.js', '/games.js', '/mono-ui.js', '/coins.js', '/shop.js', '/casino.js', '/lib/chess.js', '/lib/mono.js',
  '/shared/base.css', '/shared/activity.css', '/shared/ui.js', '/shared/pocketbase.umd.js', '/shared/look.js',
  '/shared/push.js', '/shared/activity.js', '/shared/update.js', '/shared/fx.js', '/shared/fx.css',
  '/manifest.json', '/icons/icon-192.png',
];

// Tailscale liefert die Dateien ohne Cache-Control aus -> immer beim Server nachfragen (304 ist billig),
// damit nie eine alte Datei aus dem HTTP-Cache im neuen Cache landet.
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))));
  self.skipWaiting();
});
self.addEventListener('message', e => { if (e.data?.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // API (andere Adresse: wir.geep-flops.ts.net) und Schriften gehen direkt ans Netz
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});

// ---------- Push ----------
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Spiele 🎲', {
    body: d.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: d.tag,
    data: { go: d.go || 's-games' },
  }));
});

// Tippen auf die Benachrichtigung: offene App nach vorne holen und das Spiel zeigen
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const go = e.notification.data?.go || 's-games';
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const win = wins.find(c => new URL(c.url).origin === self.location.origin);
    if (win) {
      await win.focus().catch(() => {});
      win.postMessage({ go });
      return;
    }
    await self.clients.openWindow('/#go=' + encodeURIComponent(go));
  })());
});
