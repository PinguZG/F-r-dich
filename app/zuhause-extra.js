// Zuhause-Extras (06.11.2026): vier Karten unter "Licht/Geräte" auf Start – Partner-Ecke, Abfahrten, Pakete, System-Status –
// und die eigenen Haltestellen in Zuhause → Einstellungen. Daten nur über PocketBase (pb_hooks/wir_zuhause_extra.pb.js ->
// wir-home); Pakete + System-Status prüft der Server (nur Besitzer), hier wird nur ausgeblendet, was eh nicht kommt.
// Sparsam (iPhone-Speicher!): abgefragt wird nur, solange Zuhause sichtbar ist, Start offen und die Karten im Bild sind.
// Ein Takt (15 s) für alles, Inhalte werden nur gesetzt, wenn sich das HTML ändert, Klicks über EINEN Listener je Bereich.
(() => {
  const host = document.getElementById('zh');
  if (!host) return;
  const pb = () => window.WIR_PB;
  const myId = () => (pb()?.authStore.record || pb()?.authStore.model)?.id;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const hm = t => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const MIN = 60000;
  const I = {
    bus: '<rect x="4" y="3" width="16" height="15" rx="3"/><path d="M4 11h16M8 21v-3M16 21v-3M8 15h.01M16 15h.01"/>',
    train: '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 10h14M9 21l1.5-4M15 21l-1.5-4M9 14h.01M15 14h.01"/>',
    box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
    pulse: '<path d="M3 12h4l3-7 4 14 3-7h4"/>',
    heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
    pin: '<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>',
    route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6"/>',
  };
  const svg = n => `<svg viewBox="0 0 24 24" aria-hidden="true">${I[n]}</svg>`;

  // ------------------------------------------------------------ Zustand
  let built = false, life = false, page = 'start', inView = true, timer = 0, rechte = null, rechteAt = 0, io = null;
  const D = { prefs: null, prefsId: '', abf: null, abfErr: '', pak: null, sys: null, ping: null, open: '' };
  const due = { partner: 0, abf: 0, pak: 0, sys: 0 };
  const last = new Map();   // Element -> zuletzt gesetztes HTML
  const put = (el, h) => { if (el && last.get(el) !== h) { last.set(el, h); el.innerHTML = h; } };
  const $ = id => document.getElementById('zx-' + id);
  const running = () => life && page === 'start' && inView && !document.hidden;

  // ------------------------------------------------------------ Aufbau (einmal, nachdem zuhause.js Zuhause gebaut hat)
  function build() {
    if (built) return;
    const right = host.querySelector('#zh-p-start .z-s-right');
    if (!right) return;
    built = true;
    right.insertAdjacentHTML('beforeend', `<div class="zx" id="zx">
      <div class="zx-card zx-partner" id="zx-partner" hidden>
        <div class="zx-ph"><div class="avatar zx-av" id="zx-av"></div><div class="zx-pt"><b id="zx-pname"></b><small id="zx-seen"></small></div><span class="zx-cd" id="zx-cd"></span></div>
        <div class="zx-last" id="zx-lastping"></div>
        <button class="zx-think" id="zx-think" type="button">${svg('heart')}<span>Ich denk an dich</span></button>
      </div>
      <div class="zx-card zx-abf" id="zx-abf" hidden></div>
      <div class="zx-card zx-pak" id="zx-pak" hidden></div>
      <div class="zx-card zx-sys" id="zx-sys" hidden></div>
    </div>`);
    $('think').addEventListener('click', think);
    $('sys').addEventListener('click', e => {
      const g = e.target.closest('[data-g]');
      if (g) { D.open = D.open === g.dataset.g ? '' : g.dataset.g; renderSys(); }
    });
    buildSettings();
    paintPartner();
    // nur abfragen, solange die Karten im Bild sind (Handy: weit nach unten gescrollt zählt auch)
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(es => { inView = es.some(x => x.isIntersecting); sync(); });
      io.observe($('partner').parentNode);
    }
  }

  // ------------------------------------------------------------ Partner-Ecke
  const partner = () => window.WIR_LOOK?.partner?.() || null;
  function paintPartner() {
    if (!built) return;
    const p = partner();
    $('partner').hidden = !p;
    if (!p) return;
    window.WIR_LOOK.paintAvatar($('av'), p);
    $('pname').textContent = p.name || 'Schatz';
  }
  function ago(t) {
    const s = (Date.now() - t) / 1000;
    if (s < 90) return 'gerade eben';
    if (s < 3600) return `vor ${Math.round(s / 60)} Min.`;
    if (s < 86400) return `vor ${Math.round(s / 3600)} Std.`;
    const d = new Date(t);
    return `am ${pad(d.getDate())}.${pad(d.getMonth() + 1)}. um ${hm(t)}`;
  }
  const pbMs = s => Date.parse(String(s).replace(' ', 'T'));
  function renderPartner() {
    const p = partner();
    if (!built || !p) return;
    const pr = (window.WIR_PRESENCE?.get?.() || []).find(x => x.id === p.id);
    $('av').classList.toggle('is-online', !!pr?.online);
    $('seen').textContent = pr?.online ? 'gerade online' : pr?.last_seen ? 'zuletzt aktiv ' + ago(pbMs(pr.last_seen)) : '';
    const next = window.WIR_COUNTDOWN?.next?.();
    let cd = '';
    if (next) {
      const days = Math.round((new Date(next).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 864e5);
      cd = days <= 0 ? 'Wiedersehen heute 💗' : days === 1 ? 'Wiedersehen morgen' : `Wiedersehen in ${days} Tagen`;
    }
    $('cd').textContent = cd;
    const g = D.ping;
    $('lastping').textContent = g ? `Letzter Ping: ${g.from === myId() ? 'du → ' + (p.name || 'Schatz') : (p.name || 'Schatz') + ' → dich'} · ${ago(pbMs(g.created))}` : '';
  }
  async function loadPartner() {
    try {
      const r = await pb().collection('pings').getList(1, 1, { sort: '-created', fields: 'from,created,type', requestKey: 'zx-ping' });
      D.ping = r.items[0] || null;
    } catch (_) { /* Partner-Ecke bleibt mit altem Stand */ }
    renderPartner();
  }
  let thinkUntil = 0;
  async function think() {
    const b = $('think');
    if (Date.now() < thinkUntil || !window.WIR_PING) return;
    thinkUntil = Date.now() + 10000;   // gegen Doppeltipps (die Ping-Logik sperrt selbst 1,5 s)
    b.classList.add('zx-sent');
    const ok = await window.WIR_PING.send('support', b);
    b.querySelector('span').textContent = ok ? 'Gesendet 💗' : 'Hat nicht geklappt';
    if (!ok) thinkUntil = 0;
    setTimeout(() => { b.classList.remove('zx-sent'); b.querySelector('span').textContent = 'Ich denk an dich'; }, 3000);
    if (ok) setTimeout(() => loadPartner(), 800);
  }

  // ------------------------------------------------------------ Abfahrten
  const minsTo = t => Math.round((Date.parse(t) - Date.now()) / MIN);
  function delayTag(d, cancel) {
    if (cancel) return '<em class="zx-dl zx-bad">fällt aus</em>';
    if (d == null) return '';
    if (d <= 0) return '<em class="zx-dl zx-ok">pünktlich</em>';
    return `<em class="zx-dl ${d >= 5 ? 'zx-bad' : 'zx-warn'}">+${d}</em>`;
  }
  function renderAbf() {
    const el = $('abf');
    if (!el) return;
    const a = D.abf;
    // ohne Haltestelle oder seit über 20 Min. keine frischen Daten -> Karte weg
    if (!a || a.aus || (a.at && Date.now() - a.at > 20 * MIN)) { el.hidden = true; return; }
    el.hidden = false;
    const rows = (a.abfahrten || []).map(x => {
      const m = minsTo(x.echt);
      const when = m <= 0 ? 'jetzt' : m < 60 ? `${m} Min` : hm(x.echt);
      return `<div class="zx-dep${x.ausfall ? ' zx-x' : ''}"><span class="zx-line" ${x.farbe ? `style="--lc:${esc(x.farbe)}"` : ''}>${esc(x.linie || '–')}</span>`
        + `<span class="zx-dir">${esc(x.ziel)}</span><span class="zx-min">${when}</span>${delayTag(x.delay, x.ausfall)}</div>`;
    }).join('') || '<div class="zx-empty">Gerade keine Abfahrten</div>';
    let fahrt = '';
    if (a.fahrt && a.fahrt.verbindungen) {
      const p = partner();
      fahrt = `<div class="zx-trip"><div class="zx-th">${svg('route')}<b>Fahrt zu ${esc(p?.name || 'dir')}</b><small>${esc(a.fahrt_von || '')} → ${esc(a.fahrt_nach || '')}</small></div>`
        + (a.fahrt.verbindungen.map(v => {
          const dA = Math.max(0, Math.round((Date.parse(v.ab) - Date.parse(v.abPlan)) / MIN)), dZ = Math.max(0, Math.round((Date.parse(v.an) - Date.parse(v.anPlan)) / MIN));
          const lin = v.linien.map(l => `<span class="${l.ausfall ? 'zx-strike' : ''}">${esc(l.linie || (l.art === 'bus' ? 'Bus' : 'Zug'))}</span>`).join(' › ');
          return `<div class="zx-con${v.ausfall ? ' zx-x' : ''}"><div class="zx-ct"><b>${hm(v.abPlan)}${dA ? ` <em class="zx-dl ${dA >= 5 ? 'zx-bad' : 'zx-warn'}">+${dA}</em>` : ''}</b> → <b>${hm(v.anPlan)}${dZ ? ` <em class="zx-dl ${dZ >= 5 ? 'zx-bad' : 'zx-warn'}">+${dZ}</em>` : ''}</b>`
            + `<small>${Math.floor(v.dauer / 60)}:${pad(v.dauer % 60)} h · ${v.umstiege ? v.umstiege + (v.umstiege === 1 ? ' Umstieg' : ' Umstiege') : 'direkt'}${v.ausfall ? ' · <b class="zx-bad">Ausfall</b>' : ''}</small></div><div class="zx-cl">${lin}</div></div>`;
        }).join('') || '<div class="zx-empty">Keine Verbindung gefunden</div>') + '</div>';
    }
    const stand = a.stale ? `<span class="zx-stand">Stand ${hm(a.at)}</span>` : '';
    put(el, `<div class="zx-hd"><i class="zx-ic zx-teal">${svg('bus')}</i><div><h3>Abfahrten</h3><small>${esc(a.haltestelle || a.name || '')}</small></div>${stand}</div><div class="zx-deps">${rows}</div>${fahrt}`);
  }
  async function loadAbf() {
    try { D.abf = await pb().send('/api/home/abfahrten', { requestKey: 'zx-abf' }); D.abfErr = ''; }
    catch (err) { D.abfErr = err?.message || 'Fehler'; if (D.abf) D.abf.stale = true; }
    renderAbf();
  }

  // ------------------------------------------------------------ Pakete (nur Besitzer)
  const PAK = { heute: ['Zustellung heute', 'zx-teal'], unterwegs: ['unterwegs', 'zx-vio'], abholbereit: ['abholbereit', 'zx-teal'], zugestellt: ['zugestellt', 'zx-ok'], problem: ['Problem', 'zx-bad'], unbekannt: ['noch keine Daten', 'zx-mut'] };
  function dateTxt(t) {
    if (!t) return '';
    const d = new Date(t), today = new Date().setHours(0, 0, 0, 0), day = new Date(t).setHours(0, 0, 0, 0);
    return day === today ? 'heute ' + hm(t) : day === today - 864e5 ? 'gestern ' + hm(t) : `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`;
  }
  function renderPak() {
    const el = $('pak');
    if (!el) return;
    const p = D.pak;
    if (!rechte?.besitzer || !rechte.pakete || !p || p.aus) { el.hidden = true; return; }
    el.hidden = false;
    const list = p.pakete || [];
    const rows = list.map(x => {
      const [lbl, cls] = PAK[x.status] || PAK.unterwegs;
      return `<div class="zx-pk"><i class="zx-dot ${cls}"></i><div class="zx-pi"><b>${esc(x.name)}</b><small>${esc(x.text || x.ort || '')}</small></div><div class="zx-ps"><span class="${cls}">${lbl}</span><small>${dateTxt(x.zeit)}</small></div></div>`;
    }).join('') || `<div class="zx-empty">${p.fehlt ? '17TRACK ist in Home Assistant nicht eingerichtet' : 'Keine Pakete unterwegs'}</div>`;
    const n = list.filter(x => x.status !== 'zugestellt').length;
    put(el, `<div class="zx-hd"><i class="zx-ic zx-warmc">${svg('box')}</i><div><h3>Pakete</h3><small>${n ? n + ' unterwegs' : 'alles da'}${p.test ? ' · Testmodus' : ''}</small></div>${p.stale ? `<span class="zx-stand">Stand ${hm(p.at)}</span>` : ''}</div><div class="zx-pks">${rows}</div>`);
  }
  async function loadPak() {
    try { D.pak = await pb().send('/api/home/pakete', { requestKey: 'zx-pak' }); }
    catch (err) { if (err?.status === 403) D.pak = null; else if (D.pak) D.pak.stale = true; }
    renderPak();
  }

  // ------------------------------------------------------------ System-Status (nur Besitzer)
  const AMP = { g: 'zx-ok', y: 'zx-warn', r: 'zx-bad', n: 'zx-mut' };
  const AMPT = { g: 'alles gut', y: 'Achtung', r: 'Problem', n: 'unbekannt' };
  function itemTxt(i) {
    const z = i.zeit ? (i.k === 'deploy' ? dateTxt(i.zeit) : ago(Date.parse(i.zeit))) : '';
    return [i.wert, z].filter(Boolean).join(' · ');
  }
  function renderSys() {
    const el = $('sys');
    if (!el) return;
    const s = D.sys;
    if (!rechte?.besitzer || !s) { el.hidden = true; return; }
    el.hidden = false;
    const tiles = s.gruppen.map(g => `<button type="button" class="zx-tile${D.open === g.k ? ' zx-on' : ''}" data-g="${g.k}"><i class="zx-dot ${AMP[g.a]}"></i><b>${esc(g.name)}</b><small>${AMPT[g.a]}</small></button>`).join('');
    const g = s.gruppen.find(x => x.k === D.open);
    let det = '';
    if (g) {
      det = '<div class="zx-det">' + g.items.map(i => `<div class="zx-di"><i class="zx-dot ${i.ohne_ampel ? 'zx-mut' : AMP[i.a]}"></i><span>${esc(i.name)}</span><b>${esc(itemTxt(i))}</b>${i.info ? `<small>${esc(i.info)}</small>` : ''}</div>`).join('')
        + (g.updates?.length ? '<div class="zx-up"><span>Updates verfügbar</span>' + g.updates.map(u => `<div><b>${esc(u.name)}</b><small>${esc(u.von)} → ${esc(u.nach)}</small></div>`).join('') + '</div>' : '')
        + '</div>';
    }
    put(el, `<div class="zx-hd"><i class="zx-ic zx-vioc">${svg('pulse')}</i><div><h3>System</h3><small>${s.a === 'g' ? 'alles im grünen Bereich' : s.a === 'r' ? 'etwas ist rot' : s.a === 'y' ? 'etwas ist gelb' : '…'}</small></div><span class="zx-stand">${hm(s.at)}</span></div><div class="zx-tiles">${tiles}</div>${det}`);
  }
  async function loadSys() {
    try { D.sys = await pb().send('/api/home/system', { requestKey: 'zx-sys' }); }
    catch (err) { if (err?.status === 403) D.sys = null; }
    renderSys();
  }

  // ------------------------------------------------------------ Takt
  async function loadRechte() {
    if (rechte && Date.now() - rechteAt < 30 * MIN) return;
    try { rechte = await pb().send('/api/home/rechte', { requestKey: 'zx-rechte' }); rechteAt = Date.now(); }
    catch (_) { rechte = rechte || null; }
  }
  async function step() {
    if (!running()) return;
    const now = Date.now();
    if (now >= due.partner) { due.partner = now + MIN; loadPartner(); }
    if (now >= due.abf) { due.abf = now + MIN; loadAbf(); } else renderAbf();   // Minuten weiterzählen
    await loadRechte();
    if (rechte?.besitzer) {
      if (now >= due.pak) { due.pak = now + 10 * MIN; loadPak(); }
      if (now >= due.sys) { due.sys = now + MIN; loadSys(); }
    }
    renderPartner();
  }
  function sync() {
    const on = running();
    if (on && !timer) { timer = setInterval(step, 15000); step(); }
    else if (!on && timer) { clearInterval(timer); timer = 0; }
  }

  // ------------------------------------------------------------ Einstellungen: eigene Haltestellen (home_prefs, nur ich)
  const ART = { bus: 'Bus', bahn: 'Bahn' };
  function buildSettings() {
    const info = host.querySelector('#zh-p-set .z-info');
    if (!info) return;
    info.insertAdjacentHTML('beforebegin', `<div class="zx-set" id="zx-set">
      <div class="z-srow"><div class="z-si">${svg('bus')}</div><div><b>Abfahrten</b><small id="zx-s-stop">keine Haltestelle – Karte ausgeblendet</small></div><div class="z-btn z-r" data-pick="haltestelle">Wählen</div></div>
      <div class="z-srow zx-arten" id="zx-s-arten" hidden><div class="z-si">${svg('train')}</div><div><b>Verkehrsmittel</b><small>was in der Karte erscheint</small></div><div class="z-seg z-r"><div data-art="bus">Bus</div><div data-art="bahn">Bahn</div></div></div>
      <div class="z-srow" id="zx-s-fahrt"><div class="z-si">${svg('route')}</div><div><b id="zx-s-ft">Fahrt zum Treffen</b><small id="zx-s-fv">Start und Ziel für Verbindungen, wenn ihr euch in den nächsten 24 h seht</small></div><div class="zx-two z-r"><div class="z-btn" data-pick="von">Start</div><div class="z-btn" data-pick="nach">Ziel</div></div></div>
      <div class="zx-search" id="zx-search" hidden><div class="zx-sh"><b id="zx-sw"></b><div class="z-btn" data-pick="">Fertig</div></div>
        <input id="zx-q" type="search" placeholder="Haltestelle suchen …" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search">
        <div class="zx-res" id="zx-res"></div><div class="z-btn zx-del" id="zx-del">Entfernen</div></div>
      <div class="zx-hint">Nur für dich gespeichert. Fahrplandaten: Transitous (ohne Gewähr).</div>
    </div>`);
    const box = $('set');
    let target = '', qT = 0;
    box.addEventListener('click', async e => {
      const pk = e.target.closest('[data-pick]');
      if (pk) {
        target = target === pk.dataset.pick ? '' : pk.dataset.pick;
        $('search').hidden = !target;
        $('sw').textContent = target === 'haltestelle' ? 'Haltestelle für die Abfahrten' : target === 'von' ? 'Start der Fahrt' : 'Ziel der Fahrt';
        $('q').value = ''; put($('res'), '');
        if (target) $('q').focus();
        return;
      }
      const art = e.target.closest('[data-art]');
      if (art) {
        const p = prefs();
        const a = { ...p.arten, [art.dataset.art]: !p.arten[art.dataset.art] };
        if (!a.bus && !a.bahn) a[art.dataset.art === 'bus' ? 'bahn' : 'bus'] = true;   // nie beides aus
        return save({ ...p, arten: a });
      }
      const r = e.target.closest('[data-id]');
      if (r && target) {
        const v = { id: r.dataset.id, name: r.dataset.name };
        const p = prefs();
        if (target === 'haltestelle') p.haltestelle = v; else p.fahrt = { ...p.fahrt, [target]: v };
        target = ''; $('search').hidden = true;
        return save(p);
      }
      if (e.target.closest('#zx-del') && target) {
        const p = prefs();
        if (target === 'haltestelle') p.haltestelle = null; else p.fahrt = { ...p.fahrt, [target]: null };
        target = ''; $('search').hidden = true;
        return save(p);
      }
    });
    $('q').addEventListener('input', () => {
      clearTimeout(qT);
      const q = $('q').value.trim();
      if (q.length < 3) { put($('res'), ''); return; }
      qT = setTimeout(async () => {
        try {
          const r = await pb().send('/api/home/orte', { query: { q }, requestKey: 'zx-orte' });
          if ($('q').value.trim() !== q) return;
          put($('res'), (r.orte || []).map(o => `<div class="zx-ort" data-id="${esc(o.id)}" data-name="${esc(o.name)}"><b>${esc(o.name)}</b><small>${esc([o.ort, o.arten.map(a => ART[a]).join(' · ')].filter(Boolean).join(' · '))}</small></div>`).join('') || '<div class="zx-empty">Nichts gefunden</div>');
        } catch (err) { if (!err?.isAbort) put($('res'), `<div class="zx-empty">${esc(err?.message || 'Suche gerade nicht möglich')}</div>`); }
      }, 450);
    });
  }
  const prefs = () => {
    const d = D.prefs || {};
    return { haltestelle: d.haltestelle || null, arten: { bus: d.arten?.bus !== false, bahn: d.arten?.bahn !== false }, fahrt: { von: d.fahrt?.von || null, nach: d.fahrt?.nach || null } };
  };
  function renderSettings() {
    if (!built || !$('set')) return;
    const p = prefs();
    $('s-stop').textContent = p.haltestelle ? p.haltestelle.name : 'keine Haltestelle – Karte ausgeblendet';
    $('s-arten').hidden = !p.haltestelle;
    for (const b of $('s-arten').querySelectorAll('[data-art]')) b.classList.toggle('z-on', !!p.arten[b.dataset.art]);
    $('s-ft').textContent = 'Fahrt zu ' + (partner()?.name || 'dir');
    $('s-fv').textContent = p.fahrt.von || p.fahrt.nach ? `${p.fahrt.von?.name || '?'} → ${p.fahrt.nach?.name || '?'}` : 'Start und Ziel für Verbindungen, wenn ihr euch in den nächsten 24 h seht';
  }
  async function loadPrefs() {
    try {
      const r = await pb().collection('home_prefs').getList(1, 1, { filter: pb().filter('user = {:u}', { u: myId() }), requestKey: 'zx-prefs' });
      D.prefs = r.items[0]?.data || {}; D.prefsId = r.items[0]?.id || '';
    } catch (_) { /* bleibt leer */ }
    renderSettings();
  }
  async function save(p) {
    D.prefs = p; renderSettings();
    try {
      const rec = D.prefsId ? await pb().collection('home_prefs').update(D.prefsId, { data: p }) : await pb().collection('home_prefs').create({ user: myId(), data: p });
      D.prefsId = rec.id; D.prefs = rec.data;
      due.abf = 0; D.abf = null; renderAbf();
    } catch (err) {
      // schon angelegt (anderes Gerät) -> nachladen und nochmal
      if (!D.prefsId) { await loadPrefs(); if (D.prefsId) return save(p); }
    }
    renderSettings();
  }

  // ------------------------------------------------------------ Verdrahtung mit zuhause.js
  document.addEventListener('zh:built', () => { build(); loadPrefs(); });
  document.addEventListener('zh:page', e => { page = e.detail; if (page === 'set') loadPrefs(); sync(); });
  document.addEventListener('zh:life', e => {
    life = !!e.detail;
    if (life) { window.WIR_PRESENCE?.reload?.(); due.partner = 0; }
    sync();
  });
  document.addEventListener('visibilitychange', sync);
  document.addEventListener('wir:users', () => { paintPartner(); renderPartner(); renderSettings(); });
  document.addEventListener('wir:presence', () => { if (life) renderPartner(); });
  // anderes Konto auf demselben Gerät: nichts vom vorigen behalten
  let authId = myId();
  pb()?.authStore.onChange(() => {
    if (myId() === authId) return;
    authId = myId();
    rechte = null; D.abf = D.pak = D.sys = D.prefs = D.ping = null; D.prefsId = '';
    for (const k of Object.keys(due)) due[k] = 0;
    if (built) { renderAbf(); renderPak(); renderSys(); renderSettings(); if (authId) loadPrefs(); }
  });
})();
