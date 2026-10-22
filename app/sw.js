const CACHE = 'wir-v13'; // bei jeder neuen App-Version erhöhen -> Update-Hinweis
const SHELL = ['/', '/index.html', '/style.css', '/app.js', '/extra.js', '/home.js', '/games.js', '/games.css', '/lib/chess.js', '/lib/mono.js', '/mono-ui.js', '/lib/pocketbase.umd.js', '/manifest.json', '/icons/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener('message', e => { if (e.data?.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const p = new URL(e.request.url).pathname;
  if (e.request.method !== 'GET' || p.startsWith('/api/') || p.startsWith('/_/')) return;
  e.respondWith(
    fetch(e.request)
      .then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request))
  );
});

// ---------- Push ----------
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Wir 💕', {
    body: d.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: d.tag,
    data: { go: d.go || 's-final' },
  }));
});

// Tippen auf die Benachrichtigung: offene App nach vorne holen und passenden Bereich zeigen
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const go = e.notification.data?.go || 's-final';
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
