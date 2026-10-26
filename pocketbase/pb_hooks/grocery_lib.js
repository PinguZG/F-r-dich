// Einkaufsliste-Pushs für wir_einkauf.pb.js: sammeln und höchstens alle 10 Minuten einen Push an die andere Person.
const wir = require(`${__hooks}/wir_lib.js`);

const GAP = 10 * 60000;    // höchstens ein Push alle 10 Minuten
const QUIET = 60000;       // nach dem ersten Artikel kurz warten, damit mehrere zusammenkommen

function added(app, rec) {
  if (rec.getBool('done')) return;
  const uid = rec.getString('author');
  const to = wir.partnerOf(app, uid).id;
  let name = 'Dein Schatz';
  try { name = app.findRecordById('users', uid).getString('name') || name; } catch (_) {}
  const item = (rec.getString('emoji') ? rec.getString('emoji') + ' ' : '') + rec.getString('name');
  const title = n => n === 1 ? `🛒 ${name} hat etwas auf die Einkaufsliste gesetzt` : `🛒 ${name} hat ${n} Sachen auf die Einkaufsliste gesetzt`;
  // noch nicht verschickter Push? -> dazurechnen
  let pending = null;
  try { pending = app.findFirstRecordByFilter('push_queue', "user = {:u} && kind = 'grocery' && sent_at = ''", { u: to }); } catch (_) {}
  if (pending) {
    const n = (pending.getInt('count') || 1) + 1;
    const body = pending.getString('body');
    pending.set('count', n);
    pending.set('title', title(n));
    pending.set('body', ((body ? body + ', ' : '') + item).slice(0, 180));
    app.save(pending);
    return;
  }
  // letzter verschickter Push -> frühestens 10 Minuten danach
  let after = Date.now() + QUIET;
  const last = app.findRecordsByFilter('push_queue', "user = {:u} && kind = 'grocery' && sent_at != ''", '-sent_at', 1, 0, { u: to });
  if (last.length) after = Math.max(after, wir.fromPb(last[0].getString('sent_at')) + GAP);
  wir.enqueue(app, { user: to, kind: 'grocery', title: title(1), body: item, url: '/', sendAfter: after });
}

module.exports = { added };
