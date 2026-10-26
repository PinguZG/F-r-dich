/// <reference path="../pb_data/types.d.ts" />
// Einkaufsliste: Push an die andere Person, wenn Artikel dazukommen – gebündelt („Ida hat 3 Sachen auf die
// Einkaufsliste gesetzt“) und höchstens alle 10 Minuten. Logik in grocery_lib.js, verschickt von wir-push (Art "grocery").
onRecordAfterCreateSuccess((e) => {
  try { require(`${__hooks}/grocery_lib.js`).added(e.app, e.record); }
  catch (err) { e.app.logger().error('grocery push', 'error', String(err)); }
  e.next();
}, 'grocery_entries');

// wieder auf die Liste gesetzt (done: true -> false) zählt wie neu
onRecordAfterUpdateSuccess((e) => {
  try { if (e.record.original().getBool('done') && !e.record.getBool('done')) require(`${__hooks}/grocery_lib.js`).added(e.app, e.record); }
  catch (err) { e.app.logger().error('grocery push', 'error', String(err)); }
  e.next();
}, 'grocery_entries');
