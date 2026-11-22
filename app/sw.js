const CACHE = 'wir-v113'; // bei jeder neuen App-Version erhöhen -> Update-Hinweis
const SHELL = ['/', '/index.html', '/style.css', '/app.js', '/extra.js', '/home.js', '/manifest.json', '/icons/icon-192.png',
  '/games.js', '/games.css', '/lib/chess.js', '/lib/mono.js', '/mono-ui.js', '/coins.js', '/coins.css', '/casino.js', '/casino.css',
  '/dates.js', '/lib/grocery-catalog.js', '/grocery.js', '/care.js', '/chat.js', '/shop.js', '/chessai.js', '/solitaire.js', '/snake.js', '/frames.css', '/layout.css', '/drawer.css', '/drawer.js', '/tutorial.css', '/tutorial.js', '/a1.css', '/a1.js', '/draw.css', '/match.css', '/tablet.css', '/draw.js', '/brushes.js', '/drawpro.js', '/drawpro.css', '/party.js', '/party.css', '/puzzle.js', '/puzzle.css', '/swipe.js', '/swipe.css', '/poker.js', '/herzspur.js', '/zuhause.js', '/zuhause-verlauf.js', '/zuhause-data.js', '/zuhause-extra.js', '/zuhause-tab.js', '/zuhause-tab-markup.js', '/zuhause-tab.css', '/zuhause-handy.js', '/zuhause-handy.css', '/zuhause-claude.js', '/zuhause-claude.css', '/zuhause-pastell.css', '/zuhause-claude-svg.js', '/zuhause-claude-verlauf.js', '/zuhause-claude-luma.js',
  '/shared/base.css', '/shared/activity.css', '/shared/ui.js', '/shared/pocketbase.umd.js', '/shared/look.js', '/shared/push.js', '/shared/activity.js', '/shared/update.js', '/shared/changelog.js',
  '/shared/fx.js', '/shared/fx.css', '/blume.js', '/blume.css', '/liebe.js',
  '/lernen.js', '/englisch.js', '/politik.js', '/kunst.js', '/kunst.css', '/lernen/kunst-data.js', '/lernen/kunst/cezanne-badende.jpg', '/lernen/kunst/cezanne-bucht.jpg', '/lernen/kunst/cezanne-selbst.jpg', '/lernen/kunst/cezanne-stillleben.jpg', '/lernen/kunst/cezanne-victoire.jpg', '/lernen/kunst/cezanne-victoire1880.jpg', '/lernen/kunst/cezanne-victoire1895.jpg', '/lernen/kunst/degas-tanz.jpg', '/lernen/kunst/gauguin-bretoninnen.jpg', '/lernen/kunst/gauguin-eifersuechtig.jpg', '/lernen/kunst/gauguin-gottessohn.jpg', '/lernen/kunst/gauguin-selbst.jpg', '/lernen/kunst/gauguin-woher.jpg', '/lernen/kunst/gogh-gachet.jpg', '/lernen/kunst/gogh-kurtisane.jpg', '/lernen/kunst/gogh-selbst.jpg', '/lernen/kunst/gogh-sonnenblumen.jpg', '/lernen/kunst/gogh-sternennacht.jpg', '/lernen/kunst/gogh-weizenfeld.jpg', '/lernen/kunst/hiroshige-bruecke.jpg', '/lernen/kunst/hiroshige-gogh-pflaume.jpg', '/lernen/kunst/hiroshige-gogh-regen.jpg', '/lernen/kunst/hiroshige-midera.jpg', '/lernen/kunst/hiroshige-odawara.jpg', '/lernen/kunst/hokusai-hodogaya.jpg', '/lernen/kunst/hokusai-welle.jpg', '/lernen/kunst/kimono.jpg', '/lernen/kunst/kuniyoshi-faecher.jpg', '/lernen/kunst/kuniyoshi-tsukuda.jpg', '/lernen/kunst/manet-fruehstueck.jpg', '/lernen/kunst/manet-im-boot.jpg', '/lernen/kunst/manet-olympia.jpg', '/lernen/kunst/manet-zola.jpg', '/lernen/kunst/monet-bruecke.jpg', '/lernen/kunst/monet-gartenweg.jpg', '/lernen/kunst/monet-heuhaufen-abend.jpg', '/lernen/kunst/monet-heuhaufen-schnee.jpg', '/lernen/kunst/monet-impression.jpg', '/lernen/kunst/monet-japonaise.jpg', '/lernen/kunst/monet-palazzo.jpg', '/lernen/kunst/monet-rouen1.jpg', '/lernen/kunst/monet-rouen2.jpg', '/lernen/kunst/monet-seerosen1906.jpg', '/lernen/kunst/monet-seerosen1920.jpg', '/lernen/kunst/monet-sonnenschirm.jpg', '/lernen/kunst/morisot-boot.jpg', '/lernen/kunst/pissarro-havre.jpg', '/lernen/kunst/renoir-grenouillere.jpg', '/lernen/kunst/renoir-moulin.jpg', '/lernen/kunst/utamaro-schoenen.jpg', '/lernen/kunst/zettel-impressionismus.jpg', '/lernen/kunst/zettel-impressionismus2.jpg', '/lernen/kunst/zettel-japonismus.jpg', '/lernen.css', '/flow.css', '/flow.js', '/lernen/lernen-data.js', '/lernen/politik-data.js', '/lernen/lernen-gens.js', '/lernen/lernen-pruef.js', '/lernen/lernen-klausur.js', '/lernen/vendor/pdf.min.js', '/lernen/vendor/pdf.worker.min.js', '/lernen/englisch-data.js', '/lernen/englisch-doodles.js', '/lernen/files/netz.html', '/lernen/files/elek.html', '/lernen/files/wiso.html'];

self.addEventListener('install', e => {
  // cache:'reload': beim Installieren nie alte Dateien aus dem Browser-Cache übernehmen
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))));
  self.skipWaiting();
});
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (e.data?.type === 'VERSION') e.source?.postMessage({ type: 'VERSION', v: CACHE });   // Anzeige in den Einstellungen
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const p = new URL(e.request.url).pathname;
  if (e.request.method !== 'GET' || p.startsWith('/api/') || p.startsWith('/_/')) return;
  e.respondWith(
    // no-cache: immer beim Server nachfragen (kurze 304-Antwort, wenn unverändert) – sonst konnte der Browser-Cache
    // trotz neuer App-Version alte Dateien liefern (Server schickt kein Cache-Control).
    (e.request.mode === 'navigate' ? fetch(e.request) : fetch(e.request, { cache: 'no-cache' }))
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
