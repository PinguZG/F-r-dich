// Solitär + Schach gegen KI (für wir_shop.pb.js). Gespielt wird im Browser; der Server gibt Solitär-Partien aus,
// prüft Ergebnisse, vergibt Punkte/Coins (gegen Doppelbuchung über den Ledger-Schlüssel) und führt die Ranglisten.

const wir = require(`${__hooks}/wir_lib.js`);
const shop = require(`${__hooks}/shop_lib.js`);
const { Chess } = require(`${__hooks}/chess.js`);

const nameOf = (app, id) => { try { return app.findRecordById('users', id).getString('name') || 'Dein Schatz'; } catch (_) { return 'Dein Schatz'; } };
const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// ---------- Solitär ----------
function solitaireNew(app, uid, body) {
  const draw = Number(body.draw) === 3 ? 3 : 1;
  // laufende Partie aufgeben (es gibt immer höchstens eine)
  for (const old of app.findRecordsByFilter('solitaire_games', "user = {:u} && status = 'active'", '', 10, 0, { u: uid })) {
    old.set('status', 'given'); app.save(old);
  }
  const r = new Record(app.findCollectionByNameOrId('solitaire_games'));
  r.set('user', uid); r.set('draw', draw); r.set('status', 'active');
  r.set('seed', parseInt($security.randomStringWithAlphabet(9, '123456789'), 10));
  app.save(r);
  return r;
}

const SOL_BASE = { 1: 40, 3: 80 };
function solitairePoints(draw, seconds, hints) {
  const base = SOL_BASE[draw];
  const bonus = Math.max(0, Math.round(base * (1 - seconds / 900))); // schneller als 15 min -> Bonus
  return Math.max(Math.round(base * 0.2), base + bonus - hints * 5);
}

function solitaireFinish(app, uid, id, body) {
  let r;
  try { r = app.findRecordById('solitaire_games', id); } catch (_) { throw new NotFoundError('Partie nicht gefunden'); }
  if (r.getString('user') !== uid) throw new ForbiddenError('Nicht deine Partie');
  if (r.getString('status') === 'won') return { rec: r, coins: 0 };
  if (r.getString('status') !== 'active') throw new ApiError(409, 'Partie ist beendet');
  const seconds = Math.max(0, Math.min(86400, Math.floor(Number(body.seconds) || 0)));
  const elapsed = (Date.now() - wir.fromPb(r.getString('created'))) / 1000;
  if (seconds < 40 || elapsed < 40) throw new BadRequestError('So schnell geht Solitär nicht 😉');
  const draw = r.getInt('draw');
  const hints = shop.tipsFor(app, uid, 'solitaire', r.id);
  r.set('status', 'won');
  r.set('seconds', Math.min(seconds, Math.ceil(elapsed) + 5));
  r.set('moves', Math.max(0, Math.min(5000, Math.floor(Number(body.moves) || 0))));
  r.set('hints', hints);
  r.set('points', solitairePoints(draw, r.getInt('seconds'), hints));
  app.save(r);
  const got = shop.earnGame(app, uid, 'solitaire', shop.GAME_EARN.solitaire[draw], r.id, `🃏 Solitär gelöst (${draw} Karte${draw > 1 ? 'n' : ''})`);
  const text = `${draw === 3 ? '3 Karten' : '1 Karte'}, ${fmt(r.getInt('seconds'))} min, ${r.getInt('points')} Punkte${hints ? ' 💡' : ''}`;
  require(`${__hooks}/activity_lib.js`).log(app, uid, 'game', 'solitaire', `Solitär gelöst (${text})`);
  require(`${__hooks}/spiele_lib.js`).push(app, wir.partnerOf(app, uid).id, 'solitaire', `🃏 ${nameOf(app, uid)} hat ein Solitär gelöst`, text);
  return { rec: r, coins: got };
}

// ---------- Schach gegen KI ----------
const LEVELS = { 1: 'Anfänger', 2: 'Leicht', 3: 'Mittel', 4: 'Stark', 5: 'Meister' };
function chessaiResult(app, uid, body) {
  const ref = String(body.ref || '');
  if (!/^[A-Za-z0-9_-]{6,60}$/.test(ref)) throw new BadRequestError('ref fehlt');
  try { return { rec: app.findFirstRecordByFilter('chessai_games', 'user = {:u} && ref = {:r}', { u: uid, r: ref }), coins: 0 }; } catch (_) { /* neu */ }
  const level = Math.max(1, Math.min(5, Math.floor(Number(body.level) || 1)));
  const color = body.color === 'b' ? 'b' : 'w';
  const moves = Array.isArray(body.moves) ? body.moves.slice(0, 600) : [];
  const c = new Chess();
  for (const m of moves) if (!c.move(String(m))) throw new BadRequestError('Ungültige Zugliste');
  let result;
  if (body.resign) result = 'loss';
  else if (c.in_checkmate()) result = c.turn() === color ? 'loss' : 'win';
  else if (c.in_draw() || c.in_stalemate() || c.in_threefold_repetition()) result = 'draw';
  else throw new BadRequestError('Die Partie ist noch nicht vorbei');
  const r = new Record(app.findCollectionByNameOrId('chessai_games'));
  r.set('user', uid); r.set('ref', ref); r.set('level', level); r.set('color', color); r.set('result', result);
  r.set('moves', moves.length); r.set('hints', shop.tipsFor(app, uid, 'chessai', ref));
  app.save(r);
  let got = 0;
  if (result === 'win') got = shop.earnGame(app, uid, 'chessai', shop.GAME_EARN.chessai[level], ref, `♟️ Sieg gegen KI (${LEVELS[level]})`);
  const txt = { win: 'gewonnen 🎉', loss: 'verloren', draw: 'Remis' }[result];
  require(`${__hooks}/activity_lib.js`).log(app, uid, 'game', 'chessai', `Schach gegen KI (${LEVELS[level]}) ${txt}${r.getInt('hints') ? ' 💡' : ''}`);
  return { rec: r, coins: got };
}

module.exports = { solitaireNew, solitaireFinish, chessaiResult, solitairePoints };
