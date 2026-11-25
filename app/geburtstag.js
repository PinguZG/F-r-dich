/* Geburtstag (Ida, 26.11.): Neben der Uhr auf der Startseite sitzt ein kleiner Geschenk-Knopf. Tippen öffnet ein Pop-up mit einer rosa Kamera:
   im Display läuft ein Filmstreifen aller Erinnerungen von rechts nach links (jedes Bild 2 s, Bilder hängen wie eine Filmrolle aneinander),
   dahinter schreibt sich der Liebestext. ✕ schließt zuerst die Kamera, dann den Text. Startet nie automatisch.
   Ida: Knopf ausgegraut bis 26.11. 0:00 Uhr (sichtbar ab 14 Tage vorher), dann den ganzen Tag aktiv. Daniel: als Vorschau jederzeit aktiv.
   Jedes Jahr am 26.11. Fotos: Collection photos (nur lesen). Datum/Uhrzeit vom Gerät. */
(function () {
  const MONTH = 10, DAY = 26;                       // 26. November (Monat 0-basiert)
  const PREVIEW_DAYS = 14, HOLD_MS = 2000, MOVE_MS = 550, DAY_MS = 864e5;
  const pb = () => window.WIR_PB;
  const me = () => { const p = pb(); return (p && (p.authStore.record || p.authStore.model)) || null; };
  const isDaniel = () => { const u = me(); return !!u && (/daniel/i.test(u.name || '') || /^daniel/i.test(u.email || '')); };
  const bday = () => new Date(new Date().getFullYear(), MONTH, DAY, 0, 0, 0, 0).getTime();
  function state() {                                // 'day' = Geburtstag (alle), 'preview' = Daniel vorab, 'locked' = Ida vorab (ausgegraut), null = nichts
    if (!me()) return null;
    const n = Date.now(), b = bday(), e = b + DAY_MS;
    if (n >= b && n < e) return 'day';
    if (n >= b - PREVIEW_DAYS * DAY_MS && n < b) return isDaniel() ? 'preview' : 'locked';
    return null;
  }
  const seenKey = () => 'wir-bday-' + new Date().getFullYear() + '-' + (me() ? me().id : '');
  const seen = () => { try { return !!localStorage.getItem(seenKey()); } catch (_) { return false; } };
  const mark = () => { try { localStorage.setItem(seenKey(), '1'); } catch (_) {} };

  // Hintergrund im Pop-up: dieser Text wird wie der Code bei der Blume weich geblurt Zeichen für Zeichen „runtergeschrieben“
  const LOVE = 'Ich liebe dich.\n\nIch weiß, du hältst nicht viel von deinen Geburtstagen, aber das ist der erste mit mir und er wird toll, genauso wie jeder, der noch kommen wird und den wir zusammen verbringen können.\n\nMorgen bin ich da.';
  const TYPE_MS = 38;                               // ca. 26 Zeichen/s, einmal geschrieben
  let tyTimer = null;
  let box = null, pop = null, list = [], loaded = false, loading = false, token = '', timer = null, pos = 0;
  const url = p => pb().files.getURL(p, p.image, { thumb: '600x0', token });
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const homeActive = () => { const h = document.getElementById('s-home'); return !!h && h.classList.contains('active'); };

  async function load() {
    if (loaded) return true; if (loading) return false; loading = true;
    try {
      try { token = await pb().files.getToken(); } catch (_) {}
      list = (await pb().collection('photos').getFullList({ sort: 'created', fields: 'id,collectionId,collectionName,image,caption', requestKey: null })).filter(p => p.image);
      loaded = true;
    } catch (e) { console.warn('[geburtstag] Fotos nicht geladen', e && e.message); }
    loading = false; return loaded;
  }

  // ---------- Pop-up mit Kamera ----------
  function closePop() {
    clearTimeout(timer); timer = null; clearTimeout(tyTimer); tyTimer = null; if (!pop) return;
    const p = pop; pop = null; p.classList.add('out'); setTimeout(() => p.remove(), 500);
  }
  function setFrame(i) {                            // Bild i und die nächsten zwei laden (spart Daten bei vielen Fotos)
    if (!pop) return;
    const fr = pop.querySelectorAll('.bd-f');
    for (let k = i; k <= i + 2 && k < fr.length; k++) { const im = fr[k].firstElementChild; if (!im.getAttribute('src')) im.src = url(list[k]); }
  }
  function step() {
    if (!pop) return;
    if (pos >= list.length - 1) { timer = setTimeout(readPhase, HOLD_MS); return; }   // letztes Bild gezeigt -> Kamera aus, Text lesbar (X schließt)
    pos++; setFrame(pos);
    pop.querySelector('.bd-track').style.transform = 'translateX(' + (-pos * 100) + '%)';
    timer = setTimeout(step, HOLD_MS + MOVE_MS);
  }
  const escT = x => x.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  let ty = null;                                    // { i, fast }
  function typeLove() {
    const t = pop && pop.querySelector('.bdp-t'); if (!t) return;
    ty = { i: 0, fast: false };
    const draw = () => { t.innerHTML = escT(LOVE.slice(0, ty.i)) + '<i class="cur"></i><span class="rest">' + escT(LOVE.slice(ty.i)) + '</span>'; };  // Rest unsichtbar: Platz bleibt reserviert, Text steht mittig ruhig
    const go = () => {
      if (!pop || !t.isConnected) return;
      if (ty.i >= LOVE.length) return;               // einmal geschrieben, dann bleibt der Text stehen
      ty.i++; draw();
      tyTimer = setTimeout(go, ty.fast ? 14 : (LOVE[ty.i - 1] === '\n' ? 220 : TYPE_MS));
    };
    ty.go = go; draw(); go();
  }
  function readPhase() {                            // Film fertig: Kamera blendet langsam aus, Blur weg, Text zu Ende schreiben und lesbar stehen lassen
    if (!pop) return;
    clearTimeout(timer); timer = null;
    pop.classList.add('read');
    if (!ty) return;
    ty.fast = true; clearTimeout(tyTimer);
    if (ty.i < LOVE.length) tyTimer = setTimeout(ty.go, 500);
  }
  async function openPop() {
    const st0 = state(); if (st0 !== 'day' && st0 !== 'preview') return;      // vor 0:00 Uhr (Ida) nie öffnen
    if (pop || !(await load()) || !list.length) return;
    mark(); check();
    pop = document.createElement('div'); pop.className = 'bdp';
    pop.innerHTML = '<div class="bdp-bg" aria-hidden="true"><div class="bdp-t"></div></div><button type="button" class="bdp-x" aria-label="Schließen">✕</button><div class="bdp-in">' +
      '<div class="bd-cam"><div class="bd-win"><div class="bd-track">' + list.map(() => '<div class="bd-f"><img alt="Erinnerung" decoding="async"></div>').join('') + '</div></div>' +
      '<img class="bd-camimg" src="/img/geburtstag-kamera.png" alt="" decoding="async"></div>' +
      '<div class="bdp-txt"><b>Alles Gute zum Geburtstag 💗</b><span>Ich liebe dich mehr als alles andere</span></div></div>';
    pop.addEventListener('click', e => { if (!e.target.closest('.bdp-x')) return; if (pop.classList.contains('read')) closePop(); else readPhase(); });
    document.body.append(pop); pos = 0; setFrame(0);
    requestAnimationFrame(() => pop && pop.classList.add('on'));
    timer = setTimeout(step, HOLD_MS + 350);        // 1. Bild 2 s, dann weiter
    typeLove();
  }

  // ---------- Knopf neben der Uhr ----------
  const GIFT = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10.5" width="16" height="9.5" rx="1.6"/><rect x="3" y="7" width="18" height="3.5" rx="1.2"/><path d="M12 7v13M12 7C10.4 3.8 7 3.8 7.2 5.8 7.4 7.4 10 7 12 7zM12 7c1.6-3.2 5-3.2 4.8-1.2C16.6 7.4 14 7 12 7z"/></svg>';
  function row() {                                  // Uhr in eine Zeile packen (Uhr links, Knopf rechts), ändert sonst nichts am Aufbau
    const clock = document.getElementById('stClock'); if (!clock) return null;
    if (clock.parentNode.classList.contains('bd-row')) return clock.parentNode;
    const r = document.createElement('div'); r.className = 'bd-row'; clock.parentNode.insertBefore(r, clock); r.append(clock); return r;
  }
  function render(st) {
    const r = row(); if (!r) return;
    let b = document.getElementById('bdGift');
    if (!st) { if (b) b.remove(); const n0 = document.getElementById('bdNote'); if (n0) n0.remove(); box = null; return; }
    if (!b) {
      b = document.createElement('button'); b.type = 'button'; b.id = 'bdGift'; b.className = 'bd-gift'; b.innerHTML = GIFT;
      b.addEventListener('click', () => {
        if (b.classList.contains('off')) { b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); return; }
        openPop();
      });
      r.append(b);
    }
    const off = st === 'locked';
    let nt = document.getElementById('bdNote');
    if (off && !nt) { nt = document.createElement('span'); nt.id = 'bdNote'; nt.className = 'bd-note'; nt.textContent = 'Ab 0 Uhr verfügbar'; r.append(nt); }
    else if (!off && nt) nt.remove();
    b.classList.toggle('off', off); b.classList.toggle('new', !off && !seen());
    b.setAttribute('aria-disabled', off ? 'true' : 'false');
    b.setAttribute('aria-label', off ? 'Geschenk, ab 0:00 Uhr am 26.11.' : 'Geschenk öffnen');
    b.title = off ? 'Ab 26.11. um 0:00 Uhr' : (st === 'preview' ? 'Vorschau (Ida ab 26.11. 0:00 Uhr)' : 'Geschenk öffnen');
    box = b;
  }
  function check() { render(state()); }
  document.addEventListener('wir:started', () => { check(); });
  document.addEventListener('wir:show', e => { if (e.detail === 's-home') setTimeout(check, 300); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  setInterval(check, 4000);                         // trifft 0:00 Uhr auf wenige Sekunden genau
  window.WIR_BDAY = { state };
})();
