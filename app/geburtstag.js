/* Geburtstag (Ida, 26.11.): ab 0:00 Uhr springt einmalig ein Pop-up mit einer rosa Kamera auf. Im Display läuft ein Filmstreifen aller
   Erinnerungen von rechts nach links (jedes Bild 2 s, Bilder hängen wie eine Filmrolle aneinander). Danach schließt sich das Pop-up und auf der
   Startseite bleibt den Tag über die Karte „Alles Gute zum Geburtstag“ (mit Knopf zum Nochmal-Ansehen). Jedes Jahr am 26.11.
   Daniel sieht es als Vorschau schon 14 Tage vorher. Fotos: Collection photos (nur lesen). Datum/Uhrzeit vom Gerät. */
(function () {
  const MONTH = 10, DAY = 26;                       // 26. November (Monat 0-basiert)
  const PREVIEW_DAYS = 14, HOLD_MS = 2000, MOVE_MS = 550, DAY_MS = 864e5;
  const pb = () => window.WIR_PB;
  const me = () => { const p = pb(); return (p && (p.authStore.record || p.authStore.model)) || null; };
  const isDaniel = () => { const u = me(); return !!u && (/daniel/i.test(u.name || '') || /^daniel/i.test(u.email || '')); };
  const bday = () => new Date(new Date().getFullYear(), MONTH, DAY, 0, 0, 0, 0).getTime();
  function state() {                                // 'day' = Geburtstag (alle), 'preview' = nur Daniel vorab, null = nichts
    if (!me()) return null;
    const n = Date.now(), b = bday(), e = b + DAY_MS;
    if (n >= b && n < e) return 'day';
    if (isDaniel() && n >= b - PREVIEW_DAYS * DAY_MS && n < b) return 'preview';
    return null;
  }
  const seenKey = () => 'wir-bday-' + new Date().getFullYear() + '-' + (me() ? me().id : '');
  const seen = () => { try { return !!localStorage.getItem(seenKey()); } catch (_) { return false; } };
  const mark = () => { try { localStorage.setItem(seenKey(), '1'); } catch (_) {} };

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
    clearTimeout(timer); timer = null; if (!pop) return;
    const p = pop; pop = null; p.classList.add('out'); setTimeout(() => p.remove(), 500);
  }
  function setFrame(i) {                            // Bild i und die nächsten zwei laden (spart Daten bei vielen Fotos)
    if (!pop) return;
    const fr = pop.querySelectorAll('.bd-f');
    for (let k = i; k <= i + 2 && k < fr.length; k++) { const im = fr[k].firstElementChild; if (!im.getAttribute('src')) im.src = url(list[k]); }
  }
  function step() {
    if (!pop) return;
    if (pos >= list.length - 1) { timer = setTimeout(closePop, HOLD_MS); return; }   // letztes Bild gezeigt -> Pop-up zu
    pos++; setFrame(pos);
    pop.querySelector('.bd-track').style.transform = 'translateX(' + (-pos * 100) + '%)';
    timer = setTimeout(step, HOLD_MS + MOVE_MS);
  }
  async function openPop() {
    if (pop || !(await load()) || !list.length) return;
    mark();
    pop = document.createElement('div'); pop.className = 'bdp';
    pop.innerHTML = '<button type="button" class="bdp-x" aria-label="Schließen">✕</button><div class="bdp-in">' +
      '<div class="bd-cam"><div class="bd-win"><div class="bd-track">' + list.map(() => '<div class="bd-f"><img alt="Erinnerung" decoding="async"></div>').join('') + '</div></div>' +
      '<img class="bd-camimg" src="/img/geburtstag-kamera.png" alt="" decoding="async"></div>' +
      '<div class="bdp-txt"><b>Alles Gute zum Geburtstag 💗</b><span>Ich liebe dich mehr als alles andere</span></div></div>';
    pop.addEventListener('click', e => { if (e.target.closest('.bdp-x') || e.target === pop) closePop(); });
    document.body.append(pop); pos = 0; setFrame(0);
    requestAnimationFrame(() => pop && pop.classList.add('on'));
    timer = setTimeout(step, HOLD_MS + 350);        // 1. Bild 2 s, dann weiter
  }

  // ---------- Karte auf der Startseite ----------
  function mount(st) {
    const home = document.getElementById('s-home'); if (!home) return;
    box = document.createElement('div'); box.id = 'bdBox'; box.className = 'bd';
    box.innerHTML = (st === 'preview' ? '<div class="bd-prev">Vorschau für dich: Ida sieht das erst am 26.11. ab 0:00 Uhr.</div>' : '') +
      '<div class="bd-txt glass"><b>Alles Gute zum Geburtstag 💗</b><span>Ich liebe dich mehr als alles andere</span><button type="button" class="bd-again" data-bd="again">🎞️ Erinnerungen ansehen</button></div>';
    box.addEventListener('click', e => { if (e.target.closest('[data-bd=again]')) openPop(); });
    home.insertBefore(box, home.firstChild);
  }
  function unmount() { if (box) box.remove(); box = null; }
  function check() {
    const st = state();
    if (st && !box) mount(st);
    else if (!st && box) unmount();
    else if (st === 'day' && box && box.querySelector('.bd-prev')) { unmount(); mount(st); }   // um 0:00 Vorschau-Hinweis weg
    if (st && !seen() && !pop && homeActive() && !document.hidden) openPop();                  // einmalig, nur auf der Startseite
  }
  document.addEventListener('wir:started', () => { check(); });
  document.addEventListener('wir:show', e => { if (e.detail === 's-home') setTimeout(check, 300); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  setInterval(check, 4000);                         // trifft 0:00 Uhr auf wenige Sekunden genau
  window.WIR_BDAY = { check, state, openPop };
})();
