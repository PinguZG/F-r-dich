// Zuhause (04.11.2026): Smart-Home-Dashboard. Daten kommen nur über window.ZuhauseData (zuhause-data.js),
// nie direkt von Home Assistant. Ein DOM für beide Layouts (zuhause.css schaltet bei 900 px um).
// Bedienung Lampen: Tippen = an/aus, senkrecht wischen = Helligkeit, lange drücken (oder Rechtsklick) = Sheet/Panel.
(() => {
  const $ = id => document.getElementById(id);
  const root = $('zh');
  if (!root || !window.ZuhauseData) return;

  // ---------------------------------------------------------------- Symbole
  const P = {
    home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5"/>',
    flame: '<path d="M12 2c3 4 6 6 6 11a6 6 0 0 1-12 0c0-3 1.5-4.5 3-6 0 2.5 1.5 4 3 4 0-4-1.5-6.5 0-9z"/>',
    power: '<path d="M12 3v9M6.3 6.3a8 8 0 1 0 11.4 0"/>',
    heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
    thermo: '<path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z"/>',
    drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    cloudsun: '<path d="M8 3v1M3.5 5.5l.7.7M2 10h1M12.5 5.5l-.7.7M5.5 10a3 3 0 0 1 5.6-1.5"/><path d="M7 20h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.2 13 3.5 3.5 0 0 0 7 20z"/>',
    cloudmoon: '<path d="M10.5 3.5A4.5 4.5 0 0 0 4 9a4.4 4.4 0 0 0 .4 1.4"/><path d="M7 20h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.2 13 3.5 3.5 0 0 0 7 20z"/>',
    cloud: '<path d="M7 19h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.2 12 3.5 3.5 0 0 0 7 19z"/>',
    rain: '<path d="M7 15h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.2 8 3.5 3.5 0 0 0 7 15zM8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
    snow: '<path d="M7 15h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.2 8 3.5 3.5 0 0 0 7 15z"/><path d="M8 19h.01M12 19h.01M16 19h.01M10 22h.01M14 22h.01"/>',
    fog: '<path d="M7 13h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.2 6 3.5 3.5 0 0 0 7 13zM4 17h16M6 21h12"/>',
    storm: '<path d="M7 15h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.2 8 3.5 3.5 0 0 0 7 15zM13 15l-2 4h3l-2 4"/>',
    sunrise: '<path d="M12 3v4M5 10l1.5 1.5M19 10l-1.5 1.5M3 17h18M7 17a5 5 0 0 1 10 0M8 21h8"/>',
    pin: '<path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    wind: '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    window: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M12 3v18M4 12h16"/>',
    door: '<path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M3 21h18"/><circle cx="14.5" cy="12" r=".8"/>',
    motion: '<circle cx="13" cy="4" r="2"/><path d="M8 21l3-6 3 2v4M7 12l3-4 4 1 3 3M11 15l-1-4"/>',
    battery: '<rect x="3" y="7" width="16" height="10" rx="2"/><path d="M22 11v2M6 10v4M9 10v4M12 10v4"/>',
    coffee: '<path d="M4 8h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM16 10h2a2 2 0 0 1 0 4h-2M8 3v2M12 3v2"/>',
    fan: '<circle cx="12" cy="12" r="2"/><path d="M12 10c0-4 1-7 4-7 2 0 3 2 1 4l-3 3M14 12c4 0 7 1 7 4 0 2-2 3-4 1l-3-3M12 14c0 4-1 7-4 7-2 0-3-2-1-4l3-3M10 12c-4 0-7-1-7-4 0-2 2-3 4-1l3 3"/>',
    stars: '<path d="M5 3v4M3 5h4M17 15v4M15 17h4M12 6l1.5 4.5L18 12l-4.5 1.5L12 18l-1.5-4.5L6 12l4.5-1.5z"/>',
    tv: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/>',
    plug: '<path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0zM12 17v5"/>',
    leaf: '<path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15M5 19l7-7"/>',
    music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    sofa: '<path d="M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3M2 13a2 2 0 0 1 4 0v2h12v-2a2 2 0 0 1 4 0v5H2zM5 18v2M19 18v2"/>',
    bed: '<path d="M3 18V6M3 14h18v4M21 14v-3a3 3 0 0 0-3-3h-7v6M7 11.5a1.5 1.5 0 1 0 0-.01"/>',
    play: '<path d="M7 4v16l13-8z"/>',
    pause: '<path d="M8 4v16M16 4v16"/>',
    playpause: '<path d="M4 5v14l9-7zM15 5v14M20 5v14"/>',
    vol: '<path d="M4 9h4l5-4v14l-5-4H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
  };
  const ic = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || P.spark}</svg>`;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------------------------------------------------------------- Farben
  const hex = rgb => '#' + rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const rgbOf = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  function kelvinRgb(k) {
    const t = k / 100;
    const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
    const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
    return [r, g, b];
  }
  const COLORS = ['#ffb38a', '#ffe1c9', '#ff5fa8', '#ff8a7a', '#c49bff', '#7b8cff', '#7fd6ff', '#8ef0c0'];
  // Szenen ohne eigene Farben: Verläufe aus den Variablen der Farbwelt
  const SC_PAIRS = [['--accent', '--accent2'], ['--accent2', '--accent3'], ['--accent4', '--accent'], ['--accent3', '--accent2'], ['--accent', '--accent4']];

  // ---------------------------------------------------------------- Zustand
  const T = window.ZuhauseData.create(window.ZH_TRANSPORT || 'wir');
  const S = T.state;
  let cfgSig = '';
  const ov = {};          // optimistische Anzeige pro entity_id bis zur Antwort aus Realtime { on, bri, color, t }
  let sceneOv = null;     // gerade getippte Szene
  let started = false;

  const ent = id => S.entities[id] || null;
  const isOn = s => !!s && ['on', 'playing', 'paused', 'idle', 'buffering'].includes(s.state);
  function lampView(l) {
    const s = ent(l.entity_id), o = ov[l.entity_id];
    const na = !s || s.state === 'unavailable' || s.state === 'unknown';
    let on = isOn(s), bri = s?.a?.brightness != null ? Math.max(1, Math.round(s.a.brightness / 2.55)) : (on ? 100 : 50);
    let color = l.farbe;
    const a = s?.a || {};
    if (a.color_mode === 'color_temp' && a.color_temp_kelvin) color = hex(kelvinRgb(a.color_temp_kelvin));
    else if (Array.isArray(a.rgb_color) && a.color_mode !== 'onoff' && a.color_mode !== 'brightness') color = hex(a.rgb_color);
    if (o) { if (o.on != null) on = o.on; if (o.bri != null) bri = o.bri; if (o.color) color = o.color; }
    return { on, bri, color, na, busy: !!o };
  }

  // ---------------------------------------------------------------- Hilfen
  const pad = n => String(n).padStart(2, '0');
  const fmtNum = (v, d = 1) => (Number.isFinite(v) ? v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }) : '–');
  function ago(iso) {
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return '';
    const s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return 'gerade eben';
    if (s < 3600) return `vor ${Math.round(s / 60)} Min`;
    if (s < 86400) return `vor ${Math.round(s / 3600)} Std`;
    const d = new Date(t);
    return d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' }) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function dur(iso) {
    const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
    return m < 60 ? `${m} Min` : `${Math.floor(m / 60)} Std`;
  }
  let toastTimer = 0;
  function toast(msg) {
    let t = $('zhToast');
    if (!t) { t = document.createElement('div'); t.id = 'zhToast'; t.className = 'zh-toast'; t.setAttribute('role', 'status'); document.body.append(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
  }

  async function call(cmd, el) {
    try { await T.call(cmd); return true; }
    catch (err) {
      toast(err.message || 'Hat nicht geklappt');
      if (el) UI.shake(el);
      return false;
    }
  }
  // Lampen-Befehl mit optimistischer Anzeige
  async function lampCmd(l, cmd, view, el) {
    ov[l.entity_id] = { ...view, t: Date.now() };
    renderLamps();
    const ok = await call({ entity_id: l.entity_id, ...cmd }, el);
    // Antwort kommt per Realtime; nach Fehler oder ohne Änderung nach 4 s wieder den echten Zustand zeigen
    if (!ok) delete ov[l.entity_id];
    else setTimeout(() => { if (ov[l.entity_id] && Date.now() - ov[l.entity_id].t >= 3900) { delete ov[l.entity_id]; renderLamps(); } }, 4000);
    renderLamps();
  }

  // ---------------------------------------------------------------- Aufbau (nur wenn sich die Konfiguration ändert)
  function build() {
    const c = S.config;
    const sig = JSON.stringify(c);
    if (sig === cfgSig) return;
    cfgSig = sig;
    if (!c) { root.innerHTML = '<div class="zh-card zh-empty">Zuhause wird geladen …</div>'; return; }
    const L = c.lampen, K = c.klima;
    const scene = (s, i) => {
      const [a, b] = s.farben?.length ? [s.farben[0], s.farben[1] || s.farben[0]]
        : s.aktion === 'alle_aus' ? ['var(--ink-faint)', 'var(--ink-soft)'] : SC_PAIRS[i % SC_PAIRS.length].map(v => `var(${v})`);
      return `<button class="zh-sc" type="button" data-sc="${esc(s.key)}" style="--a:${a};--b:${b}">${ic(s.icon)}<span>${esc(s.name)}</span></button>`;
    };
    const kl = K.weitere.length
      ? `<div class="zh-klgrid">
          ${K.temperatur ? `<div class="zh-kv"><div class="l">${ic('thermo')}Temperatur</div><div class="n" data-v="t">–</div><svg class="zh-spark" data-sp="t" viewBox="0 0 140 26" preserveAspectRatio="none"></svg></div>` : ''}
          ${K.luftfeuchte ? `<div class="zh-kv"><div class="l">${ic('drop')}Luftfeuchte</div><div class="n" data-v="h">–</div><svg class="zh-spark h" data-sp="h" viewBox="0 0 140 26" preserveAspectRatio="none"></svg></div>` : ''}
          ${K.weitere.map((w, i) => `<div class="zh-kv"><div class="l">${ic(w.icon)}${esc(w.name)}</div><div class="n" data-v="x${i}">–</div>${w.max ? `<div class="zh-bar"><i data-bar="x${i}"></i></div>` : ''}</div>`).join('')}
        </div>`
      : `<div class="zh-klrow"><div><div class="zh-big" data-v="t">–</div><div class="zh-s" data-v="h"></div></div><svg class="zh-spark" data-sp="t" viewBox="0 0 140 40" preserveAspectRatio="none"></svg></div>`;

    root.innerHTML = `
      <header class="zh-head">
        <div><div class="zh-hello" data-v="hello"></div><div class="zh-clock" data-v="clock"></div>
          <div class="zh-sub"><span data-v="date"></span><span class="zh-chip">${ic('heart')}<span data-v="chip"></span></span></div></div>
        <button class="zh-status" type="button" data-status></button>
      </header>
      <div class="zh-top"><button class="zh-status" type="button" data-status></button></div>
      <section class="zh-lights"${L.length ? '' : ' hidden'}>
        <div class="zh-sec"><h2>${ic('bulb')}Licht</h2><div class="zh-mini">
          <button type="button" data-all="on">${ic('bulb')}Alle an</button><button type="button" data-all="off">${ic('power')}Alle aus</button></div></div>
        <div class="zh-orbs" style="--n:${Math.min(L.length, 4)}">${L.map((l, i) => `
          <div class="zh-orb" data-lamp="${i}" role="button" tabindex="0" aria-label="${esc(l.name)}">
            <div class="zh-ring"><svg class="arc" viewBox="0 0 200 200"><circle class="tr" cx="100" cy="100" r="92"/><circle class="v" cx="100" cy="100" r="92"/></svg>
              <div class="zh-core">${ic('bulb')}</div></div>
            <h3>${esc(l.name)}</h3><p></p></div>`).join('')}</div>
        <div class="zh-hint">Tippen = an/aus · hoch/runter wischen = Helligkeit · gedrückt halten = Farbe</div>
      </section>
      <section class="zh-tvs"${c.tv?.length ? '' : ' hidden'}>${(c.tv || []).map((t, i) => `
        <div class="zh-card zh-tv" data-tv="${i}" style="--c:${t.farbe}">
          <div class="zh-tv-row"><div class="zh-tv-ic">${ic('tv')}</div><div class="zh-tv-txt"><h4>${esc(t.name)}</h4><p data-tvs></p></div>
            <button class="zh-rbtn" type="button" data-tvpp aria-label="Play/Pause">${ic('playpause')}</button>
            <button class="zh-rbtn pw" type="button" data-tvpw aria-label="An/Aus">${ic('power')}</button></div>
          <div class="zh-vol">${ic('vol')}<input type="range" min="0" max="100" step="1" data-tvvol aria-label="Lautstärke"><b data-tvvl></b></div>
          ${t.apps.length ? `<div class="zh-apps">${t.apps.map(a => `<button class="zh-app" type="button" data-app="${esc(a)}">${esc(a)}</button>`).join('')}</div>` : ''}
        </div>`).join('')}</section>
      <section class="zh-devs"${c.schalter.length ? '' : ' hidden'}>${c.schalter.map((d, i) => `
        <button class="zh-dev" type="button" data-dev="${i}" style="--c:${d.farbe}"><div class="di">${ic(d.icon)}</div><div><h4>${esc(d.name)}</h4><p></p></div></button>`).join('')}</section>
      <section class="zh-scwrap"${c.szenen.length ? '' : ' hidden'}>
        <div class="zh-sec"><h2>${ic('spark')}Szenen</h2></div>
        <div class="zh-scenes">${c.szenen.map(scene).join('')}</div>
      </section>
      <aside class="zh-side">
        <div class="zh-card zh-wx"${c.wetter ? '' : ' hidden'}><div class="zh-ttl">${ic('pin')}<span>${esc(c.wetter?.ort || '')}</span></div>
          <div class="zh-wxr"><span data-v="wxic">${ic('cloud')}</span><div><div class="zh-big" data-v="wxt">–</div><div class="zh-s" data-v="wxs"></div></div></div>
          <div class="zh-hours" data-v="hours"></div></div>
        <div class="zh-card zh-kl${K.weitere.length ? ' wide' : ''}"${K.temperatur || K.luftfeuchte || K.weitere.length ? '' : ' hidden'}><div class="zh-ttl">${ic('thermo')}${esc(c.raum)}</div>${kl}</div>
        <div class="zh-card zh-hrs"${c.wetter ? '' : ' hidden'}><div class="zh-ttl">${ic('clock')}Nächste Stunden</div><div class="zh-hours" data-v="hours"></div></div>
        <div class="zh-card zh-sens"${c.sensoren.length ? '' : ' hidden'}><div class="zh-ttl">${ic('shield')}Sensoren</div><div class="zh-sens-g">${c.sensoren.map((s, i) => `
          <div class="zh-se" data-se="${i}"><div class="si">${ic({ fenster: 'window', tuer: 'door', bewegung: 'motion' }[s.art] || 'shield')}</div><div><h5>${esc(s.name)}</h5><p></p></div></div>`).join('')}</div></div>
        <div class="zh-card zh-rtc"${c.routinen.length ? '' : ' hidden'}><div class="zh-ttl">${ic('clock')}Routinen</div>${c.routinen.map((r, i) => `
          <div class="zh-rt" data-rt="${i}" role="button" tabindex="0"><div class="zh-ri">${ic(r.icon)}</div><div><h4>${esc(r.name)}</h4><p>${esc(r.info)}</p></div>
            <button class="zh-sw" type="button" data-rtsw="${i}" role="switch" aria-label="${esc(r.name)} aktiv"></button></div>`).join('')}</div>
      </aside>`;
  }

  // ---------------------------------------------------------------- Aktualisieren (ohne Neuaufbau)
  const q = (sel, all) => (all ? root.querySelectorAll(sel) : root.querySelector(sel));
  const ARC = 2 * Math.PI * 92 * 0.75, CIRC = 2 * Math.PI * 92;

  function renderLamps() {
    const c = S.config; if (!c) return;
    c.lampen.forEach((l, i) => {
      const el = q(`[data-lamp="${i}"]`); if (!el || el === drag?.el) return;
      paintLamp(el, lampView(l));
    });
  }
  function paintLamp(el, v) {
    el.classList.toggle('on', v.on);
    el.classList.toggle('na', v.na);
    el.classList.toggle('busy', v.busy);
    el.style.setProperty('--c', v.color);
    el.querySelector('.tr').setAttribute('stroke-dasharray', `${ARC} ${CIRC}`);
    el.querySelector('.v').setAttribute('stroke-dasharray', `${v.on ? ARC * v.bri / 100 : 0} ${CIRC}`);
    el.querySelector('p').textContent = v.na ? 'nicht erreichbar' : v.on ? v.bri + ' %' : 'Aus';
    el.setAttribute('aria-pressed', v.on);
  }

  function renderStatus() {
    const m = S.meta;
    const stale = !m || Date.now() - (m.beat || 0) > 95000;
    let cls = 'bad', txt = 'Offline';
    if (!stale && m.mode === 'test') { cls = 'test'; txt = 'Testmodus'; }
    else if (!stale && m.connected) { cls = 'ok'; txt = 'HA'; }
    else if (!stale) txt = 'Getrennt';
    q('[data-status]', true).forEach(b => { b.className = 'zh-status ' + cls; b.textContent = txt; b.title = m?.error || ''; });
  }

  function renderScenes() {
    const active = sceneOv || S.meta?.scene || '';
    q('[data-sc]', true).forEach(b => { b.classList.toggle('on', b.dataset.sc === active); b.setAttribute('aria-pressed', b.dataset.sc === active); });
  }

  function renderDevs() {
    (S.config?.schalter || []).forEach((d, i) => {
      const el = q(`[data-dev="${i}"]`); if (!el) return;
      const s = ent(d.entity_id), o = ov[d.entity_id];
      const on = o ? o.on : isOn(s);
      el.classList.toggle('on', on);
      el.setAttribute('aria-pressed', on);
      el.querySelector('p').textContent = !s || s.state === 'unavailable' ? 'nicht erreichbar' : on ? (s.a?.percentage ? s.a.percentage + ' %' : 'An') : 'Aus';
    });
  }

  function renderTv() {
    (S.config?.tv || []).forEach((t, i) => {
      const el = q(`[data-tv="${i}"]`); if (!el) return;
      const s = ent(t.entity_id), a = s?.a || {}, o = ov[t.entity_id] || {};
      const on = o.on != null ? o.on : isOn(s);
      el.classList.toggle('on', on);
      const what = [a.app_name || a.source, a.media_series_title || a.media_title].filter(Boolean).join(' · ');
      const st = !s || s.state === 'unavailable' ? 'nicht erreichbar' : !on ? 'Aus' : s.state === 'paused' ? 'Pausiert' + (what ? ' · ' + what : '') : what || 'An';
      el.querySelector('[data-tvs]').textContent = st;
      el.querySelector('[data-tvpw]').classList.toggle('on', on);
      el.querySelector('[data-tvpp]').disabled = !on;
      const vol = el.querySelector('[data-tvvol]');
      const v = Math.round((o.vol != null ? o.vol : a.volume_level || 0) * 100);
      if (document.activeElement !== vol) vol.value = v;
      vol.disabled = !on;
      el.querySelector('[data-tvvl]').textContent = v + ' %';
      el.querySelectorAll('[data-app]').forEach(b => b.classList.toggle('on', on && (b.dataset.app === a.source || b.dataset.app === a.app_name)));
    });
  }

  function renderSensors() {
    (S.config?.sensoren || []).forEach((x, i) => {
      const el = q(`[data-se="${i}"]`); if (!el) return;
      const s = ent(x.entity_id);
      const on = s?.state === 'on';
      let txt = '–', warn = false;
      if (!s || s.state === 'unavailable') txt = 'nicht erreichbar';
      else if (x.art === 'fenster' || x.art === 'tuer') { warn = on; txt = on ? `offen · ${dur(s.changed)}` : 'zu'; }
      else if (x.art === 'bewegung') txt = on ? 'Bewegung jetzt' : s.changed ? ago(s.changed) : 'ruhig';
      else txt = on ? 'an' : 'aus';
      el.classList.toggle('warn', warn);
      el.querySelector('p').textContent = txt;
    });
  }

  function renderRoutines() {
    (S.config?.routinen || []).forEach((r, i) => {
      const sw = q(`[data-rtsw="${i}"]`); if (!sw) return;
      const s = ent(r.entity_id), o = ov[r.entity_id];
      const on = o ? o.on : s?.state === 'on';
      sw.classList.toggle('on', on);
      sw.classList.toggle('busy', !!o);
      sw.setAttribute('aria-checked', on);
    });
    if (sheetKind === 'rt') fillRoutineSheet();
  }

  function spark(svg, pts, w, h) {
    if (!svg) return;
    if (!pts || pts.length < 2) { svg.innerHTML = ''; return; }
    const vs = pts.map(p => p[1]);
    let mn = Math.min(...vs), mx = Math.max(...vs);
    if (mx - mn < 1) { const m = (mx + mn) / 2; mn = m - 0.5; mx = m + 0.5; }
    const t0 = Date.now() - 24 * 3600000, t1 = Date.now();
    const xy = pts.map(([t, v]) => `${(Math.max(0, (t - t0) / (t1 - t0)) * w).toFixed(1)},${(h - 3 - (v - mn) / (mx - mn) * (h - 6)).toFixed(1)}`);
    svg.innerHTML = `<path class="l" d="M${xy.join(' L')}"/>`;
  }

  function renderKlima() {
    const c = S.config; if (!c) return;
    const K = c.klima, ser = S.klima?.series || {};
    const val = id => { const s = ent(id); const v = parseFloat(s?.state); return Number.isFinite(v) ? v : NaN; };
    const t = val(K.temperatur), h = val(K.luftfeuchte);
    const simple = !K.weitere.length;
    const tv = q('[data-v="t"]'), hv = q('[data-v="h"]');
    if (tv) tv.innerHTML = K.temperatur ? `${fmtNum(t)}<small>${simple ? ' °C' : ' °C'}</small>` : '';
    if (hv) hv.innerHTML = K.luftfeuchte ? (simple ? `Luftfeuchte ${fmtNum(h, 0)} %` : `${fmtNum(h, 0)}<small> %</small>`) : '';
    const sp = q('[data-sp="t"]');
    if (sp) { const vb = sp.viewBox.baseVal; spark(sp, ser[K.temperatur || K.luftfeuchte], vb.width, vb.height); }
    const sh = q('[data-sp="h"]');
    if (sh) spark(sh, ser[K.luftfeuchte], 140, 26);
    K.weitere.forEach((w, i) => {
      const v = val(w.entity_id), el = q(`[data-v="x${i}"]`);
      if (el) el.innerHTML = `${fmtNum(v, Math.abs(v) >= 100 ? 0 : 1)}<small> ${esc(w.einheit)}</small>`;
      const bar = q(`[data-bar="x${i}"]`);
      if (bar) bar.style.width = Math.max(0, Math.min(100, v / w.max * 100)) + '%';
    });
  }

  // Wetter: WMO-Codes von Open-Meteo
  function wmo(code, day) {
    if (code === 0) return [day ? 'sun' : 'moon', 'Klar'];
    if (code <= 2) return [day ? 'cloudsun' : 'cloudmoon', code === 1 ? 'Überwiegend klar' : 'Leicht bewölkt'];
    if (code === 3) return ['cloud', 'Bewölkt'];
    if (code <= 48) return ['fog', 'Nebel'];
    if (code <= 57) return ['rain', 'Nieselregen'];
    if (code <= 67) return ['rain', 'Regen'];
    if (code <= 77) return ['snow', 'Schnee'];
    if (code <= 82) return ['rain', 'Regenschauer'];
    if (code <= 86) return ['snow', 'Schneeschauer'];
    return ['storm', 'Gewitter'];
  }
  function renderWetter() {
    const w = S.wetter;
    if (!w?.now) return;
    const [icn, txt] = wmo(w.now.code, w.now.day);
    q('[data-v="wxic"]').innerHTML = ic(icn);
    q('[data-v="wxt"]').textContent = w.now.t + '°';
    q('[data-v="wxs"]').textContent = `${txt} · gefühlt ${w.now.feels}°`;
    const hrs = (w.hours || []).map(h => `<div>${h.h} Uhr${ic(wmo(h.code, h.day)[0])}<b>${h.t}°</b></div>`).join('');
    q('[data-v="hours"]', true).forEach(e => { e.innerHTML = hrs; });
  }

  // Uhr, Begrüßung, Wir-Chip (nur im Tablet-Layout sichtbar)
  function tick() {
    if (!S.config || !$('s-zuhause').classList.contains('active')) return;
    const n = new Date(), h = n.getHours();
    const set = (k, v) => { const e = q(`[data-v="${k}"]`); if (e && e.textContent !== v) e.textContent = v; };
    set('clock', pad(h) + ':' + pad(n.getMinutes()));
    set('date', n.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }));
    set('hello', (h < 5 ? 'Gute Nacht' : h < 11 ? 'Guten Morgen' : h < 17 ? 'Hallo' : h < 22 ? 'Guten Abend' : 'Gute Nacht') + ', ihr zwei');
    const days = ($('dayCount')?.textContent || '').trim();
    let chip = days && days !== '0' ? `${days} Tage zusammen` : 'Wir zwei';
    const next = window.WIR_COUNTDOWN?.next?.();
    if (next) {
      const d = Math.round((new Date(next).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
      chip += d <= 0 ? ' · Wiedersehen heute' : d === 1 ? ' · Wiedersehen morgen' : ` · Wiedersehen in ${d} Tagen`;
    }
    set('chip', chip);
    renderStatus();
    renderSensors();
  }

  function render() {
    build();
    if (!S.config) return;
    // Optimistische Werte verwerfen, sobald echte Daten da sind (Realtime kam an)
    renderLamps(); renderStatus(); renderScenes(); renderDevs(); renderTv(); renderSensors(); renderRoutines(); renderKlima(); renderWetter(); tick();
    if (sheetKind === 'lamp') fillLampSheet();
  }
  // ---------------------------------------------------------------- Lampen: Tippen / Wischen / Langdruck
  let drag = null;
  root.addEventListener('pointerdown', e => {
    const el = e.target.closest('.zh-orb');
    if (!el || e.button > 0) return;
    const l = S.config.lampen[+el.dataset.lamp], v = lampView(l);
    drag = { el, l, y: e.clientY, x: e.clientX, b0: v.on ? v.bri : 0, bri: v.bri, moved: false, long: false, id: e.pointerId, sent: 0, timer: 0 };
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
    drag.lp = setTimeout(() => {
      if (drag && !drag.moved) { drag.long = true; navigator.vibrate?.(15); openLamp(+el.dataset.lamp); }
    }, 500);
  });
  root.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id || drag.long) return;
    const dy = drag.y - e.clientY;
    if (!drag.moved && Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(e.clientX - drag.x)) { drag.moved = true; clearTimeout(drag.lp); }
    if (!drag.moved) return;
    e.preventDefault();
    const scale = drag.el.querySelector('.zh-ring').offsetWidth * 1.2 || 150;
    drag.bri = Math.max(1, Math.min(100, Math.round(drag.b0 + dy / scale * 100)));
    const v = { ...lampView(drag.l), on: true, bri: drag.bri, busy: false };
    paintLamp(drag.el, v);
    // während des Wischens höchstens alle 350 ms senden (ohne Protokoll), am Ende einmal mit Protokoll
    const now = Date.now();
    if (now - drag.sent > 350) { drag.sent = now; T.call({ entity_id: drag.l.entity_id, service: 'light.turn_on', data: { brightness_pct: drag.bri }, log: false }).catch(() => {}); }
  });
  function endDrag(e) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    clearTimeout(drag.lp);
    const d = drag; drag = null;
    if (e?.type === 'pointercancel' && !d.moved) { renderLamps(); return; }
    if (d.long) return;
    const v = lampView(d.l);
    if (d.moved) lampCmd(d.l, { service: 'light.turn_on', data: { brightness_pct: d.bri } }, { on: true, bri: d.bri }, d.el);
    else if (!v.na) lampCmd(d.l, { service: v.on ? 'light.turn_off' : 'light.turn_on' }, { on: !v.on }, d.el);
    else toast(d.l.name + ' ist nicht erreichbar');
  }
  root.addEventListener('pointerup', endDrag);
  root.addEventListener('pointercancel', endDrag);
  root.addEventListener('contextmenu', e => {
    const el = e.target.closest('.zh-orb');
    if (!el) return;
    e.preventDefault();
    if (!drag?.long) openLamp(+el.dataset.lamp);
  });
  root.addEventListener('keydown', e => {
    const el = e.target.closest('.zh-orb');
    if (el) {
      const l = S.config.lampen[+el.dataset.lamp], v = lampView(l);
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); lampCmd(l, { service: v.on ? 'light.turn_off' : 'light.turn_on' }, { on: !v.on }, el); }
      else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const b = Math.max(1, Math.min(100, (v.on ? v.bri : 0) + (e.key === 'ArrowUp' ? 10 : -10)));
        lampCmd(l, { service: 'light.turn_on', data: { brightness_pct: b } }, { on: true, bri: b }, el);
      } else if (e.key === 'm' || e.key === 'ContextMenu') { e.preventDefault(); openLamp(+el.dataset.lamp); }
      return;
    }
    const rt = e.target.closest('.zh-rt');
    if (rt && e.target === rt && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openRoutine(+rt.dataset.rt); }
  });

  // ---------------------------------------------------------------- Klicks: Alle, Szenen, Geräte, Routinen, Fernseher, Status
  root.addEventListener('click', async e => {
    const c = S.config; if (!c) return;
    const all = e.target.closest('[data-all]');
    if (all) {
      const on = all.dataset.all === 'on';
      c.lampen.forEach(l => { ov[l.entity_id] = { on, t: Date.now() }; });
      renderLamps();
      const ok = await call({ entity_id: '*lampen', service: on ? 'light.turn_on' : 'light.turn_off' }, all);
      if (!ok) c.lampen.forEach(l => delete ov[l.entity_id]);
      setTimeout(() => { c.lampen.forEach(l => delete ov[l.entity_id]); renderLamps(); }, 4000);
      renderLamps();
      return;
    }
    const sc = e.target.closest('[data-sc]');
    if (sc) {
      const s = c.szenen.find(x => x.key === sc.dataset.sc); if (!s) return;
      sceneOv = s.key; renderScenes();
      const ok = await call(s.aktion === 'alle_aus' ? { entity_id: '*lampen', service: 'light.turn_off', scene: s.key }
        : { entity_id: s.entity_id, service: s.entity_id.split('.')[0] + '.turn_on', scene: s.key }, sc);
      if (!ok) sceneOv = null;
      setTimeout(() => { sceneOv = null; renderScenes(); }, 4000);
      renderScenes();
      return;
    }
    const dv = e.target.closest('[data-dev]');
    if (dv) {
      const d = c.schalter[+dv.dataset.dev], on = !isOn(ent(d.entity_id));
      ov[d.entity_id] = { on, t: Date.now() }; renderDevs();
      await call({ entity_id: d.entity_id, service: d.entity_id.split('.')[0] + (on ? '.turn_on' : '.turn_off') }, dv);
      setTimeout(() => { delete ov[d.entity_id]; renderDevs(); }, 4000);
      return;
    }
    const sw = e.target.closest('[data-rtsw]');
    if (sw) { e.stopPropagation(); toggleRoutine(+sw.dataset.rtsw, sw); return; }
    const rt = e.target.closest('[data-rt]');
    if (rt) { openRoutine(+rt.dataset.rt); return; }
    const tvEl = e.target.closest('[data-tv]');
    if (tvEl) {
      const t = c.tv[+tvEl.dataset.tv], s = ent(t.entity_id);
      if (e.target.closest('[data-tvpw]')) {
        const on = !isOn(s);
        ov[t.entity_id] = { on, t: Date.now() }; renderTv();
        await call({ entity_id: t.entity_id, service: on ? 'media_player.turn_on' : 'media_player.turn_off' }, tvEl);
        setTimeout(() => { delete ov[t.entity_id]; renderTv(); }, 4000);
      } else if (e.target.closest('[data-tvpp]')) {
        await call({ entity_id: t.entity_id, service: 'media_player.media_play_pause' }, tvEl);
      } else if (e.target.closest('[data-app]')) {
        await call({ entity_id: t.entity_id, service: 'media_player.select_source', data: { source: e.target.closest('[data-app]').dataset.app } }, tvEl);
      }
      return;
    }
    const st = e.target.closest('[data-status]');
    if (st) {
      const m = S.meta;
      toast(!m ? 'Zuhause-Dienst läuft nicht' : m.mode === 'test' ? 'Testmodus: Home Assistant wird simuliert' : m.connected ? 'Mit Home Assistant verbunden' : 'Getrennt: ' + (m.error || 'keine Verbindung'));
    }
  });
  // Lautstärke: beim Ziehen anzeigen, beim Loslassen senden
  root.addEventListener('input', e => {
    const vol = e.target.closest('[data-tvvol]'); if (!vol) return;
    vol.closest('[data-tv]').querySelector('[data-tvvl]').textContent = vol.value + ' %';
  });
  root.addEventListener('change', async e => {
    const vol = e.target.closest('[data-tvvol]'); if (!vol) return;
    const el = vol.closest('[data-tv]'), t = S.config.tv[+el.dataset.tv];
    ov[t.entity_id] = { ...(ov[t.entity_id] || {}), vol: +vol.value / 100, t: Date.now() };
    await call({ entity_id: t.entity_id, service: 'media_player.volume_set', data: { volume_level: +vol.value / 100 } }, el);
    setTimeout(() => { delete ov[t.entity_id]; renderTv(); }, 3000);
  });

  async function toggleRoutine(i, el) {
    const r = S.config.routinen[i], on = !(ent(r.entity_id)?.state === 'on');
    ov[r.entity_id] = { on, t: Date.now() }; renderRoutines();
    await call({ entity_id: r.entity_id, service: on ? 'automation.turn_on' : 'automation.turn_off' }, el);
    setTimeout(() => { delete ov[r.entity_id]; renderRoutines(); }, 4000);
  }

  // ---------------------------------------------------------------- Sheet (Handy) / Panel (Tablet)
  let sheetKind = '', sheetIdx = -1;
  const wrap = document.createElement('div');
  wrap.className = 'zh-sheet-wrap';
  wrap.innerHTML = '<div class="zh-veil"></div><div class="zh-sheet" role="dialog" aria-modal="true" tabindex="-1"><div class="zh-grab"></div><div class="zh-sheet-in"></div></div>';
  document.body.append(wrap);
  const sheetIn = wrap.querySelector('.zh-sheet-in');
  function openSheet(kind, i, html) {
    sheetKind = kind; sheetIdx = i;
    sheetIn.innerHTML = html;
    wrap.classList.add('open');
    setTimeout(() => wrap.querySelector('.zh-sheet').focus({ preventScroll: true }), 50);
  }
  function closeSheet() { wrap.classList.remove('open'); sheetKind = ''; sheetIdx = -1; }
  wrap.querySelector('.zh-veil').addEventListener('click', closeSheet);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheetKind) closeSheet(); });
  document.addEventListener('wir:show', closeSheet);
  // Sheet nach unten wischen = schließen (Handy)
  let sy = null;
  wrap.querySelector('.zh-grab').addEventListener('pointerdown', e => { sy = e.clientY; });
  wrap.addEventListener('pointerup', e => { if (sy != null && e.clientY - sy > 60) closeSheet(); sy = null; });

  function openLamp(i) {
    const l = S.config.lampen[i];
    const modes = ent(l.entity_id)?.a?.supported_color_modes || ['color_temp', 'rgb'];
    const hasCt = modes.includes('color_temp');
    const hasCol = modes.some(m => ['hs', 'xy', 'rgb', 'rgbw', 'rgbww'].includes(m));
    openSheet('lamp', i, `
      <div class="zh-sh"><h3>${esc(l.name)}</h3><button class="zh-sw" type="button" data-shsw role="switch" aria-label="An/Aus"></button></div>
      <div class="zh-lbl"><span>Helligkeit</span><span data-shpct></span></div>
      <input type="range" min="1" max="100" data-shbri aria-label="Helligkeit">
      ${hasCt ? `<div class="zh-lbl"><span>Weißton</span><span>warm – kalt</span></div>
      <input type="range" min="2200" max="6500" step="100" data-shct aria-label="Weißton" style="--g1:#ffb15c;--g2:#d8ecff">` : ''}
      ${hasCol ? `<div class="zh-lbl"><span>Farbe</span></div><div class="zh-cols">${COLORS.map(c => `<button type="button" data-col="${c}" style="background:${c};--c:${c}" aria-label="Farbe ${c}"></button>`).join('')}</div>` : ''}
      <button class="zh-done" type="button" data-shclose>Fertig</button>`);
    fillLampSheet(true);
  }
  function fillLampSheet(first) {
    if (sheetKind !== 'lamp') return;
    const l = S.config.lampen[sheetIdx], v = lampView(l), s = ent(l.entity_id);
    sheetIn.querySelector('[data-shsw]').classList.toggle('on', v.on);
    const bri = sheetIn.querySelector('[data-shbri]');
    if (first || document.activeElement !== bri) bri.value = v.bri;
    bri.style.setProperty('--g1', 'var(--zh-track,#3a2236)');
    bri.style.setProperty('--g2', v.color);
    sheetIn.querySelector('[data-shpct]').textContent = v.on ? v.bri + ' %' : 'Aus';
    const ct = sheetIn.querySelector('[data-shct]');
    if (ct && (first || document.activeElement !== ct)) {
      const a = s?.a || {};
      if (a.min_color_temp_kelvin) { ct.min = a.min_color_temp_kelvin; ct.max = a.max_color_temp_kelvin; }
      ct.value = a.color_temp_kelvin || 2700;
    }
    sheetIn.querySelectorAll('[data-col]').forEach(b => b.classList.toggle('sel', b.dataset.col.toLowerCase() === v.color.toLowerCase()));
  }
  sheetIn.addEventListener('click', e => {
    if (e.target.closest('[data-shclose]')) return closeSheet();
    if (sheetKind === 'lamp') {
      const l = S.config.lampen[sheetIdx], v = lampView(l);
      if (e.target.closest('[data-shsw]')) return lampCmd(l, { service: v.on ? 'light.turn_off' : 'light.turn_on' }, { on: !v.on }, e.target);
      const col = e.target.closest('[data-col]');
      if (col) return lampCmd(l, { service: 'light.turn_on', data: { rgb_color: rgbOf(col.dataset.col) } }, { on: true, color: col.dataset.col }, col);
    }
    if (sheetKind === 'rt') {
      const r = S.config.routinen[sheetIdx];
      if (e.target.closest('[data-shsw]')) return toggleRoutine(sheetIdx, e.target);
      const run = e.target.closest('[data-run]');
      if (run) {
        run.disabled = true; run.textContent = 'Wird ausgeführt …';
        call({ entity_id: r.entity_id, service: 'automation.trigger' }, run).then(ok => {
          run.disabled = false; run.textContent = ok ? 'Ausgeführt ✓' : 'Jetzt ausführen';
          if (ok) setTimeout(() => { if (run.isConnected) run.textContent = 'Jetzt ausführen'; }, 2000);
        });
      }
    }
  });
  // Helligkeit/Weißton im Sheet: live anzeigen, gedrosselt senden, beim Loslassen protokollieren
  let shSent = 0;
  sheetIn.addEventListener('input', e => {
    if (sheetKind !== 'lamp') return;
    const l = S.config.lampen[sheetIdx];
    if (e.target.matches('[data-shbri]')) {
      const b = +e.target.value;
      ov[l.entity_id] = { ...(ov[l.entity_id] || {}), on: true, bri: b, t: Date.now() };
      sheetIn.querySelector('[data-shpct]').textContent = b + ' %';
      sheetIn.querySelector('[data-shsw]').classList.add('on');
      renderLamps();
      if (Date.now() - shSent > 350) { shSent = Date.now(); T.call({ entity_id: l.entity_id, service: 'light.turn_on', data: { brightness_pct: b }, log: false }).catch(() => {}); }
    } else if (e.target.matches('[data-shct]')) {
      ov[l.entity_id] = { ...(ov[l.entity_id] || {}), on: true, color: hex(kelvinRgb(+e.target.value)), t: Date.now() };
      renderLamps();
    }
  });
  sheetIn.addEventListener('change', e => {
    if (sheetKind !== 'lamp') return;
    const l = S.config.lampen[sheetIdx];
    if (e.target.matches('[data-shbri]')) lampCmd(l, { service: 'light.turn_on', data: { brightness_pct: +e.target.value } }, { on: true, bri: +e.target.value }, e.target);
    if (e.target.matches('[data-shct]')) lampCmd(l, { service: 'light.turn_on', data: { color_temp_kelvin: +e.target.value } }, { on: true, color: hex(kelvinRgb(+e.target.value)) }, e.target);
  });

  function openRoutine(i) {
    const r = S.config.routinen[i];
    openSheet('rt', i, `
      <div class="zh-sh"><h3>${esc(r.name)}</h3><button class="zh-sw" type="button" data-shsw role="switch" aria-label="Aktiv"></button></div>
      <p class="zh-meta">${esc(r.info)}</p>
      <div class="zh-lbl"><span>Status</span><span data-rtstate></span></div>
      <div class="zh-lbl"><span>Zuletzt ausgeführt</span><span data-rtlast></span></div>
      <button class="zh-act" type="button" data-run>Jetzt ausführen</button>
      <button class="zh-done" type="button" data-shclose>Fertig</button>`);
    fillRoutineSheet();
  }
  function fillRoutineSheet() {
    if (sheetKind !== 'rt') return;
    const r = S.config.routinen[sheetIdx], s = ent(r.entity_id), o = ov[r.entity_id];
    const on = o ? o.on : s?.state === 'on';
    sheetIn.querySelector('[data-shsw]').classList.toggle('on', on);
    sheetIn.querySelector('[data-rtstate]').textContent = !s || s.state === 'unavailable' ? 'nicht erreichbar' : on ? 'aktiv' : 'inaktiv';
    sheetIn.querySelector('[data-rtlast]').textContent = s?.a?.last_triggered ? ago(s.a.last_triggered) : 'noch nie';
  }

  // ---------------------------------------------------------------- Start, Sichtbarkeit
  // Optimistische Werte: verworfen, sobald sich der Datensatz des Geräts ändert
  const prevSig = {};
  function changeFilter(state) {
    for (const [id, s] of Object.entries(state.entities)) {
      const sig = s.state + '|' + JSON.stringify(s.a);
      if (prevSig[id] !== undefined && prevSig[id] !== sig && ov[id] && !(drag && drag.l.entity_id === id)) delete ov[id];
      prevSig[id] = sig;
    }
    if (sceneOv && state.meta?.scene === sceneOv) sceneOv = null;
    render();
  }

  function start() {
    if (started) return;
    started = true;
    build();
    T.start(changeFilter).catch(err => {
      started = false;
      console.error('Zuhause', err);
      root.innerHTML = '<div class="zh-card zh-empty">Zuhause ist gerade nicht erreichbar.</div>';
      cfgSig = '';
    });
  }
  document.addEventListener('wir:show', e => {
    document.body.classList.toggle('zh-open', e.detail === 's-zuhause');
    if (e.detail !== 's-zuhause') return;
    if (!window.WIR_PB?.authStore?.isValid) return;
    if (!started) start(); else { render(); }
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && started) T.refresh().catch(() => {});
  });
  setInterval(tick, 10000);

  // ---------------------------------------------------------------- Leistungsmodus (Einstellungen, nur dieses Gerät)
  const perf = $('perfSwitch');
  if (perf) {
    perf.checked = document.documentElement.classList.contains('perf');
    perf.addEventListener('change', () => {
      document.documentElement.classList.toggle('perf', perf.checked);
      try { localStorage.setItem('wir-perf', perf.checked ? '1' : '0'); } catch (_) {}
    });
  }
})();
