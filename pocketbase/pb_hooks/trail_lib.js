// Herzspur-Hilfen für wir_herzspur.pb.js (Route-Handler sehen keine Funktionen außerhalb, daher per require).

function trailLoad(app, id, uid) {
  let m;
  try { m = app.findRecordById('trail_matches', id); } catch (_) { throw new NotFoundError('Match nicht gefunden'); }
  if (m.getString('p1') !== uid && m.getString('p2') !== uid) throw new ForbiddenError('Nicht dein Match');
  return m;
}

// an alle Realtime-Verbindungen der ANDEREN Person, die das Topic abonniert haben
function trailRelay(app, m, fromUid, data) {
  const to = m.getString('p1') === fromUid ? m.getString('p2') : m.getString('p1');
  const topic = 'trail/' + m.id;
  const msg = new SubscriptionMessage({ name: topic, data: JSON.stringify(data) });
  const clients = app.subscriptionsBroker().clients();
  let n = 0;
  for (const cid in clients) {
    const c = clients[cid];
    if (!c.hasSubscription(topic)) continue;
    const auth = c.get('auth');
    if (!auth || auth.id !== to) continue;
    c.send(msg); n++;
  }
  return n;
}

module.exports = { trailLoad, trailRelay };
