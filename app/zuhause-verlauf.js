// Zuhause → Verlauf: wann hat wer was in Zuhause geändert („Küche an 60 %“, „Szene Gute Nacht“ …).
// Quelle: Aktivitäts-Log (Ereignisart „home“), vom Server bei jedem Befehl geschrieben – hier nur gelesen:
// GET /api/console/log?kind=home. Eigener Reiter über ZH.registerPage (Tablet: Seitenleiste, Handy: unter „Mehr“).
// Sparsam: nur laden, solange Zuhause sichtbar und dieser Reiter offen ist (alle 30 s, sonst nur beim Öffnen).
(() => {
  const host = document.getElementById('zh');
  if (!host) return;
  const pb = () => window.WIR_PB;
  const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>';
  const CSS = `<style>
    #zh .zv-list{display:grid;gap:0;background:var(--z-card);border:1px solid var(--z-line);border-radius:22px;padding:4px 14px;min-width:0}
    #zh .zv-day{font-size:11px;font-weight:700;letter-spacing:.4px;color:var(--z-mut);padding:12px 2px 4px}
    #zh .zv-row{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--z-line)}
    #zh .zv-row:last-child{border-bottom:0}
    #zh .zv-av{flex:none;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;font-size:13px;font-weight:700;color:#fff;background:linear-gradient(135deg,#9a78ff,#6f4fe0)}
    #zh .zv-av.b{background:linear-gradient(135deg,#f28a3c,#e3a94f)}
    #zh .zv-tx{flex:1;min-width:0;font-size:14px;line-height:1.3;color:var(--z-txt);overflow-wrap:anywhere}
    #zh .zv-tm{flex:none;font-size:12px;font-weight:600;color:var(--z-mut);font-variant-numeric:tabular-nums}
    #zh .zv-empty{padding:22px 6px;text-align:center;font-size:13px;color:var(--z-mut)}
    #zh.z-tablet .zv-tx{font-size:12px}#zh.z-tablet .zv-tm{font-size:10.5px}#zh.z-tablet .zv-av{width:26px;height:26px;font-size:11px}
    #zh.z-tablet .zv-row{padding:7px 0}#zh.z-tablet .zv-list{border-radius:14px;padding:2px 12px}
  </style>`;

  let el = null, life = false, page = '', rows = null, err = false, at = 0, timer = 0, busy = false;
  const pad = n => String(n).padStart(2, '0');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mine = () => (pb().authStore.record || pb().authStore.model)?.name || '';
  const day0 = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  function dayLabel(d) {
    const diff = Math.round((day0(new Date()) - day0(d)) / 86400000);
    if (diff === 0) return 'Heute';
    if (diff === 1) return 'Gestern';
    return `${['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][d.getDay()]} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`;
  }
  const pretty = t => String(t).replace(': ', ' · ');

  function render() {
    if (!el || !el.isConnected) return;
    let h = CSS;
    if (!rows) h += `<div class="zv-list"><div class="zv-empty">${err ? 'Verlauf konnte nicht geladen werden' : 'Lädt …'}</div></div>`;
    else if (!rows.length) h += '<div class="zv-list"><div class="zv-empty">Noch nichts passiert</div></div>';
    else {
      const me = mine();
      let day = '';
      h += '<div class="zv-list">';
      for (const x of rows) {
        const d = new Date(String(x.time).replace(' ', 'T'));
        const dl = dayLabel(d);
        if (dl !== day) { day = dl; h += `<div class="zv-day">${esc(dl)}</div>`; }
        h += `<div class="zv-row"><span class="zv-av${x.who === me ? '' : ' b'}">${esc((x.who || '?')[0].toUpperCase())}</span><span class="zv-tx">${esc(pretty(x.detail))}</span><span class="zv-tm">${pad(d.getHours())}:${pad(d.getMinutes())}</span></div>`;
      }
      h += '</div>';
    }
    if (el.__zv !== h) { el.__zv = h; el.innerHTML = h; }
  }

  async function load() {
    if (busy || !pb()?.authStore.isValid) return;
    busy = true;
    try {
      rows = await pb().send('/api/console/log', { query: { limit: 60, kind: 'home' } });
      err = false; at = Date.now();
    } catch (_) { err = true; }
    busy = false;
    render();
  }

  function sync() {
    clearInterval(timer);
    if (!(life && page === 'verlauf')) return;
    if (Date.now() - at > 5000) load();
    timer = setInterval(load, 30000);
  }

  let built = false;
  function build() {
    if (!window.ZH?.registerPage) return;
    if (!built) {
      built = true;
      window.ZH.registerPage({
        key: 'verlauf', label: 'Verlauf', icon: ICON, sub: 'Wer hat was geändert',
        html: '<div id="zv-root"></div>',
        mount(e) { el = e.querySelector('#zv-root') || e; if (el) el.__zv = ''; render(); },
      });
    }
  }
  document.addEventListener('zh:built', build);
  document.addEventListener('zh:page', e => { page = e.detail; sync(); });
  document.addEventListener('zh:life', e => { life = !!e.detail; sync(); });
  build();
})();
