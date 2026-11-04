// Erzeugt app/zuhause-vorlage.css aus docs/zuhause/dashboard-demo-aurora.html (Design 1:1, nur technisch angepasst):
// - Klassen bekommen das Präfix "z-", IDs "zh-", Keyframes "zh-" (keine Kollisionen mit der Wir-App)
// - Variablen --bg/--card/… heißen --z-bg/--z-card/…; Weiß-Überlagerungen rgba(255,255,255,a) -> rgba(var(--zw),a)
// - Textfarben (#fff, Grautöne, Tönungen) -> var(--zt-<hex>), Türkis/Violett -> var(--z-teal)/var(--z-vio)
//   Aurora belegt alle Variablen mit genau den Werten der Vorlage; andere Farbwelten überschreiben sie (zuhause.css).
// - Weckvorgang (#ring) und Bildschirmschoner (#saver) bleiben in allen Farbwelten wie in der Vorlage.
// Aufruf: node home/export/vorlage-css.js   (nur nötig, wenn sich die Vorlage ändert)
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(ROOT, 'docs/zuhause/dashboard-demo-aurora.html'), 'utf8');
let css = html.slice(html.indexOf('<style>') + 7, html.indexOf('</style>'));

const VARS = ['bg', 'card', 'line', 'txt', 'mut', 'teal', 'vio', 'pink', 'warn', 'd', 'i', 'g', 'a1'];
const KEEP = /^(#ring|\.sky|\.sun|\.calm|\.rleft|\.ringl|\.big|\.gm|\.gs|\.racts|\.snooze|\.stop|\.done|\.rright|\.rc\b|\.rwx|\.row|\.rtodo|#saver)/;
// color:#fff bleibt weiß auf farbigen Flächen
const WHITE_OK = /(\.sc\.on \.b|\.dpad \.ok|\.add button|\.done \.btn|\.rail \.nv\.on|\.tvoff \.pwr \.d)/;
const TEXT_HEX = ['d6d9e4', 'cfd2de', 'c9ccd8', 'ddd', 'e9e3e6', 'd9c7cc', 'e8dadd', 'd8cfd3', 'e2d8dc', 'e8dcd5', '4d5262', '4a4f61', '5c6172',
  '6b7083', '5a5f70', 'b9bccb', 'a99bff', 'b9a8ff', 'ffd3a6', 'ffd2ad', 'd9d0ff', 'bff3ec', '15161f', 'fff'];
const used = new Set();

const prefixSel = sel => sel
  .replace(/\.([a-zA-Z][\w-]*)/g, '.z-$1')
  .replace(/#([a-zA-Z][\w-]*)/g, '#zh-$1')
  .replace(/^\s*svg\b/, ':where(#zh) svg')
  .replace(/^\s*input\[/, ':where(#zh) input[');

function body(sel, b) {
  b = b.replace(/var\(--([a-z0-9]+)\)/g, (m, v) => (VARS.includes(v) ? `var(--z-${v})` : m));
  b = b.replace(/animation:(\w+)/g, (m, k) => (['drift', 'fade', 'pulse'].includes(k) ? 'animation:zh-' + k : m));
  if (KEEP.test(sel.trim())) return b;
  b = b.replace(/rgba\(255,255,255,/g, 'rgba(var(--zw),');
  b = b.replace(/rgba\(47,212,196,([.\d]+)\)/g, (m, a) => `color-mix(in srgb,var(--z-teal) ${Math.round(a * 100)}%,transparent)`);
  b = b.replace(/rgba\(123,92,255,([.\d]+)\)/g, (m, a) => `color-mix(in srgb,var(--z-vio) ${Math.round(a * 100)}%,transparent)`);
  b = b.replace(/#2fd4c4\b/gi, 'var(--z-teal)').replace(/#7b5cff\b/gi, 'var(--z-vio)').replace(/#ff5fa8\b/gi, 'var(--z-pink2)');
  b = b.replace(/(^|;|\{)(color|background):#([0-9a-f]{3,6})\b/gi, (m, pre, prop, hex) => {
    hex = hex.toLowerCase();
    if (hex === 'fff' && (prop !== 'color' || WHITE_OK.test(sel))) return m;
    if (!TEXT_HEX.includes(hex)) return m;
    used.add(hex);
    return `${pre}${prop}:var(--zt-${hex})`;
  });
  // Text-Grautöne auch in Kurzschreibweisen (z. B. border:2px solid #4a4f61)
  b = b.replace(/solid #(4a4f61|6d5f63)\b/g, (m, hex) => { if (hex === '6d5f63') return m; used.add(hex); return `solid var(--zt-${hex})`; });
  return b;
}

// einfache Zerlegung: @keyframes-Blöcke und normale Regeln
let out = '';
let i = 0;
while (i < css.length) {
  const open = css.indexOf('{', i);
  if (open < 0) break;
  const head = css.slice(i, open).trim();
  if (head.startsWith('@keyframes')) {
    let depth = 1, j = open + 1;
    while (depth && j < css.length) { if (css[j] === '{') depth++; else if (css[j] === '}') depth--; j++; }
    out += head.replace(/@keyframes (\w+)/, '@keyframes zh-$1') + css.slice(open, j) + '\n';
    i = j; continue;
  }
  const close = css.indexOf('}', open);
  const b = css.slice(open + 1, close);
  const sels = head.replace(/\/\*[\s\S]*?\*\//g, '').trim();
  i = close + 1;
  if (!sels || sels === ':root' || sels === '*' || sels === 'html,body') continue;
  const ps = sels.split(',').map(prefixSel).join(',');
  out += `${ps}{${body(sels, b)}}\n`;
}

// Aurora-Werte = Vorlage
const rootVars = (css.match(/:root\{([^}]*)\}/) || [])[1] || '';
const aur = rootVars.split(';').filter(Boolean).map(d => d.replace(/^--(\w+):/, '--z-$1:')).join(';');
const zt = [...used].map(h => `--zt-${h}:#${h}`).join(';');
const header = `/* AUTOMATISCH ERZEUGT aus docs/zuhause/dashboard-demo-aurora.html mit home/export/vorlage-css.js – nicht von Hand ändern.\n` +
  `   Anpassungen (Farbwelten, Handy, App-Einbettung, Leistungsmodus) stehen in app/zuhause.css. */\n` +
  `#zh{${aur};--z-pink2:#ff5fa8;--zw:255,255,255;${zt}}\n`;
fs.writeFileSync(path.join(ROOT, 'app/zuhause-vorlage.css'), header + out);
console.log('app/zuhause-vorlage.css geschrieben,', out.split('\n').length, 'Regeln, Textfarben:', [...used].join(' '));

// ---------- Markup der Vorlage (Bühne mit allen Seiten und Overlays) -> app/zuhause-markup.js ----------
let mk = html.slice(html.indexOf('<div class="stage" id="stage">'), html.indexOf('<script>'));
mk = mk.slice(0, mk.lastIndexOf('</div>'));                          // Ende der Bühne bleibt beim Einbau offen
mk = mk.replace(/class="([^"]*)"/g, (m, c) => `class="${c.split(/\s+/).filter(Boolean).map(x => 'z-' + x).join(' ')}"`)
  .replace(/\bid="([^"]+)"/g, 'id="zh-$1"')
  .replace(/var\(--(d|i|g)\)/g, 'var(--z-$1)')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\n\s*/g, '');
fs.writeFileSync(path.join(ROOT, 'app/zuhause-markup.js'),
  '// AUTOMATISCH ERZEUGT aus docs/zuhause/dashboard-demo-aurora.html mit home/export/vorlage-css.js – nicht von Hand ändern.\n' +
  '// Markup der Vorlage (Klassen mit "z-", IDs mit "zh-"); zuhause.js füllt es mit Daten vom Server.\n' +
  'window.ZH_MARKUP = ' + JSON.stringify(mk + '</div>') + ';\n');
console.log('app/zuhause-markup.js geschrieben,', mk.length, 'Zeichen');
