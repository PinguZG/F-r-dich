// Zuhause-Extras (06.11.2026, Tablet-Gestaltung mit Diagrammen 08.11.2026): vier eigene Reiter in Zuhause (wie Fernseher/Wecker) – Partner, Abfahrten, Pakete, System –
// und die eigenen Haltestellen in Zuhause → Einstellungen. Daten nur über PocketBase (pb_hooks/wir_zuhause_extra.pb.js ->
// wir-home); Pakete + System-Status prüft der Server (nur Besitzer), hier werden die Reiter nur ausgeblendet.
// Sparsam (iPhone-Speicher!): abgefragt wird nur, solange Zuhause sichtbar ist und der jeweilige Reiter offen.
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
  let built = false, life = false, page = 'start', timer = 0, rechte = null, rechteAt = 0;
  const D = { prefs: null, prefsId: '', abf: null, abfErr: '', pak: null, sys: null, ping: null, pings: null, open: '' };
  const due = { partner: 0, abf: 0, pak: 0, sys: 0 };
  const last = new Map();   // Element -> zuletzt gesetztes HTML
  const put = (el, h) => { if (el && last.get(el) !== h) { last.set(el, h); el.innerHTML = h; } };
  const $ = id => document.getElementById('zx-' + id);
  // Reiter: [data-p, Symbol, Name, nur Besitzer]
  const PAGES = [['partner', 'heart', 'Partner'], ['abf', 'bus', 'Abfahrten'], ['pak', 'box', 'Pakete', true], ['sys', 'pulse', 'System', true]];
  const running = () => life && PAGES.some(p => p[0] === page) && !document.hidden;
  const head = (ic, cls, title, sub, right = '') => `<div class="zx-hd"><i class="zx-ic ${cls}">${svg(ic)}</i><div><h3>${title}</h3><small>${sub}</small></div>${right}</div>`;

  // ------------------------------------------------------------ Aufbau (einmal, nachdem zuhause.js Zuhause gebaut hat)
  function build() {
    if (built) return;
    const rail = host.querySelector('#zh-rail'), main = host.querySelector('#zh-main');
    if (!rail || !main) return;
    built = true;
    // Reiter vor dem Abstand zu den Einstellungen; Beschriftung für die Tab-Reihe auf dem Handy wie in zuhause.js
    rail.querySelector('.z-sp').insertAdjacentHTML('beforebegin', PAGES.map(([p, ic, name, own]) =>
      `<div class="z-nv zx-nv" data-p="${p}" data-label="${name}" title="${name}"${own ? ' hidden' : ''}>${svg(ic)}</div>`).join(''));
    const card = (p, inner = '') => `<section class="z-page zx-page" id="zh-p-${p}"><div class="z-scol zx"><div class="zx-card zx-${p}" id="zx-${p}">${inner}</div></div></section>`;
    main.insertAdjacentHTML('beforeend', card('partner', `
        <div class="zx-lay"><div class="zx-col">
          <div class="zx-ph"><div class="avatar zx-av" id="zx-av"></div><div class="zx-pt"><b id="zx-pname"></b><small id="zx-seen"></small></div><span class="zx-cd" id="zx-cd"></span></div>
          <div class="zx-facts" id="zx-pfacts"></div>
          <button class="zx-think" id="zx-think" type="button">${svg('heart')}<span>Ich denk an dich</span></button>
        </div><div class="zx-col">
          <div class="zx-chart zx-pings" id="zx-pchart"></div>
          <div class="zx-last" id="zx-lastping"></div>
        </div></div>`)
      + card('abf') + card('pak') + card('sys'));
    $('think').addEventListener('click', think);
    main.addEventListener('click', tipClick);
    $('sys').addEventListener('click', e => {
      const g = e.target.closest('[data-g]');
      if (g) { D.open = g.dataset.g; renderSys(); }
    });
    buildSettings();
    // Einstellungen: laufende App-Version (füllt shared/update.js über data-wir-version)
    host.querySelector('#zh-p-set .z-info')?.insertAdjacentHTML('beforebegin',
      `<div class="z-srow zx-ver"><div class="z-si">${svg('pulse')}</div><div><b>Version</b><small>läuft gerade auf diesem Gerät</small></div><div class="z-state z-r" data-wir-version>${esc(window.WIR_VERSION || '…')}</div></div>`);
    paintPartner();
    renderAbf(); renderPak(); renderSys();
  }
  // Pakete/System-Reiter nur für den Besitzer (der Server prüft trotzdem selbst); offenen Reiter ohne Recht verlassen
  function paintNav() {
    if (!built) return;
    const ok = { pak: !!(rechte?.besitzer && rechte.pakete), sys: !!rechte?.besitzer };
    for (const p of ['pak', 'sys']) host.querySelector(`.zx-nv[data-p="${p}"]`).hidden = !ok[p];
    if ((page === 'pak' || page === 'sys') && !ok[page]) host.querySelector('.z-nv[data-p="start"]')?.click();
  }

  // ------------------------------------------------------------ Diagramme (08.11.2026)
  // Dünne Säulen mit runden Enden bzw. eine Linie mit Fläche; Werte erscheinen beim Antippen in der Zeile über dem
  // Diagramm (.zx-cap). Farben aus dem Theme (--z-…), Texte in Textfarben, nie nur Farbe als Bedeutung.
  function colPath(x, base, w, h) {
    const r = Math.min(4, w / 2, h);
    return `M${(x - w / 2).toFixed(1)} ${base}V${(base - h + r).toFixed(1)}q0 -${r} ${r} -${r}h${(w - 2 * r).toFixed(1)}q${r} 0 ${r} ${r}V${base}Z`;
  }
  // Säulen-Paare (zwei Reihen nebeneinander je Tag), z. B. Pings du / Partner
  function pairBars(items, W = 520, H = 170) {
    const top = 10, base = H - 26, step = W / items.length, bw = Math.max(3, Math.min(12, step * 0.3));
    const max = Math.max(1, ...items.flatMap(i => [i.a, i.b]));
    const hgt = v => (v ? Math.max(3, (v / max) * (base - top)) : 0);
    return `<svg viewBox="0 0 ${W} ${H}" class="zx-svg" role="img"><line x1="0" x2="${W}" y1="${base}" y2="${base}" class="zx-base"/>` + items.map((it, i) => {
      const x = i * step + step / 2;
      return `<g class="zx-hit" data-tip="${esc(it.tip)}"><rect x="${(x - step / 2).toFixed(1)}" y="0" width="${step.toFixed(1)}" height="${H}" fill="transparent"/>`
        + (it.a ? `<path d="${colPath(x - bw / 2 - 1, base, bw, hgt(it.a))}" class="zx-ba"/>` : '')
        + (it.b ? `<path d="${colPath(x + bw / 2 + 1, base, bw, hgt(it.b))}" class="zx-bb"/>` : '')
        + (!it.a && !it.b ? `<rect x="${(x - 1.5).toFixed(1)}" y="${base - 2}" width="3" height="2" rx="1" class="zx-zero"/>` : '')
        + (it.lab ? `<text x="${x.toFixed(1)}" y="${base + 18}" text-anchor="middle" class="zx-ax${it.now ? ' zx-axn' : ''}">${it.lab}</text>` : '') + '</g>';
    }).join('') + '</svg>';
  }
  // Linie mit Fläche über 24 Stunden (System-Kurven), y in Prozent 0–100
  function areaChart(pts, key, W = 520, H = 120) {
    const top = 8, base = H - 22, xs = pts.map(p => p.t), t0 = Math.min(...xs), t1 = Math.max(...xs), span = Math.max(1, t1 - t0);
    const X = t => ((t - t0) / span) * W, Y = v => base - (Math.max(0, Math.min(100, v)) / 100) * (base - top);
    const ok = pts.filter(p => Number.isFinite(p[key]));
    if (ok.length < 2) return '<div class="zx-empty">Die Kurve füllt sich in den nächsten Stunden.</div>';
    const line = ok.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)} ${Y(p[key]).toFixed(1)}`).join('');
    const area = `${line}L${X(ok[ok.length - 1].t).toFixed(1)} ${base}L${X(ok[0].t).toFixed(1)} ${base}Z`;
    const grid = [50, 100].map(v => `<line x1="0" x2="${W}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="zx-grid"/><text x="2" y="${(Y(v) - 4).toFixed(1)}" class="zx-ax">${v} %</text>`).join('');
    // Antipp-Flächen: je halbe Stunde eine, mit dem Wert in der Mitte
    const n = Math.min(48, ok.length), hits = Array.from({ length: n }, (_, i) => {
      const p = ok[Math.round((i / Math.max(1, n - 1)) * (ok.length - 1))], x = X(p.t);
      return `<g class="zx-hit" data-tip="${hm(p.t)} Uhr: ${String(p[key]).replace('.', ',')} %"><rect x="${(x - W / n / 2).toFixed(1)}" y="0" width="${(W / n).toFixed(1)}" height="${H}" fill="transparent"/><circle cx="${x.toFixed(1)}" cy="${Y(p[key]).toFixed(1)}" r="4" class="zx-dotm"/></g>`;
    }).join('');
    const last = ok[ok.length - 1];
    const labs = `<text x="0" y="${H - 4}" class="zx-ax">${hm(ok[0].t)}</text><text x="${W / 2}" y="${H - 4}" text-anchor="middle" class="zx-ax">${hm(t0 + span / 2)}</text><text x="${W}" y="${H - 4}" text-anchor="end" class="zx-ax zx-axn">jetzt</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" class="zx-svg" role="img"><defs><linearGradient id="zx-g-${key}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".32"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>`
      + `<line x1="0" x2="${W}" y1="${base}" y2="${base}" class="zx-base"/>${grid}<path d="${area}" fill="url(#zx-g-${key})"/><path d="${line}" class="zx-line"/>`
      + `<circle cx="${X(last.t).toFixed(1)}" cy="${Y(last[key]).toFixed(1)}" r="4.5" class="zx-end"/>${hits}${labs}</svg>`;
  }
  // Antippen eines Diagramms: Wert in die Kopfzeile, angetippte Stelle markieren
  function tipClick(e) {
    const hit = e.target.closest('.zx-hit');
    if (!hit) return;
    const box = hit.closest('.zx-chart'), cap = box && box.querySelector('.zx-cap');
    if (!box) return;
    box.querySelectorAll('.zx-hit.zx-sel').forEach(x => x.classList.remove('zx-sel'));
    hit.classList.add('zx-sel');
    if (cap) { cap.textContent = hit.dataset.tip; cap.classList.add('zx-set'); }
  }
  // Kopf eines Diagramms: Titel links, Wert/Hinweis rechts (wird beim Antippen ersetzt)
  const chartHead = (title, hint, legend = '') => `<div class="zx-chh"><b>${title}</b>${legend}<span class="zx-cap">${hint}</span></div>`;

  // ------------------------------------------------------------ Partner-Ecke
  const partner = () => window.WIR_LOOK?.partner?.() || null;
  function paintPartner() {
    if (!built) return;
    const p = partner();
    if (!p) { $('pname').textContent = 'Noch kein Partner-Konto'; return; }
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
  const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  function renderPartner() {
    const p = partner();
    if (!built || !p) return;
    const pr = (window.WIR_PRESENCE?.get?.() || []).find(x => x.id === p.id);
    $('av').classList.toggle('is-online', !!pr?.online);
    $('seen').textContent = pr?.online ? 'gerade online' : pr?.last_seen ? 'zuletzt aktiv ' + ago(pbMs(pr.last_seen)) : '';
    const next = window.WIR_COUNTDOWN?.next?.();
    let n = null;
    if (next) n = Math.round((new Date(next).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 864e5);
    $('cd').textContent = n == null ? '' : n <= 0 ? 'Wiedersehen heute 💗' : n === 1 ? 'Wiedersehen morgen' : `Wiedersehen in ${n} Tagen`;
    const together = (document.getElementById('dayCount')?.textContent || '').trim();
    const name = esc(p.name || 'Schatz');
    // Zahlen-Kacheln: Tage zusammen, Tage bis zum Wiedersehen (Ring: Fortschritt der letzten 30 Tage bis dahin)
    const ring = n == null ? '' : (() => {
      const f = Math.max(0, Math.min(1, 1 - n / 30)), r = 30, c = 2 * Math.PI * r;
      return `<svg viewBox="0 0 76 76" class="zx-ringc" aria-hidden="true"><circle cx="38" cy="38" r="${r}" class="zx-rbg"/><circle cx="38" cy="38" r="${r}" class="zx-rfg" stroke-dasharray="${(c * f).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 38 38)"/></svg>`;
    })();
    put($('pfacts'), `<div class="zx-fact"><b>${esc(together || '–')}</b><span>Tage zusammen</span></div>`
      + `<div class="zx-fact zx-fring">${ring}<div><b>${n == null ? '–' : n <= 0 ? 'heute' : n}</b><span>${n == null ? 'kein Treffen geplant' : n <= 0 ? 'seht ihr euch' : n === 1 ? 'Tag bis zum Wiedersehen' : 'Tage bis zum Wiedersehen'}</span></div></div>`);
    // Pings der letzten 14 Tage: du → Partner und Partner → dich
    const me = myId(), today = new Date().setHours(0, 0, 0, 0);
    const days = Array.from({ length: 14 }, (_, i) => ({ t: today - (13 - i) * 864e5, a: 0, b: 0 }));
    for (const g of D.pings || []) {
      const d = new Date(pbMs(g.created)).setHours(0, 0, 0, 0), i = Math.round((d - days[0].t) / 864e5);
      if (i >= 0 && i < 14) { if (g.from === me) days[i].a++; else days[i].b++; }
    }
    const sumA = days.reduce((s, d) => s + d.a, 0), sumB = days.reduce((s, d) => s + d.b, 0);
    const items = days.map((d, i) => {
      const dt = new Date(d.t);
      return { a: d.a, b: d.b, lab: i % 2 === 1 || i === 13 ? (i === 13 ? 'heute' : WD[dt.getDay()]) : '', now: i === 13, tip: `${WD[dt.getDay()]} ${dt.getDate()}.${dt.getMonth() + 1}.: du ${d.a} · ${p.name || 'Schatz'} ${d.b}` };
    });
    const legend = `<span class="zx-leg"><i class="zx-la"></i>du ${sumA}<i class="zx-lb"></i>${name} ${sumB}</span>`;
    put($('pchart'), chartHead('Aneinander gedacht · 14 Tage', 'antippen für Werte', legend) + (D.pings ? pairBars(items, 520, host.classList.contains('z-phone') ? 170 : 330) : '<div class="zx-empty">Lädt …</div>'));
    const g = D.ping;
    $('lastping').textContent = g ? `Letzter Ping: ${g.from === myId() ? 'du → ' + (p.name || 'Schatz') : (p.name || 'Schatz') + ' → dich'} · ${ago(pbMs(g.created))}` : '';
  }
  async function loadPartner() {
    try {
      const since = new Date(new Date().setHours(0, 0, 0, 0) - 13 * 864e5).toISOString().replace('T', ' ');
      const r = await pb().collection('pings').getList(1, 300, { sort: '-created', filter: pb().filter('created >= {:s}', { s: since }), fields: 'from,created,type', requestKey: 'zx-ping' });
      D.pings = r.items;
      D.ping = r.items[0] || D.ping || null;
      if (!D.ping) {
        const one = await pb().collection('pings').getList(1, 1, { sort: '-created', fields: 'from,created,type', requestKey: 'zx-ping1' });
        D.ping = one.items[0] || null;
      }
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
  // Zeitstrahl der nächsten 60 Minuten: jede Abfahrt als Linien-Marke an ihrer Minute, in bis zu 4 Spuren
  function timeline(list) {
    const soon = list.filter(x => !x.ausfall).map(x => ({ x, m: minsTo(x.echt) })).filter(o => o.m >= 0 && o.m <= 60).slice(0, 16);
    if (!soon.length) return '';
    const lanes = [-99, -99, -99, -99];
    const marks = soon.map(({ x, m }) => {
      let l = lanes.findIndex(v => m - v >= 12); if (l < 0) l = lanes.indexOf(Math.min(...lanes));
      lanes[l] = m;
      return `<div class="zx-tm" style="left:${(m / 60) * 100}%;--lane:${l}"><span class="zx-line" ${x.farbe ? `style="--lc:${esc(x.farbe)}"` : ''}>${esc(x.linie || '–')}</span><small>${m <= 0 ? 'jetzt' : m + "'"}</small></div>`;
    }).join('');
    const ticks = [0, 15, 30, 45, 60].map(t => `<i style="left:${(t / 60) * 100}%"><small>${t ? '+' + t : 'jetzt'}</small></i>`).join('');
    return `<div class="zx-chart zx-tl"><div class="zx-chh"><b>Die nächste Stunde</b><span class="zx-cap">${soon.length} Abfahrten</span></div><div class="zx-tlb">${ticks}${marks}</div></div>`;
  }
  function renderAbf() {
    const el = $('abf');
    if (!el) return;
    const a = D.abf;
    if (!a) { put(el, head('bus', 'zx-teal', 'Abfahrten', '') + `<div class="zx-empty">${D.abfErr ? esc(D.abfErr) : 'Lädt …'}</div>`); return; }
    if (a.aus) {
      put(el, head('bus', 'zx-teal', 'Abfahrten', 'keine Haltestelle gewählt') + '<div class="zx-empty">Wähle deine Haltestelle, dann stehen hier die nächsten Abfahrten.</div><div class="z-btn zx-go" data-go="set">Zu den Einstellungen</div>');
      return;
    }
    // seit über 20 Min. keine frischen Daten -> lieber nichts Veraltetes zeigen
    if (a.at && Date.now() - a.at > 20 * MIN) { put(el, head('bus', 'zx-teal', 'Abfahrten', esc(a.haltestelle || a.name || '')) + '<div class="zx-empty">Fahrplan gerade nicht erreichbar – versuche es gleich wieder.</div>'); return; }
    const list = a.abfahrten || [];
    const rows = list.map(x => {
      const m = minsTo(x.echt);
      const when = m <= 0 ? 'jetzt' : m < 60 ? `${m} Min` : hm(x.echt);
      return `<div class="zx-dep${x.ausfall ? ' zx-x' : ''}${m <= 2 && !x.ausfall ? ' zx-now' : ''}"><span class="zx-line" ${x.farbe ? `style="--lc:${esc(x.farbe)}"` : ''}>${esc(x.linie || '–')}</span>`
        + `<span class="zx-dir">${esc(x.ziel)}<small>ab ${hm(x.echt)}</small></span><span class="zx-min">${when}</span>${delayTag(x.delay, x.ausfall)}</div>`;
    }).join('') || '<div class="zx-empty">Gerade keine Abfahrten</div>';
    const late = list.filter(x => !x.ausfall && x.delay > 0).length, gone = list.filter(x => x.ausfall).length;
    const next = list.find(x => !x.ausfall && minsTo(x.echt) >= 0);
    const hero = next ? `<div class="zx-next"><span class="zx-line" ${next.farbe ? `style="--lc:${esc(next.farbe)}"` : ''}>${esc(next.linie || '–')}</span><div><small>Nächste Abfahrt</small><b>${esc(next.ziel)}</b></div><strong>${minsTo(next.echt) <= 0 ? 'jetzt' : minsTo(next.echt)}<small>${minsTo(next.echt) <= 0 ? '' : 'Min'}</small></strong></div>` : '';
    const pills = `<div class="zx-pills"><span><b>${list.length}</b> Abfahrten</span><span class="${late ? 'zx-warn' : ''}"><b>${late}</b> verspätet</span><span class="${gone ? 'zx-bad' : ''}"><b>${gone}</b> fallen aus</span></div>`;
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
    const stand = a.stale ? `<span class="zx-stand">Stand ${hm(a.at)}</span>` : `<span class="zx-stand">${hm(Date.now())}</span>`;
    put(el, `<div class="zx-hd"><i class="zx-ic zx-teal">${svg('bus')}</i><div><h3>Abfahrten</h3><small>${esc(a.haltestelle || a.name || '')}</small></div>${stand}</div>`
      + `<div class="zx-lay"><div class="zx-col">${hero}<div class="zx-deps">${rows}</div></div><div class="zx-col">${pills}${timeline(list)}${fahrt}</div></div>`);
  }
  async function loadAbf() {
    try { D.abf = await pb().send('/api/home/abfahrten', { requestKey: 'zx-abf' }); D.abfErr = ''; }
    catch (err) { D.abfErr = err?.message || 'Fehler'; if (D.abf) D.abf.stale = true; }
    renderAbf();
  }

  // ------------------------------------------------------------ Pakete (nur Besitzer)
  const PAK = { heute: ['Zustellung heute', 'zx-teal', 2], unterwegs: ['unterwegs', 'zx-vio', 1], abholbereit: ['abholbereit', 'zx-teal', 3], zugestellt: ['zugestellt', 'zx-ok', 3], problem: ['Problem', 'zx-bad', 1], unbekannt: ['noch keine Daten', 'zx-mut', 0] };
  const STEPS = ['verschickt', 'unterwegs', 'heute', 'da'];
  function dateTxt(t) {
    if (!t) return '';
    const d = new Date(t), today = new Date().setHours(0, 0, 0, 0), day = new Date(t).setHours(0, 0, 0, 0);
    return day === today ? 'heute ' + hm(t) : day === today - 864e5 ? 'gestern ' + hm(t) : `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`;
  }
  function renderPak() {
    const el = $('pak');
    if (!el) return;
    const p = D.pak;
    if (!p || p.aus) { put(el, head('box', 'zx-warmc', 'Pakete', '') + `<div class="zx-empty">${p ? 'Pakete sind ausgeschaltet' : 'Lädt …'}</div>`); return; }
    const list = p.pakete || [];
    // Reihenfolge: heute, abholbereit, Problem, unterwegs, unbekannt, zugestellt
    const ORDER = { heute: 0, abholbereit: 1, problem: 2, unterwegs: 3, unbekannt: 4, zugestellt: 5 };
    const sorted = list.slice().sort((a, b) => (ORDER[a.status] ?? 3) - (ORDER[b.status] ?? 3));
    const cards = sorted.map(x => {
      const [lbl, cls, step] = PAK[x.status] || PAK.unterwegs;
      const bad = x.status === 'problem';
      const track = STEPS.map((s, i) => `<i class="${i <= step ? 'zx-on' : ''}${bad && i === step ? ' zx-badstep' : ''}"><small>${x.status === 'abholbereit' && i === 3 ? 'abholen' : s}</small></i>`).join('');
      return `<div class="zx-pc ${x.status === 'zugestellt' ? 'zx-done' : ''}"><div class="zx-pct"><b>${esc(x.name)}</b><span class="${cls}">${lbl}</span></div>`
        + `<div class="zx-steps" style="--p:${step / 3}">${track}</div><small class="zx-pinfo">${esc(x.text || x.ort || '')}${x.zeit ? ` · ${dateTxt(x.zeit)}` : ''}</small></div>`;
    }).join('') || `<div class="zx-empty">${p.fehlt ? '17TRACK ist in Home Assistant nicht eingerichtet' : 'Keine Pakete unterwegs'}</div>`;
    const cnt = s => list.filter(x => x.status === s).length;
    const n = list.filter(x => x.status !== 'zugestellt').length;
    const sum = list.length ? `<div class="zx-pills"><span class="${cnt('heute') ? 'zx-teal' : ''}"><b>${cnt('heute')}</b> kommen heute</span><span><b>${cnt('unterwegs')}</b> unterwegs</span><span class="${cnt('abholbereit') ? 'zx-teal' : ''}"><b>${cnt('abholbereit')}</b> abholbereit</span><span class="${cnt('problem') ? 'zx-bad' : ''}"><b>${cnt('problem')}</b> Problem</span><span><b>${cnt('zugestellt')}</b> zugestellt</span></div>` : '';
    put(el, `<div class="zx-hd"><i class="zx-ic zx-warmc">${svg('box')}</i><div><h3>Pakete</h3><small>${n ? n + ' unterwegs' : 'alles da'}${p.test ? ' · Testmodus' : ''}</small></div>${p.stale ? `<span class="zx-stand">Stand ${hm(p.at)}</span>` : ''}</div>${sum}<div class="zx-pgrid">${cards}</div>`);
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
  const KURVEN = [['last', 'Last', 'Prozessor, gemessen an allen Kernen'], ['ram', 'Arbeitsspeicher', 'belegt'], ['disk', 'Festplatte', 'belegt']];
  function renderSys() {
    const el = $('sys');
    if (!el) return;
    const s = D.sys;
    if (!s) { put(el, head('pulse', 'zx-vioc', 'System', '') + '<div class="zx-empty">Lädt …</div>'); return; }
    if (!D.open && s.gruppen[0]) D.open = (s.gruppen.find(g => g.a === 'r') || s.gruppen.find(g => g.a === 'y') || s.gruppen[0]).k;
    const tiles = s.gruppen.map(g => {
      const bad = g.items.filter(i => !i.ohne_ampel && (i.a === 'r' || i.a === 'y')).length;
      return `<button type="button" class="zx-tile${D.open === g.k ? ' zx-on' : ''}" data-g="${g.k}" aria-pressed="${D.open === g.k}"><i class="zx-dot ${AMP[g.a]}"></i><b>${esc(g.name)}</b><small>${AMPT[g.a]}${bad ? ` · ${bad} ${bad === 1 ? 'Punkt' : 'Punkte'}` : ` · ${g.items.length} geprüft`}</small></button>`;
    }).join('');
    const g = s.gruppen.find(x => x.k === D.open);
    let det = '';
    if (g) {
      det = '<div class="zx-det">' + g.items.map(i => `<div class="zx-di"><i class="zx-dot ${i.ohne_ampel ? 'zx-mut' : AMP[i.a]}"></i><span>${esc(i.name)}</span><b>${esc(itemTxt(i))}</b>${i.info ? `<small>${esc(i.info)}</small>` : ''}</div>`).join('')
        + (g.updates?.length ? '<div class="zx-up"><span>Updates verfügbar</span>' + g.updates.map(u => `<div><b>${esc(u.name)}</b><small>${esc(u.von)} → ${esc(u.nach)}</small></div>`).join('') + '</div>' : '')
        + '</div>';
    }
    const all = s.gruppen.flatMap(x => x.items).filter(i => !i.ohne_ampel);
    const cnt = a => all.filter(i => i.a === a).length;
    const heroTxt = s.a === 'g' ? 'Alles im grünen Bereich' : s.a === 'r' ? 'Etwas braucht dich' : s.a === 'y' ? 'Ein Auge drauf haben' : 'Status unbekannt';
    const hero = `<div class="zx-shero ${AMP[s.a]}"><i class="zx-pulse" aria-hidden="true"></i><div><b>${heroTxt}</b><small>${cnt('g')} gut · ${cnt('y')} Achtung · ${cnt('r')} Problem · geprüft ${hm(s.at)}</small></div></div>`;
    const k = s.kurve || [];
    const charts = KURVEN.map(([key, name, sub]) => {
      const ok = k.filter(p => Number.isFinite(p[key])), last = ok[ok.length - 1];
      const vals = ok.map(p => p[key]);
      const range = vals.length ? `min ${Math.round(Math.min(...vals))} · max ${Math.round(Math.max(...vals))} %` : '';
      return `<div class="zx-chart zx-kv zx-k-${key}"><div class="zx-chh"><b>${name}<small>${sub}</small></b><span class="zx-big">${last ? Math.round(last[key]) + '<small> %</small>' : '–'}</span></div>`
        + `<div class="zx-cap zx-capl">${range ? range + ' · 24 Std.' : ''}</div>${areaChart(k, key, 520, host.classList.contains('z-phone') ? 120 : 150)}</div>`;
    }).join('');
    put(el, `<div class="zx-hd"><i class="zx-ic zx-vioc">${svg('pulse')}</i><div><h3>System</h3><small>VPS, Home Assistant und Backups${s.test ? ' · Testdaten' : ''}</small></div><span class="zx-stand">${hm(s.at)}</span></div>`
      + `<div class="zx-lay"><div class="zx-col">${hero}<div class="zx-tiles">${tiles}</div>${det}</div><div class="zx-col zx-kurven">${charts}</div></div>`);
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
    paintNav();
  }
  // nur der offene Reiter fragt nach
  async function step() {
    if (!running()) return;
    const now = Date.now();
    if (page === 'partner') {
      if (now >= due.partner) { due.partner = now + MIN; loadPartner(); } else renderPartner();
    } else if (page === 'abf') {
      if (now >= due.abf) { due.abf = now + MIN; loadAbf(); } else renderAbf();   // Minuten weiterzählen
    } else {
      await loadRechte();
      if (page === 'pak' && rechte?.besitzer && now >= due.pak) { due.pak = now + 10 * MIN; loadPak(); }
      if (page === 'sys' && rechte?.besitzer && now >= due.sys) { due.sys = now + MIN; loadSys(); }
    }
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
  document.addEventListener('zh:page', e => {
    page = e.detail;
    if (page === 'set') loadPrefs();
    if (timer) { clearInterval(timer); timer = 0; }   // Reiterwechsel: sofort einmal für den neuen Reiter
    sync();
  });
  document.addEventListener('zh:life', e => {
    life = !!e.detail;
    if (life) { window.WIR_PRESENCE?.reload?.(); due.partner = 0; loadRechte(); }   // Rechte -> Reiter Pakete/System
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
    if (built) { paintNav(); renderAbf(); renderPak(); renderSys(); renderSettings(); if (authId) loadPrefs(); }
  });
})();
