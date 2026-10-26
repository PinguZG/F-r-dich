// Stimmung, Support-Anfragen und Chat für wir_chat.pb.js.
const wir = require(`${__hooks}/wir_lib.js`);
const nameOf = (app, id) => { try { return app.findRecordById('users', id).getString('name') || 'Dein Schatz'; } catch (_) { return 'Dein Schatz'; } };

// ---------- Stimmung: unter 50 % einmal melden, erneut erst nach einem Wert ≥ 50 ----------
function moodSaved(app, rec) {
  const uid = rec.getString('user'), v = rec.getInt('value');
  let f;
  try { f = app.findFirstRecordByFilter('mood_flags', 'user = {:u}', { u: uid }); }
  catch (_) { f = new Record(app.findCollectionByNameOrId('mood_flags')); f.set('user', uid); f.set('low', false); }
  if (v < 50 && !f.getBool('low')) {
    f.set('low', true);
    app.save(f);
    wir.enqueue(app, { user: wir.partnerOf(app, uid).id, kind: 'mood', title: `💗 ${nameOf(app, uid)} geht es gerade nicht so gut`, body: `Stimmung ${v} % – vielleicht magst du dich melden`, url: '/' });
    require(`${__hooks}/activity_lib.js`).log(app, uid, 'fx', 'mood', `Stimmung ${v} % (Partner benachrichtigt)`);
  } else if (v >= 50 && f.getBool('low')) {
    f.set('low', false);
    app.save(f);
  } else if (!f.id) app.save(f);
}

// ---------- Support ----------
const KINDS = { anruf: '📞 Anruf', ablenkung: '🎈 Ablenkung', da: '🫂 einfach da sein', reden: '💬 reden' };
const ANSWERS = { da: 'Bin da 💗', anruf: 'Ruf dich gleich an 📞', gleich: 'Bin gleich für dich da ⏳' };

function supportNew(app, uid, body) {
  const kind = KINDS[body.kind] ? body.kind : 'da';
  const msg = Array.from(String(body.message || '')).filter(ch => ch.codePointAt(0) >= 32).join('').trim().slice(0, 200);
  const to = wir.partnerOf(app, uid).id;
  // ältere offene Anfrage schließen
  for (const o of app.findRecordsByFilter('support_requests', "from = {:u} && status = 'open'", '', 20, 0, { u: uid })) { o.set('status', 'closed'); app.save(o); }
  const r = new Record(app.findCollectionByNameOrId('support_requests'));
  r.set('from', uid); r.set('to', to); r.set('kind', kind); r.set('message', msg); r.set('status', 'open');
  app.save(r);
  wir.enqueue(app, { user: to, kind: 'supportreq', title: `🫂 ${nameOf(app, uid)} braucht dich – ${KINDS[kind]}`, body: msg || 'Tippe, um zu antworten 💗', url: '/' });
  require(`${__hooks}/activity_lib.js`).log(app, uid, 'fx', 'support', `Support angefragt (${KINDS[kind]})`);
  return r;
}

function supportAnswer(app, uid, id, body) {
  let r;
  try { r = app.findRecordById('support_requests', id); } catch (_) { throw new NotFoundError('Anfrage nicht gefunden'); }
  if (r.getString('to') !== uid) throw new ForbiddenError('Nicht deine Anfrage');
  if (r.getString('status') !== 'open') throw new ApiError(409, 'Schon beantwortet 💗');
  const a = ANSWERS[body.answer] ? body.answer : 'da';
  r.set('status', 'answered'); r.set('answer', a); r.set('answered_at', new DateTime());
  app.save(r);
  wir.enqueue(app, { user: r.getString('from'), kind: 'supportans', title: `💗 ${nameOf(app, uid)}: ${ANSWERS[a]}`, body: 'auf deine Support-Anfrage', url: '/' });
  return r;
}

function supportClose(app, uid, id) {
  let r;
  try { r = app.findRecordById('support_requests', id); } catch (_) { throw new NotFoundError('Anfrage nicht gefunden'); }
  if (r.getString('from') !== uid && r.getString('to') !== uid) throw new ForbiddenError('Nicht deine Anfrage');
  r.set('status', 'closed'); app.save(r);
  return r;
}

// ---------- Chat ----------
const CHAT_DELAY = 15000; // so lange warten; wer in der Zeit liest, bekommt keinen Push

function chatCreated(app, rec) {
  const uid = rec.getString('from'), to = rec.getString('to');
  const n = nameOf(app, uid);
  const preview = rec.getString('text') ? rec.getString('text').slice(0, 120) : '📷 Bild';
  let pending = null;
  try { pending = app.findFirstRecordByFilter('push_queue', "user = {:u} && kind = 'chat' && sent_at = ''", { u: to }); } catch (_) {}
  if (pending) {
    const c = (pending.getInt('count') || 1) + 1;
    pending.set('count', c);
    pending.set('title', `💬 ${n} (${c} Nachrichten)`);
    pending.set('body', preview);
    pending.set('send_after', wir.toPb(Date.now() + CHAT_DELAY));
    app.save(pending);
    return;
  }
  wir.enqueue(app, { user: to, kind: 'chat', title: `💬 ${n}`, body: preview, url: '/', sendAfter: Date.now() + CHAT_DELAY });
}

// alles an mich bis jetzt als gelesen markieren; offenen Push zurückziehen
function chatRead(app, uid) {
  const rows = app.findRecordsByFilter('chat_messages', "to = {:u} && read_at = ''", '', 500, 0, { u: uid });
  const now = new DateTime();
  for (const r of rows) { r.set('read_at', now); app.saveNoValidate(r); }
  try {
    for (const p of app.findRecordsByFilter('push_queue', "user = {:u} && kind = 'chat' && sent_at = ''", '', 20, 0, { u: uid })) app.delete(p);
  } catch (_) {}
  return rows.length;
}

const REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥', '🥰'];
function chatReact(app, uid, id, body) {
  let r;
  try { r = app.findRecordById('chat_messages', id); } catch (_) { throw new NotFoundError('Nachricht nicht gefunden'); }
  if (r.getString('from') !== uid && r.getString('to') !== uid) throw new ForbiddenError('Nicht deine Nachricht');
  let map = {};
  try { map = JSON.parse(r.getString('reactions') || '{}') || {}; } catch (_) {}
  const e = String(body.emoji || '');
  if (!e || map[uid] === e) delete map[uid]; else if (REACTIONS.indexOf(e) >= 0) map[uid] = e;
  r.set('reactions', map);
  app.saveNoValidate(r);
  return r;
}

module.exports = { moodSaved, supportNew, supportAnswer, supportClose, chatCreated, chatRead, chatReact, KINDS, ANSWERS };
