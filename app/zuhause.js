// Zuhause (Aurora, 04.11.2026): Design und Bedienung 1:1 aus docs/zuhause/dashboard-demo-aurora.html,
// Markup aus zuhause-markup.js, Daten nur über window.ZuhauseData (zuhause-data.js) – nie direkt von Home Assistant.
// Tablet (quer, ≥ 900 px): Vollbild wie die Vorlage, Bildschirmschoner + Nachtdimmung. Handy: eine Spalte, Tabs oben.
// Lebenszyklus: Abos, Intervalle und Animationen laufen NUR, solange Zuhause sichtbar ist (Bereich aktiv und App im
// Vordergrund) – beim Verlassen bzw. im Hintergrund wird alles beendet und beim Zurückkehren genau einmal neu gestartet.
(() => {
  const host = document.getElementById('zh');
  if (!host || !window.ZuhauseData || !window.ZH_MARKUP) return;
  const $ = id => document.getElementById('zh-' + id);
  const qa = (sel, el = host) => [...el.querySelectorAll(sel)];

  // ---------------------------------------------------------------- Symbole (aus der Vorlage)
  const I = { home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>', tv: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/>', cal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>', alarm: '<circle cx="12" cy="13" r="7"/><path d="M12 10v3l2 2M5 4L2 7M19 4l3 3"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>', moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>', film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4"/>', book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5"/>', flame: '<path d="M12 2c3 4 6 6 6 11a6 6 0 0 1-12 0c0-3 1.5-4.5 3-6 0 2.5 1.5 4 3 4 0-4-1.5-6.5 0-9z"/>', power: '<path d="M12 3v9M6.3 6.3a8 8 0 1 0 11.4 0"/>', heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>', thermo: '<path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z"/>', cloudsun: '<path d="M8 3v1M3.5 5.5l.7.7M2 10h1M12.5 5.5l-.7.7M5.5 10a3 3 0 0 1 5.6-1.5"/><path d="M7 20h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.2 13 3.5 3.5 0 0 0 7 20z"/>', sunrise: '<path d="M12 3v4M5 10l1.5 1.5M19 10l-1.5 1.5M3 17h18M7 17a5 5 0 0 1 10 0M8 21h8"/>', bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>', window: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M12 3v18M4 12h16"/>', door: '<path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M3 21h18"/><circle cx="14.5" cy="12" r=".8"/>', coffee: '<path d="M4 8h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM16 10h2a2 2 0 0 1 0 4h-2M8 3v2M12 3v2"/>', fan: '<circle cx="12" cy="12" r="2"/><path d="M12 10c0-4 1-7 4-7 2 0 3 2 1 4l-3 3M14 12c4 0 7 1 7 4 0 2-2 3-4 1l-3-3M12 14c0 4-1 7-4 7-2 0-3-2-1-4l3-3M10 12c-4 0-7-1-7-4 0-2 2-3 4-1l3 3"/>', stars: '<path d="M5 3v4M3 5h4M17 15v4M15 17h4M12 6l1.5 4.5L18 12l-4.5 1.5L12 18l-1.5-4.5L6 12l4.5-1.5z"/>', left: '<path d="M15 6l-6 6 6 6"/>', right: '<path d="M9 6l6 6-6 6"/>', up: '<path d="M6 15l6-6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>', pause: '<path d="M9 5v14M15 5v14"/>', play: '<path d="M7 4l13 8-13 8z"/>', prev: '<path d="M6 5v14M19 5l-10 7 10 7z"/>', next: '<path d="M18 5v14M5 5l10 7-10 7z"/>', undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>', menu: '<path d="M4 6h16M4 12h16M4 18h16"/>', mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>', mute: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l4 6M21 9l-4 6"/>', hdmi: '<path d="M3 8h18v5l-3 3H6l-3-3z"/><path d="M8 11h8"/>', cast: '<path d="M3 17a4 4 0 0 1 4 4M3 13a8 8 0 0 1 8 8M3 9a12 12 0 0 1 12 12"/><path d="M3 6V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/>', check: '<path d="M5 12l5 5 9-10"/>', plus: '<path d="M12 5v14M5 12h14"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>' };
  I.cloud = '<path d="M7 19h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.2 12 3.5 3.5 0 0 0 7 19z"/>';
  I.rain = '<path d="M7 15h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.2 8 3.5 3.5 0 0 0 7 15zM8 18l-1 3M12 18l-1 3M16 18l-1 3"/>';
  // Fernseher-Extras: Bildschirmfoto, Bild aus (Ton an), Text senden/löschen, HDMI
  I.camera = '<path d="M4 8h3l1.6-2.2A1.5 1.5 0 0 1 9.8 5h4.4a1.5 1.5 0 0 1 1.2.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>';
  I.screenoff = '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M4 4l16 16"/>';
  I.send = '<path d="M5 12h12M12 6l6 6-6 6"/>';
  I.backspace = '<path d="M9 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6-7z"/><path d="M12 9.5l5 5M17 9.5l-5 5"/>';
  I.hdmi = '<path d="M4 8h16v5l-3 3H7l-3-3z"/><path d="M8 11h8"/>';
  I.close = '<path d="M6 6l12 12M18 6L6 18"/>';
  const svg = n => `<svg viewBox="0 0 24 24">${I[n] || I.stars}</svg>`;
  const icons = el => qa('[data-i]', el).forEach(e => { if (!e.querySelector(':scope > svg')) e.insertAdjacentHTML('afterbegin', svg(e.dataset.i)); });
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  // innerHTML nur setzen, wenn sich der Inhalt geändert hat (zuletzt gesetztes HTML in einer WeakMap, nicht im DOM)
  const htmlOf = new WeakMap();
  const setHTML = (el, h) => { if (el && htmlOf.get(el) !== h) { htmlOf.set(el, h); el.innerHTML = h; } };

  // ---------------------------------------------------------------- Zustand
  const T = window.ZuhauseData.create(window.ZH_TRANSPORT || 'wir');
  const S = T.state;
  const ov = {};              // optimistische Anzeige pro entity_id { on, b, vol, muted, playing, app, source, t }
  let sceneOv = null, built = false, active = false, page = 'start';
  const mqTab = matchMedia('(min-width:900px) and (orientation:landscape)');
  const isIOS = CSS.supports('-webkit-touch-callout', 'none');   // Funktionsabfrage statt User-Agent
  const ent = id => (id && S.entities[id]) || null;
  const cfg = () => S.config;

  // ---------------------------------------------------------------- Hilfen
  let toastT = 0;
  function toast(t) {
    const x = $('toast'); if (!x) return;
    x.textContent = t; x.classList.add('z-on');
    clearTimeout(toastT); toastT = setTimeout(() => x.classList.remove('z-on'), 1800);
  }
  async function call(cmd, quiet) {
    try { await T.call(cmd); return true; }
    catch (err) { if (!quiet) toast(err.message || 'Hat nicht geklappt'); return false; }
  }
  // optimistischer Wert, bis die echte Änderung per Realtime ankommt (spätestens nach 4 s wieder Server-Zustand)
  function optimistic(id, patch) {
    ov[id] = { ...(ov[id] || {}), ...patch, t: Date.now() };
    setTimeout(() => { if (ov[id] && Date.now() - ov[id].t >= 3900) { delete ov[id]; if (active) render(); } }, 4000);
  }
  const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const hex = rgb => '#' + rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  function kelvinRgb(k) {
    const t = k / 100;
    return [t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592),
      t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492),
      t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307];
  }
  // Farbname unter der Lampe: aus der Konfiguration, sonst Weißton bzw. Farbton
  function colorName(c, a) {
    const n = cfg()?.farbnamen?.[c];
    if (n) return n;
    if (a?.color_mode === 'color_temp' && a.color_temp_kelvin) return a.color_temp_kelvin < 3300 ? 'Warmweiß' : a.color_temp_kelvin < 4600 ? 'Neutral' : 'Kaltweiß';
    const [r, g, b] = hexRgb(c), mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx - mn < 40) return 'Weiß';
    let h = mx === r ? (g - b) / (mx - mn) : mx === g ? 2 + (b - r) / (mx - mn) : 4 + (r - g) / (mx - mn);
    h = (h * 60 + 360) % 360;
    return h < 15 ? 'Rot' : h < 45 ? 'Orange' : h < 70 ? 'Gelb' : h < 160 ? 'Grün' : h < 200 ? 'Türkis' : h < 250 ? 'Blau' : h < 290 ? 'Violett' : h < 340 ? 'Pink' : 'Rot';
  }
  function lampView(l) {
    const s = ent(l.entity_id), a = s?.a || {}, o = ov[l.entity_id] || {};
    let on = s?.state === 'on', b = a.brightness != null ? Math.max(1, Math.round(a.brightness / 2.55)) : 50, c = l.farbe;
    if (a.color_mode === 'color_temp' && a.color_temp_kelvin) c = hex(kelvinRgb(a.color_temp_kelvin));
    else if (Array.isArray(a.rgb_color) && !['onoff', 'brightness'].includes(a.color_mode)) c = hex(a.rgb_color);
    if (o.on != null) on = o.on;
    if (o.b != null) b = o.b;
    return { on, b, c, k: colorName(c, a), na: !s || s.state === 'unavailable' };
  }
  // Eigene App-Zeichen (Vektor, 24er-Raster, currentColor) – gestochen scharf in jeder Größe; unbekannte Apps: Anfangsbuchstabe
  const ST = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';
  const MARKS = {
    'com.netflix.ninja': '<path fill="currentColor" opacity=".62" d="M6.4 2.5h3.7v18.6l-3.7.4zM13.9 2.5h3.7v19l-3.7-.4z"/><path fill="currentColor" d="M6.4 2.5h3.7l7.5 19-3.7-.4z"/>',
    'com.google.android.youtube.tv': '<path fill="currentColor" fill-rule="evenodd" d="M2 8.7c0-2.2 1.5-3.7 3.7-3.9C7.8 4.6 9.9 4.5 12 4.5s4.2.1 6.3.3c2.2.2 3.7 1.7 3.7 3.9v6.6c0 2.2-1.5 3.7-3.7 3.9-2.1.2-4.2.3-6.3.3s-4.2-.1-6.3-.3C3.5 19 2 17.5 2 15.3zM9.6 8v8l6.6-4z"/>',
    'com.amazon.amazonvideo.livingroom': `<path fill="currentColor" d="M9.6 3.6v7.6l6.3-3.8z"/><path ${ST} stroke-width="1.9" d="M3.4 14.4c5.3 3.7 11.9 3.7 17.2 0M17.4 13.5l3.2.9-.9 3.1"/>`,
    'com.disney.disneyplus': `<path ${ST} stroke-width="1.7" d="M2.8 15.2C5.6 7.8 13.7 5 21.2 8.8"/><path ${ST} stroke-width="2.3" d="M16.2 12.4v7.2M12.6 16h7.2"/><circle cx="5" cy="18.4" r="1.2" fill="currentColor"/>`,
    'de.swr.avp.ard.tv': `<circle cx="12" cy="12" r="9.6" ${ST} stroke-width="1.6" opacity=".45"/><path fill="currentColor" d="M12.6 5.6h2.8v12.8h-3.1V9.3l-2.9 1.8V8z"/>`,
    'com.zdf.android.mediathek': '<rect x="1.5" y="5.5" width="21" height="13" rx="4" fill="none" stroke="currentColor" stroke-width="1.6"/><text x="12" y="14.8" text-anchor="middle" font-style="normal" font-family="Arial,Helvetica,sans-serif" font-size="7" font-weight="700" letter-spacing=".4" fill="currentColor" stroke="none">ZDF</text>',
    'com.spotify.tv.android': '<circle cx="12" cy="12" r="10" fill="currentColor"/><path fill="none" stroke="#0b0d12" stroke-width="1.9" stroke-linecap="round" d="M6.6 9.4c3.6-1.1 7.6-.8 10.9 1.1M7.3 12.6c2.9-.8 6-.5 8.6.9M8 15.6c2.2-.5 4.4-.3 6.3.7"/>',
    'tv.twitch.android.app': '<path fill="currentColor" fill-rule="evenodd" d="M5.5 2.5l-2 4v13H8V22h2.5l2.5-2.5h3.5l4.5-4.5v-12.5zm1.8 1.8h11.4v9.9L16 16.9h-4l-2.5 2.5v-2.5H7.3zm3.8 3.2v5h1.8v-5zm4.6 0v5h1.8v-5z"/>',
  };
  const appMark = ap => `<svg viewBox="0 0 24 24" aria-hidden="true">${MARKS[ap.paket] || `<text x="12" y="17" text-anchor="middle" font-style="normal" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="15" font-weight="800" fill="currentColor" stroke="none">${esc((ap.name || '?').slice(0, 1).toUpperCase())}</text>`}</svg>`;

  function tvView() {
    const tv = cfg()?.fernseher; if (!tv) return null;
    const s = ent(tv.entity_id), o = ov[tv.entity_id] || {};
    // Cast liefert, was gerade läuft (Titel, Play/Pause); Android TV Remote liefert an/aus, Lautstärke und die App
    const cs = tv.cast ? ent(tv.cast) : null, ca = cs && !['off', 'unavailable', 'unknown', 'idle', 'standby'].includes(cs.state) ? cs.a : {};
    const a = { ...ca, ...(s?.a || {}), media_title: ca.media_title || s?.a?.media_title, media_series_title: ca.media_series_title || s?.a?.media_series_title,
      media_duration: ca.media_duration ?? s?.a?.media_duration, media_position: ca.media_position ?? s?.a?.media_position,
      media_position_updated_at: ca.media_position_updated_at || s?.a?.media_position_updated_at };
    const max = tv.max_lautstaerke;
    let on = !!s && !['off', 'standby', 'unavailable', 'unknown'].includes(s.state);
    // media_player.fernseher steht nach "an" sofort auf an (angenommen) – wir-home kennt den echten Zustand (ADB)
    if (typeof S.meta?.tv_an === 'boolean') on = S.meta.tv_an;
    let playing = s?.state === 'playing' || cs?.state === 'playing', vol = Math.round((s?.a?.volume_level || 0) * max), muted = !!s?.a?.is_volume_muted;
    // App erkennen: Paketname (app_id / current_activity der Fernbedienung) oder Name (Cast)
    const pk = [s?.a?.app_id, tv.remote ? ent(tv.remote)?.a?.current_activity : ''].filter(Boolean);
    const byPk = tv.apps.find(x => x.paket && pk.includes(x.paket));
    let appName = byPk?.name || ca.app_name || s?.a?.app_name || s?.a?.source || '';
    if (o.on != null) on = o.on;
    if (o.playing != null) playing = o.playing;
    if (o.vol != null) vol = o.vol;
    if (o.muted != null) muted = o.muted;
    if (o.app != null) appName = o.app;
    const ai = Math.max(0, tv.apps.findIndex(x => x.name === appName));
    const app = tv.apps[ai] || { name: appName || tv.name, farbe: '#7b5cff', test: '' };
    // Einschalt-Routine läuft (in wir-home, im HA-Skript oder gerade angetippt) bzw. ist ohne Erfolg zu Ende
    const m = S.meta || {}, since = t => (t ? Date.now() - Date.parse(t) : Infinity);
    const starting = !on && (since(m.tv_wake) < 35000 || (tv.an_skript && ent(tv.an_skript)?.state === 'on') || Date.now() - tvStart < 6000);
    const fail = !on && !starting && (since(m.tv_fail) < 180000 || tvHint);
    if (on) { tvHint = false; tvStart = 0; }
    // Titel/Position per ADB (wir-home schreibt nur bei Änderung, leert es bei ausgeschaltetem TV): nur, wenn es zur laufenden App passt
    const ti = S.tv && S.tv.paket && on &&(!app.paket || pk.length === 0 || S.tv.paket === app.paket || pk.includes(S.tv.paket)) ? S.tv : null;
    if (ti && o.playing == null) playing = ti.spielt;
    return { tv, s, a, on, playing, vol, muted, max, ai, app, ti, starting, fail, source: o.source || a.source || '' };
  }

  // ---------------------------------------------------------------- Aufbau (einmal)
  function build() {
    if (built) return;
    built = true;
    host.innerHTML = window.ZH_MARKUP;
    // "läuft gerade": Platz für das große App-Zeichen; Hinweis neben "Apps" weg
    qa('#zh-p-tv .z-now')[0]?.insertAdjacentHTML('afterbegin', '<i class="z-nowmark" id="zh-nowmark" aria-hidden="true"></i>');
    qa('#zh-p-tv .z-sec span')[1]?.remove();
    // weitere installierte Apps (vom Fernseher gelesen) unter den festen App-Kacheln
    $('apps').insertAdjacentHTML('afterend', '<div class="z-sec" id="zh-moresec" hidden><span>Weitere Apps</span></div><div class="z-more" id="zh-more"></div>');
    // Lautstärke-Karte: Bild aus (Ton an) + Bildschirmfoto neben "Stumm"
    $('mute').insertAdjacentHTML('afterend', '<div class="z-vbtn z-xbtn" id="zh-bildaus" data-i="screenoff">Bild aus</div><div class="z-vbtn z-xbtn" id="zh-shotbtn" data-i="camera">Bildschirm</div>');
    // eigene Kachel: Bildhelligkeit des Fernsehers (wie die Lautstärke-Kachel)
    qa('#zh-p-tv .z-volc')[0]?.insertAdjacentHTML('afterend', '<div class="z-volc z-hellc" id="zh-hellc" hidden><div class="z-vh">Bildhelligkeit<b id="zh-hn">50</b></div><div class="z-vrow"><div class="z-vbtn" id="zh-hd">−</div><div class="z-vbar" id="zh-hbar"><i id="zh-hi"></i></div><div class="z-vbtn" id="zh-hu">+</div></div></div>');
    // Fernbedienung: Text an den Fernseher (Suchfelder usw.)
    qa('#zh-p-tv .z-remote')[0]?.insertAdjacentHTML('beforeend', '<div class="z-tvtext"><input id="zh-tvtext" type="text" maxlength="200" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="send" placeholder="Text an den Fernseher …"><div class="z-tb" id="zh-tvdel" data-i="backspace" title="Zeichen löschen"></div><div class="z-tb z-send" id="zh-tvsend" data-i="send" title="Senden"></div></div>');
    // Bildschirmfoto groß
    host.insertAdjacentHTML('beforeend', '<div class="z-ov z-shotov" id="zh-shotov"><div class="z-shotbox"><img id="zh-shotimg" alt="Bildschirm des Fernsehers"><div class="z-shotmsg" id="zh-shotmsg"></div></div><div class="z-shotbar"><div class="z-btn" id="zh-shotnew" data-i="camera">Neu aufnehmen</div><div class="z-btn" id="zh-shotclose" data-i="close">Schließen</div></div></div>');
    // Einstellungen: Kino-Licht
    qa('#zh-p-set .z-info')[0]?.insertAdjacentHTML('beforebegin', '<div class="z-srow" id="zh-kinorow"><div class="z-si" data-i="film"></div><div><b>Kino-Licht</b><small>Licht dimmt automatisch, solange auf dem Fernseher etwas läuft</small></div><div class="z-sw z-r" id="zh-kino"></div></div>');
    // Wecker: Fernseher beim Wecken
    qa('#zh-p-alarm .z-aset .z-skip')[0]?.insertAdjacentHTML('beforebegin', '<div class="z-sbox" id="zh-wtv"><h4>Fernseher beim Wecken<div class="z-sw" id="zh-wtvsw"></div></h4><p>geht zur Weckzeit an und öffnet die App</p><div class="z-opts z-wtvapps" id="zh-wtvapps"></div><h4 class="z-wtvvol">Lautstärke<span id="zh-wtvvl">15</span></h4><input type="range" min="0" max="40" value="15" id="zh-wtvvol"></div>');
    icons(host);
    // Beschriftungen für die Tab-Reihe auf dem Handy
    const LBL = { start: 'Start', tv: 'Fernseher', cal: 'Kalender', alarm: 'Wecker', set: 'Einstellungen' };
    qa('.z-nv[data-p]').forEach(n => { n.dataset.label = LBL[n.dataset.p]; n.title = LBL[n.dataset.p]; });
    // dezentes Herz unten in der Seitenleiste: zurück zur Wir-App (nur Tablet)
    $('rail').insertAdjacentHTML('beforeend', `<div class="z-nv z-back" data-back title="Zurück zur Wir-App">${svg('heart')}</div>`);
    // Uhrzeit-Feld für die Wecker (unsichtbar, öffnet die Zeitauswahl des Geräts)
    host.insertAdjacentHTML('beforeend', '<input type="time" id="zh-timepick" class="z-timepick" tabindex="-1" aria-hidden="true">');
    // Langdruck-Panel der Lampen: direkt an body (über allem, unabhängig von Scroll-/Stapelkontext in Zuhause)
    document.body.insertAdjacentHTML('beforeend', '<div class="z-lp" id="zh-lp" role="dialog" aria-label="Lampe"></div>');
    wireLamp();
    wire();
  }

  // ---------------------------------------------------------------- Navigation in Zuhause
  function go(p) {
    page = p;
    qa('.z-nv[data-p]').forEach(n => n.classList.toggle('z-on', n.dataset.p === p));
    qa('.z-page').forEach(x => x.classList.toggle('z-on', x.id === 'zh-p-' + p));
    const v = tvView();
    if (p === 'tv' && v?.on) $('stage').style.setProperty('--z-a1', v.app.farbe); else $('stage').style.removeProperty('--z-a1');
    // Handy: nach oben und Tab mittig – nur wenn nötig und direkt gesetzt (wiederholtes scrollTo/scrollIntoView hielt in WebKit Speicher fest)
    if (!mqTab.matches) {
      const pg = host.closest('.page'); if (pg && pg.scrollTop) pg.scrollTop = 0;
      const R = $('rail'), on = R.querySelector('.z-on');
      if (on) {
        const rr = R.getBoundingClientRect(), or = on.getBoundingClientRect();
        const x = Math.max(0, Math.min(R.scrollWidth - R.clientWidth, Math.round(R.scrollLeft + (or.left + or.width / 2) - (rr.left + rr.width / 2))));
        if (Math.abs(R.scrollLeft - x) > 1) R.scrollLeft = x;
      }
    }
  }

  // ---------------------------------------------------------------- Uhr, Fakten, Hinweise
  function daysTo(ms) { return Math.round((new Date(ms).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 864e5); }
  function wiedersehen() {
    const next = window.WIR_COUNTDOWN?.next?.();
    if (!next) return '';
    const d = daysTo(next);
    return d <= 0 ? 'Wiedersehen heute' : d === 1 ? 'Wiedersehen morgen' : `Wiedersehen in ${d} Tagen`;
  }
  const local = { night: true, saverMin: 5 };
  try { local.night = localStorage.getItem('zh-night') !== '0'; local.saverMin = +localStorage.getItem('zh-saver') || 5; } catch (_) {}
  function tick() {
    if (!built) return;
    const n = new Date(), hm = n.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }), h = n.getHours();
    $('clock').textContent = hm; $('sclock').textContent = hm;
    $('date').textContent = n.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
    $('hello').textContent = (h < 11 ? 'Guten Morgen' : h < 17 ? 'Hallo' : h < 22 ? 'Guten Abend' : 'Gute Nacht') + ', ihr zwei';
    $('saver').classList.toggle('z-night', local.night && (h >= 22 || h < 6));
    renderFacts();
    if (cfg()) { renderTV(); tvWatch(); }
  }
  const num = (v, d = 1) => (Number.isFinite(v) ? v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }) : '–');
  const val = id => { const v = parseFloat(ent(id)?.state); return Number.isFinite(v) ? v : NaN; };
  function wmo(code) {
    if (code === 0) return ['cloudsun', 'klar'];
    if (code <= 2) return ['cloudsun', 'leicht bewölkt'];
    if (code === 3) return ['cloud', 'bewölkt'];
    if (code <= 48) return ['cloud', 'Nebel'];
    if (code <= 67 || (code >= 80 && code <= 82)) return ['rain', 'Regen'];
    if (code <= 86) return ['cloud', 'Schnee'];
    return ['rain', 'Gewitter'];
  }
  function renderFacts() {
    const c = cfg(); if (!c) return;
    const K = c.klima, w = S.wetter, f = qa('.z-f', $('p-start'));
    if (f.length < 4) return;
    if (w?.now) {
      const [ic, txt] = wmo(w.now.code);
      f[0].querySelector('b').textContent = `${w.now.t}° · ${txt}`;
      f[0].querySelector('span').textContent = `${w.ort} · ${w.regen_ab ? `Regen ab ${w.regen_ab} Uhr` : 'kein Regen in Sicht'}`;
      const ics = f[0].querySelector('.z-ic'); if (ics.dataset.i !== ic) { ics.dataset.i = ic; ics.innerHTML = svg(ic); }
    }
    f[0].hidden = !c.wetter;
    const t = val(K.temperatur), hu = val(K.luftfeuchte), co = val(K.co2);
    f[1].querySelector('b').textContent = `${num(t)}° · ${num(hu, 0)} %`;
    f[1].querySelector('span').textContent = K.co2 ? `CO₂ ${num(co, 0)} ppm · ${co < 800 ? 'gut' : co < 1200 ? 'mittel' : 'lüften'}` : 'Raumklima';
    f[1].hidden = !K.temperatur && !K.luftfeuchte;
    f[2].querySelector('b').textContent = `${num(val(K.strom_heute))} kWh heute`;
    $('watt').textContent = `gerade ${num(val(K.leistung), 0)} W`;
    f[2].hidden = !K.strom_heute && !K.leistung;
    const days = (document.getElementById('dayCount')?.textContent || '').trim();
    qa('.z-days-n').forEach(x => { x.textContent = days || '–'; });
    f[3].querySelector(':scope > div > span').textContent = wiedersehen() || 'Wir zwei';
    $('saver').querySelector('.z-sc2').textContent = [Number.isFinite(t) ? `${num(t)}° drinnen` : '', w?.now ? `${w.now.t}° ${w.ort}` : ''].filter(Boolean).join(' · ');
  }
  function renderChips() {
    const c = cfg(); if (!c) return;
    const box = qa('.z-chips', $('p-start'))[0];
    const alarm = `<div class="z-chip z-alarm" data-go="alarm">${svg('alarm')}<span id="zh-nextalarm">${esc(alarmInfo().chip)}</span></div>`;
    const sens = c.sensoren.map(x => {
      const s = ent(x.entity_id), open = s?.state === 'on';
      const icon = x.art === 'fenster' ? 'window' : x.art === 'tuer' ? 'door' : 'bolt';
      const mins = s ? Math.max(1, Math.round((Date.now() - Date.parse(s.changed)) / 60000)) : 0;
      const txt = !s || s.state === 'unavailable' ? `${x.name} ?` : x.art === 'bewegung' ? (open ? 'Bewegung' : 'Ruhig')
        : open ? `${x.name} offen · ${mins < 60 ? mins + ' Min' : Math.round(mins / 60) + ' Std'}` : `${x.name} zu`;
      return `<div class="z-chip${open && x.art !== 'bewegung' ? ' z-warn' : ''}">${svg(icon)}${esc(txt)}</div>`;
    }).join('');
    const html = alarm + sens;
    setHTML(box, html);
  }

  // ---------------------------------------------------------------- Lampen
  let dr = null;
  function renderLamps() {
    const c = cfg(); if (!c) return;
    const P = $('pills');
    if (P.childElementCount !== c.lampen.length) {
      P.innerHTML = c.lampen.map((l, i) => `<div class="z-pill" data-k="${i}"><div class="z-fill"></div><div class="z-in"><div class="z-ic">${svg('bulb')}</div><div><h3>${esc(l.name)}</h3><p></p></div><div class="z-pct"></div></div></div>`).join('');
    }
    c.lampen.forEach((l, i) => {
      const el = P.children[i]; if (!el || dr?.t === el) return;
      const v = lampView(l);
      el.classList.toggle('z-on', v.on);
      el.style.setProperty('--c', v.c);
      el.querySelector('.z-fill').style.width = (v.on ? v.b : 0) + '%';
      el.querySelector('p').textContent = v.na ? 'nicht erreichbar' : v.on ? v.k : 'Aus';
      el.querySelector('.z-pct').textContent = v.on ? v.b + ' %' : 'Aus';
    });
  }

  // Langdruck-Panel einer Lampe
  const LP_K = [[2200, 'Warm'], [2700, 'Gemütlich'], [3500, 'Neutral'], [4500, 'Hell'], [6000, 'Kalt']];
  const LP_C = ['#ff3b30', '#ff7a1a', '#ffc23d', '#4cd964', '#2fd4c4', '#3d7bff', '#8f6bff', '#ff5fa8'];
  let lp = null, lpSent = 0, lpT = 0;
  function openLamp(l) {
    if (!l) return;
    lp = { l, drag: false };
    const box = $('lp'), cs = getComputedStyle(host);
    // Farben der aktuellen Farbwelt aus Zuhause übernehmen
    for (const v of ['--z-bg', '--z-card', '--z-line', '--z-txt', '--z-mut', '--z-vio', '--zw']) box.style.setProperty(v, cs.getPropertyValue(v));
    box.classList.toggle('z-lp-tab', mqTab.matches);
    box.querySelector('h3').textContent = l.name;
    box.classList.add('z-on');
    renderLp();
  }
  function closeLamp() { lp = null; clearTimeout(lpT); $('lp')?.classList.remove('z-on'); }
  function renderLp() {
    if (!lp) return;
    const v = lampView(lp.l), box = $('lp'), a = ent(lp.l.entity_id)?.a || {};
    box.style.setProperty('--c', v.c);
    box.querySelector('.z-lp-sw').classList.toggle('z-on', v.on);
    box.querySelector('.z-lp-sub').textContent = v.na ? 'nicht erreichbar' : v.on ? `${v.b} % · ${v.k}` : 'Aus';
    const r = box.querySelector('input'); if (!lp.drag) r.value = v.b;
    qa('[data-k]', box).forEach(x => x.classList.toggle('z-on', a.color_mode === 'color_temp' && Math.abs((a.color_temp_kelvin || 0) - +x.dataset.k) < 250));
    qa('[data-c]', box).forEach(x => x.classList.toggle('z-on', a.color_mode !== 'color_temp' && v.c === x.dataset.c));
  }
  function lampCmd(data, log = true) {
    const l = lp?.l; if (!l) return;
    optimistic(l.entity_id, { on: true, ...(data.brightness_pct ? { b: data.brightness_pct } : {}) });
    sceneOv = null;
    call({ entity_id: l.entity_id, service: 'light.turn_on', data: { ...data, transition: data.brightness_pct && !log ? 0.3 : 1 }, log }, !log);
    renderLamps(); renderScenes(); renderLp();
  }
  function wireLamp() {
    const box = $('lp');
    box.innerHTML = `<div class="z-lp-card"><div class="z-lp-hd"><div class="z-lp-dot"></div><div><h3></h3><p class="z-lp-sub"></p></div><div class="z-sw z-lp-sw"></div><div class="z-lp-x" data-x>✕</div></div>` +
      `<div class="z-lp-lab">Helligkeit</div><input type="range" min="1" max="100" step="1" aria-label="Helligkeit">` +
      `<div class="z-lp-lab">Weißton</div><div class="z-lp-row">${LP_K.map(([k, n]) => `<div class="z-lp-k" data-k="${k}" style="--s:${hex(kelvinRgb(k))}"><i></i><span>${n}</span></div>`).join('')}</div>` +
      `<div class="z-lp-lab">Farbe</div><div class="z-lp-row z-lp-cols">${LP_C.map(c => `<div class="z-lp-c" data-c="${c}" style="--s:${c}"></div>`).join('')}</div></div>`;
    box.addEventListener('click', e => {
      if (e.target === box || e.target.closest('[data-x]')) return closeLamp();
      if (!lp) return;
      if (e.target.closest('.z-lp-sw')) {
        const on = !lampView(lp.l).on;
        optimistic(lp.l.entity_id, { on }); sceneOv = null;
        call({ entity_id: lp.l.entity_id, service: on ? 'light.turn_on' : 'light.turn_off', data: { transition: 0.5 } });
        renderLamps(); renderScenes(); renderLp();
        return;
      }
      const k = e.target.closest('[data-k]'), c = e.target.closest('[data-c]');
      if (k) {
        const a = ent(lp.l.entity_id)?.a || {};
        lampCmd({ color_temp_kelvin: Math.max(a.min_color_temp_kelvin || 2000, Math.min(a.max_color_temp_kelvin || 6500, +k.dataset.k)) });
      } else if (c) lampCmd({ rgb_color: hexRgb(c.dataset.c) });
    });
    const r = box.querySelector('input');
    r.addEventListener('input', () => {
      if (!lp) return;
      lp.drag = true;
      optimistic(lp.l.entity_id, { on: true, b: +r.value }); renderLamps();
      clearTimeout(lpT);
      if (Date.now() - lpSent > 350) { lpSent = Date.now(); lampCmd({ brightness_pct: +r.value }, false); }
      else lpT = setTimeout(() => lampCmd({ brightness_pct: +r.value }, false), 360);
    });
    r.addEventListener('change', () => { if (!lp) return; lp.drag = false; clearTimeout(lpT); lampCmd({ brightness_pct: +r.value }); });
  }

  // ---------------------------------------------------------------- Geräte, Routinen
  function renderDevs() {
    const c = cfg(); if (!c) return;
    const D = $('devs');
    if (D.childElementCount !== c.geraete.length) {
      D.innerHTML = c.geraete.map((g, i) => `<div class="z-dev" style="--c:${g.farbe}" data-k="${i}"><div class="z-di">${svg(g.icon)}</div><div><h4>${esc(g.name)}</h4><p></p></div></div>`).join('');
    }
    c.geraete.forEach((g, i) => {
      const el = D.children[i], o = ov[g.entity_id], s = ent(g.entity_id);
      const on = o?.on != null ? o.on : s?.state === 'on';
      el.classList.toggle('z-on', on);
      el.querySelector('p').textContent = !s || s.state === 'unavailable' ? 'nicht erreichbar' : on ? (g.text_an || 'An') : 'Aus';
    });
    D.hidden = !c.geraete.length;
  }
  function renderRoutines() {
    const c = cfg(); if (!c) return;
    const R = $('routines');
    if (R.childElementCount !== c.routinen.length) {
      R.innerHTML = c.routinen.map((r, i) => `<div class="z-rt" data-k="${i}"><div class="z-h">${svg(r.icon)}<div class="z-sw"></div></div><div><h4>${esc(r.name)}</h4><p>${esc(r.info)}</p></div></div>`).join('');
      if (c.routinen.length !== 4) R.style.gridTemplateColumns = `repeat(${Math.max(1, c.routinen.length)},1fr)`;
    }
    c.routinen.forEach((r, i) => {
      const o = ov[r.entity_id];
      R.children[i].querySelector('.z-sw').classList.toggle('z-on', o?.on != null ? o.on : ent(r.entity_id)?.state === 'on');
    });
    R.hidden = !c.routinen.length;
  }

  // ---------------------------------------------------------------- Fernseher
  const mmss = s => (s >= 3600 ? `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}` : `${Math.floor(s / 60)}`) + `:${pad(Math.floor(s % 60))}`;
  // Fortschritt: per ADB (Position, lokal weitergezählt solange "spielt"; eine Dauer liefert Android 9 dort nicht)
  // oder aus Cast/HA (Position läuft seit media_position_updated_at weiter). Ohne Dauer kein Balken, nur die Position.
  function renderProg(v) {
    const a = v.a, ti = v.ti;
    let pos, dur;
    if (ti && ti.pos >= 0) { dur = 0; pos = ti.pos + (v.playing ? (Date.now() - Date.parse(ti.at)) / 1000 : 0); }
    else {
      pos = a.media_position ?? -1; dur = a.media_duration || 0;
      if (pos >= 0 && v.playing && a.media_position_updated_at) pos += (Date.now() - Date.parse(a.media_position_updated_at)) / 1000;
    }
    if (dur) pos = Math.min(pos, dur);
    const prog = qa('.z-prog', $('p-tv'))[0], bar = prog.querySelector('.z-bar');
    bar.hidden = !dur;
    bar.querySelector('i').style.width = dur && pos >= 0 ? (pos / dur * 100).toFixed(1) + '%' : '0%';
    const t = pos >= 0 ? (dur ? `${mmss(pos)} / ${mmss(dur)}` : mmss(pos)) : '', sp = prog.querySelector(':scope > span');
    if (sp.textContent !== t) sp.textContent = t;
    return { pos, dur };
  }
  function renderTV() {
    const v = tvView();
    $('tvc').hidden = !v; qa('.z-nv[data-p="tv"]').forEach(n => { n.hidden = !v; });
    if (!v) return;
    const { tv, a, app } = v;
    const A = $('apps');
    if (A.childElementCount !== tv.apps.length) A.innerHTML = tv.apps.map((x, i) => `<div class="z-ap" style="--c:${x.farbe}" data-k="${i}"><i class="z-mark">${appMark(x)}</i><b>${esc(x.name)}</b><span>öffnen</span></div>`).join('');
    const Q = $('srcs'), ein = srcList(tv), esig = ein.map(q => q.name).join('|');
    if (Q.dataset.sig !== esig) {
      Q.dataset.sig = esig;
      Q.innerHTML = ein.map((q, i) => `<div class="z-src" data-k="${i}">${svg(q.icon)}${esc(q.name)}</div>`).join('');
    }
    Q.hidden = !ein.length;
    // weitere Apps vom Fernseher (kleine Kacheln mit Anfangsbuchstabe bzw. eigenem Zeichen)
    const more = S.tvx?.apps || [], M = $('more'), msig = more.map(x => x.paket).join('|');
    if (M.dataset.sig !== msig) {
      M.dataset.sig = msig;
      M.innerHTML = more.map((x, i) => `<div class="z-ma" style="--c:${esc(x.farbe)}" data-k="${i}"><i class="z-mark">${appMark(x)}</i><b>${esc(x.name)}</b></div>`).join('');
    }
    M.hidden = $('moresec').hidden = !more.length;
    qa('.z-ma', M).forEach((x, i) => x.classList.toggle('z-on', v.on && !!a.app_id && a.app_id === more[i]?.paket));
    // Bild aus (Ton läuft weiter): der Fernseher schläft, Lautstärke bleibt bedienbar
    const bildAus = !v.on && !!S.tvx?.bild_aus;
    $('stage').style.setProperty('--app', app.farbe);
    $('p-tv').classList.toggle('z-tvoff', !v.on);
    $('p-tv').classList.toggle('z-bildaus', bildAus);
    const ba = $('bildaus');
    ba.lastChild.textContent = bildAus ? 'Bild an' : 'Bild aus';
    ba.classList.toggle('z-on', bildAus);
    ba.hidden = $('shotbtn').hidden = !tv.titel;
    // Bildhelligkeit (nur mit ADB)
    const hv = Number.isFinite(hellOv) ? hellOv : S.tvx?.helligkeit;
    $('hellc').hidden = !tv.titel || !Number.isFinite(hv);
    if (Number.isFinite(hv)) { $('hn').textContent = hv; $('hi').style.width = hv + '%'; }
    renderShot();
    qa('#zh-p-tv .z-h1, #zh-tvc h3').forEach(x => { x.textContent = tv.name; });
    $('napp').textContent = app.name;
    // großes App-Zeichen rechts in "läuft gerade" (füllt die Karte, auch wenn die App keinen Titel liefert)
    const nm = $('nowmark');
    if (nm.dataset.k !== app.name) { nm.dataset.k = app.name; nm.innerHTML = appMark(app); }
    // Titel: per ADB (Serie / Staffel · Folge · Episode bzw. Titel · Untertitel), sonst Cast/HA; Beispieltext nur im Testmodus
    const ti = v.ti, sf = ti?.staffel ? `Staffel ${ti.staffel} · Folge ${ti.folge}` : '';
    const serie = ti && sf ? ti.untertitel || '' : '';
    const titel = (ti && (serie || ti.titel)) || a.media_series_title || a.media_title || (S.meta?.mode === 'test' ? app.test : '') || (v.on ? app.name : '');
    const zeile = ti ? (serie ? [sf, ti.titel] : [ti.untertitel]).filter(Boolean).join(' · ') : '';
    $('ntitle').textContent = titel;
    const { pos, dur } = renderProg(v);
    const st = !v.playing ? 'pausiert' : dur ? `noch ${Math.ceil((dur - pos) / 60)} Min` : 'läuft';
    $('nsub').textContent = zeile ? `${zeile} · ${st}` : st;
    setHTML($('pp'), svg(v.playing ? 'pause' : 'play'));
    $('pwrt').textContent = v.on || bildAus ? 'Ausschalten' : v.starting ? 'Startet …' : 'Einschalten';
    $('offmsg').querySelector('b').textContent = v.starting ? 'Fernseher wird gestartet …' : bildAus ? 'Bild aus · Ton läuft' : 'Fernseher ist aus';
    $('offmsg').querySelector('span').textContent = v.starting ? 'kann bis zu 45 Sekunden dauern' : bildAus ? 'Tippen für Bild an' : v.fail ? 'Hat diesmal nicht geklappt – nochmal tippen' : 'Tippen zum Einschalten';
    $('tvstate').textContent = v.on ? 'An · ' + app.name : v.starting ? 'Startet …' : bildAus ? 'Bild aus · Ton an' : 'Aus · Standby';
    $('tvstate').classList.toggle('z-off', !v.on);
    qa('.z-ap', A).forEach((x, i) => {
      x.classList.toggle('z-on', v.on && i === v.ai);
      const t = v.on && i === v.ai ? 'läuft' : 'öffnen', sp = x.querySelector('span');
      if (sp.textContent !== t) sp.textContent = t;
    });
    const known = tv.quellen.some(q => q.source === v.source);
    qa('.z-src', Q).forEach((x, i) => x.classList.toggle('z-on', ein[i]?.x ? ein[i].x === eingangSel : known ? tv.quellen[i]?.source === v.source : i === 0));
    const pct = v.vol / v.max * 100;
    $('vn').textContent = v.muted ? 'stumm' : v.vol; $('vi').style.width = pct + '%'; $('mute').classList.toggle('z-on', v.muted);
    $('tvc').classList.toggle('z-off', !v.on);
    $('tvcsub').textContent = v.on ? app.name + (titel && v.ti ? ' · ' + titel : v.playing ? ' · läuft' : ' · pausiert')
      : v.starting ? 'Fernseher wird gestartet …' : bildAus ? 'Bild aus · Ton läuft' : v.fail ? 'Aus · Einschalten hat nicht geklappt' : 'Aus · tippen für Fernbedienung';
    $('tvc-v').style.width = pct + '%'; $('tvc-n').textContent = v.muted ? '–' : v.vol;
    if (page === 'tv') { if (v.on) $('stage').style.setProperty('--z-a1', app.farbe); else $('stage').style.removeProperty('--z-a1'); }
  }
  // Lautstärke: Anzeige sofort, Befehl gedrosselt
  let volSent = 0, volTimer = 0;
  function setVol(n, final) {
    const v = tvView(); if (!v) return;
    n = Math.max(0, Math.min(v.max, Math.round(n)));
    optimistic(v.tv.entity_id, { vol: n, muted: false });
    renderTV();
    clearTimeout(volTimer);
    const send = log => call({ entity_id: v.tv.entity_id, service: 'media_player.volume_set', data: { volume_level: n / v.max }, log }, !log);
    if (final) send(true);
    else if (Date.now() - volSent > 300) { volSent = Date.now(); send(false); volTimer = setTimeout(() => send(true), 600); }
    else volTimer = setTimeout(() => send(true), 400);
  }
  // Einschalten klappt bei manchen Fernsehern nur mit Netzwerk-Standby – meldet er sich nicht, dezenter Hinweis im Panel
  // Einschalten: wir-home startet die Einschalt-Routine (bis 25 s) – solange "wird gestartet …", danach ggf. dezenter Hinweis
  let tvHint = false, tvHintT = 0, tvStart = 0;
  function tvStarting() {
    tvStart = Date.now(); tvHint = false;
    clearTimeout(tvHintT);
    // Rückfall, falls vom Dienst nichts kommt
    tvHintT = setTimeout(() => { if (active && !tvView()?.on && !tvView()?.starting) { tvHint = true; renderTV(); } }, 40000);
  }
  function tvPower(on) {
    const v = tvView(); if (!v) return;
    if (on && v.starting) return;
    if (on) tvStarting(); else optimistic(v.tv.entity_id, { on: false });
    renderTV();
    toast(on ? `${v.tv.name} wird gestartet …` : `${v.tv.name} aus`);
    call({ entity_id: v.tv.entity_id, service: on ? 'media_player.turn_on' : 'media_player.turn_off' }, on).then(ok => { if (on && !ok) { tvStart = 0; tvHint = true; if (active) renderTV(); } });
    if (on) setTimeout(() => { if (active) renderTV(); }, 6500);
  }
  // "läuft gerade" mit Titel: wir-home liest ihn nur, solange Zuhause offen ist – alle 30 s melden
  let watchAt = 0;
  function tvWatch() {
    const v = tvView();
    if (!active || !v?.tv.titel || !v.on || Date.now() - watchAt < 30000) return;
    watchAt = Date.now();
    call({ entity_id: v.tv.entity_id, service: 'tv.watch', log: false }, true);
  }
  // Eingänge: aus der Konfiguration ("quellen") oder die vom Fernseher gelesenen HDMI-Eingänge (+ Smart TV)
  let eingangSel = 'tv';
  function srcList(tv) {
    if (tv.quellen.length) return tv.quellen;
    const e = S.tvx?.eingaenge || [];
    return e.length ? [{ name: 'Smart TV', icon: 'tv', x: 'tv' }, ...e.map(q => ({ name: q.name, icon: 'hdmi', x: q.key }))] : [];
  }
  // Bildhelligkeit: Anzeige sofort, Befehl gedrosselt (wie die Lautstärke)
  let hellOv = NaN, hellT = 0;
  function setHell(n) {
    const v = tvView(); if (!v) return;
    hellOv = Math.max(0, Math.min(100, Math.round(n)));
    renderTV();
    clearTimeout(hellT);
    hellT = setTimeout(() => {
      const wert = hellOv;
      call({ entity_id: v.tv.entity_id, service: 'tv.helligkeit', data: { wert } }).finally(() => { if (hellOv === wert) { hellOv = NaN; if (active) renderTV(); } });
    }, 350);
  }
  // Bildschirmfoto: anfordern, groß zeigen, sobald das neue Foto da ist
  let shotWant = 0, shotOpen = false;
  function takeShot() {
    const v = tvView(); if (!v?.on) return toast('Der Fernseher ist aus');
    shotWant = Date.now(); shotOpen = true;
    renderShot();
    call({ entity_id: v.tv.entity_id, service: 'tv.bildschirm' }).then(ok => { if (!ok) { shotOpen = false; renderShot(); } });
  }
  function renderShot() {
    const ov = $('shotov'); if (!ov) return;
    ov.classList.toggle('z-on', shotOpen);
    if (!shotOpen) return;
    const b = S.tvx?.bildschirm || {}, sh = S.shot, neu = sh && Date.parse(sh.at) >= shotWant - 2000;
    const img = $('shotimg');
    if (neu && img.src !== sh.url) img.src = sh.url;
    img.hidden = !neu;
    $('shotmsg').textContent = b.laeuft || (!neu && !b.fehler) ? 'Bildschirm wird aufgenommen …'
      : !neu && b.fehler ? b.fehler : 'Aufgenommen um ' + new Date(sh.at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }
  function sendText(enter) {
    const v = tvView(), inp = $('tvtext'); if (!v) return;
    const text = inp.value;
    if (!text && !enter) return;
    call({ entity_id: v.tv.entity_id, service: 'tv.text', data: { text, enter } }).then(ok => { if (ok) { inp.value = ''; toast(enter ? 'Gesendet' : 'Text gesendet'); } });
  }
  function volStep(d) {
    const v = tvView(); if (!v) return;
    optimistic(v.tv.entity_id, { vol: Math.max(0, Math.min(v.max, v.vol + d)), muted: false });
    renderTV();
    call({ entity_id: v.tv.entity_id, service: d > 0 ? 'media_player.volume_up' : 'media_player.volume_down' }, true);
  }

  // ---------------------------------------------------------------- Szenen
  function renderScenes() {
    const c = cfg(); if (!c) return;
    const Sc = $('scenes');
    if (Sc.childElementCount !== c.szenen.length) Sc.innerHTML = c.szenen.map(s => `<div class="z-sc" style="--a:${s.farbe}" data-k="${s.key}"><div class="z-b">${svg(s.icon)}</div>${esc(s.name)}</div>`).join('');
    const on = sceneOv || S.meta?.scene || '';
    qa('.z-sc', Sc).forEach(x => x.classList.toggle('z-on', x.dataset.k === on));
  }

  // ---------------------------------------------------------------- Kalender + To-dos
  const C = { d: 'var(--z-d)', i: 'var(--z-i)', g: 'var(--z-g)' };
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  let view = new Date(today().getFullYear(), today().getMonth(), 1), sel = today();
  const events = () => S.kalender?.termine || [];
  function evOn(ds) {
    const a = [];
    events().forEach(x => { if (x.d === ds) a.push(x); else if (x.s && ds >= x.s && ds <= x.to) a.push({ ...x, span: true, start: ds === x.s, end: ds === x.to }); });
    return a.sort((p, q) => (q.span ? 1 : 0) - (p.span ? 1 : 0) || (p.t || '').localeCompare(q.t || ''));
  }
  function renderMonth() {
    $('mtitle').textContent = view.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    const first = new Date(view.getFullYear(), view.getMonth(), 1), off = (first.getDay() + 6) % 7, start = new Date(first);
    start.setDate(1 - off);
    const td = iso(today()), sd = iso(sel);
    let h = '';
    for (let k = 0; k < 42; k++) {
      const d = new Date(start); d.setDate(start.getDate() + k);
      const ds = iso(d), es = evOn(ds), dow = (d.getDay() + 6) % 7;
      const cls = ['z-day', d.getMonth() !== view.getMonth() ? 'z-other' : '', dow > 4 ? 'z-we' : '', ds === td ? 'z-today' : '', ds === sd ? 'z-sel' : ''].join(' ');
      h += `<div class="${cls}" data-d="${ds}"><div class="z-n">${d.getDate()}</div>${es.slice(0, 2).map(x => `<div class="z-ev ${x.span ? 'z-span' : ''} ${x.start ? 'z-start' : ''} ${x.end ? 'z-end' : ''}" style="--c:${C[x.w]}">${x.span && !x.start && dow !== 0 ? '&nbsp;' : esc(x.n)}</div>`).join('')}${es.length > 2 ? `<div class="z-more">+${es.length - 2}</div>` : ''}</div>`;
    }
    setHTML($('grid'), h);
  }
  const whoTxt = w => (w === 'g' ? 'gemeinsam' : w === 'i' ? 'Ida' : 'Daniel');
  function renderAgenda() {
    const ds = iso(sel), es = evOn(ds);
    $('seltitle').textContent = ds === iso(today()) ? 'Heute' : sel.toLocaleDateString('de-DE', { weekday: 'long' });
    $('seldate').textContent = sel.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
    setHTML($('agenda'), es.length ? es.slice(0, 3).map(x => `<div class="z-it" style="--c:${C[x.w]}"><div class="z-bar"></div><div class="z-t">${x.span || !x.t ? 'ganzt.' : esc(x.t)}</div><div><b>${esc(x.n)}</b><small>${[x.span ? 'ganztägig' : (x.e ? x.t + ' – ' + x.e : ''), whoTxt(x.w)].filter(Boolean).map(esc).join(' · ')}</small></div></div>`).join('') : '<div class="z-empty">Keine Termine – freier Tag.</div>');
  }
  const LISTS = { Gemeinsam: 'gemeinsam', Einkauf: 'einkauf', Haushalt: 'haushalt' };
  let curL = 'gemeinsam';
  const todoOv = {};   // id -> { done, who, gone } optimistisch
  function todoList(list) {
    return S.todos.filter(t => t.list === list && !todoOv[t.id]?.gone).map(t => ({ ...t, ...(todoOv[t.id] || {}) }))
      .sort((a, b) => (b.created || '').localeCompare(a.created || ''));
  }
  function renderTodos() {
    const items = todoList(curL);
    const h = items.map(x => `<div class="z-td ${x.done ? 'z-done' : ''}" data-id="${x.id}"><div class="z-cb">${svg('check')}</div><div><b>${esc(x.text)}</b>${x.note ? `<small>${esc(x.note)}</small>` : ''}</div><div class="z-who" style="--c:${C[x.who]}">${x.who === 'd' ? 'D' : x.who === 'i' ? 'I' : 'W'}</div></div>`).join('')
      || '<div class="z-empty">Noch nichts auf der Liste.</div>';
    setHTML($('todos'), h);
    const open = [...todoList('gemeinsam'), ...todoList('haushalt'), ...todoList('einkauf')].filter(x => !x.done).slice(0, 3);
    setHTML($('rtodos'), open.map(x => `<div class="z-rtodo"><i></i>${esc(x.text)}</div>`).join('') || '<div class="z-rtodo">Alles erledigt</div>');
  }

  // ---------------------------------------------------------------- Wecker (Einstellungen in PocketBase: home_settings "wecker")
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
      if (cand) return { ...cand, d, day };
    }
    return null;
  }
  function alarmInfo() {
    const w = W(), n = nextAlarm(), tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    if (!n) return { chip: 'kein Wecker', state: w.aussetzen === iso(tomorrow) ? 'Morgen kein Wecker' : 'Kein Wecker aktiv', saver: '', n };
    const when = n.d === 0 ? 'heute' : n.d === 1 ? 'morgen' : n.day.toLocaleDateString('de-DE', { weekday: 'long' });
    const lead = fmtMin(n.m - w.vorlauf);
    return { chip: 'Wecker ' + n.a.zeit, state: `Nächster: ${when} ${n.a.zeit}` + (w.vorlauf ? ` · Licht ab ${lead}` : ''), saver: `Wecker ${when} ${n.a.zeit} · `, n };
  }
  function renderAlarm() {
    const w = W(), info = alarmInfo();
    const L = qa('.z-alist', $('p-alarm'))[0];
    const h = w.alarms.map(a => {
      const ts = times(a), lead = fmtMin(toMin(a.zeit) - w.vorlauf);
      const small = a.bis ? `– ${a.bis} · alle ${a.alle} Min` : esc(a.titel);
      const p = !a.ton ? 'nur Licht, kein Ton' : `${a.bis ? esc(a.titel) + ' · ' : ''}Licht ab <span class="z-lead">${w.vorlauf ? lead : a.zeit}</span>${ts.length > 1 ? ` · ${ts.length} Wecker` : ''}`;
      return `<div class="z-al${a.an ? '' : ' z-off'}" data-id="${esc(a.id)}"><div><h3 data-time>${esc(a.zeit)}<small>${small}</small></h3><p>${p}</p></div><div class="z-sw${a.an ? ' z-on' : ''}"></div>` +
        `<div class="z-days">${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((t, i) => `<div data-day="${i}"${a.tage.includes(i) ? ' class="z-on"' : ''}>${t}</div>`).join('')}</div>` +
        (ts.length > 1 ? `<div class="z-atimes">${ts.map(t => `<span>${t}</span>`).join('')}</div>` : '') + '</div>';
    }).join('') + `<div class="z-addal">${svg('plus')}Wecker hinzufügen</div>`;
    setHTML(L, h);
    if (document.activeElement !== $('vor')) $('vor').value = w.vorlauf;
    $('vl').textContent = w.vorlauf + ' Min';
    // Fernseher beim Wecken (nur mit Fernseher in der Konfiguration)
    const ftv = cfg()?.fernseher, wt = { an: false, app: ftv?.apps?.[0]?.name || '', lautstaerke: 15, ...(w.tv || {}) };
    $('wtv').hidden = !ftv;
    if (ftv) {
      $('wtvsw').classList.toggle('z-on', !!wt.an);
      $('wtv').classList.toggle('z-off', !wt.an);
      const AP = $('wtvapps');
      if (AP.childElementCount !== ftv.apps.length) AP.innerHTML = ftv.apps.map(x => `<div>${esc(x.name)}</div>`).join('');
      qa('div', AP).forEach(x => x.classList.toggle('z-on', x.textContent === wt.app));
      if (document.activeElement !== $('wtvvol')) $('wtvvol').value = wt.lautstaerke;
      $('wtvvl').textContent = wt.lautstaerke;
    }
    qa('#zh-tone > div').forEach(x => x.classList.toggle('z-on', x.textContent === w.ton));
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const sk = w.aussetzen === iso(tomorrow);
    $('skip').classList.toggle('z-on', sk);
    $('skip').querySelector('span').textContent = sk ? 'Morgen ausgesetzt – rückgängig' : 'Morgen aussetzen';
    $('astate').textContent = info.state;
    $('snext').textContent = info.saver + 'antippen zum Aufwecken';
    renderChips();
  }
  let saveT = 0;
  function saveAlarm(mut) {
    const w = JSON.parse(JSON.stringify(W()));
    mut(w);
    S.settings.wecker = w;
    renderAlarm();
    clearTimeout(saveT);
    saveT = setTimeout(() => T.settings.save('wecker', S.settings.wecker).catch(() => toast('Speichern fehlgeschlagen')), 400);
  }

  // ---------------------------------------------------------------- Weckvorgang (Test) + Bildschirmschoner
  let alarmAt = null, sn = 0, glowT = 0, holdT = 0, pr = 0;
  const fmt = d => d.toLocaleTimeString('de-DE', { hour: 'numeric', minute: '2-digit' });
  function openRing() {
    const R = $('ring'), n = alarmInfo().n;
    const day = n ? n.day : (() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(0, 0, 0, 0); return d; })();
    const m = n ? n.m : 300;
    alarmAt = new Date(day); alarmAt.setHours(Math.floor(m / 60), m % 60, 0, 0);
    R.classList.add('z-on'); R.classList.remove('z-calm'); sn = 0;
    $('rclock').textContent = fmt(alarmAt);
    const me = window.WIR_LOOK?.me?.()?.name || '';
    qa('.z-gm', R)[0].textContent = 'Guten Morgen' + (me ? ', ' + me : '');
    // Wetter, Termine und To-dos des Wecktages
    const w = S.wetter, rwx = qa('.z-rwx', R)[0];
    qa('.z-t1', R)[0].lastChild.textContent = `${w?.ort || 'Wetter'} heute`;
    rwx.querySelector('b').textContent = w?.heute ? `${w.heute.min}° → ${w.heute.max}°` : '–';
    rwx.querySelector('span').textContent = w?.heute ? `${wmo(w.heute.code)[1]}${w.regen_ab ? ` · ab ${w.regen_ab} Uhr Regen` : ''}` : '';
    const es = evOn(iso(day)).slice(0, 4), box = qa('.z-rc', R)[1];
    qa('.z-row', box).forEach(x => x.remove());
    box.insertAdjacentHTML('beforeend', es.map(x => `<div class="z-row"><div class="z-t">${x.span || !x.t ? 'ganzt.' : esc(x.t)}</div><div><b>${esc(x.n)}</b><small>${esc(x.e ? 'bis ' + x.e : whoTxt(x.w))}</small></div></div>`).join('') || '<div class="z-row"><div><b>Keine Termine</b></div></div>');
    rupd();
    let g = 0; R.style.setProperty('--glow', 0);
    clearInterval(glowT); glowT = setInterval(() => { g = Math.min(1, g + 0.03); R.style.setProperty('--glow', g); if (g >= 1) clearInterval(glowT); }, 60);
  }
  function rupd() {
    const dayStart = new Date(alarmAt).setHours(0, 0, 0, 0);
    const first = evOn(iso(alarmAt)).find(x => x.t && dayStart + toMin(x.t) * 60000 > alarmAt.getTime());
    $('sntxt').textContent = '10 Min · bis ' + fmt(new Date(alarmAt.getTime() + 6e5));
    $('ringtxt').textContent = sn ? `Wecker ${fmt(alarmAt)} · ${sn}× geschlummert` : `Wecker ${fmt(alarmAt)} · Licht 100 %`;
    if (first) {
      const left = Math.max(0, Math.round((dayStart + toMin(first.t) * 60000 - alarmAt) / 6e4));
      $('gs').textContent = `${first.n} ab ${first.t} · noch ${Math.floor(left / 60)} h ${left % 60} Min`;
    } else $('gs').textContent = 'Heute keine Termine';
    const b = qa('.z-done b', $('ring'))[0], wd = wiedersehen();
    if (b) {
      const t = b.previousSibling, inN = wd.startsWith('Wiedersehen in ');
      if (t) t.textContent = !wd ? 'Schönen Tag' : inN ? 'Schönen Tag – ihr seht euch in ' : 'Schönen Tag – ihr seht euch ';
      b.textContent = wd.replace('Wiedersehen in ', '').replace('Wiedersehen ', '');
    }
  }
  function closeRing() { clearInterval(glowT); clearInterval(holdT); $('ring')?.classList.remove('z-on'); }

  let idleT = 0;
  function idle() {
    clearTimeout(idleT);
    if (!active || !mqTab.matches) return;   // Bildschirmschoner nur auf dem Tablet
    idleT = setTimeout(() => { if (!$('ring').classList.contains('z-on')) $('saver').classList.add('z-on'); }, local.saverMin * 6e4);
  }

  // ---------------------------------------------------------------- Leistungsmodus (automatisch + Schalter)
  // localStorage 'wir-perf': '1' an, '0' aus, fehlt = automatisch: iPhone/iOS an; Tablet volle Effekte nur bei ≥ 45 FPS
  let perfAuto = null;
  const perfPref = () => { try { return localStorage.getItem('wir-perf'); } catch (_) { return null; } };
  function perfOn() {
    const p = perfPref();
    if (p === '1') return true;
    if (p === '0') return false;
    if (isIOS && !mqTab.matches) return true;
    if (navigator.deviceMemory && navigator.deviceMemory <= 2) return true;
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) return true;
    return perfAuto ?? isIOS;   // iPad: sparsam, bis die FPS-Messung volle Effekte erlaubt
  }
  function applyPerf() {
    const on = perfOn();
    document.documentElement.classList.toggle('perf', on);
    host.querySelector('.z-stage')?.classList.toggle('z-perf', on);
    $('perf')?.classList.toggle('z-on', on);
    const app = document.getElementById('perfSwitch'); if (app) app.checked = on;
  }
  // FPS kurz messen (2 s, nur Tablet, nur automatisch, einmal pro Sitzung)
  let fpsRaf = 0;
  function measureFps() {
    if (perfPref() !== null || perfAuto !== null || !mqTab.matches || fpsRaf) return;
    if (navigator.deviceMemory && navigator.deviceMemory <= 2) return;
    host.querySelector('.z-stage')?.classList.remove('z-perf');   // volle Effekte probeweise
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

  // ---------------------------------------------------------------- Layout Handy/Tablet
  function applyLayout() {
    const tab = mqTab.matches;
    host.classList.toggle('z-tablet', tab);
    host.classList.toggle('z-phone', !tab);
    document.body.classList.toggle('zh-full', tab && active);
    if (!tab) $('saver')?.classList.remove('z-on');
    applyPerf();
    idle();
  }

  // ---------------------------------------------------------------- Ereignisse (einmal verdrahtet, nur an Elementen in Zuhause)
  function wire() {
    $('rail').addEventListener('click', e => {
      if (e.target.closest('[data-back]')) { UI.show('s-home'); return; }
      const n = e.target.closest('.z-nv[data-p]'); if (n) go(n.dataset.p);
    });
    host.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g && !g.closest('.z-rail')) go(g.dataset.go); });

    // Lampen: Tippen = an/aus, waagerecht wischen = Helligkeit (wie in der Vorlage)
    const P = $('pills');
    let sent = 0;
    P.addEventListener('pointerdown', e => {
      const t = e.target.closest('.z-pill'); if (!t) return;
      const l = cfg().lampen[t.dataset.k];
      dr = { t, x: e.clientX, y: e.clientY, m: false, l, id: e.pointerId };
      const my = dr;
      dr.lp = setTimeout(() => { if (dr === my && !my.m) { my.long = true; openLamp(l); } }, 520);
    });
    P.addEventListener('contextmenu', e => {
      const t = e.target.closest('.z-pill'); if (!t) return;
      e.preventDefault();
      if (dr) { clearTimeout(dr.lp); dr = null; }
      openLamp(cfg().lampen[t.dataset.k]);
    });
    P.addEventListener('pointermove', e => {
      if (!dr || e.pointerId !== dr.id) return;
      if (Math.abs(e.clientX - dr.x) > 10 || Math.abs(e.clientY - dr.y) > 10) clearTimeout(dr.lp);
      if (dr.long) return;
      if (!dr.m && Math.abs(e.clientX - dr.x) > 10 && Math.abs(e.clientX - dr.x) > Math.abs(e.clientY - dr.y)) { dr.m = true; try { dr.t.setPointerCapture(e.pointerId); } catch (_) {} }
      if (!dr.m) return;
      const r = dr.t.getBoundingClientRect();
      dr.b = Math.max(1, Math.min(100, Math.round((e.clientX - r.left) / r.width * 100)));
      dr.t.classList.add('z-on');
      dr.t.querySelector('.z-fill').style.width = dr.b + '%';
      dr.t.querySelector('.z-pct').textContent = dr.b + ' %';
      if (Date.now() - sent > 350) { sent = Date.now(); call({ entity_id: dr.l.entity_id, service: 'light.turn_on', data: { brightness_pct: dr.b, transition: 0.3 }, log: false }, true); }
    });
    const end = e => {
      if (!dr || (e && e.pointerId !== dr.id)) return;
      const d = dr; dr = null;
      clearTimeout(d.lp);
      if (d.long) { renderLamps(); return; }
      if (e?.type === 'pointercancel' && !d.m) { renderLamps(); return; }
      const v = lampView(d.l);
      sceneOv = null;
      if (d.m) { optimistic(d.l.entity_id, { on: true, b: d.b }); call({ entity_id: d.l.entity_id, service: 'light.turn_on', data: { brightness_pct: d.b, transition: 0.3 } }); }
      else { optimistic(d.l.entity_id, { on: !v.on }); call({ entity_id: d.l.entity_id, service: v.on ? 'light.turn_off' : 'light.turn_on', data: { transition: 0.5 } }); }
      renderLamps(); renderScenes();
    };
    P.addEventListener('pointerup', end);
    P.addEventListener('pointercancel', end);
    const all = on => () => {
      cfg().lampen.forEach(l => optimistic(l.entity_id, { on }));
      sceneOv = null; renderLamps(); renderScenes();
      call({ entity_id: '*lampen', service: on ? 'light.turn_on' : 'light.turn_off' });
    };
    $('allon').addEventListener('click', all(true));
    $('alloff').addEventListener('click', all(false));

    $('devs').addEventListener('click', e => {
      const t = e.target.closest('.z-dev'); if (!t) return;
      const g = cfg().geraete[t.dataset.k], on = !(ov[g.entity_id]?.on ?? ent(g.entity_id)?.state === 'on');
      optimistic(g.entity_id, { on }); renderDevs();
      call({ entity_id: g.entity_id, service: g.entity_id.split('.')[0] + (on ? '.turn_on' : '.turn_off') });
    });
    $('routines').addEventListener('click', e => {
      const s = e.target.closest('.z-sw'); if (!s) return;
      const r = cfg().routinen[s.closest('.z-rt').dataset.k], on = !s.classList.contains('z-on');
      optimistic(r.entity_id, { on }); renderRoutines();
      call({ entity_id: r.entity_id, service: on ? 'automation.turn_on' : 'automation.turn_off' });
    });

    // Fernseher
    // bei "Bild aus" (Ton läuft) heißt Ausschalten: Musik anhalten und schlafen
    const bildAusNow = () => !!S.tvx?.bild_aus && !tvView()?.on;
    $('pwr').addEventListener('click', () => tvPower(bildAusNow() ? false : !tvView()?.on));
    $('offmsg').addEventListener('click', () => (bildAusNow() ? $('bildaus').click() : tvPower(true)));
    $('tvc-p').addEventListener('click', () => tvPower(!tvView()?.on));
    $('tvc').addEventListener('click', e => { if (!e.target.closest('.z-mb')) go('tv'); });
    $('tvc-u').addEventListener('click', () => volStep(1));
    $('tvc-d').addEventListener('click', () => volStep(-1));
    $('vu').addEventListener('click', () => volStep(1));
    $('vd').addEventListener('click', () => volStep(-1));
    const vb = $('vbar');
    let vdr = false;
    const vset = (e, fin) => { const r = vb.getBoundingClientRect(); setVol((e.clientX - r.left) / r.width * (tvView()?.max || 50), fin); };
    vb.addEventListener('pointerdown', e => { vdr = true; vb.setPointerCapture(e.pointerId); vset(e); });
    vb.addEventListener('pointermove', e => { if (vdr) vset(e); });
    vb.addEventListener('pointerup', e => { if (vdr) { vdr = false; vset(e, true); } });
    $('mute').addEventListener('click', () => {
      const v = tvView(); if (!v) return;
      optimistic(v.tv.entity_id, { muted: !v.muted }); renderTV();
      call({ entity_id: v.tv.entity_id, service: 'media_player.volume_mute', data: { is_volume_muted: !v.muted } });
    });
    $('pp').addEventListener('click', () => {
      const v = tvView(); if (!v) return;
      optimistic(v.tv.entity_id, { playing: !v.playing }); renderTV();
      call({ entity_id: v.tv.entity_id, service: 'media_player.media_play_pause' });
    });
    const ctrl = qa('.z-ctrl > div', $('p-tv'));
    ctrl[0].addEventListener('click', () => { const v = tvView(); if (v) call({ entity_id: v.tv.entity_id, service: 'media_player.media_previous_track' }); });
    ctrl[2].addEventListener('click', () => { const v = tvView(); if (v) call({ entity_id: v.tv.entity_id, service: 'media_player.media_next_track' }); });
    $('apps').addEventListener('click', e => {
      const t = e.target.closest('.z-ap'); if (!t) return;
      const v = tvView(), app = v.tv.apps[t.dataset.k], was = v.on;
      // Fernseher aus: wir-home weckt ihn erst (bis 25 s) und öffnet die App danach
      if (was) optimistic(v.tv.entity_id, { on: true, playing: true, app: app.name }); else { tvStarting(); optimistic(v.tv.entity_id, { app: app.name }); }
      renderTV();
      toast((was ? '' : `${v.tv.name} wird gestartet · `) + app.name + (was ? ' wird geöffnet' : ' folgt'));
      call({ entity_id: v.tv.entity_id, service: 'tv.app', data: { app: app.name } }).then(ok => {
        // läuft die App nach 12 s (nach dem Wecken 40 s) nicht, ist sie vermutlich nicht installiert (der Fernseher zeigt dann nur die Linkauswahl)
        if (ok && app.paket) setTimeout(() => { const n = tvView(); if (active && n?.on && n.app.name !== app.name && !n.s?.a?.app_id?.startsWith(app.paket)) toast(app.name + ' nicht gestartet – auf dem Fernseher installiert?'); }, was ? 12000 : 40000);
      });
    });
    $('srcs').addEventListener('click', e => {
      const t = e.target.closest('.z-src'); if (!t) return;
      const v = tvView(), q = srcList(v.tv)[t.dataset.k]; if (!q) return;
      if (q.x) {   // vom Fernseher gelesene Eingänge (per ADB)
        eingangSel = q.x; renderTV();
        call({ entity_id: v.tv.entity_id, service: 'tv.eingang', data: { eingang: q.x } });
        return;
      }
      optimistic(v.tv.entity_id, { source: q.source }); renderTV();
      call({ entity_id: v.tv.entity_id, service: 'media_player.select_source', data: { source: q.source } });
    });
    // weitere Apps vom Fernseher
    $('more').addEventListener('click', e => {
      const t = e.target.closest('.z-ma'); if (!t) return;
      const v = tvView(), x = S.tvx?.apps?.[t.dataset.k]; if (!v || !x) return;
      if (!v.on) tvStarting();
      renderTV();
      toast((v.on ? '' : `${v.tv.name} wird gestartet · `) + x.name + (v.on ? ' wird geöffnet' : ' folgt'));
      call({ entity_id: v.tv.entity_id, service: 'tv.starten', data: { paket: x.paket } });
    });
    // Bild aus / an (Ton läuft weiter), Bildschirmfoto
    $('bildaus').addEventListener('click', () => {
      const v = tvView(); if (!v) return;
      const aus = !(S.tvx?.bild_aus && !v.on);
      toast(aus ? 'Bild aus – der Ton läuft weiter' : 'Bild wird eingeschaltet …');
      if (!aus) tvStarting();
      call({ entity_id: v.tv.entity_id, service: 'tv.bild', data: { aus } });
    });
    $('shotbtn').addEventListener('click', takeShot);
    $('shotnew').addEventListener('click', takeShot);
    $('shotclose').addEventListener('click', () => { shotOpen = false; renderShot(); });
    // Bildhelligkeit: Balken ziehen/tippen, − / +
    const hb = $('hbar');
    let hdr = false;
    const hset = e => { const r = hb.getBoundingClientRect(); setHell((e.clientX - r.left) / r.width * 100); };
    hb.addEventListener('pointerdown', e => { hdr = true; hb.setPointerCapture(e.pointerId); hset(e); });
    hb.addEventListener('pointermove', e => { if (hdr) hset(e); });
    hb.addEventListener('pointerup', e => { if (hdr) { hdr = false; hset(e); } });
    const hcur = () => (Number.isFinite(hellOv) ? hellOv : S.tvx?.helligkeit ?? 50);
    $('hd').addEventListener('click', () => setHell(hcur() - 10));
    $('hu').addEventListener('click', () => setHell(hcur() + 10));
    // Text an den Fernseher: Senden-Knopf bzw. Enter auf der Tastatur = Text + Bestätigen; ⌫ löscht ein Zeichen
    $('tvsend').addEventListener('click', () => sendText(true));
    $('tvtext').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sendText(true); } });
    $('tvdel').addEventListener('click', () => { const v = tvView(); if (v) call({ entity_id: v.tv.entity_id, service: 'tv.text', data: { loeschen: 1 } }, true); });
    const KEYS = { 'z-u': 'DPAD_UP', 'z-dn': 'DPAD_DOWN', 'z-l': 'DPAD_LEFT', 'z-r': 'DPAD_RIGHT', 'z-ok': 'DPAD_CENTER' };
    const KEYS2 = { undo: 'BACK', home: 'HOME', menu: 'MENU', mic: 'SEARCH' };
    qa('.z-dpad .z-a, .z-dpad .z-ok, .z-keys > div', $('p-tv')).forEach(b => b.addEventListener('click', () => {
      b.animate([{ transform: 'scale(.9)' }, { transform: 'scale(1)' }], { duration: 160 });
      const cls = [...b.classList].find(c => KEYS[c]);
      const command = cls ? KEYS[cls] : KEYS2[b.dataset.i];
      const tv = cfg()?.fernseher;
      if (command && tv?.remote) call({ entity_id: tv.remote, service: 'remote.send_command', data: { command } }, true);
    }));

    // Szenen (schalten serverseitig mehrere Geräte, z. B. Filmabend: Licht dimmen + Netflix)
    $('scenes').addEventListener('click', e => {
      const t = e.target.closest('.z-sc'); if (!t) return;
      const s = cfg().szenen.find(x => x.key === t.dataset.k);
      sceneOv = s.key; renderScenes();
      toast('Szene „' + s.name + '“ aktiviert');
      call({ scene: s.key }).then(ok => { if (!ok) { sceneOv = null; renderScenes(); } });
    });

    // Kalender
    $('grid').addEventListener('click', e => {
      const t = e.target.closest('.z-day'); if (!t) return;
      const [y, m, d] = t.dataset.d.split('-').map(Number);
      sel = new Date(y, m - 1, d); if (m - 1 !== view.getMonth()) view = new Date(y, m - 1, 1);
      renderMonth(); renderAgenda();
    });
    $('cprev').addEventListener('click', () => { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); renderMonth(); });
    $('cnext').addEventListener('click', () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); renderMonth(); });
    $('ctoday').addEventListener('click', () => { view = new Date(today().getFullYear(), today().getMonth(), 1); sel = today(); renderMonth(); renderAgenda(); });

    // To-dos: Tippen = abhaken, Kreis D/I/W = Zuordnung wechseln, nach links wischen = löschen
    $('lists').addEventListener('click', e => {
      const t = e.target.closest('#zh-lists > div'); if (!t) return;
      curL = LISTS[t.textContent] || 'gemeinsam';
      qa('#zh-lists > div').forEach(x => x.classList.toggle('z-on', x === t));
      renderTodos();
    });
    const inp = $('newtd');
    const addT = () => {
      const text = inp.value.trim(); if (!text) return;
      inp.value = '';
      T.todos.add({ list: curL, text, who: 'g' }).catch(() => toast('Speichern fehlgeschlagen'));
    };
    $('addbtn').addEventListener('click', addT);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') addT(); });
    const TD = $('todos');
    let sw = null;
    TD.addEventListener('pointerdown', e => { const t = e.target.closest('.z-td'); if (t) sw = { t, x: e.clientX, y: e.clientY, dx: 0, id: e.pointerId }; });
    TD.addEventListener('pointermove', e => {
      if (!sw || e.pointerId !== sw.id) return;
      sw.dx = Math.min(0, e.clientX - sw.x);
      if (Math.abs(sw.dx) > 12 && Math.abs(sw.dx) > Math.abs(e.clientY - sw.y)) {
        if (!sw.moved) { try { sw.t.setPointerCapture(e.pointerId); } catch (_) {} }
        sw.moved = true; sw.t.style.transform = `translateX(${sw.dx}px)`; sw.t.style.opacity = 1 + sw.dx / 240;
      }
    });
    const swEnd = e => {
      if (!sw || e.pointerId !== sw.id) return;
      const s = sw; sw = null;
      const id = s.t.dataset.id;
      if (s.moved) {
        if (s.dx < -90) {
          todoOv[id] = { gone: true }; renderTodos();
          T.todos.remove(id).catch(() => { delete todoOv[id]; renderTodos(); toast('Löschen fehlgeschlagen'); });
        } else { s.t.style.transform = ''; s.t.style.opacity = ''; }
        return;
      }
      if (e.type === 'pointercancel' || !id) return;
      const x = todoList(curL).find(t => t.id === id); if (!x) return;
      if (e.target.closest('.z-who')) {
        const who = { g: 'd', d: 'i', i: 'g' }[x.who] || 'g';
        todoOv[id] = { ...(todoOv[id] || {}), who }; renderTodos();
        T.todos.update(id, { who }).catch(() => toast('Speichern fehlgeschlagen'));
      } else {
        todoOv[id] = { ...(todoOv[id] || {}), done: !x.done }; renderTodos();
        T.todos.update(id, { done: !x.done }).catch(() => toast('Speichern fehlgeschlagen'));
      }
    };
    TD.addEventListener('pointerup', swEnd);
    TD.addEventListener('pointercancel', swEnd);

    // Wecker: Zeit antippen = ändern, Schalter/Tage antippen, nach links wischen = löschen
    const AL = qa('.z-alist', $('p-alarm'))[0];
    const tp = $('timepick');
    let tpFor = null, asw = null, alSwiped = false;
    AL.addEventListener('click', e => {
      if (alSwiped) { alSwiped = false; return; }
      const card = e.target.closest('.z-al'), id = card?.dataset.id;
      if (e.target.closest('.z-addal')) {
        saveAlarm(w => w.alarms.push({ id: 'a' + Date.now().toString(36), zeit: '7:00', bis: '', alle: 0, tage: [0, 1, 2, 3, 4], an: true, titel: 'Wecker', ton: true }));
        return;
      }
      if (!card) return;
      if (e.target.closest('.z-sw')) { saveAlarm(w => { const a = w.alarms.find(x => x.id === id); a.an = !a.an; }); return; }
      const d = e.target.closest('[data-day]');
      if (d) { saveAlarm(w => { const a = w.alarms.find(x => x.id === id), n = +d.dataset.day; a.tage = a.tage.includes(n) ? a.tage.filter(x => x !== n) : [...a.tage, n].sort(); }); return; }
      if (e.target.closest('[data-time]')) {
        tpFor = id;
        tp.value = W().alarms.find(x => x.id === id).zeit.padStart(5, '0');
        try { tp.showPicker(); } catch (_) { tp.focus(); tp.click(); }
      }
    });
    tp.addEventListener('change', () => {
      if (!tpFor || !tp.value) return;
      const [h, m] = tp.value.split(':').map(Number), id = tpFor;
      saveAlarm(w => {
        const a = w.alarms.find(x => x.id === id); if (!a) return;
        const span = a.bis ? toMin(a.bis) - toMin(a.zeit) : 0;
        a.zeit = `${h}:${pad(m)}`;
        if (a.bis) a.bis = fmtMin(h * 60 + m + span);
      });
    });
    AL.addEventListener('pointerdown', e => { const c = e.target.closest('.z-al'); if (c && !e.target.closest('.z-sw,[data-day]')) asw = { c, x: e.clientX, y: e.clientY, dx: 0, id: e.pointerId }; });
    AL.addEventListener('pointermove', e => {
      if (!asw || e.pointerId !== asw.id) return;
      asw.dx = Math.min(0, e.clientX - asw.x);
      if (Math.abs(asw.dx) > 14 && Math.abs(asw.dx) > Math.abs(e.clientY - asw.y)) {
        if (!asw.moved) { try { asw.c.setPointerCapture(e.pointerId); } catch (_) {} }
        asw.moved = true; asw.c.style.transform = `translateX(${asw.dx}px)`;
      }
    });
    const aEnd = e => {
      if (!asw || e.pointerId !== asw.id) return;
      const s = asw; asw = null;
      if (!s.moved) return;
      alSwiped = true; setTimeout(() => { alSwiped = false; }, 50);
      if (s.dx < -110) { saveAlarm(w => { w.alarms = w.alarms.filter(x => x.id !== s.c.dataset.id); }); toast('Wecker gelöscht'); }
      else s.c.style.transform = '';
    };
    AL.addEventListener('pointerup', aEnd);
    AL.addEventListener('pointercancel', aEnd);
    $('vor').addEventListener('input', () => { $('vl').textContent = $('vor').value + ' Min'; });
    $('vor').addEventListener('change', () => saveAlarm(w => { w.vorlauf = +$('vor').value; }));
    $('tone').addEventListener('click', e => { const t = e.target.closest('#zh-tone > div'); if (t) saveAlarm(w => { w.ton = t.textContent; }); });
    // Fernseher beim Wecken: an/aus, App, Lautstärke
    const wtv = patch => saveAlarm(w => { w.tv = { an: false, app: cfg()?.fernseher?.apps?.[0]?.name || '', lautstaerke: 15, ...(w.tv || {}), ...patch }; });
    $('wtvsw').addEventListener('click', () => wtv({ an: !W().tv?.an }));
    $('wtvapps').addEventListener('click', e => { const t = e.target.closest('#zh-wtvapps > div'); if (t) wtv({ app: t.textContent, an: true }); });
    $('wtvvol').addEventListener('input', () => { $('wtvvl').textContent = $('wtvvol').value; });
    $('wtvvol').addEventListener('change', () => wtv({ lautstaerke: +$('wtvvol').value }));
    // Kino-Licht (gemeinsame Einstellung "fernseher")
    $('kino').addEventListener('click', () => {
      const f = { ...(S.settings.fernseher || {}) };
      f.kinolicht = !f.kinolicht;
      S.settings.fernseher = f;
      renderStatus();
      toast(f.kinolicht ? 'Kino-Licht an – das Licht dimmt, sobald etwas läuft' : 'Kino-Licht aus');
      T.settings.save('fernseher', f).catch(() => toast('Speichern fehlgeschlagen'));
    });
    $('skip').addEventListener('click', () => {
      const tm = new Date(); tm.setDate(tm.getDate() + 1);
      saveAlarm(w => { w.aussetzen = w.aussetzen === iso(tm) ? '' : iso(tm); });
    });
    $('testring').addEventListener('click', () => {
      openRing();
      call({ entity_id: '', service: 'wecker.test' }).then(ok => { if (ok) toast('Test-Sonnenaufgang läuft · 1 Min'); });
    });
    $('snooze').addEventListener('click', () => { sn++; alarmAt = new Date(alarmAt.getTime() + 6e5); $('rclock').textContent = fmt(alarmAt); rupd(); });
    const stp = $('stop'), sf = $('sfill');
    stp.addEventListener('pointerdown', e => {
      stp.setPointerCapture(e.pointerId); pr = 0; clearInterval(holdT);
      holdT = setInterval(() => {
        pr += 4; sf.style.width = pr + '%';
        if (pr >= 100) { clearInterval(holdT); $('ring').classList.add('z-calm'); sf.style.width = '0'; $('ringtxt').textContent = 'Wecker aus · ' + (sn ? sn + '× geschlummert' : 'direkt aufgestanden'); }
      }, 40);
    });
    const cancel = () => { clearInterval(holdT); if (pr < 100) { pr = 0; sf.style.width = '0'; } };
    stp.addEventListener('pointerup', cancel); stp.addEventListener('pointerleave', cancel);
    $('todash').addEventListener('click', () => { closeRing(); go('start'); });

    // Einstellungen in Zuhause
    $('perf').addEventListener('click', () => {
      const on = !$('perf').classList.contains('z-on');
      try { localStorage.setItem('wir-perf', on ? '1' : '0'); } catch (_) {}
      applyPerf(); toast(on ? 'Leistungsmodus an' : 'Leistungsmodus aus');
    });
    $('night').addEventListener('click', () => {
      local.night = !local.night; $('night').classList.toggle('z-on', local.night);
      try { localStorage.setItem('zh-night', local.night ? '1' : '0'); } catch (_) {}
      tick();
    });
    $('night').classList.toggle('z-on', local.night);
    qa('#zh-saverseg > div').forEach(x => x.classList.toggle('z-on', parseInt(x.textContent) === local.saverMin));
    $('saverseg').addEventListener('click', e => {
      const t = e.target.closest('#zh-saverseg > div'); if (!t) return;
      qa('#zh-saverseg > div').forEach(x => x.classList.toggle('z-on', x === t));
      local.saverMin = parseInt(t.textContent);
      try { localStorage.setItem('zh-saver', local.saverMin); } catch (_) {}
      idle();
    });
    $('savertest').addEventListener('click', e => { e.stopPropagation(); $('saver').classList.add('z-on'); });
    $('saver').addEventListener('click', e => { e.stopPropagation(); $('saver').classList.remove('z-on'); idle(); });
    host.addEventListener('pointerdown', idle);
    host.addEventListener('keydown', idle);
  }

  // ---------------------------------------------------------------- Status (Testmodus / verbunden)
  function renderStatus() {
    const m = S.meta, stale = !m || Date.now() - (m.beat || 0) > 95000;
    const bad = stale || (m.mode !== 'test' && !m.connected);
    const txt = stale ? 'offline' : m.mode === 'test' ? 'Testmodus' : m.connected ? 'HA verbunden' : 'HA getrennt';
    qa('.z-devhd .z-state').forEach(x => { x.textContent = txt; x.classList.toggle('z-off', bad); });
    const live = qa('.z-live')[0]; if (live) { live.title = txt; live.classList.toggle('z-off', bad); }
    const rows = qa('#zh-p-set .z-srow');
    if (rows[4]) {
      rows[4].querySelector('small').textContent = stale ? 'Dienst nicht erreichbar' : m.mode === 'test' ? 'Testmodus · simulierte Daten' : (m.connected ? 'echte Daten' : 'getrennt' + (m.error ? ': ' + m.error : '') + ' · verbindet neu …');
      rows[4].querySelector('.z-state').textContent = stale ? 'offline' : m.mode === 'test' ? 'bereit' : m.connected ? 'verbunden' : 'getrennt';
      rows[4].querySelector('.z-state').classList.toggle('z-off', bad);
    }
    if (rows[5]) rows[5].querySelector('small').textContent = 'angemeldet als ' + (window.WIR_LOOK?.me?.()?.name || '…');
    // Kino-Licht nur mit echtem Fernseher (ADB)
    $('kinorow').hidden = !cfg()?.fernseher?.titel || m?.mode === 'test';
    $('kino').classList.toggle('z-on', !!S.settings.fernseher?.kinolicht);
    const info = qa('#zh-p-set .z-info')[0];
    if (info) info.firstChild.textContent = m?.mode === 'test' || !m ? 'Testmodus · alle Werte sind Beispiele.' : S.kalender?.test ? 'Home Assistant · Kalender noch mit Testterminen.' : 'Verbunden mit Home Assistant.';
  }

  // ---------------------------------------------------------------- Zeichnen
  function kalFarben() {
    const F = S.kalender?.farben || cfg()?.kalender?.farben || {};
    for (const w of ['d', 'i', 'g']) { if (F[w]) host.style.setProperty('--z-' + w, F[w]); else host.style.removeProperty('--z-' + w); }
  }
  function render() {
    if (!built || !cfg()) return;
    kalFarben(); renderLp();
    renderLamps(); renderDevs(); renderRoutines(); renderTV(); renderScenes(); renderFacts(); renderChips();
    renderMonth(); renderAgenda(); renderTodos(); renderAlarm(); renderStatus();
  }
  // Realtime-Änderung: optimistische Werte verwerfen, sobald das Gerät selbst etwas meldet
  const prev = {};
  function onChange() {
    for (const [id, s] of Object.entries(S.entities)) {
      const sig = s.state + '|' + JSON.stringify(s.a);
      if (prev[id] !== undefined && prev[id] !== sig && ov[id] && !(dr && dr.l.entity_id === id)) delete ov[id];
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
  function activate() {
    if (active) return;
    active = true;
    build();
    host.classList.remove('z-sleep');
    applyLayout();
    tick(); render();
    T.start(onChange).catch(err => { console.error('Zuhause', err); toast('Zuhause ist gerade nicht erreichbar'); });
    tickT = setInterval(tick, 10000);
    // Position jede Sekunde (nur der Text), der Rest alle 5 s
    let progN = 0;
    progT = setInterval(() => {
      if (page !== 'tv') return;
      const v = tvView();
      if (!v?.playing) return;
      if (++progN % 5 === 0) renderTV(); else renderProg(v);
    }, 1000);
    idle();
    measureFps();
  }
  function deactivate() {
    if (!active) return;
    active = false;
    T.stop();
    clearInterval(tickT); clearInterval(progT); clearTimeout(idleT); clearTimeout(toastT); clearTimeout(volTimer);
    watchAt = 0;
    if (fpsRaf) { cancelAnimationFrame(fpsRaf); fpsRaf = 0; }
    closeRing(); closeLamp(); clearTimeout(tvHintT);
    $('saver')?.classList.remove('z-on');
    host.classList.add('z-sleep');           // nichts mehr zeichnen (auch keine Animationen), solange unsichtbar
    document.body.classList.remove('zh-full');
  }
  const visible = () => !!document.getElementById('s-zuhause')?.classList.contains('active') && !document.hidden && !!window.WIR_PB?.authStore?.isValid;
  const sync = () => (visible() ? activate() : deactivate());
  document.addEventListener('wir:show', sync);
  document.addEventListener('visibilitychange', sync);
  mqTab.addEventListener('change', () => { if (built) applyLayout(); });
  host.classList.add('z-sleep');

  // Leistungsmodus gilt für die ganze App (Schalter auch in den Einstellungen der Wir-App, gleiche Speicherung)
  applyPerf();
  const perfSw = document.getElementById('perfSwitch');
  if (perfSw) {
    perfSw.checked = perfOn();
    perfSw.addEventListener('change', () => {
      try { localStorage.setItem('wir-perf', perfSw.checked ? '1' : '0'); } catch (_) {}
      applyPerf();
    });
  }
})();
