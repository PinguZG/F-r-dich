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

  function render() {
    const el = document.getElementById('zc-card');
    if (!el || !G()) return;
    let html;
    if (!rec || !rec.data || !rec.data.rings) {
      html = '<p class="zc-empty">Noch keine Daten. Sobald auf dem PC eine Claude-Session mit dem Cockpit läuft, erscheint hier Okti mit seinem Team.</p>';
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
          team: (d.team || []).map(m => ({ ...m, state: 'idle', text: G().HELPER_LOOK[m.kind]?.idle?.[0] || 'ruht' })),
        };
      }
      const note = stale ? `Claude schläft · zuletzt aktiv vor ${mins(age)}` : `live · vor ${Math.max(0, Math.round(age / 1000))} s`;
      html = `<div class="zc-top"><b>Claude</b><small class="${stale ? '' : 'zc-live'}">${G().esc(note)}</small></div><div class="zc-svg">${G().dashboardSvg(d)}</div>`;
    }
    if (html !== lastHtml) { lastHtml = html; el.innerHTML = html; }
  }

  async function start() {
    if (sub || !pb()) return;
    sub = 'pending';
    try { rec = await pb().collection('cockpit').getOne(ID); } catch (_) { rec = null; }
    render();
    try {
      sub = await pb().collection('cockpit').subscribe(ID, e => { rec = e.record; render(); });
    } catch (_) { sub = null; }
    tick = setInterval(render, 20000);   // "vor X s" und Schlaf-Erkennung ohne neue Daten
  }
  function stop() {
    if (typeof sub === 'function') sub();
    else if (sub) pb()?.collection('cockpit').unsubscribe(ID);
    sub = null;
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
