// App-Logos der Fernseher-Apps direkt vom Fernseher: per ADB (über Home Assistant) das installierte APK holen, daraus
// das Android-TV-Banner (sonst das App-Symbol, das auch der Launcher nutzt) in der höchsten vorhandenen Auflösung
// nehmen und in PocketBase (Collection home_logos, geschützte Datei – nur für eingeloggte Nutzer) ablegen.
// Nichts davon landet im Repo. Neu gelesen wird nur, wenn sich die App-Version geändert hat.
//
// Weg der Datei: Fernseher --androidtv.download--> HA /media/wir-logo-N.apk --signierter Link (auth/sign_path, 60 s)-->
// wir-home /tmp (PrivateTmp) -> Bild -> PocketBase. Danach wird die Datei in HA mit einer winzigen Datei überschrieben.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const yauzl = require('yauzl');
const ManifestXmlParser = require('app-info-parser/src/xml-parser/manifest');
const ResourceFinder = require('app-info-parser/src/resource-finder');
const { mapInfoResource } = require('app-info-parser/src/utils');

const PKG_RE = /^[a-zA-Z][\w.]{1,120}$/;
const MAX_APK = 400 * 1024 * 1024;
// Wege, eine Datei aus HA abzuholen (androidtv.download darf nur in erlaubte Ordner schreiben, standardmäßig /media und www):
// 1. /media + signierter Link (nur mit HA-Anmeldung). HA liefert dort nur Audio/Video/Bild aus – daher die Endung .mp4
//    (der Inhalt bleibt das APK; die Datei wird danach sofort mit einer winzigen Datei überschrieben).
// 2. Rückfall www (/local/…, im Tailnet ohne Anmeldung lesbar) mit zufälligem, nicht erratbarem Namen.
const zufall = require('crypto').randomBytes(12).toString('hex');
const WEGE = [
  { name: 'media', datei: i => `/media/wir-logo-${i}.mp4`, url: (i, sign) => sign(`/media/local/wir-logo-${i}.mp4`) },
  { name: 'www', datei: i => `/config/www/wir-${zufall}-${i}.bin`, url: async i => `/local/wir-${zufall}-${i}.bin` },
];
let wegOk = null;

// ---------------- ZIP (APK) lesen ----------------
function openZip(file) {
  return new Promise((res, rej) => yauzl.open(file, { lazyEntries: true, autoClose: false }, (e, z) => (e ? rej(e) : res(z))));
}
async function zipEntries(file, want) {
  const z = await openZip(file);
  const out = {}, names = new Set();
  try {
    await new Promise((res, rej) => {
      z.on('error', rej);
      z.on('end', res);
      z.on('entry', ent => {
        names.add(ent.fileName);
        if (!want(ent.fileName) || ent.uncompressedSize > 20 * 1024 * 1024) return z.readEntry();
        z.openReadStream(ent, (e, s) => {
          if (e) return rej(e);
          const parts = [];
          s.on('data', d => parts.push(d));
          s.on('end', () => { out[ent.fileName] = Buffer.concat(parts); z.readEntry(); });
          s.on('error', rej);
        });
      });
      z.readEntry();
    });
  } finally { z.close(); }
  return { files: out, names };
}

// ---------------- Bildgröße (PNG / WebP / JPEG) ----------------
function imgSize(b) {
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), typ: 'image/png', ext: 'png' };
  if (b.length > 30 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const k = b.toString('ascii', 12, 16);
    if (k === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff, typ: 'image/webp', ext: 'webp' };
    if (k === 'VP8L') { const n = b.readUInt32LE(21); return { w: (n & 0x3fff) + 1, h: ((n >> 14) & 0x3fff) + 1, typ: 'image/webp', ext: 'webp' }; }
    if (k === 'VP8X') return { w: b.readUIntLE(24, 3) + 1, h: b.readUIntLE(27, 3) + 1, typ: 'image/webp', ext: 'webp' };
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i < b.length - 9;) {
      if (b[i] !== 0xff) break;
      const m = b[i + 1], len = b.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xc3) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5), typ: 'image/jpeg', ext: 'jpg' };
      i += 2 + len;
    }
  }
  return null;
}

// Banner (Android TV) und Symbol aus dem Manifest, Pfade über resources.arsc aufgelöst
const flat = v => (Array.isArray(v) ? v.flat(5) : v ? [v] : []).filter(x => typeof x === 'string');
function logoPaths(manifest, arsc) {
  const info = new ManifestXmlParser(manifest, { ignore: ['application.service', 'application.receiver', 'application.provider', 'permission-group'] }).parse();
  mapInfoResource(info, new ResourceFinder().processResourceTable(arsc));
  const a = info.application || {};
  const banner = [...flat(a.banner), ...(a.activities || []).flatMap(x => flat(x.banner)), ...(a.activityAliases || []).flatMap(x => flat(x.banner))];
  const icon = [...flat(a.icon), ...flat(a.roundIcon), ...(a.activities || []).flatMap(x => flat(x.icon))];
  const img = p => /\.(png|webp|jpe?g)$/i.test(p);
  return { banner: [...new Set(banner)].filter(img), icon: [...new Set(icon)].filter(img) };
}
// größtes Bild unter den Kandidaten (über alle APK-Teile hinweg)
async function bestImage(apks, paths) {
  if (!paths.length) return null;
  const want = new Set(paths);
  let best = null;
  for (const f of apks) {
    const { files } = await zipEntries(f, n => want.has(n));
    for (const [name, buf] of Object.entries(files)) {
      const s = imgSize(buf);
      if (s && s.w >= 16 && (!best || s.w * s.h > best.w * best.h)) best = { ...s, buf, name };
    }
  }
  return best;
}

// ---------------- Ablauf ----------------
// deps: { adb(cmd) -> Antworttext, call(domain, service, ids, data), signPath(path) -> signierter Pfad, haBase,
//         adbEntity, list() -> {paket: {id, version}}, save(paket, rec, bild|null), log }
async function refresh(pakete, deps, force) {
  const { adb, call, signPath, haBase, adbEntity, log } = deps;
  // APK vom Fernseher nach HA kopieren und abholen; der zuletzt funktionierende Weg wird zuerst probiert
  async function fromHa(devicePath, i) {
    let last = '';
    for (const w of [...WEGE].sort((a, b) => (b === wegOk) - (a === wegOk))) {
      await call('androidtv', 'download', [adbEntity], { device_path: devicePath, local_path: w.datei(i) });
      const r = await fetch(haBase + await w.url(i, signPath), { signal: AbortSignal.timeout(300000) });
      if (r.ok) { wegOk = w; return r; }
      last = `${w.name} ${r.status}`;
      r.body?.cancel().catch(() => {});
    }
    throw new Error('APK aus HA laden: ' + last);
  }
  const known = await deps.list();
  const ergebnis = [];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wir-logos-'));
  let benutzt = 0;   // so viele APK-Plätze in HA wurden belegt (werden am Ende geleert)
  try {
    for (const paket of pakete) {
      if (!PKG_RE.test(paket)) continue;
      try {
        const out = await adb(`pm path ${paket}; dumpsys package ${paket} | grep -m1 versionCode`);
        const apkPaths = [...String(out).matchAll(/^package:(\/\S+\.apk)\s*$/gm)].map(m => m[1]);
        if (!apkPaths.length) {
          if (known[paket]) await deps.remove(paket);
          ergebnis.push([paket, 'nicht installiert']);
          continue;
        }
        const version = (String(out).match(/versionCode=(\d+)/) || [])[1] || '';
        const alt = known[paket];
        if (!force && alt && alt.version === version && alt.bild) { ergebnis.push([paket, 'aktuell']); continue; }
        // base.apk zuerst, dann Teil-APKs (Auflösungs-Splits enthalten oft die großen Bilder)
        apkPaths.sort((x, y) => (/\/base\.apk$/.test(y) ? 1 : 0) - (/\/base\.apk$/.test(x) ? 1 : 0));
        const local = [];
        for (let i = 0; i < apkPaths.length && i < 8; i++) {
          benutzt = Math.max(benutzt, i + 1);
          const r = await fromHa(apkPaths[i], i);
          if (Number(r.headers.get('content-length')) > MAX_APK) throw new Error('APK zu groß');
          const f = path.join(tmp, `${i}.apk`);
          await pipeline(Readable.fromWeb(r.body), fs.createWriteStream(f));
          local.push(f);
        }
        const { files } = await zipEntries(local[0], n => n === 'AndroidManifest.xml' || n === 'resources.arsc');
        if (!files['AndroidManifest.xml'] || !files['resources.arsc']) throw new Error('APK ohne Manifest/Ressourcen');
        const p = logoPaths(files['AndroidManifest.xml'], files['resources.arsc']);
        let art = 'banner', img = await bestImage(local, p.banner);
        if (!img) { art = 'symbol'; img = await bestImage(local, p.icon); }
        await deps.save(paket, { version, art, breite: img?.w || 0, hoehe: img?.h || 0, quelle: img?.name || '' }, img);
        ergebnis.push([paket, img ? `${art} ${img.w}×${img.h}` : 'kein Bild im APK']);
        for (const f of local) fs.rmSync(f, { force: true });
      } catch (err) {
        ergebnis.push([paket, 'Fehler: ' + err.message]);
      }
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
    // APK-Kopien in HA durch eine winzige Datei ersetzen (Platz auf dem Pi)
    for (let i = 0; i < benutzt; i++) {
      for (const w of wegOk ? [wegOk] : WEGE) await call('androidtv', 'download', [adbEntity], { device_path: '/system/etc/hosts', local_path: w.datei(i) }).catch(() => {});
    }
  }
  log('Logos:', ergebnis.map(([p, r]) => `${p} ${r}`).join(' | '));
  return ergebnis;
}

module.exports = { refresh, imgSize, logoPaths };
