// Zuhause-Extras – Datendienst (neues Design 12.11.2026): Partner, Abfahrten, Pakete, System und die eigenen Haltestellen.
// Daten nur über PocketBase (pb_hooks/wir_zuhause_extra.pb.js -> wir-home); Pakete + System prüft der Server selbst
// (nur Besitzer), die Ansichten blenden die Reiter nur aus. Gezeichnet wird in zuhause-tab.js / zuhause-handy.js.
// Sparsam: abgefragt wird nur, solange Zuhause sichtbar ist und der jeweilige Reiter (bzw. Home für die Kurzinfos) offen.
// Ein Takt (15 s) für alles; jede neue Antwort meldet 'zhx:change'.
(() => {
  const pb = () => window.WIR_PB;
  const myId = () => (pb()?.authStore.record || pb()?.authStore.model)?.id;
  const pad = n => String(n).padStart(2, '0');
  const hm = t => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const MIN = 60000;
  const pbMs = s => Date.parse(String(s).replace(' ', 'T'));
  function ago(t) {
    const s = (Date.now() - t) / 1000;
    if (s < 90) return 'gerade eben';
    if (s < 3600) return `vor ${Math.round(s / 60)} Min.`;
    if (s < 86400) return `vor ${Math.round(s / 3600)} Std.`;
    const d = new Date(t);
    return `am ${pad(d.getDate())}.${pad(d.getMonth() + 1)}. um ${hm(t)}`;
  }
  function dateTxt(t) {
    if (!t) return '';
    const d = new Date(t), today = new Date().setHours(0, 0, 0, 0), day = new Date(t).setHours(0, 0, 0, 0);
    return day === today ? 'heute ' + hm(t) : day === today - 864e5 ? 'gestern ' + hm(t) : `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`;
  }

  let life = false, page = 'home', timer = 0, rechte = null, rechteAt = 0;
  const D = { prefs: null, prefsId: '', abf: null, abfErr: '', pak: null, sys: null, ping: null, pings: null, presence: null };
  const due = { partner: 0, abf: 0, pak: 0, sys: 0 };
  const changed = () => document.dispatchEvent(new Event('zhx:change'));
  const running = () => life && !document.hidden;

  // ------------------------------------------------------------ Laden
  async function loadPartner() {
    try {
      const since = new Date(new Date().setHours(0, 0, 0, 0) - 13 * 864e5).toISOString().replace('T', ' ');
      const r = await pb().collection('pings').getList(1, 300, { sort: '-created', filter: pb().filter('created >= {:s}', { s: since }), fields: 'from,created,type', requestKey: 'zx-ping' });
      D.pings = r.items;
      D.ping = r.items[0] || D.ping || null;
      if (!D.ping) {
        const one = await pb().collection('pings').getList(1, 1, { sort: '-created', fields: 'from,created,type', requestKey: 'zx-ping1' });
        D.ping = one.items[0] || null;
      }
    } catch (_) { /* alter Stand bleibt */ }
    changed();
  }
  async function loadAbf() {
    try { D.abf = await pb().send('/api/home/abfahrten', { requestKey: 'zx-abf' }); D.abfErr = ''; }
    catch (err) { D.abfErr = err?.message || 'Fehler'; if (D.abf) D.abf.stale = true; }
    changed();
  }
  async function loadPak() {
    try { D.pak = await pb().send('/api/home/pakete', { requestKey: 'zx-pak' }); }
    catch (err) { if (err?.status === 403) D.pak = null; else if (D.pak) D.pak.stale = true; }
    changed();
  }
  async function loadSys() {
    try { D.sys = await pb().send('/api/home/system', { requestKey: 'zx-sys' }); }
    catch (err) { if (err?.status === 403) D.sys = null; }
    changed();
  }
  async function loadRechte() {
    if (rechte && Date.now() - rechteAt < 30 * MIN) return;
    try { rechte = await pb().send('/api/home/rechte', { requestKey: 'zx-rechte' }); rechteAt = Date.now(); }
    catch (_) { rechte = rechte || null; }
    changed();
  }
  const pakOk = () => !!(rechte?.besitzer && rechte.pakete);
  const sysOk = () => !!rechte?.besitzer;

  // nur der offene Reiter fragt nach; Home/Mehr holen die Kurzinfos (Ping, nächste Abfahrt, Pakete) seltener
  async function step() {
    if (!running()) return;
    const now = Date.now();
    await loadRechte();
    const home = page === 'home' || page === 'mehr';
    if (page === 'partner' || (home && now >= due.partner)) { if (now >= due.partner) { due.partner = now + (home ? 5 : 1) * MIN; loadPartner(); } }
    if (page === 'abf' || (home && D.prefs?.haltestelle)) { if (now >= due.abf) { due.abf = now + MIN; loadAbf(); } else if (page === 'abf') changed(); }
    if ((page === 'pak' || home) && pakOk() && now >= due.pak) { due.pak = now + 10 * MIN; loadPak(); }
    if (page === 'sys' && sysOk() && now >= due.sys) { due.sys = now + MIN; loadSys(); }
  }
  function sync() {
    const on = running();
    if (on && !timer) { timer = setInterval(step, 15000); step(); }
    else if (!on && timer) { clearInterval(timer); timer = 0; }
  }
  function refresh(kind) { due[kind] = 0; if (kind === 'pak') loadPak(); else if (kind === 'sys') loadSys(); else if (kind === 'abf') loadAbf(); else if (kind === 'partner') loadPartner(); }

  // ------------------------------------------------------------ Ich denk an dich
  let thinkUntil = 0;
  async function think(btn) {
    if (Date.now() < thinkUntil || !window.WIR_PING) return null;
    thinkUntil = Date.now() + 10000;   // gegen Doppeltipps (die Ping-Logik sperrt selbst 1,5 s)
    const ok = await window.WIR_PING.send('support', btn);
    if (!ok) thinkUntil = 0;
    if (ok) setTimeout(loadPartner, 800);
    return ok;
  }
  // Pings der letzten 14 Tage: a = du → Partner, b = Partner → dich
  function pingDays() {
    const me = myId(), today = new Date().setHours(0, 0, 0, 0);
    const days = Array.from({ length: 14 }, (_, i) => ({ t: today - (13 - i) * 864e5, a: 0, b: 0 }));
    for (const g of D.pings || []) {
      const d = new Date(pbMs(g.created)).setHours(0, 0, 0, 0), i = Math.round((d - days[0].t) / 864e5);
      if (i >= 0 && i < 14) { if (g.from === me) days[i].a++; else days[i].b++; }
    }
    return days;
  }
  function presence() {
    const p = window.WIR_LOOK?.partner?.();
    const pr = p && (window.WIR_PRESENCE?.get?.() || []).find(x => x.id === p.id);
    return { online: !!pr?.online, txt: pr?.online ? 'gerade online' : pr?.last_seen ? 'zuletzt aktiv ' + ago(pbMs(pr.last_seen)) : '' };
  }

  // ------------------------------------------------------------ Eigene Haltestellen (home_prefs, nur ich)
  const ART = { bus: 'Bus', bahn: 'Bahn' };
  const prefs = () => {
    const d = D.prefs || {};
    return { haltestelle: d.haltestelle || null, arten: { bus: d.arten?.bus !== false, bahn: d.arten?.bahn !== false }, fahrt: { von: d.fahrt?.von || null, nach: d.fahrt?.nach || null } };
  };
  async function loadPrefs() {
    try {
      const r = await pb().collection('home_prefs').getList(1, 1, { filter: pb().filter('user = {:u}', { u: myId() }), requestKey: 'zx-prefs' });
      D.prefs = r.items[0]?.data || {}; D.prefsId = r.items[0]?.id || '';
    } catch (_) { /* bleibt leer */ }
    changed();
  }
  async function save(p) {
    D.prefs = p; changed();
    try {
      const rec = D.prefsId ? await pb().collection('home_prefs').update(D.prefsId, { data: p }) : await pb().collection('home_prefs').create({ user: myId(), data: p });
      D.prefsId = rec.id; D.prefs = rec.data;
      due.abf = 0; D.abf = null; loadAbf();
    } catch (err) {
      // schon angelegt (anderes Gerät) -> nachladen und nochmal
      if (!D.prefsId) { await loadPrefs(); if (D.prefsId) return save(p); }
    }
    changed();
  }
  // Bus/Bahn umschalten (nie beides aus)
  function toggleArt(art) {
    const p = prefs();
    const a = { ...p.arten, [art]: !p.arten[art] };
    if (!a.bus && !a.bahn) return false;
    save({ ...p, arten: a });
    return true;
  }
  // target: 'haltestelle' | 'von' | 'nach'; ort = { id, name } oder null (entfernen)
  function setOrt(target, ort) {
    const p = prefs();
    if (target === 'haltestelle') p.haltestelle = ort; else p.fahrt = { ...p.fahrt, [target]: ort };
    save(p);
  }
  async function searchOrte(q) {
    const r = await pb().send('/api/home/orte', { query: { q }, requestKey: 'zx-orte' });
    return (r.orte || []).map(o => ({ id: o.id, name: o.name, sub: [o.ort, (o.arten || []).map(a => ART[a]).join(' · ')].filter(Boolean).join(' · ') }));
  }

  // ------------------------------------------------------------ Verdrahtung mit zuhause.js
  document.addEventListener('zh:built', () => { if (!D.prefs) loadPrefs(); });
  document.addEventListener('zh:page', e => {
    page = e.detail;
    if (page === 'einst') loadPrefs();
    if (timer) { clearInterval(timer); timer = 0; }   // Reiterwechsel: sofort einmal für den neuen Reiter
    sync();
  });
  document.addEventListener('zh:life', e => {
    life = !!e.detail;
    if (life) { window.WIR_PRESENCE?.reload?.(); due.partner = 0; due.abf = 0; }
    sync();
  });
  document.addEventListener('visibilitychange', sync);
  // anderes Konto auf demselben Gerät: nichts vom vorigen behalten
  let authId = myId();
  pb()?.authStore.onChange(() => {
    const id = myId();
    if (id === authId) return;
    authId = id;
    Object.assign(D, { prefs: null, prefsId: '', abf: null, abfErr: '', pak: null, sys: null, ping: null, pings: null });
    rechte = null; rechteAt = 0;
    for (const k of Object.keys(due)) due[k] = 0;
  });

  window.ZHX = { D, hm, ago, dateTxt, pbMs, myId, pakOk, sysOk, refresh, think, pingDays, presence, prefs, toggleArt, setOrt, searchOrte, loadPrefs, MIN };
})();
