// Spiel-Logik für wir_spiele.pb.js (wird dort per require() geladen).
// Alle Züge laufen über den Server: nur eigene Partien, nur wer am Zug ist, Regeln über chess.js.

const { Chess } = require(`${__hooks}/chess.js`);
const wir = require(`${__hooks}/wir_lib.js`);

function conflict(msg) { return new ApiError(409, msg || 'Die Partie hat sich inzwischen geändert.'); }

function readJson(rec, field, fallback) {
  try {
    const s = rec.getString(field);
    const v = s ? JSON.parse(s) : null;
    return v == null ? fallback : v;
  } catch (_) { return fallback; }
}

function nameOf(app, id) {
  try { return app.findRecordById('users', id).getString('name') || 'Dein Schatz'; } catch (_) { return 'Dein Schatz'; }
}

// Push an eine Person; noch nicht verschickte Pushs derselben Art werden ersetzt (nur der neueste Stand zählt)
function push(app, user, kind, title, body) {
  try {
    let pending = null;
    try {
      pending = app.findFirstRecordByFilter('push_queue', "user = {:u} && kind = {:k} && sent_at = ''", { u: user, k: kind });
    } catch (_) { /* keiner offen */ }
    if (pending) {
      pending.set('title', title);
      pending.set('body', body || '');
      app.save(pending);
      return;
    }
    wir.enqueue(app, { user, kind, title, body, url: '/' });
  } catch (err) {
    app.logger().error('spiele push', 'error', String(err));
  }
}

// ======================================================================
// Schach
// ======================================================================
const DE = { N: 'S', B: 'L', R: 'T', Q: 'D', K: 'K' };
const sanDe = san => String(san).replace(/[NBRQK]/g, c => DE[c]);

function loadChess(rec) {
  const c = new Chess();
  for (const m of readJson(rec, 'moves', [])) {
    if (!c.move(m.san)) throw new Error('Zugliste kaputt bei ' + m.san);
  }
  return c;
}

function chessFor(app, uid, id) {
  let rec;
  try { rec = app.findRecordById('chess_games', id); } catch (_) { throw new NotFoundError('Partie nicht gefunden'); }
  const w = rec.getString('white'), b = rec.getString('black');
  if (uid !== w && uid !== b) throw new ForbiddenError('Nicht deine Partie');
  return { rec, other: uid === w ? b : w, color: uid === w ? 'w' : 'b' };
}

function chessNew(app, uid, body) {
  const active = app.findRecordsByFilter('chess_games', "status = 'active'", '', 1, 0);
  if (active.length) throw conflict('Es läuft schon eine Partie.');
  const partner = wir.partnerOf(app, uid).id;
  let white;
  if (body.color === 'white') white = uid;
  else if (body.color === 'black') white = partner;
  else {
    // abwechselnd: wer zuletzt Schwarz hatte, bekommt Weiß
    const [last] = app.findRecordsByFilter('chess_games', "id != ''", '-created', 1, 0);
    white = last ? last.getString('black') : uid;
  }
  const rec = new Record(app.findCollectionByNameOrId('chess_games'));
  rec.set('white', white);
  rec.set('black', white === uid ? partner : uid);
  rec.set('fen', new Chess().fen());
  rec.set('moves', []);
  rec.set('status', 'active');
  rec.set('turn', white);
  app.save(rec);
  return { rec, partner, partnerStarts: white === partner };
}

function chessMove(app, uid, id, body) {
  const { rec, other, color } = chessFor(app, uid, id);
  if (rec.getString('status') !== 'active') throw conflict('Die Partie ist schon vorbei.');
  if (rec.getString('turn') !== uid) throw conflict('Du bist gerade nicht am Zug.');
  const moves = readJson(rec, 'moves', []);
  if (body.ply != null && Number(body.ply) !== moves.length) throw conflict();

  const c = loadChess(rec);
  if (c.turn() !== color) throw conflict('Du bist gerade nicht am Zug.');
  const promo = ['q', 'r', 'b', 'n'].indexOf(body.promotion) >= 0 ? body.promotion : undefined;
  const m = c.move({ from: String(body.from || ''), to: String(body.to || ''), promotion: promo });
  if (!m) throw new BadRequestError('Ungültiger Zug');

  const entry = { san: m.san, from: m.from, to: m.to, piece: m.piece, color: m.color };
  if (m.captured) entry.captured = m.captured;
  if (m.promotion) entry.promotion = m.promotion;
  moves.push(entry);
  rec.set('moves', moves);
  rec.set('fen', c.fen());
  if (rec.getString('draw_offer') === other) rec.set('draw_offer', ''); // ziehen = Angebot abgelehnt

  let end = '';
  if (c.in_checkmate()) { rec.set('status', 'checkmate'); rec.set('winner', uid); end = 'mate'; }
  else if (c.in_stalemate()) { rec.set('status', 'stalemate'); end = 'draw'; }
  else if (c.in_threefold_repetition()) { rec.set('status', 'draw'); rec.set('reason', 'threefold'); end = 'draw'; }
  else if (c.insufficient_material()) { rec.set('status', 'draw'); rec.set('reason', 'insufficient'); end = 'draw'; }
  else if (c.in_draw()) { rec.set('status', 'draw'); rec.set('reason', 'fifty'); end = 'draw'; }
  rec.set('turn', end ? '' : other);
  if (end) rec.set('draw_offer', '');
  app.save(rec);
  return { rec, other, san: m.san, end, check: c.in_check() };
}

function chessResign(app, uid, id) {
  const { rec, other } = chessFor(app, uid, id);
  if (rec.getString('status') !== 'active') throw conflict('Die Partie ist schon vorbei.');
  rec.set('status', 'resigned');
  rec.set('winner', other);
  rec.set('turn', '');
  rec.set('draw_offer', '');
  app.save(rec);
  return { rec, other };
}

function chessDraw(app, uid, id, action) {
  const { rec, other } = chessFor(app, uid, id);
  if (rec.getString('status') !== 'active') throw conflict('Die Partie ist schon vorbei.');
  const offer = rec.getString('draw_offer');
  if (action === 'offer') {
    if (offer === uid) return { rec, other, action: 'none' };
    if (offer === other) action = 'accept'; // beide wollen Remis
    else { rec.set('draw_offer', uid); app.save(rec); return { rec, other, action }; }
  }
  if (action === 'accept') {
    if (offer !== other) throw conflict('Es gibt kein Remis-Angebot.');
    rec.set('status', 'agreed');
    rec.set('turn', '');
    rec.set('draw_offer', '');
    app.save(rec);
    return { rec, other, action };
  }
  if (action === 'decline' || action === 'withdraw') {
    if (!offer) return { rec, other, action: 'none' };
    if ((action === 'decline' && offer !== other) || (action === 'withdraw' && offer !== uid)) throw conflict('Es gibt kein passendes Remis-Angebot.');
    rec.set('draw_offer', '');
    app.save(rec);
    return { rec, other, action };
  }
  throw new BadRequestError('Unbekannte Aktion');
}

// ======================================================================
// Tic Tac Toe
// ======================================================================
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
function tttWinner(board) {
  for (const l of LINES) {
    const a = board[l[0]];
    if (a !== '-' && a === board[l[1]] && a === board[l[2]]) return l;
  }
  return null;
}

function tttFor(app, uid, id) {
  let rec;
  try { rec = app.findRecordById('ttt_games', id); } catch (_) { throw new NotFoundError('Spiel nicht gefunden'); }
  const x = rec.getString('x'), o = rec.getString('o');
  if (rec.getString('mode') !== 'pvp' || (uid !== x && uid !== o)) throw new ForbiddenError('Nicht dein Spiel');
  return { rec, other: uid === x ? o : x, mark: uid === x ? 'x' : 'o' };
}

function tttNew(app, uid) {
  const active = app.findRecordsByFilter('ttt_games', "mode = 'pvp' && status = 'active'", '', 1, 0);
  if (active.length) throw conflict('Es läuft schon ein Spiel.');
  const partner = wir.partnerOf(app, uid).id;
  // abwechselnd anfangen: wer letztes Mal ◯ hatte, ist jetzt ✕ und beginnt
  const [last] = app.findRecordsByFilter('ttt_games', "mode = 'pvp'", '-created', 1, 0);
  const x = last ? last.getString('o') : uid;
  const rec = new Record(app.findCollectionByNameOrId('ttt_games'));
  rec.set('mode', 'pvp');
  rec.set('x', x);
  rec.set('o', x === uid ? partner : uid);
  rec.set('board', '---------');
  rec.set('status', 'active');
  rec.set('turn', x);
  rec.set('line', []);
  app.save(rec);
  return { rec, partner, partnerStarts: x === partner };
}

function tttMove(app, uid, id, body) {
  const { rec, other, mark } = tttFor(app, uid, id);
  if (rec.getString('status') !== 'active') throw conflict('Das Spiel ist schon vorbei.');
  if (rec.getString('turn') !== uid) throw conflict('Du bist gerade nicht am Zug.');
  const board = rec.getString('board').split('');
  const cell = Number(body.cell);
  if (!(cell >= 0 && cell <= 8) || Math.floor(cell) !== cell) throw new BadRequestError('Ungültiges Feld');
  if (board[cell] !== '-') throw conflict('Das Feld ist schon belegt.');
  const filled = board.filter(c => c !== '-').length;
  if (body.ply != null && Number(body.ply) !== filled) throw conflict();
  board[cell] = mark;
  rec.set('board', board.join(''));
  const line = tttWinner(board);
  let end = '';
  if (line) { rec.set('status', 'won'); rec.set('winner', uid); rec.set('line', line); end = 'won'; }
  else if (board.indexOf('-') < 0) { rec.set('status', 'draw'); end = 'draw'; }
  rec.set('turn', end ? '' : other);
  app.save(rec);
  return { rec, other, end };
}

function tttResign(app, uid, id) {
  const { rec, other } = tttFor(app, uid, id);
  if (rec.getString('status') !== 'active') throw conflict('Das Spiel ist schon vorbei.');
  rec.set('status', 'resigned');
  rec.set('winner', other);
  rec.set('turn', '');
  app.save(rec);
  return { rec, other };
}

// Ergebnis gegen die KI (das Spiel selbst läuft auf dem Handy)
function tttAi(app, uid, body) {
  const level = ['easy', 'medium', 'hard'].indexOf(body.level) >= 0 ? body.level : '';
  const result = ['win', 'draw', 'loss'].indexOf(body.result) >= 0 ? body.result : '';
  if (!level || !result) throw new BadRequestError('level/result fehlt');
  const board = /^[-xo]{9}$/.test(String(body.board || '')) ? String(body.board) : '---------';
  const rec = new Record(app.findCollectionByNameOrId('ttt_games'));
  rec.set('mode', 'ai');
  rec.set('level', level);
  rec.set('x', uid);
  rec.set('board', board);
  rec.set('status', result === 'draw' ? 'draw' : 'won');
  rec.set('result', result);
  if (result === 'win') rec.set('winner', uid);
  rec.set('line', Array.isArray(body.line) ? body.line.slice(0, 3) : []);
  app.save(rec);
  return rec;
}

// ======================================================================
// Sudoku
// ======================================================================
const SUDOKU = {
  easy:   { base: 10, target: 10 * 60, penalty: 2, givens: [34, 50] },
  medium: { base: 25, target: 20 * 60, penalty: 4, givens: [27, 37] },
  hard:   { base: 50, target: 35 * 60, penalty: 6, givens: [17, 31] },
};

function sudokuPoints(diff, seconds, mistakes) {
  const s = SUDOKU[diff];
  const bonus = Math.max(0, Math.round(s.base * (s.target - seconds) / s.target));
  return Math.max(Math.round(s.base * 0.2), s.base + bonus - mistakes * s.penalty);
}

function validSolved(cells) {
  for (let k = 0; k < 9; k++) {
    const r = {}, c = {}, b = {};
    for (let j = 0; j < 9; j++) {
      const rv = cells[k * 9 + j], cv = cells[j * 9 + k];
      const bv = cells[(Math.floor(k / 3) * 3 + Math.floor(j / 3)) * 9 + (k % 3) * 3 + (j % 3)];
      if (rv === '0' || r[rv] || c[cv] || b[bv]) return false;
      r[rv] = c[cv] = b[bv] = true;
    }
  }
  return true;
}

function sudokuFinish(app, uid, body) {
  let prog;
  try { prog = app.findFirstRecordByFilter('sudoku_progress', 'user = {:u}', { u: uid }); }
  catch (_) { throw new NotFoundError('Kein laufendes Sudoku'); }
  const diff = prog.getString('difficulty');
  const conf = SUDOKU[diff];
  if (!conf) throw new BadRequestError('Unbekannte Schwierigkeit');
  const puzzle = prog.getString('puzzle');
  const cells = String(body.cells || '');
  if (!/^[1-9]{81}$/.test(cells)) throw new BadRequestError('Noch nicht fertig');
  let givens = 0;
  for (let i = 0; i < 81; i++) {
    if (puzzle[i] !== '0') { givens++; if (puzzle[i] !== cells[i]) throw new BadRequestError('Vorgaben verändert'); }
  }
  if (givens < conf.givens[0] || givens > conf.givens[1]) throw new BadRequestError('Rätsel passt nicht zur Schwierigkeit');
  if (!validSolved(cells)) throw new BadRequestError('Die Lösung stimmt noch nicht');

  const seconds = Math.max(0, Math.min(86400 * 7, Math.floor(Number(body.elapsed) || prog.getInt('elapsed'))));
  const mistakes = Math.max(prog.getInt('mistakes'), Math.floor(Number(body.mistakes) || 0));
  const rec = new Record(app.findCollectionByNameOrId('sudoku_scores'));
  rec.set('user', uid);
  rec.set('difficulty', diff);
  rec.set('seconds', seconds);
  rec.set('mistakes', mistakes);
  rec.set('points', sudokuPoints(diff, seconds, mistakes));
  app.save(rec);
  app.delete(prog);
  return rec;
}

// ======================================================================
// Herzstadt (Immobilienspiel) – Logik in mono.js, hier nur Laden/Speichern/Rechte
// ======================================================================
function monoNew(app, uid) {
  const Mono = require(`${__hooks}/mono.js`);
  const active = app.findRecordsByFilter('mono_games', "status = 'active'", '', 1, 0);
  if (active.length) throw conflict('Es läuft schon eine Partie.');
  const partner = wir.partnerOf(app, uid).id;
  // wer anfängt, entscheidet der Zufall
  const first = Math.random() < 0.5 ? uid : partner;
  const rec = new Record(app.findCollectionByNameOrId('mono_games'));
  rec.set('p1', first);
  rec.set('p2', first === uid ? partner : uid);
  rec.set('status', 'active');
  const s = Mono.newState(Math.random);
  s.log.push({ t: Date.now(), m: '🏙️ Neue Partie! ' + nameOf(app, first) + ' fängt an. Jede Person startet mit ' + Mono.START_CASH + ' €.' });
  rec.set('state', s);
  app.save(rec);
  return { rec, partner, partnerStarts: first === partner };
}

function monoAct(app, uid, id, body) {
  const Mono = require(`${__hooks}/mono.js`);
  let rec;
  try { rec = app.findRecordById('mono_games', id); } catch (_) { throw new NotFoundError('Partie nicht gefunden'); }
  const ids = [rec.getString('p1'), rec.getString('p2')];
  const me = ids.indexOf(uid);
  if (me < 0) throw new ForbiddenError('Nicht deine Partie');
  if (rec.getString('status') !== 'active') throw conflict('Die Partie ist schon vorbei.');
  const s = readJson(rec, 'state', null);
  if (!s) throw new BadRequestError('Spielstand fehlt');
  if (body.v != null && Number(body.v) !== s.v) throw conflict();

  const before = Mono.waiting(s);
  const logLen = s.log.length;
  const tradeBefore = !!s.trade;
  const names = ids.map(i => nameOf(app, i));
  try {
    Mono.act(s, me, body, { rnd: Math.random, names });
  } catch (err) {
    if (err && err.status === 409) throw conflict(err.message);
    throw new BadRequestError(err && err.message ? err.message : 'Ging nicht');
  }
  s.v++;
  rec.set('state', s);
  if (s.winner != null) { rec.set('status', 'finished'); rec.set('winner', ids[s.winner]); }
  app.save(rec);

  const other = 1 - me;
  const after = Mono.waiting(s);
  // neue Log-Zeilen dieser Aktion (für den Push-Text)
  const fresh = s.log.slice(logLen).map(l => l.m);
  return {
    rec, otherId: ids[other], names,
    gameOver: s.winner != null, iWon: s.winner === me,
    // die andere Person muss jetzt etwas tun und musste es vorher nicht (oder es ist ein neues Tauschangebot)
    notify: after.indexOf(other) >= 0 && before.indexOf(other) < 0,
    tradeOffer: !tradeBefore && !!s.trade && s.trade.from === me,
    phase: s.phase, fresh: fresh.length ? fresh : s.log.slice(-2).map(l => l.m),
  };
}

module.exports = {
  push, nameOf, sanDe,
  monoNew, monoAct,
  chessNew, chessMove, chessResign, chessDraw,
  tttNew, tttMove, tttResign, tttAi,
  sudokuFinish, sudokuPoints,
};
