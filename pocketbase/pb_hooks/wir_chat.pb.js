/// <reference path="../pb_data/types.d.ts" />
// Stimmung, Support-Anfragen, Chat (Logik in chat_lib.js). Pushs über push_queue (mood, supportreq, supportans, chat).

// ---------- Stimmung ----------
onRecordAfterCreateSuccess((e) => {
  try { require(`${__hooks}/chat_lib.js`).moodSaved(e.app, e.record); } catch (err) { e.app.logger().error('mood', 'error', String(err)); }
  e.next();
}, 'moods');

// ---------- Support ----------
routerAdd('POST', '/api/support', (e) => e.json(200, require(`${__hooks}/chat_lib.js`).supportNew(e.app, e.auth.id, e.requestInfo().body || {})), $apis.requireAuth('users'));
routerAdd('POST', '/api/support/{id}/answer', (e) => e.json(200, require(`${__hooks}/chat_lib.js`).supportAnswer(e.app, e.auth.id, e.request.pathValue('id'), e.requestInfo().body || {})), $apis.requireAuth('users'));
routerAdd('POST', '/api/support/{id}/close', (e) => e.json(200, require(`${__hooks}/chat_lib.js`).supportClose(e.app, e.auth.id, e.request.pathValue('id'))), $apis.requireAuth('users'));

// ---------- Chat ----------
// Empfänger setzt der Server (immer die andere Person); gelesen/Reaktionen nie vom Client beim Anlegen
onRecordCreateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    const wir = require(`${__hooks}/wir_lib.js`);
    e.record.set('to', wir.partnerOf(e.app, e.auth.id).id);
    e.record.set('read_at', '');
    e.record.set('reactions', {});
    if (!e.record.getString('text').trim() && !e.record.getString('image')) throw new BadRequestError('Leere Nachricht');
  }
  e.next();
}, 'chat_messages');

onRecordAfterCreateSuccess((e) => {
  try { require(`${__hooks}/chat_lib.js`).chatCreated(e.app, e.record); } catch (err) { e.app.logger().error('chat push', 'error', String(err)); }
  e.next();
}, 'chat_messages');

routerAdd('POST', '/api/chat/read', (e) => e.json(200, { read: require(`${__hooks}/chat_lib.js`).chatRead(e.app, e.auth.id) }), $apis.requireAuth('users'));
routerAdd('POST', '/api/chat/{id}/react', (e) => e.json(200, require(`${__hooks}/chat_lib.js`).chatReact(e.app, e.auth.id, e.request.pathValue('id'), e.requestInfo().body || {})), $apis.requireAuth('users'));

// „schreibt …“: kurze Realtime-Nachricht an die andere Person (Topic "chat-typing"), nichts in der DB
routerAdd('POST', '/api/chat/typing', (e) => {
  const wir = require(`${__hooks}/wir_lib.js`);
  const to = wir.partnerOf(e.app, e.auth.id).id;
  const msg = new SubscriptionMessage({ name: 'chat-typing', data: JSON.stringify({ from: e.auth.id, t: Date.now() }) });
  const clients = e.app.subscriptionsBroker().clients();
  for (const cid in clients) {
    const c = clients[cid];
    const auth = c.get('auth');
    if (auth && auth.id === to && c.hasSubscription('chat-typing')) c.send(msg);
  }
  return e.json(200, { ok: true });
}, $apis.requireAuth('users'));
