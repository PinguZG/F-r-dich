// Sync-Knopf + Schütteln für wir_sync.pb.js (wird dort per require() geladen).
// live_state hat genau einen Datensatz pro Person und wird immer überschrieben – es häuft sich nichts an.
// Die Sync-Entscheidung trifft nur der Server (in einer Transaktion), beide Apps hören per Realtime mit.

const wir = require(`${__hooks}/wir_lib.js`);

const HOLD_STALE_MS = 3000;          // ohne Heartbeat gilt Halten nach 3 s als beendet
const SYNC_MS = 1000;                // so lange müssen beide gleichzeitig halten
const HOLD_PUSH_GAP = 10 * 60000;    // Push „hält den Sync-Knopf“ höchstens alle 10 Minuten pro Person
const SHAKE_LIVE_MS = 3000;          // Schütteln wirkt beim Partner noch ~3 s nach
const SHAKE_PUSH_GAP = 30000;        // Push „AHHHH“ höchstens alle 30 s pro Person

const now = () => Date.now();

function nameOf(app, id) {
  try { return app.findRecordById('users', id).getString('name') || 'Dein Schatz'; } catch (_) { return 'Dein Schatz'; }
}

// Datensatz der Person holen oder anlegen
function stateOf(tx, uid) {
  try { return tx.findFirstRecordByFilter('live_state', 'user = {:u}', { u: uid }); } catch (_) { /* neu */ }
  const r = new Record(tx.findCollectionByNameOrId('live_state'));
  r.set('user', uid);
  return r;
}

const isHolding = (r, t) => r.getBool('holding') && r.getInt('hold_until') > t;

function view(r) {
  return {
    user: r.getString('user'), holding: r.getBool('holding'), hold_since: r.getInt('hold_since'), hold_until: r.getInt('hold_until'),
    synced: r.getBool('synced'), sync_at: r.getInt('sync_at'), shake_until: r.getInt('shake_until'), shake_seq: r.getInt('shake_seq'),
  };
}

function partnerOnline(app, pid) {
  try {
    const act = require(`${__hooks}/activity_lib.js`);
    return !!act.presence(app).find(p => p.id === pid && p.online);
  } catch (_) { return false; }
}

// Halten: down = true als Heartbeat (alle ~0,5 s), down = false beim Loslassen
function hold(app, uid, body) {
  const down = !!body.down;
  const partner = wir.partnerOf(app, uid);
  const t = now();
  let me, other, synced = false, started = false;
  app.runInTransaction((tx) => {
    me = stateOf(tx, uid);
    other = stateOf(tx, partner.id);
    const was = isHolding(me, t);
    if (down) {
      if (!was) { me.set('hold_since', t); me.set('synced', false); started = true; }
      me.set('holding', true);
      me.set('hold_until', t + HOLD_STALE_MS);
      // beide halten gleichzeitig seit mindestens 1 s und keiner hat in diesem Halten schon gesynct
      if (isHolding(other, t) && !me.getBool('synced') && !other.getBool('synced')
        && t - Math.max(me.getInt('hold_since'), other.getInt('hold_since')) >= SYNC_MS) {
        synced = true;
        for (const r of [me, other]) { r.set('synced', true); r.set('sync_at', t); }
        tx.save(other);
      }
    } else {
      me.set('holding', false);
      me.set('hold_until', t);
      me.set('synced', false); // nach dem Loslassen wieder auslösbar
    }
    if (started && !partnerOnline(tx, partner.id) && t - me.getInt('hold_push_at') >= HOLD_PUSH_GAP) {
      me.set('hold_push_at', t);
      started = 'push';
    }
    tx.save(me);
  });
  const name = nameOf(app, uid);
  if (started === 'push') {
    wir.enqueue(app, { user: partner.id, kind: 'sync', title: `💞 ${name} hält den Sync-Knopf`, body: 'Halt ihn auch gedrückt – zusammen seid ihr in sync', url: '/' });
  }
  if (synced) {
    const act = require(`${__hooks}/activity_lib.js`);
    act.log(app, uid, 'fx', 'sync', `In sync 💞 mit ${nameOf(app, partner.id)}`);
    act.log(app, partner.id, 'fx', 'sync', `In sync 💞 mit ${name}`);
  }
  return { me: view(me), partner: view(other), synced };
}

// Schütteln: Lebenszeichen höchstens ~1×/s, solange geschüttelt wird
function shake(app, uid) {
  const partner = wir.partnerOf(app, uid);
  const t = now();
  let me, burst = false, push = false;
  app.runInTransaction((tx) => {
    me = stateOf(tx, uid);
    burst = me.getInt('shake_until') < t;              // neue Schüttel-Runde (für das Log)
    me.set('shake_until', t + SHAKE_LIVE_MS);
    me.set('shake_seq', me.getInt('shake_seq') + 1);
    if (t - me.getInt('shake_push_at') >= SHAKE_PUSH_GAP) { me.set('shake_push_at', t); push = true; }
    tx.save(me);
  });
  const name = nameOf(app, uid);
  if (push) wir.enqueue(app, { user: partner.id, kind: 'shake', title: 'AHHHH', body: `${name} schüttelt das Handy 💥`, url: '/' });
  if (burst) require(`${__hooks}/activity_lib.js`).log(app, uid, 'fx', 'shake', 'hat geschüttelt 💥');
  return { me: view(me), pushed: push };
}

module.exports = { hold, shake, HOLD_STALE_MS, SYNC_MS, SHAKE_LIVE_MS };
