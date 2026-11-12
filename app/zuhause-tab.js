// Zuhause · Tablet/Breitbild (neues Design 12.11.2026, Entwurf wir-zuhause/zuhause.html): festes 800×600-Raster,
// auf den Bildschirm skaliert. Markup aus zuhause-tab-markup.js, Stile zuhause-tab.css (beides im Shadow-DOM von #zh).
// Zeichnet nur – Zustand und Befehle kommen aus window.ZH (zuhause.js), Partner/Abfahrten/Pakete/System aus window.ZHX.
(() => {
  const VIEWS = window.ZH_VIEWS || (window.ZH_VIEWS = {});
  let Z, W = null, R = null, page = 'home', ro = null;
  const $ = id => R.getElementById(id);
  const $$ = (s, el = W) => [...el.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const p2 = n => String(n).padStart(2, '0');
  const hmT = t => { const d = new Date(t); return p2(d.getHours()) + ':' + p2(d.getMinutes()); };
  const fmt = (n, d = 1) => (Number.isFinite(n) ? n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }) : '–');
  const last = new WeakMap();
  const put = (el, h) => { if (el && last.get(el) !== h) { last.set(el, h); el.innerHTML = h; } };
  const txt = (el, t) => { if (el && el.textContent !== t) el.textContent = t; };
  const rad = a => a * Math.PI / 180;
  function arc(cx, cy, r, a0, a1) {
    const p = a => [cx + r * Math.cos(rad(a)), cy + r * Math.sin(rad(a))]; const [x0, y0] = p(a0), [x1, y1] = p(a1);
    return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }
  const WDS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const PERS_DEF = { d: '#f28a3c', i: '#c38bff', g: '#3cbf6a' };
  const ROOM = { tisch: 'Wohnzimmer', kueche: 'Küche', bett: 'Schlafzimmer', tv: 'Wohnzimmer' };

  // ---------------------------------------------------------------- Zustand der Ansicht
  let sel = 'tisch', kMonth, kSel, kView = 'monat', tdList = 'gemeinsam', cpId = null, pkOpen = '', sysOpen = '', ringOn = false, alarmAt = null, snoozes = 0;
  const kOff = new Set();
  const TODAY = () => Z.today();

  // ---------------------------------------------------------------- Symbole
  const ICONS = {
    home: '<path d="M3 11 12 3l9 8v10h-6v-6H9v6H3z" fill="#fff" stroke="none"/>',
    tisch: '<path d="M12 2v5M6 13a6 6 0 0 1 12 0z"/><path d="M10 16a2 2 0 0 0 4 0"/>',
    kueche: '<path d="M5 10h14v8a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z"/><path d="M3 10h18M9 6c0-1 1-1 1-2M14 6c0-1 1-1 1-2"/>',
    bett: '<path d="M3 19V6M3 14h18v5M21 19v-3a3 3 0 0 0-3-3h-7v1"/><circle cx="7" cy="11" r="1.8"/>',
    tv: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/>',
    sensor: '<path d="M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0z"/><path d="M12 9v7"/>',
  };
  const TI = { tisch: '<path d="M12 2a6 6 0 0 0-3.5 10.9V15h7v-2.1A6 6 0 0 0 12 2zM9.5 18h5M10.5 21h3"/>', kueche: ICONS.kueche, tv: '<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M8 20.5h8M12 16.5v4"/>', bett: ICONS.bett };
  const NI = {
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    box: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>',
    alarm: '<circle cx="12" cy="13" r="7"/><path d="M12 10v3l2 2M5 4 2 7M19 4l3 3"/>',
    tv: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/>',
    win: '<rect x="4" y="3.5" width="16" height="17" rx="1.5"/><path d="M12 3.5v17M4 12h16"/>',
    door: '<path d="M6 21V4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21M4 21h16"/><circle cx="14.5" cy="12" r=".9"/>',
  };
  const isvg = (p, s = 13) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  // Wetter-Symbole (52×46 wie die Vorlage)
  const WICON = {
    cloudsun: null,   // Vorlage (Sonne + Wolke) bleibt
    sun: '<g stroke="#f6c050" stroke-width="2" stroke-linecap="round"><path d="M26 3v5M26 38v5M6 23h5M41 23h5M12 9l3.5 3.5M36.5 33.5 40 37M12 37l3.5-3.5M36.5 12.5 40 9"/></g><circle cx="26" cy="23" r="10" fill="url(#sg)" style="filter:drop-shadow(0 0 5px rgba(255,200,90,.7))"/>',
    moon: '<path d="M33 30A14 14 0 0 1 20 9a14 14 0 1 0 13 21z" fill="#e8ecf5" style="filter:drop-shadow(0 0 5px rgba(200,215,255,.6))"/><circle cx="38" cy="10" r="1.2" fill="#fff"/><circle cx="44" cy="18" r=".9" fill="#fff"/>',
    cloudmoon: '<path d="M27 21A10 10 0 0 1 18 6a10 10 0 1 0 9 15z" fill="#e8ecf5"/><path d="M15 44a9 9 0 0 1-.6-18 12 12 0 0 1 22.6-2.2A8.5 8.5 0 1 1 41 44z" fill="url(#cg)"/>',
    cloud: '<path d="M11 40a9 9 0 0 1-.6-18 13 13 0 0 1 24.6-2.4A9.5 9.5 0 1 1 39 40z" fill="url(#cg)"/>',
    rain: '<path d="M11 32a8 8 0 0 1-.6-16 12 12 0 0 1 22.6-2.2A8.5 8.5 0 1 1 37 32z" fill="url(#cg)"/><g stroke="#7fb8ff" stroke-width="2.2" stroke-linecap="round"><path d="M16 36l-2 6M25 36l-2 6M34 36l-2 6"/></g>',
    snow: '<path d="M11 32a8 8 0 0 1-.6-16 12 12 0 0 1 22.6-2.2A8.5 8.5 0 1 1 37 32z" fill="url(#cg)"/><g fill="#fff"><circle cx="15" cy="39" r="1.8"/><circle cx="24" cy="42" r="1.8"/><circle cx="33" cy="39" r="1.8"/></g>',
  };
  let wiconDefault = '';

  // ---------------------------------------------------------------- Aufbau
  function build(wrap, root) {
    Z = window.ZH; W = wrap; R = root;
    kMonth = new Date(TODAY().getFullYear(), TODAY().getMonth(), 1); kSel = TODAY();
    W.innerHTML = window.ZT_MARKUP + overlays();
    // Kopf: echte Person, Avatar = zurück zur Wir-App
    const av = $$('.avatar')[0], un = $$('.uname')[0], ch = $$('.chev')[0];
    for (const el of [av, un, ch]) { el.dataset.back = '1'; el.title = 'Zurück zur Wir-App'; el.style.cursor = 'pointer'; }
    // Fuß/Deko: Pakete/System nur für den Besitzer – Navigation dynamisch
    extraNav();
    wiconDefault = $$('.w-icon')[0].innerHTML;
    buildNet();
    wire();
    // Größe des Bereichs ändert sich (Vollbild an/aus, Drehen, Fenster): Raster neu einpassen
    ro = new ResizeObserver(fit); ro.observe(W);
    fit();
    go(page);
  }
  function overlays() {
    const PCOLS = ['#ff6a1f', '#ff7828', '#ff9646', '#ffb35c', '#ffd9a8', '#fff1dc', '#ffffff', '#7fb8ff', '#5ad07a', '#c38bff', '#ff5a7a'];
    return `<div class="cpop" id="cpop"><div class="cbox">
      <div class="chd"><div class="cprev" id="cpPrev"></div><div><b id="cpName"></b><small id="cpSub"></small></div><button id="cpX" aria-label="Schließen">✕</button></div>
      <div class="ccols" id="cpCols">${PCOLS.map(c => `<button data-c="${c}" style="background:${c};color:${c}" aria-label="Farbe"></button>`).join('')}<label class="cfree" title="Eigene Farbe"><input type="color" id="cpFree">+</label></div>
      <label class="cbr" id="cpBr"><span>Helligkeit <b id="cpB"></b></span><input type="range" id="cpRange" min="1" max="100"></label>
      <button class="cpow" id="cpPow"></button></div></div>
    <div class="cpop" id="lpop"><div class="cbox lbox" id="lbox"></div></div>
    <div class="ovl" id="ring"><div class="lbl" id="ringLbl">Guten Morgen ☀️</div><div class="big" id="ringTime"></div><div class="lbl" id="ringSub"></div>
      <div class="acts"><button id="snooze">Schlummern · 10 Min</button><button id="getup"><i></i>Aufstehen <small>(gedrückt halten)</small></button></div><button class="dash" id="ringDash">Zum Dashboard</button></div>
    <div class="ovl" id="saver"><div class="big" id="saverTime"></div><div class="lbl" id="saverSub"></div></div>
    <div class="ovl shotov" id="shotov"><div class="shotbox"><img id="shotImg" alt="Bildschirm des Fernsehers"><div class="lbl" id="shotMsg"></div></div><div class="acts"><button class="btn" id="shotNew">Neu aufnehmen</button><button class="btn off" id="shotX">Schließen</button></div></div>
    <div id="nightdim"></div><div class="toast" id="toast"></div>`;
  }
  // Navigation: Grundreiter + Extra-Reiter (z. B. Claude); Pakete/System nur mit Recht
  function navList() {
    const X = window.ZHX;
    const base = [['home'], ['tv'], ['kal'], ['wecker'], ['partner'], ['abf'], ['pak', X?.pakOk()], ['sys', X?.sysOk()], ...Z.extraPages.map(p => [p.key, true, p]), ['einst']];
    return base.filter(x => x[1] !== false && !(x[0] === 'tv' && !Z.cfg()?.fernseher));
  }
  function extraNav() {
    const nav = $('nav'), main = $('main');
    for (const p of Z.extraPages) {
      if (!nav.querySelector(`[data-p="${p.key}"]`)) {
        nav.querySelector('[data-p="einst"]').insertAdjacentHTML('beforebegin', `<button class="nav" data-p="${p.key}">${p.icon}${esc(p.label)}</button>`);
        main.insertAdjacentHTML('beforeend', `<section class="page" id="p-${p.key}"><div class="scroll"><div class="ph"><div><h2>${esc(p.label)}</h2></div></div><div class="xpage">${p.html || ''}</div></div></section>`);
      }
    }
    placeNav();
  }
  let navSig = '';
  function placeNav() {
    const list = navList(), sig = list.map(x => x[0]).join(',');
    if (sig === navSig) return;
    navSig = sig;
    const step = Math.min(54, 490 / list.length), h = Math.min(57, step + 2);
    $$('#nav .nav').forEach(b => { b.hidden = !list.some(x => x[0] === b.dataset.p); });
    // Deko-Pflanze unten links nur, wenn die Reiter ihr nicht im Weg sind
    const vib = $$('.vibes')[0]; if (vib) vib.hidden = list.length > 9;
    list.forEach(([p], i) => { const b = $('nav').querySelector(`[data-p="${p}"]`); if (b) { b.style.top = (72 + i * step) + 'px'; b.style.height = h + 'px'; } });
    if (!list.some(x => x[0] === page)) go('home');
  }
  function pageEl(key) { return W?.querySelector(`#p-${key} .xpage`) || null; }

  // Skalierung: 800×600 einpassen und mittig
  function fit() {
    if (!W) return;
    const w = W.clientWidth || innerWidth, h = W.clientHeight || innerHeight, s = Math.min(w / 800, h / 600);
    const d = $('dash'); if (!d) return;
    d.style.transform = `translate(${Math.round((w - 800 * s) / 2)}px,${Math.round((h - 600 * s) / 2)}px) scale(${s})`;
  }

  // ---------------------------------------------------------------- Navigation
  function go(p) {
    if (!W) return;
    if (p === 'start') p = 'home';
    if (p === 'set') p = 'einst';
    if (!$('p-' + p)) p = 'home';
    page = p;
    $$('#nav .nav').forEach(x => x.classList.toggle('on', x.dataset.p === p));
    $$('.page').forEach(x => x.classList.toggle('on', x.id === 'p-' + p));
    const sc = $('p-' + p)?.querySelector('.scroll'); if (sc) sc.scrollTop = 0;
    Z.go(p);
    render();
  }

  // ---------------------------------------------------------------- Raumansicht
  const NODES = [{ id: 'tisch', x: 482, y: 267 }, { id: 'bett', x: 466, y: 451 }, { id: 'kueche', x: 969, y: 267 }, { id: 'sensor', x: 990, y: 451 }, { id: 'tv', x: 729, y: 547 }], C = { x: 729, y: 372 };
  function buildNet() {
    let s = ''; const B = 60, lx = 566, rx = 883;
    s += `<path class="wire" data-w="tisch" d="M${C.x - 101} ${C.y}H${lx}V267H${482 + B}"/><path class="wire" data-w="bett" d="M${lx} ${C.y}V451H${466 + B}"/>`;
    s += `<path class="wire" data-w="kueche" d="M${C.x + 101} ${C.y}H${rx}V267H${969 - B}"/><path class="wire" data-w="sensor" d="M${rx} ${C.y}V451H${990 - B}"/>`;
    s += `<path class="wire" data-w="tv" d="M${C.x} ${C.y + 78}V${547 - B}"/>`;
    [[lx, C.y], [rx, C.y], [C.x - 101, C.y], [C.x + 101, C.y], [C.x, C.y + 78]].forEach(([x, y]) => { s += `<circle class="wdot" cx="${x}" cy="${y}" r="6"/>`; });
    s += `<g class="node center" data-id="alle" transform="translate(${C.x} ${C.y})"><title>Alles an/aus</title><rect class="box" x="-101" y="-78" width="202" height="156" rx="22"/><circle class="inner" r="46"/><g transform="translate(-22 -22) scale(1.8333)">${ICONS.home}</g></g>`;
    NODES.forEach(n => { s += `<g class="node" data-id="${n.id}" transform="translate(${n.x} ${n.y})"><title></title><rect class="box" x="-${B}" y="-${B}" width="${2 * B}" height="${2 * B}" rx="26"/><g class="ni" transform="translate(-28 -28) scale(2.3333)">${ICONS[n.id]}</g></g>`; });
    $('net').innerHTML = s;
  }
  const lampOf = key => Z.lamps().find(l => l.key === key) || null;
  function renderRoom() {
    const L = Z.lamps(), tv = Z.tvView(), lv = l => (l && l.on ? (l.dimm ? l.b / 100 : 1) : 0);
    const k = lampOf('kueche'), b = lampOf('bett'), t = lampOf('tisch');
    const total = lv(k) * .55 + lv(b) * .45 + lv(t) * .9 + (tv?.on ? .3 : 0);
    $('dark').style.opacity = Math.max(0, .58 - total * .4).toFixed(2);
    [['kueche', k], ['bett', b], ['tisch', t]].forEach(([id, l]) => {
      const g = $('g-' + id); if (g) g.style.opacity = l?.on ? Math.min(1, .3 + lv(l)) : 0;
      if (l) $$(`#rg-${id} stop`).forEach(s => s.setAttribute('stop-color', l.c));
    });
    const tvOn = !!tv?.on;
    $('g-tv').style.opacity = $('tvImg').style.opacity = tvOn ? 1 : 0;
    const anyOn = L.some(l => l.on) || tvOn;
    $$('#net .node').forEach(n => {
      const id = n.dataset.id, l = lampOf(id);
      n.classList.toggle('on', id === 'alle' ? anyOn : id === 'sensor' ? true : id === 'tv' ? tvOn : !!l?.on);
      n.style.display = id === 'tv' ? (tv ? '' : 'none') : id === 'sensor' || id === 'alle' ? '' : l ? '' : 'none';
      const ti = n.querySelector('title');
      if (ti) txt(ti, id === 'alle' ? (anyOn ? 'Alles aus' : 'Alles an') : id === 'sensor' ? sensorTxt() : id === 'tv' ? (tv?.tv.name || 'Fernseher') : l?.name || '');
    });
    $$('#net .wire').forEach(w => { const id = w.dataset.w, l = lampOf(id); w.classList.toggle('on', id === 'sensor' || (id === 'tv' ? tvOn : !!l?.on)); });
    // Helligkeitsregler: gewählte Lampe
    if (!lampOf(sel)) sel = L[0]?.key || '';
    const s = lampOf(sel);
    if (s) {
      const p = s.on ? (s.dimm ? s.b : 100) : 0;
      txt($('brName'), s.name); txt($('brVal'), s.na ? '–' : s.dimm ? p + '%' : s.on ? 'An' : 'Aus');
      if (!brDrag) $('fill').style.height = p + '%';
      $('fill').style.background = s.on ? '' : 'transparent';
    }
    // Live-Anzeige
    const st = Z.status(), live = $$('.vpill')[0];
    if (live) { const t2 = st.bad ? 'Offline' : st.test ? 'Test' : 'Live'; if (live.lastChild.textContent !== t2) live.lastChild.textContent = t2; live.classList.toggle('bad', st.bad); }
  }
  function sensorTxt() { const k = Z.klima(); return `Temperatur ${fmt(k.t)} °C · Feuchte ${fmt(k.hu, 0)} %`; }
  let brDrag = false;

  // Schnellwahl der Szenen über der Raumansicht (die ersten vier ohne "Alles aus")
  const QX = [136.9, 199.2, 261.5, 322.7];
  function renderQuick() {
    const sc = Z.scenes().filter(s => Z.norm(s.name) !== 'allesaus').slice(0, 4);
    put($('rtabs'), sc.map((s, i) => `<button class="abs tab ${s.on ? 'act' : ''}" style="left:${QX[i]}px" data-s="${s.key}">${esc(s.name)}</button>`).join(''));
  }

  // ---------------------------------------------------------------- Kacheln
  const TILE = [['tisch', 't1', 'c-or'], ['kueche', 't2', 'c-te'], ['tv', 't3', 'c-pu'], ['bett', 't4', 'c-gr']];
  function renderTiles() {
    const tv = Z.tvView();
    put($('tiles'), TILE.map(([id, pos, c]) => {
      let d, x = '';
      if (id === 'tv') {
        if (!tv) return '';
        d = { on: tv.on, name: tv.tv.name, room: ROOM.tv };
        const st = tv.on ? 'An' : tv.starting ? 'Startet …' : tv.bildAus ? 'Bild aus' : 'Aus';
        x = `<i style="width:5px;height:5px;border-radius:50%;background:${tv.on ? '#3cbf6a' : '#6b7280'};box-shadow:${tv.on ? '0 0 5px #3cbf6a' : 'none'}"></i>${st}${tv.on ? ` <span style="opacity:.45">|</span> ${esc(tv.app.name)}` : ''}`;
      } else {
        const l = lampOf(id); if (!l) return '';
        d = { on: l.on, name: l.name, room: l.l.raum || ROOM[id] || '' };
        if (l.na) x = 'nicht erreichbar';
        else if (id === 'kueche') x = l.on ? `${l.dimm ? l.b + ' % ' : ''}<span style="opacity:.45">|</span> ${esc(l.k)}` : 'Aus';
      }
      return `<div class="card tile ${pos} ${c} ${d.on ? 'on' : ''}" data-id="${id}"><div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${TI[id]}</svg></div><div class="tg"></div>
        <div class="tt">${esc(d.name)}</div><div class="ts">${esc(d.room)}</div>${x ? `<div class="tx">${x}</div>` : ''}</div>`;
    }).join(''));
  }

  // ---------------------------------------------------------------- Wetter, Luftfeuchte, Temperatur
  function renderWeather() {
    const w = Z.S.wetter;
    txt($('wdate'), new Date().toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }));
    const loc = $$('.w-loc')[0]; if (loc && loc.lastChild.textContent !== (w?.ort || 'Zuhause')) loc.lastChild.textContent = w?.ort || 'Zuhause';
    const [ic, desc] = Z.wmo(w?.now?.code, w?.now?.day);
    put($('wtemp'), w?.now ? `${w.now.t}<sup>°C</sup>` : '–<sup>°C</sup>');
    txt($('wdesc'), w?.now ? desc : 'Wetter lädt …');
    const icon = $$('.w-icon')[0];
    if (icon && icon.dataset.k !== ic) { icon.dataset.k = ic; icon.innerHTML = icon.querySelector('defs').outerHTML + (WICON[ic] || wiconDefault.replace(/<defs>[\s\S]*?<\/defs>/, '')); }
    const st = $$('.w-stat');
    const vals = [['Regen', w ? (w.regen_ab ? `ab ${w.regen_ab} Uhr` : 'keiner') : '–'], ['Heute', w?.heute ? `${w.heute.min}° / ${w.heute.max}°` : '–'], ['Gefühlt', w?.now ? `${w.now.feels} °C` : '–']];
    st.forEach((el, i) => { txt(el.querySelector('small'), vals[i][0]); txt(el.querySelector('b'), vals[i][1]); });
  }
  function renderHum() {
    const k = Z.klima(), h = k.hu, t = k.t, A0 = 146, A1 = 394;
    $('humTrack').setAttribute('d', arc(84.5, 89.3, 54, A0, A1));
    $('humArc').setAttribute('d', Number.isFinite(h) ? arc(84.5, 89.3, 54, A0, A0 + (A1 - A0) * Math.max(.01, Math.min(1, h / 100))) : '');
    txt($('humVal'), Number.isFinite(h) ? String(Math.round(h)) : '–');
    const [lab, c, word] = !Number.isFinite(h) ? ['–', '#6b7280', 'kein Sensor'] : h < 40 ? ['Trocken', '#e0a93a', 'Zu trocken'] : h > 60 ? ['Feucht', '#4aa8ff', 'Zu feucht'] : ['Optimal', '#3cbf6a', 'Angenehm'];
    const p = $('humPill'); txt(p, lab); p.style.background = c; p.style.boxShadow = `0 0 10px ${c}88`;
    txt($('humLbl'), Number.isFinite(h) ? '% · ' + word : word);
    if (Number.isFinite(h) && Number.isFinite(t)) { const g = Math.log(h / 100) + 17.62 * t / (243.12 + t); txt($('dew'), fmt(243.12 * g / (17.62 - g)) + ' °C'); } else txt($('dew'), '–');
    // Verlauf der letzten Stunden (aus dem 24-h-Verlauf von wir-home)
    const pts = k.hs.slice(-15);
    if (pts.length > 2) {
      const vs = pts.map(x => x.v), mn = Math.min(...vs), mx = Math.max(...vs), sp = Math.max(2, mx - mn);
      const P = pts.map((x, i) => `${(152 + i * 92 / (pts.length - 1)).toFixed(1)},${(108 + (1 - (x.v - mn) / sp) * 14).toFixed(1)}`);
      $('humSpark').setAttribute('d', 'M' + P.join('L')); $('humSparkA').setAttribute('d', 'M' + P.join('L') + 'L244,130L152,130Z');
    } else { $('humSpark').setAttribute('d', ''); $('humSparkA').setAttribute('d', ''); }
  }
  function renderTh() {
    const k = Z.klima(), t = k.t, A0 = 147, A1 = 393, f = Number.isFinite(t) ? Math.max(0, Math.min(1, (t - 10) / 20)) : 0, a = A0 + (A1 - A0) * f;
    $('thArc').setAttribute('d', arc(128.8, 93, 59, A0, A1));
    $('thKnob').setAttribute('cx', (128.8 + 59 * Math.cos(rad(a))).toFixed(2)); $('thKnob').setAttribute('cy', (93 + 59 * Math.sin(rad(a))).toFixed(2));
    $('thKnob').style.display = Number.isFinite(t) ? '' : 'none';
    put($('thVal'), `${fmt(t)}<tspan font-size="11" dy="-7">°C</tspan>`);
    txt($('thMode'), !Number.isFinite(t) ? 'kein Sensor' : t < 19 ? '❄ Kühl' : t > 24 ? '🔥 Warm' : '✓ Angenehm');
    txt($('tmin'), Number.isFinite(k.tmin) ? fmt(k.tmin) + '°' : '–'); txt($('tmax'), Number.isFinite(k.tmax) ? fmt(k.tmax) + '°' : '–');
  }

  // ---------------------------------------------------------------- Strom (ohne Stromzähler: geschätzt aus dem, was an ist)
  let selBar = -1;
  function renderPower() {
    const s = Z.strom();
    if (s.echt) {
      put($$('.p-big')[0], Number.isFinite(s.watt) ? `<span id="kwh">${fmt(s.watt, 0)}</span><small>W</small>` : `<span id="kwh">${fmt(s.kwh, 2)}</span><small>kWh</small>`);
      put($('trend'), Number.isFinite(s.kwh) && Number.isFinite(s.watt) ? `${fmt(s.kwh, 2)} kWh<small>heute</small>` : '<small>Stromzähler</small>');
    } else {
      put($$('.p-big')[0], `<span id="kwh">${fmt(s.sum, s.sum < 10 ? 1 : 0)}</span><small>W</small>`);
      put($('trend'), `≈ ${fmt(s.sum * 24 / 1000, 2)} kWh<small>pro Tag, geschätzt</small>`);
    }
    put($('range'), 'jetzt');
    const data = s.items, n = data.length || 1;
    const max = Math.max(10, ...data.map(x => x.w)), top = Math.ceil(max / 10) * 10;
    const Z0 = 158, U = 80, step = Math.min(36, 140 / n), x0 = 46 + step / 2 - 4, bw = Math.min(14, step * .45);
    if (selBar < 0 || selBar >= n) selBar = data.reduce((bi, x, i) => (x.w > data[bi].w ? i : bi), 0);
    let h = '<defs><linearGradient id="bt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#36c2a8"/><stop offset="1" stop-color="#14605a"/></linearGradient><linearGradient id="bo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffa253"/><stop offset="1" stop-color="#f0651e"/></linearGradient></defs>';
    [[1, top], [.5, top / 2], [0, 0]].forEach(([v, l]) => { h += `<text x="10" y="${(Z0 - v * U + 3).toFixed(1)}" font-size="7.5" fill="#9aa6b4">${fmt(l, 0)}</text>`; });
    data.forEach((d, i) => {
      const cx = x0 + i * step, hh = Math.max(1.5, d.w / top * U), on = i === selBar;
      h += `<rect class="bar" data-i="${i}" x="${(cx - bw / 2).toFixed(1)}" y="${(Z0 - hh).toFixed(1)}" width="${bw.toFixed(1)}" height="${hh.toFixed(1)}" rx="${Math.min(3, bw / 2)}" fill="${on ? 'url(#bo)' : 'url(#bt)'}" style="cursor:pointer;filter:drop-shadow(0 0 ${on ? 4 : 2.5}px ${on ? 'rgba(255,130,50,.9)' : 'rgba(54,194,168,.55)'})"/>`;
      h += `<text x="${cx.toFixed(1)}" y="172" font-size="7" fill="#c3ccd6" text-anchor="middle">${esc(d.name.slice(0, 7))}</text>`;
      if (on) { const ty = Math.max(62, Z0 - hh - 20); h += `<rect x="${(cx - 20.6).toFixed(1)}" y="${ty.toFixed(1)}" width="41.2" height="13.3" rx="6.6" fill="#f28a3c"/><path d="M${(cx - 3).toFixed(1)} ${(ty + 13.2).toFixed(1)}l3 3 3-3z" fill="#f28a3c"/><text x="${cx.toFixed(1)}" y="${(ty + 9.2).toFixed(1)}" font-size="7.5" fill="#fff" text-anchor="middle">${fmt(d.w, d.w < 10 ? 1 : 0)} W</text>`; }
    });
    put($('chart'), h);
  }

  // ---------------------------------------------------------------- Fernseher
  function renderTV() {
    const v = Z.tvView(); if (!v) return;
    const A = v.app;
    txt($('tvStatus'), v.on ? `An · ${A.name}` : v.starting ? 'Startet …' : v.bildAus ? 'Bild aus · Ton an' : 'Aus · Standby');
    const pw = $('tvPow'); txt(pw, v.on || v.bildAus ? 'Ausschalten' : v.starting ? 'Startet …' : 'Einschalten'); pw.classList.toggle('off', !v.on);
    $('np').classList.toggle('tvoff', !v.on);
    const art = $('npArt'); art.style.background = `linear-gradient(160deg,${A.farbe},#111)`; art.style.setProperty('--ac', A.farbe);
    if (art.dataset.k !== A.name) { art.dataset.k = A.name; art.innerHTML = Z.appMark(A); }
    txt($('npApp'), A.name + (v.on ? (v.playing ? ' · läuft' : ' · pausiert') : ''));
    txt($('npTitle'), v.titel || (v.on ? A.name : 'Nichts läuft'));
    progress(v);
    txt($('npPlay'), v.playing ? '❚❚' : '▶');
    const off = $('npOff');
    txt(off, v.starting ? 'Fernseher wird gestartet … (bis zu 45 Sek.)' : v.bildAus ? 'Bild aus · Ton läuft – tippen für Bild an' : v.fail ? 'Hat diesmal nicht geklappt – nochmal tippen' : 'Fernseher ist aus – Tippen zum Einschalten');
    put($('apps'), v.tv.apps.map(a => `<button class="app ${v.on && A.name === a.name ? 'on' : ''}" style="--ac:${a.farbe}" data-app="${esc(a.name)}"><i style="background:${a.farbe}">${Z.appMark(a)}</i>${esc(a.name)}</button>`).join(''));
    const more = Z.moreApps();
    $('moreBox').hidden = !more.length;
    put($('moreApps'), more.map((x, i) => `<button class="app ${v.on && v.a.app_id === x.paket ? 'on' : ''}" style="--ac:${esc(x.farbe || '#7b5cff')}" data-more="${i}"><i style="background:${esc(x.farbe || '#3a3f52')}">${Z.appMark(x)}</i>${esc(x.name)}</button>`).join(''));
    const src = Z.srcList();
    $('srcBox').hidden = !src.length;
    put($('srcs'), src.map((q, i) => `<button class="chip ${q.on ? 'on' : ''}" data-src="${i}">${esc(q.name)}</button>`).join(''));
    const pct = v.vol / v.max * 100;
    if (!volDrag) $('vFill').style.width = (v.muted ? 0 : pct) + '%';
    txt($('vVal'), v.muted ? '–' : String(v.vol)); $('mute').classList.toggle('on', v.muted);
    // Extras mit ADB: Bild aus, Bildschirmfoto, Bildhelligkeit, Text
    const adb = !!v.tv.titel;
    $('tvx').hidden = !adb;
    const ba = $('bildaus'); txt(ba, v.bildAus ? 'Bild an' : 'Bild aus'); ba.classList.toggle('on', v.bildAus);
    const hv = Z.hell();
    $('hellBox').hidden = !adb || !Number.isFinite(hv);
    if (Number.isFinite(hv)) { txt($('hVal'), String(hv)); if (!hellDrag) $('hFill').style.width = hv + '%'; }
    renderShot();
  }
  // Fortschritt jede Sekunde (vom Kern)
  function progress(v) {
    if (!W || page !== 'tv') return;
    const pr = v.prog;
    $('npProg').style.width = (pr.f * 100).toFixed(1) + '%';
    $('npProg').parentElement.style.visibility = pr.dur ? '' : 'hidden';
    txt($('npRest'), [v.zeile, pr.txt, v.on ? v.stat : ''].filter(Boolean).join(' · '));
  }
  function renderShot() {
    const s = Z.shotView(), ov = $('shotov');
    ov.classList.toggle('open', s.open);
    if (!s.open) return;
    const img = $('shotImg');
    if (s.url && img.src !== s.url) img.src = s.url;
    img.hidden = !s.url;
    txt($('shotMsg'), s.msg);
  }
  let volDrag = false, hellDrag = false;

  // ---------------------------------------------------------------- Kalender + To-dos
  function renderKal() {
    const P = Z.who(PERS_DEF), td = TODAY();
    put($('kLeg'), Object.entries(P).map(([k, [n, c]]) => `<button data-p="${k}" class="${kOff.has(k) ? 'off' : ''}"><i style="background:${c};box-shadow:0 0 5px ${c}"></i>${n}</button>`).join(''));
    $$('#kView button').forEach(b => b.classList.toggle('on', b.dataset.v === kView));
    const evOn = d => Z.evOn(Z.iso(d)).filter(e => !kOff.has(e.w || 'g'));
    let start, n;
    if (kView === 'monat') { txt($('kTitle'), `${MON[kMonth.getMonth()]} ${kMonth.getFullYear()}`); start = new Date(kMonth); start.setDate(1 - ((kMonth.getDay() + 6) % 7)); n = 42; }
    else { start = new Date(kSel); start.setDate(kSel.getDate() - ((kSel.getDay() + 6) % 7)); n = 7; const e = new Date(start); e.setDate(e.getDate() + 6); txt($('kTitle'), `${start.getDate()}.–${e.getDate()}. ${MON[e.getMonth()].slice(0, 3)}`); }
    let h = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(w => `<div class="wd">${w}</div>`).join('');
    const max = kView === 'monat' ? 2 : 6;
    for (let i = 0; i < n; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i); const ev = evOn(d);
      h += `<div class="d ${kView === 'monat' && d.getMonth() !== kMonth.getMonth() ? 'out' : ''} ${+d === +td ? 'today' : ''} ${+d === +kSel ? 'sel' : ''}" data-d="${Z.iso(d)}">${d.getDate()}${ev.slice(0, max).map(e => `<span class="ev" style="background:${(P[e.w] || P.g)[1]}cc">${e.t && !e.span ? e.t + ' ' : ''}${esc(e.n)}</span>`).join('')}${ev.length > max ? `<span class="ev" style="background:none;color:#aab4be">+${ev.length - max}</span>` : ''}</div>`;
    }
    const c = $('cal'); c.className = 'cal' + (kView === 'woche' ? ' week' : ''); put(c, h);
    const ev = evOn(kSel);
    txt($('agTitle'), +kSel === +td ? 'Heute' : kSel.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }));
    put($('agenda'), ev.length ? ev.map(e => { const p = P[e.w] || P.g; return `<div class="it"><span class="agt">${e.span || !e.t ? 'ganzt.' : esc(e.t)}</span><i class="led" style="background:${p[1]};box-shadow:0 0 5px ${p[1]}"></i><span><b>${esc(e.n)}</b>${e.e && !e.span ? ` <span class="sub">bis ${esc(e.e)}</span>` : ''}</span><em>${p[0]}</em></div>`; }).join('') : '<div class="sub" style="padding:8px 0">Keine Termine – frei! 🎉</div>');
    renderTodos();
  }
  function renderTodos() {
    const P = Z.who(PERS_DEF);
    put($('tdLists'), Z.LISTS.map(([k, n]) => `<button data-l="${k}" class="${k === tdList ? 'on' : ''}">${n} ${Z.todos(k).filter(t => !t.done).length}</button>`).join(''));
    const L = Z.todos(tdList);
    put($('todos'), L.map(t => { const c = (P[t.who] || P.g)[1]; return `<div class="it todo ${t.done ? 'done' : ''}" data-t="${esc(t.id)}"><i class="ck">${t.done ? '✓' : ''}</i><span>${esc(t.text)}${t.note ? ` <span class="sub">${esc(t.note)}</span>` : ''}</span>${t.done ? '<i class="tdx" data-tdx title="Löschen">✕</i>' : ''}<i class="who" data-who style="background:${c}33;color:${c}">${t.who === 'd' ? 'D' : t.who === 'i' ? 'I' : 'W'}</i></div>`; }).join('') || '<div class="sub" style="padding:8px 0">Noch nichts auf der Liste.</div>');
  }

  // ---------------------------------------------------------------- Wecker
  const WD7 = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  let editAl = '';
  function renderWecker() {
    const w = Z.W(), info = Z.alarmInfo();
    txt($('wkStatus'), info.state);
    if (!editAl) put($('alarms'), w.alarms.map(a => {
      const ts = Z.times(a);
      return `<div class="box alarm-c ${a.an ? '' : 'off'}" data-a="${esc(a.id)}">
        <div class="row"><div><div class="sub">${esc(a.titel || 'Wecker')}${a.ton === false ? ' · nur Licht' : ''}</div><div class="t" data-edit="${esc(a.id)}">${esc(a.zeit)}${a.bis ? `<small>– ${esc(a.bis)} · alle ${a.alle} Min</small>` : ''}</div></div><button class="sw ${a.an ? 'on' : ''}" data-tog="${esc(a.id)}" aria-label="Wecker an/aus"></button></div>
        <div class="row"><div class="days">${WD7.map((d, j) => `<button class="${a.tage.includes(j) ? 'on' : ''}" data-day="${esc(a.id)},${j}">${d}</button>`).join('')}</div><button class="del" data-del="${esc(a.id)}">Löschen</button></div>
        ${ts.length > 1 ? `<div class="times">${ts.map(t => `<span>${t}</span>`).join('')}</div>` : ''}</div>`;
    }).join('') || '<div class="box sub">Noch kein Wecker.</div>');
    if (R.activeElement !== $('sr')) $('sr').value = w.vorlauf;
    txt($('srVal'), w.vorlauf + ' Min');
    $$('#tone button').forEach(b => b.classList.toggle('on', b.dataset.t === w.ton));
    $('skip').classList.toggle('on', info.skip);
    txt($('skipSub'), info.skip ? 'Morgen klingelt kein Wecker – nochmal tippen für rückgängig' : 'Einmalig, rückgängig möglich');
    // Fernseher beim Wecken
    const ftv = Z.cfg()?.fernseher, wt = Z.wtv();
    $('wtvBox').hidden = !ftv;
    if (ftv) {
      $('wtvSw').classList.toggle('on', !!wt.an);
      put($('wtvApps'), ftv.apps.map(x => `<button class="chip ${x.name === wt.app ? 'on' : ''}" data-wapp="${esc(x.name)}">${esc(x.name)}</button>`).join(''));
      if (R.activeElement !== $('wtvVol')) $('wtvVol').value = wt.lautstaerke;
      txt($('wtvVl'), String(wt.lautstaerke));
      $('wtvBox').classList.toggle('dim', !wt.an);
    }
  }
  // Weck-Bildschirm (Test bzw. Vorschau)
  function openRing() {
    const info = Z.alarmInfo(), n = info.n;
    alarmAt = n ? n.at : new Date(); snoozes = 0;
    const me = Z.me()?.name || '';
    txt($('ringLbl'), 'Guten Morgen' + (me ? ', ' + me : '') + ' ☀️');
    ringUpd();
    $('ring').classList.add('open'); ringOn = true;
  }
  function ringUpd() {
    const w = Z.S.wetter, day = new Date(alarmAt); day.setHours(0, 0, 0, 0);
    const first = Z.evOn(Z.iso(day)).find(x => x.t);
    txt($('ringTime'), alarmAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
    const bits = [`Ton: ${Z.W().ton}`, snoozes ? `${snoozes}× geschlummert` : '', w?.heute ? `${w.ort} ${w.heute.min}° → ${w.heute.max}°` : '', first ? `${first.n} ab ${first.t}` : 'heute keine Termine'];
    txt($('ringSub'), bits.filter(Boolean).join(' · '));
  }
  function closeRing() { $('ring')?.classList.remove('open'); ringOn = false; }

  // ---------------------------------------------------------------- Einstellungen
  function renderEinst() {
    const L = Z.local, st = Z.status(), X = window.ZHX, p = X?.prefs() || {}, tv = Z.cfg()?.fernseher;
    $$('[data-set]').forEach(b => b.classList.toggle('on', b.dataset.set === 'perf' ? Z.perfOn() : !!L[b.dataset.set]));
    $$('#saverMin button').forEach(b => b.classList.toggle('on', +b.dataset.m === L.saverMin));
    txt($('stopName'), p.haltestelle ? p.haltestelle.name : 'Keine Haltestelle gewählt');
    $$('#artSeg button').forEach(b => b.classList.toggle('on', !!p.arten?.[b.dataset.art]));
    $('artRow').hidden = !p.haltestelle;
    txt($('fahrtT'), 'Fahrt zu ' + (Z.partner()?.name || 'Ida'));
    txt($('fahrtV'), p.fahrt?.von || p.fahrt?.nach ? `${p.fahrt.von?.name || '?'} → ${p.fahrt.nach?.name || '?'}` : 'Start und Ziel, wenn ihr euch in den nächsten 24 h seht');
    $('kinoRow').hidden = !tv?.titel || st.test;
    $('kino').classList.toggle('on', !!Z.S.settings.fernseher?.kinolicht);
    txt($('verVal'), window.WIR_VERSION || '…');
    const led = c => `<i class="led" style="background:${c};box-shadow:0 0 6px ${c}"></i>`;
    const G = '#3cbf6a', O = '#f6a23c', Rr = '#ff5a5a';
    put($('stList'), `<div class="it">${led(st.bad ? Rr : G)}<span>Home Assistant</span><em>${st.stale ? 'Dienst nicht erreichbar' : st.test ? 'bereit (Test)' : st.connected ? 'verbunden' : 'getrennt' + (st.error ? ': ' + esc(st.error) : '')}</em></div>`
      + `<div class="it">${led(G)}<span>Wir-App</span><em>angemeldet als ${esc(Z.me()?.name || '…')}</em></div>`
      + `<div class="it">${led(st.test || st.kalTest ? O : G)}<span>Modus</span><em>${st.test ? 'Testmodus (simulierte Daten)' : st.kalTest ? 'echt · Kalender mit Testterminen' : 'echte Daten'}</em></div>`);
    const c = Z.cfg() || {}, K = c.klima || {};
    put($('devList'), `<div class="it">💡<span>${esc((c.lampen || []).map(l => l.name).join(' · ') || '–')}</span><em>light.*</em></div>`
      + (tv ? `<div class="it">📺<span>${esc(tv.name)}</span><em>${esc(tv.entity_id)}</em></div>` : '')
      + (K.temperatur || K.luftfeuchte ? `<div class="it">🌡️<span>Raumklima</span><em>${esc([K.temperatur, K.luftfeuchte].filter(Boolean).join(', ').replace(/sensor\./g, ''))}</em></div>` : '')
      + ((c.sensoren || []).length ? `<div class="it">🪟<span>${esc(c.sensoren.map(x => x.name).join(' · '))}</span><em>binary_sensor.*</em></div>` : ''));
  }
  // Haltestellen-Suche (eigene Haltestelle, Start und Ziel der Fahrt)
  let ortTarget = '', ortT = 0, ortRes = [];
  function openOrt(target) {
    ortTarget = target; ortRes = [];
    const label = target === 'haltestelle' ? 'Haltestelle für die Abfahrten' : target === 'von' ? 'Start der Fahrt' : 'Ziel der Fahrt';
    put($('lbox'), `<div class="chd"><div><b>${label}</b><small>Nur für dich gespeichert · Transitous (ohne Gewähr)</small></div><button data-lx aria-label="Schließen">✕</button></div>
      <div class="tdadd"><input id="ortQ" type="search" placeholder="Haltestelle suchen …" autocomplete="off" spellcheck="false" enterkeyhint="search"></div>
      <div class="list ortres" id="ortRes"><div class="sub">Mindestens 3 Buchstaben</div></div>
      <button class="cpow" data-ortdel>Entfernen</button>`);
    $('lpop').classList.add('open');
    setTimeout(() => $('ortQ')?.focus(), 50);
  }
  function openList(title, sub, rows) {
    ortTarget = '';
    put($('lbox'), `<div class="chd"><div><b>${esc(title)}</b><small>${esc(sub)}</small></div><button data-lx aria-label="Schließen">✕</button></div><div class="list">${rows}</div>`);
    $('lpop').classList.add('open');
  }

  // ---------------------------------------------------------------- Partner
  const colPath = (x, base, w, h) => { const r = Math.min(3, w / 2, h); return `M${(x - w / 2).toFixed(1)} ${base}V${(base - h + r).toFixed(1)}q0 -${r} ${r} -${r}h${(w - 2 * r).toFixed(1)}q${r} 0 ${r} ${r}V${base}Z`; };
  function renderPartner() {
    const X = window.ZHX, p = Z.partner(), name = esc(p?.name || 'Ida'), n = Z.meetIn(), pr = X.presence();
    txt($('ptCd'), Z.wiedersehen());
    $$('#p-partner .x-ph b')[0].textContent = p?.name || 'Noch kein Partner-Konto';
    const av = $$('#p-partner .x-av')[0]; txt(av, (p?.name || 'I').slice(0, 1).toUpperCase()); av.classList.toggle('on', pr.online);
    txt($('ptSeen'), pr.txt);
    $('ptCd').hidden = n == null;
    txt($$('#p-partner .ph .sub')[0], `${p?.name || 'Ida'} und du`);
    const f = n == null ? 0 : Math.max(0, Math.min(1, 1 - n / 30)), r = 24, c = 2 * Math.PI * r;
    put($('ptFacts'), `<div class="box x-fact"><b>${esc(Z.together() || '–')}</b><span>Tage zusammen</span></div>
      <div class="box x-fact x-fring"><svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="${r}" class="rbg"/><circle cx="30" cy="30" r="${r}" class="rfg" stroke-dasharray="${(c * f).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 30 30)"/></svg>
      <div><b>${n == null ? '–' : n <= 0 ? 'heute' : n}</b><span>${n == null ? 'kein Treffen geplant' : n <= 0 ? 'seht ihr euch' : n === 1 ? 'Tag bis zum Wiedersehen' : 'Tage bis zum Wiedersehen'}</span></div></div>`);
    const PING = X.pingDays(), Wd = 520, H = 250, top = 12, base = H - 24, step = Wd / 14, bw = 10, max = Math.max(1, ...PING.flatMap(d => [d.a, d.b])), hg = v => (v ? Math.max(3, v / max * (base - top)) : 0);
    const sa = PING.reduce((s, d) => s + d.a, 0), sb = PING.reduce((s, d) => s + d.b, 0);
    const bars = PING.map((d, i) => {
      const x = i * step + step / 2, dt = new Date(d.t), lab = i === 13 ? 'heute' : i % 2 ? WDS[dt.getDay()] : '';
      return `<g class="x-hit" data-tip="${WDS[dt.getDay()]} ${dt.getDate()}.${dt.getMonth() + 1}.: du ${d.a} · ${name} ${d.b}"><rect x="${(x - step / 2).toFixed(1)}" y="0" width="${step.toFixed(1)}" height="${H}" fill="transparent"/>`
        + (d.a ? `<path d="${colPath(x - bw / 2 - 1, base, bw, hg(d.a))}" class="ba"/>` : '') + (d.b ? `<path d="${colPath(x + bw / 2 + 1, base, bw, hg(d.b))}" class="bb"/>` : '')
        + (lab ? `<text x="${x.toFixed(1)}" y="${base + 17}" text-anchor="middle" class="ax${i === 13 ? ' axn' : ''}">${lab}</text>` : '') + '</g>';
    }).join('');
    put($('ptChart'), `<div class="x-chh"><b>Aneinander gedacht · 14 Tage</b><span class="x-leg"><i class="la"></i>du ${sa}<i class="lb"></i>${name} ${sb}</span><span class="x-cap">${X.D.pings ? 'antippen für Werte' : 'lädt …'}</span></div>
      <svg viewBox="0 0 ${Wd} ${H}" class="x-svg"><line x1="0" x2="${Wd}" y1="${base}" y2="${base}" class="x-base"/>${bars}</svg>`);
    const g = X.D.ping;
    txt($('ptLast'), g ? `Letzter Ping: ${g.from === X.myId() ? 'du → ' + (p?.name || 'Ida') : (p?.name || 'Ida') + ' → dich'} · ${X.ago(X.pbMs(g.created))}` : '');
  }

  // ---------------------------------------------------------------- Abfahrten
  const lineTag = x => `<span class="x-line" style="--lc:${esc(x.farbe || '#5a6a7a')}">${esc(x.linie || '–')}</span>`;
  const dTag = (d, aus) => (aus ? '<em class="x-tag bad">fällt aus</em>' : d == null ? '' : d > 0 ? `<em class="x-tag ${d >= 5 ? 'bad' : 'warn'}">+${d}</em>` : '<em class="x-tag ok">pünktlich</em>');
  function renderAbf() {
    const X = window.ZHX, MIN = X.MIN, p = X.prefs(), a = X.D.abf;
    $$('#abArt [data-a]').forEach(b => b.classList.toggle('on', !!p.arten[b.dataset.a]));
    if (!p.haltestelle || a?.aus) { txt($('abSub'), 'keine Haltestelle gewählt'); put($('abBody'), '<div class="box x-empty">Wähle deine Haltestelle, dann stehen hier die nächsten Abfahrten.<br><button class="btn" data-ort="haltestelle" style="margin-top:10px">Haltestelle wählen</button></div>'); return; }
    if (!a) { txt($('abSub'), p.haltestelle.name); put($('abBody'), `<div class="box x-empty">${X.D.abfErr ? esc(X.D.abfErr) : 'Lädt …'}</div>`); return; }
    if (a.at && Date.now() - a.at > 20 * MIN) { txt($('abSub'), a.haltestelle || a.name || ''); put($('abBody'), '<div class="box x-empty">Fahrplan gerade nicht erreichbar – versuche es gleich wieder.</div>'); return; }
    const now = Date.now(), L = a.abfahrten || [], mt = t => Math.round((Date.parse(t) - now) / MIN);
    txt($('abSub'), (a.haltestelle || a.name || p.haltestelle.name) + ' · Stand ' + X.hm(a.stale ? a.at : now));
    const next = L.find(x => !x.ausfall && mt(x.echt) >= 0), late = L.filter(x => !x.ausfall && x.delay > 0).length, gone = L.filter(x => x.ausfall).length;
    const hero = next ? `<div class="box x-next">${lineTag(next)}<div><small>Nächste Abfahrt</small><b>${esc(next.ziel)}</b></div><strong>${mt(next.echt) <= 0 ? 'jetzt' : mt(next.echt) + '<small>Min</small>'}</strong></div>` : '';
    const pills = `<div class="x-pills"><span><b>${L.length}</b> Abfahrten</span><span class="${late ? 'warn' : ''}"><b>${late}</b> verspätet</span><span class="${gone ? 'bad' : ''}"><b>${gone}</b> fallen aus</span></div>`;
    const Wd = 520, H = 96, Xp = m => 15 + m / 60 * (Wd - 30), soon = L.filter(x => !x.ausfall && mt(x.echt) >= 0 && mt(x.echt) <= 60), lanes = [];
    const ticks = [0, 10, 20, 30, 40, 50, 60].map(m => `<line x1="${Xp(m)}" x2="${Xp(m)}" y1="0" y2="${H - 17}" class="x-grid"/><text x="${Xp(m)}" y="${H - 4}" text-anchor="middle" class="ax${m ? '' : ' axn'}">${m ? '+' + m : 'jetzt'}</text>`).join('');
    const marks = soon.map(x => {
      const m = mt(x.echt), x0 = Xp(m); let l = 0; while (l < 4 && lanes[l] != null && x0 - lanes[l] < 32) l++; l = Math.min(l, 3); lanes[l] = x0;
      return `<g class="x-hit" data-tip="${esc(x.linie)} → ${esc(x.ziel)} · ${X.hm(x.echt)}${m <= 0 ? ' · jetzt' : ' · in ' + m + ' Min'}"><rect x="${(x0 - 15).toFixed(1)}" y="${3 + l * 15}" width="30" height="12.5" rx="6.2" fill="${esc(x.farbe || '#5a6a7a')}"/><text x="${x0.toFixed(1)}" y="${12.3 + l * 15}" text-anchor="middle" class="tl">${esc(x.linie || '–')}</text></g>`;
    }).join('');
    const tl = `<div class="box x-chart"><div class="x-chh"><b>Die nächste Stunde</b><span class="x-cap">${soon.length} Abfahrten · antippen</span></div><svg viewBox="0 0 ${Wd} ${H}" class="x-svg">${ticks}${marks}</svg></div>`;
    const rows = L.map(x => { const m = mt(x.echt), plan = x.delay > 0 ? Date.parse(x.echt) - x.delay * MIN : Date.parse(x.echt); return `<div class="x-dep${x.ausfall ? ' x' : ''}${m <= 2 && !x.ausfall ? ' now' : ''}">${lineTag(x)}<span class="dir">${esc(x.ziel)}<small>${x.art === 'bus' ? 'Bus · ' : x.art === 'bahn' ? 'Zug · ' : ''}plan ${X.hm(plan)}</small></span>${dTag(x.delay, x.ausfall)}<span class="min">${x.ausfall ? '–' : m <= 0 ? 'jetzt' : m < 60 ? m + ' Min' : X.hm(x.echt)}</span></div>`; }).join('') || '<div class="x-empty">Gerade keine Abfahrten</div>';
    let trip = '';
    if (a.fahrt?.verbindungen) {
      trip = `<div class="box x-trip"><div class="row"><h3>Fahrt zu ${esc(Z.partner()?.name || 'Ida')}</h3><span class="sub">${esc(a.fahrt_von || '')} → ${esc(a.fahrt_nach || '')}</span></div>`
        + (a.fahrt.verbindungen.map(v => {
          const dA = Math.max(0, Math.round((Date.parse(v.ab) - Date.parse(v.abPlan)) / MIN));
          return `<div class="x-con${v.ausfall ? ' x' : ''}"><div><b>${X.hm(v.abPlan)}</b>${dA ? ` <em class="x-tag ${dA >= 5 ? 'bad' : 'warn'}">+${dA}</em>` : ''} → <b>${X.hm(v.anPlan)}</b><small>${Math.floor(v.dauer / 60)}:${p2(v.dauer % 60)} h · ${v.umstiege ? v.umstiege + (v.umstiege === 1 ? ' Umstieg' : ' Umstiege') : 'direkt'}${v.ausfall ? ' · Ausfall' : ''}</small></div><div class="lin">${v.linien.map(l => `<span class="${l.ausfall ? 'strike' : ''}">${esc(l.linie || (l.art === 'bus' ? 'Bus' : 'Zug'))}</span>`).join('<i>›</i>')}</div></div>`;
        }).join('') || '<div class="x-empty">Keine Verbindung gefunden</div>') + '</div>';
    }
    put($('abBody'), `<div class="g2" style="grid-template-columns:1.25fr 1fr"><div class="col">${hero}${pills}${soon.length ? tl : ''}${trip}</div><div class="col"><div class="box"><h3>Abfahrtstafel</h3><div class="x-deps">${rows}</div></div></div></div>`);
  }

  // ---------------------------------------------------------------- Pakete
  const PAK = { heute: ['Zustellung heute', 'teal', 2], unterwegs: ['unterwegs', 'vio', 1], abholbereit: ['abholbereit', 'teal', 3], zugestellt: ['zugestellt', 'ok', 3], problem: ['Problem', 'bad', 1], unbekannt: ['noch keine Daten', 'mut', 0] };
  const STEPS = ['verschickt', 'unterwegs', 'heute', 'da'], ORDER = { heute: 0, abholbereit: 1, problem: 2, unterwegs: 3, unbekannt: 4, zugestellt: 5 };
  function renderPak() {
    const X = window.ZHX, P = X.D.pak;
    if (!P || P.aus) { txt($('pkSub'), P ? 'ausgeschaltet' : 'lädt …'); put($('pkBody'), `<div class="box x-empty">${P ? 'Pakete sind ausgeschaltet' : 'Lädt …'}</div>`); return; }
    const L = (P.pakete || []).slice().sort((a, b) => (ORDER[a.status] ?? 3) - (ORDER[b.status] ?? 3)), cnt = s => L.filter(x => x.status === s).length, n = L.filter(x => x.status !== 'zugestellt').length;
    txt($('pkSub'), (n ? n + ' unterwegs' : 'alles da') + ' · 17TRACK' + (P.test ? ' · Testmodus' : '') + (P.at ? ' · Stand ' + X.hm(P.at) : ''));
    const pills = `<div class="x-pills"><span class="${cnt('heute') ? 'teal' : ''}"><b>${cnt('heute')}</b> kommen heute</span><span><b>${cnt('unterwegs')}</b> unterwegs</span><span class="${cnt('abholbereit') ? 'teal' : ''}"><b>${cnt('abholbereit')}</b> abholbereit</span><span class="${cnt('problem') ? 'bad' : ''}"><b>${cnt('problem')}</b> Problem</span></div>`;
    const cards = L.map((x, i) => {
      const [lbl, cls, step] = PAK[x.status] || PAK.unterwegs, bad = x.status === 'problem', k = x.name + '|' + i, open = pkOpen === k;
      const track = STEPS.map((s, j) => `<i class="${j <= step ? 'on' : ''}${bad && j === step ? ' badstep' : ''}"><small>${x.status === 'abholbereit' && j === 3 ? 'abholen' : s}</small></i>`).join('');
      return `<div class="box x-pc${x.status === 'zugestellt' ? ' done' : ''}${open ? ' open' : ''}" data-pk="${esc(k)}"><div class="pct"><b>${esc(x.name)}</b><span class="x-st ${cls}">${lbl}</span></div><small class="from">${esc(x.ort || '')}</small>
        <div class="x-steps ${cls}" style="--p:${step / 3}">${track}</div><small class="pinfo">${esc(x.text || '')}${x.zeit ? ' · ' + X.dateTxt(x.zeit) : ''}</small>
        ${open ? `<div class="x-ver"><div class="cur"><i></i><span>${esc(x.text || lbl)}</span><em>${esc(X.dateTxt(x.zeit))}</em></div>${x.ort ? `<div><i></i><span>${esc(x.ort)}</span><em>Ort</em></div>` : ''}</div>` : ''}</div>`;
    }).join('') || `<div class="box x-empty">${P.fehlt ? '17TRACK ist in Home Assistant nicht eingerichtet' : 'Keine Pakete unterwegs'}</div>`;
    put($('pkBody'), (L.length ? pills : '') + `<div class="x-pgrid">${cards}</div>`);
  }

  // ---------------------------------------------------------------- System
  const AT = { g: ['ok', 'alles gut'], y: ['warn', 'Achtung'], r: ['bad', 'Problem'], n: ['mut', 'unbekannt'] };
  function area(K, key, Wd = 520, H = 118) {
    const ok = K.filter(p => Number.isFinite(p[key]));
    if (ok.length < 2) return '<div class="x-empty">Die Kurve füllt sich in den nächsten Stunden.</div>';
    const top = 8, base = H - 20, t0 = ok[0].t, span = Math.max(1, ok[ok.length - 1].t - t0), Xp = t => (t - t0) / span * Wd, Y = v => base - Math.max(0, Math.min(100, v)) / 100 * (base - top);
    const line = ok.map((p, i) => `${i ? 'L' : 'M'}${Xp(p.t).toFixed(1)} ${Y(p[key]).toFixed(1)}`).join(''), lp = ok[ok.length - 1];
    const grid = [50, 100].map(v => `<line x1="0" x2="${Wd}" y1="${Y(v)}" y2="${Y(v)}" class="x-grid"/><text x="2" y="${Y(v) - 3}" class="ax">${v} %</text>`).join('');
    const nH = Math.min(48, ok.length), hits = Array.from({ length: nH }, (_, i) => { const p = ok[Math.round(i / Math.max(1, nH - 1) * (ok.length - 1))]; return `<g class="x-hit" data-tip="${window.ZHX.hm(p.t)} Uhr: ${String(p[key]).replace('.', ',')} %"><rect x="${(Xp(p.t) - Wd / nH / 2).toFixed(1)}" y="0" width="${(Wd / nH).toFixed(1)}" height="${H}" fill="transparent"/><circle cx="${Xp(p.t).toFixed(1)}" cy="${Y(p[key]).toFixed(1)}" r="3.5" class="hp"/></g>`; }).join('');
    return `<svg viewBox="0 0 ${Wd} ${H}" class="x-svg"><defs><linearGradient id="xg-${key}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".35"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>
      <line x1="0" x2="${Wd}" y1="${base}" y2="${base}" class="x-base"/>${grid}<path d="${line}L${Wd} ${base}L0 ${base}Z" fill="url(#xg-${key})"/><path d="${line}" class="x-ln"/><circle cx="${Xp(lp.t)}" cy="${Y(lp[key])}" r="4" class="x-end"/>${hits}
      <text x="0" y="${H - 3}" class="ax">${window.ZHX.hm(t0)}</text><text x="${Wd / 2}" y="${H - 3}" text-anchor="middle" class="ax">${window.ZHX.hm(t0 + span / 2)}</text><text x="${Wd}" y="${H - 3}" text-anchor="end" class="ax axn">jetzt</text></svg>`;
  }
  function renderSys() {
    const X = window.ZHX, s = X.D.sys;
    if (!s) { txt($('sySub'), 'lädt …'); put($('syBody'), '<div class="box x-empty">Lädt …</div>'); return; }
    if (!sysOpen && s.gruppen[0]) sysOpen = (s.gruppen.find(g => g.a === 'r') || s.gruppen.find(g => g.a === 'y') || s.gruppen[0]).k;
    const all = s.gruppen.flatMap(g => g.items).filter(i => !i.ohne_ampel), c = a => all.filter(i => i.a === a).length;
    txt($('sySub'), 'VPS, Home Assistant und Backups · geprüft ' + X.hm(s.at) + (s.test ? ' · Testdaten' : ''));
    const heroT = { g: 'Alles im grünen Bereich', y: 'Ein Auge drauf haben', r: 'Etwas braucht dich' }[s.a] || 'Status unbekannt';
    const hero = `<div class="box x-shero ${(AT[s.a] || AT.n)[0]}"><i class="x-pulse"></i><div><b>${heroT}</b><small>${c('g')} gut · ${c('y')} Achtung · ${c('r')} Problem</small></div></div>`;
    const tiles = s.gruppen.map(g => { const bad = g.items.filter(i => !i.ohne_ampel && (i.a === 'y' || i.a === 'r')).length; return `<button class="box x-tile${sysOpen === g.k ? ' on' : ''}" data-g="${esc(g.k)}"><i class="x-dot ${(AT[g.a] || AT.n)[0]}"></i><b>${esc(g.name)}</b><small>${(AT[g.a] || AT.n)[1]}${bad ? ` · ${bad} ${bad === 1 ? 'Punkt' : 'Punkte'}` : ` · ${g.items.length} geprüft`}${g.updates?.length ? ` · ${g.updates.length} Updates` : ''}</small></button>`; }).join('');
    const g = s.gruppen.find(x => x.k === sysOpen);
    const itemTxt = i => [i.wert, i.zeit ? (i.k === 'deploy' ? X.dateTxt(i.zeit) : X.ago(Date.parse(i.zeit))) : ''].filter(Boolean).join(' · ');
    const det = g ? `<div class="box x-det"><h3>${esc(g.name)}</h3><div class="list">${g.items.map(i => `<div class="it" title="${esc(i.info || '')}"><i class="x-dot ${i.ohne_ampel ? 'mut' : (AT[i.a] || AT.n)[0]}"></i><span>${esc(i.name)}</span><em>${esc(itemTxt(i))}</em></div>`).join('')}</div>`
      + (g.updates?.length ? `<div class="x-up"><b>Updates verfügbar</b>${g.updates.map(u => `<div><span>${esc(u.name)}</span><em>${esc(u.von)} → ${esc(u.nach)}</em></div>`).join('')}</div>` : '') + '</div>' : '';
    const K = s.kurve || [];
    const charts = [['last', 'Last', 'Prozessor, alle Kerne', '#f28a3c'], ['ram', 'Arbeitsspeicher', 'belegt', '#c38bff'], ['disk', 'Festplatte', 'belegt', '#3cc7c0']].map(([k, n, sub, col]) => {
      const v = K.map(p => p[k]).filter(Number.isFinite);
      return `<div class="box x-chart x-kv" style="color:${col};--c:${col}"><div class="x-chh"><b>${n}<small>${sub}</small></b><span class="x-big">${v.length ? Math.round(v[v.length - 1]) : '–'}<small> %</small></span></div><div class="x-cap">${v.length ? `min ${Math.round(Math.min(...v))} · max ${Math.round(Math.max(...v))} % · 24 Std.` : ''}</div>${area(K, k)}</div>`;
    }).join('');
    put($('syBody'), `<div class="g2" style="grid-template-columns:1fr 1.15fr"><div class="col">${hero}<div class="x-tiles">${tiles}</div>${det}</div><div class="col">${charts}</div></div>`);
  }

  // ---------------------------------------------------------------- Farbe & Helligkeit (gedrückt halten)
  function openColor(key) { cpId = key; renderCp(); $('cpop').classList.add('open'); }
  function renderCp() {
    const d = lampOf(cpId); if (!d || !$('cpop').classList.contains('open') && cpId == null) return;
    txt($('cpName'), d.name); txt($('cpSub'), (d.l.raum || ROOM[d.key] || '') + ' · ' + (d.na ? 'nicht erreichbar' : d.on ? `an · ${d.k}` : 'aus'));
    $('cpPrev').style.background = d.c; $('cpPrev').style.boxShadow = `0 0 24px ${d.c}`;
    $('cpBr').hidden = !d.dimm;
    txt($('cpB'), d.b + ' %'); if (!cpDrag) $('cpRange').value = d.b;
    if (/^#[0-9a-f]{6}$/i.test(d.c)) $('cpFree').value = d.c;
    $$('#cpCols [data-c]').forEach(b => b.classList.toggle('on', b.dataset.c.toLowerCase() === d.c.toLowerCase()));
    txt($('cpPow'), d.on ? 'Ausschalten' : 'Einschalten');
  }
  let cpDrag = false;

  // ---------------------------------------------------------------- Bildschirmschoner + Nachtdimmung
  let saverT = 0;
  function openSaver() {
    if (!W || ringOn) return;
    const n = new Date(), info = Z.alarmInfo(), k = Z.klima();
    txt($('saverTime'), n.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
    txt($('saverSub'), (info.n ? `⏰ ${info.when} ${info.n.a.zeit} · ` : '') + `${fmt(k.t)} °C · ${fmt(k.hu, 0)} %` + (Z.S.wetter?.now ? ` · ${Z.S.wetter.ort} ${Z.S.wetter.now.t}°` : ''));
    $('saver').classList.add('open');
  }
  function armSaver() { clearTimeout(saverT); if (Z?.active()) saverT = setTimeout(openSaver, Z.local.saverMin * 60000); }
  function renderNight() { const h = new Date().getHours(); $('nightdim').style.opacity = Z.local.night && (h >= 22 || h < 6) ? .35 : 0; }

  // ---------------------------------------------------------------- Ereignisse
  function wire() {
    const on = (id, ev, fn) => $(id).addEventListener(ev, fn);
    on('nav', 'click', e => { const b = e.target.closest('button'); if (b) go(b.dataset.p); });
    // Raumansicht: Lampe tippen = an/aus (+ Regler), Mitte = alles, Sensor = Werte, Fernseher = an/aus
    on('crop', 'click', e => {
      const n = e.target.closest('[data-id]'); if (!n) return;
      const id = n.dataset.id;
      if (id === 'sensor') { Z.toast(sensorTxt()); return; }
      if (id === 'alle') { const any = Z.lamps().some(l => l.on) || Z.tvView()?.on; Z.allOff(!any); Z.toast(any ? 'Alles aus' : 'Alle Lichter an'); return; }
      if (id === 'tv') { Z.tvPower(); return; }
      const l = lampOf(id); if (!l) return;
      sel = id; const o = Z.lampToggle(id); Z.toast(`${l.name} ${o ? 'an' : 'aus'}`);
    });
    on('rtabs', 'click', e => { const b = e.target.closest('[data-s]'); if (b) Z.scene(b.dataset.s); });
    // senkrechter Helligkeitsregler
    const track = $('track');
    const brSet = (e, final) => { const s = lampOf(sel); if (!s || !s.dimm) return; const r = track.getBoundingClientRect(); const v = Math.max(1, Math.min(100, Math.round((r.bottom - e.clientY) / r.height * 100))); $('fill').style.height = v + '%'; $('fill').style.background = ''; txt($('brVal'), v + '%'); Z.lampSet(sel, { brightness_pct: v }, final); };
    track.addEventListener('pointerdown', e => { const s = lampOf(sel); if (!s?.dimm) { if (s) Z.lampToggle(sel); return; } brDrag = true; Z.drag(s.id); track.setPointerCapture(e.pointerId); brSet(e); });
    track.addEventListener('pointermove', e => { if (brDrag) brSet(e); });
    const brEnd = e => { if (!brDrag) return; brDrag = false; Z.drag(null); brSet(e, true); };
    track.addEventListener('pointerup', brEnd); track.addEventListener('pointercancel', () => { brDrag = false; Z.drag(null); });
    on('brPower', 'click', () => { const s = lampOf(sel); if (s) Z.lampToggle(sel); });
    on('fs', 'click', () => { const v = $('view'); if (document.fullscreenElement) document.exitFullscreen(); else v.requestFullscreen?.().catch(() => {}); });
    on('tiles', 'click', e => {
      const t = e.target.closest('.tile'); if (!t) return;
      const id = t.dataset.id;
      if (id === 'tv') { Z.tvPower(); return; }
      const l = lampOf(id); if (!l) return; sel = id; const o = Z.lampToggle(id); Z.toast(`${l.name} ${o ? 'an' : 'aus'}`);
    });
    on('chart', 'click', e => { const b = e.target.closest('.bar'); if (b) { selBar = +b.dataset.i; renderPower(); } });
    // Kopf: Suche, Glocke, zurück
    on('q', 'keydown', e => {
      if (e.key !== 'Enter') return;
      const q = e.target.value.trim().toLowerCase(); if (!q) return;
      const tab = [['fernseh', 'tv'], ['tv', 'tv'], ['kalender', 'kal'], ['termin', 'kal'], ['todo', 'kal'], ['einkauf', 'kal'], ['wecker', 'wecker'], ['alarm', 'wecker'], ['einstell', 'einst'], ['partner', 'partner'], ['ida', 'partner'], ['ping', 'partner'], ['abfahrt', 'abf'], ['bus', 'abf'], ['bahn', 'abf'], ['zug', 'abf'], ['paket', 'pak'], ['sendung', 'pak'], ['system', 'sys'], ['backup', 'sys'], ['server', 'sys'], ['claude', 'claude']].find(([k]) => q.includes(k));
      const app = Z.cfg()?.fernseher?.apps.find(a => a.name.toLowerCase().includes(q)), lamp = Z.lamps().find(l => l.name.toLowerCase().includes(q)), sc = Z.scenes().find(s => s.name.toLowerCase().includes(q));
      if (app) { go('tv'); Z.tvApp(app.name); } else if (sc) Z.scene(sc.key); else if (tab && $('p-' + tab[1]) && !$$(`#nav [data-p="${tab[1]}"]`)[0]?.hidden) go(tab[1]); else if (lamp) { go('home'); sel = lamp.key; const o = Z.lampToggle(lamp.key); Z.toast(`${lamp.name} ${o ? 'an' : 'aus'}`); } else Z.toast('Nichts gefunden');
      e.target.value = ''; e.target.blur();
    });
    on('bell', 'click', () => {
      const N = Z.notes();
      openList('Meldungen', 'Das Wichtigste aus eurem Zuhause', N.map(x => `<div class="it">${isvg(NI[x.ic] || NI.alarm)}<span><b>${esc(x.b)}</b></span><em class="${x.warn ? 'warn' : ''}">${esc(x.s)}</em></div>`).join(''));
    });
    W.addEventListener('click', e => {
      if (e.target.closest('[data-back]')) { Z.back(); return; }
      const g = e.target.closest('[data-go]'); if (g) { go(g.dataset.go); return; }
      const h = e.target.closest('.x-hit');
      if (h) { const box = h.closest('.x-chart'); box.querySelectorAll('.x-hit.sel').forEach(x => x.classList.remove('sel')); h.classList.add('sel'); const c = box.querySelector('.x-cap'); if (c) { c.textContent = h.dataset.tip; c.classList.add('set'); } }
      const o = e.target.closest('[data-ort]'); if (o) openOrt(o.dataset.ort);
    });
    // Fernseher
    on('tvPow', 'click', () => Z.tvPower());
    on('npOff', 'click', () => { const v = Z.tvView(); if (v?.bildAus) Z.tvBild(); else Z.tvPower(true); });
    on('np', 'click', e => { const b = e.target.closest('[data-np]'); if (!b) return; const k = b.dataset.np; if (k === 'play') Z.tvPlay(); else Z.tvTrack(k === 'next' ? 1 : -1); });
    on('apps', 'click', e => { const b = e.target.closest('[data-app]'); if (b) Z.tvApp(b.dataset.app); });
    on('moreApps', 'click', e => { const b = e.target.closest('[data-more]'); if (b) Z.tvMore(+b.dataset.more); });
    on('srcs', 'click', e => { const b = e.target.closest('[data-src]'); if (b) Z.tvSrc(+b.dataset.src); });
    const keyHit = (el, k) => { el.classList.add('hit'); setTimeout(() => el.classList.remove('hit'), 180); Z.tvKey(k); };
    on('pad', 'click', e => { const g = e.target.closest('.pk'); if (g) keyHit(g, g.dataset.k); });
    $$('.rkeys button').forEach(b => b.addEventListener('click', () => keyHit(b, b.dataset.k)));
    on('vMinus', 'click', () => Z.tvVolStep(-1)); on('vPlus', 'click', () => Z.tvVolStep(1)); on('mute', 'click', () => Z.tvMute());
    const vb = $$('#p-tv .vbar')[0];
    const vSet = (e, fin) => { const v = Z.tvView(); if (!v) return; const r = vb.getBoundingClientRect(), f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); $('vFill').style.width = f * 100 + '%'; Z.tvVol(f * v.max, fin); };
    vb.addEventListener('pointerdown', e => { volDrag = true; Z.drag(Z.cfg()?.fernseher?.entity_id); vb.setPointerCapture(e.pointerId); vSet(e); });
    vb.addEventListener('pointermove', e => { if (volDrag) vSet(e); });
    vb.addEventListener('pointerup', e => { if (volDrag) { volDrag = false; Z.drag(null); vSet(e, true); } });
    on('bildaus', 'click', () => Z.tvBild());
    on('shotBtn', 'click', () => Z.tvShot()); on('shotNew', 'click', () => Z.tvShot()); on('shotX', 'click', () => Z.shotClose());
    const hb = $('hBar');
    const hSet = e => { const r = hb.getBoundingClientRect(), v = Math.max(0, Math.min(100, (e.clientX - r.left) / r.width * 100)); $('hFill').style.width = v + '%'; Z.tvHell(v); };
    hb.addEventListener('pointerdown', e => { hellDrag = true; hb.setPointerCapture(e.pointerId); hSet(e); });
    hb.addEventListener('pointermove', e => { if (hellDrag) hSet(e); });
    hb.addEventListener('pointerup', e => { if (hellDrag) { hellDrag = false; hSet(e); } });
    on('hMinus', 'click', () => Z.tvHell((Z.hell() ?? 50) - 10)); on('hPlus', 'click', () => Z.tvHell((Z.hell() ?? 50) + 10));
    const tt = $('tvText');
    const send = () => Z.tvText(tt.value, true).then(ok => { if (ok) tt.value = ''; });
    on('tvSend', 'click', send);
    tt.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); send(); } });
    on('tvDel', 'click', () => Z.tvTextDel());
    // Kalender
    on('cal', 'click', e => { const c = e.target.closest('[data-d]'); if (!c) return; const [y, m, d] = c.dataset.d.split('-').map(Number); kSel = new Date(y, m - 1, d); if (kView === 'monat' && kSel.getMonth() !== kMonth.getMonth()) kMonth = new Date(y, m - 1, 1); renderKal(); });
    on('kPrev', 'click', () => { if (kView === 'monat') kMonth = new Date(kMonth.getFullYear(), kMonth.getMonth() - 1, 1); else kSel = new Date(kSel.getFullYear(), kSel.getMonth(), kSel.getDate() - 7); renderKal(); });
    on('kNext', 'click', () => { if (kView === 'monat') kMonth = new Date(kMonth.getFullYear(), kMonth.getMonth() + 1, 1); else kSel = new Date(kSel.getFullYear(), kSel.getMonth(), kSel.getDate() + 7); renderKal(); });
    on('kToday', 'click', () => { kSel = TODAY(); kMonth = new Date(kSel.getFullYear(), kSel.getMonth(), 1); renderKal(); });
    on('kView', 'click', e => { const b = e.target.closest('[data-v]'); if (b) { kView = b.dataset.v; if (kView === 'monat') kMonth = new Date(kSel.getFullYear(), kSel.getMonth(), 1); renderKal(); } });
    on('kLeg', 'click', e => { const b = e.target.closest('[data-p]'); if (!b) return; const p = b.dataset.p; if (kOff.has(p)) kOff.delete(p); else kOff.add(p); renderKal(); });
    on('tdLists', 'click', e => { const b = e.target.closest('[data-l]'); if (b) { tdList = b.dataset.l; renderTodos(); } });
    on('tdForm', 'submit', e => { e.preventDefault(); const v = $('tdIn').value.trim(); if (!v) return; Z.todoAdd(tdList, v); $('tdIn').value = ''; });
    // To-dos: Tippen = abhaken, Kreis = Zuordnung, ✕ (erledigt) oder nach links wischen = löschen
    const TD = $('todos'); let sw = null, swiped = false;
    TD.addEventListener('pointerdown', e => { const t = e.target.closest('[data-t]'); if (t && !e.target.closest('[data-who],[data-tdx]')) sw = { t, x: e.clientX, y: e.clientY, dx: 0, id: e.pointerId }; });
    TD.addEventListener('pointermove', e => {
      if (!sw || e.pointerId !== sw.id) return;
      sw.dx = Math.min(0, e.clientX - sw.x);
      if (Math.abs(sw.dx) > 12 && Math.abs(sw.dx) > Math.abs(e.clientY - sw.y)) { if (!sw.moved) { try { sw.t.setPointerCapture(e.pointerId); } catch (_) {} } sw.moved = true; sw.t.style.transform = `translateX(${sw.dx}px)`; sw.t.style.opacity = 1 + sw.dx / 240; }
    });
    const swEnd = e => {
      if (!sw || e.pointerId !== sw.id) return;
      const s = sw; sw = null;
      if (!s.moved) return;
      swiped = true; setTimeout(() => { swiped = false; }, 60);
      if (s.dx < -90) Z.todoDel(s.t.dataset.t); else { s.t.style.transform = ''; s.t.style.opacity = ''; }
    };
    TD.addEventListener('pointerup', swEnd); TD.addEventListener('pointercancel', swEnd);
    TD.addEventListener('click', e => {
      if (swiped) return;
      const r = e.target.closest('[data-t]'); if (!r) return;
      if (e.target.closest('[data-tdx]')) Z.todoDel(r.dataset.t);
      else if (e.target.closest('[data-who]')) Z.todoWho(r.dataset.t);
      else Z.todoToggle(r.dataset.t);
    });
    // Wecker
    on('alarms', 'click', e => {
      const t = e.target; let x;
      if ((x = t.closest('[data-tog]'))) Z.alarm.toggle(x.dataset.tog);
      else if ((x = t.closest('[data-day]'))) { const [id, j] = x.dataset.day.split(','); Z.alarm.day(id, +j); }
      else if ((x = t.closest('[data-del]'))) Z.alarm.del(x.dataset.del);
      else if ((x = t.closest('[data-edit]'))) {
        const id = x.dataset.edit, a = Z.W().alarms.find(y => y.id === id); if (!a) return;
        editAl = id;
        x.outerHTML = `<input type="time" class="timein" value="${a.zeit.padStart(5, '0')}" data-ti="${esc(id)}">`;
        const inp = $('alarms').querySelector('[data-ti]'); inp.focus(); try { inp.showPicker(); } catch (_) {}
        const done = () => { if (!editAl) return; const v = inp.value; editAl = ''; last.delete($('alarms')); if (v) Z.alarm.time(id, v); renderWecker(); };
        inp.addEventListener('change', done); inp.addEventListener('blur', done);
      }
    });
    on('wkAdd', 'click', () => Z.alarm.add());
    on('sr', 'input', e => txt($('srVal'), e.target.value + ' Min'));
    on('sr', 'change', e => Z.alarm.vorlauf(+e.target.value));
    on('tone', 'click', e => { const b = e.target.closest('[data-t]'); if (b) Z.alarm.ton(b.dataset.t); });
    on('skip', 'click', () => Z.alarm.skip());
    on('wkTest', 'click', () => { openRing(); Z.alarm.test(); });
    on('wtvSw', 'click', () => Z.alarm.tv({ an: !Z.wtv().an }));
    on('wtvApps', 'click', e => { const b = e.target.closest('[data-wapp]'); if (b) Z.alarm.tv({ app: b.dataset.wapp, an: true }); });
    on('wtvVol', 'input', e => txt($('wtvVl'), e.target.value));
    on('wtvVol', 'change', e => Z.alarm.tv({ lautstaerke: +e.target.value }));
    on('snooze', 'click', () => { closeRing(); Z.toast('Schlummern · 10 Min'); });
    on('ringDash', 'click', () => { closeRing(); go('home'); });
    { let ht = 0, st = 0; const g = $('getup'), bar = g.querySelector('i');
      g.addEventListener('pointerdown', () => { st = Date.now(); clearInterval(ht); ht = setInterval(() => { const p = Math.min(1, (Date.now() - st) / 1200); bar.style.width = p * 100 + '%'; if (p >= 1) { clearInterval(ht); bar.style.width = 0; closeRing(); Z.toast('Guten Morgen! ☀️'); } }, 30); });
      const stop = () => { clearInterval(ht); bar.style.width = 0; }; g.addEventListener('pointerup', stop); g.addEventListener('pointerleave', stop); }
    // Einstellungen
    on('p-einst', 'click', e => {
      const b = e.target.closest('[data-set]');
      if (b) { const k = b.dataset.set; if (k === 'perf') Z.setPerf(!Z.perfOn()); else Z.setLocal(k, !Z.local[k]); renderNight(); }
      const m = e.target.closest('[data-m]'); if (m) { Z.setLocal('saverMin', +m.dataset.m); armSaver(); }
      const a = e.target.closest('[data-art]'); if (a && !window.ZHX.toggleArt(a.dataset.art)) Z.toast('Mindestens Bus oder Bahn');
    });
    on('saverNow', 'click', e => { e.stopPropagation(); setTimeout(openSaver, 50); });
    on('kino', 'click', () => Z.kino());
    // Abfahrten
    on('abArt', 'click', e => { const b = e.target.closest('[data-a]'); if (b && !window.ZHX.toggleArt(b.dataset.a)) Z.toast('Mindestens Bus oder Bahn'); });
    on('abStop', 'click', () => openOrt('haltestelle'));
    // Partner
    on('ptThink', 'click', async () => {
      const b = $('ptThink'); b.classList.add('sent');
      const ok = await window.ZHX.think(b);
      if (ok == null) { b.classList.remove('sent'); return; }
      b.querySelector('span').textContent = ok ? 'Gesendet 💗' : 'Hat nicht geklappt';
      setTimeout(() => { b.classList.remove('sent'); b.querySelector('span').textContent = 'Ich denk an dich'; }, 3000);
    });
    // Pakete, System
    on('pkBody', 'click', e => { const c = e.target.closest('[data-pk]'); if (c) { pkOpen = pkOpen === c.dataset.pk ? '' : c.dataset.pk; renderPak(); } });
    on('pkRef', 'click', () => { window.ZHX.refresh('pak'); Z.toast('Pakete werden aktualisiert …'); });
    on('syBody', 'click', e => { const t = e.target.closest('[data-g]'); if (t) { sysOpen = t.dataset.g; renderSys(); } });
    on('syRef', 'click', () => { window.ZHX.refresh('sys'); Z.toast('System wird geprüft …'); });
    // Farbe & Helligkeit
    on('cpop', 'click', e => {
      if (e.target.id === 'cpop' || e.target.id === 'cpX') { $('cpop').classList.remove('open'); cpId = null; return; }
      const b = e.target.closest('[data-c]'); if (b && cpId) Z.lampColor(cpId, b.dataset.c);
    });
    on('cpFree', 'input', e => { if (cpId) Z.lampColor(cpId, e.target.value, false); });
    on('cpFree', 'change', e => { if (cpId) Z.lampColor(cpId, e.target.value, true); });
    on('cpRange', 'input', e => { if (!cpId) return; cpDrag = true; Z.drag(lampOf(cpId)?.id); txt($('cpB'), e.target.value + ' %'); Z.lampSet(cpId, { brightness_pct: +e.target.value }); });
    on('cpRange', 'change', e => { if (!cpId) return; cpDrag = false; Z.drag(null); Z.lampSet(cpId, { brightness_pct: +e.target.value }, true); });
    on('cpPow', 'click', () => { if (cpId) Z.lampToggle(cpId); });
    // Listen-Popup (Meldungen, Haltestellen-Suche)
    on('lpop', 'click', e => {
      if (e.target.id === 'lpop' || e.target.closest('[data-lx]')) { $('lpop').classList.remove('open'); return; }
      const r = e.target.closest('[data-oi]');
      if (r && ortTarget) { const o = ortRes[+r.dataset.oi]; window.ZHX.setOrt(ortTarget, { id: o.id, name: o.name }); $('lpop').classList.remove('open'); Z.toast('Gespeichert: ' + o.name); return; }
      if (e.target.closest('[data-ortdel]') && ortTarget) { window.ZHX.setOrt(ortTarget, null); $('lpop').classList.remove('open'); }
    });
    on('lpop', 'input', e => {
      if (e.target.id !== 'ortQ') return;
      clearTimeout(ortT);
      const q = e.target.value.trim();
      if (q.length < 3) { put($('ortRes'), '<div class="sub">Mindestens 3 Buchstaben</div>'); return; }
      ortT = setTimeout(async () => {
        try {
          const res = await window.ZHX.searchOrte(q);
          if ($('ortQ')?.value.trim() !== q) return;
          ortRes = res;
          put($('ortRes'), res.map((o, i) => `<div class="it" data-oi="${i}" style="cursor:pointer"><span><b>${esc(o.name)}</b></span><em>${esc(o.sub)}</em></div>`).join('') || '<div class="sub">Nichts gefunden</div>');
        } catch (err) { if (!err?.isAbort) put($('ortRes'), `<div class="sub">${esc(err?.message || 'Suche gerade nicht möglich')}</div>`); }
      }, 450);
    });
    // Lampen gedrückt halten (480 ms) → Farbe & Helligkeit; Klick danach nicht als Tippen werten
    let lpT = 0, lpFired = false, lpXY = null;
    R.addEventListener('pointerdown', e => {
      const el = e.target.closest('[data-id]'); if (!el || e.target.closest('input,label')) return;
      const l = lampOf(el.dataset.id); if (!l) return;
      lpFired = false; lpXY = [e.clientX, e.clientY]; clearTimeout(lpT); el.classList.add('pressing');
      lpT = setTimeout(() => { lpFired = true; el.classList.remove('pressing'); sel = l.key; openColor(l.key); }, 480);
    });
    const lpStop = () => { clearTimeout(lpT); $$('.pressing').forEach(x => x.classList.remove('pressing')); };
    R.addEventListener('pointerup', () => { lpStop(); lpXY = null; if (lpFired) setTimeout(() => { lpFired = false; }, 350); });
    R.addEventListener('pointercancel', lpStop);
    R.addEventListener('pointermove', e => { if (lpXY && Math.hypot(e.clientX - lpXY[0], e.clientY - lpXY[1]) > 8) lpStop(); });
    R.addEventListener('click', e => { if (lpFired) { e.stopPropagation(); e.preventDefault(); lpFired = false; } }, true);
    R.addEventListener('contextmenu', e => { if (e.target.closest('[data-id]')) e.preventDefault(); });
    // Bildschirmschoner: Antippen weckt nur auf
    $('saver').addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); $('saver').classList.remove('open'); armSaver(); }, true);
    for (const t of ['pointerdown', 'keydown']) R.addEventListener(t, armSaver, { passive: true });
  }

  // ---------------------------------------------------------------- Zeichnen
  function render() {
    if (!W) return;
    placeNav();
    const tvOk = !!Z.cfg()?.fernseher;
    renderRoom(); renderQuick(); renderTiles();
    if (page === 'home') { renderWeather(); renderHum(); renderTh(); renderPower(); }
    if (page === 'tv' && tvOk) renderTV();
    if (page === 'kal') renderKal();
    if (page === 'wecker') renderWecker();
    if (page === 'einst') renderEinst();
    if (window.ZHX) {
      if (page === 'partner') renderPartner();
      if (page === 'abf') renderAbf();
      if (page === 'pak') renderPak();
      if (page === 'sys') renderSys();
    }
    if (cpId) renderCp();
    renderShot();
    renderNight();
    const bell = $('bell')?.querySelector('i'); if (bell) bell.style.display = Z.notes().some(n => n.warn) ? '' : 'none';
    const me = Z.me();
    if (me) { const av = $$('.avatar')[0], un = $$('.uname')[0]; txt(av, (me.name || '?').slice(0, 1).toUpperCase()); if (un.firstChild.textContent !== me.name) un.firstChild.textContent = me.name; txt(un.querySelector('small'), 'zurück zur Wir-App'); }
  }
  function toast(t) { const e = $('toast'); if (!e) return; e.textContent = t; e.classList.add('show'); clearTimeout(e._t); e._t = setTimeout(() => e.classList.remove('show'), 1800); }
  function tick() { if (!W) return; if ($('saver').classList.contains('open')) openSaver(); }
  function wake() { armSaver(); fit(); }
  function sleep() { clearTimeout(saverT); closeRing(); $('saver')?.classList.remove('open'); $('cpop')?.classList.remove('open'); $('lpop')?.classList.remove('open'); cpId = null; }
  function destroy() { sleep(); ro?.disconnect(); ro = null; W = null; navSig = ''; }

  VIEWS.tab = { build, render, tick, toast, progress, go, pageEl, wake, sleep, destroy };
})();
