/* Einmaliger Brief über den ganzen Bildschirm (Schreibmaschine). Zeigt sich pro Person genau einmal,
   nämlich bis der Brief eingepackt wird (Brief-Symbol oben rechts). */
(function () {
  const BRIEF = {
    id: 'test-1',
    fuer: /daniel/i, // TEST: nur Daniel. Für Ida später auf /ida/i stellen und den echten Text eintragen.
    text: 'Hey du, das hier ist nur ein Testtext, der Buchstabe für Buchstabe erscheint. Wenn du das liest, funktioniert die Schreibmaschine. Schön, dass es dich gibt, und jetzt pack mich ein.'
  };
  const SPEED = 42; // ms pro Zeichen (~200 Zeichen in ca. 8 s)
  const me = () => (window.pb && (pb.authStore.record || pb.authStore.model)) || null;
  const key = () => 'wir-brief-' + BRIEF.id + '-' + (me() ? me().id : '');
  const get = () => { try { return localStorage.getItem(key()); } catch (e) { return null; } };
  const set = () => { try { localStorage.setItem(key(), '1'); } catch (e) {} };
  let timer = null;

  function close(el, done) {
    clearInterval(timer);
    el.classList.add('pack');
    setTimeout(() => { el.remove(); if (done) set(); }, 700);
  }

  function show(force) {
    const u = me();
    if (!u || document.getElementById('brief-ov')) return;
    if (!force && (get() || !(BRIEF.fuer.test(u.name || '') || BRIEF.fuer.test(u.email || '')))) return;
    const el = document.createElement('div');
    el.id = 'brief-ov';
    el.innerHTML = '<button class="brief-x" aria-label="Brief einpacken"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3.5 7l8.5 6 8.5-6"/></svg></button><div class="brief-paper"><p class="brief-t"></p></div>';
    document.body.appendChild(el);
    const p = el.querySelector('.brief-t');
    const chars = Array.from(BRIEF.text);
    let i = 0;
    const fin = () => { clearInterval(timer); p.textContent = BRIEF.text; el.classList.add('fertig'); };
    const tick = () => {
      i++; p.textContent = chars.slice(0, i).join('');
      if (/[.,!?]/.test(chars[i - 1])) { clearInterval(timer); setTimeout(() => { if (i < chars.length) timer = setInterval(tick, SPEED); }, 260); }
      if (i >= chars.length) fin();
    };
    timer = setInterval(tick, SPEED);
    el.querySelector('.brief-paper').addEventListener('click', () => { if (i < chars.length) { i = chars.length; fin(); } });
    el.querySelector('.brief-x').addEventListener('click', () => close(el, !force));
  }

  window.wirBrief = { test: () => show(true) };
  document.addEventListener('wir:started', () => setTimeout(() => show(false), 600));
})();
