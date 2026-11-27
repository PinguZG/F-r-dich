// Update-Log: nach einem Update zeigt ein kleines Fenster sachlich, was neu ist (/shared/changelog.js).
// Neuer Eintrag = oben in ENTRIES ergänzen, mit derselben Nummer wie `wir-vNN` in app/sw.js.
//   features = neue Funktionen (immer anzeigen, z. B. „Puzzle“)
//   small    = kleine Features (z. B. Benachrichtigungen, Konsole)
//   hotfix   = Fehlerbehebungen und Kleinkram
(() => {
  const ENTRIES = [
    { v: 128, date: '2026-11-27',
      features: [],
      small: ['Lernen NEW: im Fach mehr Platz (Kopfzeile ausgeblendet).'],
      hotfix: [] },
    { v: 127, date: '2026-11-27',
      features: [],
      small: ['Menü-Pfeil frei verschiebbar.', 'Zurück-Knopf geht auf die vorherige Seite.', 'Stimmungskatze der anderen Person auf Start, eigene Stimmung und Katze per Tipp auf den Kasten ändern.'],
      hotfix: ['Geschenk-Startbildschirm entfernt.'] },
    { v: 126, date: '2026-11-27',
      features: [],
      small: ['Menü-Pfeil am Rand größer, Menü-Hinweis entfernt.'],
      hotfix: [] },
    { v: 125, date: '2026-11-27',
      features: ['Lernen NEW: jedes Fach ein Pixel-Tier, das mit dir lernt und wächst', 'Stimmungskatzen auf der Startseite'],
      small: [],
      hotfix: [] },
    { v: 124, date: '2026-11-25',
      features: [],
      small: ['Startseite überarbeitet.'],
      hotfix: [] },
    { v: 123, date: '2026-11-25',
      features: [],
      small: [],
      hotfix: ['Kleine Korrekturen auf der Startseite.'] },
    { v: 122, date: '2026-11-25',
      features: [],
      small: [],
      hotfix: ['Kleine Korrekturen auf der Startseite.'] },
    { v: 121, date: '2026-11-25',
      features: [],
      small: [],
      hotfix: ['Kleine Korrekturen auf der Startseite.'] },
    { v: 120, date: '2026-11-25',
      features: [],
      small: [],
      hotfix: ['Kleine Korrekturen auf der Startseite.'] },
    { v: 119, date: '2026-11-25',
      features: [],
      small: [],
      hotfix: ['Kleine Korrekturen auf der Startseite.'] },
    { v: 118, date: '2026-11-25',
      features: [],
      small: [],
      hotfix: ['Kleine Korrekturen auf der Startseite.'] },
    { v: 117, date: '2026-11-25',
      features: [],
      small: [],
      hotfix: ['Kleine Korrekturen auf der Startseite.'] },
    { v: 116, date: '2026-11-25',
      features: [],
      small: [],
      hotfix: ['Kleine Verbesserungen auf der Startseite.'] },
    { v: 115, date: '2026-11-24',
      features: [],
      small: ['Ida · Politik: auf das Wesentliche gekürzt (nur noch, was in der Themenliste verlangt wird, 59 Karten).'],
      hotfix: [] },
    { v: 114, date: '2026-11-24',
      features: ['Ida · Politik: Inhalte komplett neu auf die Themenliste der Kurzarbeit zugeschnitten (6 Themen, 71 Karten, Plan für Di/Mi).'],
      small: ['Prüfungen: Zoom-Anzeige in %, Doppeltipp wechselt zwischen Breite und 2,2×.'],
      hotfix: ['Prüfungen: Finger-Berührungen wurden auf dem Tablet teils als Handballen ignoriert, dadurch ging Zoomen/Scrollen nicht.'] },
    { v: 113, date: '2026-11-23',
      features: ['Lernen: SQL-Kapitel unter Datenbanken (SELECT, GROUP BY, JOIN, ALTER TABLE, Benutzerrechte), 23 SQL-Karten und 9 Übungsaufgaben.'],
      small: [],
      hotfix: [] },
    { v: 112, date: '2026-11-22',
      features: ['Prüfungen: Stift-Schreiben nur mit dem Stift (Finger scrollen und zoomen nur), freies Zoomen mit zwei Fingern, Handballen-Schutz.'],
      small: ['Kleine Leiste: Rückgängig und Radierer (der Stift-Knopf radiert auch).'],
      hotfix: [] },
    { v: 111, date: '2026-11-22',
      features: ['Prüfungen: Antwortfelder direkt auf den Antwortzeilen der Original-PDFs (tippen statt Reiter), oben „Antworten kopieren“. Stift-, Marker- und Textleiste entfernt.'],
      small: [],
      hotfix: ['Reiter „Antworten“ entfernt (Felder sind jetzt auf den Seiten).'] },
    { v: 110, date: '2026-11-22',
      features: ['Lernen → Prüfungen: neuer Reiter „Antworten“ zum Schreiben von Antworten und Rechenwegen, mit Kopieren zur Korrektur.'],
      small: [],
      hotfix: [] },
    { v: 109, date: '2026-11-21',
      features: ['Kunst (Lernen → Ida): neue Reiter „Analyse“ (Werkanalyse mit Musteranalysen) und Epochen-Vergleich; Künstler-Training für Cézanne, Gauguin und van Gogh.'],
      small: ['Bildkarten und Realismus entfernt, Karten nur noch Merkmale.'],
      hotfix: [] },
    { v: 108, date: '2026-11-21',
      features: ['Kunst (Lernen → Ida): neues Zuordnen-Training für die Kurzarbeit – Bild der Epoche zuordnen, bei den Wegbereitern auch dem Künstler. Stoff auf das Prüfungsrelevante gekürzt.'],
      small: [],
      hotfix: [] },
    { v: 107, date: '2026-11-21',
      features: ['Lernen → Ida: neuer Reiter „Kunst“ für Experimentelles Gestalten mit Stoff, Bildern, Prüfungsfragen, Karteikarten und den Original-PDFs.'],
      small: [],
      hotfix: [] },
    { v: 106, date: '2026-11-20',
      features: ['Seitenmenü: Die untere Leiste ist weg. Ein kleiner Pfeil am linken Rand öffnet das Menü mit allen Reitern.'],
      small: ['Kleines Tutorial beim ersten Öffnen zeigt, wo das Menü ist.'],
      hotfix: [] },
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
