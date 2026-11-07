// Zuhause → Claude (07.11.2026): zeigt live, was Claude Code auf Daniels PC gerade tut – Okti, das Helfer-Team
// (Pip, Bubbles, Inky, Coral), Limits und Kontext. Daten: Collection "cockpit" (ein Datensatz), geschrieben vom
// Cockpit-Mod über pb_hooks/wir_cockpit.pb.js. Gezeichnet mit zuhause-claude-svg.js (aus dem Mod erzeugt).
// Sparsam: Realtime-Abo nur, solange Zuhause sichtbar und dieser Reiter offen ist.
(() => {
  const host = document.getElementById('zh');
  if (!host) return;
  const pb = () => window.WIR_PB;
  const G = () => window.WIR_COCKPIT_SVG;
  const ID = 'cockpitstatus00';
  const STALE = 3 * 60000;
  const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c-4 0-6.5 2.8-6.5 6.3 0 2 .8 3.4 2 4.4L5 19M12 3c4 0 6.5 2.8 6.5 6.3 0 2-.8 3.4-2 4.4L19 19M9.5 14.5 8.5 21M14.5 14.5l1 6.5M12 15v6"/><circle cx="9.7" cy="9" r=".9"/><circle cx="14.3" cy="9" r=".9"/></svg>';

  let built = false, life = false, page = 'start', sub = null, rec = null, tick = 0, lastHtml = '';

  function build() {
    if (built) return;
    const rail = host.querySelector('#zh-rail'), main = host.querySelector('#zh-main');
    if (!rail || !main) return;
    built = true;
    rail.querySelector('.z-sp').insertAdjacentHTML('beforebegin',
      `<div class="z-nv zc-nv" data-p="claude" data-label="Claude" title="Claude">${ICON}</div>`);
    main.insertAdjacentHTML('beforeend',
      `<section class="z-page zc-page" id="zh-p-claude"><div class="z-scol zc"><div class="zc-card" id="zc-card"><p class="zc-empty">Lade …</p></div></div></section>`);
    // Umschalter oben: Zuletzt / Claude Code / Cowork
    main.querySelector('#zc-card').addEventListener('click', e => {
      const b = e.target.closest('[data-mode]');
      if (!b) return;
      setMode(b.dataset.mode);
      lastHtml = ''; svgRoot = null;   // Ansicht neu aufbauen (anderes Dashboard)
      render();
    });
  }

  const mins = ms => { const m = Math.max(0, Math.round(ms / 60000)); return m < 60 ? `${m} Min.` : `${Math.floor(m / 60)} Std. ${m % 60} Min.`; };

  // Das Cockpit-SVG bringt eigene Stile und Animationen mit (.page, .live, .shake …). Direkt im Dokument würden sie
  // die ganze App treffen (alles wackelt) und die App-Stile das Cockpit (fette, fremde Schrift). Darum steckt es in
  // einem Shadow-DOM: beide Seiten sehen die Stile der anderen nicht.
  // Handy und Tablet: oben auf einen Blick Okti, Limits, Kontext und das ganze Team; der Rest in Bereichen zum Aufklappen.
  const FONT = `'Segoe UI',system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif`;
  const SHADOW_CSS = `:host{all:initial;display:block;contain:content;font-family:${FONT};-webkit-font-smoothing:antialiased}
    .wrap{display:grid;gap:10px}
    .wrap.tab{gap:8px}
    .wrap.tab summary{padding:10px 14px}
    svg{display:block;width:100%;height:auto;border-radius:22px;font-family:${FONT};text-rendering:geometricPrecision}
    svg text{stroke:none;font-synthesis:none}
    details{border-radius:20px;background:linear-gradient(160deg,rgba(43,26,18,.95),rgba(10,7,6,.98));border:1px solid rgba(255,155,94,.28);overflow:hidden}
    details[open]{border-color:rgba(255,155,94,.45)}
    summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:10px;padding:13px 16px;color:#F6E7DA;font-size:14px;font-weight:600;letter-spacing:.2px;-webkit-tap-highlight-color:transparent;user-select:none}
    summary::-webkit-details-marker{display:none}
    summary .t{flex:none}
    summary .s{flex:1;min-width:0;text-align:right;color:#B09A8A;font-size:12px;font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    summary::after{content:"";flex:none;width:8px;height:8px;border-right:2px solid #FF9B5E;border-bottom:2px solid #FF9B5E;transform:rotate(45deg) translateY(-2px);transition:transform .25s}
    details[open] summary::after{transform:rotate(225deg) translate(-2px,-1px)}
    details .b{padding:0 6px 6px}
    details .b svg{border-radius:16px}
    @media (prefers-reduced-motion:reduce){summary::after{transition:none}}`;
  const OPEN_KEY = 'zc-open';
  let svgRoot = null, lastLayout = '', lastSvgs = {};

  function openSet() { try { return new Set(JSON.parse(localStorage.getItem(OPEN_KEY) || '[]')); } catch (_) { return new Set(); } }
  function saveOpen(k, isOpen) {
    try { const s = openSet(); if (isOpen) s.add(k); else s.delete(k); localStorage.setItem(OPEN_KEY, JSON.stringify([...s])); } catch (_) { /* ohne Speicher bleibt es zu */ }
  }

  function layoutFor(el) { return (el.clientWidth || window.innerWidth) < 560 ? 'phone' : 'tablet'; }

  function ensureShadow(el, layout) {
    if (svgRoot && el.contains(svgRoot.host) && lastLayout === layout) return;
    el.querySelector('.zc-svg')?.remove();
    const hostEl = document.createElement('div');
    hostEl.className = 'zc-svg';
    el.appendChild(hostEl);
    svgRoot = hostEl.attachShadow({ mode: 'open' });
    lastLayout = layout; lastSvgs = {};
    const open = openSet();
    svgRoot.innerHTML = `<style>${SHADOW_CSS}${window.WIR_LUMA?.CSS || ''}</style><div class="wrap${layout === 'tablet' ? ' tab' : ''}">
      <div class="part" data-k="ov"></div>
      ${layout === 'tablet' ? `<div class="part" data-k="tiles"></div>` : `<details data-k="tiles"${open.has('tiles') ? ' open' : ''}><summary><span class="t">📊 Kontext, Cache &amp; Session</span><span class="s"></span></summary><div class="b part" data-k="tiles"></div></details>`}
      <details data-k="more"${open.has('more') ? ' open' : ''}><summary><span class="t">💬 Letzter Chat &amp; Helfer</span><span class="s"></span></summary><div class="b part" data-k="more"></div></details>
      <details data-k="luma"${open.has('luma') ? ' open' : ''}><summary><span class="t">🪼 Luma · Limit-Coach</span><span class="s"></span></summary><div class="b" data-h="luma"></div></details>
      <details data-k="verlauf"${open.has('verlauf') ? ' open' : ''}><summary><span class="t">📈 Verlauf</span><span class="s"></span></summary><div class="b vl" data-h="verlauf"></div></details>
    </div>`;
    svgRoot.querySelectorAll('details').forEach(dt => dt.addEventListener('toggle', () => { saveOpen(dt.dataset.k, dt.open); if (dt.open) showExtras(); }));
    svgRoot.addEventListener('click', onShadowClick);
    lastExtras = {};
  }

  function showPart(k, svg) {
    if (lastSvgs[k] === svg) return;
    lastSvgs[k] = svg;
    const box = svgRoot.querySelector(`.part[data-k="${k}"]`);
    const tpl = document.createElement('template');
    tpl.innerHTML = svg;
    const next = tpl.content.querySelector('svg');
    const cur = box.querySelector('svg');
    if (!cur || !next) { box.innerHTML = svg; return; }
    morph(cur, next);
  }

  // Luma (Limit-Coach) und Verlauf: HTML aus dem Datensatz `cockpitverlauf0`, nur neu gesetzt, wenn sich etwas ändert
  // und nur, solange der Bereich offen ist (der Verlauf ist ein großes SVG).
  const VL_ID = 'cockpitverlauf0', SPAN_KEY = 'zc-luma-span';
  let vl = null, vlSub = null, lastExtras = {};
  const span = () => { try { return localStorage.getItem(SPAN_KEY) || 'woche'; } catch (_) { return 'woche'; } };
  function setHtml(k, html) {
    const box = svgRoot && svgRoot.querySelector(`[data-h="${k}"]`);
    if (box && lastExtras[k] !== html) { lastExtras[k] = html; box.innerHTML = html; }
  }
  // Verlauf von Claude Code (cockpitverlauf0) und Cowork (coworkverlauf00, seit Plugin 0.4.3) zusammenzählen,
  // damit Luma und der Verlauf die ganze Nutzung sehen. Cowork bringt nur Antworten, Verbrauch, Ausgabe und Stunden mit.
  function mergedVerlauf() {
    const a = (vl && vl.data && vl.data.days) || {}, b = (cwv && cwv.data && cwv.data.days) || {};
    if (!Object.keys(b).length) return vl && vl.data && vl.data.days ? vl.data : null;
    const days = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const x = { turns: 0, out: 0, units: 0, helperUnits: 0, helperAtMain: 0, peak5h: 0, peakWeek: 0, helpers: {}, ...(a[k] || {}) };
      const y = b[k];
      const h = Array.from({ length: 24 }, (_, i) => (Number((x.hours || [])[i]) || 0) + (Number(((y && y.hours) || [])[i]) || 0));
      days[k] = y ? { ...x, turns: x.turns + (Number(y.turns) || 0), units: x.units + (Number(y.units) || 0), out: x.out + (Number(y.out) || 0), hours: h } : { ...x, hours: h };
    }
    return { days };
  }
  function showExtras() {
    if (!svgRoot) return;
    const data = mergedVerlauf();
    const days = data && data.days;
    const now = Date.now();
    const L = window.WIR_LUMA, V = window.WIR_COCKPIT_VERLAUF;
    if (L) {
      const a = days ? L.analyse(data, now, span()) : null;
      setSummary('luma', a ? ({ besser: '↘ sparsamer', schlechter: '↗ teurer', gleich: '→ stabil', neu: 'sammelt Daten' })[a.tr.dir] + ` · ${a.sp.label}` : 'wartet auf Daten');
      if (svgRoot.querySelector('details[data-k="luma"]')?.open) setHtml('luma', L.html(data, now, span()));
    }
    if (V) {
      const s = days ? V.summarize(data, now) : null;
      setSummary('verlauf', s ? `heute ${s.today.turns} · 7 Tage ${s.weekTurns} Antworten` : '');
      if (svgRoot.querySelector('details[data-k="verlauf"]')?.open) {
        setHtml('verlauf', s ? V.historySvg(s) : '<p class="vl-empty">Noch kein Verlauf. Er kommt, sobald das Cockpit in Claude Code läuft.</p>');
      }
    }
  }
  function onShadowClick(e) {
    const b = e.target.closest('[data-span]');
    if (b) { try { localStorage.setItem(SPAN_KEY, b.dataset.span); } catch (_) { /* nur diese Sitzung */ } showExtras(); return; }
    const hit = e.target.closest('.hit');
    if (hit) {
      const chart = hit.closest('.lu-chart'), tip = chart && chart.querySelector('.lu-tip');
      chart.querySelectorAll('.hit.sel').forEach(x => x.classList.remove('sel'));
      hit.classList.add('sel');
      if (tip) { tip.textContent = hit.dataset.tip; tip.classList.add('set'); }
    }
  }

  function setSummary(k, text) {
    const s = svgRoot.querySelector(`details[data-k="${k}"] .s`);
    if (s && s.textContent !== text) s.textContent = text;
  }

  function showDash(el, d) {
    const layout = layoutFor(el);
    ensureShadow(el, layout);
    showPart('ov', G().overviewSvg(d, layout));
    showPart('tiles', G().tilesSvg(d, layout));
    showPart('more', G().moreSvg(d, layout));
    const t = d.tiles || {};
    setSummary('tiles', [t.cache && `Cache ${t.cache.value}`, t.session && t.session.value, t.cost && t.cost.value].filter(Boolean).join(' · '));
    const chat = (d.chats || [])[0];
    const busy = (d.agents || []).filter(a => !a.isDone).length;
    setSummary('more', [chat && chat.title, busy ? `${busy} Helfer aktiv` : ''].filter(Boolean).join(' · '));
    showExtras();
  }

  // Nur ändern, was sich geändert hat: so laufen Animationen weiter und nichts flackert beim Aktualisieren.
  function morph(a, b) {
    for (const at of [...a.attributes]) if (!b.hasAttribute(at.name)) a.removeAttribute(at.name);
    for (const at of [...b.attributes]) if (a.getAttribute(at.name) !== at.value) a.setAttribute(at.name, at.value);
    const ac = [...a.childNodes], bc = [...b.childNodes];
    const sameShape = ac.length === bc.length && ac.every((n, i) => n.nodeType === bc[i].nodeType && n.nodeName === bc[i].nodeName);
    if (!sameShape) { a.replaceChildren(...bc.map(n => document.importNode(n, true))); return; }
    ac.forEach((n, i) => {
      if (n.nodeType === 1) morph(n, bc[i]);
      else if (n.nodeValue !== bc[i].nodeValue) n.nodeValue = bc[i].nodeValue;
    });
  }

  // Cowork (07.11.2026): das Cowork-Plugin „cockpit-team“ meldet per Hook in den Datensatz `coworkstatus000`.
  // War Cowork zuletzt dran, steht es unter „Zuletzt genutzter Chat“; arbeitet es gerade und Claude Code ruht,
  // zeigt Okti, was Cowork tut, und der laufende Helfer leuchtet im Team.
  const CW_ID = 'coworkstatus000';
  const CW_BUSY = 3 * 60000, CW_SHOW = 60 * 60000;
  let cw = null, cwSub = null;
  const CWV_ID = 'coworkverlauf00';   // Cowork-Verbrauch je Tag (Server zählt pro Antwort mit)
  let cwv = null, cwvSub = null;

  function cwAge() { return cw && cw.data ? Date.now() - (Number(cw.sent_at) || Date.parse(cw.updated) || 0) : Infinity; }
  // Millisekunden seit der letzten Cowork-Meldung, wenn Cowork gerade arbeitet; sonst 0.
  function coworkBusy() {
    const a = cwAge();
    return a < CW_BUSY && cw.data.state !== 'idle' ? Math.max(1, a) : 0;
  }

  // Ansicht oben umschaltbar (07.11.2026): „Zuletzt“ zeigt automatisch die Quelle, die zuletzt benutzt wurde,
  // „Claude Code“ und „Cowork“ halten die Ansicht fest. Die Wahl merkt sich das Gerät.
  const MODE_KEY = 'zc-mode';
  const getMode = () => { try { const m = localStorage.getItem(MODE_KEY); return m === 'cc' || m === 'cw' ? m : 'auto'; } catch (_) { return 'auto'; } };
  const setMode = m => { try { localStorage.setItem(MODE_KEY, m); } catch (_) { /* nur bis zum Neuladen */ } };
  const cwOk = () => !!(cw && cw.data && cw.data.source === 'cowork');
  const cleanTitle = t => { const s = String(t || '').trim(); return !s || s.startsWith('<') ? 'Cowork-Aufgabe' : s; };
  const nice = t => String(t || '').replace(/cockpit-team:(\w+)/g, (_, k) => k[0].toUpperCase() + k.slice(1)).replace(/mcp__.*?__/g, '');
  const KINDS = ['pip', 'bubbles', 'inky', 'coral', 'shelly', 'luma'];
  const dayKey = ms => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  // Das Cowork-Dashboard: dieselbe Grafik wie für Claude Code, gefüllt mit dem, was das Cowork-Plugin meldet.
  // Die Limits (5 Std./Woche) gelten fürs ganze Konto; Cowork verrät sie nicht, darum kommen sie aus Claude Code.
  function coworkDash(base) {
    const c = cwOk() ? cw.data : null;
    const age = cwAge(), busy = c ? coworkBusy() : 0;
    const HL = G().HELPER_LOOK, fk = G().fmtK;
    const state = busy ? (c.state === 'thinking' ? 'thinking' : 'working') : 'idle';
    const title = cleanTitle(c && c.title);
    const kind = c ? String(c.agent || '').replace(/^cockpit-team:/, '') : '';
    const team0 = base && Array.isArray(base.team) && base.team.length ? base.team
      : KINDS.map(k => ({ kind: k, model: k === 'coral' || k === 'shelly' ? 'Sonnet' : 'Haiku' }));
    const team = team0.map((m, i) => {
      const idle = (HL[m.kind] && HL[m.kind].idle) || ['bereit'];
      return busy && c.event !== 'SubagentStop' && m.kind === kind ? { ...m, state: 'active', text: 'hilft in Cowork' }
        : { ...m, state: 'idle', text: idle[i % idle.length] };
    });
    const m = Math.round(age / 60000);
    const ago = !c ? '' : m < 1 ? 'gerade eben' : m < 60 ? `vor ${m} Min.` : m < 1440 ? `vor ${Math.floor(m / 60)} Std.` : `vor ${Math.floor(m / 1440)} T.`;
    const lim = (base && base.rings || []).filter(r => r.label !== 'Kontext')
      .map(r => ({ ...r, tooltip: `${r.tooltip} (gilt fürs ganze Konto, gemessen in Claude Code)` }));
    const hasCtx = c && c.ctx > 0;
    const win = (c && c.win) || 200000, p = hasCtx ? Math.min(100, Math.round((c.ctx / win) * 100)) : null;
    const all = hasCtx ? (c.fresh || 0) + (c.cread || 0) + (c.cwrite || 0) : 0;
    const days = (cwv && cwv.data && cwv.data.days) || {};
    const now = Date.now();
    const last14 = Array.from({ length: 14 }, (_, i) => days[dayKey(now - (13 - i) * 864e5)] || null);
    const today = last14[13] || { turns: 0, units: 0 };
    return {
      teamNote: 'Helfer-Team in Cowork (Plugin cockpit-team)',
      team,
      mood: busy ? 'focused' : c && age < CW_SHOW ? 'happy' : 'sleepy',
      pose: busy ? state : c && age < CW_SHOW ? 'idle' : 'sleepy',
      isPoked: false,
      status: !c ? { state: 'sleepy', text: 'noch keine Cowork-Meldung' } : busy ? { state, text: nice(c.text) || 'arbeitet' } : { state: 'idle', text: `wartet · ${ago}` },
      saying: !c ? 'Starte eine Aufgabe in Cowork – dann erscheint sie hier.' : busy ? `In Cowork: ${title}` : `Zuletzt in Cowork: ${title}`,
      agents: [], moreAgents: 0,
      rings: [...lim, { label: 'Kontext', pct: p, detail: hasCtx ? `${fk(c.ctx)} / ${fk(win)}` : 'noch keine Daten', tooltip: 'Wie voll das Gedächtnis des Cowork-Chats ist.' }],
      tiles: {
        ctx: { value: hasCtx ? fk(c.ctx) : '–', sub: hasCtx ? `von ${fk(win)} Tokens · ${p}%` : 'Gedächtnis des Cowork-Chats', pct: p, series: [] },
        cache: { value: all ? `${Math.round(((c.cread || 0) / all) * 100)}%` : '–', sub: 'aus dem Cache (letzte Antwort)', read: hasCtx ? c.cread || 0 : 0, write: hasCtx ? c.cwrite || 0 : 0, fresh: hasCtx ? c.fresh || 0 : 0 },
        session: { value: today.turns ? String(today.turns) : '–', sub: 'Cowork-Antworten heute', bars: last14.map(d => (d && d.turns) || 0) },
        cost: { value: today.units ? fk(Math.round(today.units)) : '–', sub: 'Verbrauchspunkte heute (Cowork)', series: last14.map(d => (d && d.units) || 0) },
      },
      chats: c ? [{ title, project: 'Cowork', state, text: nice(c.text), isThis: false, ago }] : [],
    };
  }

  function render() {
    const el = document.getElementById('zc-card');
    if (!el || !G()) return;
    const ccAge = rec ? Date.now() - (Number(rec.sent_at) || Date.parse(rec.updated) || 0) : Infinity;
    const hasCc = !!(rec && rec.data && rec.data.rings);
    const mode = getMode();
    // „Zuletzt“: die Quelle mit der jüngsten Meldung (Kontext und Cache gehören damit immer zum zuletzt benutzten Chat)
    const view = mode === 'cc' ? 'cc' : mode === 'cw' ? 'cw' : (cwOk() && cwAge() < ccAge) || (!hasCc && cwOk()) ? 'cw' : 'cc';
    const seg = [['auto', 'Zuletzt'], ['cc', 'Claude Code'], ['cw', 'Cowork']]
      .map(([k, l]) => `<button type="button" data-mode="${k}" class="${k === mode ? 'on' : ''}" aria-pressed="${k === mode}">${l}${k === 'auto' ? ` <i>${view === 'cw' ? 'Cowork' : 'Code'}</i>` : ''}</button>`).join('');
    let note, live, d = null;
    if (view === 'cw') {
      const busy = cwOk() ? coworkBusy() : 0;
      note = !cwOk() ? 'noch keine Meldung' : busy ? `arbeitet · vor ${Math.round(busy / 1000)} s` : `zuletzt aktiv vor ${mins(cwAge())}`;
      live = !!busy;
      d = coworkDash(hasCc ? rec.data : null);
    } else if (hasCc) {
      const stale = ccAge > STALE;
      d = rec.data;
      if (stale) {
        d = {
          ...d, mood: 'sleepy', pose: 'sleepy', isPoked: false,
          status: { state: 'sleepy', text: 'keine Session aktiv' },
          saying: 'Gerade läuft nichts. Bis gleich!',
          agents: [], moreAgents: 0,
          chats: (d.chats || []).map(c => ({ ...c, state: 'idle', ago: 'ruht' })),
          team: (d.team || []).map(m => ({ ...m, state: 'idle', text: G().HELPER_LOOK[m.kind]?.idle?.[0] || 'ruht' })),
        };
      }
      note = stale ? `schläft · zuletzt aktiv vor ${mins(ccAge)}` : `live · vor ${Math.max(0, Math.round(ccAge / 1000))} s`;
      live = !stale;
    } else {
      note = 'noch keine Daten';
      live = false;
    }
    const top = `<div class="zc-seg" role="group" aria-label="Ansicht">${seg}</div><div class="zc-tt"><b>${view === 'cw' ? 'Cowork' : 'Claude Code'}</b><small class="${live ? 'zc-live' : ''}">${G().esc(note)}</small></div>`;
    if (!d) {
      const html = `<div class="zc-top">${top}</div><p class="zc-empty">Noch keine Daten. Sobald auf dem PC eine Claude-Session mit dem Cockpit läuft, erscheint hier Okti mit seinem Team.</p>`;
      if (html !== lastHtml) { lastHtml = html; svgRoot = null; el.innerHTML = html; }
      return;
    }
    if (lastHtml !== 'svg') { lastHtml = 'svg'; svgRoot = null; lastLayout = ''; el.innerHTML = `<div class="zc-top">${top}</div>`; }
    else if (el.firstElementChild.innerHTML !== top) el.firstElementChild.innerHTML = top;
    lastDash = d;
    showDash(el, d);
  }

  // Dreht oder ändert sich die Breite (Handy ↔ Tablet), passt sich die Ansicht an.
  let lastDash = null, resizeT = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      const el = document.getElementById('zc-card');
      if (el && lastDash && G() && layoutFor(el) !== lastLayout) showDash(el, lastDash);
    }, 150);
  });

  async function start() {
    if (sub || !pb()) return;
    sub = 'pending';
    try { rec = await pb().collection('cockpit').getOne(ID); } catch (_) { rec = null; }
    try { cw = await pb().collection('cockpit').getOne(CW_ID); } catch (_) { cw = null; }
    try { vl = await pb().collection('cockpit').getOne(VL_ID); } catch (_) { vl = null; }
    try { cwv = await pb().collection('cockpit').getOne(CWV_ID); } catch (_) { cwv = null; }
    render();
    try {
      sub = await pb().collection('cockpit').subscribe(ID, e => { rec = e.record; render(); });
    } catch (_) { sub = null; }
    try {
      cwSub = await pb().collection('cockpit').subscribe(CW_ID, e => { cw = e.record; render(); });
    } catch (_) { cwSub = null; }
    try {
      vlSub = await pb().collection('cockpit').subscribe(VL_ID, e => { vl = e.record; showExtras(); });
    } catch (_) { vlSub = null; }
    try {
      cwvSub = await pb().collection('cockpit').subscribe(CWV_ID, e => { cwv = e.record; showExtras(); if (getMode() !== 'cc') render(); });
    } catch (_) { cwvSub = null; }
    tick = setInterval(render, 20000);   // "vor X s" und Schlaf-Erkennung ohne neue Daten
  }
  function stop() {
    if (typeof sub === 'function') sub();
    else if (sub) pb()?.collection('cockpit').unsubscribe(ID);
    sub = null;
    if (typeof cwSub === 'function') cwSub();
    else if (cwSub) pb()?.collection('cockpit').unsubscribe(CW_ID);
    cwSub = null;
    if (typeof vlSub === 'function') vlSub();
    else if (vlSub) pb()?.collection('cockpit').unsubscribe(VL_ID);
    vlSub = null;
    if (typeof cwvSub === 'function') cwvSub();
    else if (cwvSub) pb()?.collection('cockpit').unsubscribe(CWV_ID);
    cwvSub = null;
    if (tick) { clearInterval(tick); tick = 0; }
  }
  function sync() {
    if (life && page === 'claude' && !document.hidden) start(); else stop();
  }

  document.addEventListener('zh:built', build);
  document.addEventListener('zh:page', e => { page = e.detail; sync(); });
  document.addEventListener('zh:life', e => { life = !!e.detail; sync(); });
  document.addEventListener('visibilitychange', sync);
  pb()?.authStore.onChange(() => { stop(); rec = null; lastHtml = ''; sync(); });
})();
