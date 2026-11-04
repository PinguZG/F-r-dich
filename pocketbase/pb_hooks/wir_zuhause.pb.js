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
      url: 'http://127.0.0.1:8095/cmd',
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
