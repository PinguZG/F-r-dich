/// <reference path="../pb_data/types.d.ts" />
// Konsole-Befehl /b: welche Benachrichtigungen wer bekommen hat (Log schreibt der Dienst wir-push).
routerAdd('GET', '/api/console/push', (e) => {
  const q = e.request.url.query();
  const limit = Math.max(1, Math.min(200, parseInt(q.get('limit'), 10) || 30));
  const who = String(q.get('user') || '').toLowerCase();
  const users = e.app.findRecordsByFilter('users', "id != ''", 'created', 10, 0);
  const names = {};
  users.forEach(u => { names[u.id] = u.getString('name'); });
  const ids = users.filter(u => !who || u.getString('name').toLowerCase().indexOf(who) === 0).map(u => u.id);
  if (!ids.length) return e.json(200, []);
  const params = {};
  const filter = ids.map((id, i) => { params['u' + i] = id; return `user = {:u${i}}`; }).join(' || ');
  const rows = e.app.findRecordsByFilter('push_log', filter, '-created', limit, 0, params);
  return e.json(200, rows.map(r => ({
    time: r.getString('created'), to: names[r.getString('user')] || '?', category: r.getString('category'),
    title: r.getString('title'), body: r.getString('body'), sent: r.getInt('sent'), error: r.getString('error'),
  })));
}, $apis.requireAuth('users'));

cronAdd('push_log_cleanup', '17 4 * * *', () => {
  try {
    const old = $app.findRecordsByFilter('push_log', "created < {:t}", '', 500, 0, { t: new Date(Date.now() - 90 * 86400000).toISOString().replace('T', ' ') });
    old.forEach(r => $app.delete(r));
  } catch (_) {}
});
