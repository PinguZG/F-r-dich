#!/usr/bin/env node
// Lokale Vorschau der Wir-App (nur am PC, nie auf dem VPS).
// Startet PocketBase (Hooks + Migrationen direkt aus dem Repo, app/ als Webseite) und wir-home im Testmodus.
// Alles Lokale liegt in lokal/ (per .gitignore nie im Repo): pocketbase.exe, pb_data/, zugang.env (Test-Zugänge).
// Start: node dev/lokal.js   →  http://127.0.0.1:8090
'use strict';
const { spawn, spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LOKAL = path.join(ROOT, 'lokal');
const PB_EXE = path.join(LOKAL, process.platform === 'win32' ? 'pocketbase.exe' : 'pocketbase');
const DATA = path.join(LOKAL, 'pb_data');
const ZUGANG = path.join(LOKAL, 'zugang.env');
const PORT = Number(process.env.WIR_LOKAL_PORT || 8090);
const URL = `http://127.0.0.1:${PORT}`;

if (!fs.existsSync(PB_EXE)) {
  console.error(`Fehlt: ${PB_EXE}\nPocketBase 0.40.5 offiziell von github.com/pocketbase/pocketbase/releases holen und dort ablegen (siehe ANLEITUNG.md, „Lokale Vorschau“).`);
  process.exit(1);
}

// Test-Zugänge: einmal zufällig erzeugen, dann aus lokal/zugang.env lesen. Nur Testwerte, nie echte Passwörter.
function zugang() {
  const pw = () => crypto.randomBytes(9).toString('base64url');
  if (!fs.existsSync(ZUGANG)) {
    const z = {
      ADMIN_EMAIL: 'admin@wir.test', ADMIN_PASSWORD: pw(),
      DANIEL_EMAIL: 'daniel@wir.test', DANIEL_PASSWORD: pw(),
      IDA_EMAIL: 'ida@wir.test', IDA_PASSWORD: pw(),
    };
    fs.mkdirSync(LOKAL, { recursive: true });
    fs.writeFileSync(ZUGANG, '# Lokale TEST-Zugänge (nur für http://127.0.0.1). Nicht ins Repo.\n' +
      Object.entries(z).map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
    console.log(`Neue Test-Zugänge in ${ZUGANG}`);
  }
  const out = {};
  for (const line of fs.readFileSync(ZUGANG, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}
const Z = zugang();

// Migrationen: lokale Grundstruktur (dev/lokal-basis, nur hier) + echte Migrationen aus dem Repo, bei jedem Start frisch.
const MIG = path.join(LOKAL, 'migrations');
fs.rmSync(MIG, { recursive: true, force: true });
fs.mkdirSync(MIG, { recursive: true });
for (const d of [path.join(__dirname, 'lokal-basis'), path.join(ROOT, 'pocketbase', 'pb_migrations')]) {
  for (const f of fs.readdirSync(d)) if (f.endsWith('.js')) fs.copyFileSync(path.join(d, f), path.join(MIG, f));
}
process.env.WIR_REPO_DIR = ROOT.replace(/\\/g, '/');

const pbArgs = d => [`--dir=${d}`, `--hooksDir=${path.join(ROOT, 'pocketbase', 'pb_hooks')}`, `--migrationsDir=${MIG}`];

// Superuser (nur lokal) anlegen bzw. Passwort angleichen.
const up = spawnSync(PB_EXE, ['superuser', 'upsert', Z.ADMIN_EMAIL, Z.ADMIN_PASSWORD, ...pbArgs(DATA)], { encoding: 'utf8' });
if (up.status !== 0) { console.error(up.stdout, up.stderr); process.exit(1); }

const kids = [];
function run(name, cmd, args, opts) {
  const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
  const pre = `[${name}] `;
  const pipe = s => s.on('data', b => process.stdout.write(b.toString().split(/\r?\n/).filter(Boolean).map(l => pre + l).join('\n') + '\n'));
  pipe(p.stdout); pipe(p.stderr);
  p.on('exit', c => { console.log(`${pre}beendet (${c})`); if (name === 'pocketbase') stop(); });
  kids.push(p);
  return p;
}
function stop() { for (const k of kids) { try { k.kill(); } catch (_) {} } process.exit(0); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);

run('pocketbase', PB_EXE, ['serve', `--http=127.0.0.1:${PORT}`, `--publicDir=${path.join(ROOT, 'app')}`, ...pbArgs(DATA)], {
  env: { ...process.env, WIR_SHARED_DIR: path.join(ROOT, 'shared') },
});

async function api(p, opts = {}, token) {
  const r = await fetch(URL + p, { ...opts, headers: { 'content-type': 'application/json', ...(token ? { Authorization: token } : {}) } });
  const t = await r.text();
  let j; try { j = JSON.parse(t); } catch (_) { j = t; }
  if (!r.ok) throw new Error(`${p}: ${r.status} ${t}`);
  return j;
}

async function bereit() {
  for (let i = 0; i < 60; i++) {
    try { await api('/api/health'); return; } catch (_) { await new Promise(r => setTimeout(r, 500)); }
  }
  throw new Error('PocketBase startet nicht');
}

// Zwei Test-Accounts (Daniel/Ida) einmalig anlegen, mit unterschiedlicher Herzfarbe.
async function testAccounts(token) {
  const users = [
    { email: Z.DANIEL_EMAIL, password: Z.DANIEL_PASSWORD, name: 'Daniel', heart_color: 'himmel' },
    { email: Z.IDA_EMAIL, password: Z.IDA_PASSWORD, name: 'Ida', heart_color: 'rosa' },
  ];
  for (const u of users) {
    const f = encodeURIComponent(`email="${u.email}"`);
    const found = await api(`/api/collections/users/records?filter=${f}`, {}, token);
    if (found.items.length) continue;
    const body = { email: u.email, password: u.password, passwordConfirm: u.password, name: u.name, verified: true, heart_color: u.heart_color };
    try { await api('/api/collections/users/records', { method: 'POST', body: JSON.stringify(body) }, token); }
    catch (e) {   // falls heart_color andere Werte erwartet: ohne Farbe anlegen
      delete body.heart_color;
      await api('/api/collections/users/records', { method: 'POST', body: JSON.stringify(body) }, token);
    }
    console.log(`[lokal] Test-Account ${u.name} angelegt`);
  }
}

(async () => {
  await bereit();
  const auth = await api('/api/collections/_superusers/auth-with-password', {
    method: 'POST', body: JSON.stringify({ identity: Z.ADMIN_EMAIL, password: Z.ADMIN_PASSWORD }),
  });
  await testAccounts(auth.token);

  // wir-home im Testmodus (ohne HA_URL/HA_TOKEN simuliert er Home Assistant).
  const home = path.join(ROOT, 'home');
  if (!fs.existsSync(path.join(home, 'node_modules'))) {
    console.log('[lokal] home/node_modules fehlt → npm install in home/ (einmalig)');
    spawnSync('npm install --no-audit --no-fund', { cwd: home, stdio: 'inherit', shell: true });
  }
  run('wir-home', process.execPath, [path.join(home, 'index.js')], {
    cwd: home,
    env: { ...process.env, PB_URL: URL, PB_EMAIL: Z.ADMIN_EMAIL, PB_PASSWORD: Z.ADMIN_PASSWORD, HA_URL: '', HA_TOKEN: '' },
  });
  console.log(`\n[lokal] Bereit: ${URL}  ·  Admin: ${URL}/_/  ·  Zugänge: lokal/zugang.env\n`);
})().catch(e => { console.error('[lokal] ' + e.message); stop(); });
