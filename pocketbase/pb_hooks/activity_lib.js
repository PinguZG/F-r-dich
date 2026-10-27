// Aktivitäts-Log + Online-Status für wir_activity.pb.js (wird dort per require() geladen).
// Der Client schickt höchstens einmal pro Minute einen "Herzschlag" mit gesammelten Ereignissen (Batching).
// Eine Sitzung = App sichtbar von–bis. Online = Sitzung nicht beendet und letzter Herzschlag < 150 s her.

const wir = require(`${__hooks}/wir_lib.js`);

const ONLINE_MS = 150 * 1000;       // so lange gilt man nach dem letzten Herzschlag als online
const RESUME_MS = 180 * 1000;       // offene Sitzung wird bis dahin fortgesetzt
const REOPEN_MS = 30 * 1000;        // kurz weg und wieder da -> dieselbe Sitzung
const KEEP_DAYS = 90;
const AREAS = [
  's-home', 's-memories', 's-plans', 's-dates', 's-meetings', 's-clay', 's-clay-done', 's-tab', 's-newtab', 's-date', 's-grocery', 's-chat', 's-snake',
  's-openwhen', 's-wir', 's-games', 's-chess', 's-sudoku', 's-ttt', 's-mono', 's-bj', 's-settings', 's-console', 's-draw', 's-canvas',
  's-duo', 's-brain', 's-casino', 's-shop', // Spiele-App (s-games = deren Startseite)
];
const SEEN = ['photo', 'tab'];

const now = () => Date.now();
const ms = (s) => wir.fromPb(s);
const clampStr = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

function newRec(app, o) {
  const r = new Record(app.findCollectionByNameOrId('activity'));
  r.set('user', o.user);
  r.set('kind', o.kind);
  r.set('area', o.area || '');
  r.set('detail', clampStr(o.detail, 120));
  r.set('started', wir.toPb(o.started));
  r.set('ended', wir.toPb(o.ended != null ? o.ended : o.started));
  r.set('secs', Math.max(0, Math.round(o.secs || 0)));
  r.set('closed', !!o.closed);
  return r;
}

// Ereignis direkt vom Server (z. B. Brief geöffnet, Sudoku gelöst). Fehler dürfen nie etwas anderes verhindern.
function log(app, user, kind, area, detail) {
  try { app.save(newRec(app, { user, kind, area, detail, started: now() })); }
  catch (err) { app.logger().error('activity log', 'error', String(err)); }
}

function lastSession(app, uid) {
  const [s] = app.findRecordsByFilter('activity', "user = {:u} && kind = 'session'", '-started', 1, 0, { u: uid });
  return s || null;
}

// Herzschlag: Sitzung fortsetzen/anlegen/beenden + gesammelte Ereignisse speichern
function beat(app, uid, body) {
  const t = now();
  const closing = body.state === 'close';
  const events = Array.isArray(body.events) ? body.events.slice(0, 60) : [];
  app.runInTransaction((tx) => {
    let s = lastSession(tx, uid);
    const ended = s ? ms(s.getString('ended')) : 0;
    const fresh = s && ((!s.getBool('closed') && t - ended <= RESUME_MS) || (s.getBool('closed') && t - ended <= REOPEN_MS));
    if (fresh) {
      s.set('closed', false);
    } else {
      s = newRec(tx, { user: uid, kind: 'session', started: t });
    }
    s.set('ended', wir.toPb(t));
    s.set('secs', Math.round((t - ms(s.getString('started'))) / 1000));
    if (closing) s.set('closed', true);
    tx.save(s);

    for (const ev of events) {
      if (!ev || typeof ev !== 'object') continue;
      const kind = ev.t === 'view' ? 'view' : ev.t === 'seen' ? 'seen' : '';
      if (!kind) continue;
      const area = String(ev.a || '');
      if (kind === 'view' && AREAS.indexOf(area) < 0) continue;
      if (kind === 'seen' && SEEN.indexOf(area) < 0) continue;
      let e = Number(ev.e) || t, st = Number(ev.s) || e;
      e = Math.min(e, t + 5000);
      st = Math.max(Math.min(st, e), t - 6 * 3600 * 1000);
      const secs = Math.round((e - st) / 1000);
      if (kind === 'view' && secs < 2) continue;
      tx.save(newRec(tx, { user: uid, kind, area, detail: ev.d, started: st, ended: e, secs }));
    }
  });
  return presence(app);
}

function presence(app) {
  const t = now();
  const users = app.findRecordsByFilter('users', "id != ''", 'created', 10, 0);
  return users.map(u => {
    const s = lastSession(app, u.id);
    const last = s ? ms(s.getString('ended')) : 0;
    return {
      id: u.id,
      name: u.getString('name'),
      online: !!s && !s.getBool('closed') && t - last <= ONLINE_MS,
      last_seen: s ? s.getString('ended') : '',
    };
  });
}

// ---------- Konsole ----------
function online(app) {
  const t = now();
  return presence(app).map(p => {
    const rows = app.findRecordsByFilter('activity', "user = {:u} && kind = 'session'", '-started', 12, 0, { u: p.id });
    return Object.assign(p, {
      sessions: rows.map((s, i) => {
        const open = i === 0 && p.online;
        return { start: s.getString('started'), end: s.getString('ended'), secs: s.getInt('secs'), open };
      }),
    });
  });
}

function activityLog(app, q) {
  const limit = Math.max(1, Math.min(300, parseInt(q.limit, 10) || 60));
  const users = app.findRecordsByFilter('users', "id != ''", 'created', 10, 0);
  const names = Object.fromEntries(users.map(u => [u.id, u.getString('name')]));
  const who = String(q.user || '').toLowerCase();
  const ids = users.filter(u => !who || u.getString('name').toLowerCase().indexOf(who) === 0).map(u => u.id);
  if (!ids.length) return [];
  const filter = '(' + ids.map((_, i) => `user = {:u${i}}`).join(' || ') + ')';
  const params = Object.assign({}, ...ids.map((id, i) => ({ ['u' + i]: id })));
  const rows = app.findRecordsByFilter('activity', filter, '-started', limit * 2, 0, params);
  const t = now();
  const out = [];
  for (const r of rows) {
    const base = { who: names[r.getString('user')] || '?', area: r.getString('area'), detail: r.getString('detail'), secs: r.getInt('secs') };
    if (r.getString('kind') === 'session') {
      const end = ms(r.getString('ended'));
      const live = !r.getBool('closed') && t - end <= ONLINE_MS;
      if (!live) out.push(Object.assign({}, base, { kind: 'close', time: r.getString('ended') }));
      out.push(Object.assign({}, base, { kind: 'open', time: r.getString('started') }));
    } else {
      out.push(Object.assign({}, base, { kind: r.getString('kind'), time: r.getString('started') }));
    }
  }
  out.sort((a, b) => ms(b.time) - ms(a.time));
  return out.slice(0, limit);
}

// Alles älter als 90 Tage löschen
function cleanup(app) {
  const t = wir.toPb(now() - KEEP_DAYS * 86400000);
  app.db().newQuery('DELETE FROM activity WHERE started < {:t}').bind({ t }).execute();
}

// ---------- Sudoku: angefangen / gelöst -> Log + Push an die andere Person ----------
const SUDOKU_LEVEL = { easy: 'Leicht', medium: 'Mittel', hard: 'Schwer' };

function sudokuStarted(app, rec) {
  try {
    const orig = rec.original();
    const puzzle = rec.getString('puzzle');
    if (!puzzle || (orig && orig.getString('puzzle') === puzzle)) return;
    const games = require(`${__hooks}/spiele_lib.js`);
    const uid = rec.getString('user');
    const level = SUDOKU_LEVEL[rec.getString('difficulty')] || '';
    log(app, uid, 'game', 'sudoku', `Sudoku angefangen (${level})`);
    games.push(app, wir.partnerOf(app, uid).id, 'sudoku', `🧩 ${games.nameOf(app, uid)} hat ein Sudoku angefangen`, `Stufe: ${level}`);
  } catch (err) {
    app.logger().error('sudoku start', 'error', String(err));
  }
}

function sudokuSolved(app, rec) {
  try {
    const games = require(`${__hooks}/spiele_lib.js`);
    const uid = rec.getString('user');
    const secs = rec.getInt('seconds');
    const time = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    const text = `${SUDOKU_LEVEL[rec.getString('difficulty')] || ''}, ${time} min, ${rec.getInt('points')} Punkte`;
    log(app, uid, 'game', 'sudoku', `Sudoku gelöst (${text})`);
    games.push(app, wir.partnerOf(app, uid).id, 'sudoku', `🧩 ${games.nameOf(app, uid)} hat ein Sudoku gelöst`, text);
  } catch (err) {
    app.logger().error('sudoku solved', 'error', String(err));
  }
}

module.exports = { AREAS, beat, presence, online, activityLog, log, cleanup, sudokuStarted, sudokuSolved };
