/// <reference path="../pb_data/types.d.ts" />
// Puzzle: Teile-Zustand state = { p: [[x, y, r, placed], …] } in Teile-Einheiten (Brett = cols × rows, Teil = 1 × 1).
// Server prüft: Mitspielende, Teil-Nummer, Zustand „aufgeteilt“ (nur eigene Hälfte), Einrasten nur nahe der richtigen Stelle
// (Toleranz je Stufe, Drehung 0), Zeit (Start vom Server), Coins nur bei realistischer Dauer, Tipps kosten Coins.


routerAdd('POST', '/api/puzzle/new', (e) => {
  const { PZ } = require(`${__hooks}/puzzle_lib.js`);
  const wir = require(`${__hooks}/wir_lib.js`);
  const b = e.requestInfo().body || {};
  const L = PZ[String(b.level || '')];
  if (!L) throw new BadRequestError('Stufe unbekannt');
  const files = e.findUploadedFiles('image');
  if (!files || !files.length) throw new BadRequestError('Bild fehlt');
  if (files[0].size > 2000000) throw new BadRequestError('Bild zu groß');
  const active = e.app.countRecords('puzzles', $dbx.exp("status = 'playing' AND (owner = {:u} OR partner = {:u})", { u: e.auth.id }));
  if (active >= 6) throw new BadRequestError('Es laufen schon 6 Puzzles. Lösche eins.');
  const together = String(b.mode) === 'together';
  const variant = ['split', 'blind'].indexOf(String(b.variant)) >= 0 && together ? String(b.variant) : 'normal';
  const rotate = (L.cols >= 10 || b.rotate === 'true' || b.rotate === true) && String(b.rotate) !== 'false';
  const n = L.cols * L.rows, st = [];
  for (let i = 0; i < n; i++) {
    // verstreut rund ums Brett (Einheiten); nie direkt auf dem richtigen Platz
    const side = Math.floor(Math.random() * 4), t = Math.random();
    const x = side === 0 ? -2.5 : side === 1 ? L.cols + 1.5 : t * (L.cols + 3) - 1.5;
    const y = side === 2 ? -2.5 : side === 3 ? L.rows + 1.5 : t * (L.rows + 3) - 1.5;
    st.push([Math.round(x * 100) / 100, Math.round(y * 100) / 100, rotate ? Math.floor(Math.random() * 4) : 0, 0]);
  }
  const r = new Record(e.app.findCollectionByNameOrId('puzzles'));
  r.set('owner', e.auth.id); r.set('partner', together ? wir.partnerOf(e.app, e.auth.id).id : '');
  r.set('variant', variant); r.set('level', String(b.level)); r.set('cols', L.cols); r.set('rows', L.rows); r.set('rotate', rotate);
  r.set('image', files[0]); r.set('state', { p: st }); r.set('status', 'playing'); r.set('started', Date.now()); r.set('seconds', 0);
  e.app.save(r);
  return e.json(200, r);
}, $apis.requireAuth('users'));

routerAdd('POST', '/api/puzzle/{id}/move', (e) => {
  const { PZ } = require(`${__hooks}/puzzle_lib.js`);
  const b = e.requestInfo().body || {};
  const uid = e.auth.id, i = Math.trunc(Number(b.i));
  let out = null;
  e.app.runInTransaction((tx) => {
    let g;
    try { g = tx.findRecordById('puzzles', e.request.pathValue('id')); } catch (_) { throw new NotFoundError('Puzzle nicht gefunden'); }
    if (g.getString('owner') !== uid && g.getString('partner') !== uid) throw new ForbiddenError('Nicht dein Puzzle.');
    if (g.getString('status') !== 'playing') throw new BadRequestError('Schon fertig.');
    const L = PZ[g.getString('level')], cols = g.getInt('cols'), rows = g.getInt('rows');
    const s = JSON.parse(g.getString('state'));
    if (!(i >= 0 && i < s.p.length)) throw new BadRequestError('Teil unbekannt');
    if (g.getString('variant') === 'split') {      // Besitzer: gerade Teile, andere Person: ungerade
      const mine = (g.getString('owner') === uid) === (i % 2 === 0);
      if (!mine) throw new ForbiddenError('Dieses Teil gehört der anderen Person.');
    }
    const cur = s.p[i];
    if (cur[3]) return;      // eingerastete Teile bleiben liegen
    const x = Math.max(-6, Math.min(cols + 6, Number(b.x) || 0)), y = Math.max(-6, Math.min(rows + 6, Number(b.y) || 0));
    const r = ((Math.trunc(Number(b.r)) % 4) + 4) % 4;
    const cx = i % cols, cy = Math.floor(i / cols);
    const snap = r === 0 && Math.abs(x - cx) <= L.tol && Math.abs(y - cy) <= L.tol;
    s.p[i] = snap ? [cx, cy, 0, 1] : [Math.round(x * 100) / 100, Math.round(y * 100) / 100, g.getBool('rotate') ? r : 0, 0];
    g.set('state', s);
    if (s.p.every(q => q[3])) {
      const secs = Math.round((Date.now() - g.getInt('started')) / 1000);
      g.set('status', 'done'); g.set('seconds', secs);
      tx.save(g);
      const coins = require(`${__hooks}/coins_lib.js`);
      if (secs >= s.p.length * 1.2) {
        for (const u of [g.getString('owner'), g.getString('partner')]) {
          if (!u) continue;
          try { if (coins.countToday(tx, u, 'puzzle') < 3) coins.book(tx, { user: u, amount: L.coins, reason: 'puzzle', label: '🧩 Puzzle gelöst', ref: g.id, key: `puzzle:${g.id}:${u}` }); }
          catch (err) { tx.logger().error('puzzle coins', 'error', String(err)); }
        }
      }
    } else tx.save(g);
    out = g;
  });
  return e.json(200, out || { ok: true });
}, $apis.requireAuth('users'));

// Tipp: ein zufälliges loses Teil wird eingesetzt, kostet Coins (serverseitig gebucht)
routerAdd('POST', '/api/puzzle/{id}/hint', (e) => {
  const { HINT_COST } = require(`${__hooks}/puzzle_lib.js`);
  const uid = e.auth.id;
  const id = e.request.pathValue('id');
  let out = null;
  e.app.runInTransaction((tx) => {
    const g = tx.findRecordById('puzzles', id);
    if (g.getString('owner') !== uid && g.getString('partner') !== uid) throw new ForbiddenError('Nicht dein Puzzle.');
    if (g.getString('status') !== 'playing') throw new BadRequestError('Schon fertig.');
    const s = JSON.parse(g.getString('state')), cols = g.getInt('cols');
    const free = [];
    s.p.forEach((q, i) => { if (!q[3]) free.push(i); });
    const i = free[Math.floor(Math.random() * free.length)];
    require(`${__hooks}/coins_lib.js`).book(tx, { user: uid, amount: -HINT_COST, reason: 'puzzlehint', label: '🧩 Tipp', ref: id, key: `puzzlehint:${id}:${uid}:${Date.now()}` });
    s.p[i] = [i % cols, Math.floor(i / cols), 0, 1];
    g.set('state', s);
    if (s.p.every(q => q[3])) { g.set('status', 'done'); g.set('seconds', Math.round((Date.now() - g.getInt('started')) / 1000)); }
    tx.save(g);
    out = g;
  });
  return e.json(200, out);
}, $apis.requireAuth('users'));

routerAdd('POST', '/api/puzzle/{id}/delete', (e) => {
  const g = e.app.findRecordById('puzzles', e.request.pathValue('id'));
  if (g.getString('owner') !== e.auth.id && g.getString('partner') !== e.auth.id) throw new ForbiddenError('Nicht dein Puzzle.');
  e.app.delete(g);
  return e.json(200, { ok: true });
}, $apis.requireAuth('users'));
