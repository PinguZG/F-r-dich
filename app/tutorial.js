/* Einmaliges Tutorial nach dem Umbau auf das Seitenmenü: Sprechblase tippt, Augen schauen nach unten, Pause, Pfeil zum Menü-Pfeil. */
(() => {
  const KEY = 'wir-tut-menu-v1';
  const seen = () => { try { return !!localStorage.getItem(KEY); } catch (_) { return false; } };
  const mark = () => { try { localStorage.setItem(KEY, '1'); } catch (_) {} };
  if (seen()) return;
  const b = document.body;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  let running = false;

  const ready = () => b.classList.contains('in-app') && !b.classList.contains('chat-open') && !b.classList.contains('zh-full')
    && !b.classList.contains('drawing') && !b.classList.contains('nav-open') && !document.querySelector('.cl-back');

  async function run() {
    if (running) return; running = true;
    const el = document.createElement('div'); el.className = 'tut';
    el.innerHTML = '<div class="tut-arrow"><svg viewBox="0 0 44 36" aria-hidden="true"><path d="M40 18H6M16 7 5 18l11 11"/></svg></div>'
      + '<div class="tut-bubble" role="status"><div class="tut-eyes"><span class="tut-eye"><i></i></span><span class="tut-eye"><i></i></span></div>'
      + '<div class="tut-txt typing"></div><div class="tut-hint">Tippe irgendwo, um zu schließen</div></div>';
    b.append(el);
    const txt = el.querySelector('.tut-txt');
    let finished = false, closed = false;
    const close = () => { if (closed) return; closed = true; mark(); el.remove(); };
    el.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); if (finished) close(); });
    const type = async s => {
      txt.textContent = ''; txt.classList.add('typing');
      for (const ch of s) { if (closed) return; txt.textContent += ch; await wait(/[.,!?]/.test(ch) ? 260 : 55); }
      txt.classList.remove('typing');
    };
    await wait(500);
    await type('Hmm … wo ist denn die Leiste unten hin?');
    await wait(1000);
    if (closed) return;
    el.classList.add('arrow');
    await type('Die steckt jetzt im Menü. Tipp auf den kleinen Pfeil am linken Rand, dann klappt es raus.');
    finished = true; el.classList.add('done');
  }

  const tryStart = () => { if (!running && !seen() && ready()) setTimeout(() => { if (ready()) run(); else running = false; }, 900); };
  new MutationObserver(tryStart).observe(b, { attributes: true, attributeFilter: ['class'], childList: true });
  tryStart();
})();
