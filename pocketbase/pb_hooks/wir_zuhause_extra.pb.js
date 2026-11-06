/// <reference path="../pb_data/types.d.ts" />
// Zuhause-Extras (06.11.2026): Abfahrten, Haltestellensuche, Pakete, System-Status – die App fragt hier, PocketBase
// schickt die angemeldete Person an wir-home (home/extras.js, nur 127.0.0.1:8095). wir-home prüft die Rechte:
// Pakete + System-Status nur für den Besitzer (config.jsonc "extras.besitzer"). Haltestellen liest PocketBase aus
// home_prefs der angemeldeten Person – die andere Person kommt nie an fremde Haltestellen.
// Gehört nach /home/pingu/pb/pb_hooks/ (zusammen mit zuhause_extra_lib.js, wir_lib.js).

// Was darf ich sehen? { besitzer, pakete }
routerAdd('GET', '/api/home/rechte', (e) => {
  const r = require(`${__hooks}/zuhause_extra_lib.js`).ask('/x/rechte', { user: e.auth.id }, 5);
  return e.json(r.code, r.json);
}, $apis.requireAuth('users'));

// Abfahrten der eigenen Haltestelle (+ "Fahrt zu …", wenn ein Treffen in den nächsten 24 h liegt)
routerAdd('GET', '/api/home/abfahrten', (e) => {
  const lib = require(`${__hooks}/zuhause_extra_lib.js`);
  const p = lib.clean(lib.prefs(e.app, e.auth.id));
  if (!p.haltestelle) return e.json(200, { aus: true });
  const arten = ['bus', 'bahn'].filter(a => p.arten[a]).join(',') || 'bus,bahn';
  const fahrt = !!(p.fahrt.von && p.fahrt.nach) && lib.meetingSoon(e.app);
  const r = lib.ask('/x/abfahrten', {
    stop: p.haltestelle.id, arten,
    von: fahrt ? p.fahrt.von.id : '', nach: fahrt ? p.fahrt.nach.id : '',
  }, 30);
  if (r.code === 200) {
    r.json.haltestelle = p.haltestelle.name || r.json.name || '';
    if (fahrt) { r.json.fahrt_von = p.fahrt.von.name; r.json.fahrt_nach = p.fahrt.nach.name; }
  }
  return e.json(r.code, r.json);
}, $apis.requireAuth('users'));

// Haltestellensuche (für die Einstellungen)
routerAdd('GET', '/api/home/orte', (e) => {
  const q = String(e.request.url.query().get('q') || '').slice(0, 60);
  const r = require(`${__hooks}/zuhause_extra_lib.js`).ask('/x/orte', { q, user: e.auth.id }, 20);
  return e.json(r.code, r.json);
}, $apis.requireAuth('users'));

// nur Besitzer (prüft wir-home)
routerAdd('GET', '/api/home/pakete', (e) => {
  const r = require(`${__hooks}/zuhause_extra_lib.js`).ask('/x/pakete', { user: e.auth.id }, 40);
  return e.json(r.code, r.json);
}, $apis.requireAuth('users'));
routerAdd('GET', '/api/home/system', (e) => {
  const r = require(`${__hooks}/zuhause_extra_lib.js`).ask('/x/system', { user: e.auth.id }, 30);
  return e.json(r.code, r.json);
}, $apis.requireAuth('users'));

// home_prefs: Inhalt säubern, Besitzer immer die angemeldete Person
function wirPrefsClean(e) {
  if (e.auth) e.record.set('user', e.auth.id);
  let d = {};
  try { d = JSON.parse(e.record.getString('data') || '{}') || {}; } catch (_) { d = {}; }
  e.record.set('data', require(`${__hooks}/zuhause_extra_lib.js`).clean(d));
  e.next();
}
onRecordCreateRequest(wirPrefsClean, 'home_prefs');
onRecordUpdateRequest(wirPrefsClean, 'home_prefs');
