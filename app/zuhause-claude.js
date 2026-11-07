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
    svgRoot.innerHTML = `<style>${SHADOW_CSS}</style><div class="wrap${layout === 'tablet' ? ' tab' : ''}">
      <div class="part" data-k="ov"></div>
      ${layout === 'tablet' ? `<div class="part" data-k="tiles"></div>` : `<details data-k="tiles"${open.has('tiles') ? ' open' : ''}><summary><span class="t">📊 Kontext, Cache &amp; Session</span><span class="s"></span></summary><div class="b part" data-k="tiles"></div></details>`}
      <details data-k="more"${open.has('more') ? ' open' : ''}><summary><span class="t">💬 Letzter Chat &amp; Helfer</span><span class="s"></span></summary><div class="b part" data-k="more"></div></details>
    </div>`;
    svgRoot.querySelectorAll('details').forEach(dt => dt.addEventListener('toggle', () => saveOpen(dt.dataset.k, dt.open)));
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

  function cwAge() { return cw && cw.data ? Date.now() - (Number(cw.sent_at) || Date.parse(cw.updated) || 0) : Infinity; }
  // Millisekunden seit der letzten Cowork-Meldung, wenn Cowork gerade arbeitet; sonst 0.
  function coworkBusy() {
    const a = cwAge();
    return a < CW_BUSY && cw.data.state !== 'idle' ? Math.max(1, a) : 0;
  }

  function withCowork(d, ccAge, ccStale) {
    const age = cwAge();
    if (age > CW_SHOW) return d;
    // Lesbar machen: „cockpit-team:inky“ → „Inky“, MCP-Werkzeugnamen ohne Server-Vorsilbe.
    const nice = t => String(t || '').replace(/cockpit-team:(\w+)/g, (_, k) => k[0].toUpperCase() + k.slice(1)).replace(/mcp__.*?__/g, '');
    const c = { ...cw.data, text: nice(cw.data.text) };
    const busy = coworkBusy();
    const state = busy ? (c.state === 'thinking' ? 'thinking' : 'working') : 'idle';
    const m = Math.round(age / 60000);
    const ago = m < 1 ? 'gerade eben' : m < 60 ? `vor ${m} Min.` : `vor ${Math.floor(m / 60)} Std.`;
    const out = { ...d };
    if (ccStale || age < ccAge) {
      out.chats = [{ title: c.title || 'Cowork-Aufgabe', project: 'Cowork', state, text: c.text || '', ago }];
    }
    if (busy && ccStale) {
      out.mood = 'focused';
      out.pose = state;
      out.status = { state, text: `Cowork: ${c.text || 'arbeitet'}` };
      out.saying = c.title ? `In Cowork: ${c.title}` : 'Ich arbeite gerade in Cowork.';
      const kind = String(c.agent || '').replace(/^cockpit-team:/, '');
      if (c.event !== 'SubagentStop' && (out.team || []).some(t => t.kind === kind)) {
        out.team = out.team.map(t => t.kind === kind ? { ...t, state: 'active', text: 'hilft in Cowork' } : t);
      }
    }
    return out;
  }

  function render() {
    const el = document.getElementById('zc-card');
    if (!el || !G()) return;
    if (!rec || !rec.data || !rec.data.rings) {
      const html = '<p class="zc-empty">Noch keine Daten. Sobald auf dem PC eine Claude-Session mit dem Cockpit läuft, erscheint hier Okti mit seinem Team.</p>';
      if (html !== lastHtml) { lastHtml = html; svgRoot = null; el.innerHTML = html; }
    } else {
      const age = Date.now() - (Number(rec.sent_at) || Date.parse(rec.updated) || 0);
      let d = rec.data;
      const stale = age > STALE;
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
      const cwBusy = coworkBusy();
      d = withCowork(d, age, stale);
      const note = stale && cwBusy ? `Cowork aktiv · vor ${Math.round(cwBusy / 1000)} s`
        : stale ? `Claude schläft · zuletzt aktiv vor ${mins(age)}` : `live · vor ${Math.max(0, Math.round(age / 1000))} s`;
      const top = `<b>Claude</b><small class="${stale && !cwBusy ? '' : 'zc-live'}">${G().esc(note)}</small>`;
      if (lastHtml !== 'svg') { lastHtml = 'svg'; svgRoot = null; lastLayout = ''; el.innerHTML = `<div class="zc-top">${top}</div>`; }
      else if (el.firstElementChild.innerHTML !== top) el.firstElementChild.innerHTML = top;
      lastDash = d;
      showDash(el, d);
    }
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
    render();
    try {
      sub = await pb().collection('cockpit').subscribe(ID, e => { rec = e.record; render(); });
    } catch (_) { sub = null; }
    try {
      cwSub = await pb().collection('cockpit').subscribe(CW_ID, e => { cw = e.record; render(); });
    } catch (_) { cwSub = null; }
    tick = setInterval(render, 20000);   // "vor X s" und Schlaf-Erkennung ohne neue Daten
  }
  function stop() {
    if (typeof sub === 'function') sub();
    else if (sub) pb()?.collection('cockpit').unsubscribe(ID);
    sub = null;
    if (typeof cwSub === 'function') cwSub();
    else if (cwSub) pb()?.collection('cockpit').unsubscribe(CW_ID);
    cwSub = null;
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
