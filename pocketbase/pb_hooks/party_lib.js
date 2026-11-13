// Zusammen spielen (Garlic-Phone-artig) – Hilfen für wir_party.pb.js (per require geladen, Route-Handler sehen sonst nichts).
// Ablauf: Jede Runde machen BEIDE gleichzeitig je einen Zug an ihrer Kette (chain 0/1). Kette c wird in Runde r von
// Person (c + r) % 2 bearbeitet (0 = p1, 1 = p2). Sind beide Züge da, beginnt die nächste Runde; nach der letzten ist die Partie fertig.
const wir = require(`${__hooks}/wir_lib.js`);

const MODES = {
  normal:     { name: 'Normal',     min: 2, max: 8,  def: 4 },
  complement: { name: 'Complement', min: 3, max: 3,  def: 3 },
  story:      { name: 'Story',      min: 4, max: 10, def: 6 },
  animation:  { name: 'Animation',  min: 4, max: 12, def: 8 },
  knockoff:   { name: 'Knock Off',  min: 2, max: 6,  def: 4 },
};
const GRACE = 30000;                 // so lange nach Ablauf der Zeit wird ein Zug noch angenommen
const MAX_ACTIVE = 4;
const MAX_NEW_PER_DAY = 12;
const COINS = 15, COINS_PER_DAY = 3;

const num = (v, lo, hi, def) => { const n = Math.trunc(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def; };
const kindOf = (mode, r) => (mode === 'normal' || mode === 'story') ? (r % 2 === 0 ? 'text' : 'draw') : mode === 'complement' ? (r === 0 ? 'text' : 'draw') : 'draw';
const actorIdx = (chain, r) => (chain + r) % 2;
const chainOf = (idx, r) => (idx + r) % 2;

function load(app, id) {
  try { return app.findRecordById('party_games', id); } catch (_) { throw new NotFoundError('Partie nicht gefunden'); }
}
function idxOf(g, uid) {
  if (g.getString('p1') === uid) return 0;
  if (g.getString('p2') === uid) return 1;
  throw new ForbiddenError('Das ist nicht deine Partie.');
}
const playerId = (g, idx) => g.getString(idx === 0 ? 'p1' : 'p2');
const nameOf = (app, id) => { try { return app.findRecordById('users', id).getString('name') || 'Dein Schatz'; } catch (_) { return 'Dein Schatz'; } };

function push(app, to, key, title, body) {
  try { wir.enqueue(app, { user: to, kind: 'party', title, body: body || '', url: '/', key, sendAfter: Date.now() + 15000 }); }
  catch (err) { app.logger().error('party push', 'error', String(err)); }
}

function reward(app, g) {
  const coins = require(`${__hooks}/coins_lib.js`);
  for (const idx of [0, 1]) {
    const uid = playerId(g, idx);
    try {
      const mine = app.countRecords('party_steps', $dbx.exp("game = {:g} AND author = {:u} AND kind != 'skip'", { g: g.id, u: uid }));
      if (mine < 1) continue;
      if (coins.countToday(app, uid, 'party') >= COINS_PER_DAY) continue;
      coins.book(app, { user: uid, amount: COINS, reason: 'party', label: '🎨 Zusammen gespielt', ref: g.id, key: `party:${g.id}:${uid}` });
    } catch (err) { app.logger().error('party coins', 'error', String(err)); }
  }
}

// nächste Runde beginnen oder Partie beenden (aufrufen, wenn beide Züge der aktuellen Runde da sind)
function nextRound(app, g, byUid) {
  const r = g.getInt('round') + 1;
  if (r >= g.getInt('rounds')) {
    g.set('status', 'done'); g.set('deadline', '');
    app.save(g);
    reward(app, g);
    for (const idx of [0, 1]) push(app, playerId(g, idx), `party:done:${g.id}:${idx}`, `🎨 ${MODES[g.getString('mode')].name}: Die Aufdeckung ist da`, 'Schau dir die Ergebnisse an');
    return;
  }
  g.set('round', r);
  const t = g.getInt('turn_s');
  g.set('deadline', t > 0 && !g.getBool('paused') ? wir.toPb(Date.now() + t * 1000 + GRACE) : '');
  app.save(g);
  for (const idx of [0, 1]) {
    const uid = playerId(g, idx);
    if (uid !== byUid) push(app, uid, `party:r:${g.id}:${r}:${idx}`, `🎨 Du bist dran bei „${MODES[g.getString('mode')].name}“`, `Runde ${r + 1} von ${g.getInt('rounds')}`);
  }
}

// abgelaufene Runden mit „übersprungen“ füllen (Cron jede Minute)
function tick(app) {
  const now = Date.now();
  const list = app.findRecordsByFilter('party_games', "status = 'playing' && paused = false && deadline != '' && deadline < {:t}", '', 50, 0, { t: wir.toPb(now) });
  for (const g0 of list) {
    app.runInTransaction((tx) => {
      const g = tx.findRecordById('party_games', g0.id);
      if (g.getString('status') !== 'playing' || g.getBool('paused')) return;
      const r = g.getInt('round');
      for (const chain of [0, 1]) {
        let have = true;
        try { tx.findFirstRecordByFilter('party_steps', 'game = {:g} && chain = {:c} && idx = {:i}', { g: g.id, c: chain, i: r }); } catch (_) { have = false; }
        if (have) continue;
        const s = new Record(tx.findCollectionByNameOrId('party_steps'));
        s.set('game', g.id); s.set('chain', chain); s.set('idx', r); s.set('author', playerId(g, actorIdx(chain, r))); s.set('kind', 'skip');
        tx.save(s);
      }
      nextRound(tx, g, '');
    });
  }
}

function cleanup(app) {
  const old = app.findRecordsByFilter('party_games', "(status = 'done' && updated < {:a}) || (status = 'playing' && updated < {:b})", '', 100, 0, { a: wir.toPb(Date.now() - 30 * 86400000), b: wir.toPb(Date.now() - 21 * 86400000) });
  for (const g of old) { try { app.delete(g); } catch (err) { app.logger().error('party cleanup', 'error', String(err)); } }
}

module.exports = { MODES, GRACE, MAX_ACTIVE, MAX_NEW_PER_DAY, num, kindOf, actorIdx, chainOf, load, idxOf, playerId, nameOf, push, nextRound, tick, cleanup };
