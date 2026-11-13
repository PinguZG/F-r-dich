/// <reference path="../pb_data/types.d.ts" />
// Zuhause (Smart Home): Befehle aus der App an den Dienst wir-home (home/index.js, nur 127.0.0.1:8095).
// - nur eingeloggte App-Nutzer (Collection users) – ohne Login 401
// - wir-home prüft jeden Befehl gegen die Freigabeliste (home/config.jsonc) und hat ein Rate-Limit
// - erfolgreiche Befehle landen im Aktivitäts-Log (Konsole /log), z. B. "🏠 Stehlampe an"
// Zustände kommen NICHT über diese Route, sondern per Realtime aus der Collection home_state.

routerAdd('POST', '/api/home/cmd', (e) => {
  const body = e.requestInfo().body || {};
  const cmd = {
    user: e.auth.id,
    entity_id: String(body.entity_id || '').slice(0, 120),
    service: String(body.service || '').slice(0, 60),
    data: body.data && typeof body.data === 'object' ? body.data : {},
    scene: body.scene == null ? '' : String(body.scene).slice(0, 60),
  };
  let res;
  try {
    res = $http.send({
      url: ($os.getenv('WIR_HOME_URL') || 'http://127.0.0.1:8095') + '/cmd',   // lokal testen: anderer Port
      method: 'POST',
      body: JSON.stringify(cmd),
      headers: { 'content-type': 'application/json' },
      timeout: 12,
    });
  } catch (err) {
    return e.json(503, { ok: false, message: 'Zuhause-Dienst nicht erreichbar' });
  }
  let out = {};
  try { out = res.json || JSON.parse(toString(res.body)); } catch (_) { out = {}; }
  if (res.statusCode !== 200) {
    return e.json(res.statusCode >= 400 && res.statusCode < 600 ? res.statusCode : 502, { ok: false, message: String(out.message || 'Fehler') });
  }
  // Protokoll (nur der letzte Schritt einer Wisch-Bewegung schickt log: true; gleiche Zeile innerhalb von 4 s nur einmal)
  if (body.log !== false && out.label) {
    try {
      const k = 'zh_log_' + e.auth.id;
      const last = $app.store().get(k);
      const now = Date.now();
      if (!last || last.label !== out.label || now - last.t > 4000) {
        $app.store().set(k, { label: out.label, t: now });
        require(`${__hooks}/activity_lib.js`).log(e.app, e.auth.id, 'home', 'zuhause', String(out.label));
      }
    } catch (err) {
      e.app.logger().error('zuhause log', 'error', String(err));
    }
  }
  return e.json(200, { ok: true, label: out.label || '' });
}, $apis.requireAuth('users'));

// To-dos (Collection home_todos): Anlegen und Abhaken im Aktivitäts-Log, Ersteller vom Server gesetzt
onRecordCreateRequest((e) => {
  e.record.set('created_by', e.auth ? e.auth.id : '');
  e.next();
  try { require(`${__hooks}/activity_lib.js`).log(e.app, e.auth.id, 'home', 'zuhause', 'To-do neu: ' + e.record.getString('text')); } catch (_) {}
}, 'home_todos');
onRecordUpdateRequest((e) => {
  const was = e.record.original().getBool('done');
  e.next();
  try {
    if (!was && e.record.getBool('done')) require(`${__hooks}/activity_lib.js`).log(e.app, e.auth.id, 'home', 'zuhause', 'To-do erledigt: ' + e.record.getString('text'));
  } catch (_) {}
}, 'home_todos');

// Wecker geändert (home_settings "wecker") -> kurze Zeilen im Aktivitäts-Log ("Wecker 5:00 an", "Wecker 5:00 → 6:30" …).
// Nur Unterschiede zum vorherigen Stand; gleiche Zeile innerhalb von 4 s nur einmal.
// (Handler laufen isoliert: alles muss in der Funktion selbst stehen.)
function wirWeckerLog(e) {
  const before = e.record.original().getString('data');
  e.next();
  try {
    if (e.record.getString('key') !== 'wecker') return;
    const parse = (t) => { try { return JSON.parse(t) || {}; } catch (_) { return {}; } };
    const a = parse(before), b = parse(e.record.getString('data'));
    const old = {}; (a.alarms || []).forEach((x) => { old[x.id] = x; });
    const seen = {}; const lines = [];
    (b.alarms || []).forEach((x) => {
      seen[x.id] = 1;
      const o = old[x.id];
      if (!o) { lines.push('Wecker ' + x.zeit + ' neu'); return; }
      if (o.zeit !== x.zeit) lines.push('Wecker ' + o.zeit + ' → ' + x.zeit);
      if (!!o.an !== !!x.an) lines.push('Wecker ' + x.zeit + (x.an ? ' an' : ' aus'));
      if (JSON.stringify(o.tage) !== JSON.stringify(x.tage) || o.bis !== x.bis || o.alle !== x.alle || o.titel !== x.titel || !!o.ton !== !!x.ton) lines.push('Wecker ' + x.zeit + ' geändert');
    });
    (a.alarms || []).forEach((o) => { if (!seen[o.id]) lines.push('Wecker ' + o.zeit + ' entfernt'); });
    if ((a.aussetzen || '') !== (b.aussetzen || '')) lines.push(b.aussetzen ? 'Wecker morgen aussetzen' : 'Wecker wieder aktiv');
    if (!lines.length && before !== e.record.getString('data')) lines.push('Wecker-Einstellungen');
    const act = require(`${__hooks}/activity_lib.js`);
    const k = 'zh_wk_' + e.auth.id, now = Date.now(), last = $app.store().get(k) || {};
    lines.slice(0, 3).forEach((l) => {
      if (last[l] && now - last[l] < 4000) return;
      last[l] = now;
      act.log(e.app, e.auth.id, 'home', 'zuhause', l);
    });
    $app.store().set(k, last);
  } catch (err) {
    e.app.logger().error('wecker log', 'error', String(err));
  }
}
onRecordUpdateRequest(wirWeckerLog, 'home_settings');
onRecordCreateRequest(wirWeckerLog, 'home_settings');

// Wecker-Einstellungen geändert -> wir-home überträgt sie in die Helfer des Lichtweckers in Home Assistant
function wirWeckerSync(e) {
  e.next();
  if (e.record.getString('key') !== 'wecker') return;
  try {
    $http.send({ url: ($os.getenv('WIR_HOME_URL') || 'http://127.0.0.1:8095') + '/wecker', method: 'POST', body: '{}', headers: { 'content-type': 'application/json' }, timeout: 3 });
  } catch (err) {
    e.app.logger().warn('zuhause wecker sync', 'error', String(err));   // wir-home gleicht ohnehin alle 15 Min ab
  }
}
onRecordAfterCreateSuccess(wirWeckerSync, 'home_settings');
onRecordAfterUpdateSuccess(wirWeckerSync, 'home_settings');
