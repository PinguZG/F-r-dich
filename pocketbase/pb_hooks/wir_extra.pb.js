/// <reference path="../pb_data/types.d.ts" />
// Treffen-Countdown + "Öffne wenn …"
// Gehört nach /home/pingu/pb/pb_hooks/ (zusammen mit wir_lib.js).

// ---------- Öffne wenn: Empfänger wird automatisch gesetzt ----------
onRecordCreateRequest((e) => {
  const lib = require(`${__hooks}/wir_lib.js`);
  if (e.auth) e.record.set('recipient', lib.partnerOf(e.app, e.auth.id).id);
  e.next();
}, 'open_when_categories');

onRecordCreateRequest((e) => {
  // Empfänger = Empfänger der Kategorie, noch nicht geöffnet
  const cat = e.app.findRecordById('open_when_categories', e.record.getString('category'));
  e.record.set('recipient', cat.getString('recipient'));
  e.record.set('opened_at', '');
  e.next();
}, 'open_when_messages');

onRecordAfterCreateSuccess((e) => {
  const lib = require(`${__hooks}/wir_lib.js`);
  try {
    lib.queueOpenWhen(e.app, e.record.getString('recipient'));
  } catch (err) {
    e.app.logger().error('open-when push', 'error', String(err));
  }
  e.next();
}, 'open_when_messages');

// Name der anderen Person (für "Nur … kann sie öffnen")
routerAdd('GET', '/api/wir/partner', (e) => {
  const lib = require(`${__hooks}/wir_lib.js`);
  const p = lib.partnerOf(e.app, e.auth.id);
  return e.json(200, { id: p.id, name: p.getString('name') });
}, $apis.requireAuth('users'));

// ---------- Öffne wenn: Empfänger-Ansicht ----------
// Kategorien für mich, nur mit mindestens einer Nachricht (ohne Nachrichteninhalt)
routerAdd('GET', '/api/open-when/categories', (e) => {
  const me = e.auth.id;
  const cats = e.app.findRecordsByFilter('open_when_categories', 'recipient = {:me}', 'order,created', 200, 0, { me });
  const out = [];
  for (const c of cats) {
    const msgs = e.app.findRecordsByFilter('open_when_messages', 'category = {:c} && recipient = {:me}', '', 1000, 0, { c: c.id, me });
    if (!msgs.length) continue;
    out.push({
      id: c.id,
      title: c.getString('title'),
      order: c.getFloat('order'),
      fresh: msgs.some(m => !m.getString('opened_at')),
    });
  }
  return e.json(200, out);
}, $apis.requireAuth('users'));

// Genau eine zufällige Nachricht – bevorzugt ungeöffnete – und opened_at setzen
routerAdd('GET', '/api/open-when/random', (e) => {
  const me = e.auth.id;
  const catId = e.request.url.query().get('category');
  if (!catId) throw new BadRequestError('category fehlt');

  let cat;
  try { cat = e.app.findRecordById('open_when_categories', catId); }
  catch (_) { throw new NotFoundError(); }
  if (cat.getString('recipient') !== me) throw new ForbiddenError();

  const all = e.app.findRecordsByFilter('open_when_messages', 'category = {:c} && recipient = {:me}', '', 1000, 0, { c: catId, me });
  if (!all.length) throw new NotFoundError('Noch keine Nachricht');
  const fresh = all.filter(m => !m.getString('opened_at'));
  const pool = fresh.length ? fresh : all;
  const msg = pool[Math.floor(Math.random() * pool.length)];

  if (!msg.getString('opened_at')) {
    msg.set('opened_at', new DateTime());
    e.app.save(msg);
  }

  let from = '';
  try { from = e.app.findRecordById('users', msg.getString('author')).getString('name'); } catch (_) {}

  return e.json(200, {
    id: msg.id,
    category: cat.getString('title'),
    text: msg.getString('text'),
    from,
    created: msg.getString('created'),
    wasNew: fresh.length > 0,
  });
}, $apis.requireAuth('users'));

// ---------- Treffen: Erinnerungen ----------
cronAdd('wir_meetings', '* * * * *', () => {
  const lib = require(`${__hooks}/wir_lib.js`);
  try { lib.meetingTick($app); }
  catch (err) { $app.logger().error('meeting tick', 'error', String(err)); }
});

cronAdd('wir_push_cleanup', '17 4 * * *', () => {
  const lib = require(`${__hooks}/wir_lib.js`);
  try { lib.cleanupQueue($app); }
  catch (err) { $app.logger().error('push cleanup', 'error', String(err)); }
});
