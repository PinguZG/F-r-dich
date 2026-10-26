// Snake (für wir_snake.pb.js): Gespielt wird im Browser. Der Server gibt Runden aus, prüft das Ergebnis auf Plausibilität,
// vergibt Coins genau einmal pro Runde (Ledger-Schlüssel game:snake:<id>) und meldet neue Rekorde an die andere Person.
const wir = require(`${__hooks}/wir_lib.js`);
const shop = require(`${__hooks}/shop_lib.js`);
const nameOf = (app, id) => { try { return app.findRecordById('users', id).getString('name') || 'Dein Schatz'; } catch (_) { return 'Dein Schatz'; } };

const PER_LEVEL = 5;                                     // Herzen pro Level
const levelOf = hearts => 1 + Math.floor(hearts / PER_LEVEL);
// Punkte: jedes Herz zählt 10 × aktuelles Level
function scoreOf(hearts) { let s = 0; for (let i = 0; i < hearts; i++) s += 10 * levelOf(i); return s; }
const COINS = [[1000, 15], [500, 10], [250, 6], [100, 3]]; // ab Punkte -> Coins

function snakeNew(app, uid) {
  for (const old of app.findRecordsByFilter('snake_games', "user = {:u} && status = 'active'", '', 10, 0, { u: uid })) { old.set('status', 'given'); app.save(old); }
  const r = new Record(app.findCollectionByNameOrId('snake_games'));
  r.set('user', uid); r.set('status', 'active');
  app.save(r);
  return r;
}

function snakeFinish(app, uid, id, body) {
  let r;
  try { r = app.findRecordById('snake_games', id); } catch (_) { throw new NotFoundError('Runde nicht gefunden'); }
  if (r.getString('user') !== uid) throw new ForbiddenError('Nicht deine Runde');
  if (r.getString('status') === 'done') return { rec: r, coins: 0, record: false };
  if (r.getString('status') !== 'active') throw new ApiError(409, 'Runde ist beendet');
  const hearts = Math.max(0, Math.min(2000, Math.floor(Number(body.hearts) || 0)));
  const seconds = Math.max(0, Math.min(86400, Math.floor(Number(body.seconds) || 0)));
  const elapsed = (Date.now() - wir.fromPb(r.getString('created'))) / 1000;
  // schneller als ~2 Herzen pro Sekunde geht nicht (auch nicht auf höchster Stufe)
  if (hearts > Math.max(seconds, 0) * 2 + 3 || hearts > elapsed * 2 + 3) throw new BadRequestError('Das war zu schnell für eine Schlange 😉');
  const best = app.findRecordsByFilter('snake_games', "user = {:u} && status = 'done'", '-score', 1, 0, { u: uid });
  const prev = best.length ? best[0].getInt('score') : 0;
  const score = scoreOf(hearts);
  r.set('status', 'done'); r.set('hearts', hearts); r.set('score', score); r.set('level', levelOf(hearts));
  r.set('seconds', Math.min(seconds, Math.ceil(elapsed) + 5));
  app.save(r);
  const tier = COINS.find(c => score >= c[0]);
  const got = tier ? shop.earnGame(app, uid, 'snake', tier[1], r.id, `🐍 Snake: ${score} Punkte`) : 0;
  if (got) { r.set('coins', got); app.save(r); }
  const record = score > prev && score >= 50;
  require(`${__hooks}/activity_lib.js`).log(app, uid, 'game', 'snake', `Snake: ${score} Punkte, Level ${levelOf(hearts)}${record ? ' (neuer Rekord)' : ''}`);
  if (record && prev > 0) require(`${__hooks}/spiele_lib.js`).push(app, wir.partnerOf(app, uid).id, 'snake', `🐍 ${nameOf(app, uid)} hat einen neuen Snake-Rekord`, `${score} Punkte – schaffst du mehr?`);
  return { rec: r, coins: got, record };
}

module.exports = { snakeNew, snakeFinish, scoreOf, levelOf, PER_LEVEL, COINS };
