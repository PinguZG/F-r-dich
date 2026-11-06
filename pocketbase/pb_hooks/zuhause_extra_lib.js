// Zuhause-Extras: Hilfen für pb_hooks/wir_zuhause_extra.pb.js (Weiterleitung an wir-home, persönliche Einstellungen).
const HOME = $os.getenv('WIR_HOME_URL') || 'http://127.0.0.1:8095';   // lokal testen: anderer Port
const STOP_RE = /^[A-Za-z0-9_:.|-]{3,120}$/;

// GET an wir-home; Antwort { code, json }
function ask(path, params, timeout) {
  const q = Object.keys(params).filter(k => params[k] !== '' && params[k] != null)
    .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(String(params[k]))).join('&');
  let res;
  try {
    res = $http.send({ url: HOME + path + (q ? '?' + q : ''), method: 'GET', timeout: timeout || 25 });
  } catch (err) {
    return { code: 503, json: { message: 'Zuhause-Dienst nicht erreichbar' } };
  }
  let out = {};
  try { out = res.json || JSON.parse(toString(res.body)); } catch (_) { out = {}; }
  const code = res.statusCode >= 200 && res.statusCode < 600 ? res.statusCode : 502;
  return { code, json: code === 200 ? out : { message: String(out.message || 'Fehler') } };
}

// persönliche Einstellungen (home_prefs) der angemeldeten Person
function prefs(app, uid) {
  try {
    const r = app.findFirstRecordByFilter('home_prefs', 'user = {:u}', { u: uid });
    return JSON.parse(r.getString('data') || '{}') || {};
  } catch (_) { return {}; }
}

// Inhalt säubern: nur bekannte Felder, Haltestellen-IDs im erwarteten Format
function stop(v) {
  if (!v || typeof v !== 'object' || !STOP_RE.test(String(v.id || ''))) return null;
  return { id: String(v.id), name: String(v.name || '').slice(0, 60) };
}
function clean(d) {
  d = d && typeof d === 'object' ? d : {};
  const a = d.arten && typeof d.arten === 'object' ? d.arten : {};
  const f = d.fahrt && typeof d.fahrt === 'object' ? d.fahrt : {};
  return {
    haltestelle: stop(d.haltestelle),
    arten: { bus: a.bus !== false, bahn: a.bahn !== false },
    fahrt: { von: stop(f.von), nach: stop(f.nach) },
  };
}

// liegt laut Countdown (date_events) ein Treffen in den nächsten 24 Stunden?
function meetingSoon(app) {
  const wir = require(`${__hooks}/wir_lib.js`);
  const now = Date.now();
  try {
    const list = app.findRecordsByFilter('date_events', 'when >= {:a} && when <= {:b}', 'when', 1, 0,
      { a: wir.toPb(now - 3600000), b: wir.toPb(now + 24 * 3600000) });
    return list.length > 0;
  } catch (_) { return false; }
}

module.exports = { ask, prefs, clean, meetingSoon };
