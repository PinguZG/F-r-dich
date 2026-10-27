// wir-push: liest PocketBase und schickt Web-Push-Benachrichtigungen an die jeweils ANDERE Person.
// Konfiguration nur über Umgebungsvariablen (auf dem Pi: /etc/wir-push.env).
'use strict';
const webpush = require('web-push');

const env = k => { const v = process.env[k]; if (!v) { console.error('Fehlt: ' + k); process.exit(1); } return v; };
const PB = env('PB_URL').replace(/\/$/, '');
const PB_EMAIL = env('PB_EMAIL');
const PB_PASSWORD = env('PB_PASSWORD');
webpush.setVapidDetails(env('VAPID_SUBJECT'), env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'));

const POLL_MS = Number(process.env.POLL_MS || 30000);
const QUIET_MS = Number(process.env.QUIET_MS || 60000);   // so lange nach dem letzten Foto/Eintrag warten -> bündeln
const LOVE_GAP_MS = Number(process.env.LOVE_GAP_MS || 5 * 60000);  // Liebe: höchstens ein Push pro 5 Minuten und Person
const LOVE_QUIET_MS = Number(process.env.LOVE_QUIET_MS || 20000);  // Liebe: nach dem letzten Tipp kurz warten (Serie sammeln)
const LOVE_MAX_WAIT_MS = 90000;                                    // … aber nie länger als 90 s nach dem ersten Tipp
const OVERLAP_MS = 15000;                                  // Abfragen etwas überlappen lassen, "seen" verhindert Doppelte
const TZ = process.env.TZ || 'Europe/Berlin';

const log = (...a) => console.log(new Date().toISOString(), ...a);

// ----------------------------------------------------------------------
// PocketBase-Zugriff (als Dienst-Superuser)
// ----------------------------------------------------------------------
let token = null, tokenAt = 0;

async function auth() {
  const r = await fetch(PB + '/api/collections/_superusers/auth-with-password', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: PB_EMAIL, password: PB_PASSWORD }),
  });
  if (!r.ok) throw new Error('Login fehlgeschlagen: ' + r.status);
  token = (await r.json()).token;
  tokenAt = Date.now();
}

async function api(method, path, body, retry = true) {
  if (!token || Date.now() - tokenAt > 3600000) await auth();
  const r = await fetch(PB + path, {
    method, headers: { Authorization: token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 401 && retry) { token = null; return api(method, path, body, false); }
  const t = await r.text();
  if (!r.ok) { const e = new Error(`${method} ${path} -> ${r.status} ${t}`); e.status = r.status; throw e; }
  return t ? JSON.parse(t) : null;
}

async function list(coll, { filter = '', sort = '', expand = '' } = {}) {
  const out = [];
  for (let page = 1; ; page++) {
    const q = new URLSearchParams({ page, perPage: 200, skipTotal: 1 });
    if (filter) q.set('filter', filter);
    if (sort) q.set('sort', sort);
    if (expand) q.set('expand', expand);
    const res = await api('GET', `/api/collections/${coll}/records?${q}`);
    out.push(...res.items);
    if (res.items.length < 200) return out;
  }
}

const q = s => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
const pbTime = ms => new Date(ms).toISOString().replace('T', ' ');
const ms = s => s ? Date.parse(s.replace(' ', 'T')) : NaN;

// ----------------------------------------------------------------------
// Zustand ("zuletzt verarbeitet") in der Collection push_state
// ----------------------------------------------------------------------
const STATE_KEY = 'main';
let state = null, stateId = null, stateDirty = false;

async function loadState() {
  const [rec] = await list('push_state', { filter: 'key = ' + q(STATE_KEY) });
  if (rec) { stateId = rec.id; state = rec.value || {}; }
  else {
    state = {};
    const created = await api('POST', '/api/collections/push_state/records', { key: STATE_KEY, value: state });
    stateId = created.id;
  }
  state.streams ||= {};
  state.selections ||= {};
  state.love ||= {};
}

async function saveState() {
  if (!stateDirty) return;
  await api('PATCH', '/api/collections/push_state/records/' + stateId, { value: state });
  stateDirty = false;
}

// Ein "Stream" liefert neue Datensätze einer Collection anhand eines Zeitfelds (created/updated).
// cursor = bis wohin alles erledigt ist; seen = bereits erledigte Schlüssel im Überlappungsfenster.
async function pull(name, coll, field, { filter = '', expand = '' } = {}) {
  let st = state.streams[name];
  if (!st) { st = state.streams[name] = { cursor: pbTime(Date.now()), seen: {} }; stateDirty = true; } // Erststart: nichts nachholen
  const since = pbTime(ms(st.cursor) - OVERLAP_MS);
  const items = await list(coll, {
    filter: `${field} >= ${q(since)}` + (filter ? ` && (${filter})` : ''), sort: `${field},id`, expand,
  });
  return items.filter(r => !st.seen[r.id + '@' + r[field]]);
}

// handled: erledigt (auch still übergangene), deferred: später nochmal anschauen (Bündelung)
function commit(name, field, handled, deferred = []) {
  const st = state.streams[name];
  for (const r of handled) st.seen[r.id + '@' + r[field]] = r[field];
  let cursor = st.cursor;
  for (const r of handled) if (r[field] > cursor) cursor = r[field];
  if (deferred.length) {
    const oldest = deferred.map(r => r[field]).sort()[0];
    if (oldest < cursor) cursor = pbTime(ms(oldest) - 1);
  }
  if (cursor < st.cursor && !deferred.length) cursor = st.cursor;
  st.cursor = cursor;
  const limit = pbTime(ms(cursor) - OVERLAP_MS - 1000);
  for (const [k, v] of Object.entries(st.seen)) if (v < limit) delete st.seen[k];
  if (handled.length || deferred.length) stateDirty = true;
}

// ----------------------------------------------------------------------
// Benutzer, Einstellungen, Versand
// ----------------------------------------------------------------------
let users = {};
const name = id => users[id]?.name || 'Dein Schatz';
const otherOf = id => Object.keys(users).find(u => u !== id);

// Benachrichtigungen sind nicht abschaltbar: push_prefs/notify_prefs bleiben bestehen, werden aber ignoriert.
const PREF_KEYS = ['pings', 'photos', 'dates', 'clay', 'tabs', 'planned'];

async function send(to, category, payload) {
  if (!to || !users[to]) return;
  if (!PREF_KEYS.includes(category)) throw new Error('unbekannte Kategorie ' + category);
  await deliver(to, category, payload, category === 'pings' ? 'high' : 'normal', category !== 'pings');
}

// Abos einer Person für eine App: "wir" (auch alte Abos ohne app) oder "spiele" (Spiele-App unter :8443)
const subsFor = (to, app) => list('push_subs', {
  filter: `user = ${q(to)} && ` + (app === 'spiele' ? 'app = "spiele"' : '(app = "wir" || app = "")'),
});

// an alle Handys einer Person (in der passenden App); liefert die Fehler (abgelaufene Abos werden gelöscht).
// Spiel-Pushs gehen an die Spiele-App; hat die Person sie (noch) nicht mit Push, ersatzweise an Wir –
// mit app: "spiele", damit Wirs Service Worker beim Tippen die Spiele-App öffnet.
async function deliver(to, category, payload, urgency, useTopic, app = 'wir') {
  let subs = await subsFor(to, app);
  if (!subs.length && app === 'spiele') {
    subs = await subsFor(to, 'wir');
    payload = { ...payload, app: 'spiele' };
  }
  const body = JSON.stringify(payload);
  const errors = [];
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, body, {
        TTL: 24 * 3600, urgency,
        ...(payload.tag && useTopic ? { topic: payload.tag.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) } : {}),
      });
      log('gesendet', category, '->', `${name(to)} [${s.app || 'wir'}]`, JSON.stringify(payload.title));
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        log('Subscription abgelaufen, lösche', s.id);
        await api('DELETE', '/api/collections/push_subs/records/' + s.id).catch(err => log('Löschen fehlgeschlagen', err.message));
      } else {
        log('Senden fehlgeschlagen', e.statusCode || '', e.body || e.message);
        errors.push(`${s.id}: ${e.statusCode || ''} ${e.body || e.message}`.slice(0, 200));
      }
    }
  }
  if (!subs.length) errors.push('kein Push-Abo');
  return errors;
}

// ----------------------------------------------------------------------
// Texte
// ----------------------------------------------------------------------
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
function when(iso) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('de-DE', {
    timeZone: TZ, weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(ms(iso))).map(p => [p.type, p.value]));
  const wd = parts.weekday.replace('.', '');
  return { date: `${WD.find(w => wd.startsWith(w)) || wd}, ${parts.day}.${parts.month}.`, time: `${parts.hour}:${parts.minute}` };
}
const fmtDate = d => d.startsWith('--') ? `${d.slice(8, 10)}.${d.slice(5, 7)}.` : `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
const plural = (n, one, many) => n === 1 ? one : `${n} ${many}`;
const tabLabel = t => `${t.emoji || '✨'} ${t.name}`;
const isLocked = t => !!t.unlock_at && ms(t.unlock_at) > Date.now();

const PING_TEXT = {
  call: n => `📞 ${n} möchte dich anrufen`,
  support: n => `🫂 ${n} denkt an dich und ist für dich da`,
};
const isLove = t => t === 'love' || t === 'heart';

// 00:00 Uhr in Europe/Berlin (für "heute schon …×")
const berlinFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
function berlinWall(t) {
  const p = Object.fromEntries(berlinFmt.formatToParts(new Date(t)).map(x => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
}
function berlinMidnight(t) {
  const w = berlinWall(t), mid = w - (w % 86400000);
  let real = mid - (berlinWall(mid) - mid);
  real = mid - (berlinWall(real) - real);
  return real;
}

async function count(coll, filter) {
  const q2 = new URLSearchParams({ page: 1, perPage: 1, filter, fields: 'id' });
  return (await api('GET', `/api/collections/${coll}/records?${q2}`)).totalItems;
}

// ----------------------------------------------------------------------
// Ereignisse
// ----------------------------------------------------------------------

// a) Pings – sofort, einzeln (Liebe/Herz nicht: die bündelt doLove)
async function doPings() {
  const items = await pull('pings', 'pings', 'created');
  if (!items.length) return;
  commit('pings', 'created', items);
  await saveState(); // erst merken, dann senden -> nie doppelt
  for (const p of items) {
    if (p.from === p.to || isLove(p.type)) continue;
    const n = name(p.from);
    const payload = p.type === 'message'
      ? { title: `✏️ ${n}`, body: p.message, go: 's-wir', tag: 'ping-' + p.id }
      : { title: (PING_TEXT[p.type] || PING_TEXT.support)(n), body: 'Tippe, um zu antworten 💕', go: 's-wir', tag: 'ping-' + p.id };
    await send(p.to, 'pings', payload);
  }
}

// a2) Liebe (Herz-Glas): Tipps sammeln, höchstens alle 5 Minuten EIN Push "💗 Daniel hat dir 7× Liebe geschickt".
//     state.love[from] = { upTo: letzter schon gemeldeter Tipp (created), lastSent: ms }
let loveTimer = null;
async function doLove() {
  const now = Date.now();
  for (const from of Object.keys(users)) {
    if (!state.love[from]) { state.love[from] = { upTo: pbTime(now), lastSent: 0 }; stateDirty = true; } // Erststart: nichts nachholen
  }
  const nextCheck = [];
  for (const [from, st] of Object.entries(state.love)) {
    const to = otherOf(from);
    if (!users[from] || !to) continue;
    const taps = await list('pings', {
      filter: `from = ${q(from)} && to = ${q(to)} && (type = "love" || type = "heart") && created > ${q(st.upTo)}`, sort: 'created',
    });
    if (!taps.length) continue;
    const first = ms(taps[0].created), last = ms(taps[taps.length - 1].created);
    const readyAt = Math.max(Math.min(last + LOVE_QUIET_MS, first + LOVE_MAX_WAIT_MS), (st.lastSent || 0) + LOVE_GAP_MS);
    if (now < readyAt) { nextCheck.push(readyAt); continue; }

    const today = await count('pings', `from = ${q(from)} && to = ${q(to)} && (type = "love" || type = "heart") && created >= ${q(pbTime(berlinMidnight(now)))}`);
    st.upTo = taps[taps.length - 1].created;
    st.lastSent = now;
    stateDirty = true;
    await saveState(); // erst merken, dann senden -> nie doppelt
    const n = name(from), k = taps.length;
    await send(to, 'pings', {
      title: k === 1 ? `💗 ${n} hat dir Liebe geschickt` : `💗 ${n} hat dir ${k}× Liebe geschickt`,
      body: today > k ? `Heute schon ${today}× 💗 – tippe, um zurückzuschicken` : 'Tippe, um Liebe zurückzuschicken 💕',
      go: 's-home', tag: 'love-' + from,
    });
  }
  // genau dann nochmal nachsehen, wenn die nächste Bündelung fällig ist (statt bis zu 30 s zu warten)
  clearTimeout(loveTimer);
  if (nextCheck.length) {
    const wait = Math.min(...nextCheck) - Date.now() + 500;
    if (wait < POLL_MS) loveTimer = setTimeout(tick, Math.max(wait, 500));
  }
}

// Bündeln: Gruppen, deren letzter Eintrag jünger als QUIET_MS ist, warten noch
function groupQuiet(items, keyOf, field = 'created') {
  const groups = new Map();
  for (const r of items) { const k = keyOf(r); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
  const ready = [], deferred = [];
  for (const g of groups.values()) {
    const newest = Math.max(...g.map(r => ms(r[field])));
    (Date.now() - newest < QUIET_MS ? deferred : ready).push(g);
  }
  return { ready, deferred: deferred.flat() };
}

// b) + d) Fotos (Erinnerungen / Clay), mehrere zu einer Nachricht
async function doPhotos(stream, coll, category, go, label) {
  const items = await pull(stream, coll, 'created');
  if (!items.length) return;
  const { ready, deferred } = groupQuiet(items, r => r.author);
  commit(stream, 'created', ready.flat(), deferred);
  await saveState();
  for (const g of ready) {
    const author = g[0].author;
    const cap = g.length === 1 && g[0].caption ? ` „${g[0].caption}“` : '';
    await send(otherOf(author), category, {
      title: g.length === 1 ? `${label.icon} Neues ${label.one}` : `${label.icon} ${g.length} neue ${label.many}`,
      body: `${name(author)} hat ${g.length === 1 ? 'ein Foto' : g.length + ' Fotos'} zu ${label.where} hinzugefügt${cap}`,
      go, tag: stream,
    });
  }
}

// c) Daten hinzugefügt oder geändert
async function doDates() {
  const items = await pull('dates', 'dates', 'updated');
  if (!items.length) return;
  const { ready, deferred } = groupQuiet(items, r => r.author, 'updated');
  commit('dates', 'updated', ready.flat(), deferred);
  await saveState();
  for (const g0 of ready) {
    const g = [...new Map(g0.map(r => [r.id, r])).values()];
    const author = g[0].author;
    const added = r => Math.abs(ms(r.updated) - ms(r.created)) < 2000;
    let title, body;
    if (g.length === 1) {
      const d = g[0];
      title = added(d) ? '📅 Neues Datum' : '📅 Datum geändert';
      body = `${name(author)}: ${d.emoji || '💗'} ${d.title} (${fmtDate(d.date)})`;
    } else {
      title = `📅 ${g.length} Daten aktualisiert`;
      body = `${name(author)}: ` + g.map(d => `${d.emoji || '💗'} ${d.title}`).join(', ');
    }
    await send(otherOf(author), 'dates', { title, body, go: 's-dates', tag: 'dates' });
  }
}

// e) + f) Reiter: neu / geplant / freigegeben (Flags notified_created, notified_unlock an den Reitern)
async function setTabFlags(id, flags) {
  await api('PATCH', '/api/collections/tabs/records/' + id, flags);
}

async function doTabs() {
  if (!state.tabsInit) {
    // Bestand beim allerersten Start still übernehmen (nur noch gesperrte bekommen später ihr "Date ist da")
    for (const t of await list('tabs', { filter: 'notified_created = false' })) {
      await setTabFlags(t.id, { notified_created: true, notified_unlock: !isLocked(t) });
    }
    state.tabsInit = true; stateDirty = true;
    await saveState();
  }

  for (const t of await list('tabs', { filter: 'notified_created = false', sort: 'created' })) {
    const to = otherOf(t.author);
    if (isLocked(t)) {
      await setTabFlags(t.id, { notified_created: true });
      const w = when(t.unlock_at);
      // KEIN Titel, KEIN Emoji des Reiters
      await send(to, 'planned', { title: '💌 Neues Date geplant', body: `Freigabe am ${w.date} um ${w.time}`, go: 's-final', tag: 'tab-' + t.id });
    } else if (t.unlock_at) {
      // geplant, aber Freigabezeit schon vorbei, bevor wir es gesehen haben
      await setTabFlags(t.id, { notified_created: true, notified_unlock: true });
      await send(to, 'planned', { title: '🎉 Dein Date ist da!', body: tabLabel(t), go: 'tab:' + t.id, tag: 'tab-' + t.id });
    } else {
      await setTabFlags(t.id, { notified_created: true, notified_unlock: true });
      await send(to, 'tabs', { title: '✨ Neuer Reiter', body: `${name(t.author)} hat „${tabLabel(t)}“ erstellt`, go: 'tab:' + t.id, tag: 'tab-' + t.id });
    }
  }

  const due = await list('tabs', {
    filter: `notified_created = true && notified_unlock = false && (unlock_at = "" || unlock_at <= ${q(pbTime(Date.now()))})`,
  });
  for (const t of due) {
    await setTabFlags(t.id, { notified_unlock: true });
    await send(otherOf(t.author), 'planned', { title: '🎉 Dein Date ist da!', body: tabLabel(t), go: 'tab:' + t.id, tag: 'tab-' + t.id });
  }
}

// e) neue Einträge in (freigegebenen) Reitern
async function doEntries() {
  const items = await pull('entries', 'tab_entries', 'created', { expand: 'tab' });
  if (!items.length) return;
  // Einträge in gesperrten Reitern: still übergehen, nichts verraten
  const silent = items.filter(r => !r.expand?.tab || isLocked(r.expand.tab));
  const open = items.filter(r => !silent.includes(r));
  const { ready, deferred } = groupQuiet(open, r => r.author + '/' + r.tab);
  commit('entries', 'created', [...silent, ...ready.flat()], deferred);
  await saveState();
  for (const g of ready) {
    const t = g[0].expand.tab;
    if (isLocked(t)) continue;
    await send(otherOf(g[0].author), 'tabs', {
      title: g.length === 1 ? `📝 Neuer Eintrag in ${tabLabel(t)}` : `📝 ${g.length} neue Einträge in ${tabLabel(t)}`,
      body: `${name(g[0].author)}: ` + g.map(r => r.title).join(', ').slice(0, 180),
      go: 'tab:' + t.id, tag: 'entries-' + t.id,
    });
  }
}

// e) ❤️-Auswahl geändert (wer es war, steht in selected_by)
async function doSelections() {
  const items = await pull('selections', 'tab_entries', 'updated', { filter: 'selected_by != ""', expand: 'tab' });
  if (!items.length) return;
  commit('selections', 'updated', items);
  const toSend = [];
  for (const r of items) {
    const sel = state.selections;
    if (!r.selected) { if (sel[r.tab] === r.id) delete sel[r.tab]; continue; }
    if (sel[r.tab] === r.id) continue;
    sel[r.tab] = r.id;
    const t = r.expand?.tab;
    if (!t || isLocked(t)) continue;
    toSend.push({ r, t });
  }
  stateDirty = true;
  await saveState();
  for (const { r, t } of toSend) {
    await send(otherOf(r.selected_by), 'tabs', {
      title: `❤️ Auswahl in ${tabLabel(t)}`, body: `${name(r.selected_by)} hat „${r.title}“ ausgewählt`,
      go: 'tab:' + t.id, tag: 'sel-' + t.id,
    });
  }
}

// g) Treffen, Öffne wenn (+ gelesen), Sync-Knopf (sync), Schütteln (shake), Spiele (chess/ttt/mono/sudoku), Gutscheine (gift):
//    die PocketBase-Hooks legen sie in push_queue ab,
//    und bündeln dort (notify_prefs wird ignoriert). Spiele + Gutscheine gehören zur Spiele-App.
const QUEUE_GO = { openwhen: 's-openwhen', meeting: 's-plans', owread: 's-openwhen', sync: 's-home', shake: 's-home', bomb: 's-home', grocery: 's-grocery',
  mood: 's-home', supportreq: 's-home', supportans: 's-home', chat: 's-chat', draw: 's-draw' };
const SPIELE_GO = { chess: 's-chess', ttt: 's-ttt', mono: 's-mono', sudoku: 's-sudoku', solitaire: 's-solitaire', snake: 's-snake', poker: 's-poker', trail: 's-trail', gift: 'shop:vouchers', shop: 'shop:mine' };

let queueTimer = null;
async function doQueue() {
  const due = await list('push_queue', { filter: `sent_at = "" && send_after <= ${q(pbTime(Date.now()))}`, sort: 'send_after' });
  for (const item of due) {
    // erst als verschickt markieren, dann senden -> nie doppelt; Antwort enthält den Stand inkl. letzter Bündelung
    const it = await api('PATCH', '/api/collections/push_queue/records/' + item.id, { sent_at: pbTime(Date.now()) });
    const spiele = it.kind in SPIELE_GO;
    // Bomben: jede Nachricht einzeln (eigener tag, kein Topic – sonst ersetzt iOS sie)
    const bomb = it.kind === 'bomb';
    const errors = await deliver(it.user, 'queue:' + it.kind, {
      title: it.title, body: it.body || '', go: (spiele ? SPIELE_GO : QUEUE_GO)[it.kind] || 's-final', tag: bomb ? 'bomb-' + it.key : it.kind,
    }, 'high', !bomb, 'wir'); // Spiele sind seit 26.10.2026 wieder in Wir – alte Spiele-App-Abos werden nicht mehr bedient
    if (errors.length) {
      await api('PATCH', '/api/collections/push_queue/records/' + it.id, { error: errors.join(' | ').slice(0, 1000) })
        .catch(e => log('Fehler merken fehlgeschlagen', e.message));
    }
  }
  // nächster geplanter Push (z. B. Bomben im 1,5-s-Abstand, Nachtruhe bis 7 Uhr) punktgenau statt erst beim nächsten Poll
  clearTimeout(queueTimer);
  const [next] = await list('push_queue', { filter: `sent_at = "" && send_after > ${q(pbTime(Date.now()))}`, sort: 'send_after' })
    .then(r => r.slice(0, 1)).catch(() => []);
  if (next) {
    const wait = ms(next.send_after) - Date.now() + 50;
    if (wait < POLL_MS) queueTimer = setTimeout(tick, Math.max(wait, 200));
  }
}

// ----------------------------------------------------------------------
// Ablauf
// ----------------------------------------------------------------------
let running = false, again = false, unlockTimer = null;

async function tick() {
  if (running) { again = true; return; }
  running = true;
  try {
    users = Object.fromEntries((await list('users')).map(u => [u.id, u]));
    if (!state) await loadState();
    const steps = [
      doPings, doLove, doQueue, doTabs, doEntries, doSelections, doDates,
      () => doPhotos('photos', 'photos', 'photos', 's-memories', { icon: '📷', one: 'Foto', many: 'Fotos', where: 'Erinnerungen' }),
      () => doPhotos('clay', 'clay_photos', 'clay', 's-clay-done', { icon: '🧸', one: 'Clay-Foto', many: 'Clay-Fotos', where: 'unseren Figuren' }),
    ];
    for (const s of steps) {
      try { await s(); } catch (e) { log('Fehler in', s.name || 'Fotos', e.message); }
    }
    await saveState();
    await scheduleUnlock();
  } catch (e) {
    log('Fehler:', e.message);
    state = null; // beim nächsten Mal frisch laden
  } finally {
    running = false;
    if (again) { again = false; setImmediate(tick); }
  }
}

// genaue Freigabe: nächsten gesperrten Reiter punktgenau abholen statt bis zu 30 s zu warten
async function scheduleUnlock() {
  clearTimeout(unlockTimer);
  const [next] = await list('tabs', { filter: `notified_unlock = false && unlock_at > ${q(pbTime(Date.now()))}`, sort: 'unlock_at' })
    .catch(() => []);
  if (!next) return;
  const wait = ms(next.unlock_at) - Date.now() + 1000;
  if (wait < POLL_MS) unlockTimer = setTimeout(tick, Math.max(wait, 500));
}

// Realtime: neue Pings sofort statt erst beim nächsten Poll (Polling bleibt als Rückfallebene)
async function realtime() {
  for (;;) {
    try {
      const res = await fetch(PB + '/api/realtime', { headers: { Accept: 'text/event-stream' } });
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
          const ev = /^event:(.*)$/m.exec(chunk)?.[1]?.trim();
          const data = /^data:(.*)$/m.exec(chunk)?.[1];
          if (ev === 'PB_CONNECT') {
            if (!token) await auth();
            const r = await fetch(PB + '/api/realtime', {
              method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token },
              body: JSON.stringify({ clientId: JSON.parse(data).clientId, subscriptions: ['pings', 'push_queue'] }),
            });
            if (!r.ok) throw new Error('Realtime-Abo fehlgeschlagen ' + r.status);
          } else if (ev === 'pings' || (ev === 'push_queue' && !JSON.parse(data || '{}').record?.sent_at)) {
            // push_queue: neue bzw. ersetzte, noch nicht verschickte Pushs (Spiele) sofort statt erst beim nächsten Poll
            setTimeout(tick, 300);
          }
        }
      }
    } catch (e) {
      log('Realtime getrennt:', e.message);
    }
    await new Promise(r => setTimeout(r, 5000));
  }
}

log(`wir-push startet (PB ${PB}, alle ${POLL_MS / 1000} s)`);
tick();
setInterval(tick, POLL_MS);
realtime();
