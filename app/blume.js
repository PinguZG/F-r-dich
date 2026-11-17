/* "For you my love": Strichfigur mit Blumenstrauß -> Tipp -> Code-Regen (geblurt), pinke Lilien + Feuerwerk -> Brief fährt runter.
   Startet einmal beim App-Start (pro Gerät) und ist jederzeit unter Wir zwei > "For you my love" abspielbar. */
(function () {
  const FUER = /daniel/i; // TEST: nur Daniel. Für Ida später /ida/i.
  const ID = 'blume-1';
  const LETTER = 'Hey du, das hier ist nur ein Testtext, der Buchstabe für Buchstabe erscheint. Wenn du das liest, funktioniert die Schreibmaschine. Schön, dass es dich gibt, und jetzt pack mich ein.'; // <- hier später den echten Brief eintragen
  const SPEED = 42; // ms pro Zeichen
  const me = () => (window.WIR_PB && (WIR_PB.authStore.record || WIR_PB.authStore.model)) || null;
  const isTarget = () => { const u = me(); return !!u && (FUER.test(u.name || '') || FUER.test(u.email || '')); };
  const key = () => 'wir-' + ID + '-' + (me() ? me().id : '');
  const seen = () => { try { return !!localStorage.getItem(key()); } catch (e) { return false; } };
  const mark = () => { try { localStorage.setItem(key(), '1'); } catch (e) {} };

  /* ---------- Zeichnungen ---------- */
  const FIGUR = `<svg viewBox="0 0 300 300" aria-hidden="true">
    <path class="bl-body" d="M38 300Q46 222 84 196M190 300Q192 226 204 190" fill="none" stroke="#111" stroke-width="11" stroke-linecap="round"/>
    <path class="bl-body" d="M176 252L256 222" fill="none" stroke="#111" stroke-width="12" stroke-linecap="round"/>
    <path d="M30 150C22 70 80 36 128 40C186 44 206 100 196 170C190 210 130 214 90 196C50 186 34 176 30 150Z" fill="#fff" stroke="#111" stroke-width="10" stroke-linejoin="round"/>
    <ellipse cx="86" cy="128" rx="9" ry="11" fill="#111"/><ellipse cx="136" cy="118" rx="9" ry="11" fill="#111"/>
    <ellipse cx="58" cy="152" rx="18" ry="9" fill="#f6c6c6"/><ellipse cx="150" cy="140" rx="17" ry="9" fill="#f6c6c6"/>
    <path d="M96 160Q112 172 128 158" fill="none" stroke="#111" stroke-width="6" stroke-linecap="round"/>
    <g class="bl-strauss">
      <path d="M262 214L246 134M262 214L274 140M262 214L232 150" stroke="#4d7a2f" stroke-width="5" stroke-linecap="round"/>
      <path d="M236 160Q214 150 208 126Q232 130 240 150ZM268 150Q292 138 292 114Q268 120 262 144Z" fill="#3f8a3a"/>
      <g fill="#c8102e"><circle cx="232" cy="96" r="22"/><circle cx="268" cy="92" r="21"/><circle cx="250" cy="66" r="22"/><circle cx="214" cy="118" r="19"/><circle cx="276" cy="124" r="19"/><circle cx="246" cy="122" r="21"/></g>
      <g fill="none" stroke="#7d0a1d" stroke-width="2.4" stroke-linecap="round"><path d="M226 96q6-8 12 0q-6 6-10-2M262 92q6-8 12 0q-6 6-10-2M244 66q6-8 12 0q-6 6-10-2M240 122q6-8 12 0q-6 6-10-2M208 118q5-7 10 0q-5 5-8-2M270 124q5-7 10 0q-5 5-8-2"/></g>
      <rect x="254" y="208" width="16" height="9" rx="3" fill="#e0223f"/>
    </g></svg>`;

  function lily(x, y, r, rot, delay) {
    const pt = (rr, f) => `<path d="M0 0C${rr * .42} ${-rr * .25} ${rr * .34} ${-rr * .8} 0 ${-rr}C${-rr * .34} ${-rr * .8} ${-rr * .42} ${-rr * .25} 0 0Z" fill="${f}"/>`;
    let s = `<g transform="translate(${x} ${y}) rotate(${rot})"><g class="bl-fl" style="animation-delay:${delay}s">`;
    for (let i = 0; i < 3; i++) s += `<g transform="rotate(${60 + i * 120})">${pt(r * .92, 'url(#blP2)')}</g>`;
    for (let i = 0; i < 3; i++) s += `<g transform="rotate(${i * 120})">${pt(r, 'url(#blP1)')}<path d="M0 ${-r * .1}L0 ${-r * .72}" stroke="#c93a80" stroke-width="1.5" opacity=".45" stroke-linecap="round"/></g>`;
    for (let i = 0; i < 6; i++) {
      const a = (i * 60 + 20) * Math.PI / 180, l = r * (.48 + (i % 2) * .08), px = Math.sin(a) * l, py = -Math.cos(a) * l;
      s += `<line x1="0" y1="0" x2="${px.toFixed(1)}" y2="${py.toFixed(1)}" stroke="#f2c14e" stroke-width="1.6"/><ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="3" ry="4.4" fill="#a02b63" transform="rotate(${i * 60 + 20} ${px.toFixed(1)} ${py.toFixed(1)})"/>`;
    }
    return s + '</g></g>';
  }
  function strauss() {
    const F = [[150, 112, 58, 0, 1.7], [80, 150, 50, -36, 2.0], [220, 150, 50, 36, 2.3], [112, 218, 44, -16, 2.6], [188, 218, 44, 16, 2.9], [150, 176, 42, 4, 3.2]];
    let st = '', fl = '';
    F.forEach((f, i) => {
      const [x, y, r, rot, d] = f;
      st += `<path class="bl-st" d="M150 350Q${(150 + x) / 2} ${(350 + y) / 2 + 20} ${x} ${y}" pathLength="1" style="animation-delay:${.9 + i * .12}s"/>`;
      fl += lily(x, y, r, rot, d);
    });
    return `<svg viewBox="0 0 300 380" aria-hidden="true"><defs>
      <radialGradient id="blP1" cx="50%" cy="100%" r="100%"><stop offset="0" stop-color="#ffe3f1"/><stop offset=".55" stop-color="#ff9ccb"/><stop offset="1" stop-color="#e45a9f"/></radialGradient>
      <radialGradient id="blP2" cx="50%" cy="100%" r="100%"><stop offset="0" stop-color="#ffd0e8"/><stop offset="1" stop-color="#c94b93"/></radialGradient></defs>
      <g class="bl-papier"><path d="M64 250L236 250L170 356L130 356Z" fill="rgba(255,240,248,.82)" stroke="rgba(255,255,255,.7)"/></g>
      <g fill="none" stroke="#5aa05a" stroke-width="5" stroke-linecap="round">${st}</g>
      <g fill="#46a04f" class="bl-blatt"><path d="M150 290Q92 276 76 230Q130 236 150 290Z"/><path d="M150 290Q208 276 224 230Q170 236 150 290Z"/></g>
      ${fl}
      <g class="bl-schleife"><path d="M150 300Q120 280 116 306Q130 318 150 302ZM150 300Q180 280 184 306Q170 318 150 302Z" fill="#ff7ab8"/><circle cx="150" cy="302" r="7" fill="#e0559b"/></g></svg>`;
  }
  const ICO_X = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const ICO_MAIL = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3.5 7l8.5 6 8.5-6"/></svg>';

  /* ---------- Effekte ---------- */
  function start(ov) {
    const rain = ov.querySelector('.bl-rain'), fw = ov.querySelector('.bl-fw');
    const rc = rain.getContext('2d'), fc = fw.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0, cols = [], parts = [], run = true, fwOn = false, last = 0;
    const GL = '♥✿01{}<>/=;ABCDEF♡'.split('');
    function size() {
      W = ov.clientWidth; H = ov.clientHeight;
      [rain, fw].forEach(c => { c.width = W * dpr; c.height = H * dpr; });
      rc.setTransform(dpr, 0, 0, dpr, 0, 0); fc.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Array.from({ length: Math.ceil(W / 18) }, () => Math.random() * -H / 16);
    }
    size(); window.addEventListener('resize', size);
    function burst() {
      const x = W * (.12 + Math.random() * .76), y = H * (.1 + Math.random() * .4);
      const hue = [330, 345, 285, 310, 45][Math.floor(Math.random() * 5)];
      for (let i = 0; i < 70; i++) {
        const a = Math.random() * 6.283, v = 1 + Math.random() * 3.6;
        parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 1, h: hue + Math.random() * 20 - 10 });
      }
    }
    function frame(t) {
      if (!run) return;
      requestAnimationFrame(frame);
      if (t - last > 55) { // Code-Regen
        last = t;
        rc.fillStyle = 'rgba(14,6,24,.16)'; rc.fillRect(0, 0, W, H);
        rc.font = '16px monospace';
        cols.forEach((y, i) => {
          rc.fillStyle = Math.random() < .12 ? '#fff' : (Math.random() < .5 ? '#ff7ab8' : '#c77dff');
          rc.fillText(GL[Math.floor(Math.random() * GL.length)], i * 18, y * 16);
          cols[i] = (y * 16 > H && Math.random() > .96) ? 0 : y + 1;
        });
      }
      fc.globalCompositeOperation = 'destination-out'; fc.fillStyle = 'rgba(0,0,0,.2)'; fc.fillRect(0, 0, W, H);
      fc.globalCompositeOperation = 'lighter';
      if (fwOn && Math.random() < .035) burst();
      parts = parts.filter(p => p.l > 0);
      parts.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += .04; p.vx *= .985; p.l -= .014;
        fc.fillStyle = `hsla(${p.h},95%,${60 + p.l * 20}%,${Math.max(p.l, 0)})`;
        fc.beginPath(); fc.arc(p.x, p.y, 2, 0, 6.283); fc.fill();
      });
    }
    requestAnimationFrame(frame);
    return { fire() { fwOn = true; burst(); setTimeout(burst, 250); }, stop() { run = false; window.removeEventListener('resize', size); } };
  }

  /* ---------- Ablauf ---------- */
  function open() {
    if (document.getElementById('bl-ov') || !me()) return;
    const ov = document.createElement('div');
    ov.id = 'bl-ov'; ov.className = 's1';
    ov.innerHTML = `<canvas class="bl-rain"></canvas><canvas class="bl-fw"></canvas>
      <button class="bl-x" type="button" aria-label="Schließen">${ICO_X}</button>
      <div class="bl-intro"><p class="bl-hint">For you my love 💗<small>Drück auf die Blume</small></p>
        <button class="bl-pick" type="button" aria-label="Blume drücken">${FIGUR}</button></div>
      <div class="bl-bq">${strauss()}</div>
      <div class="bl-letter"><p class="bl-t"></p></div>
      <button class="bl-env" type="button" aria-label="Brief einpacken">${ICO_MAIL}</button>`;
    document.body.appendChild(ov);
    mark();
    let fx = null, timers = [], tw = null;
    const later = (f, ms) => timers.push(setTimeout(f, ms));
    const end = () => { timers.forEach(clearTimeout); clearInterval(tw); if (fx) fx.stop(); ov.remove(); };
    ov.querySelector('.bl-x').addEventListener('click', () => { ov.classList.add('pack'); later(end, 500); });
    ov.querySelector('.bl-env').addEventListener('click', () => { ov.classList.add('pack'); later(end, 800); });
    ov.querySelector('.bl-pick').addEventListener('click', () => {
      if (!ov.classList.contains('s1')) return;
      ov.className = 's2'; fx = start(ov);
      later(() => fx.fire(), 1500);
      later(() => { ov.classList.add('s3'); typeLetter(); }, 6200);
    }, { once: true });

    function typeLetter() {
      const p = ov.querySelector('.bl-t'), ch = Array.from(LETTER); let i = 0;
      const fin = () => { clearInterval(tw); p.textContent = LETTER; ov.classList.add('fertig'); };
      later(() => {
        tw = setInterval(function tick() {
          i++; p.textContent = ch.slice(0, i).join('');
          if (i >= ch.length) return fin();
          if (/[.,!?]/.test(ch[i - 1])) { clearInterval(tw); later(() => { tw = setInterval(tick, SPEED); }, 280); }
        }, SPEED);
      }, 1100);
      ov.querySelector('.bl-letter').addEventListener('click', fin);
    }
  }

  function wire() {
    const sec = document.getElementById('blSection'), btn = document.getElementById('blOpen');
    if (sec && isTarget()) sec.hidden = false;
    if (btn && !btn.dataset.w) { btn.dataset.w = 1; btn.addEventListener('click', open); }
  }
  window.wirBlume = { open };
  document.addEventListener('wir:started', () => { wire(); if (isTarget() && !seen()) setTimeout(open, 700); });
})();
