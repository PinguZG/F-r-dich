// Zusammen zeichnen – Hilfen für wir_zeichnen.pb.js (Route-Handler sehen keine Funktionen außerhalb, daher per require).
const wir = require(`${__hooks}/wir_lib.js`);

const W = 1200, H = 1600;                 // Bildgröße (Hochformat 3:4)
const TOOLS = ['pen', 'pencil', 'marker', 'air', 'eraser', 'fill'];
const KINDS = ['s', 'f', 'l', 'e'];       // Strich, Füllung, gerade Linie, Ellipse
const MAX_NUMS = 9000;                    // höchstens 3000 Punkte (x, y, Druck) pro Strich
const PAUSE = 20 * 60000;                 // so lange niemand gezeichnet hat = „nach einer Pause“
const PUSH_GAP = 15 * 60000;              // höchstens ein Zeichnen-Push alle 15 Minuten pro Person
const DEFAULT_LAYERS = [{ id: 'l1', name: 'Ebene 1', visible: true, opacity: 1 }];

function load(app, id) {
  try { return app.findRecordById('drawings', id); } catch (_) { throw new NotFoundError('Bild nicht gefunden'); }
}

const num = (v, lo, hi, def) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def; };

// Strich-Daten prüfen und auf erlaubte Felder kürzen
function cleanStroke(b) {
  const d = b && typeof b === 'object' ? b : {};
  const k = KINDS.indexOf(d.k) >= 0 ? d.k : 's';
  const t = TOOLS.indexOf(d.t) >= 0 ? d.t : 'pen';
  const out = {
    k, t,
    c: /^#[0-9a-fA-F]{6}$/.test(String(d.c || '')) ? String(d.c) : '#000000',
    s: num(d.s, 0.5, 400, 8),
    o: num(d.o, 0.02, 1, 1),
    r: Math.floor(num(d.r, 0, 2147483647, 1)),
  };
  if (k === 'f') { out.x = num(d.x, 0, W, 0); out.y = num(d.y, 0, H, 0); out.tol = num(d.tol, 0, 255, 32); return out; }
  if (!Array.isArray(d.p) || d.p.length < 3 || d.p.length > MAX_NUMS) throw new BadRequestError('Ungültiger Strich');
  out.p = d.p.map((v, i) => {
    const lim = i % 3 === 0 ? W : i % 3 === 1 ? H : 1;
    const lo = i % 3 === 2 ? 0 : -lim;
    return Math.round(num(v, lo, lim * 2, 0) * 10) / 10;
  });
  return out;
}

function cleanLayers(list) {
  if (!Array.isArray(list) || !list.length || list.length > 12) throw new BadRequestError('Ebenen ungültig');
  const seen = {};
  return list.map(l => {
    const id = String(l.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);
    if (!id || seen[id]) throw new BadRequestError('Ebenen ungültig');
    seen[id] = 1;
    return { id, name: String(l.name || 'Ebene').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 30) || 'Ebene', visible: l.visible !== false, opacity: num(l.opacity, 0, 1, 1) };
  });
}

function nameOf(app, id) {
  try { return app.findRecordById('users', id).getString('name') || 'Dein Schatz'; } catch (_) { return 'Dein Schatz'; }
}

// Push an die andere Person – höchstens alle 15 Minuten, ein noch offener wird nur aktualisiert (gebündelt)
function notify(app, uid, title, body) {
  const to = wir.partnerOf(app, uid).id;
  let pending = null;
  try { pending = app.findFirstRecordByFilter('push_queue', "user = {:u} && kind = 'draw' && sent_at = ''", { u: to }); } catch (_) {}
  if (pending) { pending.set('title', title); pending.set('body', body); app.save(pending); return; }
  const last = app.findRecordsByFilter('push_queue', "user = {:u} && kind = 'draw' && sent_at != ''", '-sent_at', 1, 0, { u: to });
  if (last.length && Date.now() - wir.fromPb(last[0].getString('sent_at')) < PUSH_GAP) return;
  wir.enqueue(app, { user: to, kind: 'draw', title, body, url: '/', sendAfter: Date.now() + 30000 });
}

// an alle Realtime-Verbindungen der ANDEREN Person, die das Bild offen haben (Topic draw/<id>) – nichts wird gespeichert
function relay(app, drawingId, fromUid, data) {
  const to = wir.partnerOf(app, fromUid).id;
  const topic = 'draw/' + drawingId;
  const msg = new SubscriptionMessage({ name: topic, data: JSON.stringify(data) });
  const clients = app.subscriptionsBroker().clients();
  let n = 0;
  for (const cid in clients) {
    const c = clients[cid];
    if (!c.hasSubscription(topic)) continue;
    const auth = c.get('auth');
    if (!auth || auth.id !== to) continue;
    c.send(msg); n++;
  }
  return n;
}

module.exports = { W, H, PAUSE, DEFAULT_LAYERS, load, cleanStroke, cleanLayers, nameOf, notify, relay };
