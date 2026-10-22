/// <reference path="../pb_data/types.d.ts" />
// Spiele: alle Züge laufen über diese Routen (die Collections selbst sind für Clients schreibgeschützt).
// Gehört nach /home/pingu/pb/pb_hooks/ (zusammen mit spiele_lib.js, chess.js, wir_lib.js).
// Pushs landen in push_queue (Arten "chess" und "ttt"), wir-push verschickt sie.

// ---------- Schach ----------
routerAdd('POST', '/api/games/chess/new', (e) => {
  const lib = require(`${__hooks}/spiele_lib.js`);
  let r;
  e.app.runInTransaction((tx) => { r = lib.chessNew(tx, e.auth.id, e.requestInfo().body || {}); });
  const n = lib.nameOf(e.app, e.auth.id);
  lib.push(e.app, r.partner, 'chess', r.partnerStarts ? '♟️ Neue Partie – du bist am Zug' : '♟️ Neue Partie',
    r.partnerStarts ? `${n} hat eine Partie gestartet, du spielst Weiß` : `${n} hat eine Partie gestartet und eröffnet mit Weiß`);
  return e.json(200, r.rec);
}, $apis.requireAuth('users'));

routerAdd('POST', '/api/games/chess/{id}/move', (e) => {
  const lib = require(`${__hooks}/spiele_lib.js`);
  let r;
  e.app.runInTransaction((tx) => { r = lib.chessMove(tx, e.auth.id, e.request.pathValue('id'), e.requestInfo().body || {}); });
  const n = lib.nameOf(e.app, e.auth.id), san = lib.sanDe(r.san);
  if (r.end === 'mate') lib.push(e.app, r.other, 'chess', '♟️ Schachmatt', `${n} spielte ${san} – Matt. Revanche? 💗`);
  else if (r.end === 'draw') lib.push(e.app, r.other, 'chess', '♟️ Remis', `${n} spielte ${san} – die Partie endet unentschieden`);
  else if (r.check) lib.push(e.app, r.other, 'chess', '♟️ Schach! Du bist am Zug', `${n} spielte ${san}`);
  else lib.push(e.app, r.other, 'chess', '♟️ Du bist am Zug', `${n} spielte ${san}`);
  return e.json(200, r.rec);
}, $apis.requireAuth('users'));

routerAdd('POST', '/api/games/chess/{id}/resign', (e) => {
  const lib = require(`${__hooks}/spiele_lib.js`);
  let r;
  e.app.runInTransaction((tx) => { r = lib.chessResign(tx, e.auth.id, e.request.pathValue('id')); });
  lib.push(e.app, r.other, 'chess', '♟️ Du hast gewonnen 🎉', `${lib.nameOf(e.app, e.auth.id)} hat aufgegeben`);
  return e.json(200, r.rec);
}, $apis.requireAuth('users'));

routerAdd('POST', '/api/games/chess/{id}/draw', (e) => {
  const lib = require(`${__hooks}/spiele_lib.js`);
  let r;
  const action = String((e.requestInfo().body || {}).action || '');
  e.app.runInTransaction((tx) => { r = lib.chessDraw(tx, e.auth.id, e.request.pathValue('id'), action); });
  const n = lib.nameOf(e.app, e.auth.id);
  if (r.action === 'offer') lib.push(e.app, r.other, 'chess', '🤝 Remis-Angebot', `${n} bietet dir ein Remis an`);
  else if (r.action === 'accept') lib.push(e.app, r.other, 'chess', '♟️ Remis', `${n} hat dein Remis-Angebot angenommen`);
  else if (r.action === 'decline') lib.push(e.app, r.other, 'chess', '♟️ Remis abgelehnt', `${n} spielt weiter`);
  return e.json(200, r.rec);
}, $apis.requireAuth('users'));

// ---------- Tic Tac Toe ----------
routerAdd('POST', '/api/games/ttt/new', (e) => {
  const lib = require(`${__hooks}/spiele_lib.js`);
  let r;
  e.app.runInTransaction((tx) => { r = lib.tttNew(tx, e.auth.id); });
  const n = lib.nameOf(e.app, e.auth.id);
  lib.push(e.app, r.partner, 'ttt', r.partnerStarts ? '⭕ Du bist am Zug' : '⭕ Neues Tic Tac Toe',
    r.partnerStarts ? `${n} hat ein neues Spiel gestartet – du fängst an` : `${n} hat ein neues Spiel gestartet`);
  return e.json(200, r.rec);
}, $apis.requireAuth('users'));

routerAdd('POST', '/api/games/ttt/{id}/move', (e) => {
  const lib = require(`${__hooks}/spiele_lib.js`);
  let r;
  e.app.runInTransaction((tx) => { r = lib.tttMove(tx, e.auth.id, e.request.pathValue('id'), e.requestInfo().body || {}); });
  const n = lib.nameOf(e.app, e.auth.id);
  if (r.end === 'won') lib.push(e.app, r.other, 'ttt', '⭕ Tic Tac Toe', `${n} hat gewonnen – Revanche? 💗`);
  else if (r.end === 'draw') lib.push(e.app, r.other, 'ttt', '⭕ Unentschieden', `Niemand hat gewonnen – nochmal?`);
  else lib.push(e.app, r.other, 'ttt', '⭕ Du bist am Zug', `${n} hat gesetzt`);
  return e.json(200, r.rec);
}, $apis.requireAuth('users'));

routerAdd('POST', '/api/games/ttt/{id}/resign', (e) => {
  const lib = require(`${__hooks}/spiele_lib.js`);
  let r;
  e.app.runInTransaction((tx) => { r = lib.tttResign(tx, e.auth.id, e.request.pathValue('id')); });
  lib.push(e.app, r.other, 'ttt', '⭕ Du hast gewonnen 🎉', `${lib.nameOf(e.app, e.auth.id)} hat aufgegeben`);
  return e.json(200, r.rec);
}, $apis.requireAuth('users'));

routerAdd('POST', '/api/games/ttt/ai', (e) => {
  const lib = require(`${__hooks}/spiele_lib.js`);
  return e.json(200, lib.tttAi(e.app, e.auth.id, e.requestInfo().body || {}));
}, $apis.requireAuth('users'));

// ---------- Herzstadt (Immobilienspiel) ----------
routerAdd('POST', '/api/games/mono/new', (e) => {
  const lib = require(`${__hooks}/spiele_lib.js`);
  let r;
  e.app.runInTransaction((tx) => { r = lib.monoNew(tx, e.auth.id); });
  const n = lib.nameOf(e.app, e.auth.id);
  lib.push(e.app, r.partner, 'mono', r.partnerStarts ? '🏙️ Herzstadt – du fängst an!' : '🏙️ Neue Partie Herzstadt',
    r.partnerStarts ? `${n} hat eine Partie gestartet. Würfel!` : `${n} hat eine Partie gestartet und würfelt zuerst`);
  return e.json(200, r.rec);
}, $apis.requireAuth('users'));

routerAdd('POST', '/api/games/mono/{id}/act', (e) => {
  const lib = require(`${__hooks}/spiele_lib.js`);
  let r;
  e.app.runInTransaction((tx) => { r = lib.monoAct(tx, e.auth.id, e.request.pathValue('id'), e.requestInfo().body || {}); });
  const n = lib.nameOf(e.app, e.auth.id);
  // kurze Zusammenfassung: die letzten (höchstens 2) Ereignisse ohne Emoji am Anfang
  const sum = r.fresh.slice(-2).map(m => m.replace(/^[^A-Za-zÄÖÜäöü0-9]+/, '')).join(' · ').slice(0, 180);
  if (r.gameOver) lib.push(e.app, r.otherId, 'mono', r.iWon ? '🏙️ Herzstadt ist vorbei' : '🏙️ Du hast Herzstadt gewonnen! 🎉', sum);
  else if (r.tradeOffer) lib.push(e.app, r.otherId, 'mono', '🤝 Tauschangebot in Herzstadt', `${n} möchte mit dir tauschen`);
  else if (r.notify) {
    const title = r.phase === 'auction' ? '🔨 Versteigerung – dein Gebot' : r.phase === 'debt' ? '⚠️ Herzstadt: Du musst zahlen' : '🏙️ Du bist am Zug';
    lib.push(e.app, r.otherId, 'mono', title, sum || `${n} ist fertig`);
  }
  return e.json(200, r.rec);
}, $apis.requireAuth('users'));

// ---------- Sudoku ----------
routerAdd('POST', '/api/games/sudoku/finish', (e) => {
  const lib = require(`${__hooks}/spiele_lib.js`);
  let rec;
  e.app.runInTransaction((tx) => { rec = lib.sudokuFinish(tx, e.auth.id, e.requestInfo().body || {}); });
  return e.json(200, rec);
}, $apis.requireAuth('users'));
