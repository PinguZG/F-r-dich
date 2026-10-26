// Neuer Shop (Tipps, Profilrahmen, Benachrichtigungs-Bomben) + Coins für Spiele (Solitär, Schach-KI, Sudoku, Herzspur).
// Für wir_shop.pb.js. Alle Buchungen über coins.book() (Transaktion, Idempotenz-Schlüssel, nie unter 0).
// PREISE UND REGELN NUR HIER ÄNDERN – der Client holt sie über GET /api/shop/catalog.

const wir = require(`${__hooks}/wir_lib.js`);
const coins = require(`${__hooks}/coins_lib.js`);

const PRICES = {
  tips: { solitaire: 5, sudoku: 10, chessai: 15 },
  frames: [
    { key: 'rosa', name: 'Rosa Doppelring', tier: 'einfach', price: 150 },
    { key: 'gold', name: 'Goldrand', tier: 'einfach', price: 150 },
    { key: 'perlen', name: 'Perlenkette', tier: 'einfach', price: 150 },
    { key: 'herzkranz', name: 'Herzkranz', tier: 'besonders', price: 300 },
    { key: 'blumen', name: 'Blumenkranz', tier: 'besonders', price: 300 },
    { key: 'sterne', name: 'Mondnacht-Sterne', tier: 'besonders', price: 300 },
    { key: 'puls', name: 'Pulsierendes Herz', tier: 'animiert', price: 600 },
    { key: 'glitzer', name: 'Glitzer', tier: 'animiert', price: 600 },
    { key: 'regenbogen', name: 'Zuckerwatte-Wirbel', tier: 'animiert', price: 600 },
  ],
  bombs: {
    heart: { name: 'Herz-Bombe', price: 80, count: 30 },
    msg: { name: 'Nachrichten-Bombe', price: 150, count: 10, maxLen: 60 },
  },
  bombsPerDay: 3,
  bombGapMs: 1500,       // Abstand zwischen zwei Pushs einer Bombe
  quiet: { from: 23, to: 7 }, // Nachtruhe (Berlin): Bombe wird um 7 Uhr verschickt
};

// Coins fürs Spielen (zusätzlich zu den bestehenden EARN-Regeln in coins_lib.js)
const GAME_EARN = {
  sudoku: { easy: 5, medium: 10, hard: 20 },
  solitaire: { 1: 10, 3: 20 },
  chessai: { 1: 3, 2: 6, 3: 10, 4: 15, 5: 25 },
  trail: 5,             // Herzspur: Sieg im Match
  perDay: 15,           // höchstens so viele Spiel-Gutschriften pro Person und Tag
};

const now = () => Date.now();
const nameOf = (app, id) => { try { return app.findRecordById('users', id).getString('name') || 'Dein Schatz'; } catch (_) { return 'Dein Schatz'; } };
function cleanKey(k) {
  const s = String(k || '');
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(s)) throw new BadRequestError('key fehlt');
  return s;
}
const midnight = () => coins.berlinMidnightPb(now());

function purchase(tx, o) {
  const r = new Record(tx.findCollectionByNameOrId('shop_purchases'));
  r.set('user', o.user); r.set('kind', o.kind); r.set('item', o.item); r.set('price', o.price); r.set('ref', o.ref || '');
  tx.save(r);
  return r;
}

function ownedFrames(app, uid) {
  return app.findRecordsByFilter('shop_purchases', "user = {:u} && kind = 'frame'", '', 50, 0, { u: uid }).map(r => r.getString('item'));
}

function bombsToday(app, uid) {
  return app.countRecords('shop_purchases', $dbx.exp("user = {:u} AND kind = 'bomb' AND created >= {:t}", { u: uid, t: midnight() }));
}

// nächster erlaubter Versandzeitpunkt (Nachtruhe 23–7 Uhr Berlin)
function sendTime(t) {
  const b = wir.berlin(t);
  if (b.h >= PRICES.quiet.from || b.h < PRICES.quiet.to) {
    const day = wir.berlinDayKey(t, b.h >= PRICES.quiet.from ? 1 : 0);
    // 07:00 Berlin an diesem Tag
    const guess = Date.parse(day + 'T07:00:00Z');
    const offset = Date.UTC(wir.berlin(guess).y, wir.berlin(guess).m, wir.berlin(guess).d, wir.berlin(guess).h, wir.berlin(guess).min) - guess;
    return guess - offset;
  }
  return t;
}

function catalog(app, uid) {
  const w = coins.ensureWallet(app, uid);
  return {
    prices: PRICES, earn: GAME_EARN,
    owned: ownedFrames(app, uid),
    frame: app.findRecordById('users', uid).getString('frame'),
    bombsToday: bombsToday(app, uid),
    quietNow: sendTime(now()) > now(), sendAt: sendTime(now()),
    balance: app.findRecordById('coin_wallets', w.id).getInt('balance'),
  };
}

// ---------- Tipps ----------
function buyTip(app, uid, body) {
  const game = String(body.game || '');
  const price = PRICES.tips[game];
  if (!price) throw new BadRequestError('Unbekanntes Spiel');
  const key = cleanKey(body.key);
  let ref = String(body.ref || '').slice(0, 60);
  let hint = null, prog = null;
  if (game === 'sudoku') {
    try { prog = app.findFirstRecordByFilter('sudoku_progress', 'user = {:u}', { u: uid }); } catch (_) { throw new NotFoundError('Kein laufendes Sudoku'); }
    ref = prog.id;
    hint = sudokuHint(prog, String(body.cells || prog.getString('cells')));
    if (!hint) throw new BadRequestError('Da ist nichts mehr aufzudecken 🎉');
  } else if (game === 'solitaire') {
    let g;
    try { g = app.findRecordById('solitaire_games', ref); } catch (_) { throw new NotFoundError('Partie nicht gefunden'); }
    if (g.getString('user') !== uid || g.getString('status') !== 'active') throw new BadRequestError('Keine laufende Partie');
  } else if (!/^[A-Za-z0-9_-]{6,60}$/.test(ref)) throw new BadRequestError('ref fehlt');
  let out;
  app.runInTransaction((tx) => {
    const r = coins.book(tx, { user: uid, amount: -price, reason: 'tip', label: `💡 Tipp: ${{ solitaire: 'Solitär', sudoku: 'Sudoku', chessai: 'Schach gegen KI' }[game]}`, ref, key: `tip:${uid}:${key}` });
    if (!r.dup) purchase(tx, { user: uid, kind: 'tip', item: game, price, ref });
    out = { balance: r.balance, dup: r.dup };
  });
  return Object.assign(out, { hint });
}

// sinnvolles Feld: zuerst ein falsch ausgefülltes, sonst das leere Feld mit den wenigsten Möglichkeiten
function sudokuHint(prog, cells) {
  const sol = prog.getString('solution'), puz = prog.getString('puzzle');
  if (!/^[0-9]{81}$/.test(cells)) cells = prog.getString('cells');
  for (let i = 0; i < 81; i++) if (puz[i] === '0' && cells[i] !== '0' && cells[i] !== sol[i]) return { i, v: +sol[i], wrong: true };
  let best = -1, bn = 10;
  for (let i = 0; i < 81; i++) {
    if (cells[i] !== '0') continue;
    const r = Math.floor(i / 9), c = i % 9, used = {};
    for (let j = 0; j < 81; j++) {
      const rj = Math.floor(j / 9), cj = j % 9;
      if (rj === r || cj === c || (Math.floor(rj / 3) === Math.floor(r / 3) && Math.floor(cj / 3) === Math.floor(c / 3))) used[cells[j]] = 1;
    }
    let n = 0; for (let d = 1; d <= 9; d++) if (!used[d]) n++;
    if (n < bn) { bn = n; best = i; }
  }
  return best < 0 ? null : { i: best, v: +sol[best] };
}

function tipsFor(app, uid, game, ref) {
  return app.countRecords('shop_purchases', $dbx.exp("user = {:u} AND kind = 'tip' AND item = {:g} AND ref = {:r}", { u: uid, g: game, r: ref }));
}

// ---------- Profilrahmen ----------
function buyFrame(app, uid, body) {
  const f = PRICES.frames.find(x => x.key === String(body.frame || ''));
  if (!f) throw new BadRequestError('Unbekannter Rahmen');
  if (ownedFrames(app, uid).includes(f.key)) throw new ApiError(409, 'Den hast du schon 💗');
  let out;
  app.runInTransaction((tx) => {
    const r = coins.book(tx, { user: uid, amount: -f.price, reason: 'frame', label: `🖼️ Profilrahmen: ${f.name}`, ref: f.key, key: `frame:${uid}:${f.key}` });
    if (!r.dup) purchase(tx, { user: uid, kind: 'frame', item: f.key, price: f.price });
    const u = tx.findRecordById('users', uid);
    u.set('frame', f.key); // gleich anlegen
    tx.save(u);
    out = { balance: r.balance, frame: f.key };
  });
  return out;
}

function setFrame(app, uid, body) {
  const key = String(body.frame || '');
  if (key && !ownedFrames(app, uid).includes(key)) throw new ForbiddenError('Diesen Rahmen hast du noch nicht.');
  const u = app.findRecordById('users', uid);
  u.set('frame', key);
  app.save(u);
  return { frame: key };
}

// ---------- Benachrichtigungs-Bomben ----------
function buyBomb(app, uid, body) {
  const kind = String(body.kind || '');
  const b = PRICES.bombs[kind];
  if (!b) throw new BadRequestError('Unbekannte Bombe');
  const key = cleanKey(body.key);
  let text = '';
  if (kind === 'msg') {
    // Steuer- und unsichtbare Zeichen raus (Codepunkte statt RegEx, damit nichts Unsichtbares im Quelltext steht)
    const bad = c => c < 32 || (c >= 0x7f && c <= 0x9f) || (c >= 0x200b && c <= 0x200f) || (c >= 0x2028 && c <= 0x202e) || (c >= 0x2066 && c <= 0x2069);
    text = Array.from(String(body.text || '')).map(ch => (bad(ch.codePointAt(0)) ? ' ' : ch)).join('').replace(/s+/g, ' ').trim();
    text = Array.from(text).slice(0, b.maxLen).join('');
    if (!text) throw new BadRequestError('Bitte einen Text eingeben');
  }
  const partner = wir.partnerOf(app, uid);
  const at = sendTime(now());
  let out, bomb = null;
  app.runInTransaction((tx) => {
    try {
      const prev = tx.findFirstRecordByFilter('coin_ledger', 'key = {:k}', { k: `bomb:${uid}:${key}` });
      out = { dup: true, balance: coins.book(tx, { user: uid, amount: -b.price, reason: 'bomb', key: `bomb:${uid}:${key}` }).balance, bomb: prev.getString('ref') };
      return;
    } catch (_) { /* neu */ }
    if (bombsToday(tx, uid) >= PRICES.bombsPerDay) throw new ApiError(429, `Höchstens ${PRICES.bombsPerDay} Bomben pro Tag 💣`);
    bomb = new Record(tx.findCollectionByNameOrId('bombs'));
    bomb.set('from', uid); bomb.set('to', partner.id); bomb.set('kind', kind); bomb.set('text', text);
    bomb.set('count', b.count); bomb.set('send_after', at);
    tx.save(bomb);
    const r = coins.book(tx, { user: uid, amount: -b.price, reason: 'bomb', label: `💣 ${b.name} an ${partner.getString('name')}`, ref: bomb.id, key: `bomb:${uid}:${key}` });
    purchase(tx, { user: uid, kind: 'bomb', item: kind, price: b.price, ref: bomb.id });
    out = { dup: false, balance: r.balance, bomb: bomb.id };
  });
  if (bomb) {
    const name = nameOf(app, uid);
    for (let n = 0; n < b.count; n++) {
      wir.enqueue(app, {
        user: partner.id, kind: 'bomb', key: `bomb:${bomb.id}:${n}`,
        title: kind === 'heart' ? '❤️' : `💣 ${name}`, body: kind === 'heart' ? '' : text,
        sendAfter: at + n * PRICES.bombGapMs, url: '/',
      });
    }
    require(`${__hooks}/activity_lib.js`).log(app, partner.id, 'fx', 'bomb', `💣 ${b.name} von ${name}` + (at > now() ? ' (kommt um 7 Uhr)' : ''));
  }
  return Object.assign(out, { sendAt: at, delayed: at > now() + 1000 });
}

// ---------- Coins fürs Spielen ----------
function earnGame(app, uid, game, amount, ref, label) {
  if (!amount) return 0;
  try {
    const today = app.countRecords('coin_ledger', $dbx.exp("user = {:u} AND reason = 'game' AND created >= {:t}", { u: uid, t: midnight() }));
    if (today >= GAME_EARN.perDay) return 0;
    const r = coins.book(app, { user: uid, amount, reason: 'game', label, ref, key: `game:${game}:${ref}` });
    return r.ok ? amount : 0;
  } catch (err) {
    app.logger().error('earn game', 'error', String(err));
    return 0;
  }
}

module.exports = { PRICES, GAME_EARN, catalog, buyTip, buyFrame, setFrame, buyBomb, tipsFor, ownedFrames, earnGame, sendTime };
