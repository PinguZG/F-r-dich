// Zuhause – Kern (neues Design, 12.11.2026). Daten nur über window.ZuhauseData (zuhause-data.js), nie direkt von Home Assistant.
// Zwei Ansichten im Shadow-DOM von #zh (App- und Zuhause-Stile beißen sich so nicht):
//   Tablet/Breitbild (≥ 900 px quer): zuhause-tab.js – festes 800×600-Raster, skaliert (Entwurf zuhause.html)
//   Handy: zuhause-handy.js – dunkles Lila-Glas mit eigener unterer Leiste (Entwurf zuhause-handy.html)
// Der Kern hält Zustand, optimistische Werte und alle Befehle; die Ansichten zeichnen nur und rufen window.ZH.* auf.
// Lebenszyklus: Abos und Takte laufen NUR, solange Zuhause sichtbar ist (Bereich aktiv und App im Vordergrund).
(() => {
  const host = document.getElementById('zh');
  if (!host || !window.ZuhauseData) return;
  const VIEWS = window.ZH_VIEWS || (window.ZH_VIEWS = {});
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');

  // ---------------------------------------------------------------- Zustand
  const T = window.ZuhauseData.create(window.ZH_TRANSPORT || 'wir');
  const S = T.state;
  const ov = {};              // optimistische Anzeige pro entity_id { on, b, c, vol, muted, playing, app, source, t }
  let sceneOv = null, active = false, mode = '', root = null, wrap = null, V = null, page = 'home';
  const mqTab = matchMedia('(min-width:900px) and (orientation:landscape)');
  const isIOS = CSS.supports('-webkit-touch-callout', 'none');
  const ent = id => (id && S.entities[id]) || null;
  const cfg = () => S.config;

  const local = { night: true, saverMin: 5, toasts: true };
  try {
    local.night = localStorage.getItem('zh-night') !== '0';
    local.saverMin = +localStorage.getItem('zh-saver') || 5;
    local.toasts = localStorage.getItem('zh-toasts') !== '0';
  } catch (_) {}
  function setLocal(k, v) {
    local[k] = v;
    try { localStorage.setItem({ night: 'zh-night', saverMin: 'zh-saver', toasts: 'zh-toasts' }[k], typeof v === 'boolean' ? (v ? '1' : '0') : v); } catch (_) {}
    render();
  }

  function toast(t) { if (local.toasts && V?.toast) V.toast(t); }
  async function call(cmd, quiet) {
    try { await T.call(cmd); return true; }
    catch (err) { if (!quiet) toast(err.message || 'Hat nicht geklappt'); return false; }
  }
  // optimistischer Wert, bis die echte Änderung per Realtime ankommt (spätestens nach 4 s wieder Server-Zustand)
  function optimistic(id, patch) {
    ov[id] = { ...(ov[id] || {}), ...patch, t: Date.now() };
    setTimeout(() => { if (ov[id] && Date.now() - ov[id].t >= 3900) { delete ov[id]; render(); } }, 4000);
  }

  // ---------------------------------------------------------------- Farben
  const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const hex = rgb => '#' + rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  function kelvinRgb(k) {
    const t = k / 100;
    return [t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592),
      t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492),
      t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307];
  }
  function colorName(c, a) {
    const n = cfg()?.farbnamen?.[c];
    if (n) return n;
    if (a?.color_mode === 'color_temp' && a.color_temp_kelvin) return a.color_temp_kelvin < 3300 ? 'Warmweiß' : a.color_temp_kelvin < 4600 ? 'Neutral' : 'Kaltweiß';
    const [r, g, b] = hexRgb(c), mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx - mn < 40) return 'Weiß';
    let h = mx === r ? (g - b) / (mx - mn) : mx === g ? 2 + (b - r) / (mx - mn) : 4 + (r - g) / (mx - mn);
    h = (h * 60 + 360) % 360;
    if (h < 45 && mx > 200 && mn > 120) return 'Warmweiß';
    return h < 15 ? 'Rot' : h < 45 ? 'Orange' : h < 70 ? 'Gelb' : h < 160 ? 'Grün' : h < 200 ? 'Türkis' : h < 250 ? 'Blau' : h < 290 ? 'Violett' : h < 340 ? 'Pink' : 'Rot';
  }

  // ---------------------------------------------------------------- Lampen
  const norm = s => String(s || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]/g, '');
  function lampView(l) {
    const s = ent(l.entity_id), a = s?.a || {}, o = ov[l.entity_id] || {};
    let on = s?.state === 'on', b = a.brightness != null ? Math.max(1, Math.round(a.brightness / 2.55)) : 50, c = l.farbe;
    if (a.color_mode === 'color_temp' && a.color_temp_kelvin) c = hex(kelvinRgb(a.color_temp_kelvin));
    else if (Array.isArray(a.rgb_color) && !['onoff', 'brightness'].includes(a.color_mode)) c = hex(a.rgb_color);
    if (o.on != null) on = o.on;
    if (o.b != null) b = o.b;
    if (o.c != null) c = o.c;
    const modes = a.supported_color_modes || [];
    const dimm = l.dimmbar !== false && !(modes.length && modes.every(m => m === 'onoff'));
    const farbe = modes.some(m => ['rgb', 'rgbw', 'rgbww', 'hs', 'xy'].includes(m)) || !modes.length;
    return { l, key: norm(l.name), name: l.name, id: l.entity_id, on, b, c, k: colorName(c, a), na: !s || s.state === 'unavailable', dimm, farbe, a };
  }
  const lamps = () => (cfg()?.lampen || []).map(lampView);
  const lampBy = key => lamps().find(x => x.key === key || x.id === key) || null;
  function lampToggle(key, on) {
    const v = lampBy(key); if (!v) return;
    on = on == null ? !v.on : on;
    optimistic(v.id, { on }); sceneOv = null;
    call({ entity_id: v.id, service: on ? 'light.turn_on' : 'light.turn_off', data: { transition: 0.5 } });
    render();
    return on;
  }
  // Helligkeit/Farbe: Anzeige sofort, Befehl gedrosselt (final = losgelassen)
  const lampT = {};
  function lampSet(key, data, final) {
    const v = lampBy(key); if (!v) return;
    const p = { on: true };
    if (data.brightness_pct) p.b = data.brightness_pct;
    if (data.rgb_color) p.c = hex(data.rgb_color);
    if (data.color_temp_kelvin) p.c = hex(kelvinRgb(data.color_temp_kelvin));
    optimistic(v.id, p); sceneOv = null;
    const st = lampT[v.id] || (lampT[v.id] = { at: 0, t: 0, data: {} });
    st.data = { ...st.data, ...data };
    clearTimeout(st.t);
    const send = log => { const d = st.data; st.data = {}; st.at = Date.now(); call({ entity_id: v.id, service: 'light.turn_on', data: { ...d, transition: log ? 0.6 : 0.3 }, log }, !log); };
    if (final) send(true);
    else if (Date.now() - st.at > 350) send(false);
    else st.t = setTimeout(() => send(true), 380);
    render();
  }
  function lampColor(key, hexc, final = true) {
    const v = lampBy(key); if (!v) return;
    // Weißtöne (warm bis kalt) als Farbtemperatur, wenn die Lampe das kann
    const kel = { '#ff6a1f': 2000, '#ff7828': 2200, '#ff9646': 2500, '#ffb35c': 2700, '#ffd9a8': 3300, '#fff1dc': 4200, '#ffffff': 6000 }[hexc.toLowerCase()];
    const modes = v.a.supported_color_modes || [];
    if (kel && (modes.includes('color_temp') || !v.farbe)) {
      const k = Math.max(v.a.min_color_temp_kelvin || 2000, Math.min(v.a.max_color_temp_kelvin || 6500, kel));
      lampSet(key, { color_temp_kelvin: k }, final);
      optimistic(v.id, { c: hexc });
    } else lampSet(key, { rgb_color: hexRgb(hexc) }, final);
  }
  function lampsAll(on) {
    (cfg()?.lampen || []).forEach(l => optimistic(l.entity_id, { on }));
    sceneOv = null; render();
    call({ entity_id: '*lampen', service: on ? 'light.turn_on' : 'light.turn_off' });
  }
  // "Alles": Lampen + Fernseher
  function allOff(on) {
    lampsAll(on);
    const v = tvView();
    if (v && !on && v.on) tvPower(false);
  }

  // ---------------------------------------------------------------- Fernseher
  const ST = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';
  const MARKS = {
    'com.netflix.ninja': '<path fill="currentColor" opacity=".62" d="M6.4 2.5h3.7v18.6l-3.7.4zM13.9 2.5h3.7v19l-3.7-.4z"/><path fill="currentColor" d="M6.4 2.5h3.7l7.5 19-3.7-.4z"/>',
    'com.google.android.youtube.tv': '<path fill="currentColor" fill-rule="evenodd" d="M2 8.7c0-2.2 1.5-3.7 3.7-3.9C7.8 4.6 9.9 4.5 12 4.5s4.2.1 6.3.3c2.2.2 3.7 1.7 3.7 3.9v6.6c0 2.2-1.5 3.7-3.7 3.9-2.1.2-4.2.3-6.3.3s-4.2-.1-6.3-.3C3.5 19 2 17.5 2 15.3zM9.6 8v8l6.6-4z"/>',
    'com.amazon.amazonvideo.livingroom': `<path fill="currentColor" d="M9.6 3.6v7.6l6.3-3.8z"/><path ${ST} stroke-width="1.9" d="M3.4 14.4c5.3 3.7 11.9 3.7 17.2 0M17.4 13.5l3.2.9-.9 3.1"/>`,
    'com.disney.disneyplus': `<path ${ST} stroke-width="1.7" d="M2.8 15.2C5.6 7.8 13.7 5 21.2 8.8"/><path ${ST} stroke-width="2.3" d="M16.2 12.4v7.2M12.6 16h7.2"/><circle cx="5" cy="18.4" r="1.2" fill="currentColor"/>`,
    'de.swr.avp.ard.tv': `<circle cx="12" cy="12" r="9.6" ${ST} stroke-width="1.6" opacity=".45"/><path fill="currentColor" d="M12.6 5.6h2.8v12.8h-3.1V9.3l-2.9 1.8V8z"/>`,
    'com.zdf.android.mediathek': '<rect x="1.5" y="5.5" width="21" height="13" rx="4" fill="none" stroke="currentColor" stroke-width="1.6"/><text x="12" y="14.8" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="7" font-weight="700" letter-spacing=".4" fill="currentColor" stroke="none">ZDF</text>',
    'com.spotify.tv.android': '<circle cx="12" cy="12" r="10" fill="currentColor"/><path fill="none" stroke="#0b0d12" stroke-width="1.9" stroke-linecap="round" d="M6.6 9.4c3.6-1.1 7.6-.8 10.9 1.1M7.3 12.6c2.9-.8 6-.5 8.6.9M8 15.6c2.2-.5 4.4-.3 6.3.7"/>',
    'tv.twitch.android.app': '<path fill="currentColor" fill-rule="evenodd" d="M5.5 2.5l-2 4v13H8V22h2.5l2.5-2.5h3.5l4.5-4.5v-12.5zm1.8 1.8h11.4v9.9L16 16.9h-4l-2.5 2.5v-2.5H7.3zm3.8 3.2v5h1.8v-5zm4.6 0v5h1.8v-5z"/>',
  };
  const appMark = ap => `<svg viewBox="0 0 24 24" aria-hidden="true">${MARKS[ap.paket] || `<text x="12" y="17" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="15" font-weight="800" fill="currentColor" stroke="none">${esc((ap.name || '?').slice(0, 1).toUpperCase())}</text>`}</svg>`;

  let tvHint = false, tvHintT = 0, tvStart = 0;
  function tvView() {
    const tv = cfg()?.fernseher; if (!tv) return null;
    const s = ent(tv.entity_id), o = ov[tv.entity_id] || {};
    // Cast liefert, was gerade läuft (Titel, Play/Pause); Android TV Remote liefert an/aus, Lautstärke und die App
    const cs = tv.cast ? ent(tv.cast) : null, ca = cs && !['off', 'unavailable', 'unknown', 'idle', 'standby'].includes(cs.state) ? cs.a : {};
    const a = { ...ca, ...(s?.a || {}), media_title: ca.media_title || s?.a?.media_title, media_series_title: ca.media_series_title || s?.a?.media_series_title,
      media_duration: ca.media_duration ?? s?.a?.media_duration, media_position: ca.media_position ?? s?.a?.media_position,
      media_position_updated_at: ca.media_position_updated_at || s?.a?.media_position_updated_at };
    const max = tv.max_lautstaerke || 100;
    let on = !!s && !['off', 'standby', 'unavailable', 'unknown'].includes(s.state);
    // media_player.fernseher steht nach "an" sofort auf an (assumed_state) – wir-home kennt den echten Zustand (ADB)
    if (typeof S.meta?.tv_an === 'boolean') on = S.meta.tv_an;
    let playing = s?.state === 'playing' || cs?.state === 'playing', vol = Math.round((s?.a?.volume_level || 0) * max), muted = !!s?.a?.is_volume_muted;
    const pk = [s?.a?.app_id, tv.remote ? ent(tv.remote)?.a?.current_activity : ''].filter(Boolean);
    const byPk = tv.apps.find(x => x.paket && pk.includes(x.paket));
    let appName = byPk?.name || ca.app_name || s?.a?.app_name || s?.a?.source || '';
    if (o.on != null) on = o.on;
    if (o.playing != null) playing = o.playing;
    if (o.vol != null) vol = o.vol;
    if (o.muted != null) muted = o.muted;
    if (o.app != null) appName = o.app;
    const ai = tv.apps.findIndex(x => x.name === appName);
    const app = tv.apps[ai] || { name: appName || tv.name, farbe: '#7b5cff', test: '' };
    const m = S.meta || {}, since = t => (t ? Date.now() - Date.parse(t) : Infinity);
    const starting = !on && (since(m.tv_wake) < 35000 || (tv.an_skript && ent(tv.an_skript)?.state === 'on') || Date.now() - tvStart < 6000);
    const fail = !on && !starting && (since(m.tv_fail) < 180000 || tvHint);
    if (on) { tvHint = false; tvStart = 0; }
    // Titel/Position per ADB: nur, wenn es zur laufenden App passt
    const ti = S.tv && S.tv.paket && on && (!app.paket || pk.length === 0 || S.tv.paket === app.paket || pk.includes(S.tv.paket)) ? S.tv : null;
    if (ti && o.playing == null) playing = ti.spielt;
    const bildAus = !on && !!S.tvx?.bild_aus;
    // Titel: per ADB (Serie / Staffel · Folge), sonst Cast/HA; Beispieltext nur im Testmodus
    const sf = ti?.staffel ? `Staffel ${ti.staffel} · Folge ${ti.folge}` : '';
    const serie = ti && sf ? ti.untertitel || '' : '';
    const titel = (ti && (serie || ti.titel)) || a.media_series_title || a.media_title || (S.meta?.mode === 'test' ? app.test : '') || (on ? app.name : '');
    const zeile = ti ? (serie ? [sf, ti.titel] : [ti.untertitel]).filter(Boolean).join(' · ') : '';
    const pr = progress({ a, ti, playing });
    const stat = !playing ? 'pausiert' : pr.dur ? `noch ${Math.max(0, Math.ceil((pr.dur - pr.pos) / 60))} Min` : 'läuft';
    return { tv, s, a, on, playing, vol, muted, max, ai, app, ti, starting, fail, bildAus, titel, zeile, stat, prog: pr, source: o.source || a.source || '' };
  }
  // Fortschritt: per ADB (Position, lokal weitergezählt) oder aus Cast/HA. Ohne Dauer kein Balken.
  function progress({ a, ti, playing }) {
    let pos, dur;
    if (ti && ti.pos >= 0) { dur = 0; pos = ti.pos + (playing ? (Date.now() - Date.parse(ti.at)) / 1000 : 0); }
    else {
      pos = a.media_position ?? -1; dur = a.media_duration || 0;
      if (pos >= 0 && playing && a.media_position_updated_at) pos += (Date.now() - Date.parse(a.media_position_updated_at)) / 1000;
    }
    if (dur) pos = Math.min(pos, dur);
    const mmss = s => (s >= 3600 ? `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}` : `${Math.floor(s / 60)}`) + `:${pad(Math.floor(s % 60))}`;
    return { pos, dur, f: dur && pos >= 0 ? pos / dur : 0, txt: pos >= 0 ? (dur ? `${mmss(pos)} / ${mmss(dur)}` : mmss(pos)) : '' };
  }
  function tvStarting() {
    tvStart = Date.now(); tvHint = false;
    clearTimeout(tvHintT);
    tvHintT = setTimeout(() => { if (active && !tvView()?.on && !tvView()?.starting) { tvHint = true; render(); } }, 40000);
  }
  function tvPower(on) {
    const v = tvView(); if (!v) return;
    if (on == null) on = v.bildAus ? false : !v.on;
    if (on && v.starting) return;
    if (on) tvStarting(); else optimistic(v.tv.entity_id, { on: false });
    render();
    toast(on ? `${v.tv.name} wird gestartet …` : `${v.tv.name} aus`);
    call({ entity_id: v.tv.entity_id, service: on ? 'media_player.turn_on' : 'media_player.turn_off' }, on).then(ok => { if (on && !ok) { tvStart = 0; tvHint = true; render(); } });
    if (on) setTimeout(render, 6500);
  }
  let volSent = 0, volTimer = 0;
  function tvVol(n, final) {
    const v = tvView(); if (!v) return;
    n = Math.max(0, Math.min(v.max, Math.round(n)));
    optimistic(v.tv.entity_id, { vol: n, muted: false });
    render();
    clearTimeout(volTimer);
    const send = log => call({ entity_id: v.tv.entity_id, service: 'media_player.volume_set', data: { volume_level: n / v.max }, log }, !log);
    if (final) send(true);
    else if (Date.now() - volSent > 300) { volSent = Date.now(); send(false); volTimer = setTimeout(() => send(true), 600); }
    else volTimer = setTimeout(() => send(true), 400);
  }
  function tvVolStep(d) {
    const v = tvView(); if (!v) return;
    optimistic(v.tv.entity_id, { vol: Math.max(0, Math.min(v.max, v.vol + d)), muted: false });
    render();
    call({ entity_id: v.tv.entity_id, service: d > 0 ? 'media_player.volume_up' : 'media_player.volume_down' }, true);
  }
  function tvMute() {
    const v = tvView(); if (!v) return;
    optimistic(v.tv.entity_id, { muted: !v.muted }); render();
    call({ entity_id: v.tv.entity_id, service: 'media_player.volume_mute', data: { is_volume_muted: !v.muted } });
  }
  function tvPlay() {
    const v = tvView(); if (!v) return;
    if (!v.on) return toast('Der Fernseher ist aus');
    optimistic(v.tv.entity_id, { playing: !v.playing }); render();
    call({ entity_id: v.tv.entity_id, service: 'media_player.media_play_pause' });
  }
  function tvTrack(d) {
    const v = tvView(); if (!v) return;
    if (!v.on) return toast('Der Fernseher ist aus');
    call({ entity_id: v.tv.entity_id, service: d > 0 ? 'media_player.media_next_track' : 'media_player.media_previous_track' });
  }
  function tvApp(name) {
    const v = tvView(); if (!v) return;
    const app = v.tv.apps.find(x => x.name === name); if (!app) return;
    const was = v.on;
    // Fernseher aus: wir-home weckt ihn erst (bis 25 s) und öffnet die App danach
    if (was) optimistic(v.tv.entity_id, { on: true, playing: true, app: app.name }); else { tvStarting(); optimistic(v.tv.entity_id, { app: app.name }); }
    render();
    toast((was ? '' : `${v.tv.name} wird gestartet · `) + app.name + (was ? ' wird geöffnet' : ' folgt'));
    call({ entity_id: v.tv.entity_id, service: 'tv.app', data: { app: app.name } }).then(ok => {
      // läuft die App nach 12 s (nach dem Wecken 40 s) nicht, ist sie vermutlich nicht installiert
      if (ok && app.paket) setTimeout(() => { const n = tvView(); if (active && n?.on && n.app.name !== app.name && !n.s?.a?.app_id?.startsWith(app.paket)) toast(app.name + ' nicht gestartet – auf dem Fernseher installiert?'); }, was ? 12000 : 40000);
    });
  }
  // weitere installierte Apps (vom Fernseher gelesen)
  const moreApps = () => S.tvx?.apps || [];
  function tvMore(i) {
    const v = tvView(), x = moreApps()[i]; if (!v || !x) return;
    if (!v.on) tvStarting();
    render();
    toast((v.on ? '' : `${v.tv.name} wird gestartet · `) + x.name + (v.on ? ' wird geöffnet' : ' folgt'));
    call({ entity_id: v.tv.entity_id, service: 'tv.starten', data: { paket: x.paket } });
  }
  // Eingänge: aus der Konfiguration ("quellen") oder die vom Fernseher gelesenen HDMI-Eingänge (+ Smart TV)
  let eingangSel = 'tv';
  function srcList() {
    const v = tvView(); if (!v) return [];
    const tv = v.tv, e = S.tvx?.eingaenge || [];
    const list = tv.quellen.length ? tv.quellen : e.length ? [{ name: 'Smart TV', icon: 'tv', x: 'tv' }, ...e.map(q => ({ name: q.name, icon: 'hdmi', x: q.key }))] : [];
    const known = tv.quellen.some(q => q.source === v.source);
    return list.map((q, i) => ({ ...q, on: q.x ? q.x === eingangSel : known ? q.source === v.source : i === 0 }));
  }
  function tvSrc(i) {
    const v = tvView(), q = srcList()[i]; if (!v || !q) return;
    if (q.x) { eingangSel = q.x; render(); call({ entity_id: v.tv.entity_id, service: 'tv.eingang', data: { eingang: q.x } }); return; }
    optimistic(v.tv.entity_id, { source: q.source }); render();
    call({ entity_id: v.tv.entity_id, service: 'media_player.select_source', data: { source: q.source } });
  }
  // Bild aus / an (Ton läuft weiter)
  function tvBild() {
    const v = tvView(); if (!v) return;
    const aus = !v.bildAus;
    toast(aus ? 'Bild aus – der Ton läuft weiter' : 'Bild wird eingeschaltet …');
    if (!aus) tvStarting();
    call({ entity_id: v.tv.entity_id, service: 'tv.bild', data: { aus } });
  }
  // Bildschirmfoto: anfordern, groß zeigen, sobald das neue Foto da ist
  const shot = { want: 0, open: false };
  function tvShot() {
    const v = tvView(); if (!v?.on) return toast('Der Fernseher ist aus');
    shot.want = Date.now(); shot.open = true; render();
    call({ entity_id: v.tv.entity_id, service: 'tv.bildschirm' }).then(ok => { if (!ok) { shot.open = false; render(); } });
  }
  function shotView() {
    const b = S.tvx?.bildschirm || {}, sh = S.shot, neu = !!sh && Date.parse(sh.at) >= shot.want - 2000;
    return { open: shot.open, url: neu ? sh.url : '', msg: b.laeuft || (!neu && !b.fehler) ? 'Bildschirm wird aufgenommen …' : !neu && b.fehler ? b.fehler : 'Aufgenommen um ' + new Date(sh.at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) };
  }
  function shotClose() { shot.open = false; render(); }
  // Bildhelligkeit (nur mit ADB): Anzeige sofort, Befehl gedrosselt
  let hellOv = NaN, hellT = 0;
  const hell = () => (Number.isFinite(hellOv) ? hellOv : S.tvx?.helligkeit);
  function tvHell(n) {
    const v = tvView(); if (!v) return;
    hellOv = Math.max(0, Math.min(100, Math.round(n)));
    render();
    clearTimeout(hellT);
    hellT = setTimeout(() => {
      const wert = hellOv;
      call({ entity_id: v.tv.entity_id, service: 'tv.helligkeit', data: { wert } }).finally(() => { if (hellOv === wert) { hellOv = NaN; render(); } });
    }, 350);
  }
  function tvText(text, enter) {
    const v = tvView(); if (!v) return Promise.resolve(false);
    if (!text && !enter) return Promise.resolve(false);
    return call({ entity_id: v.tv.entity_id, service: 'tv.text', data: { text, enter } }).then(ok => { if (ok) toast(enter ? 'Gesendet' : 'Text gesendet'); return ok; });
  }
  function tvTextDel() { const v = tvView(); if (v) call({ entity_id: v.tv.entity_id, service: 'tv.text', data: { loeschen: 1 } }, true); }
  const KEYS = { hoch: 'DPAD_UP', runter: 'DPAD_DOWN', links: 'DPAD_LEFT', rechts: 'DPAD_RIGHT', ok: 'DPAD_CENTER', zurueck: 'BACK', home: 'HOME', menue: 'MENU', mikrofon: 'SEARCH', sprache: 'SEARCH' };
  function tvKey(k) {
    const tv = cfg()?.fernseher, command = KEYS[norm(k)];
    if (!tvView()?.on) { toast('Der Fernseher ist aus'); return false; }
    if (command && tv?.remote) call({ entity_id: tv.remote, service: 'remote.send_command', data: { command } }, true);
    return true;
  }
  // "läuft gerade" mit Titel: wir-home liest ihn nur, solange Zuhause offen ist – alle 30 s melden
  let watchAt = 0;
  function tvWatch() {
    const v = tvView();
    if (!active || !v?.tv.titel || !v.on || Date.now() - watchAt < 30000) return;
    watchAt = Date.now();
    call({ entity_id: v.tv.entity_id, service: 'tv.watch', log: false }, true);
  }
  function kino(on) {
    const f = { ...(S.settings.fernseher || {}) };
    f.kinolicht = on == null ? !f.kinolicht : on;
    S.settings.fernseher = f; render();
    toast(f.kinolicht ? 'Kino-Licht an – das Licht dimmt, sobald etwas läuft' : 'Kino-Licht aus');
    T.settings.save('fernseher', f).catch(() => toast('Speichern fehlgeschlagen'));
  }

  // ---------------------------------------------------------------- Szenen (schalten serverseitig mehrere Geräte)
  const scenes = () => { const on = sceneOv || S.meta?.scene || ''; return (cfg()?.szenen || []).map(s => ({ ...s, on: s.key === on })); };
  function scene(key) {
    const s = (cfg()?.szenen || []).find(x => x.key === key || norm(x.name) === key); if (!s) return;
    sceneOv = s.key; render();
    toast('Szene „' + s.name + '“');
    call({ scene: s.key }).then(ok => { if (!ok) { sceneOv = null; render(); } });
  }
  // Beschreibung einer Szene (aus der Konfiguration, sonst kurz)
  function sceneInfo(s) {
    const f = s.fernseher;
    const base = { gemuetlich: 'Warmes, gedimmtes Licht', lesen: 'Helles, warmweißes Licht', gutenacht: 'Licht aus', allesaus: 'Lichter und Fernseher aus', filmabend: 'Licht gedimmt' }[norm(s.name)] || '';
    const tv = f ? [f.app, f.lautstaerke != null ? 'Lautstärke ' + f.lautstaerke : ''].filter(Boolean).join(', ') : '';
    return [tv, base].filter(Boolean).join(' · ');
  }

  // ---------------------------------------------------------------- Klima + Wetter
  const val = id => { const v = parseFloat(ent(id)?.state); return Number.isFinite(v) ? v : NaN; };
  function klima() {
    const K = cfg()?.klima || {}, ser = S.klima?.series || {};
    const ts = (ser[K.temperatur] || []).map(p => ({ t: p[0], v: p[1] })), hs = (ser[K.luftfeuchte] || []).map(p => ({ t: p[0], v: p[1] }));
    const t = val(K.temperatur), hu = val(K.luftfeuchte);
    const vals = ts.map(p => p.v).concat(Number.isFinite(t) ? [t] : []);
    return { t, hu, co2: val(K.co2), tmin: vals.length ? Math.min(...vals) : NaN, tmax: vals.length ? Math.max(...vals) : NaN, ts, hs,
      watt: val(K.leistung), kwh: val(K.strom_heute), hasStrom: !!(K.leistung || K.strom_heute), hasT: !!K.temperatur, hasH: !!K.luftfeuchte };
  }
  function wmo(code, day = 1) {
    if (code == null) return ['cloud', '–'];
    if (code === 0) return [day ? 'sun' : 'moon', 'Klar'];
    if (code <= 2) return [day ? 'cloudsun' : 'cloudmoon', 'Teils bewölkt'];
    if (code === 3) return ['cloud', 'Bewölkt'];
    if (code <= 48) return ['cloud', 'Nebel'];
    if (code <= 67 || (code >= 80 && code <= 82)) return ['rain', 'Regen'];
    if (code <= 86) return ['snow', 'Schnee'];
    return ['rain', 'Gewitter'];
  }
  // Geschätzter Stromverbrauch aus dem, was an ist (ohne Stromzähler): Lampe 8 W bei 100 %, Fernseher 90 W
  function strom() {
    const k = klima();
    const items = lamps().map(v => ({ name: v.name, key: v.key, w: v.on ? Math.max(1, (v.l.watt || 8) * (v.dimm ? v.b / 100 : 1)) : 0 }));
    const tv = tvView();
    if (tv) items.push({ name: tv.tv.name, key: 'tv', w: tv.on ? (tv.tv.watt || 90) : tv.bildAus ? 15 : 0.5 });
    const sum = items.reduce((s, x) => s + x.w, 0);
    return { items, sum, echt: k.hasStrom, watt: k.watt, kwh: k.kwh };
  }

  // ---------------------------------------------------------------- Kalender + To-dos
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const events = () => S.kalender?.termine || [];
  function evOn(ds) {
    const a = [];
    events().forEach(x => { if (x.d === ds) a.push(x); else if (x.s && ds >= x.s && ds <= x.to) a.push({ ...x, span: true, start: ds === x.s, end: ds === x.to }); });
    return a.sort((p, q) => (q.span ? 1 : 0) - (p.span ? 1 : 0) || (p.t || '').localeCompare(q.t || ''));
  }
  // d = Daniel, i = Ida, g = gemeinsam (wie in der Konfiguration); Farben aus der Konfiguration, sonst die des Designs
  function who(def) {
    const F = S.kalender?.farben || cfg()?.kalender?.farben || {};
    return { d: ['Daniel', F.d || def.d], i: ['Ida', F.i || def.i], g: ['Gemeinsam', F.g || def.g] };
  }
  const LISTS = [['gemeinsam', 'Gemeinsam'], ['einkauf', 'Einkauf'], ['haushalt', 'Haushalt']];
  const todoOv = {};   // id -> { done, who, gone } optimistisch
  function todos(list) {
    return S.todos.filter(t => t.list === list && !todoOv[t.id]?.gone).map(t => ({ ...t, ...(todoOv[t.id] || {}) }))
      .sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || (b.created || '').localeCompare(a.created || ''));
  }
  function todoAdd(list, text) {
    text = String(text || '').trim(); if (!text) return;
    T.todos.add({ list, text, who: 'g' }).then(() => toast('Aufgabe hinzugefügt')).catch(() => toast('Speichern fehlgeschlagen'));
  }
  function todoToggle(id) {
    const x = S.todos.find(t => t.id === id); if (!x) return;
    const done = !(todoOv[id]?.done ?? x.done);
    todoOv[id] = { ...(todoOv[id] || {}), done }; render();
    T.todos.update(id, { done }).catch(() => toast('Speichern fehlgeschlagen'));
  }
  function todoWho(id) {
    const x = S.todos.find(t => t.id === id); if (!x) return;
    const w = { g: 'd', d: 'i', i: 'g' }[todoOv[id]?.who ?? x.who] || 'g';
    todoOv[id] = { ...(todoOv[id] || {}), who: w }; render();
    T.todos.update(id, { who: w }).catch(() => toast('Speichern fehlgeschlagen'));
  }
  function todoDel(id) {
    todoOv[id] = { gone: true }; render();
    T.todos.remove(id).then(() => toast('Aufgabe gelöscht')).catch(() => { delete todoOv[id]; render(); toast('Löschen fehlgeschlagen'); });
  }

  // ---------------------------------------------------------------- Wecker (home_settings "wecker", wir-home stellt HA)
  const DEF_ALARM = {
    alarms: [
      { id: 'a1', zeit: '5:00', bis: '6:00', alle: 10, tage: [0, 1, 2, 3, 4], an: true, titel: 'Werktage', ton: true },
      { id: 'a2', zeit: '9:00', bis: '', alle: 0, tage: [5, 6], an: false, titel: 'Wochenende', ton: false },
    ],
    vorlauf: 15, ton: 'Sanft', aussetzen: '',
  };
  const W = () => S.settings.wecker || DEF_ALARM;
  const toMin = t => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
  const fmtMin = m => `${Math.floor(((m % 1440) + 1440) % 1440 / 60)}:${pad(((m % 60) + 60) % 60)}`;
  function times(a) {
    if (!a.bis || !a.alle) return [a.zeit];
    const out = [];
    for (let m = toMin(a.zeit); m <= toMin(a.bis) && out.length < 30; m += a.alle) out.push(fmtMin(m));
    return out;
  }
  function nextAlarm() {
    const w = W(), now = new Date();
    for (let d = 0; d < 8; d++) {
      const day = new Date(now); day.setDate(now.getDate() + d); day.setHours(0, 0, 0, 0);
      const dow = (day.getDay() + 6) % 7;
      if (iso(day) === w.aussetzen) continue;
      const cand = w.alarms.filter(a => a.an && a.tage.includes(dow)).map(a => ({ a, m: toMin(a.zeit) }))
        .filter(x => d > 0 || x.m > now.getHours() * 60 + now.getMinutes()).sort((p, q) => p.m - q.m)[0];
      if (cand) return { ...cand, d, day, at: new Date(day.getTime() + cand.m * 60000) };
    }
    return null;
  }
  const tomorrowIso = () => { const t = new Date(); t.setDate(t.getDate() + 1); return iso(t); };
  function alarmInfo() {
    const w = W(), n = nextAlarm();
    if (!n) return { n, state: w.aussetzen === tomorrowIso() ? 'Morgen kein Wecker' : 'Kein Wecker aktiv', when: '', skip: w.aussetzen === tomorrowIso() };
    const when = n.d === 0 ? 'heute' : n.d === 1 ? 'morgen' : n.day.toLocaleDateString('de-DE', { weekday: 'long' });
    return { n, when, lead: fmtMin(n.m - w.vorlauf), state: `Nächster: ${when} ${n.a.zeit}` + (w.vorlauf ? ` · Licht ab ${fmtMin(n.m - w.vorlauf)}` : ''), skip: w.aussetzen === tomorrowIso() };
  }
  let saveT = 0;
  function saveAlarm(mut) {
    const w = JSON.parse(JSON.stringify(W()));
    mut(w);
    S.settings.wecker = w;
    render();
    clearTimeout(saveT);
    saveT = setTimeout(() => T.settings.save('wecker', S.settings.wecker).catch(() => toast('Speichern fehlgeschlagen')), 400);
  }
  const alarmFns = {
    add: () => { saveAlarm(w => w.alarms.push({ id: 'a' + Date.now().toString(36), zeit: '7:00', bis: '', alle: 0, tage: [0, 1, 2, 3, 4], an: true, titel: 'Wecker', ton: true })); toast('Wecker hinzugefügt – Uhrzeit antippen zum Ändern'); },
    toggle: id => saveAlarm(w => { const a = w.alarms.find(x => x.id === id); if (a) { a.an = !a.an; toast(`${a.titel || 'Wecker'} ${a.an ? 'an' : 'aus'}`); } }),
    day: (id, n) => saveAlarm(w => { const a = w.alarms.find(x => x.id === id); if (a) a.tage = a.tage.includes(n) ? a.tage.filter(x => x !== n) : [...a.tage, n].sort(); }),
    del: id => { saveAlarm(w => { w.alarms = w.alarms.filter(x => x.id !== id); }); toast('Wecker gelöscht'); },
    time: (id, hhmm) => {
      if (!hhmm) return;
      const [h, m] = hhmm.split(':').map(Number);
      saveAlarm(w => { const a = w.alarms.find(x => x.id === id); if (!a) return; const span = a.bis ? toMin(a.bis) - toMin(a.zeit) : 0; a.zeit = `${h}:${pad(m)}`; if (a.bis) a.bis = fmtMin(h * 60 + m + span); });
    },
    vorlauf: n => saveAlarm(w => { w.vorlauf = n; }),
    ton: t => { saveAlarm(w => { w.ton = t; }); toast('Ton: ' + t); },
    skip: () => saveAlarm(w => { const t = tomorrowIso(); w.aussetzen = w.aussetzen === t ? '' : t; }),
    tv: patch => saveAlarm(w => { w.tv = { an: false, app: cfg()?.fernseher?.apps?.[0]?.name || '', lautstaerke: 15, ...(w.tv || {}), ...patch }; }),
    test: () => call({ entity_id: '', service: 'wecker.test' }).then(ok => { if (ok) toast('Test-Sonnenaufgang läuft · 1 Min'); return ok; }),
  };
  const wtv = () => ({ an: false, app: cfg()?.fernseher?.apps?.[0]?.name || '', lautstaerke: 15, ...(W().tv || {}) });

  // ---------------------------------------------------------------- Menschen
  const me = () => window.WIR_LOOK?.me?.() || null;
  const partner = () => window.WIR_LOOK?.partner?.() || null;
  function daysTo(ms) { return Math.round((new Date(ms).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 864e5); }
  function meetIn() { const n = window.WIR_COUNTDOWN?.next?.(); return n ? daysTo(n) : null; }
  function wiedersehen() { const d = meetIn(); return d == null ? 'kein Treffen geplant' : d <= 0 ? 'Wiedersehen heute 💗' : d === 1 ? 'Wiedersehen morgen 💗' : `Wiedersehen in ${d} Tagen`; }
  const together = () => (document.getElementById('dayCount')?.textContent || '').trim();

  // ---------------------------------------------------------------- Status (Testmodus / verbunden)
  function status() {
    const m = S.meta, stale = !m || Date.now() - (m.beat || 0) > 95000;
    const bad = stale || (m.mode !== 'test' && !m.connected);
    return { stale, bad, test: m?.mode === 'test', connected: !!m?.connected, error: m?.error || '',
      txt: stale ? 'offline' : m.mode === 'test' ? 'Testmodus' : m.connected ? 'verbunden' : 'getrennt',
      kalTest: !!S.kalender?.test };
  }
  // Sensoren (Fenster/Tür) aus der Konfiguration
  function sensoren() {
    return (cfg()?.sensoren || []).filter(x => x.art !== 'bewegung').map(x => {
      const s = ent(x.entity_id), open = s?.state === 'on';
      const mins = s ? Math.max(1, Math.round((Date.now() - Date.parse(s.changed)) / 60000)) : 0;
      return { ...x, open, na: !s || s.state === 'unavailable', mins, seit: mins < 60 ? mins + ' Min.' : Math.round(mins / 60) + ' Std.' };
    });
  }
  // Meldungen (Glocke): offene Fenster/Türen, Pings, Pakete, Wecker, Fernseher
  function notes() {
    const out = [];
    for (const x of sensoren()) out.push({ ic: x.art === 'tuer' ? 'door' : 'win', b: x.na ? `${x.name} ?` : `${x.name} ${x.open ? 'offen' : 'zu'}`, s: x.open ? 'seit ' + x.seit : 'alles gut', warn: x.open });
    const X = window.ZHX?.D, p = partner();
    if (X?.ping && p) {
      const mine = X.ping.from === window.ZHX.myId();
      out.push({ ic: 'heart', b: mine ? `Du hast an ${p.name || 'sie'} gedacht` : `${p.name || 'Dein Schatz'} hat an dich gedacht`, s: window.ZHX.ago(window.ZHX.pbMs(X.ping.created)) });
    }
    const heute = (X?.pak?.pakete || []).filter(x => x.status === 'heute');
    if (heute.length) out.push({ ic: 'box', b: heute.length === 1 ? 'Paket kommt heute' : `${heute.length} Pakete kommen heute`, s: heute.map(x => x.name).join(' · ') });
    const ai = alarmInfo();
    out.push({ ic: 'alarm', b: 'Wecker', s: ai.n ? `${ai.when} ${ai.n.a.zeit}${W().vorlauf ? ' · Licht ab ' + ai.lead : ''}` : ai.state });
    const tv = tvView();
    if (tv?.on) out.push({ ic: 'tv', b: `${tv.tv.name} an`, s: tv.app.name + (tv.titel && tv.titel !== tv.app.name ? ' · ' + tv.titel : '') });
    return out;
  }

  // ---------------------------------------------------------------- Leistungsmodus (automatisch + Schalter, gilt für die ganze App)
  let perfAuto = null;
  const perfPref = () => { try { return localStorage.getItem('wir-perf'); } catch (_) { return null; } };
  function perfOn() {
    const p = perfPref();
    if (p === '1') return true;
    if (p === '0') return false;
    if (isIOS && !mqTab.matches) return true;
    if (navigator.deviceMemory && navigator.deviceMemory <= 2) return true;
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) return true;
    return perfAuto ?? isIOS;
  }
  function applyPerf() {
    const on = perfOn();
    document.documentElement.classList.toggle('perf', on);
    wrap?.classList.toggle('perf', on);
    const app = document.getElementById('perfSwitch'); if (app) app.checked = on;
  }
  function setPerf(on) {
    try { localStorage.setItem('wir-perf', on ? '1' : '0'); } catch (_) {}
    applyPerf(); render(); toast(on ? 'Leistungsmodus an' : 'Leistungsmodus aus');
  }
  let fpsRaf = 0;
  function measureFps() {
    if (perfPref() !== null || perfAuto !== null || !mqTab.matches || fpsRaf) return;
    if (navigator.deviceMemory && navigator.deviceMemory <= 2) return;
    let frames = 0, t0 = 0;
    const step = t => {
      if (!active) { fpsRaf = 0; return; }
      if (!t0) t0 = t;
      frames++;
      if (t - t0 < 2000) { fpsRaf = requestAnimationFrame(step); return; }
      fpsRaf = 0;
      perfAuto = frames / ((t - t0) / 1000) < 45;
      applyPerf();
    };
    fpsRaf = requestAnimationFrame(step);
  }

  // ---------------------------------------------------------------- Zusätzliche Reiter (z. B. Claude aus zuhause-claude.js)
  // { key, label, icon (SVG), html, mount(el) } – die Ansicht legt Navigation + Seite an und ruft mount(Seiten-Element)
  const extraPages = [];
  function registerPage(p) { if (extraPages.some(x => x.key === p.key)) return; extraPages.push(p); if (wrap) build(true); }

  // Farbwelt an den Shadow-Host melden (zuhause-pastell.css greift per :host([data-th="pastell"]))
  const syncTheme = () => { host.dataset.th = document.documentElement.dataset.theme || ""; };
  syncTheme();
  new MutationObserver(syncTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  // ---------------------------------------------------------------- Aufbau der Ansicht im Shadow-DOM
  function build(force) {
    const want = mqTab.matches ? 'tab' : 'phone';
    if (!force && want === mode && wrap) return;
    if (!VIEWS[want]) return;
    V?.destroy?.();
    mode = want;
    if (!root) root = host.attachShadow({ mode: 'open' });
    const css = want === 'tab' ? 'zuhause-tab.css' : 'zuhause-handy.css';
    root.innerHTML = `<link rel="stylesheet" href="/${css}"><link rel="stylesheet" href="/zuhause-claude.css"><link rel="stylesheet" href="/zuhause-pastell.css"><div id="zh" class="${want === 'tab' ? 'zt z-tablet' : 'zp z-phone'}" style="visibility:hidden"></div>`;
    const w = wrap = root.getElementById('zh');
    // erst zeigen, wenn die Stile da sind (kein Aufblitzen ohne Gestaltung)
    let n = 0; const show = () => { if (++n >= 3) w.style.visibility = ''; };
    root.querySelectorAll('link').forEach(l => { l.addEventListener('load', show); l.addEventListener('error', show); });
    setTimeout(() => { w.style.visibility = ''; }, 1500);
    V = VIEWS[want];
    V.build(wrap, root);
    applyPerf();
    for (const p of extraPages) { const el = V.pageEl?.(p.key); if (el) p.mount?.(el); }
    document.dispatchEvent(new CustomEvent('zh:built', { detail: { mode } }));
    render();
    if (V.go) V.go(page); else setPage(page);
  }
  function setPage(p) {
    page = p;
    document.dispatchEvent(new CustomEvent('zh:page', { detail: p }));
  }

  // ---------------------------------------------------------------- Zeichnen
  let raf = 0;
  function render() {
    if (!active || !V || !cfg() || raf) return;
    raf = requestAnimationFrame(() => { raf = 0; if (active && V && cfg()) { try { V.render(); } catch (err) { console.error('Zuhause', err); } } });
  }
  // Realtime-Änderung: optimistische Werte verwerfen, sobald das Gerät selbst etwas meldet
  const prev = {};
  let dragging = null;   // entity_id, die gerade gezogen wird (Werte nicht verwerfen)
  function onChange() {
    for (const [id, s] of Object.entries(S.entities)) {
      const sig = s.state + '|' + JSON.stringify(s.a);
      if (prev[id] !== undefined && prev[id] !== sig && ov[id] && dragging !== id) delete ov[id];
      prev[id] = sig;
    }
    for (const id of Object.keys(todoOv)) {
      const t = S.todos.find(x => x.id === id), o = todoOv[id];
      if (!t || ((o.done === undefined || o.done === t.done) && (o.who === undefined || o.who === t.who) && !o.gone)) delete todoOv[id];
    }
    if (sceneOv && S.meta?.scene === sceneOv) sceneOv = null;
    if (active) { render(); tvWatch(); }
  }

  // ---------------------------------------------------------------- Lebenszyklus
  let tickT = 0, progT = 0;
  function tick() { if (active && V) { V.tick?.(); render(); tvWatch(); } }
  function activate() {
    if (active) return;
    active = true;
    build();
    host.classList.remove('z-sleep');
    document.body.classList.add('zh-full');
    applyPerf();
    T.start(onChange).catch(err => { console.error('Zuhause', err); toast('Zuhause ist gerade nicht erreichbar'); });
    tickT = setInterval(tick, 10000);
    // Fortschritt des Fernsehers jede Sekunde (die Ansicht zeichnet nur Balken/Zeit)
    progT = setInterval(() => { const v = active && V?.progress && cfg() ? tvView() : null; if (v?.playing) V.progress(v); }, 1000);
    V?.wake?.();
    tick();
    measureFps();
    document.dispatchEvent(new CustomEvent('zh:life', { detail: true }));
  }
  function deactivate() {
    if (!active) return;
    active = false;
    T.stop();
    clearInterval(tickT); clearInterval(progT); clearTimeout(volTimer); clearTimeout(tvHintT);
    watchAt = 0;
    if (fpsRaf) { cancelAnimationFrame(fpsRaf); fpsRaf = 0; }
    V?.sleep?.();
    shot.open = false;
    host.classList.add('z-sleep');
    document.body.classList.remove('zh-full');
    document.dispatchEvent(new CustomEvent('zh:life', { detail: false }));
  }
  const visible = () => !!document.getElementById('s-zuhause')?.classList.contains('active') && !document.hidden && !!window.WIR_PB?.authStore?.isValid;
  const sync = () => (visible() ? activate() : deactivate());
  document.addEventListener('wir:show', sync);
  document.addEventListener('visibilitychange', sync);
  mqTab.addEventListener('change', () => { if (wrap) { build(); render(); } });
  host.classList.add('z-sleep');
  applyPerf();
  const perfSw = document.getElementById('perfSwitch');
  if (perfSw) {
    perfSw.checked = perfOn();
    perfSw.addEventListener('change', () => { try { localStorage.setItem('wir-perf', perfSw.checked ? '1' : '0'); } catch (_) {} applyPerf(); });
  }
  // Extras (Partner, Abfahrten, Pakete, System) und App melden neue Daten
  for (const ev of ['zhx:change', 'wir:users', 'wir:presence']) document.addEventListener(ev, render);

  // ---------------------------------------------------------------- Schnittstelle für die Ansichten
  window.ZH = {
    S, T, cfg, ent, esc, pad, iso, today, norm, hex, hexRgb, kelvinRgb,
    num: (v, d = 1) => (Number.isFinite(v) ? v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }) : '–'),
    call, toast, render, local, setLocal, perfOn, setPerf, status, notes, sensoren, active: () => active,
    go: setPage, page: () => page, back: () => window.UI?.show?.('s-home'), drag: id => { dragging = id; },
    lamps, lampBy, lampToggle, lampSet, lampColor, lampsAll, allOff,
    tvView, tvPower, tvVol, tvVolStep, tvMute, tvPlay, tvTrack, tvApp, moreApps, tvMore, srcList, tvSrc, tvBild, tvShot, shotView, shotClose, hell, tvHell, tvText, tvTextDel, tvKey, appMark, kino,
    scenes, scene, sceneInfo, klima, wmo, strom,
    evOn, who, LISTS, todos, todoAdd, todoToggle, todoWho, todoDel,
    W, times, toMin, fmtMin, nextAlarm, alarmInfo, alarm: alarmFns, wtv,
    me, partner, meetIn, wiedersehen, together,
    extraPages, registerPage,
  };
})();
