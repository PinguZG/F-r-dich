/// <reference path="../pb_data/types.d.ts" />
// Herzspur: Lichtrennen zu zweit, live. Das Gerät von p1 (Host) rechnet mit festen Ticks, das andere schickt nur
// Richtungswechsel. Live-Nachrichten laufen über /api/trail/{id}/msg und werden als Realtime-Nachricht (Topic
// "trail/<id>") NUR an die andere Person des Matches weitergereicht – nichts davon landet in der Datenbank.
// Ergebnis + Coins (Sieg im Match, gegen Doppelbuchung über den Ledger-Schlüssel) nur über /result.

routerAdd('GET', '/api/trail', (e) => {
  const rows = e.app.findRecordsByFilter('trail_matches', "(p1 = {:u} || p2 = {:u}) && (status = 'invited' || status = 'playing')", '-created', 1, 0, { u: e.auth.id });
  return e.json(200, { match: rows[0] || null });
}, $apis.requireAuth('users'));

routerAdd('POST', '/api/trail/invite', (e) => {
  const wir = require(`${__hooks}/wir_lib.js`);
  const uid = e.auth.id, partner = wir.partnerOf(e.app, uid);
  // alte offene Matches schließen (es gibt immer höchstens eins)
  for (const old of e.app.findRecordsByFilter('trail_matches', "status = 'invited' || status = 'playing'", '', 20, 0)) { old.set('status', 'aborted'); e.app.save(old); }
  const m = new Record(e.app.findCollectionByNameOrId('trail_matches'));
  m.set('p1', uid); m.set('p2', partner.id); m.set('status', 'invited'); m.set('s1', 0); m.set('s2', 0);
  e.app.save(m);
  const lib = require(`${__hooks}/spiele_lib.js`);
  lib.push(e.app, partner.id, 'trail', `🏁 ${lib.nameOf(e.app, uid)} will Herzspur spielen`, 'Tippen, um mitzufahren – live, Best of 5');
  return e.json(200, m);
}, $apis.requireAuth('users'));

routerAdd('POST', '/api/trail/{id}/accept', (e) => {
  const T = require(`${__hooks}/trail_lib.js`);
  const m = T.trailLoad(e.app, e.request.pathValue('id'), e.auth.id);
  if (m.getString('p2') !== e.auth.id || m.getString('status') !== 'invited') throw new ApiError(409, 'Diese Einladung ist nicht mehr offen.');
  m.set('status', 'playing');
  e.app.save(m);
  T.trailRelay(e.app, m, e.auth.id, { t: 'accept' });
  return e.json(200, m);
}, $apis.requireAuth('users'));

routerAdd('POST', '/api/trail/{id}/msg', (e) => {
  const T = require(`${__hooks}/trail_lib.js`);
  const m = T.trailLoad(e.app, e.request.pathValue('id'), e.auth.id);
  if (m.getString('status') !== 'playing' && m.getString('status') !== 'invited') throw new ApiError(409, 'Match beendet');
  const b = e.requestInfo().body || {};
  const t = String(b.t || '');
  if (['f', 'dir', 'ready', 'cd', 'end', 'ping', 'leave'].indexOf(t) < 0) throw new BadRequestError('unbekannt');
  // nur Host (p1) darf Spielstand schicken
  if (['f', 'cd', 'end'].indexOf(t) >= 0 && m.getString('p1') !== e.auth.id) throw new ForbiddenError('Nur der Host');
  const data = { t };
  if (t === 'f') { data.n = b.n | 0; data.h = Array.isArray(b.h) ? b.h.slice(0, 2).map(p => [p[0] | 0, p[1] | 0]) : []; }
  if (t === 'dir') data.d = ['u', 'd', 'l', 'r'].indexOf(b.d) >= 0 ? b.d : 'u';
  if (t === 'cd') { data.round = b.round | 0; data.ms = Math.max(0, Math.min(5000, b.ms | 0)); }
  if (t === 'end') { data.w = [-1, 0, 1].indexOf(b.w) >= 0 ? b.w : -1; data.s = Array.isArray(b.s) ? [b.s[0] | 0, b.s[1] | 0] : [0, 0]; data.done = !!b.done; }
  return e.json(200, { sent: T.trailRelay(e.app, m, e.auth.id, data) });
}, $apis.requireAuth('users'));

// Host meldet den Spielstand; bei 3 Siegen ist das Match vorbei
routerAdd('POST', '/api/trail/{id}/result', (e) => {
  const T = require(`${__hooks}/trail_lib.js`);
  const m = T.trailLoad(e.app, e.request.pathValue('id'), e.auth.id);
  if (m.getString('p1') !== e.auth.id) throw new ForbiddenError('Nur der Host');
  if (m.getString('status') !== 'playing') return e.json(200, m);
  const b = e.requestInfo().body || {};
  const s1 = Math.max(m.getInt('s1'), Math.min(3, b.s1 | 0)), s2 = Math.max(m.getInt('s2'), Math.min(3, b.s2 | 0));
  m.set('s1', s1); m.set('s2', s2);
  if (s1 >= 3 || s2 >= 3) {
    const winner = s1 >= 3 ? m.getString('p1') : m.getString('p2');
    m.set('status', 'done'); m.set('winner', winner);
    e.app.save(m);
    const shop = require(`${__hooks}/shop_lib.js`), act = require(`${__hooks}/activity_lib.js`), lib = require(`${__hooks}/spiele_lib.js`);
    shop.earnGame(e.app, winner, 'trail', shop.GAME_EARN.trail, m.id, '🏁 Herzspur gewonnen');
    const loser = winner === m.getString('p1') ? m.getString('p2') : m.getString('p1');
    act.log(e.app, winner, 'game', 'trail', `Herzspur gewonnen ${Math.max(s1, s2)}:${Math.min(s1, s2)} gegen ${lib.nameOf(e.app, loser)}`);
    act.log(e.app, loser, 'game', 'trail', `Herzspur verloren ${Math.min(s1, s2)}:${Math.max(s1, s2)} gegen ${lib.nameOf(e.app, winner)}`);
  } else e.app.save(m);
  return e.json(200, m);
}, $apis.requireAuth('users'));

routerAdd('POST', '/api/trail/{id}/leave', (e) => {
  const T = require(`${__hooks}/trail_lib.js`);
  const m = T.trailLoad(e.app, e.request.pathValue('id'), e.auth.id);
  if (m.getString('status') === 'invited' || m.getString('status') === 'playing') { m.set('status', 'aborted'); e.app.save(m); }
  T.trailRelay(e.app, m, e.auth.id, { t: 'leave' });
  return e.json(200, m);
}, $apis.requireAuth('users'));
