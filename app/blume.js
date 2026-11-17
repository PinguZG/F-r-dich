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
  function butter() {
    const wing = (up, lo, ed) => `<path d="M0 -1C4 -15 19 -16 16 -3C15 2 6 3 0 0Z" fill="url(#${up})" stroke="${ed}" stroke-width=".6"/><path d="M0 0C9 2 15 7 11 13C7 16 1 10 0 3Z" fill="url(#${lo})" stroke="${ed}" stroke-width=".6"/><circle cx="10" cy="-8" r="1.8" fill="rgba(255,255,255,.55)"/>`;
    const bf = (cls, up, lo, ed) => `<g class="bfp" transform="translate(-100 -100)"><g class="bf ${cls}"><g class="bt"><g class="wl"><g transform="scale(-1 1)">${wing(up, lo, ed)}</g></g><g class="wr">${wing(up, lo, ed)}</g><ellipse cx="0" cy="0" rx="1.4" ry="7.5" fill="#2a1a3a"/><path d="M-.8 -7Q-3 -12 -5 -13M.8 -7Q3 -12 5 -13" stroke="#2a1a3a" stroke-width=".6" fill="none"/></g></g></g>`;
    return `<defs><linearGradient id="blB1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e3d6ff"/></linearGradient>
      <linearGradient id="blB2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#ffd9ec"/></linearGradient>
      <linearGradient id="blB3" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb347"/><stop offset="1" stop-color="#ff7a1a"/></linearGradient>
      <linearGradient id="blB4" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd27a"/><stop offset="1" stop-color="#ff9a3c"/></linearGradient></defs>
      ${bf('bf1', 'blB1', 'blB2', 'rgba(120,90,170,.55)')}${bf('bf2', 'blB3', 'blB4', '#5a2a05')}
      <g class="bl-usg"><path d="M0 4c-3-5-10-2-6 3c1.5 2 4 4 6 5.5c2-1.5 4.5-3.5 6-5.5c4-5-3-8-6-3z" fill="#ff6fae" transform="translate(160 30) scale(1.6)"/>
      <text x="160" y="22" text-anchor="middle" font-family="Caveat,cursive" font-size="36" font-weight="700" fill="#fff" stroke="#1a0a24" stroke-width="4" paint-order="stroke">us</text></g>`;
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
      ${fl}${butter()}</svg>`;
  }
  const ICO_X = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const ICO_DOWN = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
  const ICO_ENV = '<svg viewBox="0 0 64 64" width="46" height="46" aria-hidden="true"><rect x="8" y="22" width="48" height="34" rx="5" fill="#b83a78"/><rect class="bl-pap" x="15" y="20" width="34" height="26" rx="2" fill="#fff"/><path d="M10 55L32 36L54 55Z" fill="#e0559b"/><path class="bl-flap" d="M8 22L32 41L56 22Z" fill="#ff8ec8"/></svg>';
  const ICO_MAIL = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3.5 7l8.5 6 8.5-6"/></svg>';

  /* ---------- Hintergrund: schnell durchlaufender Code in echten VS-Code-Dark+-Farben ---------- */
  const SNIPS = [
    ['shader.frag', `#version 460 core
uniform vec3 uCam;
uniform float uTime;
out vec4 frag;

float sdSphere(vec3 p, float r) {
  return length(p) - r;
}

vec3 march(vec3 ro, vec3 rd) {
  float t = 0.0;
  for (int i = 0; i < 128; i++) {
    vec3 p = ro + rd * t;
    float d = sdSphere(p, 1.0);
    if (d < 0.001) break;
    t += d * 0.9;
  }
  return vec3(t * 0.12);
}`],
    ['stream.ts', `export async function* stream<T>(
  src: AsyncIterable<T>,
  size = 64
) {
  const buf: T[] = [];
  for await (const x of src) {
    buf.push(x);
    if (buf.length >= size) {
      yield buf.splice(0, size);
    }
  }
  if (buf.length) yield buf;
}`],
    ['packet.rs', `use std::sync::Arc;
use tokio::sync::mpsc;

#[derive(Debug, Clone)]
pub struct Packet {
    pub id: u64,
    pub payload: Vec<u8>,
}

impl Packet {
    pub fn checksum(&self) -> u32 {
        self.payload.iter()
            .fold(0x811c9dc5, |h, b| {
                (h ^ *b as u32)
                    .wrapping_mul(16777619)
            })
    }
}`],
    ['layer.py', `import numpy as np

class Dense:
    def __init__(self, n_in, n_out):
        self.w = np.random.randn(n_in, n_out)
        self.w *= np.sqrt(2.0 / n_in)
        self.b = np.zeros((1, n_out))

    def forward(self, x):
        self.x = x
        return np.maximum(0, x @ self.w + self.b)

    def backward(self, g, lr=1e-3):
        g = g * (self.x @ self.w > 0)
        self.w -= lr * self.x.T @ g
        return g @ self.w.T`],
    ['worker.go', `func worker(id int, jobs <-chan Job,
    out chan<- Result) {
  for j := range jobs {
    r := j.Run()
    select {
    case out <- r:
    case <-time.After(2 * time.Second):
      log.Printf("w%d timeout", id)
    }
  }
}

func main() {
  jobs := make(chan Job, 256)
  go worker(1, jobs, results)
}`],
    ['gl.js', `const gl = canvas.getContext("webgl2");
const prog = link(gl, VERT, FRAG);
const uTime = gl.getUniformLocation(prog, "t");
gl.useProgram(prog);

function frame(t) {
  gl.clearColor(0.05, 0.02, 0.1, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform1f(uTime, t * 0.001);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);`],
    ['spring.tsx', `export function useSpring(target: number) {
  const [v, setV] = useState(target);
  const vel = useRef(0);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const f = (target - v) * 0.12;
      vel.current = vel.current * 0.8 + f;
      setV(x => x + vel.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
}`],
    ['hash.c', `#include <stdint.h>
#include <stddef.h>

static uint32_t rotl(uint32_t x, int k) {
  return (x << k) | (x >> (32 - k));
}

uint32_t murmur(const uint8_t *p, size_t n) {
  uint32_t h = 0x9747b28c;
  for (size_t i = 0; i < n; i++) {
    h ^= p[i] * 0xcc9e2d51;
    h = rotl(h, 13) * 5 + 0xe6546b64;
  }
  return h ^ (h >> 16);
}`]
  ];
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const KW_S = new Set('const let var function class struct enum union fn pub impl trait mod use type interface namespace new static void int float double bool char long short unsigned signed auto def lambda self this extends implements typeof instanceof in of as mut async uniform out layout'.split(' '));
  const KW_C = new Set('if else for while return break continue switch case default try catch throw await yield import export from do match go select defer finally with pass raise elif and or not'.split(' '));
  const KW_L = new Set('true false null undefined None True False nil'.split(' '));
  const TY = new Set('string number boolean any never u8 u16 u32 u64 i32 i64 f32 f64 usize str vec2 vec3 vec4 mat4 uint32_t size_t uint8_t'.split(' '));
  function hl(s) {
    let o = '', i = 0, m; const re = /(\/\/.*$)|("(?:\\.|[^"\\])*"?|'(?:\\.|[^'\\])*'?|`[^`]*`?)|(^\s*#\w+)|(\b0x[0-9a-fA-F]+\b|\b\d+(?:\.\d+)?f?\b)|([A-Za-z_]\w*)/g;
    while ((m = re.exec(s))) {
      o += esc(s.slice(i, m.index)); let c = '';
      if (m[1]) c = 'c'; else if (m[2]) c = 's'; else if (m[3]) c = 'q'; else if (m[4]) c = 'n';
      else {
        const w = m[5], nx = s.slice(re.lastIndex).match(/^\s*\(/);
        if (KW_C.has(w)) c = 'q'; else if (KW_S.has(w) || KW_L.has(w) || TY.has(w)) c = 'k';
        else if (nx) c = 'f'; else if (/^[A-Z][a-z]/.test(w)) c = 't'; else if (/^[A-Z][A-Z0-9_]+$/.test(w)) c = 'z'; else c = 'v';
      }
      o += `<b class="${c}">${esc(m[0])}</b>`; i = re.lastIndex;
    }
    return o + esc(s.slice(i));
  }
  function* codeStream() {
    let last = -1;
    for (;;) {
      let k; do { k = Math.floor(Math.random() * SNIPS.length); } while (k === last); last = k;
      yield { file: SNIPS[k][0], lines: SNIPS[k][1].split('\n') };
    }
  }

  /* ---------- Feuerwerk (Raketen, Herz-Explosionen, Funkeln) ---------- */
  function engine(ov) {
    const cv = ov.querySelector('.bl-fw'), c = cv.getContext('2d'), dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0, parts = [], rockets = [], run = true, auto = null;
    const amb = Array.from({ length: 12 }, () => ({ x: Math.random(), y: Math.random(), vx: (Math.random() - .5) * .0004, vy: -.0002 - Math.random() * .0006, ph: Math.random() * 6.28, h: Math.random() < .55 ? 170 : 330 }));
    function size() { W = ov.clientWidth; H = ov.clientHeight; cv.width = W * dpr; cv.height = H * dpr; c.setTransform(dpr, 0, 0, dpr, 0, 0); }
    size(); window.addEventListener('resize', size);
    const hue = () => [330, 345, 285, 310, 20, 45][Math.floor(Math.random() * 6)] + Math.random() * 16 - 8;
    function explode(x, y) {
      const h = hue(), heart = Math.random() < .4, n = heart ? 56 : 60;
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
      amb.forEach(q => { q.x += q.vx; q.y += q.vy; q.ph += .03; if (q.y < -.02) { q.y = 1.02; q.x = Math.random(); } const al = .3 + .3 * Math.sin(q.ph); c.fillStyle = `hsla(${q.h},90%,72%,${al})`; c.beginPath(); c.arc(q.x * W, q.y * H, 1.7, 0, 6.283); c.fill(); });
      parts = parts.filter(p => p.l > 0);
      parts.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += p.g; p.vx *= .985; p.l -= p.d;
        const a = Math.max(p.l, 0) * (p.tw ? (Math.random() < .5 ? 1 : .3) : 1);
        c.fillStyle = `hsla(${p.h},95%,${62 + p.l * 18}%,${a})`; c.beginPath(); c.arc(p.x, p.y, p.s, 0, 6.283); c.fill();
      });
    }
    requestAnimationFrame(frame);
    return {
      fire() { launch(); auto = setInterval(launch, 1700); },
      calm() { clearInterval(auto); },
      sparkle(x, y) { for (let i = 0; i < 22; i++) { const a = Math.random() * 6.283, v = .6 + Math.random() * 2.2; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - .6, l: 1, d: .03, h: Math.random() < .5 ? 330 : 48, g: -.005, s: 1.6, tw: 1 }); } },
      stop() { run = false; clearInterval(auto); window.removeEventListener('resize', size); }
    };
  }

  /* ---------- Ablauf ---------- */
  function open() {
    if (document.getElementById('bl-ov') || !me()) return;
    const ov = document.createElement('div');
    ov.id = 'bl-ov'; ov.className = 's1';
    ov.innerHTML = `<div class="bl-term" aria-hidden="true"><div class="bl-bar"><span></span><span></span><span></span><em>for-you</em></div><div class="bl-cb"><div class="bl-body"></div></div></div>
      <canvas class="bl-fw"></canvas>
      <button class="bl-x" type="button" aria-label="Schließen">${ICO_X}</button>
      <div class="bl-intro"><p class="bl-hint">For you my love 💗<small>Drück auf die Blume</small></p>
        <button class="bl-pick" type="button" aria-label="Blume drücken">${FIGUR}</button></div>
      <div class="bl-bq">${strauss()}</div>
      <button class="bl-env" type="button" aria-label="Brief öffnen">${ICO_ENV}</button>
      <div class="bl-panel"><button class="bl-fold" type="button" aria-label="Brief einklappen">${ICO_DOWN}</button>
        <div class="bl-pin"><h3 class="bl-h">Für dich 💗</h3><p class="bl-t"></p></div></div>`;
    document.body.appendChild(ov);
    mark();
    let fx = null, timers = [], tw = null, run = true, typed = false;
    const later = (f, ms) => timers.push(setTimeout(f, ms));
    const end = () => { run = false; timers.forEach(clearTimeout); clearInterval(tw); if (fx) fx.stop(); ov.remove(); };
    ov.querySelector('.bl-x').addEventListener('click', () => { ov.classList.add('pack'); later(end, 500); });
    ov.querySelector('.bl-pick').addEventListener('click', () => {
      if (!ov.classList.contains('s1')) return;
      ov.className = 's2'; fx = engine(ov); later(runCode, 300); schedule();
    }, { once: true });
    ov.querySelector('.bl-env').addEventListener('click', () => { ov.classList.add('open'); if (!typed) { typed = true; typeLetter(); } });
    ov.querySelector('.bl-fold').addEventListener('click', () => ov.classList.remove('open'));

    const EV = {
      papier() { ov.classList.add('e-papier'); },
      bow() { ov.classList.add('e-bow'); },
      fw() { fx.fire(); },
      butter() {
        ov.classList.add('bf-go'); fx.calm();
        flyButterflies(() => {
          ov.classList.add('bf-land');
          later(() => ov.classList.add('bf-kiss'), 150);
          later(() => ov.classList.add('bf-us'), 700);
          later(() => ov.classList.add('env'), 2900); // Animation fertig + 1 s -> Brief-Symbol klappt auf
        });
      }
    };
    function bloomAt(i) {
      const f = ov.querySelector(`.bl-fl[data-i="${i}"]`); if (!f) return;
      f.classList.add('on'); later(() => { const r = f.getBoundingClientRect(); fx.sparkle(r.left + r.width / 2, r.top + r.height / 2); }, 450);
    }
    function schedule() {
      later(EV.papier, 300);
      for (let i = 0; i < 6; i++) {
        later(() => ov.querySelector(`.bl-st[data-i="${i}"]`).classList.add('on'), 700 + i * 520);
        later(() => bloomAt(i), 1050 + i * 520);
      }
      later(EV.bow, 4300); later(EV.fw, 4700); later(EV.butter, 5300);
    }
    function runCode() {
      const body = ov.querySelector('.bl-body'), wrap = ov.querySelector('.bl-cb'), title = ov.querySelector('.bl-bar em'), gen = codeStream();
      const CPS = 560;
      let snip = gen.next().value, li = 0, ci = 0, acc = 0, wait = 0, num = 0, last = performance.now(), cur = null, shown = -1;
      title.textContent = snip.file + ' — for-you';
      function newLine() {
        const d = document.createElement('div'); d.className = 'bl-ln'; d.innerHTML = `<i>${++num}</i><span></span>`; body.appendChild(d); cur = d.lastChild;
        if (body.children.length > 70) body.firstChild.remove();
        body.style.transform = `translateY(${-Math.max(0, body.scrollHeight - wrap.clientHeight + 8)}px)`;
      }
      function tick(t) {
        if (!run) return; requestAnimationFrame(tick);
        const dt = Math.min(t - last, 60); last = t;
        if (!cur) { newLine(); shown = -1; }
        if (wait > 0) { wait -= dt; return; }
        const text = snip.lines[li]; acc += dt * CPS / 1000;
        while (acc >= 1 && ci < text.length) { ci++; acc--; }
        if (ci !== shown) { shown = ci; cur.innerHTML = hl(text.slice(0, ci)) + (ci < text.length ? '<u></u>' : ''); }
        if (ci >= text.length) {
          li++; ci = 0; acc = 0; wait = 12; cur = null;
          if (li >= snip.lines.length) { snip = gen.next().value; li = 0; title.textContent = snip.file + ' — for-you'; wait = 120; }
        }
      }
      requestAnimationFrame(tick);
    }
    function flyButterflies(done) {
      const gA = ov.querySelector('.bf1').parentNode, gB = ov.querySelector('.bf2').parentNode, S = 1.9;
      const C = { x: 160, y: 62 }, T1 = 1400, T2 = 3600, T3 = 900, R0 = 84, R1 = 20, TURNS = 3;
      const LAND = [{ x: 146, y: 76, r: 58 }, { x: 174, y: 76, r: -58 }];
      const ease = u => u * u * (3 - 2 * u), lerp = (a, b, u) => a + (b - a) * u;
      const dAng = (a, b) => ((b - a + 540) % 360) - 180;
      const st = [{ g: gA, k: 0, p: null, r: 90 }, { g: gB, k: 1, p: null, r: -90 }];
      const t0 = performance.now();
      function pos(k, t) {
        const side = k ? 0 : Math.PI, sx = k ? 400 : -80, sy = k ? -10 : 30;
        const oe = { x: C.x + Math.cos(side) * R1, y: C.y + Math.sin(side) * R1 * .6 };
        if (t < T1) {
          const u = ease(t / T1), ex = C.x + Math.cos(side) * R0, ey = C.y + Math.sin(side) * R0 * .6;
          return { x: lerp(sx, ex, u) + Math.sin(u * 9) * 8 * (1 - u), y: lerp(sy, ey, u) + Math.sin(u * 7 + k) * 10 * (1 - u) };
        }
        if (t < T1 + T2) {
          const u = (t - T1) / T2, th = side + TURNS * 2 * Math.PI * u, R = R0 + (R1 - R0) * Math.pow(u, 1.3);
          return { x: C.x + Math.cos(th) * R, y: C.y + Math.sin(th) * R * .6 - Math.sin(u * Math.PI) * 6 };
        }
        const u = ease(Math.min(1, (t - T1 - T2) / T3)), L = LAND[k];
        return { x: lerp(oe.x, L.x, u), y: lerp(oe.y, L.y, u) };
      }
      function frame(now) {
        if (!run) return;
        const t = now - t0, fin = t >= T1 + T2 + T3;
        st.forEach(q => {
          const p = pos(q.k, Math.min(t, T1 + T2 + T3));
          if (q.p) { const dx = p.x - q.p.x, dy = p.y - q.p.y; if (dx * dx + dy * dy > .01) q.r += dAng(q.r, Math.atan2(dx, -dy) * 180 / Math.PI) * .25; }
          let rot = q.r;
          if (t > T1 + T2) { const u = ease(Math.min(1, (t - T1 - T2) / T3)); rot = q.r + dAng(q.r, LAND[q.k].r) * u; }
          q.p = p; q.g.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${rot.toFixed(1)}) scale(${S})`);
        });
        if (fin) { done(); return; }
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
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
      }, 500);
      ov.querySelector('.bl-pin').addEventListener('click', fin);
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
