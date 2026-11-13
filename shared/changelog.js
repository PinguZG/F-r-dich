// Update-Log: nach einem Update zeigt ein kleines Fenster sachlich, was neu ist (/shared/changelog.js).
// Neuer Eintrag = oben in ENTRIES ergänzen, mit derselben Nummer wie `wir-vNN` in app/sw.js.
//   features = neue Funktionen (immer anzeigen, z. B. „Puzzle“)
//   small    = kleine Features (z. B. Benachrichtigungen, Konsole)
//   hotfix   = Fehlerbehebungen und Kleinkram
(() => {
  const ENTRIES = [
    { v: 73, date: '2026-11-13',
      features: [
        'Puzzle: zusammen oder allein, vier Stufen (Leicht, Mittel, Schwer, Profi), dazu Aufgeteilt und Blind.',
        'Zusammen spielen: Zeichenspiele mit den Modi Normal, Complement, Story, Animation und Knock Off.',
        'Draw Pro: über 30 Pinsel mit einstellbaren Parametern, Druck- und Neigungskurven, Auswahl-Werkzeuge, Ebenen mit Mischmodi, Symmetrie, Zeitraffer.',
        'Allein zeichnen: private Skizzen, die du später an deinen Schatz schicken kannst.',
      ],
      small: [
        'Stift-Erkennung (Apple Pencil) mit Handballen-Schutz und „Nur Stift zeichnet“.',
        'Tablet: größere Touch-Ziele, Tastatur-Fokus und breitere Raster.',
        'Benachrichtigung „Du bist dran“ bei Zeichenspielen.',
        'Export als PNG, transparentes PNG oder JPEG.',
      ],
      hotfix: [] },
    { v: 70, date: '2026-11-13',
      features: ['Update-Log: Nach einem Update erscheint ein Fenster mit den Neuerungen.'],
      small: [],
      hotfix: [] },
  ];

  const KEY = 'wir-changelog-seen';
  const num = s => parseInt(String(s || '').replace(/\D/g, ''), 10) || 0;
  const read = () => { try { return num(localStorage.getItem(KEY)); } catch (_) { return 0; } };
  const write = n => { try { localStorage.setItem(KEY, String(n)); } catch (_) {} };

  const css = document.createElement('style');
  css.textContent = `
.cl-back{position:fixed;inset:0;z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;
  background:rgba(20,8,16,.45);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.cl-box{width:min(420px,100%);max-height:80vh;overflow:auto;padding:20px 20px 16px;border-radius:24px;
  background:var(--card);border:1px solid var(--card-line);color:var(--ink);font-family:Quicksand,system-ui,sans-serif;
  box-shadow:0 20px 60px rgba(0,0,0,.25);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
.cl-box h2{margin:0 0 2px;font-size:1.25rem}
.cl-ver{margin:0 0 14px;font-size:.8rem;color:var(--ink-soft)}
.cl-box h3{margin:14px 0 6px;font-size:.78rem;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-soft)}
.cl-box ul{margin:0;padding-left:18px;font-size:.92rem;line-height:1.45}
.cl-box li{margin:3px 0}
.cl-box li.cl-dim{color:var(--ink-soft);font-size:.86rem}
.cl-ok{display:block;width:100%;margin-top:16px;padding:12px;border:0;border-radius:16px;cursor:pointer;
  background:var(--accent);color:var(--accent-ink);font:inherit;font-weight:700}`;
  document.head.append(css);

  function section(box, title, items, dim) {
    if (!items.length) return;
    const h = document.createElement('h3'); h.textContent = title;
    const ul = document.createElement('ul');
    items.forEach(t => { const li = document.createElement('li'); li.textContent = t; if (dim) li.className = 'cl-dim'; ul.append(li); });
    box.append(h, ul);
  }

  function show(list, current) {
    if (!list.length || document.querySelector('.cl-back')) return;
    const merge = k => list.flatMap(e => e[k] || []);
    const back = document.createElement('div'); back.className = 'cl-back';
    const box = document.createElement('div'); box.className = 'cl-box';
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    const h = document.createElement('h2'); h.textContent = 'Was ist neu?';
    const v = document.createElement('p'); v.className = 'cl-ver';
    v.textContent = 'Version ' + (current || 'v' + list[0].v) + ' · ' + list[0].date;
    box.append(h, v);
    section(box, 'Neue Funktionen', merge('features'));
    section(box, 'Kleine Features', merge('small'));
    section(box, 'Hotfix', merge('hotfix'), true);
    const ok = document.createElement('button'); ok.type = 'button'; ok.className = 'cl-ok'; ok.textContent = 'Okay';
    const close = () => { back.remove(); write(current ? num(current) : list[0].v); };
    ok.addEventListener('click', close);
    back.addEventListener('click', e => { if (e.target === back) close(); });
    box.append(ok); back.append(box); document.body.append(back);
  }

  let done = false;
  function check(version) {
    const cur = num(version);
    if (!cur || done) return;
    done = true;
    const last = read();
    if (!last) { write(cur); return; }                       // erster Start: nichts anzeigen
    const fresh = ENTRIES.filter(e => e.v > last && e.v <= cur);
    if (!fresh.length) { if (cur > last) write(cur); return; }
    setTimeout(() => show(fresh, version), 1200);
  }

  // „Was ist neu?“ jederzeit aus den Einstellungen: zeigt den letzten Eintrag
  document.getElementById('changelogBtn')?.addEventListener('click', () => show(ENTRIES.slice(0, 1), window.WIR_VERSION));

  if (window.WIR_VERSION) check(window.WIR_VERSION);
  document.addEventListener('wir:version', e => check(e.detail));
})();
