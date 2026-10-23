/// <reference path="../pb_data/types.d.ts" />
// Aktivitäts-Log, Online-Status und Konsole (für beide Personen gleich). Logik in activity_lib.js.
// Außerdem: Push an die schreibende Person, wenn ein Öffne-wenn-Brief geöffnet wird, und Sudoku-Pushs (gestartet/gelöst).
// Gehört nach /home/pingu/pb/pb_hooks/ (zusammen mit activity_lib.js, wir_lib.js, spiele_lib.js).

// ---------- Herzschlag (gesammelte Ereignisse, höchstens ~1×/min) ----------
routerAdd('POST', '/api/act/beat', (e) => {
  const act = require(`${__hooks}/activity_lib.js`);
  return e.json(200, { presence: act.beat(e.app, e.auth.id, e.requestInfo().body || {}) });
}, $apis.requireAuth('users'));

routerAdd('GET', '/api/act/presence', (e) => {
  const act = require(`${__hooks}/activity_lib.js`);
  return e.json(200, { presence: act.presence(e.app) });
}, $apis.requireAuth('users'));

// ---------- Konsole ----------
routerAdd('GET', '/api/console/online', (e) => {
  const act = require(`${__hooks}/activity_lib.js`);
  return e.json(200, act.online(e.app));
}, $apis.requireAuth('users'));

routerAdd('GET', '/api/console/log', (e) => {
  const act = require(`${__hooks}/activity_lib.js`);
  const q = e.request.url.query();
  return e.json(200, act.activityLog(e.app, { limit: q.get('limit'), user: q.get('user') }));
}, $apis.requireAuth('users'));

// ---------- Öffne wenn: Brief geöffnet -> Push an die schreibende Person ----------
onRecordAfterUpdateSuccess((e) => {
  try {
    const before = e.record.original().getString('opened_at');
    if (!before && e.record.getString('opened_at')) {
      const act = require(`${__hooks}/activity_lib.js`);
      const lib = require(`${__hooks}/wir_lib.js`);
      const reader = e.record.getString('recipient'), author = e.record.getString('author');
      let cat = '';
      try { cat = e.app.findRecordById('open_when_categories', e.record.getString('category')).getString('title'); } catch (_) {}
      act.log(e.app, reader, 'seen', 'openwhen', cat);
      let name = 'Dein Schatz';
      try { name = e.app.findRecordById('users', reader).getString('name') || name; } catch (_) {}
      if (author && author !== reader) {
        lib.enqueue(e.app, { user: author, kind: 'owread', title: `💌 ${name} hat deinen Brief geöffnet`, body: cat ? `„Öffne wenn … ${cat}“` : '', url: '/#open-when' });
      }
    }
  } catch (err) {
    e.app.logger().error('openwhen read', 'error', String(err));
  }
  e.next();
}, 'open_when_messages');

// ---------- Sudoku: angefangen / gelöst -> Log + Push an die andere Person ----------
onRecordAfterCreateSuccess((e) => { require(`${__hooks}/activity_lib.js`).sudokuStarted(e.app, e.record); e.next(); }, 'sudoku_progress');
onRecordAfterUpdateSuccess((e) => { require(`${__hooks}/activity_lib.js`).sudokuStarted(e.app, e.record); e.next(); }, 'sudoku_progress');
onRecordAfterCreateSuccess((e) => { require(`${__hooks}/activity_lib.js`).sudokuSolved(e.app, e.record); e.next(); }, 'sudoku_scores');

// ---------- Aufbewahrung: 90 Tage ----------
cronAdd('wir_activity_cleanup', '33 3 * * *', () => {
  const act = require(`${__hooks}/activity_lib.js`);
  try { act.cleanup($app); } catch (err) { $app.logger().error('activity cleanup', 'error', String(err)); }
});
