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

  const rnd = n => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };
  function lily(x, y, r, rot, i) {
    const L = r, W = r * .46, f = v => v.toFixed(1);
    const shape = `M0 0C${f(W * .9)} ${f(-L * .2)} ${f(W * 1.15)} ${f(-L * .62)} ${f(W * .18)} ${f(-L * .96)}Q0 ${f(-L * 1.05)} ${f(-W * .18)} ${f(-L * .96)}C${f(-W * 1.15)} ${f(-L * .62)} ${f(-W * .9)} ${f(-L * .2)} 0 0Z`;
    let s = `<g transform="translate(${x} ${y}) rotate(${rot})"><g class="bl-fl" data-i="${i}">`;
    for (let k = 0; k < 3; k++) s += `<g transform="rotate(${60 + k * 120}) scale(.95)"><path d="${shape}" fill="url(#blP2)" stroke="rgba(255,255,255,.22)" stroke-width=".8"/></g>`;
    for (let k = 0; k < 3; k++) {
      s += `<g transform="rotate(${k * 120})"><path d="${shape}" fill="url(#blP1)" stroke="rgba(255,255,255,.38)" stroke-width=".8"/>` +
        `<path d="M0 ${f(-L * .06)}Q${f(W * .08)} ${f(-L * .5)} 0 ${f(-L * .9)}M${f(-W * .16)} ${f(-L * .1)}Q${f(-W * .3)} ${f(-L * .45)} ${f(-W * .12)} ${f(-L * .85)}M${f(W * .16)} ${f(-L * .1)}Q${f(W * .3)} ${f(-L * .45)} ${f(W * .12)} ${f(-L * .85)}" stroke="#d63a8e" stroke-width="1" opacity=".35" fill="none"/>`;
      for (let j = 0; j < 9; j++) { const q = i * 31 + k * 7 + j; s += `<circle cx="${f((rnd(q) - .5) * W * .7)}" cy="${f(-L * (.16 + .5 * rnd(q + 50)))}" r="${f(.6 + rnd(q + 90) * 1.1)}" fill="#a21f66" opacity=".7"/>`; }
      s += '</g>';
    }
    s += `<circle r="${f(r * .26)}" fill="url(#blC)"/>`;
    for (let k = 0; k < 6; k++) {
      const a = (k * 60 + 20) * Math.PI / 180, l = r * (.5 + (k % 2) * .1), px = Math.sin(a) * l, py = -Math.cos(a) * l;
      s += `<path d="M0 0Q${f(px * .35)} ${f(py * .75)} ${f(px)} ${f(py)}" stroke="#ffe9a8" stroke-width="1.3" fill="none"/><ellipse cx="${f(px)}" cy="${f(py)}" rx="2.6" ry="4.2" fill="#d2661f" transform="rotate(${k * 60 + 20} ${f(px)} ${f(py)})"/>`;
    }
    return s + '</g></g>';
  }
  function strauss() {
    const F = [[160, 108, 64, 0], [78, 170, 54, -34], [242, 166, 54, 34], [112, 246, 46, -18], [208, 250, 46, 18], [160, 196, 42, 2]];
    let st = '', fl = '', lf = '', gr = '';
    F.forEach((q, i) => {
      const [x, y, r, rot] = q, d = `M${160 + (x - 160) * .05} 434C160 380 ${x - (x - 160) * .25} ${y + (372 - y) * .55} ${x} ${y + r * .1}`;
      st += `<path class="bl-st" data-i="${i}" d="${d}" pathLength="1" stroke="#17806a" stroke-width="5.5"/><path class="bl-st" data-i="${i}" d="${d}" pathLength="1" transform="translate(-1.3 0)" stroke="#8bffd8" stroke-opacity=".5" stroke-width="1.3"/>`;
      fl += lily(x, y, r, rot, i);
    });
    const LV = [[-78, 74], [-62, 96], [-46, 112], [-30, 120], [-14, 104], [12, 108], [28, 118], [44, 110], [60, 94], [76, 72], [-52, 70], [50, 72]];
    LV.forEach(([rot, len], k) => {
      const ln = len, fillI = k % 2 ? 'blL1' : 'blL2';
      lf += `<g transform="translate(160 392) rotate(${rot})"><g class="bl-lf" style="--d:${(k * .07).toFixed(2)}s"><path d="M0 0C${ln * .34} ${-ln * .22} ${ln * .36} ${-ln * .72} 0 ${-ln}C${-ln * .36} ${-ln * .72} ${-ln * .34} ${-ln * .22} 0 0Z" fill="url(#${fillI})" stroke="rgba(160,255,230,.35)" stroke-width=".8"/><path d="M0 0L0 ${-ln * .9}" stroke="rgba(200,255,240,.45)" stroke-width="1"/></g></g>`;
    });
    const bl = (x, h, bend, w) => `<path d="M${x - w} 440Q${x + bend * .3} ${440 - h * .55} ${x + bend} ${440 - h}Q${x + bend * .45 + w} ${440 - h * .5} ${x + w} 440Z" fill="url(#blG)"/>`;
    [8, 20, 32, 46, 58, 72].forEach((x, k) => { gr += bl(x, 70 + rnd(k + 3) * 100, -14 - rnd(k + 9) * 22, 3.2); });
    [250, 262, 276, 290, 302, 314].forEach((x, k) => { gr += bl(x, 70 + rnd(k + 13) * 100, 14 + rnd(k + 19) * 22, 3.2); });
    return `<svg viewBox="0 0 320 440" aria-hidden="true"><defs>
      <radialGradient id="blP1" cx="50%" cy="100%" r="105%"><stop offset="0" stop-color="#f6ffb0"/><stop offset=".16" stop-color="#ffe9f3"/><stop offset=".55" stop-color="#ff8ec8"/><stop offset="1" stop-color="#d1307f"/></radialGradient>
      <radialGradient id="blP2" cx="50%" cy="100%" r="105%"><stop offset="0" stop-color="#ffd9ee"/><stop offset=".6" stop-color="#e5589f"/><stop offset="1" stop-color="#9c1f63"/></radialGradient>
      <radialGradient id="blC"><stop offset="0" stop-color="#f4ff9a"/><stop offset=".5" stop-color="#d8ff70" stop-opacity=".7"/><stop offset="1" stop-color="#d8ff70" stop-opacity="0"/></radialGradient>
      <linearGradient id="blL1" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#06352f"/><stop offset="1" stop-color="#2fd6b4" stop-opacity=".9"/></linearGradient>
      <linearGradient id="blL2" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#0a4a3b"/><stop offset="1" stop-color="#58e08a" stop-opacity=".85"/></linearGradient>
      <linearGradient id="blG" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#05301f"/><stop offset="1" stop-color="#3ee26f"/></linearGradient>
      <linearGradient id="blR" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb3d9"/><stop offset="1" stop-color="#c2307e"/></linearGradient></defs>
      <g class="bl-gr">${gr}</g>
      <g fill="none" stroke-linecap="round">${st}</g>
      ${lf}
      <g class="bl-schleife"><path d="M160 384C124 346 100 384 128 404C142 410 154 396 160 388ZM160 384C196 346 220 384 192 404C178 410 166 396 160 388Z" fill="url(#blR)"/><path d="M158 390L140 436L154 426L160 438ZM162 390L180 436L166 426L160 438Z" fill="url(#blR)" opacity=".92"/><circle cx="160" cy="388" r="8" fill="#e0559b"/><path d="M132 392Q140 384 152 386" stroke="rgba(255,255,255,.55)" stroke-width="1.4" fill="none"/></g>
      ${fl}</svg>`;
  }
  const ICO_X = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const ICO_MAIL = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3.5 7l8.5 6 8.5-6"/></svg>';

  /* ---------- Terminal-Hintergrund (läuft wie ein echter Mac-Terminal-Lauf) ---------- */
  const P = 'daniel@Mac';
  const CODE = (() => {
    let n = .08; const T = () => { n += .13 + Math.random() * .09; return '[00:' + n.toFixed(2).padStart(5, '0') + '] '; };
    const o = (t, ev, cps, cmd) => ({ t, ev: ev || '', cps: cps || 0, cmd: !!cmd });
    const a = [
      o('Last login: Tue Nov 17 20:41:07 on ttys000', '', 1200),
      o(`${P} ~ % cd ~/for-you`, '', 0, 1),
      o(`${P} for-you % node bloom.js --pink`, '', 0, 1),
      o(T() + '✔ loading garden .............. ok'),
      o(T() + '✔ wrapping bouquet ........... ok', 'papier')
    ];
    for (let i = 0; i < 6; i++) { a.push(o(T() + `stem[${i}]  ██████████ 100%`, 's' + i)); a.push(o(T() + `lily[${i}]  bloom ✿            ✔`, 'f' + i)); }
    a.push(o(T() + '✔ tying ribbon .............. ok', 'bow'));
    a.push(o(T() + '✦ launching fireworks ....... ok', 'fw'));
    a.push(o(T() + '✉ opening letter ............ ok', 'letter'));
    a.push(o(`${P} for-you % `, '', 1200));
    return a;
  })();
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  function hl(s) {
    let o = '', i = 0, m; const re = /^(Last login:.*)$|^(\w+@\w+ [^%]*%)|(\[\d\d:\d\d\.\d\d\])|(✔|\bok\b|100%)|(✿|✦|✉|█+)|(\bstem\[\d\]|\blily\[\d\])/g;
    const C = ['', 'c', 'p', 'd', 'g', 'x', 'f'];
    while ((m = re.exec(s))) { o += esc(s.slice(i, m.index)); let k = 1; while (!m[k]) k++; o += `<b class="${C[k]}">${esc(m[0])}</b>`; i = re.lastIndex; }
    return o + esc(s.slice(i));
  }

  /* ---------- Feuerwerk (Raketen, Herz-Explosionen, Funkeln) ---------- */
  function engine(ov) {
    const cv = ov.querySelector('.bl-fw'), c = cv.getContext('2d'), dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0, parts = [], rockets = [], run = true, auto = null;
    const amb = Array.from({ length: 30 }, () => ({ x: Math.random(), y: Math.random(), vx: (Math.random() - .5) * .0004, vy: -.0002 - Math.random() * .0006, ph: Math.random() * 6.28, h: Math.random() < .55 ? 170 : 330 }));
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
      amb.forEach(q => { q.x += q.vx; q.y += q.vy; q.ph += .03; if (q.y < -.02) { q.y = 1.02; q.x = Math.random(); } const al = .3 + .3 * Math.sin(q.ph); c.fillStyle = `hsla(${q.h},90%,72%,${al})`; c.beginPath(); c.arc(q.x * W, q.y * H, 1.7, 0, 6.283); c.fill(); c.fillStyle = `hsla(${q.h},90%,72%,${al * .14})`; c.beginPath(); c.arc(q.x * W, q.y * H, 6, 0, 6.283); c.fill(); });
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
    for (let i = 0; i < 12; i++) bk += `<i class="bl-bk" style="left:${Math.random() * 100}%;width:${30 + Math.random() * 80}px;height:${30 + Math.random() * 80}px;animation-delay:${-Math.random() * 14}s;animation-duration:${10 + Math.random() * 10}s;--h:${[320, 175, 340, 190][i % 4]}"></i>`;
    ov.innerHTML = `<div class="bl-glow"></div>${bk}
      <div class="bl-term" aria-hidden="true"><div class="bl-bar"><span></span><span></span><span></span><em>daniel — zsh — 80×24</em></div><div class="bl-cb"><div class="bl-body"></div></div></div>
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
      const body = ov.querySelector('.bl-body'), wrap = ov.querySelector('.bl-cb');
      let li = 0, ci = 0, acc = 0, wait = 0, last = performance.now(), cur = null;
      function newLine() { const d = document.createElement('div'); d.className = 'bl-ln'; d.innerHTML = `<i>${li + 1}</i><span></span>`; body.appendChild(d); cur = d.lastChild; const over = body.scrollHeight - wrap.clientHeight + 16; body.style.transform = `translateY(${-Math.max(0, over)}px)`; }
      function tick(t) {
        if (!run) return; requestAnimationFrame(tick);
        const dt = Math.min(t - last, 60); last = t;
        if (li >= CODE.length) { cur.innerHTML = hl(CODE[CODE.length - 1].t) + '<u></u>'; return; }
        if (!cur) newLine();
        if (wait > 0) { wait -= dt; return; }
        const L = CODE[li]; acc += dt * (L.cps || (L.cmd ? 55 : 300)) / 1000;
        while (acc >= 1 && ci < L.t.length) { ci++; acc--; }
        cur.innerHTML = hl(L.t.slice(0, ci)) + '<u></u>';
        if (ci >= L.t.length) {
          cur.innerHTML = hl(L.t);
          const e = L.ev;
          if (e) { if (EV[e]) EV[e](); else if (e[0] === 's') ov.querySelector(`.bl-st[data-i="${e[1]}"]`).classList.add('on'); else if (e[0] === 'f') bloomAt(+e[1]); }
          li++; ci = 0; acc = 0; wait = L.cmd ? 300 : 60; cur = null;
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
