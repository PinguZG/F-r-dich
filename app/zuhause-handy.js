// Zuhause · Handy (Redesign 13.11.2026, Mockup Wir-Redesign-Mockup.html): Reiter oben (Start · Fernbedienung · Kalender · Wecker · Verlauf · Mehr),
// Start = Uhr, Fakten, Szenen, Licht-Pillen, TV-Karte, Routinen; unter „Mehr“ Partner, Abfahrten, Pakete, System, Einstellungen, weitere Seiten.
// Stile zuhause-handy.css (im Shadow-DOM von #zh). Zeichnet nur – Zustand und Befehle aus window.ZH, Extras aus window.ZHX.
(() => {
  const VIEWS = window.ZH_VIEWS || (window.ZH_VIEWS = {});
  let Z, W = null, R = null, page = 'home', sheetFn = null;
  const $ = id => R.getElementById(id);
  const $$ = (s, el = W) => [...el.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const p2 = n => String(n).padStart(2, '0');
  const hm = t => { const d = new Date(t); return p2(d.getHours()) + ':' + p2(d.getMinutes()); };
  const MIN = 6e4, DAY = 864e5;
  const day0 = (t = Date.now()) => new Date(t).setHours(0, 0, 0, 0);
  const fmt = (n, d = 1) => (Number.isFinite(n) ? n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }) : '–');
  const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'], MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const last = new WeakMap();
  const put = (el, h) => { if (el && last.get(el) !== h) { last.set(el, h); el.innerHTML = h; } };
  const IC = {
    home: '<path d="M3.5 10.5 12 3.8l8.5 6.7V19a1.5 1.5 0 0 1-1.5 1.5h-4v-6h-6v6H5A1.5 1.5 0 0 1 3.5 19z"/>',
    tv: '<rect x="2.5" y="5" width="19" height="12.5" rx="2.5"/><path d="M8 20.5h8"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
    bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    moon: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
    cloud: '<path d="M7 19h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.2 12 3.5 3.5 0 0 0 7 19z"/>',
    rain: '<path d="M7 15h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.2 8 3.5 3.5 0 0 0 7 15zM8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
    therm: '<path d="M14 14.6V5a2 2 0 0 0-4 0v9.6a4 4 0 1 0 4 0z"/><path d="M12 9v7"/>',
    drop: '<path d="M12 3.5s6 6.4 6 10.8a6 6 0 0 1-12 0C6 9.9 12 3.5 12 3.5z"/>',
    bulb: '<path d="M9.5 18h5M10.5 21h3M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',
    pend: '<path d="M12 2.5v5"/><path d="M5.5 14a6.5 6.5 0 0 1 13 0z"/><path d="M10 17a2 2 0 0 0 4 0"/>',
    kit: '<rect x="4.5" y="3" width="15" height="18" rx="2"/><path d="M4.5 9.5h15M8 6.2h2.5M8 12.5v3.5"/>',
    bed: '<path d="M3 19V6.5M3 14.5h18V19M21 14.5v-2a3 3 0 0 0-3-3h-7.5v5"/><circle cx="6.8" cy="11.3" r="1.7"/>',
    door: '<path d="M6 21V4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21M4 21h16"/><circle cx="14.5" cy="12" r=".9"/>',
    win: '<rect x="4" y="3.5" width="16" height="17" rx="1.5"/><path d="M12 3.5v17M4 12h16"/>',
    alarm: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 2M4.5 4 2 6.5M19.5 4 22 6.5"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10.3A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7.5 2.7C19.5 15.4 12 20 12 20z"/>',
    bus: '<rect x="5" y="3" width="14" height="15" rx="3"/><path d="M5 11h14M8 18v2.5M16 18v2.5"/><circle cx="8.5" cy="14.5" r=".8"/><circle cx="15.5" cy="14.5" r=".8"/>',
    box: '<path d="M3.5 7.5 12 3.2l8.5 4.3v9L12 20.8l-8.5-4.3z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v8.8"/>',
    pulse: '<path d="M3 12h4l2.5-6 4 12 2.5-6H21"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 6.5l1.9 1.1M17.5 16.4l1.9 1.1M4.6 17.5l1.9-1.1M17.5 7.6l1.9-1.1"/><circle cx="12" cy="12" r="6.6"/>',
    chev: '<path d="m9 5.5 6.5 6.5L9 18.5"/>', back: '<path d="M15 5.5 8.5 12l6.5 6.5"/>',
    up: '<path d="m5.5 15 6.5-6.5 6.5 6.5"/>', down: '<path d="m5.5 9 6.5 6.5L18.5 9"/>',
    spark: '<path d="M12 2.5l2.1 6.1 6.4 2.4-6.4 2.4L12 19.5l-2.1-6.1L3.5 11l6.4-2.4z"/><path d="M19 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z"/>', pause: '<rect x="7" y="5" width="3.5" height="14" rx="1"/><rect x="13.5" y="5" width="3.5" height="14" rx="1"/>',
    prev: '<path d="M18 6v12l-8.5-6z"/><rect x="5.5" y="6" width="2.2" height="12" rx="1"/>', next: '<path d="M6 6v12l8.5-6z"/><rect x="16.3" y="6" width="2.2" height="12" rx="1"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
    vol: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9a4.5 4.5 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
    mute: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>',
    shield: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8 7.5 9.5 4.3-1.5 7.5-4.9 7.5-9.5V6z"/><path d="m8.8 12 2.2 2.2 4.4-4.4"/>',
    power: '<path d="M12 3v8M6.5 6.5a7.5 7.5 0 1 0 11 0"/>', check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>', menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    ret: '<path d="M9 14 4.5 9.5 9 5"/><path d="M4.5 9.5H14a5.5 5.5 0 0 1 0 11h-3"/>',
    trash: '<path d="M4.5 6.5h15M9 6.5V4h6v2.5M6.5 6.5l1 13.5h9l1-13.5"/>',
    tab: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M11 16.5h2"/>',
    route: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4"/>',
    camera: '<path d="M4 8h3l1.6-2.2A1.5 1.5 0 0 1 9.8 5h4.4a1.5 1.5 0 0 1 1.2.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
    hist: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>', more: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
    send: '<path d="M5 12h12M12 6l6 6-6 6"/>', bs: '<path d="M9 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6-7z"/><path d="M12 9.5l5 5M17 9.5l-5 5"/>',
  };
  const FILLED = new Set(['spark', 'play', 'pause', 'prev', 'next']);
  const ico = (k, c = '') => `<svg class="i${FILLED.has(k) ? ' f' : ''} ${c}" viewBox="0 0 24 24">${IC[k] || IC.bulb}</svg>`;
  const LICON = { tisch: 'pend', kueche: 'kit', bett: 'bed' };
  const P_DEF = { d: '#f5b45a', i: '#b48cff', g: '#5fd3c6' };
  const SC_EMO = { gemuetlich: '🕯️', filmabend: '🍿', lesen: '📖', gutenacht: '🌙', allesaus: '⏻' };
  const toastEl = () => $('toast');

  // ---------------------------------------------------------------- Grundgerüst
  const TABS = [['home', 'home', 'Start'], ['tv', 'tv', 'Fernbedienung'], ['kal', 'cal', 'Kalender'], ['wecker', 'alarm', 'Wecker'], ['verlauf', 'hist', 'Verlauf'], ['mehr', 'more', 'Mehr']];
  const TABPAGES = TABS.map(t => t[0]);
  const SCR = ['home', 'tv', 'kal', 'mehr', 'wecker', 'partner', 'abf', 'pak', 'sys', 'einst'];
  function build(wrap, root) {
    Z = window.ZH; W = wrap; R = root;
    kMon = new Date(new Date().getFullYear(), new Date().getMonth(), 1); kSel = day0();
    W.innerHTML = `<div class="phone" id="phone">
      ${[...SCR, ...Z.extraPages.map(p => p.key)].map(p => `<section class="scr" id="s-${p}">${Z.extraPages.some(x => x.key === p) ? extraScreen(p) : ''}</section>`).join('')}
      <div class="zbar"><button class="zback" data-act="back" aria-label="Zurück zur Wir-App">${ico('back')}</button><nav class="ztabs" id="ztabs">${TABS.filter(t => t[0] !== 'verlauf' || Z.extraPages.some(x => x.key === 'verlauf')).map(([k, i, n]) => `<button data-go="${k}" data-n="${k}">${ico(i)}<span>${n}</span></button>`).join('')}</nav></div>
      <div class="shade" id="shade"></div><div class="sheet" id="sheet"></div><div class="toast" id="toast"></div>
      <div class="ring" id="ring"></div><div class="saver" id="saver"></div><div class="nightdim" id="nightdim"></div></div>`;
    wire();
    go(page);
  }
  function extraScreen(key) {
    const p = Z.extraPages.find(x => x.key === key);
    return ph(esc(p.label), '', key !== 'verlauf') + `<div class="xpage">${p.html || ''}</div>`;
  }
  function pageEl(key) { return W?.querySelector(`#s-${key} .xpage`) || null; }
  const ph = (t, s, back, right = '') => `<div class="ph">${back ? `<button class="back" data-go="mehr" aria-label="Zurück">${ico('back')}</button>` : ''}<div><h2>${t}</h2>${s ? `<p>${s}</p>` : ''}</div>${right ? `<div class="r">${right}</div>` : ''}</div>`;
  const RN = {};
  function go(p) {
    if (!W) return;
    if (p === 'start') p = 'home';
    if (p === 'set') p = 'einst';
    if (!$('s-' + p) || (p === 'pak' && !window.ZHX?.pakOk()) || (p === 'sys' && !window.ZHX?.sysOk())) p = page && $('s-' + page) && !['pak', 'sys'].includes(page) ? page : 'home';
    const changed = p !== page;
    page = p;
    $$('.scr').forEach(s => s.classList.toggle('on', s.id === 's-' + p));
    const n = TABPAGES.includes(p) ? p : 'mehr';
    $$('.ztabs [data-n]').forEach(b => b.classList.toggle('on', b.dataset.n === n));
    $('phone').classList.toggle('notabs', !TABPAGES.includes(p));
    const onb = W.querySelector('.ztabs .on'), nv = $('ztabs'); if (onb && nv) nv.scrollLeft = onb.offsetLeft - (nv.clientWidth - onb.offsetWidth) / 2;
    if (changed) $('s-' + p).scrollTop = 0;
    closeSheet();
    Z.go(p);
    upd(true);
  }
  // Seite neu zeichnen – nicht, solange dort ein Eingabefeld den Fokus hat oder gezogen wird
  function upd(force) {
    if (!W || !Z.cfg()) return;
    const scr = $('s-' + page), ae = R.activeElement;
    const typing = ae && ae.matches('input:not([type=range])') && scr?.contains(ae);
    if (RN[page] && (force || (!typing && !drag && !(hd && hd.moved)))) RN[page]();
    if (sheetFn && !(ae && $('sheet').contains(ae) && ae.matches('input:not([type=range])')) && !cpDrag) put($('sheet'), sheetFn());
  }
  function sheet(fn) { sheetFn = fn; put($('sheet'), fn()); $('sheet').scrollTop = 0; $('sheet').classList.add('on'); $('shade').classList.add('on'); }
  function closeSheet() { sheetFn = null; cpId = null; ortTarget = ''; $('sheet')?.classList.remove('on'); $('shade')?.classList.remove('on'); }
  function toast(t) { const e = toastEl(); if (!e) return; e.textContent = t; e.classList.add('on'); clearTimeout(e._t); e._t = setTimeout(() => e.classList.remove('on'), 1900); }

  // ---------------------------------------------------------------- Start
  const BER = o => new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', ...o });
  RN.home = () => {
    const now = new Date(), clock = BER({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now), date = BER({ weekday: 'long', day: 'numeric', month: 'long' }).format(now);
    const w = Z.S.wetter, L = Z.lamps(), k = Z.klima(), v = Z.tvView(), ai = Z.alarmInfo(), sc = Z.scenes();
    const warn = Z.notes().some(n => n.warn), rts = (Z.cfg()?.routinen || []).filter(r => r.entity_id);
    const night = w?.now ? !w.now.day : now.getHours() >= 18 || now.getHours() < 7;
    const wi = w?.now ? Z.wmo(w.now.code, w.now.day) : null, wic = { sun: 'sun', moon: 'moon', cloudsun: 'sun', cloudmoon: 'moon', rain: 'rain', snow: 'cloud' }[wi?.[0]] || (wi ? 'cloud' : night ? 'moon' : 'sun');
    const kl = [Number.isFinite(k.t) ? fmt(k.t) + '°' : '', Number.isFinite(k.hu) ? fmt(k.hu, 0) + ' %' : ''].filter(Boolean).join(' · ');
    const fact = (attr, c, i, t) => `<button class="zf"${attr}><span class="ic ${c}">${ico(i)}</span><b>${esc(t)}</b></button>`;
    let x = `<div class="zclock"><div class="zc"><div class="clock">${clock}</div><div class="zdate">${esc(date)}</div></div><button class="zbell" data-act="bell" aria-label="Meldungen">${ico('bell')}${warn ? '<b></b>' : ''}</button></div>
      <div class="zfacts">${w?.now ? fact(' data-act="wetter"', 'gold', wic, `${w.now.t}° · ${wi[1]}`) : ''}${kl ? fact(' data-act="klima"', '', 'therm', kl) : ''}${fact(' data-go="wecker"', 'pink', 'alarm', ai.n ? 'Wecker ' + ai.n.a.zeit + (ai.when && ai.when !== 'heute' ? ' · ' + ai.when : '') : 'Kein Wecker')}</div>`;
    if (sc.length) x += `<div class="zh"><h2>Szenen</h2></div><div class="zscenes">${sc.map(s => `<button class="gt zs${s.on ? ' on' : ''}" data-sc="${esc(s.key)}"><span class="em">${SC_EMO[Z.norm(s.name)] || '✨'}</span><b>${esc(s.name)}</b></button>`).join('')}</div>`;
    if (L.length) x += `<div class="zh"><h2>Licht</h2><div class="zact"><button class="chipb" data-act="allOn">${ico('bulb')}Alle an</button><button class="chipb" data-act="allOff">${ico('power')}Alle aus</button></div></div>
      <div class="zpills">${L.map(l => `<div class="gt pl${l.on ? ' on' : ''}${l.na ? ' na' : ''}" data-l="${esc(l.key)}" style="--lc:${l.c}"><i class="zfill" style="width:${l.on && l.dimm ? l.b : 0}%"></i>${ico(LICON[l.key] || 'bulb')}<span>${esc(l.name)}</span><b>${l.na ? '–' : l.on ? (l.dimm ? l.b + ' %' : 'An') : 'Aus'}</b></div>`).join('')}</div>`;
    if (v) {
      const pct = v.vol / v.max * 100;
      x += `<div class="zh"><h2>Geräte</h2></div><div class="gt ztv${v.on ? '' : ' off'}"><span class="ic">${ico('tv')}</span><button class="ztt" data-go="tv"><b>${esc(v.tv.name)}</b><small>${esc(tvLine(v))}</small></button>
        <div class="zvol"><button data-act="vminus" aria-label="Leiser">${ico('minus')}</button><div class="hb" data-hb="vol"><i style="width:${v.muted ? 0 : pct}%"></i></div><button data-act="vplus" aria-label="Lauter">${ico('plus')}</button><button class="zpw${v.on ? ' on' : ''}" data-act="tvpow" aria-label="Fernseher an/aus">${ico('power')}</button></div></div>`;
    }
    if (rts.length) x += `<div class="zh"><h2>Routinen</h2></div><div class="zrts">${rts.map(r => { const an = Z.ent(r.entity_id)?.state === 'on'; return `<div class="gt zr"><span class="ic">${ico(IC[r.icon] ? r.icon : 'alarm')}</span><div><b>${esc(r.name)}</b>${r.info ? `<small>${esc(r.info)}</small>` : ''}</div><button class="tgl vio sm${an ? ' on' : ''}" data-rt="${esc(r.entity_id)}" data-on="${an ? 1 : 0}" aria-label="${esc(r.name)}"></button></div>`; }).join('')}</div>`;
    put($('s-home'), x);
  };
  const tvLine = v => (v.on ? v.app.name + ' · ' + (v.playing ? 'läuft' : 'pausiert') : v.starting ? 'Startet …' : v.bildAus ? 'Bild aus · Ton an' : v.fail ? 'Aus · Einschalten hat nicht geklappt' : 'Aus');
  function pkHead(pk) { const n = pk.filter(q => q.status === 'heute').length; return n ? `${n} ${n === 1 ? 'Paket kommt' : 'Pakete kommen'} heute` : pk.some(q => q.status === 'abholbereit') ? 'Paket abholbereit' : 'Pakete'; }
  function nextDep() {
    const X = window.ZHX, a = X?.D.abf; if (!a || a.aus || !a.abfahrten) return null;
    const d = a.abfahrten.find(z => !z.ausfall && Date.parse(z.echt) >= Date.now() - 30000); if (!d) return null;
    return { ...d, stop: a.haltestelle || a.name || X.prefs().haltestelle?.name || '', m: Math.max(0, Math.round((Date.parse(d.echt) - Date.now()) / MIN)) };
  }

  // ---------------------------------------------------------------- Blätter: Szenen, Meldungen, Wetter, Raumklima, Farbe
  const bellHtml = () => `<div class="grab"></div><h3>Meldungen</h3><div class="rows">${Z.notes().map(n => `<div class="rw"><div class="ic${n.warn ? ' gold' : ''}">${ico(n.ic)}</div><div><b>${esc(n.b)}</b><small>${esc(n.s)}</small></div></div>`).join('')}</div>`;
  const wetterHtml = () => {
    const w = Z.S.wetter;
    if (!w?.now) return '<div class="grab"></div><h3>Wetter</h3><p>Noch keine Wetterdaten.</p>';
    const [ic, d] = Z.wmo(w.now.code, w.now.day), icn = { sun: 'sun', moon: 'moon', cloudsun: 'sun', cloudmoon: 'moon', rain: 'rain' }[ic] || 'cloud';
    return `<div class="grab"></div><h3>Wetter · ${esc(w.ort)}</h3><p>${esc(d)}${w.regen_ab ? ` · Regen ab ${esc(w.regen_ab)} Uhr` : ' · kein Regen in Sicht'}</p><div class="wbig">${ico(icn)}<div><b>${w.now.t}°</b><small style="display:block;color:var(--mut)">gefühlt ${w.now.feels}° · heute ${w.heute?.min ?? '–'}° bis ${w.heute?.max ?? '–'}°</small></div></div>
      <div class="hours">${(w.hours || []).slice(0, 5).map(x => `<div>${p2(x.h)}:00<b>${x.t}°</b></div>`).join('')}</div>`;
  };
  const klimaHtml = () => {
    const k = Z.klima(), pts = k.ts.length > 1 ? k.ts : null;
    const lo = pts ? Math.floor(Math.min(...pts.map(p => p.v)) - 1) : 18, hi = pts ? Math.ceil(Math.max(...pts.map(p => p.v)) + 1) : 24;
    return `<div class="grab"></div><h3>Raumklima · Wohnzimmer</h3>
      <div class="pills"><span><b>${fmt(k.t)}°</b> jetzt</span><span><b>${fmt(k.tmin)}°</b> min</span><span><b>${fmt(k.tmax)}°</b> max</span><span><b>${fmt(k.hu, 0)} %</b> Feuchte</span></div>
      <div class="card xc" style="color:#b39bff"><div class="cth"><b>Temperatur · 24 Std.</b><span class="cap"></span></div>${pts ? area(pts, 'v', lo, hi, '°') : '<div class="empty">Der Verlauf füllt sich in den nächsten Stunden.</div>'}</div>`;
  };
  const PCOLS = ['#ff6a1f', '#ff7828', '#ff9646', '#ffb35c', '#ffd9a8', '#fff1dc', '#ffffff', '#7fb8ff', '#5ad07a', '#c38bff', '#ff5a7a'];
  let cpId = null, cpDrag = false;
  function openColor(key) {
    cpId = key;
    sheet(() => {
      const l = Z.lampBy(cpId); if (!l) return '';
      return `<div class="grab"></div><div class="ch"><div class="cprev" style="background:${l.c};box-shadow:0 0 26px ${l.c}"></div><div><b>${esc(l.name)}</b><small>${l.na ? 'nicht erreichbar' : l.on ? 'An · ' + esc(l.k) : 'Aus'}${l.dimm && l.on ? ' · ' + l.b + ' %' : ''}</small></div><button class="tgl${l.on ? ' on' : ''}" data-cp="pow" aria-label="Ein/Aus"></button></div>
        <div class="sec">Farbe</div><div class="cols">${PCOLS.map(c => `<button data-cpc="${c}" class="${c === l.c.toLowerCase() ? 'on' : ''}" style="background:${c};color:${c}" aria-label="Farbe"></button>`).join('')}<label class="cfree">+<input type="color" data-cpfree value="${/^#[0-9a-f]{6}$/i.test(l.c) ? l.c : '#ff9646'}"></label></div>
        ${l.dimm ? `<div class="sec">Helligkeit <b id="cpB">${l.b} %</b></div><input type="range" class="rng" min="1" max="100" value="${l.b}" style="--p:${l.b}%" data-cpdim>` : '<div class="sec">Helligkeit <b>nur an/aus</b></div>'}`;
    });
  }

  // ---------------------------------------------------------------- Diagramme
  const colPath = (x, base, w, h) => { const r = Math.min(3, w / 2, h); return `M${(x - w / 2).toFixed(1)} ${base}V${(base - h + r).toFixed(1)}q0 -${r} ${r} -${r}h${(w - 2 * r).toFixed(1)}q${r} 0 ${r} ${r}V${base}Z`; };
  let gid = 0;
  function area(pts, key, lo, hi, unit, Wd = 340, H = 120) {
    pts = pts.filter(p => Number.isFinite(p[key]));
    if (pts.length < 2) return '<div class="empty">Die Kurve füllt sich in den nächsten Stunden.</div>';
    const top = 8, base = H - 20, t0 = pts[0].t, span = Math.max(1, pts[pts.length - 1].t - t0), X = t => (t - t0) / span * Wd, Y = v => base - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * (base - top), n = pts.length, id = 'g' + key + (++gid % 50);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)} ${Y(p[key]).toFixed(1)}`).join('');
    const step = Math.max(1, Math.ceil(n / 48)), hp = pts.filter((_, i) => i % step === 0 || i === n - 1), m = hp.length;
    const hits = hp.map(p => `<g class="xh" data-tip="${hm(p.t)} Uhr: ${fmt(p[key], unit === '%' ? 0 : 1)} ${unit}"><rect x="${(X(p.t) - Wd / m / 2).toFixed(1)}" y="0" width="${(Wd / m).toFixed(1)}" height="${H}" fill="transparent"/><circle cx="${X(p.t).toFixed(1)}" cy="${Y(p[key]).toFixed(1)}" r="3.5" class="hp"/></g>`).join('');
    const mid = (lo + hi) / 2;
    return `<svg viewBox="0 0 ${Wd} ${H}" class="xs"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".35"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>
      <line x1="0" x2="${Wd}" y1="${base}" y2="${base}" class="xbase"/><line x1="0" x2="${Wd}" y1="${Y(mid)}" y2="${Y(mid)}" class="xgrid"/><text x="2" y="${Y(mid) - 4}" class="ax">${fmt(mid, unit === '%' ? 0 : 1)} ${unit}</text>
      <path d="${line}L${X(pts[n - 1].t).toFixed(1)} ${base}L${X(t0)} ${base}Z" fill="url(#${id})"/><path d="${line}" class="xln"/><circle cx="${X(pts[n - 1].t).toFixed(1)}" cy="${Y(pts[n - 1][key]).toFixed(1)}" r="4" class="xend"/>${hits}
      <text x="0" y="${H - 4}" class="ax">${hm(t0)}</text><text x="${Wd / 2}" y="${H - 4}" text-anchor="middle" class="ax">${hm(t0 + span / 2)}</text><text x="${Wd}" y="${H - 4}" text-anchor="end" class="ax axn">jetzt</text></svg>`;
  }

  // ---------------------------------------------------------------- Fernseher
  RN.tv = () => {
    const v = Z.tvView();
    if (!v) { put($('s-tv'), ph('Fernseher', 'nicht eingerichtet') + '<div class="card empty">Kein Fernseher in der Konfiguration.</div>'); return; }
    const A = v.app, src = Z.srcList(), more = Z.moreApps(), adb = !!v.tv.titel, hv = Z.hell(), pct = v.vol / v.max * 100;
    const offTxt = v.starting ? 'Fernseher wird gestartet … (bis zu 45 Sek.)' : v.bildAus ? 'Bild aus · Ton läuft – tippen für Bild an' : v.fail ? 'Hat nicht geklappt – nochmal tippen' : 'Fernseher ist aus – tippen zum Einschalten';
    put($('s-tv'), ph(esc(v.tv.name), esc(v.on ? 'An · ' + A.name : v.starting ? 'Startet …' : v.bildAus ? 'Bild aus · Ton an' : 'Aus'), false, `<button class="tgl vio${v.on ? ' on' : ''}" data-act="tvpow" aria-label="Fernseher"></button>`)
      + `<div class="card np${v.on ? '' : ' off'}"><div class="npart" style="--ac:${A.farbe}">${Z.appMark(A)}</div><div class="npb"><small>${esc(A.name)}</small><b>${esc(v.titel || (v.on ? A.name : 'Nichts läuft'))}</b><small class="npsub">${esc([v.zeile, v.prog.txt, v.on ? v.stat : ''].filter(Boolean).join(' · '))}</small><div class="pbar"${v.prog.dur ? '' : ' style="visibility:hidden"'}><i style="width:${(v.prog.f * 100).toFixed(1)}%"></i></div>
        <div class="npc"><button data-act="prev" aria-label="Zurück">${ico('prev')}</button><button class="pbig" data-act="play" aria-label="Wiedergabe">${ico(v.playing ? 'pause' : 'play')}</button><button data-act="next" aria-label="Weiter">${ico('next')}</button></div></div>
        ${v.on ? '' : `<button class="offl" data-act="tvon">${ico('power')}${offTxt}</button>`}</div>
      <div class="sec">Apps</div><div class="apps">${v.tv.apps.map(a => `<button class="app${v.on && a.name === A.name ? ' on' : ''}" data-app="${esc(a.name)}" style="--ac:${a.farbe}"><i>${Z.appMark(a)}</i><span>${esc(a.name.replace(' Mediathek', ''))}</span></button>`).join('')}</div>
      ${more.length ? `<div class="sec">Weitere Apps</div><div class="apps">${more.map((a, i) => `<button class="app${v.on && v.a.app_id === a.paket ? ' on' : ''}" data-more="${i}" style="--ac:${esc(a.farbe || '#7b5cff')}"><i>${Z.appMark(a)}</i><span>${esc(a.name)}</span></button>`).join('')}</div>` : ''}
      ${src.length ? `<div class="sec">Eingänge</div><div class="seg">${src.map((q, i) => `<button class="${q.on ? 'on' : ''}" data-src="${i}">${esc(q.name)}</button>`).join('')}</div>` : ''}
      <div class="sec">Fernbedienung</div><div class="card"><div class="pad"><button class="u" data-k="hoch" aria-label="Hoch">${ico('up')}</button><button class="d" data-k="runter" aria-label="Runter">${ico('down')}</button><button class="l" data-k="links" aria-label="Links">${ico('back')}</button><button class="r" data-k="rechts" aria-label="Rechts">${ico('chev')}</button><button class="ok" data-k="ok">OK</button></div>
        <div class="rk">${[['ret', 'Zurück'], ['home', 'Home'], ['menu', 'Menü'], ['mic', 'Sprache']].map(([i, n]) => `<button data-k="${n}">${ico(i)}<span>${n}</span></button>`).join('')}</div>
        ${adb ? `<form class="tdadd tvtext" data-form="tvtext"><input id="tvText" maxlength="200" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="send" placeholder="Text an den Fernseher …"><button type="button" class="ghost" data-act="tvdel" aria-label="Zeichen löschen">${ico('bs')}</button><button aria-label="Senden">${ico('send')}</button></form>` : ''}</div>
      <div class="card"><div class="ch"><div class="ic">${ico(v.muted ? 'mute' : 'vol')}</div><div><b>Lautstärke</b><small>${v.muted ? 'stumm' : v.vol + ' von ' + v.max}</small></div><button class="chipb${v.muted ? ' on' : ''}" data-act="mute">Stumm</button></div>
        <div class="vol"><button data-act="vminus" aria-label="Leiser">${ico('minus')}</button><div class="hb" data-hb="vol"><i style="width:${v.muted ? 0 : pct}%"></i></div><button data-act="vplus" aria-label="Lauter">${ico('plus')}</button></div></div>
      ${adb ? `<div class="card"><div class="ch"><div class="ic">${ico('eye')}</div><div><b>Bild</b><small>${v.bildAus ? 'aus – der Ton läuft weiter' : ''}</small></div></div>
        <div class="seg" style="margin-top:12px"><button class="${v.bildAus ? 'on' : ''}" data-act="bild">${v.bildAus ? 'Bild an' : 'Bild aus'}</button><button data-act="shot">Bildschirmfoto</button></div>
        ${Number.isFinite(hv) ? `<div class="sec">Bildhelligkeit <b>${hv}</b></div><div class="vol"><button data-act="hminus" aria-label="Dunkler">${ico('minus')}</button><div class="hb" data-hb="hell"><i style="width:${hv}%"></i></div><button data-act="hplus" aria-label="Heller">${ico('plus')}</button></div>` : ''}</div>` : ''}`);
    if (Z.shotView().open && !sheetFn) sheet(shotHtml);
  };
  const shotHtml = () => { const s = Z.shotView(); if (!s.open) { setTimeout(closeSheet, 0); return ''; } return `<div class="grab"></div><h3>Bildschirm</h3>${s.msg ? `<p>${esc(s.msg)}</p>` : ''}${s.url ? `<img class="shot" src="${s.url}" alt="Bildschirm des Fernsehers">` : '<div class="empty">…</div>'}<div class="seg" style="margin-top:14px"><button data-act="shot">Neu aufnehmen</button><button data-act="shotx">Schließen</button></div>`; };
  function progress(v) {
    if (!W || (page !== 'tv' && page !== 'home')) return;
    $$('.pbar i').forEach(i => { i.style.width = (v.prog.f * 100).toFixed(1) + '%'; });
    const s = W.querySelector('#s-tv .npsub'); if (s && page === 'tv') s.textContent = [v.zeile, v.prog.txt, v.on ? v.stat : ''].filter(Boolean).join(' · ');
  }

  // ---------------------------------------------------------------- Kalender & To-dos
  let kMon, kSel, tdL = 'gemeinsam';
  const kOff = new Set();
  RN.kal = () => {
    const P = Z.who(P_DEF), y = kMon.getFullYear(), m = kMon.getMonth(), st = (new Date(y, m, 1).getDay() + 6) % 7, n = new Date(y, m + 1, 0).getDate(), t0 = day0();
    const evOn = t => Z.evOn(Z.iso(new Date(t))).filter(e => !kOff.has(e.w || 'g'));
    let cells = ''; for (let i = 0; i < st; i++) cells += '<span></span>';
    for (let d = 1; d <= n; d++) {
      const t = new Date(y, m, d).getTime(), ps = [...new Set(evOn(t).map(e => e.w || 'g'))], wd = new Date(t).getDay();
      cells += `<button class="kd${t === t0 ? ' today' : ''}${t === kSel ? ' sel' : ''}${wd === 0 || wd === 6 ? ' we' : ''}" data-day="${t}"><span>${d}</span><i>${ps.map(p => `<b style="--pc:${(P[p] || P.g)[1]}"></b>`).join('')}</i></button>`;
    }
    const sd = new Date(kSel), ag = evOn(kSel), list = Z.todos(tdL), open = Z.LISTS.reduce((s, [k]) => s + Z.todos(k).filter(x => !x.done).length, 0);
    const endTxt = e => { if (!e.span) return ''; const [yy, mm, dd] = e.to.split('-').map(Number); return ` · bis ${dd}.${mm}.`; };
    put($('s-kal'), ph(MON[m], y + ' · ' + esc((Z.me()?.name || 'Daniel') + ' & ' + (Z.partner()?.name || 'Ida')), false, `<button class="back" data-act="kprev" aria-label="Vorheriger Monat">${ico('back')}</button><button class="back" data-act="knext" aria-label="Nächster Monat">${ico('chev')}</button>`)
      + `<div class="leg"><button data-act="ktoday" class="chipb" style="height:34px">Heute</button>${Object.entries(P).map(([k, [nm, c]]) => `<button class="${kOff.has(k) ? 'off' : ''}" data-pf="${k}" style="--pc:${c}"><i></i>${nm}</button>`).join('')}</div>
      <div class="card"><div class="kw">${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(d => `<span>${d}</span>`).join('')}</div><div class="kg">${cells}</div></div>
      <div class="sec">${kSel === t0 ? 'Heute' : kSel === t0 + DAY ? 'Morgen' : WD[sd.getDay()] + ', ' + sd.getDate() + '. ' + MON[sd.getMonth()]}<b>${ag.length ? ag.length + (ag.length === 1 ? ' Termin' : ' Termine') : ''}</b></div>
      <div class="card">${ag.map(e => { const p = P[e.w] || P.g; return `<div class="ag" style="--pc:${p[1]}"><i></i><div><b>${esc(e.n)}</b><small>${e.t && !e.span ? esc(e.t) + (e.e ? '–' + esc(e.e) : '') + ' Uhr' : 'ganztägig' + endTxt(e)} · ${p[0]}</small></div></div>`; }).join('') || '<div class="empty">Nichts geplant – genießt den Tag.</div>'}</div>
      <div class="sec">To-dos<b>${open} offen</b></div>
      <div class="card"><div class="seg">${Z.LISTS.map(([k, nm]) => `<button class="${tdL === k ? 'on' : ''}" data-tdl="${k}">${nm}</button>`).join('')}</div>
      <form class="tdadd" data-form="todo"><input id="tdIn" placeholder="Neue Aufgabe …" autocomplete="off" enterkeyhint="done"><button aria-label="Hinzufügen">${ico('plus')}</button></form>
      ${list.map(t => { const c = (P[t.who] || P.g)[1]; return `<div class="td${t.done ? ' done' : ''}" data-td="${esc(t.id)}"><span class="cb">${t.done ? ico('check') : ''}</span><span>${esc(t.text)}${t.note ? `<small>${esc(t.note)}</small>` : ''}</span>${t.done ? `<i class="tdx" data-tdx aria-label="Löschen">${ico('trash')}</i>` : ''}<em data-who style="--pc:${c}">${t.who === 'd' ? 'D' : t.who === 'i' ? 'I' : 'W'}</em></div>`; }).join('') || '<div class="empty">Alles erledigt 🎉</div>'}
</div>`);
  };

  // ---------------------------------------------------------------- Mehr
  RN.mehr = () => {
    const X = window.ZHX, ai = Z.alarmInfo(), d = nextDep(), pk = X?.pakOk() ? (X.D.pak?.pakete || []) : null, s = X?.D.sys;
    const M = [['partner', 'heart', 'Partner', Z.wiedersehen(), 'pink'],
      ['abf', 'bus', 'Abfahrten', d ? `${d.linie || ''} in ${d.m} Min` : X?.prefs().haltestelle?.name || 'Haltestelle wählen', 'teal']];
    if (X?.pakOk()) M.push(['pak', 'box', 'Pakete', pk && pk.length ? pkHead(pk) : 'Sendungen', 'gold']);
    if (X?.sysOk()) M.push(['sys', 'pulse', 'System', s ? { g: 'Alles im grünen Bereich', y: 'Ein Auge drauf haben', r: 'Etwas braucht dich' }[s.a] || 'Status' : 'VPS, HA, Backups', '']);
    for (const p of Z.extraPages) if (p.key !== 'verlauf') M.push([p.key, '', p.label, '', '', p.icon]);
    M.push(['einst', 'gear', 'Einstellungen', '', '']);
    put($('s-mehr'), ph('Mehr', '') + `<div class="mgrid">${M.map(([p, i, n, sub, c, raw]) => `<button class="card mt" data-go="${p}"><div class="ic ${c}">${raw || ico(i)}</div><b>${esc(n)}</b><small>${esc(sub)}</small></button>`).join('')}</div>
      <div class="sec">Wir-App</div><button class="card rows" data-act="back"><div class="rw"><div class="ic pink">${ico('heart')}</div><div><b>Zurück zur Wir-App</b></div>${ico('chev', 'chev')}</div></button>`);
  };

  // ---------------------------------------------------------------- Wecker
  const WD7 = [['Mo', 0], ['Di', 1], ['Mi', 2], ['Do', 3], ['Fr', 4], ['Sa', 5], ['So', 6]];
  RN.wecker = () => {
    const w = Z.W(), ai = Z.alarmInfo(), ftv = Z.cfg()?.fernseher, wt = Z.wtv();
    put($('s-wecker'), ph('Wecker', esc(ai.n ? `Nächster: ${ai.when} ${ai.n.a.zeit}` : ai.state), false)
      + `<div class="card whero"><small>Nächster Wecker</small><b>${ai.n ? esc(ai.n.a.zeit) : '–:–'}</b><p>${ai.n ? esc(`${ai.when[0].toUpperCase() + ai.when.slice(1)} · ${ai.n.a.titel || 'Wecker'}${w.vorlauf ? ' · Licht ab ' + ai.lead : ''}`) : esc(ai.state)}</p><button class="btn" data-act="wtest">${ico('sun')}Weckvorgang testen</button></div>
      ${w.alarms.map(a => `<div class="card al${a.an ? '' : ' dim'}"><div class="ch"><label class="alt">${esc(a.zeit)}${a.bis ? `<small>–${esc(a.bis)}</small>` : ''}<input type="time" value="${esc(a.zeit.padStart(5, '0'))}" data-altime="${esc(a.id)}"></label><div><b>${esc(a.titel || 'Wecker')}</b><small>${a.bis ? 'alle ' + a.alle + ' Min bis ' + esc(a.bis) : 'einmal klingeln'}${a.ton === false ? ' · nur Licht' : ''}</small></div><button class="tgl vio${a.an ? ' on' : ''}" data-al="${esc(a.id)}" aria-label="Wecker an/aus"></button></div>
        <div class="days">${WD7.map(([d, j]) => `<button class="${a.tage.includes(j) ? 'on' : ''}" data-ald="${esc(a.id)}:${j}">${d}</button>`).join('')}<button class="del" data-aldel="${esc(a.id)}" aria-label="Löschen">${ico('trash')}</button></div></div>`).join('')}
      <button class="card addal" data-act="aladd">${ico('plus')}Wecker hinzufügen</button>
      <div class="card"><div class="ch"><div class="ic gold">${ico('sun')}</div><div><b>Sonnenaufgang vorher</b></div><span class="big" style="font-size:22px"><span id="srv">${w.vorlauf}</span><small>Min</small></span></div>
        <div class="sunb"></div><input type="range" class="rng" min="0" max="30" step="5" value="${w.vorlauf}" style="--p:${w.vorlauf / 30 * 100}%" data-sr></div>
      <div class="card"><div class="ch"><div class="ic">${ico('vol')}</div><div><b>Ton</b></div></div>
        <div class="seg" style="margin-top:14px">${['Sanft', 'Vögel', 'Klassisch'].map(t => `<button class="${w.ton === t ? 'on' : ''}" data-tone="${t}">${t}</button>`).join('')}</div></div>
      ${ftv ? `<div class="card${wt.an ? '' : ' dimc'}"><div class="ch"><div class="ic">${ico('tv')}</div><div><b>Fernseher beim Wecken</b></div><button class="tgl vio sm${wt.an ? ' on' : ''}" data-act="wtv" aria-label="Fernseher beim Wecken"></button></div>
        <div class="seg wrap" style="margin-top:14px">${ftv.apps.map(x => `<button class="${x.name === wt.app ? 'on' : ''}" data-wapp="${esc(x.name)}">${esc(x.name.replace(' Mediathek', ''))}</button>`).join('')}</div>
        <div class="sec">Lautstärke <b id="wtvv">${wt.lautstaerke}</b></div><input type="range" class="rng" min="0" max="40" value="${wt.lautstaerke}" style="--p:${wt.lautstaerke / 40 * 100}%" data-wtvvol></div>` : ''}
      <div class="card"><div class="ch"><div class="ic">${ico('moon')}</div><div><b>Morgen aussetzen</b><small>${ai.skip ? 'Morgen bleibt es ruhig' : 'Einmalig, rückgängig möglich'}</small></div><button class="tgl vio sm${ai.skip ? ' on' : ''}" data-act="skip" aria-label="Morgen aussetzen"></button></div></div>
`);
  };
  let ringAt = null, snoozes = 0;
  function openRing() {
    const ai = Z.alarmInfo(); ringAt = ai.n ? ai.n.at : new Date(); snoozes = 0;
    ringPaint();
    $('ring').classList.add('on');
  }
  function ringPaint() {
    const me = Z.me()?.name || '', w = Z.S.wetter, day = new Date(ringAt); day.setHours(0, 0, 0, 0);
    const first = Z.evOn(Z.iso(day)).find(x => x.t);
    put($('ring'), `<small>${esc(Z.W().ton)} · ${ringAt.toLocaleDateString('de-DE', { weekday: 'long' })}</small><b>${hm(ringAt)}</b><p>Guten Morgen${me ? ', ' + esc(me) : ''} ☀️</p><p class="rsub">${esc([snoozes ? snoozes + '× geschlummert' : '', w?.heute ? `${w.ort} ${w.heute.min}° → ${w.heute.max}°` : '', first ? `${first.n} ab ${first.t}` : 'heute keine Termine'].filter(Boolean).join(' · '))}</p><button class="snz" data-act="snooze">Schlummern · 10 Min</button><button class="hold" id="hold"><i></i><span>Gedrückt halten: Aufstehen</span></button>`);
  }

  // ---------------------------------------------------------------- Partner
  RN.partner = () => {
    const X = window.ZHX, p = Z.partner(), nm = esc(p?.name || 'Ida'), n = Z.meetIn(), pr = X.presence(), tog = Z.together(), f = n == null ? 0 : Math.max(0, Math.min(1, 1 - n / 30)), r = 23, c = 2 * Math.PI * r;
    const PING = X.pingDays(), Wd = 340, H = 190, top = 10, base = H - 22, stp = Wd / 14, bw = 7, max = Math.max(1, ...PING.flatMap(d => [d.a, d.b])), hg = v => (v ? Math.max(3, v / max * (base - top)) : 0), sa = PING.reduce((s, d) => s + d.a, 0), sb = PING.reduce((s, d) => s + d.b, 0);
    const bars = PING.map((d, i) => { const x = i * stp + stp / 2, dt = new Date(d.t), lab = i === 13 ? 'heute' : i % 2 ? WD[dt.getDay()] : ''; return `<g class="xh" data-tip="${WD[dt.getDay()]} ${dt.getDate()}.${dt.getMonth() + 1}.: du ${d.a} · ${nm} ${d.b}"><rect x="${(x - stp / 2).toFixed(1)}" y="0" width="${stp.toFixed(1)}" height="${H}" fill="transparent"/>${d.a ? `<path d="${colPath(x - bw / 2 - 1, base, bw, hg(d.a))}" class="ba"/>` : ''}${d.b ? `<path d="${colPath(x + bw / 2 + 1, base, bw, hg(d.b))}" class="bb"/>` : ''}${lab ? `<text x="${x.toFixed(1)}" y="${base + 15}" text-anchor="middle" class="ax${i === 13 ? ' axn' : ''}">${lab}</text>` : ''}</g>`; }).join('');
    const g = X.D.ping;
    put($('s-partner'), ph('Partner', `${nm} und du`, true)
      + `<div class="card"><div class="pph"><div class="pav${pr.online ? ' on' : ''}">${esc((p?.name || 'I').slice(0, 1).toUpperCase())}</div><div><b>${p ? nm : 'Noch kein Partner-Konto'}</b><small>${esc(pr.txt || ' ')}</small><span class="cd">${esc(Z.wiedersehen())}</span></div></div></div>
      <div class="facts"><div class="card fact"><b>${esc(tog || '–')}</b><span>Tage zusammen</span></div><div class="card fact fring"><svg viewBox="0 0 56 56"><circle cx="28" cy="28" r="${r}" class="rbg"/><circle cx="28" cy="28" r="${r}" class="rfg" stroke-dasharray="${(c * f).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 28 28)"/></svg><div><b>${n == null ? '–' : n <= 0 ? 'heute' : n}</b><span>${n == null ? 'kein Treffen geplant' : n <= 0 ? 'seht ihr euch' : n === 1 ? 'Tag bis zum Wiedersehen' : 'Tage bis zum Wiedersehen'}</span></div></div></div>
      <button class="think" id="think" data-act="think">${ico('heart')}<span>Ich denk an dich</span></button>
      <div class="card xc"><div class="cth"><b>Aneinander gedacht<small>letzte 14 Tage</small></b><span class="cap">${X.D.pings ? '' : 'lädt …'}</span></div><div class="lg"><i class="la"></i>du ${sa}<i class="lb"></i>${nm} ${sb}</div>
      <svg viewBox="0 0 ${Wd} ${H}" class="xs"><line x1="0" x2="${Wd}" y1="${base}" y2="${base}" class="xbase"/>${bars}</svg></div>
      <div class="hint">${g ? `Letzter Ping: ${g.from === X.myId() ? 'du → ' + nm : nm + ' → dich'} · ${esc(X.ago(X.pbMs(g.created)))}` : ''}</div>`);
  };

  // ---------------------------------------------------------------- Abfahrten
  const tagD = (d, a) => (a ? '<em class="tag bad">fällt aus</em>' : d == null ? '' : d > 0 ? `<em class="tag ${d >= 5 ? 'bad' : 'warn'}">+${d}</em>` : '<em class="tag ok">pünktlich</em>');
  RN.abf = () => {
    const X = window.ZHX, p = X.prefs(), a = X.D.abf, now = Date.now(), mt = t => Math.round((Date.parse(t) - now) / MIN);
    const head = sub => ph('Abfahrten', sub, true, '<button class="chipb" data-act="stop">Wechseln</button>') + `<div class="seg" style="margin-bottom:14px">${['bus', 'bahn'].map(k => `<button class="${p.arten[k] ? 'on' : ''}" data-art="${k}">${k === 'bus' ? 'Bus' : 'Bahn'}</button>`).join('')}</div>`;
    if (!p.haltestelle || a?.aus) { put($('s-abf'), ph('Abfahrten', 'keine Haltestelle gewählt', true) + '<div class="card empty">Wähle deine Haltestelle, dann stehen hier die nächsten Abfahrten.<br><button class="chipb" data-act="stop" style="margin-top:12px">Haltestelle wählen</button></div>'); return; }
    if (!a) { put($('s-abf'), head(esc(p.haltestelle.name)) + `<div class="card empty">${X.D.abfErr ? esc(X.D.abfErr) : 'Lädt …'}</div>`); return; }
    if (a.at && now - a.at > 20 * MIN) { put($('s-abf'), head(esc(a.haltestelle || a.name || '')) + '<div class="card empty">Fahrplan gerade nicht erreichbar – versuche es gleich wieder.</div>'); return; }
    const Ls = a.abfahrten || [], nx = Ls.find(x => !x.ausfall && mt(x.echt) >= 0), late = Ls.filter(x => !x.ausfall && x.delay > 0).length, gone = Ls.filter(x => x.ausfall).length;
    put($('s-abf'), head(esc((a.haltestelle || a.name || p.haltestelle.name) + ' · Stand ' + hm(a.stale ? a.at : now)))
      + (nx ? `<div class="card nxt" style="--lc:${esc(nx.farbe || '#5a6a7a')}"><span class="ln">${esc(nx.linie || '–')}</span><div><small>Nächste Abfahrt</small><b>${esc(nx.ziel)}</b></div><strong>${mt(nx.echt) <= 0 ? 'jetzt' : mt(nx.echt) + '<small>Min</small>'}</strong></div>` : '')
      + `<div class="pills"><span><b>${Ls.length}</b> Abfahrten</span><span class="${late ? 'warn' : ''}"><b>${late}</b> verspätet</span><span class="${gone ? 'bad' : ''}"><b>${gone}</b> fallen aus</span></div>
      <div class="card"><div class="cth"><b>Abfahrtstafel</b><span class="cap"></span></div>${Ls.map(x => { const m = mt(x.echt), plan = x.delay > 0 ? Date.parse(x.echt) - x.delay * MIN : Date.parse(x.echt); return `<div class="dep${x.ausfall ? ' x' : ''}${m <= 2 && !x.ausfall ? ' now' : ''}"><span class="ln" style="--lc:${esc(x.farbe || '#5a6a7a')}">${esc(x.linie || '–')}</span><span class="dir">${esc(x.ziel)}<small>${x.art === 'bus' ? 'Bus · ' : x.art === 'bahn' ? 'Zug · ' : ''}plan ${hm(plan)}</small></span>${tagD(x.delay, x.ausfall)}<span class="min">${x.ausfall ? '–' : m <= 0 ? 'jetzt' : m < 60 ? m + ' Min' : hm(x.echt)}</span></div>`; }).join('') || '<div class="empty">Gerade keine Abfahrten</div>'}</div>`
      + (a.fahrt?.verbindungen ? `<div class="card"><div class="ch" style="margin-bottom:8px"><div class="ic pink">${ico('route')}</div><div><b>Fahrt zu ${esc(Z.partner()?.name || 'Ida')}</b><small>${esc(a.fahrt_von || '')} → ${esc(a.fahrt_nach || '')}</small></div></div>
        ${a.fahrt.verbindungen.map(v => { const dA = Math.max(0, Math.round((Date.parse(v.ab) - Date.parse(v.abPlan)) / MIN)); return `<div class="con${v.ausfall ? ' x' : ''}"><div><b>${hm(v.abPlan)}</b>${dA ? ` <em class="tag ${dA >= 5 ? 'bad' : 'warn'}">+${dA}</em>` : ''} → <b>${hm(v.anPlan)}</b><small>${Math.floor(v.dauer / 60)}:${p2(v.dauer % 60)} h · ${v.umstiege ? v.umstiege + (v.umstiege === 1 ? ' Umstieg' : ' Umstiege') : 'direkt'}${v.ausfall ? ' · Ausfall' : ''}</small></div><div class="lin">${v.linien.map(l => `<span class="${l.ausfall ? 'strike' : ''}">${esc(l.linie || (l.art === 'bus' ? 'Bus' : 'Zug'))}</span>`).join('<i>›</i>')}</div></div>`; }).join('') || '<div class="empty">Keine Verbindung gefunden</div>'}</div>` : ''));
  };

  // ---------------------------------------------------------------- Pakete
  const PAK = { heute: ['Zustellung heute', 'teal', 2], unterwegs: ['unterwegs', 'vio', 1], abholbereit: ['abholbereit', 'teal', 3], zugestellt: ['zugestellt', 'ok', 3], problem: ['Problem', 'bad', 1], unbekannt: ['noch keine Daten', 'mut', 0] };
  const STEPS = ['verschickt', 'unterwegs', 'heute', 'da'], ORD = { heute: 0, abholbereit: 1, problem: 2, unterwegs: 3, unbekannt: 4, zugestellt: 5 };
  let pkOpen = '';
  RN.pak = () => {
    const X = window.ZHX, Pk = X.D.pak;
    if (!Pk || Pk.aus) { put($('s-pak'), ph('Pakete', Pk ? 'ausgeschaltet' : 'lädt …', true) + `<div class="card empty">${Pk ? 'Pakete sind ausgeschaltet' : 'Lädt …'}</div>`); return; }
    const Ls = (Pk.pakete || []).slice().sort((a, b) => (ORD[a.status] ?? 3) - (ORD[b.status] ?? 3)), cnt = s => Ls.filter(x => x.status === s).length, n = Ls.filter(x => x.status !== 'zugestellt').length;
    put($('s-pak'), ph('Pakete', esc((n ? n + ' unterwegs' : 'alles da') + (Pk.at ? ' · Stand ' + hm(Pk.at) : '') + (Pk.test ? ' · Test' : '')), true, '<button class="chipb" data-act="pkref">Aktualisieren</button>')
      + (Ls.length ? `<div class="pills"><span class="${cnt('heute') ? 'teal' : ''}"><b>${cnt('heute')}</b> heute</span><span><b>${cnt('unterwegs')}</b> unterwegs</span><span class="${cnt('abholbereit') ? 'teal' : ''}"><b>${cnt('abholbereit')}</b> abholbereit</span><span class="${cnt('problem') ? 'bad' : ''}"><b>${cnt('problem')}</b> Problem</span></div>` : '')
      + (Ls.map((x, i) => {
        const [lbl, cls, stp] = PAK[x.status] || PAK.unterwegs, bad = x.status === 'problem', k = x.name + '|' + i, open = pkOpen === k;
        return `<div class="card pc${x.status === 'zugestellt' ? ' done' : ''}${open ? ' open' : ''}" data-pk="${esc(k)}"><div class="pct"><b>${esc(x.name)}</b><span class="st ${cls}">${lbl}</span></div><small class="from">${esc(x.ort || '')}</small>
          <div class="steps ${cls}" style="--p:${stp / 3}">${STEPS.map((s, j) => `<i class="${j <= stp ? 'on' : ''}${bad && j === stp ? ' bs' : ''}"><small>${x.status === 'abholbereit' && j === 3 ? 'abholen' : s}</small></i>`).join('')}</div><small class="pinfo">${esc(x.text || '')}${x.zeit ? ' · ' + esc(X.dateTxt(x.zeit)) : ''}</small>
          ${open ? `<div class="ver"><div class="cur"><i></i><span>${esc(x.text || lbl)}</span><em>${esc(X.dateTxt(x.zeit))}</em></div>${x.ort ? `<div><i></i><span>${esc(x.ort)}</span><em>Ort</em></div>` : ''}</div>` : ''}</div>`;
      }).join('') || `<div class="card empty">${Pk.fehlt ? '17TRACK ist in Home Assistant nicht eingerichtet' : 'Keine Pakete unterwegs'}</div>`));
  };

  // ---------------------------------------------------------------- System
  const AT = { g: ['ok', 'alles gut'], y: ['warn', 'Achtung'], r: ['bad', 'Problem'], n: ['', 'unbekannt'] };
  let sysOpen = '';
  RN.sys = () => {
    const X = window.ZHX, s = X.D.sys;
    if (!s) { put($('s-sys'), ph('System', 'lädt …', true) + '<div class="card empty">Lädt …</div>'); return; }
    if (!sysOpen && s.gruppen[0]) sysOpen = (s.gruppen.find(g => g.a === 'r') || s.gruppen.find(g => g.a === 'y') || s.gruppen[0]).k;
    const all = s.gruppen.flatMap(g => g.items).filter(i => !i.ohne_ampel), c = a => all.filter(i => i.a === a).length, g = s.gruppen.find(x => x.k === sysOpen), K = s.kurve || [];
    const itemTxt = i => [i.wert, i.zeit ? (i.k === 'deploy' ? X.dateTxt(i.zeit) : X.ago(Date.parse(i.zeit))) : ''].filter(Boolean).join(' · ');
    put($('s-sys'), ph('System', esc('geprüft ' + hm(s.at) + (s.test ? ' · Testdaten' : '')), true, '<button class="chipb" data-act="syref">Prüfen</button>')
      + `<div class="card shero ${(AT[s.a] || AT.n)[0]}"><i class="pulse"></i><div><b>${{ g: 'Alles im grünen Bereich', y: 'Ein Auge drauf haben', r: 'Etwas braucht dich' }[s.a] || 'Status unbekannt'}</b><small>${c('g')} gut · ${c('y')} Achtung · ${c('r')} Problem</small></div></div>
      <div class="tiles">${s.gruppen.map(x => { const b = x.items.filter(i => !i.ohne_ampel && (i.a === 'y' || i.a === 'r')).length; return `<button class="card tile${sysOpen === x.k ? ' on' : ''}" data-g="${esc(x.k)}"><i class="dot ${(AT[x.a] || AT.n)[0]}"></i><b>${esc(x.name)}</b><small>${(AT[x.a] || AT.n)[1]}${b ? ' · ' + b + (b === 1 ? ' Punkt' : ' Punkte') : ''}${x.updates?.length ? ' · ' + x.updates.length + ' Updates' : ''}</small></button>`; }).join('')}</div>
      ${g ? `<div class="card"><div class="cth"><b>${esc(g.name)}</b></div>${g.items.map(i => `<div class="li"><i class="dot ${i.ohne_ampel ? '' : (AT[i.a] || AT.n)[0]}"></i><span>${esc(i.name)}</span><em>${esc(itemTxt(i))}</em></div>`).join('')}${g.updates?.length ? `<div class="up"><b>Updates verfügbar</b>${g.updates.map(u => `<div><span>${esc(u.name)}</span><em>${esc(u.von)} → ${esc(u.nach)}</em></div>`).join('')}</div>` : ''}</div>` : ''}
      <div class="sec">Letzte 24 Stunden</div>
      ${[['last', 'Last', 'Prozessor, alle Kerne', '#f5b45a'], ['ram', 'Arbeitsspeicher', 'belegt', '#b48cff'], ['disk', 'Festplatte', 'belegt', '#5fd3c6']].map(([k, n, sub, col]) => { const v = K.map(p => p[k]).filter(Number.isFinite); return `<div class="card xc kv" style="color:${col}"><div class="cth"><b>${n}<small>${sub}</small></b><span class="xbig">${v.length ? Math.round(v[v.length - 1]) : '–'}<small> %</small></span></div><span class="cap">${v.length ? `min ${Math.round(Math.min(...v))} · max ${Math.round(Math.max(...v))} %` : ''}</span>${area(K, k, 0, 100, '%', 340, 100)}</div>`; }).join('')}`);
  };

  // ---------------------------------------------------------------- Einstellungen
  RN.einst = () => {
    const L = Z.local, st = Z.status(), X = window.ZHX, p = X?.prefs() || { arten: {}, fahrt: {} }, tv = Z.cfg()?.fernseher, c = Z.cfg() || {}, K = c.klima || {};
    const row = (i, b, s, ctl, id = '') => `<div class="set"${id ? ` id="${id}"` : ''}><div class="ic">${ico(i)}</div><div><b>${b}</b><small>${s}</small></div>${ctl}</div>`;
    const tg = (k, val) => `<button class="tgl vio sm${val ? ' on' : ''}" data-set="${k}" aria-label="${k}"></button>`;
    const li = (cls, a, b) => `<div class="li"><i class="dot ${cls}"></i><span>${a}</span><em>${b}</em></div>`;
    put($('s-einst'), ph('Einstellungen', '', true)
      + `<div class="sec">Anzeige</div><div class="card" style="padding:4px 16px">
        ${row('eye', 'Leistungsmodus', '', tg('perf', Z.perfOn()))}
        ${row('moon', 'Nachtdimmung', '', tg('night', L.night))}
        ${row('tab', 'Bildschirmschoner', '', `<div class="seg">${[1, 5, 10].map(m => `<button class="${L.saverMin === m ? 'on' : ''}" data-m="${m}">${m}</button>`).join('')}</div>`)}
        ${row('sun', 'Bildschirmschoner testen', '', '<button class="chipb" data-act="saver">Jetzt</button>')}
        ${row('bell', 'Hinweise', '', tg('toasts', L.toasts))}</div>
      <div class="sec">Unterwegs</div><div class="card" style="padding:4px 16px">
        ${row('bus', 'Haltestelle', esc(p.haltestelle?.name || 'keine – Abfahrten ausgeblendet'), '<button class="chipb" data-act="stop">Wählen</button>')}
        ${p.haltestelle ? row('route', 'Verkehrsmittel', '', `<div class="seg">${['bus', 'bahn'].map(k => `<button class="${p.arten[k] ? 'on' : ''}" data-art="${k}">${k === 'bus' ? 'Bus' : 'Bahn'}</button>`).join('')}</div>`) : ''}
        ${row('heart', 'Fahrt zu ' + esc(Z.partner()?.name || 'Ida'), esc(p.fahrt?.von || p.fahrt?.nach ? `${p.fahrt.von?.name || '?'} → ${p.fahrt.nach?.name || '?'}` : ''), '<div class="two"><button class="chipb" data-ort="von">Start</button><button class="chipb" data-ort="nach">Ziel</button></div>')}</div>
      ${tv?.titel && !st.test ? `<div class="sec">Fernseher</div><div class="card" style="padding:4px 16px">${row('film', 'Kino-Licht', '', `<button class="tgl vio sm${Z.S.settings.fernseher?.kinolicht ? ' on' : ''}" data-act="kino" aria-label="Kino-Licht"></button>`)}</div>` : ''}
      <div class="sec">Verbindungen</div><div class="card" style="padding:4px 16px">
        ${li(st.bad ? 'bad' : 'ok', 'Home Assistant', st.stale ? 'Dienst nicht erreichbar' : st.test ? 'bereit (Test)' : st.connected ? 'verbunden' : 'getrennt' + (st.error ? ': ' + esc(st.error) : ''))}
        ${li('ok', 'Wir-App', 'verbunden · ' + esc(Z.me()?.name || '…'))}
        ${li(st.test || st.kalTest ? 'warn' : 'ok', 'Modus', st.test ? 'Testmodus (simulierte Daten)' : st.kalTest ? 'echt · Kalender mit Testterminen' : 'echte Daten')}</div>
      <div class="sec">Geräte</div><div class="card" style="padding:4px 16px">
        <div class="li">💡<span>${esc((c.lampen || []).map(l => l.name).join(' · ') || '–')}</span><em>light.*</em></div>
        ${tv ? `<div class="li">📺<span>${esc(tv.name)}</span><em>${esc(tv.entity_id)}</em></div>` : ''}
        ${K.temperatur || K.luftfeuchte ? `<div class="li">🌡️<span>Raumklima</span><em>${esc([K.temperatur, K.luftfeuchte].filter(Boolean).join(', ').replace(/sensor\./g, ''))}</em></div>` : ''}
        ${(c.sensoren || []).length ? `<div class="li">🪟<span>${esc(c.sensoren.map(x => x.name).join(' · '))}</span><em>binary_sensor.*</em></div>` : ''}</div>
      <div class="hint">Wir Zuhause · Version ${esc(window.WIR_VERSION || '…')}</div>`);
  };
  // Haltestellen-Suche (Blatt)
  let ortTarget = '', ortRes = [], ortT = 0, ortMsg = 'Mindestens 3 Buchstaben';
  function openOrt(target) {
    ortTarget = target; ortRes = []; ortMsg = 'Mindestens 3 Buchstaben';
    const label = target === 'haltestelle' ? 'Haltestelle für die Abfahrten' : target === 'von' ? 'Start der Fahrt' : 'Ziel der Fahrt';
    sheet(() => `<div class="grab"></div><h3>${label}</h3>
      <form class="tdadd" data-form="ort"><input id="ortQ" type="search" placeholder="Haltestelle suchen …" autocomplete="off" spellcheck="false" enterkeyhint="search"></form>
      <div class="rows">${ortRes.map((o, i) => `<button class="rw" data-oi="${i}"><div class="ic teal">${ico('bus')}</div><div><b>${esc(o.name)}</b><small>${esc(o.sub)}</small></div></button>`).join('') || `<div class="empty">${esc(ortMsg)}</div>`}</div>
      <button class="chipb" data-act="ortdel" style="margin-top:12px">Entfernen</button>`);
    setTimeout(() => $('ortQ')?.focus(), 80);
  }

  // ---------------------------------------------------------------- Ereignisse
  let lpT = 0, lpFired = false, lpXY = null, drag = null, hbDrag = null, hd = null;
  function hdSet(e, final) {
    const r = hd.el.getBoundingClientRect(), v = Math.max(1, Math.min(100, Math.round((e.clientX - r.left) / r.width * 100)));
    hd.el.classList.add('on'); hd.el.querySelector('.zfill').style.width = v + '%'; hd.el.querySelector('b').textContent = v + ' %';
    Z.lampSet(hd.key, { brightness_pct: v }, final);
  }
  function dragSet(e, final) {
    const r = drag.getBoundingClientRect(), key = drag.dataset.vs, v = Math.max(1, Math.min(100, Math.round((r.bottom - e.clientY) / r.height * 100)));
    drag.firstChild.style.height = v + '%';
    const tile = drag.closest('.lt'); tile.classList.add('on'); tile.querySelector('b').textContent = v + ' %';
    Z.lampSet(key, { brightness_pct: v }, final);
  }
  function hbSet(e, final) {
    const r = hbDrag.getBoundingClientRect(), f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    hbDrag.firstChild.style.width = f * 100 + '%';
    if (hbDrag.dataset.hb === 'vol') { const v = Z.tvView(); if (v) Z.tvVol(f * v.max, final); } else Z.tvHell(f * 100);
  }
  const ACT = {
    back: () => Z.back(), bell: () => sheet(bellHtml), wetter: () => sheet(wetterHtml), klima: () => sheet(klimaHtml),
    allOn: () => { Z.lampsAll(true); Z.toast('Alle Lichter an'); }, allOff: () => { Z.lampsAll(false); Z.toast('Alle Lichter aus'); },
    allL: () => { const a = Z.lamps().some(l => l.on); Z.lampsAll(!a); Z.toast(a ? 'Alle Lichter aus' : 'Alle Lichter an'); },
    tvpow: () => Z.tvPower(), tvon: () => { const v = Z.tvView(); if (v?.bildAus) Z.tvBild(); else Z.tvPower(true); },
    play: () => Z.tvPlay(), prev: () => Z.tvTrack(-1), next: () => Z.tvTrack(1),
    mute: () => Z.tvMute(), vminus: () => Z.tvVolStep(-1), vplus: () => Z.tvVolStep(1),
    bild: () => Z.tvBild(), shot: () => { Z.tvShot(); sheet(shotHtml); }, shotx: () => { Z.shotClose(); closeSheet(); },
    hminus: () => Z.tvHell((Z.hell() ?? 50) - 10), hplus: () => Z.tvHell((Z.hell() ?? 50) + 10), tvdel: () => Z.tvTextDel(),
    kprev: () => { kMon = new Date(kMon.getFullYear(), kMon.getMonth() - 1, 1); RN.kal(); }, knext: () => { kMon = new Date(kMon.getFullYear(), kMon.getMonth() + 1, 1); RN.kal(); },
    ktoday: () => { kMon = new Date(new Date().getFullYear(), new Date().getMonth(), 1); kSel = day0(); RN.kal(); },
    wtest: () => { openRing(); Z.alarm.test(); }, aladd: () => Z.alarm.add(), skip: () => Z.alarm.skip(), wtv: () => Z.alarm.tv({ an: !Z.wtv().an }),
    snooze: () => { $('ring').classList.remove('on'); Z.toast('Schlummern · 10 Min'); },
    think: async () => {
      const b = $('think'); if (!b) return; b.classList.add('sent');
      const ok = await window.ZHX.think(b);
      if (ok == null) { b.classList.remove('sent'); return; }
      const sp = $('think')?.querySelector('span'); if (sp) sp.textContent = ok ? 'Gesendet 💗' : 'Hat nicht geklappt';
      setTimeout(() => { const x = $('think'); if (x) { x.classList.remove('sent'); x.querySelector('span').textContent = 'Ich denk an dich'; } }, 3000);
    },
    stop: () => openOrt('haltestelle'),
    ortdel: () => { if (ortTarget) window.ZHX.setOrt(ortTarget, null); closeSheet(); },
    pkref: () => { window.ZHX.refresh('pak'); Z.toast('Pakete werden aktualisiert …'); }, syref: () => { window.ZHX.refresh('sys'); Z.toast('System wird geprüft …'); },
    saver: () => setTimeout(openSaver, 50), kino: () => Z.kino(),
  };
  function wire() {
    R.addEventListener('pointerdown', e => {
      const vs = e.target.closest('.vs');
      if (vs) { drag = vs; Z.drag(Z.lampBy(vs.dataset.vs)?.id); vs.setPointerCapture(e.pointerId); dragSet(e); return; }
      const hb = e.target.closest('[data-hb]');
      if (hb) { hbDrag = hb; if (hb.dataset.hb === 'vol') Z.drag(Z.cfg()?.fernseher?.entity_id); hb.setPointerCapture(e.pointerId); hbSet(e); return; }
      const t = e.target.closest('[data-l]'); if (t) {
        lpFired = false; lpXY = [e.clientX, e.clientY]; t.classList.add('press'); clearTimeout(lpT);
        lpT = setTimeout(() => { lpFired = true; t.classList.remove('press'); openColor(t.dataset.l); }, 480);
        if (t.classList.contains('pl') && Z.lampBy(t.dataset.l)?.dimm) hd = { el: t, key: t.dataset.l, x: e.clientX, y: e.clientY, id: e.pointerId, moved: false };
      }
      // To-dos nach links wischen = löschen
      const td = e.target.closest('[data-td]'); if (td && !e.target.closest('[data-who],[data-tdx]')) sw = { t: td, x: e.clientX, y: e.clientY, dx: 0, id: e.pointerId };
    });
    const lpStop = () => { clearTimeout(lpT); $$('.press').forEach(x => x.classList.remove('press')); };
    let sw = null, swiped = false;
    R.addEventListener('pointermove', e => {
      if (drag) return dragSet(e);
      if (hbDrag) return hbSet(e);
      if (hd && e.pointerId === hd.id) {
        if (!hd.moved && Math.abs(e.clientX - hd.x) > 10 && Math.abs(e.clientX - hd.x) > Math.abs(e.clientY - hd.y)) { hd.moved = true; lpStop(); lpXY = null; Z.drag(Z.lampBy(hd.key)?.id); try { hd.el.setPointerCapture(e.pointerId); } catch (_) {} }
        if (hd.moved) return hdSet(e);
      }
      if (lpXY && Math.hypot(e.clientX - lpXY[0], e.clientY - lpXY[1]) > 8) lpStop();
      if (sw && e.pointerId === sw.id) {
        sw.dx = Math.min(0, e.clientX - sw.x);
        if (Math.abs(sw.dx) > 12 && Math.abs(sw.dx) > Math.abs(e.clientY - sw.y)) { if (!sw.moved) { try { sw.t.setPointerCapture(e.pointerId); } catch (_) {} } sw.moved = true; sw.t.style.transform = `translateX(${sw.dx}px)`; sw.t.style.opacity = 1 + sw.dx / 240; }
      }
    });
    const up = e => {
      if (drag) { dragSet(e, true); drag = null; Z.drag(null); upd(); }
      if (hbDrag) { hbSet(e, true); hbDrag = null; Z.drag(null); upd(); }
      if (hd) { const h = hd; hd = null; if (h.moved) { hd = h; hdSet(e, true); hd = null; swiped = true; setTimeout(() => { swiped = false; }, 60); Z.drag(null); upd(); } }
      lpStop(); lpXY = null; if (lpFired) setTimeout(() => { lpFired = false; }, 350);
      if (sw && e.pointerId === sw.id) {
        const s = sw; sw = null;
        if (s.moved) { swiped = true; setTimeout(() => { swiped = false; }, 60); if (s.dx < -90) Z.todoDel(s.t.dataset.td); else { s.t.style.transform = ''; s.t.style.opacity = ''; } }
      }
    };
    R.addEventListener('pointerup', up);
    R.addEventListener('pointercancel', () => { drag = null; hbDrag = null; if (hd?.moved) upd(); hd = null; Z.drag(null); lpStop(); if (sw) { sw.t.style.transform = ''; sw.t.style.opacity = ''; sw = null; } });
    R.addEventListener('contextmenu', e => { if (e.target.closest('[data-l]')) e.preventDefault(); });
    R.addEventListener('click', e => {
      const T = s => e.target.closest(s);
      if (lpFired) { e.stopPropagation(); e.preventDefault(); lpFired = false; return; }
      if (swiped || T('.vs') || T('[data-hb]')) return;
      let t;
      if ((t = T('.xh'))) { const box = t.closest('.xc'); box.querySelectorAll('.xh.sel').forEach(x => x.classList.remove('sel')); t.classList.add('sel'); const c = box.querySelector('.cap'); if (c) { c.textContent = t.dataset.tip; c.classList.add('set'); } return; }
      if (T('#shade')) { if (Z.shotView().open) Z.shotClose(); return closeSheet(); }
      if ((t = T('[data-act]'))) return ACT[t.dataset.act]?.();
      if ((t = T('[data-go]'))) return go(t.dataset.go);
      if ((t = T('[data-rt]'))) { Z.call({ entity_id: t.dataset.rt, service: t.dataset.on === '1' ? 'turn_off' : 'turn_on' }); t.classList.toggle('on'); t.dataset.on = t.dataset.on === '1' ? '0' : '1'; return; }
      if ((t = T('[data-l]'))) { const l = Z.lampBy(t.dataset.l); if (l) { const o = Z.lampToggle(l.key); Z.toast(`${l.name} ${o ? 'an' : 'aus'}`); } return; }
      if ((t = T('[data-sc]'))) { Z.scene(t.dataset.sc); setTimeout(closeSheet, 350); return; }
      if ((t = T('[data-cpc]'))) { if (cpId) Z.lampColor(cpId, t.dataset.cpc); return; }
      if ((t = T('[data-cp]'))) { if (cpId) Z.lampToggle(cpId); return; }
      if ((t = T('[data-sens]'))) { const s = Z.sensoren().find(x => x.entity_id === t.dataset.sens); if (s) Z.toast(s.na ? `${s.name}: nicht erreichbar` : `${s.name} ${s.open ? 'offen seit ' + s.seit : 'zu'} · nur Anzeige`); return; }
      if ((t = T('[data-app]'))) { Z.tvApp(t.dataset.app); return; }
      if ((t = T('[data-more]'))) { Z.tvMore(+t.dataset.more); return; }
      if ((t = T('[data-src]'))) { Z.tvSrc(+t.dataset.src); return; }
      if ((t = T('[data-k]'))) { Z.tvKey(t.dataset.k); t.animate?.([{ transform: 'scale(.92)' }, { transform: 'scale(1)' }], { duration: 160 }); return; }
      if ((t = T('[data-day]'))) { kSel = +t.dataset.day; return RN.kal(); }
      if ((t = T('[data-pf]'))) { const p = t.dataset.pf; if (kOff.has(p)) kOff.delete(p); else kOff.add(p); return RN.kal(); }
      if ((t = T('[data-tdl]'))) { tdL = t.dataset.tdl; return RN.kal(); }
      if ((t = T('[data-td]'))) { const id = t.dataset.td; if (T('[data-tdx]')) Z.todoDel(id); else if (T('[data-who]')) Z.todoWho(id); else Z.todoToggle(id); return; }
      if ((t = T('[data-al]'))) { Z.alarm.toggle(t.dataset.al); return; }
      if ((t = T('[data-ald]'))) { const [id, d] = t.dataset.ald.split(':'); Z.alarm.day(id, +d); return; }
      if ((t = T('[data-aldel]'))) { Z.alarm.del(t.dataset.aldel); return; }
      if ((t = T('[data-tone]'))) { Z.alarm.ton(t.dataset.tone); return; }
      if ((t = T('[data-wapp]'))) { Z.alarm.tv({ app: t.dataset.wapp, an: true }); return; }
      if ((t = T('[data-art]'))) { if (!window.ZHX.toggleArt(t.dataset.art)) Z.toast('Mindestens Bus oder Bahn'); return; }
      if ((t = T('[data-ort]'))) { openOrt(t.dataset.ort); return; }
      if ((t = T('[data-oi]'))) { const o = ortRes[+t.dataset.oi]; if (o && ortTarget) { window.ZHX.setOrt(ortTarget, { id: o.id, name: o.name }); Z.toast('Gespeichert: ' + o.name); } closeSheet(); return; }
      if ((t = T('[data-pk]'))) { pkOpen = pkOpen === t.dataset.pk ? '' : t.dataset.pk; return RN.pak(); }
      if ((t = T('[data-g]'))) { sysOpen = t.dataset.g; return RN.sys(); }
      if ((t = T('[data-set]'))) { const k = t.dataset.set; if (k === 'perf') Z.setPerf(!Z.perfOn()); else Z.setLocal(k, !Z.local[k]); applyNight(); return; }
      if ((t = T('[data-m]'))) { Z.setLocal('saverMin', +t.dataset.m); armSaver(); return; }
    }, true);
    R.addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target.dataset.form;
      if (f === 'todo') { const i = $('tdIn'); const v = i.value.trim(); if (!v) return; Z.todoAdd(tdL, v); i.value = ''; }
      if (f === 'tvtext') { const i = $('tvText'); Z.tvText(i.value, true).then(ok => { if (ok) i.value = ''; }); }
    });
    R.addEventListener('input', e => {
      const t = e.target;
      if (t.matches('[data-cpdim]')) { if (!cpId) return; cpDrag = true; Z.drag(Z.lampBy(cpId)?.id); t.style.setProperty('--p', t.value + '%'); const b = $('cpB'); if (b) b.textContent = t.value + ' %'; Z.lampSet(cpId, { brightness_pct: +t.value }); }
      if (t.matches('[data-cpfree]') && cpId) Z.lampColor(cpId, t.value, false);
      if (t.matches('[data-sr]')) { t.style.setProperty('--p', t.value / 30 * 100 + '%'); const s = $('srv'); if (s) s.textContent = t.value; }
      if (t.matches('[data-wtvvol]')) { t.style.setProperty('--p', t.value / 40 * 100 + '%'); const s = $('wtvv'); if (s) s.textContent = t.value; }
      if (t.id === 'ortQ') {
        clearTimeout(ortT);
        const q = t.value.trim();
        if (q.length < 3) { ortRes = []; ortMsg = 'Mindestens 3 Buchstaben'; return; }
        ortT = setTimeout(async () => {
          try { const res = await window.ZHX.searchOrte(q); if ($('ortQ')?.value.trim() !== q) return; ortRes = res; ortMsg = 'Nichts gefunden'; }
          catch (err) { if (err?.isAbort) return; ortRes = []; ortMsg = err?.message || 'Suche gerade nicht möglich'; }
          paintOrt();
        }, 450);
      }
    });
    R.addEventListener('change', e => {
      const t = e.target;
      if (t.matches('[data-cpdim]') && cpId) { cpDrag = false; Z.drag(null); Z.lampSet(cpId, { brightness_pct: +t.value }, true); }
      if (t.matches('[data-cpfree]') && cpId) Z.lampColor(cpId, t.value, true);
      if (t.matches('[data-sr]')) Z.alarm.vorlauf(+t.value);
      if (t.matches('[data-wtvvol]')) Z.alarm.tv({ lautstaerke: +t.value });
      if (t.matches('[data-altime]') && t.value) { Z.alarm.time(t.dataset.altime, t.value); Z.toast('Wecker auf ' + t.value.replace(/^0/, '')); }
    });
    // Aufstehen: gedrückt halten (1,2 s)
    R.addEventListener('pointerdown', e => {
      const h = e.target.closest('#hold'); if (!h) return;
      const t0 = Date.now(); let raf = 0;
      const step = () => { const p = Math.min(1, (Date.now() - t0) / 1200); h.firstChild.style.width = p * 100 + '%'; if (p >= 1) { $('ring').classList.remove('on'); Z.toast('Guten Morgen! Wecker beendet'); } else raf = requestAnimationFrame(step); };
      raf = requestAnimationFrame(step);
      const stop = () => { cancelAnimationFrame(raf); if (h.firstChild) h.firstChild.style.width = 0; h.removeEventListener('pointerup', stop); h.removeEventListener('pointerleave', stop); };
      h.addEventListener('pointerup', stop); h.addEventListener('pointerleave', stop);
    });
    // Bildschirmschoner: Antippen weckt nur auf
    R.addEventListener('pointerdown', e => { if (e.target.closest('#saver')) { e.stopPropagation(); e.preventDefault(); $('saver').classList.remove('on'); } }, true);
    for (const t of ['pointerdown', 'keydown']) R.addEventListener(t, armSaver, true);
  }
  // Suchergebnisse ins offene Blatt (Eingabefeld behält Fokus und Text)
  function paintOrt() {
    const box = $('sheet')?.querySelector('.rows'); if (!box || !ortTarget) return;
    box.innerHTML = ortRes.map((o, i) => `<button class="rw" data-oi="${i}"><div class="ic teal">${ico('bus')}</div><div><b>${esc(o.name)}</b><small>${esc(o.sub)}</small></div></button>`).join('') || `<div class="empty">${esc(ortMsg)}</div>`;
  }

  // ---------------------------------------------------------------- Bildschirmschoner, Nacht
  let svT = 0;
  function openSaver() {
    if (!W) return;
    const ai = Z.alarmInfo(), d = new Date();
    put($('saver'), `<b>${hm(Date.now())}</b><p>${WD[d.getDay()]}, ${d.getDate()}. ${MON[d.getMonth()]}${ai.n ? ` · Wecker ${ai.when} ${esc(ai.n.a.zeit)}` : ''}</p><p style="margin-top:30px;font-size:12px">Antippen zum Aufwecken</p>`);
    $('saver').classList.add('on');
  }
  function armSaver() { clearTimeout(svT); if (Z?.active()) svT = setTimeout(openSaver, Z.local.saverMin * MIN); }
  function applyNight() { const h = new Date().getHours(); $('nightdim')?.classList.toggle('on', Z.local.night && (h >= 22 || h < 6)); }

  // ---------------------------------------------------------------- Schnittstelle
  function render() {
    if (!W) return;
    if ((page === 'pak' && !window.ZHX?.pakOk()) || (page === 'sys' && !window.ZHX?.sysOk())) { if (window.ZHX && window.ZHX.D && page) { /* Rechte noch unbekannt: bleiben */ } }
    upd();
    applyNight();
  }
  function tick() { if (W && $('saver').classList.contains('on')) openSaver(); }
  function wake() { armSaver(); applyNight(); }
  function sleep() { clearTimeout(svT); closeSheet(); $('ring')?.classList.remove('on'); $('saver')?.classList.remove('on'); }
  function destroy() { sleep(); W = null; }

  VIEWS.phone = { build, render, tick, toast, progress, go, pageEl, wake, sleep, destroy };
})();
