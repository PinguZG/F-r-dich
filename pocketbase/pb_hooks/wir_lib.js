// Hilfsfunktionen für wir_extra.pb.js (wird dort per require() geladen).
// Alle Zeiten werden in Europe/Berlin gerechnet.

const DAY = 86400000;
const pad = n => String(n).padStart(2, '0');

// PocketBase-Datumsformat: "2026-10-21 16:00:00.000Z"
const toPb = ms => new Date(ms).toISOString().replace('T', ' ');
const fromPb = s => (s ? new Date(String(s).replace(' ', 'T')).getTime() : NaN);

// Sommerzeit in Europa: letzter Sonntag im März 01:00 UTC bis letzter Sonntag im Oktober 01:00 UTC
function lastSundayUtc(year, month0) {
  const d = new Date(Date.UTC(year, month0 + 1, 0, 1));
  return d.getTime() - d.getUTCDay() * DAY;
}
function berlinOffsetMs(ms) {
  const y = new Date(ms).getUTCFullYear();
  const summer = ms >= lastSundayUtc(y, 2) && ms < lastSundayUtc(y, 9);
  return (summer ? 2 : 1) * 3600000;
}
function berlin(ms) {
  const d = new Date(ms + berlinOffsetMs(ms));
  const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
  return { y, m, d: day, h: d.getUTCHours(), min: d.getUTCMinutes(), key: `${y}-${pad(m + 1)}-${pad(day)}` };
}
// Tag (YYYY-MM-DD) in Berlin, um n Tage verschoben
function berlinDayKey(ms, plusDays) {
  const b = berlin(ms);
  const d = new Date(Date.UTC(b.y, b.m, b.d + (plusDays || 0)));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// Die jeweils andere Person (es gibt genau zwei Nutzer)
function partnerOf(app, userId) {
  const others = app.findRecordsByFilter('users', 'id != {:id}', '', 10, 0, { id: userId });
  if (others.length !== 1) throw new BadRequestError('Es muss genau zwei Nutzer geben.');
  return others[0];
}

function isMuted(app, userId, field) {
  try {
    const p = app.findFirstRecordByFilter('notify_prefs', 'user = {:u}', { u: userId });
    return p.getBool(field);
  } catch (_) {
    return false; // keine Einstellung gespeichert -> an
  }
}

// Push in die Warteschlange legen; mit key nur einmal (eindeutiger Index als Absicherung)
function enqueue(app, o) {
  if (o.key) {
    try {
      app.findFirstRecordByFilter('push_queue', 'key = {:k}', { k: o.key });
      return false;
    } catch (_) { /* noch nicht vorhanden */ }
  }
  const r = new Record(app.findCollectionByNameOrId('push_queue'));
  r.set('user', o.user);
  r.set('kind', o.kind);
  r.set('title', o.title);
  r.set('body', o.body || '');
  r.set('url', o.url || '/');
  r.set('key', o.key || '');
  r.set('count', o.count || 1);
  r.set('send_after', toPb(o.sendAfter || Date.now()));
  try {
    app.save(r);
    return true;
  } catch (err) {
    if (o.key) return false; // parallel schon angelegt
    throw err;
  }
}

const OW_TITLE = n => n > 1 ? `💌 ${n} neue Öffne-wenn-Nachrichten für dich` : '💌 Neue Öffne-wenn-Nachricht für dich';

// Neue Nachricht -> innerhalb einer Minute bündeln
function queueOpenWhen(app, recipientId) {
  if (isMuted(app, recipientId, 'mute_openwhen')) return;
  let pending = null;
  try {
    pending = app.findFirstRecordByFilter('push_queue', "user = {:u} && kind = 'openwhen' && sent_at = ''", { u: recipientId });
  } catch (_) { /* keine offene */ }
  if (pending) {
    const n = (pending.getInt('count') || 1) + 1;
    pending.set('count', n);
    pending.set('title', OW_TITLE(n));
    app.save(pending);
    return;
  }
  enqueue(app, { user: recipientId, kind: 'openwhen', title: OW_TITLE(1), url: '/#open-when', sendAfter: Date.now() + 60000 });
}

// Läuft jede Minute: Vortag 18:00 + am Tag selbst 08:00
function meetingTick(app) {
  const now = Date.now();
  const b = berlin(now);
  const eve = b.h >= 18 && b.h < 22;   // falls der Pi um 18:00 gerade aus war: bis 21:59 nachholen
  const day = b.h >= 8 && b.h < 12;
  if (!eve && !day) return;

  const today = berlinDayKey(now, 0), tomorrow = berlinDayKey(now, 1);
  const meetings = app.findRecordsByFilter('meetings', 'when >= {:from} && when <= {:to}', 'when', 50, 0,
    { from: toPb(now), to: toPb(now + 3 * DAY) });

  let eveDay = null, todayDue = false;
  for (const m of meetings) {
    const k = berlinDayKey(fromPb(m.getString('when')), 0);
    if (eve && k === tomorrow) eveDay = k;
    if (day && k === today) todayDue = true;
  }
  if (!eveDay && !todayDue) return;

  const users = app.findRecordsByFilter('users', "id != ''", '', 10, 0);
  for (const u of users) {
    if (isMuted(app, u.id, 'mute_meetings')) continue;
    if (eveDay) enqueue(app, { user: u.id, kind: 'meeting', title: 'Morgen sehen wir uns 💗', key: `meet:eve:${eveDay}:${u.id}` });
    if (todayDue) enqueue(app, { user: u.id, kind: 'meeting', title: 'Heute sehen wir uns 💗', key: `meet:day:${today}:${u.id}` });
  }
}

// Alte, verschickte Pushs aufräumen
function cleanupQueue(app) {
  const old = app.findRecordsByFilter('push_queue', "sent_at != '' && sent_at < {:t}", '', 500, 0, { t: toPb(Date.now() - 30 * DAY) });
  for (const r of old) app.delete(r);
}

module.exports = { toPb, fromPb, berlin, berlinDayKey, partnerOf, isMuted, enqueue, queueOpenWhen, meetingTick, cleanupQueue };
