// wir-notify: verschickt die Pushs aus der PocketBase-Collection push_queue
// (Treffen-Erinnerungen + "Öffne wenn"). Die Pushs selbst legt pb_hooks/wir_extra.pb.js an.
// Nutzt dieselben VAPID-Schlüssel und dieselbe Collection push_subs wie wir-push.
//
// Konfiguration über Umgebungsvariablen (auf dem Pi: /etc/wir-notify.env, NICHT ins Repo):
//   PB_URL, PB_SUPERUSER_EMAIL, PB_SUPERUSER_PASSWORD
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
//   PUSH_SUBS_COLLECTION (push_subs), PUSH_SUBS_USER_FIELD (user)
//   DRY_RUN=1 -> nichts senden, nur loggen

const webpush = require('web-push');

const env = process.env;
const PB = (env.PB_URL || 'http://127.0.0.1:8090').replace(/\/$/, '');
const SUBS = env.PUSH_SUBS_COLLECTION || 'push_subs';
const USER_FIELD = env.PUSH_SUBS_USER_FIELD || 'user';
const DRY = env.DRY_RUN === '1';
const INTERVAL = Number(env.INTERVAL_MS || 15000);

if (!DRY) {
  for (const k of ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT', 'PB_SUPERUSER_EMAIL', 'PB_SUPERUSER_PASSWORD']) {
    if (!env[k]) { console.error(`Fehlt: ${k}`); process.exit(1); }
  }
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
}

const toPb = d => d.toISOString().replace('T', ' ');
let token = '';

async function api(path, opts = {}, retry = true) {
  const r = await fetch(PB + path, {
    ...opts,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: token } : {}), ...(opts.headers || {}) },
  });
  if ((r.status === 401 || r.status === 403) && retry) { await login(); return api(path, opts, false); }
  const text = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${path}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

async function login() {
  token = '';
  const r = await api('/api/collections/_superusers/auth-with-password', {
    method: 'POST',
    body: JSON.stringify({ identity: env.PB_SUPERUSER_EMAIL, password: env.PB_SUPERUSER_PASSWORD }),
  }, false);
  token = r.token;
}

// push_subs kann die Subscription unterschiedlich speichern – alle üblichen Formen annehmen
function toSubscription(r) {
  let s = r.subscription ?? r.sub ?? r.data ?? null;
  if (typeof s === 'string') { try { s = JSON.parse(s); } catch { s = null; } }
  if (s && s.endpoint) return s;
  if (r.endpoint) {
    const keys = typeof r.keys === 'string' ? JSON.parse(r.keys) : r.keys;
    return { endpoint: r.endpoint, keys: keys || { p256dh: r.p256dh, auth: r.auth } };
  }
  return null;
}

const q = s => encodeURIComponent(s);

async function tick() {
  const now = toPb(new Date());
  const pending = await api(`/api/collections/push_queue/records?perPage=50&sort=send_after&filter=${q(`sent_at = "" && send_after <= "${now}"`)}`);
  for (const item of pending.items) {
    const subs = await api(`/api/collections/${SUBS}/records?perPage=50&filter=${q(`${USER_FIELD} = "${item.user}"`)}`);
    const payload = JSON.stringify({ title: item.title, body: item.body || '', url: item.url || '/', tag: item.kind });
    const errors = [];
    let sent = 0;
    for (const r of subs.items) {
      const sub = toSubscription(r);
      if (!sub) { errors.push(`${r.id}: unbekanntes Format`); continue; }
      if (DRY) { console.log('[dry]', item.user, payload, sub.endpoint.slice(0, 50)); sent++; continue; }
      try {
        await webpush.sendNotification(sub, payload, { TTL: 6 * 3600, urgency: 'high' });
        sent++;
      } catch (err) {
        errors.push(`${r.id}: ${err.statusCode || ''} ${err.body || err.message}`.slice(0, 200));
      }
    }
    await api(`/api/collections/push_queue/records/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ sent_at: toPb(new Date()), error: errors.join(' | ').slice(0, 1000) }),
    });
    console.log(`${item.kind} -> ${item.user}: ${sent}/${subs.items.length} gesendet${errors.length ? ' · ' + errors.join(' | ') : ''}`);
  }
}

let running = false;
async function loop() {
  if (running) return;
  running = true;
  try { await tick(); }
  catch (err) { console.error('Fehler:', err.message); }
  finally { running = false; }
}

(async () => {
  console.log(`wir-notify gestartet (${PB}${DRY ? ', DRY_RUN' : ''})`);
  try { await login(); } catch (err) { console.error('Login fehlgeschlagen:', err.message); }
  loop();
  setInterval(loop, INTERVAL);
})();
