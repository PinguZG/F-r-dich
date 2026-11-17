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

  function lily(x, y, r, rot, i) {
    const pt = (rr, f) => `<path d="M0 0C${rr * .42} ${-rr * .25} ${rr * .34} ${-rr * .8} 0 ${-rr}C${-rr * .34} ${-rr * .8} ${-rr * .42} ${-rr * .25} 0 0Z" fill="${f}"/>`;
    let s = `<g transform="translate(${x} ${y}) rotate(${rot})"><g class="bl-fl" data-i="${i}">`;
    for (let k = 0; k < 3; k++) s += `<g transform="rotate(${60 + k * 120})">${pt(r * .92, 'url(#blP2)')}</g>`;
    for (let k = 0; k < 3; k++) s += `<g transform="rotate(${k * 120})">${pt(r, 'url(#blP1)')}<path d="M0 ${-r * .1}L0 ${-r * .72}" stroke="#c93a80" stroke-width="1.5" opacity=".45" stroke-linecap="round"/></g>`;
    for (let k = 0; k < 6; k++) {
      const a = (k * 60 + 20) * Math.PI / 180, l = r * (.48 + (k % 2) * .08), px = Math.sin(a) * l, py = -Math.cos(a) * l;
      s += `<line x1="0" y1="0" x2="${px.toFixed(1)}" y2="${py.toFixed(1)}" stroke="#f2c14e" stroke-width="1.6"/><ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="3" ry="4.4" fill="#a02b63" transform="rotate(${k * 60 + 20} ${px.toFixed(1)} ${py.toFixed(1)})"/>`;
    }
    return s + '</g></g>';
  }
  function strauss() {
    const F = [[150, 112, 58, 0], [80, 150, 50, -36], [220, 150, 50, 36], [112, 218, 44, -16], [188, 218, 44, 16], [150, 176, 42, 4]];
    let st = '', fl = '';
    F.forEach((f, i) => {
      const [x, y, r, rot] = f;
      st += `<path class="bl-st" data-i="${i}" d="M150 350Q${(150 + x) / 2} ${(350 + y) / 2 + 20} ${x} ${y}" pathLength="1"/>`;
      fl += lily(x, y, r, rot, i);
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

  /* ---------- Code, der den Strauß "programmiert" ---------- */
  const CODE = [
    '// for_you.js  ♥',
    "import { Garden, Sky } from 'love';",
    '',
    'const garden = new Garden("pink");',
    'const sky = new Sky("night");',
    '',
    'garden.wrap("soft-paper");   @papier',
    'garden.stem(0).grow();       @s0',
    'garden.lily(0).bloom();      @f0',
    'garden.stem(1).grow();       @s1',
    'garden.lily(1).bloom();      @f1',
    'garden.stem(2).grow();       @s2',
    'garden.lily(2).bloom();      @f2',
    'garden.stem(3).grow();       @s3',
    'garden.lily(3).bloom();      @f3',
    'garden.stem(4).grow();       @s4',
    'garden.lily(4).bloom();      @f4',
    'garden.stem(5).grow();       @s5',
    'garden.lily(5).bloom();      @f5',
    '',
    'garden.ribbon("pink");       @bow',
    'sky.fireworks({',
    '  colors: ["#ff7ab8", "#c77dff"],',
    '  hearts: true,',
    '});                          @fw',
    '',
    'await sky.wait(1);',
    'letter.slideDown();          @letter',
    'letter.write("for you");',
    '// ♥ ♥ ♥'
  ].map(l => { const m = l.match(/\s+@(\w+)$/); return { t: m ? l.slice(0, m.index) : l, ev: m ? m[1] : '' }; });
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  function hl(s) {
    let o = '', i = 0, m; const re = /(\/\/.*$)|("[^"]*"?|'[^']*'?)|\b(const|new|await|import|from|true)\b|\b(\d+)\b|\b(\w+)(?=\()/g;
    while ((m = re.exec(s))) { o += esc(s.slice(i, m.index)); o += `<b class="${m[1] ? 'c' : m[2] ? 's' : m[3] ? 'k' : m[4] ? 'n' : 'f'}">${esc(m[0])}</b>`; i = re.lastIndex; }
    return o + esc(s.slice(i));
  }

  /* ---------- Feuerwerk (Raketen, Herz-Explosionen, Funkeln) ---------- */
  function engine(ov) {
    const cv = ov.querySelector('.bl-fw'), c = cv.getContext('2d'), dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0, parts = [], rockets = [], run = true, auto = null;
    function size() { W = ov.clientWidth; H = ov.clientHeight; cv.width = W * dpr; cv.height = H * dpr; c.setTransform(dpr, 0, 0, dpr, 0, 0); }
    size(); window.addEventListener('resize', size);
    const hue = () => [330, 345, 285, 310, 20, 45][Math.floor(Math.random() * 6)] + Math.random() * 16 - 8;
    function explode(x, y) {
      const h = hue(), heart = Math.random() < .4, n = heart ? 64 : 80;
      for (let i = 0; i < n; i++) {
        let vx, vy;
        if (heart) { const t = i / n * 6.283; vx = .2 * 16 * Math.pow(Math.sin(t), 3); vy = -.2 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)); }
        else { const a = Math.random() * 6.283, v = 1 + Math.random() * 3.8; vx = Math.cos(a) * v; vy = Math.sin(a) * v; }
        parts.push({ x, y, vx, vy, l: 1, d: .011 + Math.random() * .008, h: h + Math.random() * 14, g: heart ? .018 : .04, s: 2 });
      }
      for (let i = 0; i < 14; i++) parts.push({ x, y, vx: Math.random() * 2 - 1, vy: Math.random() * 2 - 1, l: 1, d: .03, h: 45, g: .02, s: 1.4, tw: 1 });
    }
    function launch() { const x = W * (.12 + Math.random() * .76); rockets.push({ x, y: H * .8, ty: H * (.1 + Math.random() * .28), vy: -(7 + Math.random() * 2) }); }
    function frame() {
      if (!run) return; requestAnimationFrame(frame);
      c.globalCompositeOperation = 'destination-out'; c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(0, 0, W, H);
      c.globalCompositeOperation = 'lighter';
      rockets = rockets.filter(r => {
        r.y += r.vy; r.vy *= .985;
        c.fillStyle = 'rgba(255,230,200,.9)'; c.beginPath(); c.arc(r.x, r.y, 2.2, 0, 6.283); c.fill();
        if (r.y <= r.ty || r.vy > -2.2) { explode(r.x, r.y); return false; } return true;
      });
      parts = parts.filter(p => p.l > 0);
      parts.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += p.g; p.vx *= .985; p.l -= p.d;
        const a = Math.max(p.l, 0) * (p.tw ? (Math.random() < .5 ? 1 : .3) : 1);
        c.fillStyle = `hsla(${p.h},95%,${62 + p.l * 18}%,${a})`; c.beginPath(); c.arc(p.x, p.y, p.s, 0, 6.283); c.fill();
      });
    }
    requestAnimationFrame(frame);
    return {
      fire() { launch(); setTimeout(launch, 200); auto = setInterval(() => { launch(); if (Math.random() < .5) setTimeout(launch, 160); }, 750); },
      sparkle(x, y) { for (let i = 0; i < 22; i++) { const a = Math.random() * 6.283, v = .6 + Math.random() * 2.2; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - .6, l: 1, d: .03, h: Math.random() < .5 ? 330 : 48, g: -.005, s: 1.6, tw: 1 }); } },
      stop() { run = false; clearInterval(auto); window.removeEventListener('resize', size); }
    };
  }

  /* ---------- Ablauf ---------- */
  function open() {
    if (document.getElementById('bl-ov') || !me()) return;
    const ov = document.createElement('div');
    ov.id = 'bl-ov'; ov.className = 's1';
    let bk = '';
    for (let i = 0; i < 12; i++) bk += `<i class="bl-bk" style="left:${Math.random() * 100}%;width:${30 + Math.random() * 80}px;height:${30 + Math.random() * 80}px;animation-delay:${-Math.random() * 14}s;animation-duration:${10 + Math.random() * 10}s;--h:${[320, 285, 340, 300][i % 4]}"></i>`;
    ov.innerHTML = `<div class="bl-rays"></div>${bk}
      <div class="bl-code" aria-hidden="true"><div class="bl-bar"><span></span><span></span><span></span><em>for_you.js</em></div><div class="bl-cb"><div class="bl-body"></div></div></div>
      <canvas class="bl-fw"></canvas>
      <button class="bl-x" type="button" aria-label="Schließen">${ICO_X}</button>
      <div class="bl-intro"><p class="bl-hint">For you my love 💗<small>Drück auf die Blume</small></p>
        <button class="bl-pick" type="button" aria-label="Blume drücken">${FIGUR}</button></div>
      <div class="bl-bq">${strauss()}</div>
      <div class="bl-letter"><p class="bl-t"></p></div>
      <button class="bl-env" type="button" aria-label="Brief einpacken">${ICO_MAIL}</button>`;
    document.body.appendChild(ov);
    mark();
    let fx = null, timers = [], tw = null, run = true;
    const later = (f, ms) => timers.push(setTimeout(f, ms));
    const end = () => { run = false; timers.forEach(clearTimeout); clearInterval(tw); if (fx) fx.stop(); ov.remove(); };
    ov.querySelector('.bl-x').addEventListener('click', () => { ov.classList.add('pack'); later(end, 500); });
    ov.querySelector('.bl-env').addEventListener('click', () => { ov.classList.add('pack'); later(end, 800); });
    ov.querySelector('.bl-pick').addEventListener('click', () => {
      if (!ov.classList.contains('s1')) return;
      ov.className = 's2'; fx = engine(ov); later(runCode, 900);
    }, { once: true });

    const EV = {
      papier() { ov.classList.add('e-papier'); },
      bow() { ov.classList.add('e-bow'); },
      fw() { fx.fire(); },
      letter() { later(() => { ov.classList.add('s3'); typeLetter(); }, 500); }
    };
    function bloomAt(i) {
      const f = ov.querySelector(`.bl-fl[data-i="${i}"]`); if (!f) return;
      f.classList.add('on'); later(() => { const r = f.getBoundingClientRect(); fx.sparkle(r.left + r.width / 2, r.top + r.height / 2); }, 450);
    }
    function runCode() {
      const body = ov.querySelector('.bl-body'), wrap = ov.querySelector('.bl-cb'), CPS = 115, PAUSE = 80;
      let li = 0, ci = 0, acc = 0, wait = 0, last = performance.now(), cur = null;
      function newLine() { const d = document.createElement('div'); d.className = 'bl-ln'; d.innerHTML = `<i>${li + 1}</i><span></span>`; body.appendChild(d); cur = d.lastChild; const over = body.scrollHeight - wrap.clientHeight + 16; body.style.transform = `translateY(${-Math.max(0, over)}px)`; }
      function tick(t) {
        if (!run) return; requestAnimationFrame(tick);
        const dt = Math.min(t - last, 60); last = t;
        if (li >= CODE.length) { cur.innerHTML = hl(CODE[CODE.length - 1].t) + '<u></u>'; return; }
        if (!cur) newLine();
        if (wait > 0) { wait -= dt; return; }
        acc += dt * CPS / 1000;
        const L = CODE[li];
        while (acc >= 1 && ci < L.t.length) { ci++; acc--; }
        cur.innerHTML = hl(L.t.slice(0, ci)) + '<u></u>';
        if (ci >= L.t.length) {
          cur.innerHTML = hl(L.t);
          const e = L.ev;
          if (e) { if (EV[e]) EV[e](); else if (e[0] === 's') ov.querySelector(`.bl-st[data-i="${e[1]}"]`).classList.add('on'); else if (e[0] === 'f') bloomAt(+e[1]); }
          li++; ci = 0; acc = 0; wait = L.t ? PAUSE : 20; cur = null;
          if (li >= CODE.length) { li = CODE.length; cur = body.lastChild.lastChild; }
        }
      }
      requestAnimationFrame(tick);
    }

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
