// Claude-Cockpit-Grafik (automatisch erzeugt aus dem Cockpit-Mod, hooks/svg.ts – nicht von Hand bearbeiten).
// Zeichnet aus den Daten, die der Mod an /api/cockpit/status schickt, dasselbe Cockpit wie in der Claude-App.
(() => {
// Das Cockpit als ein zusammenhängendes SVG:
// links Okti (Claude als Oktopus im Anzug) mit seinen Helfer-Agenten,
// rechts Limits/Kontext-Ringe und die vier Kacheln. Stil: schwarz, glühendes
// Orange, "Liquid Glass".

const C = {
  orange: '#E8825A',
  claude: '#D97757',
  ember: '#FF9B5E',
  amber: '#FFC15E',
  red: '#FF5A4E',
  cream: '#F6E7DA',
  muted: '#B09A8A',
  dim: '#7A665A',
  ink: '#1A0F0A',
}

                                                              
                                                             

                                                                                         

                     
                                                                           
                                                                                   
                                                         
                                                        
 

                                                                                             

                                                                                                                            

/** Farbe und Name je Helfer. */
const HELPER_LOOK                                                                                    = {
  pip: {
    color: '#FFD54F',
    name: 'Pip',
    role: 'Detektiv · sucht & liest',
    idle: ['wartet auf eine Spur', 'poliert die Lupe', 'zählt Dateien zum Spaß', 'schnüffelt in Ordnern rum'],
  },
  bubbles: {
    color: '#4FD1C5',
    name: 'Bubbles',
    role: 'Laborant · testet',
    idle: ['putzt die Schutzbrille', 'träumt von grünen Häkchen', 'schüttelt das Reagenzglas', 'sortiert Testprotokolle'],
  },
  inky: {
    color: '#A78BFA',
    name: 'Inky',
    role: 'Bücherwurm · recherchiert',
    idle: ['liest zum Spaß', 'blättert in den Docs', 'notiert schöne Sätze', 'sortiert Lesezeichen'],
  },
  coral: {
    color: '#FF7F6E',
    name: 'Coral',
    role: 'Handwerk · kleine Fixes',
    idle: ['poliert den Schraubenschlüssel', 'misst zweimal, schraubt einmal', 'räumt die Werkbank auf', 'prüft den Helm'],
  },
  shelly: {
    color: '#7BD88F',
    name: 'Shelly',
    role: 'Wache · prüft Sicherheit',
    idle: ['dreht ihre Runde', 'poliert das Schild', 'prüft die Schlösser', 'zählt offene Türen: keine'],
  },
  luma: {
    color: '#7FC8FF',
    name: 'Luma',
    role: 'Coach · spart Limit',
    idle: ['rechnet den Wochenschnitt', 'malt Kurven', 'sammelt Spartipps', 'stoppt die Zeit'],
  },
  generic: { color: '#FF9B5E', name: 'Helfer', role: 'Allzweck', idle: ['wartet'] },
}

/** Ein Mitglied des festen Teams, wie die Team-Leiste es zeigt. */
                          
                                      
                                           
              
               
 

                    
                                                                        
                  
                                                
                    
            
            
                  
                                                                             
                
                     
                    
               
              
                                                                     
                    
 

/** Ein Chat in der Liste „CHATS“. */
                        
               
                 
                                        
              
                 
             
 

const FONT = "font-family=\"'Segoe UI', system-ui, -apple-system, sans-serif\""

function esc(s        )         {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function levelColor(pct        )         {
  if (pct >= 85) return C.red
  if (pct >= 65) return C.amber
  return C.ember
}

function fmtK(n        )         {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return String(n)
}

function cut(s        , max        )         {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

function wrap(text        , max        , maxLines        )           {
  const lines           = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    if (!word) continue
    const w = cut(word, max)
    if ((line + ' ' + w).trim().length > max && line) {
      lines.push(line)
      line = w
    } else {
      line = (line + ' ' + w).trim()
    }
  }
  if (line) lines.push(line)
  if (lines.length > maxLines) {
    const out = lines.slice(0, maxLines)
    out[maxLines - 1] = cut(`${out[maxLines - 1]} …`, max + 2)
    return out
  }
  return lines
}

// ---------------------------------------------------------------- Okti

/** Okti im Anzug, gezeichnet in einem 220 x 240 Feld. */
function okti(mood      , pose      , isPoked         )         {
  const stressed = mood === 'stressed'
  const sleepy = pose === 'sleepy'
  const b1 = stressed ? '#FF8B6B' : '#FFA674'
  const b2 = stressed ? '#E2523E' : C.claude
  const b3 = stressed ? '#9E2F22' : '#A9492B'

  const legs = [0, 1, 2, 3, 4, 5]
    .map(i => {
      const x = 72 + i * 15.2
      const d = i % 2 === 0 ? -1 : 1
      return `<path class="tent t${i}" d="M ${x} 164 C ${x + d * 8} 184, ${x - d * 10} 198, ${x + d * 3} 212 q ${d * 5} 7 ${d * 11} 1"
        fill="none" stroke="url(#o-tent)" stroke-width="12" stroke-linecap="round"/>`
    })
    .join('')

  // Arme je nach Pose
  let arms = ''
  let prop = ''
  if (pose === 'working') {
    arms = `
      <g class="tap"><path d="M 60 134 C 46 150, 58 170, 82 176" fill="none" stroke="url(#o-tent)" stroke-width="12" stroke-linecap="round"/></g>
      <g class="tap tap2"><path d="M 160 134 C 174 150, 162 170, 138 176" fill="none" stroke="url(#o-tent)" stroke-width="12" stroke-linecap="round"/></g>`
    prop = `
      <path d="M 80 146 L 140 146 L 146 180 L 74 180 Z" fill="#26262C" stroke="#3A3A44" stroke-width="1.2"/>
      <circle cx="110" cy="163" r="5" fill="${C.ember}" filter="url(#d-glow)"><animate attributeName="opacity" values="1;.5;1" dur="1.6s" repeatCount="indefinite"/></circle>
      <rect x="66" y="180" width="88" height="7" rx="3" fill="#3A3A44"/>`
  } else if (pose === 'thinking') {
    arms = `
      <path d="M 60 134 C 44 152, 48 176, 60 190" fill="none" stroke="url(#o-tent)" stroke-width="12" stroke-linecap="round"/>
      <path d="M 160 134 C 178 128, 164 108, 146 112" fill="none" stroke="url(#o-tent)" stroke-width="12" stroke-linecap="round"/>`
    prop = `
      <g fill="${C.cream}">
        <circle class="dot d1" cx="176" cy="40" r="4"/><circle class="dot d2" cx="190" cy="28" r="5.5"/><circle class="dot d3" cx="206" cy="14" r="7"/>
      </g>`
  } else {
    arms = `
      <path d="M 60 134 C 44 152, 48 176, 60 192" fill="none" stroke="url(#o-tent)" stroke-width="12" stroke-linecap="round"/>
      <g class="${sleepy ? '' : 'wave'}"><path d="M 160 134 C 176 152, 172 176, 160 192" fill="none" stroke="url(#o-tent)" stroke-width="12" stroke-linecap="round"/></g>`
  }

  const eyes = sleepy
    ? `<path d="M 79 78 q 11 8 22 0" stroke="${C.ink}" stroke-width="3.6" fill="none" stroke-linecap="round"/>
       <path d="M 119 78 q 11 8 22 0" stroke="${C.ink}" stroke-width="3.6" fill="none" stroke-linecap="round"/>`
    : isPoked
      ? `<path d="M 82 72 l 10 6 l -10 6" stroke="${C.ink}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
         <path d="M 138 72 l -10 6 l 10 6" stroke="${C.ink}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
      : `<g class="blink">
          <ellipse cx="90" cy="77" rx="11" ry="13" fill="#FFF8F2"/>
          <ellipse cx="130" cy="77" rx="11" ry="13" fill="#FFF8F2"/>
          <g class="pupils">
            <circle cx="${pose === 'thinking' ? 93 : 91}" cy="${pose === 'thinking' ? 74 : pose === 'working' ? 81 : 78}" r="${stressed ? 4 : 6.5}" fill="${C.ink}"/>
            <circle cx="${pose === 'thinking' ? 133 : 131}" cy="${pose === 'thinking' ? 74 : pose === 'working' ? 81 : 78}" r="${stressed ? 4 : 6.5}" fill="${C.ink}"/>
            <circle cx="94" cy="74" r="2.2" fill="#FFFFFF"/><circle cx="134" cy="74" r="2.2" fill="#FFFFFF"/>
          </g>
        </g>`

  const glasses = sleepy
    ? ''
    : `<g fill="none" stroke="${C.amber}" stroke-width="2.2" opacity="0.95">
        <circle cx="90" cy="77" r="16"/><circle cx="130" cy="77" r="16"/><path d="M 106 75 q 4 -4 8 0"/>
        <path d="M 74 74 L 56 68"/><path d="M 146 74 L 164 68"/>
      </g>
      <path d="M 79 67 a 16 16 0 0 1 10 -5" stroke="#FFFFFF" stroke-opacity="0.6" stroke-width="2" fill="none" stroke-linecap="round"/>`

  const brows =
    mood === 'focused'
      ? `<path d="M 76 54 L 100 57" stroke="${C.ink}" stroke-width="3.2" stroke-linecap="round"/><path d="M 144 54 L 120 57" stroke="${C.ink}" stroke-width="3.2" stroke-linecap="round"/>`
      : stressed
        ? `<path d="M 76 59 L 100 51" stroke="${C.ink}" stroke-width="3.2" stroke-linecap="round"/><path d="M 144 59 L 120 51" stroke="${C.ink}" stroke-width="3.2" stroke-linecap="round"/>`
        : `<path d="M 78 55 q 12 -5 22 0" stroke="${C.ink}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M 120 55 q 10 -5 22 0" stroke="${C.ink}" stroke-width="3" fill="none" stroke-linecap="round"/>`

  const mouth = isPoked
    ? `<path d="M 100 100 Q 110 114 120 100 Z" fill="${C.ink}"/>`
    : sleepy
      ? `<ellipse cx="110" cy="104" rx="3.5" ry="4.5" fill="${C.ink}"/>`
      : stressed
        ? `<path d="M 98 106 q 4 -4 8 0 t 8 0 t 8 0" stroke="${C.ink}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`
        : mood === 'focused'
          ? `<path d="M 102 104 L 118 104" stroke="${C.ink}" stroke-width="3.4" stroke-linecap="round"/>`
          : `<path d="M 101 101 Q 110 109 119 101" stroke="${C.ink}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`

  const sweat =
    mood === 'focused' || stressed
      ? `<path class="drop" d="M 164 46 q 6 10 0 14 q -6 -4 0 -14 Z" fill="#9BD8FF"/>${
          stressed ? `<path class="drop dr2" d="M 56 50 q 5 8 0 11 q -5 -3 0 -11 Z" fill="#9BD8FF"/>` : ''
        }`
      : ''

  const zzz = sleepy
    ? `<g class="zzz" fill="${C.cream}" font-weight="700"><text x="164" y="40" font-size="15">z</text><text x="176" y="26" font-size="20">Z</text></g>`
    : ''

  return `
  <defs>
    <radialGradient id="o-head" cx="0.38" cy="0.3" r="0.8">
      <stop offset="0" stop-color="${b1}"/><stop offset="0.6" stop-color="${b2}"/><stop offset="1" stop-color="${b3}"/>
    </radialGradient>
    <linearGradient id="o-tent" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${b2}"/><stop offset="1" stop-color="${b3}"/></linearGradient>
    <linearGradient id="o-suit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2E2E36"/><stop offset="1" stop-color="#16161B"/></linearGradient>
    <radialGradient id="o-shadow"><stop offset="0" stop-color="${C.ember}" stop-opacity="0.5"/><stop offset="1" stop-color="${C.ember}" stop-opacity="0"/></radialGradient>
  </defs>
  <ellipse cx="110" cy="226" rx="72" ry="11" fill="url(#o-shadow)"/>
  <g id="octo">
    <animateTransform attributeName="transform" type="translate" values="0 0; 0 -22; 0 0; 0 -6; 0 0" keyTimes="0;0.35;0.65;0.82;1" dur="0.8s" begin="click" additive="sum"/>
    <g class="octo ${stressed ? 'shake' : ''}">
      <g class="bob">
        ${legs}
        <ellipse cx="110" cy="72" rx="58" ry="52" fill="url(#o-head)"/>
        <ellipse cx="86" cy="42" rx="20" ry="10" fill="#FFFFFF" opacity="0.3" transform="rotate(-24 86 42)"/>
        <!-- Anzug -->
        <path d="M 60 116 Q 110 132 160 116 L 170 170 Q 110 182 50 170 Z" fill="url(#o-suit)"/>
        <path d="M 96 121 L 110 152 L 124 121 Z" fill="#F4EFEA"/>
        <path d="M 96 121 L 110 154 L 82 142 L 86 124 Z" fill="#101014"/>
        <path d="M 124 121 L 110 154 L 138 142 L 134 124 Z" fill="#101014"/>
        <path d="M 105 123 L 115 123 L 113 130 L 107 130 Z" fill="${C.claude}"/>
        <path d="M 107 130 L 113 130 L 116 150 L 110 158 L 104 150 Z" fill="${C.claude}"/>
        <path d="M 139 137 l 9 -6 l 3 8 Z" fill="${C.ember}"/>
        <circle cx="110" cy="166" r="2.2" fill="#3A3A44"/>
        ${arms}
        ${prop}
        ${brows}
        ${eyes}
        ${glasses}
        <ellipse class="blush" cx="72" cy="96" rx="9" ry="5" fill="#FF6F7D"/>
        <ellipse class="blush" cx="148" cy="96" rx="9" ry="5" fill="#FF6F7D"/>
        ${mouth}
        ${sweat}
      </g>
    </g>
    <g opacity="0" fill="#FF6F7D">
      <set attributeName="opacity" to="1" begin="octo.click" dur="1.3s"/>
      <animateTransform attributeName="transform" type="translate" values="0 0; 0 -40" dur="1.3s" begin="octo.click"/>
      <path d="M 176 60 c -6 -8 -18 -2 -12 8 l 12 10 l 12 -10 c 6 -10 -6 -16 -12 -8 Z"/>
      <path d="M 44 52 c -4 -6 -13 -1 -9 6 l 9 7 l 9 -7 c 4 -7 -5 -12 -9 -6 Z" opacity="0.8"/>
    </g>
  </g>
  ${zzz}`
}

/** Zubehör eines benannten Helfers, im 36 x 36 Feld des Mini-Oktopus. */
function accessory(kind            )         {
  switch (kind) {
    case 'pip': // Lupe
      return `<circle cx="29" cy="21" r="5.5" fill="#FFFFFF" fill-opacity="0.3" stroke="#3A2A10" stroke-width="2"/>
        <path d="M 33 25 L 37 30" stroke="#3A2A10" stroke-width="2.6" stroke-linecap="round"/>`
    case 'bubbles': // Schutzbrille
      return `<path d="M 4 13 Q 18 9 32 13" stroke="#1E3A3A" stroke-width="2" fill="none"/>
        <rect x="8" y="11" width="9.5" height="7.5" rx="3" fill="#BFF4EE" fill-opacity="0.6" stroke="#1E3A3A" stroke-width="1.6"/>
        <rect x="18.5" y="11" width="9.5" height="7.5" rx="3" fill="#BFF4EE" fill-opacity="0.6" stroke="#1E3A3A" stroke-width="1.6"/>`
    case 'inky': // Buch
      return `<path d="M 24 23 L 31 21 L 38 23 L 38 32 L 31 30 L 24 32 Z" fill="#F6E7DA" stroke="#3B2A5A" stroke-width="1.4" stroke-linejoin="round"/>
        <path d="M 31 21 L 31 30" stroke="#3B2A5A" stroke-width="1.2"/>`
    case 'coral': // Schraubenschlüssel
      return `<path d="M 27 31 L 35 23" stroke="#5A5A66" stroke-width="3" stroke-linecap="round"/>
        <path d="M 33 19 a 4 4 0 1 0 5 5 l -2.5 -0.5 l -2 -2 Z" fill="#8A8A96"/>`
    case 'shelly': // Schild
      return `<path d="M 26 20 L 32 18 L 38 20 L 38 26 Q 38 31 32 34 Q 26 31 26 26 Z" fill="#2E6B45" stroke="#1C3F2A" stroke-width="1.3"/>
        <path d="M 29 26 l 2.2 2.2 l 4 -4.4" stroke="#DFF7E5" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    case 'luma': // Klemmbrett mit Kurve
      return `<rect x="25" y="19" width="12" height="15" rx="2" fill="#F6E7DA" stroke="#24476A" stroke-width="1.3"/>
        <path d="M 27.5 30 L 30.5 27 L 32.5 28.5 L 35 23.5" stroke="#2F80C9" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    default:
      return ''
  }
}

/** Mini-Oktopus für einen Helfer-Agenten, 36 x 36 ab (x, y). */
function mini(x        , y        , color        , isDone         , i        , kind             = 'generic')         {
  return `
  <g transform="translate(${x} ${y})" opacity="${isDone ? 0.45 : 1}">
    <g class="${isDone ? '' : 'mbob'}" style="animation-delay:-${(i * 0.37).toFixed(2)}s">
      <path d="M 9 22 q -3 8 1 12 M 15 24 q 1 8 -2 11 M 21 24 q -1 8 2 11 M 27 22 q 3 8 -1 12" stroke="${color}" stroke-width="3.6" fill="none" stroke-linecap="round"/>
      <ellipse cx="18" cy="15" rx="13" ry="12" fill="${color}"/>
      <path d="M 10 24 Q 18 29 26 24 L 27 28 Q 18 32 9 28 Z" fill="#1E1E24"/>
      <path d="M 17 25 L 19 25 L 19.6 30 L 18 31.4 L 16.4 30 Z" fill="${C.ember}"/>
      ${isDone
        ? `<path d="M 12 15 q 2.5 2 5 0 M 19 15 q 2.5 2 5 0" stroke="${C.ink}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`
        : `<circle cx="13.5" cy="15" r="2.4" fill="${C.ink}"/><circle cx="22.5" cy="15" r="2.4" fill="${C.ink}"/>`}
      <ellipse cx="13" cy="8.5" rx="4" ry="2.2" fill="#FFFFFF" opacity="0.35"/>
      ${accessory(kind)}
    </g>
  </g>`
}

/** Ein Team-Oktopus mit Outfit, gezeichnet in einem 120 x 140 Feld. */
function helperOcto(kind                    , state                     )         {
  const look = HELPER_LOOK[kind]
  const c = look.color
  const active = state === 'active'
  const resting = state === 'idle' || state === 'off'
  const id = `ho-${kind}`

  const legs = [0, 1, 2, 3, 4]
    .map(i => {
      const x = 38 + i * 11
      const d = i % 2 === 0 ? -1 : 1
      return `<path class="hleg hl${i}" d="M ${x} 84 C ${x + d * 5} 98, ${x - d * 7} 108, ${x + d * 2} 120 q ${d * 4} 6 ${d * 8} 1" fill="none" stroke="url(#${id}-t)" stroke-width="8" stroke-linecap="round"/>`
    })
    .join('')

  const eyes = resting
    ? `<ellipse cx="49" cy="62" rx="6.5" ry="6.5" fill="#FFF8F2"/><ellipse cx="71" cy="62" rx="6.5" ry="6.5" fill="#FFF8F2"/>
       <circle cx="49.5" cy="63.5" r="3.4" fill="${C.ink}"/><circle cx="71.5" cy="63.5" r="3.4" fill="${C.ink}"/>
       <path d="M 42 61 Q 49 55 56 61 Z M 64 61 Q 71 55 78 61 Z" fill="url(#${id}-h)"/>
       <path d="M 42.5 60.5 Q 49 57.5 55.5 60.5 M 64.5 60.5 Q 71 57.5 77.5 60.5" stroke="${C.ink}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`
    : `<g class="hblink"><ellipse cx="49" cy="61" rx="7" ry="8" fill="#FFF8F2"/><ellipse cx="71" cy="61" rx="7" ry="8" fill="#FFF8F2"/>
       <circle cx="50" cy="62" r="4" fill="${C.ink}"/><circle cx="72" cy="62" r="4" fill="${C.ink}"/>
       <circle cx="51.5" cy="60" r="1.4" fill="#FFFFFF"/><circle cx="73.5" cy="60" r="1.4" fill="#FFFFFF"/></g>`

  const mouth = active
    ? `<path d="M 55 74 Q 60 80 65 74 Z" fill="${C.ink}"/>`
    : `<path d="M 55 74 Q 60 77.5 65 74" stroke="${C.ink}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`

  let back = ''
  let front = ''
  switch (kind) {
    case 'pip': // Detektiv: karierte Jagdmütze, Lupe
      front = `
        <path d="M 30 40 Q 60 6 90 40 Z" fill="#9A7442"/>
        <path d="M 40 22 L 44 40 M 52 13 L 54 40 M 66 13 L 64 40 M 78 22 L 76 40 M 33 33 L 87 33 M 38 25 L 82 25" stroke="#6E4F28" stroke-width="1.3" opacity="0.8"/>
        <path d="M 27 40 Q 60 50 93 40 Q 60 44 27 40 Z" fill="#7A5A30"/>
        <path d="M 30 38 l -6 14 l 8 -3 Z M 90 38 l 6 14 l -8 -3 Z" fill="#8A6738"/>
        <circle cx="60" cy="12" r="3" fill="#6E4F28"/>
        <g class="${active ? 'scan' : ''}">
          <path d="M 92 92 L 102 106" stroke="#4A3418" stroke-width="4" stroke-linecap="round"/>
          <circle cx="88" cy="85" r="10" fill="#E9F6FF" fill-opacity="0.35" stroke="#4A3418" stroke-width="3"/>
          <path d="M 83 80 a 6 6 0 0 1 5 -2" stroke="#FFFFFF" stroke-width="1.6" fill="none" stroke-linecap="round"/>
        </g>`
      break
    case 'bubbles': // Laborkittel, Schutzbrille, Reagenzglas
      front = `
        <path d="M 30 82 Q 60 98 90 82 L 95 110 Q 60 120 25 110 Z" fill="#F2F6F6"/>
        <path d="M 52 90 L 60 110 L 68 90" stroke="#C9D6D6" stroke-width="1.6" fill="none"/>
        <rect x="70" y="96" width="9" height="6" rx="1.5" fill="none" stroke="#9FB3B3" stroke-width="1.2"/>
        <path d="M 30 56 Q 60 50 90 56" stroke="#1E3A3A" stroke-width="3" fill="none"/>
        <rect x="39" y="53" width="20" height="16" rx="6" fill="#BFF4EE" fill-opacity="0.45" stroke="#1E3A3A" stroke-width="2.4"/>
        <rect x="61" y="53" width="20" height="16" rx="6" fill="#BFF4EE" fill-opacity="0.45" stroke="#1E3A3A" stroke-width="2.4"/>
        <path d="M 43 57 l 5 -2" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round"/>
        <g transform="rotate(-18 20 92)">
          <rect x="15" y="74" width="10" height="30" rx="5" fill="#E9F6FF" fill-opacity="0.5" stroke="#1E3A3A" stroke-width="1.6"/>
          <rect x="16.5" y="88" width="7" height="14.5" rx="3.5" fill="#7CF29A"/>
          ${active ? `<circle class="fizz1" cx="20" cy="90" r="1.8" fill="#FFFFFF"/><circle class="fizz2" cx="21.5" cy="94" r="1.3" fill="#FFFFFF"/>` : ''}
        </g>`
      break
    case 'inky': // Baskenmütze, Schal, Buch
      front = `
        <ellipse cx="62" cy="30" rx="28" ry="9" fill="#5B3F99" transform="rotate(-8 62 30)"/>
        <circle cx="64" cy="20" r="3" fill="#5B3F99"/>
        <path d="M 30 80 Q 60 92 90 80 L 90 88 Q 60 100 30 88 Z" fill="#F6C453"/>
        <path d="M 40 84 L 40 92 M 52 87 L 52 95 M 64 87 L 64 95 M 76 85 L 76 93" stroke="#E0943A" stroke-width="2.4"/>
        <path d="M 74 86 L 80 112 L 88 110 L 82 86 Z" fill="#F6C453"/>
        <g class="${active ? 'page' : ''}">
          <path d="M 86 88 L 99 84 L 112 88 L 112 106 L 99 102 L 86 106 Z" fill="#F6E7DA" stroke="#3B2A5A" stroke-width="1.8" stroke-linejoin="round"/>
          <path d="M 99 84 L 99 102 M 90 92 L 96 90.5 M 90 96 L 96 94.5 M 102 90.5 L 108 92 M 102 94.5 L 108 96" stroke="#3B2A5A" stroke-width="1.1"/>
        </g>`
      break
    case 'coral': // Bauhelm, Latzhose, Schraubenschlüssel
      front = `
        <path d="M 40 82 L 80 82 L 86 112 Q 60 120 34 112 Z" fill="#3B6EA8"/>
        <rect x="50" y="88" width="20" height="12" rx="2" fill="#4A80BD" stroke="#2C5788" stroke-width="1.2"/>
        <path d="M 42 82 L 46 70 M 78 82 L 74 70" stroke="#2C5788" stroke-width="4" stroke-linecap="round"/>
        <circle cx="45" cy="84" r="2" fill="#FFC93C"/><circle cx="75" cy="84" r="2" fill="#FFC93C"/>
        <path d="M 29 42 Q 60 4 91 42 Z" fill="#FFC93C"/>
        <path d="M 58 10 L 62 10 L 63 42 L 57 42 Z" fill="#F0B020"/>
        <rect x="24" y="40" width="72" height="6" rx="3" fill="#F0B020"/>
        <g class="${active ? 'twist' : ''}">
          <path d="M 86 104 L 100 86" stroke="#7A7A86" stroke-width="5" stroke-linecap="round"/>
          <path d="M 97 80 a 7 7 0 1 0 8 9 l -4 -1 l -3 -3 Z" fill="#9A9AA6"/>
        </g>`
      break
    case 'shelly': // Wachhelm mit Visier, Umhang, Schild mit Häkchen
      back = `<path d="M 32 70 Q 60 78 88 70 L 98 118 Q 60 128 22 118 Z" fill="#245A3A" opacity="0.85"/>`
      front = `
        <path d="M 28 46 Q 30 14 60 12 Q 90 14 92 46 Z" fill="#9AA7B0"/>
        <path d="M 28 46 Q 30 14 60 12 Q 90 14 92 46" stroke="#6E7C86" stroke-width="2" fill="none"/>
        <path d="M 60 12 L 60 46" stroke="#6E7C86" stroke-width="2.4"/>
        <path d="M 56 8 Q 60 -2 64 8 Z" fill="#E8825A"/>
        <rect x="26" y="43" width="68" height="6" rx="3" fill="#7F8C96"/>
        <g class="${active ? 'scan' : ''}">
          <path d="M 80 84 L 100 80 L 112 84 L 112 98 Q 112 110 96 118 Q 80 110 80 98 Z" fill="#2E6B45" stroke="#1C3F2A" stroke-width="2.2"/>
          <path d="M 87 98 l 6 6 l 11 -12" stroke="#DFF7E5" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </g>`
      break
    case 'luma': // Schirmmütze, Trillerpfeife, Klemmbrett mit Kurve
      front = `
        <path d="M 30 42 Q 60 10 90 42 Z" fill="#2F80C9"/>
        <path d="M 26 42 Q 60 50 94 42 Q 60 46 26 42 Z" fill="#24639E"/>
        <path d="M 88 40 Q 104 40 106 46 Q 96 47 86 44 Z" fill="#24639E"/>
        <circle cx="60" cy="18" r="2.6" fill="#BFE3FF"/>
        <path d="M 46 80 Q 60 96 74 80" stroke="#F6E7DA" stroke-width="1.6" fill="none"/>
        <rect x="56" y="90" width="10" height="6" rx="3" fill="#C9D3DC" stroke="#7A8794" stroke-width="1"/>
        <g class="${active ? 'page' : ''}">
          <rect x="84" y="80" width="26" height="32" rx="3" fill="#F6E7DA" stroke="#24476A" stroke-width="2"/>
          <rect x="92" y="77" width="10" height="5" rx="1.5" fill="#7A8794"/>
          <path d="M 88 104 L 94 97 L 99 100 L 106 89" stroke="#2F80C9" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="106" cy="89" r="2" fill="#E8825A"/>
        </g>`
      break
  }

  return `
  <defs>
    <radialGradient id="${id}-h" cx="0.38" cy="0.3" r="0.8"><stop offset="0" stop-color="#FFFFFF" stop-opacity="1"/><stop offset="0.25" stop-color="${c}"/><stop offset="1" stop-color="${c}" stop-opacity="0.75"/></radialGradient>
    <linearGradient id="${id}-t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="${c}" stop-opacity="0.6"/></linearGradient>
    <radialGradient id="${id}-g"><stop offset="0" stop-color="${c}" stop-opacity="0.55"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>
  </defs>
  ${active ? `<circle class="hglow" cx="60" cy="72" r="58" fill="url(#${id}-g)"/>` : ''}
  <ellipse cx="60" cy="132" rx="34" ry="6" fill="${c}" opacity="${active ? 0.35 : 0.15}"/>
  <g opacity="${state === 'off' ? 0.4 : 1}">
    <g class="${active ? 'hbob-fast' : 'hbob'}">
      ${back}
      ${legs}
      <ellipse cx="60" cy="58" rx="34" ry="31" fill="url(#${id}-h)"/>
      <ellipse cx="60" cy="58" rx="34" ry="31" fill="${c}" opacity="0.55"/>
      <ellipse cx="46" cy="40" rx="11" ry="5.5" fill="#FFFFFF" opacity="0.35" transform="rotate(-22 46 40)"/>
      ${eyes}
      <ellipse cx="40" cy="72" rx="5" ry="3" fill="#FF6F7D" opacity="0.4"/><ellipse cx="80" cy="72" rx="5" ry="3" fill="#FF6F7D" opacity="0.4"/>
      ${mouth}
      ${front}
    </g>
  </g>
  ${resting && state === 'idle' ? `<g class="zzz" fill="${C.cream}" opacity="0.7" font-weight="700"><text x="94" y="30" font-size="10">z</text><text x="102" y="20" font-size="13">z</text></g>` : ''}`
}

const MINI_COLORS = ['#FF9B5E', '#FFC15E', '#F27D63', '#FFB08A', '#E8825A', '#FFD08A']

// ---------------------------------------------------------------- Bausteine

function sparkline(id        , x        , y        , w        , h        , values          , color        )         {
  if (values.length < 2) {
    return `<text x="${x}" y="${y + h - 6}" font-size="11" fill="${C.dim}">Verlauf folgt nach ein paar Antworten …</text>`
  }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => [x + (i / (values.length - 1)) * w, y + h - ((v - min) / span) * (h - 4) - 2]         )
  const line = pts.map(([px, py], i) => `${i === 0 ? 'M' : 'L'} ${px.toFixed(1)} ${py.toFixed(1)}`).join(' ')
  const last = pts[pts.length - 1] 
  return `
    <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${color}" stop-opacity="0.45"/><stop offset="1" stop-color="${color}" stop-opacity="0"/>
    </linearGradient>
    <path d="${line} L ${x + w} ${y + h} L ${x} ${y + h} Z" fill="url(#${id})"/>
    <path d="${line}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="4" fill="${color}" filter="url(#d-glow)"/>`
}

function bars(x        , y        , w        , h        , values          , color        )         {
  if (values.length === 0) {
    return `<text x="${x}" y="${y + h - 6}" font-size="11" fill="${C.dim}">Jede Antwort wird ein Balken …</text>`
  }
  const vs = values.slice(-16)
  const max = Math.max(...vs, 1)
  const gap = 3
  const bw = Math.min(12, (w - gap * (vs.length - 1)) / vs.length)
  return vs
    .map((v, i) => {
      const bh = Math.max(3, (v / max) * h)
      return `<rect x="${(x + i * (bw + gap)).toFixed(1)}" y="${(y + h - bh).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="2.5" fill="${color}" fill-opacity="${(0.4 + 0.6 * ((i + 1) / vs.length)).toFixed(2)}"/>`
    })
    .join('')
}

function stackBar(x        , y        , w        , parts                                )         {
  const total = parts.reduce((s, p) => s + p.v, 0)
  if (total === 0) return `<rect x="${x}" y="${y}" width="${w}" height="8" rx="4" fill="#FFFFFF" fill-opacity="0.08"/>`
  let off = 0
  const segs = parts
    .filter(p => p.v > 0)
    .map(p => {
      const pw = (p.v / total) * w
      const s = `<rect x="${(x + off).toFixed(1)}" y="${y}" width="${pw.toFixed(1)}" height="8" fill="${p.color}"/>`
      off += pw
      return s
    })
    .join('')
  return `<clipPath id="sb-clip"><rect x="${x}" y="${y}" width="${w}" height="8" rx="4"/></clipPath><g clip-path="url(#sb-clip)">${segs}</g>`
}

function tileHead(x        , y        , icon        , label        , value        , sub        , subMax = 34)         {
  return `
    <text x="${x + 20}" y="${y + 32}" font-size="12" font-weight="600" fill="${C.ember}" letter-spacing="1.2">${icon} ${esc(label.toUpperCase())}</text>
    <text x="${x + 20}" y="${y + 72}" font-size="30" font-weight="800" fill="${C.cream}">${esc(value)}</text>
    <text x="${x + 20}" y="${y + 94}" font-size="12" fill="${C.muted}">${esc(cut(sub, subMax))}</text>`
}

/** Stile und Animationen, die alle Cockpit-Grafiken teilen. */
const STYLE = `<style>
    .octo { transform-origin: 110px 120px; transition: transform .35s cubic-bezier(.3,1.7,.5,1); cursor: pointer; }
    #octo:hover .octo { transform: scale(1.06) rotate(-3deg); }
    .blush { opacity: .3; transition: opacity .3s; }
    #octo:hover .blush { opacity: .85; }
    .bob { animation: bob 3.4s ease-in-out infinite; }
    @keyframes bob { 50% { transform: translateY(-5px); } }
    .tent { transform-box: fill-box; transform-origin: 50% 0%; animation: sway 3s ease-in-out infinite; }
    .t1 { animation-delay: -.5s } .t2 { animation-delay: -1s } .t3 { animation-delay: -1.5s } .t4 { animation-delay: -2s } .t5 { animation-delay: -2.5s }
    #octo:hover .tent { animation-duration: .9s; }
    @keyframes sway { 0%,100% { transform: rotate(-7deg); } 50% { transform: rotate(7deg); } }
    .blink { transform-box: fill-box; transform-origin: center; animation: blink 4.8s infinite; }
    @keyframes blink { 0%,93%,100% { transform: scaleY(1); } 95.5% { transform: scaleY(.08); } }
    .tap { animation: tap .32s ease-in-out infinite; }
    .tap2 { animation-delay: -.16s; }
    @keyframes tap { 50% { transform: translateY(3px); } }
    .wave { transform-box: fill-box; transform-origin: 0% 0%; animation: wave 6s ease-in-out infinite; }
    @keyframes wave { 0%,70%,100% { transform: rotate(0); } 76% { transform: rotate(-38deg); } 82% { transform: rotate(-22deg); } 88% { transform: rotate(-38deg); } 94% { transform: rotate(0); } }
    .dot { animation: dot 1.5s ease-in-out infinite; opacity: .2; }
    .d2 { animation-delay: .25s; } .d3 { animation-delay: .5s; }
    @keyframes dot { 30%,60% { opacity: .95; } }
    .shake { animation: shake .45s linear infinite; }
    @keyframes shake { 25% { transform: translateX(-1.4px); } 75% { transform: translateX(1.4px); } }
    .drop { animation: drop 1.8s ease-in infinite; } .dr2 { animation-delay: -.9s; }
    @keyframes drop { 0% { transform: translateY(0); opacity: 0; } 20% { opacity: .9; } 100% { transform: translateY(14px); opacity: 0; } }
    .zzz { animation: zzz 2.6s ease-in-out infinite; }
    @keyframes zzz { 0% { transform: translate(0,6px); opacity: 0; } 40% { opacity: 1; } 100% { transform: translate(6px,-8px); opacity: 0; } }
    .mbob { animation: mbob 1.4s ease-in-out infinite; }
    @keyframes mbob { 50% { transform: translateY(-3px) rotate(-3deg); } }
    .hbob { animation: hbob 4.2s ease-in-out infinite; }
    @keyframes hbob { 50% { transform: translateY(-3px); } }
    .hbob-fast { animation: hbobf 1.1s ease-in-out infinite; }
    @keyframes hbobf { 50% { transform: translateY(-6px) rotate(-2deg); } }
    .hleg { transform-box: fill-box; transform-origin: 50% 0%; animation: sway 3.4s ease-in-out infinite; }
    .hl1 { animation-delay: -.6s } .hl2 { animation-delay: -1.2s } .hl3 { animation-delay: -1.8s } .hl4 { animation-delay: -2.4s }
    .hbob-fast .hleg { animation-duration: 1s; }
    .hblink { transform-box: fill-box; transform-origin: center; animation: blink 5.2s infinite; }
    .hglow { animation: hglow 1.6s ease-in-out infinite; }
    @keyframes hglow { 50% { opacity: .45; } }
    .scan { animation: scan 1.6s ease-in-out infinite; }
    @keyframes scan { 0%,100% { transform: translate(0,0); } 33% { transform: translate(-8px,-4px); } 66% { transform: translate(4px,-8px); } }
    .twist { transform-box: fill-box; transform-origin: 0% 100%; animation: twist .7s ease-in-out infinite; }
    @keyframes twist { 50% { transform: rotate(-22deg); } }
    .page { transform-box: fill-box; transform-origin: 50% 100%; animation: page 2s ease-in-out infinite; }
    @keyframes page { 50% { transform: rotate(6deg) translateY(-2px); } }
    .fizz1, .fizz2 { animation: tube 1.2s ease-in infinite; } .fizz2 { animation-delay: -.6s; }
    @keyframes tube { 0% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(-14px); opacity: 0; } }
    .live, .pulse-dot { animation: live 1.2s ease-in-out infinite; }
    @keyframes live { 50% { opacity: .25; } }
    .ring { transition: transform .3s cubic-bezier(.3,1.6,.5,1); transform-box: fill-box; transform-origin: center; }
    .ring:hover { transform: scale(1.07); }
    .arc { transition: stroke-width .3s; }
    .ring:hover .arc { stroke-width: 19; }
    .hot .arc { animation: hot 1.4s ease-in-out infinite; }
    @keyframes hot { 50% { stroke-opacity: .45; } }
    .blob1 { animation: blob1 12s ease-in-out infinite; } .blob2 { animation: blob2 10s ease-in-out infinite; }
    @keyframes blob1 { 50% { transform: translate(60px, -40px); } }
    @keyframes blob2 { 50% { transform: translate(-50px, 60px); } }
  </style>`

/** Verläufe und Filter, die alle Cockpit-Grafiken teilen (Kennungen d-…). */
const DEFS = `    <linearGradient id="d-glass" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="#2B1A12" stop-opacity="0.95"/><stop offset="1" stop-color="#0A0706" stop-opacity="0.98"/>
    </linearGradient>
    <linearGradient id="d-sheen" x1="0" y1="0" x2="0.9" y2="0.9">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.13"/><stop offset="0.3" stop-color="#FFFFFF" stop-opacity="0.03"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="d-edge" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${C.ember}" stop-opacity="0.9"/><stop offset="0.5" stop-color="${C.claude}" stop-opacity="0.15"/><stop offset="1" stop-color="${C.ember}" stop-opacity="0.6"/>
    </linearGradient>
    <radialGradient id="d-blob"><stop offset="0" stop-color="${C.ember}" stop-opacity="0.42"/><stop offset="1" stop-color="${C.claude}" stop-opacity="0"/></radialGradient>
    <linearGradient id="d-arc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.amber}"/><stop offset="1" stop-color="${C.claude}"/></linearGradient>
    <linearGradient id="d-line" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${C.ember}" stop-opacity="0"/><stop offset="0.5" stop-color="${C.ember}" stop-opacity="0.35"/><stop offset="1" stop-color="${C.ember}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="d-vline" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${C.ember}" stop-opacity="0"/><stop offset="0.5" stop-color="${C.ember}" stop-opacity="0.35"/><stop offset="1" stop-color="${C.ember}" stop-opacity="0"/>
    </linearGradient>
    <filter id="d-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="d-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="22"/></filter>`

// ---------------------------------------------------------------- Dashboard

function dashboardSvg(d      )         {
  const W = 640
  const SB = 200 // Breite der Okti-Seitenleiste
  const MW = W - SB

  // ---- rechte Seite: Ringe
  const ringTop = 0
  const r = 54
  const stroke = 15
  const circ = 2 * Math.PI * r
  const step = MW / 3
  const rings = d.rings
    .map((ring, i) => {
      const cx = SB + step * i + step / 2
      const cy = ringTop + 132
      const has = ring.pct !== null
      const pct = ring.pct ?? 0
      const color = has ? levelColor(pct) : C.dim
      const dash = ((Math.min(100, Math.max(0, pct)) / 100) * circ).toFixed(1)
      return `
    <g class="ring ${has && pct >= 85 ? 'hot' : ''}">
      <title>${esc(ring.tooltip)}</title>
      <circle cx="${cx}" cy="${cy}" r="${r + 18}" fill="transparent"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-opacity="0.14" stroke-width="${stroke}"/>
      <circle class="arc" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${has && pct >= 65 ? color : 'url(#d-arc)'}" stroke-width="${stroke}"
        stroke-linecap="round" stroke-dasharray="${dash} ${circ.toFixed(1)}" transform="rotate(-90 ${cx} ${cy})" filter="url(#d-glow)"/>
      <text x="${cx}" y="${cy + 8}" text-anchor="middle" font-size="31" font-weight="800" fill="${has ? C.cream : C.dim}">${has ? Math.round(pct) : '–'}<tspan font-size="15" font-weight="600" fill="${C.muted}">${has ? '%' : ''}</tspan></text>
      <text x="${cx}" y="${cy + 27}" text-anchor="middle" font-size="10.5" fill="${C.muted}" letter-spacing="0.6">${esc(ring.label.toUpperCase())}</text>
      <text x="${cx}" y="${cy + r + 34}" text-anchor="middle" font-size="12.5" fill="${has ? C.muted : C.dim}">${esc(cut(ring.detail, 20))}</text>
    </g>`
    })
    .join('')

  // ---- rechte Seite: Kacheln
  const tileTop = 256
  const cw = MW / 2
  const ch = 152
  const cell = (col        , row        ) => [SB + col * cw, tileTop + row * ch]         
  const [x0, y0] = cell(0, 0)
  const [x1, y1] = cell(1, 0)
  const [x2, y2] = cell(0, 1)
  const [x3, y3] = cell(1, 1)
  const t = d.tiles
  const vw = cw - 40
  const ctxColor = t.ctx.pct === null ? C.ember : levelColor(t.ctx.pct)
  const ctxBar =
    t.ctx.pct === null
      ? ''
      : `<rect x="${x0 + 20}" y="${y0 + 104}" width="${vw}" height="5" rx="2.5" fill="#FFFFFF" fill-opacity="0.08"/>
         <rect x="${x0 + 20}" y="${y0 + 104}" width="${((vw * Math.min(100, t.ctx.pct)) / 100).toFixed(1)}" height="5" rx="2.5" fill="${ctxColor}" filter="url(#d-glow)"/>`
  const cacheParts = [
    { v: t.cache.read, color: C.ember },
    { v: t.cache.write, color: C.amber },
    { v: t.cache.fresh, color: C.dim },
  ]
  const cacheLegend =
    t.cache.read + t.cache.write + t.cache.fresh > 0
      ? `${fmtK(t.cache.read)} Cache · ${fmtK(t.cache.write)} gespeichert · ${fmtK(t.cache.fresh)} neu`
      : 'Noch keine Antwort gemessen …'

  const tiles = `
    ${tileHead(x0, y0, '🧠', 'Kontext', t.ctx.value, t.ctx.sub)}
    ${ctxBar}
    ${sparkline('d-sp1', x0 + 20, y0 + 114, vw, 26, t.ctx.series, ctxColor)}

    ${tileHead(x1, y1, '⚡', 'Cache', t.cache.value, t.cache.sub)}
    ${stackBar(x1 + 20, y1 + 108, vw, cacheParts)}
    <text x="${x1 + 20}" y="${y1 + 136}" font-size="11" fill="${C.muted}">${esc(cacheLegend)}</text>

    ${tileHead(x2, y2, '⏱️', 'Session', t.session.value, t.session.sub)}
    ${bars(x2 + 20, y2 + 106, vw, 34, t.session.bars, C.ember)}

    ${tileHead(x3, y3, '💸', 'Wert', t.cost.value, t.cost.sub)}
    ${sparkline('d-sp2', x3 + 20, y3 + 108, vw, 32, t.cost.series, C.amber)}`

  const mainH = tileTop + ch * 2 + 4

  // ---- linke Seite: Okti, Status, Helfer
  const statusY = 232
  const statusColor =
    d.status.state === 'working' ? C.ember : d.status.state === 'thinking' ? C.amber : d.status.state === 'sleepy' ? C.dim : '#9BE3A8'
  const statusLines = wrap(d.status.text, 21, 2)
  const sayLines = wrap(d.saying, 24, 4)
  const sayY = statusY + 30 + statusLines.length * 17 + 14
  const sayH = 18 + sayLines.length * 16
  const agentsTop = sayY + sayH + 30
  const rowH = 54
  const rowsTop = agentsTop + 26
  const agentRows =
    d.agents.length === 0
      ? `<text x="20" y="${rowsTop + 24}" font-size="12" fill="${C.dim}">Gerade keine Helfer aktiv</text>`
      : d.agents
          .map((a, i) => {
            const y = rowsTop + i * rowH
            const color = a.kind === 'generic' ? MINI_COLORS[i % MINI_COLORS.length]  : HELPER_LOOK[a.kind].color
            const nameColor = a.isDone ? C.muted : a.kind === 'generic' ? C.cream : color
            return `
      ${mini(14, y, color, a.isDone, i, a.kind)}
      <text x="58" y="${y + 15}" font-size="12.5" font-weight="700" fill="${nameColor}">${esc(cut(a.label, 13))}<tspan font-size="10" font-weight="500" fill="${C.dim}"> ${esc(a.model)}</tspan></text>
      <text x="58" y="${y + 32}" font-size="11" fill="${a.isDone ? C.dim : C.muted}">${esc(cut(a.isDone ? `✓ fertig · ${a.tools} Schritte` : a.activity, 22))}</text>
      ${a.isDone ? '' : `<circle cx="186" cy="${y + 11}" r="3.5" fill="${color}" class="live"/>`}`
          })
          .join('')
  const more = d.moreAgents > 0 ? `<text x="20" y="${rowsTop + d.agents.length * rowH + 14}" font-size="11" fill="${C.dim}">+ ${d.moreAgents} weitere</text>` : ''
  const sideH = rowsTop + Math.max(1, d.agents.length) * rowH + (d.moreAgents > 0 ? 24 : 6)
  const running = d.agents.filter(a => !a.isDone).length

  // ---- Mitte: alle Chats mit Cockpit, an welchem Claude gerade arbeitet
  const chats = d.chats ?? []
  const chatsTop = Math.max(mainH, sideH) + 8
  const chatRowH = 36
  const chatsH = chats.length ? 46 + chats.length * chatRowH : 0
  const busy = chats.filter(c => c.state !== 'idle').length
  const chatRows = chats
    .map((c, i) => {
      const y = chatsTop + 44 + i * chatRowH
      const color = c.state === 'working' ? C.ember : c.state === 'thinking' ? C.amber : C.dim
      const right = c.state === 'idle' ? `wartet · ${c.ago}` : c.text
      return `
    <g>
      <title>${esc(`${c.title} (${c.project}): ${right}`)}</title>
      <rect x="16" y="${y}" width="${W - 32}" height="${chatRowH - 6}" rx="10" fill="#FFFFFF" fill-opacity="${c.state === 'idle' ? 0.03 : 0.07}" stroke="${color}" stroke-opacity="${c.state === 'idle' ? 0.12 : 0.45}"/>
      <circle cx="32" cy="${y + 15}" r="4.5" fill="${color}" class="${c.state === 'idle' ? '' : 'live'}"/>
      <text x="46" y="${y + 19.5}" font-size="12.5" font-weight="600" fill="${c.state === 'idle' ? C.muted : C.cream}">${esc(cut(c.title, 34))}<tspan font-size="10.5" font-weight="400" fill="${C.dim}"> ${esc(cut(c.project, 18))}${c.isThis ? ' · dieser Chat' : ''}</tspan></text>
      <text x="${W - 30}" y="${y + 19.5}" text-anchor="end" font-size="11.5" fill="${c.state === 'idle' ? C.dim : color}">${esc(cut(right, 30))}</text>
    </g>`
    })
    .join('')
  const chatsSvg = chats.length
    ? `
  <rect x="24" y="${chatsTop - 8}" width="${W - 48}" height="1" fill="url(#d-line)"/>
  <text x="20" y="${chatsTop + 22}" font-size="12" font-weight="600" fill="${C.ember}" letter-spacing="1.5">ZULETZT GENUTZTER CHAT</text>
  <text x="${W - 20}" y="${chatsTop + 22}" text-anchor="end" font-size="11" fill="${C.muted}">${busy ? 'Claude arbeitet dort gerade' : 'wartet auf dich'}</text>
  ${chatRows}`
    : ''

  // ---- unten: das feste Team, immer sichtbar
  const teamTop = chatsTop + chatsH
  // Bis vier Helfer in einer Reihe, mehr (sechs) in zwei Reihen zu je drei, etwas kleiner.
  const perRow = d.team.length > 4 ? 3 : Math.max(1, d.team.length)
  const teamRows = Math.ceil(d.team.length / perRow)
  const octoScale = teamRows > 1 ? 0.82 : 1
  const teamRowH = teamRows > 1 ? 178 : 212
  const cellW = W / perRow
  const teamH = 40 + teamRows * teamRowH
  const teamCells = d.team
    .map((m, idx) => {
      const look = HELPER_LOOK[m.kind]
      const i = idx % perRow
      const cx = cellW * i + cellW / 2
      const y = teamTop + 40 + Math.floor(idx / perRow) * teamRowH - (teamRows > 1 ? 4 : 0)
      const ty = y + 140 * octoScale - 140
      const dot =
        m.state === 'active' ? look.color : m.state === 'done' ? '#9BE3A8' : m.state === 'off' ? C.dim : C.muted
      const statusText = cut(m.text, 24)
      return `
    <g>
      <title>${esc(`${look.name} (${m.model}): ${look.role}. ${m.text}`)}</title>
      <g transform="translate(${(cx - 60 * octoScale).toFixed(1)} ${y}) scale(${octoScale})">${helperOcto(m.kind, m.state)}</g>
      <text x="${cx.toFixed(1)}" y="${ty + 158}" text-anchor="middle" font-size="15" font-weight="800" fill="${m.state === 'off' ? C.dim : look.color}">${esc(look.name)}<tspan font-size="10" font-weight="500" fill="${C.dim}"> ${esc(m.model)}</tspan></text>
      <text x="${cx.toFixed(1)}" y="${ty + 174}" text-anchor="middle" font-size="10.5" fill="${C.dim}">${esc(look.role)}</text>
      <circle cx="${(cx - statusText.length * 2.9 - 8).toFixed(1)}" cy="${ty + 187}" r="3.2" fill="${dot}" class="${m.state === 'active' ? 'live' : ''}"/>
      <text x="${cx.toFixed(1)}" y="${ty + 191}" text-anchor="middle" font-size="11.5" font-style="${m.state === 'idle' ? 'italic' : 'normal'}" fill="${m.state === 'active' ? C.cream : C.muted}">${esc(statusText)}</text>
    </g>`
    })
    .join('')
  const teamSvg = d.team.length
    ? `
  <rect x="24" y="${teamTop - 8}" width="${W - 48}" height="1" fill="url(#d-line)"/>
  <text x="20" y="${teamTop + 22}" font-size="12" font-weight="600" fill="${C.ember}" letter-spacing="1.5">DAS TEAM</text>
  <text x="${W - 20}" y="${teamTop + 22}" text-anchor="end" font-size="11" fill="${C.muted}">${esc(d.teamNote)}</text>
  ${teamCells}`
    : ''

  const H = teamTop + (d.team.length ? teamH : 0)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" ${FONT}>
  ${STYLE}
  <defs>
${DEFS}
    <clipPath id="d-clip"><rect width="${W}" height="${H}" rx="26"/></clipPath>
  </defs>

  <!-- ein großes Glas-Panel -->
  <rect width="${W}" height="${H}" rx="26" fill="url(#d-glass)"/>
  <g clip-path="url(#d-clip)">
    <g filter="url(#d-soft)">
      <circle class="blob1" cx="${SB + 80}" cy="${H * 0.75}" r="120" fill="url(#d-blob)"/>
      <circle class="blob2" cx="${W - 60}" cy="90" r="110" fill="url(#d-blob)"/>
      <circle cx="90" cy="150" r="110" fill="url(#d-blob)" opacity="0.8"/>
    </g>
    <rect width="${SB}" height="${chatsTop - 8}" fill="#FFFFFF" fill-opacity="0.025"/>
    <rect width="${W}" height="${H * 0.4}" fill="url(#d-sheen)"/>
  </g>
  <rect x="0.6" y="0.6" width="${W - 1.2}" height="${H - 1.2}" rx="25.5" fill="none" stroke="url(#d-edge)" stroke-width="1.3"/>
  <rect x="${SB}" y="24" width="1" height="${chatsTop - 48}" fill="url(#d-vline)"/>
  <rect x="${SB + 20}" y="${tileTop}" width="${MW - 40}" height="1" fill="url(#d-line)"/>
  <rect x="${SB + 20}" y="${tileTop + ch}" width="${MW - 40}" height="1" fill="url(#d-line)"/>
  <rect x="${SB + cw}" y="${tileTop + 16}" width="1" height="${ch * 2 - 32}" fill="url(#d-vline)"/>

  <!-- links: Okti -->
  <text x="20" y="34" font-size="12" font-weight="600" fill="${C.ember}" letter-spacing="1.5">OKTI · CLAUDE</text>
  <g transform="translate(14 42) scale(0.78)">${okti(d.mood, d.pose, d.isPoked)}</g>

  <rect x="14" y="${statusY}" width="${SB - 28}" height="${22 + statusLines.length * 17}" rx="12" fill="#FFFFFF" fill-opacity="0.06" stroke="${statusColor}" stroke-opacity="0.5"/>
  <circle cx="30" cy="${statusY + 19}" r="4.5" fill="${statusColor}" class="${d.status.state === 'idle' || d.status.state === 'sleepy' ? '' : 'pulse-dot'}" filter="url(#d-glow)"/>
  ${statusLines.map((l, i) => `<text x="42" y="${statusY + 23 + i * 17}" font-size="12.5" font-weight="600" fill="${C.cream}">${esc(l)}</text>`).join('')}

  <text x="20" y="${sayY - 2}" font-size="10.5" fill="${C.dim}" letter-spacing="1">OKTI SAGT</text>
  ${sayLines.map((l, i) => `<text x="20" y="${sayY + 16 + i * 16}" font-size="12" font-style="italic" fill="${C.muted}">${esc(l)}</text>`).join('')}

  <rect x="20" y="${agentsTop - 14}" width="${SB - 40}" height="1" fill="url(#d-line)"/>
  <text x="20" y="${agentsTop + 6}" font-size="12" font-weight="600" fill="${C.ember}" letter-spacing="1.5">WEITERE HELFER${running ? ` · ${running}` : ''}</text>
  <text x="20" y="${agentsTop + 22}" font-size="10.5" fill="${C.dim}">Agenten außerhalb des Teams</text>
  ${agentRows}
  ${more}

  <!-- rechts: Limits & Kontext -->
  <text x="${SB + 22}" y="34" font-size="12" font-weight="600" fill="${C.ember}" letter-spacing="1.5">LIMITS &amp; KONTEXT</text>
  ${rings}

  <!-- rechts: Kacheln -->
  ${tiles}

  <!-- Mitte: die Chats -->
  ${chatsSvg}

  <!-- unten: das Team -->
  ${teamSvg}
</svg>`
}

// ---------------------------------------------------------------- Kompakte Ansichten (Handy, Tablet)

                                       

/** Rahmen einer kompakten Grafik: Glas, Lichtflecken, Kante – wie das große Cockpit. */
function frame(id        , W        , H        , body        )         {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" ${FONT}>
  ${STYLE}
  <defs>
${DEFS}
    <clipPath id="${id}-clip"><rect width="${W}" height="${H}" rx="22"/></clipPath>
  </defs>
  <rect width="${W}" height="${H}" rx="22" fill="url(#d-glass)"/>
  <g clip-path="url(#${id}-clip)">
    <g filter="url(#d-soft)">
      <circle class="blob1" cx="${(W * 0.3).toFixed(0)}" cy="${(H * 0.75).toFixed(0)}" r="${Math.min(110, W / 3).toFixed(0)}" fill="url(#d-blob)"/>
      <circle class="blob2" cx="${W - 40}" cy="60" r="${Math.min(100, W / 3).toFixed(0)}" fill="url(#d-blob)"/>
    </g>
    <rect width="${W}" height="${(H * 0.4).toFixed(0)}" fill="url(#d-sheen)"/>
  </g>
  <rect x="0.6" y="0.6" width="${W - 1.2}" height="${H - 1.2}" rx="21.5" fill="none" stroke="url(#d-edge)" stroke-width="1.3"/>
  ${body}
</svg>`
}

function label(x        , y        , text        , anchor                  = 'start')         {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="11.5" font-weight="600" fill="${C.ember}" letter-spacing="1.4">${esc(text)}</text>`
}

/** Ein Limit- oder Kontext-Ring in beliebiger Größe. */
function ringSvg(ring      , cx        , cy        , r        , stroke        , detailMax        )         {
  const circ = 2 * Math.PI * r
  const has = ring.pct !== null
  const pct = ring.pct ?? 0
  const color = has ? levelColor(pct) : C.dim
  const dash = ((Math.min(100, Math.max(0, pct)) / 100) * circ).toFixed(1)
  const big = Math.round(r * 0.6)
  return `
    <g class="ring ${has && pct >= 85 ? 'hot' : ''}">
      <title>${esc(ring.tooltip)}</title>
      <circle cx="${cx}" cy="${cy}" r="${r + 10}" fill="transparent"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-opacity="0.14" stroke-width="${stroke}"/>
      <circle class="arc" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${has && pct >= 65 ? color : 'url(#d-arc)'}" stroke-width="${stroke}"
        stroke-linecap="round" stroke-dasharray="${dash} ${circ.toFixed(1)}" transform="rotate(-90 ${cx} ${cy})" filter="url(#d-glow)"/>
      <text x="${cx}" y="${cy + big * 0.3}" text-anchor="middle" font-size="${big}" font-weight="800" fill="${has ? C.cream : C.dim}">${has ? Math.round(pct) : '–'}<tspan font-size="${Math.round(big * 0.5)}" font-weight="600" fill="${C.muted}">${has ? '%' : ''}</tspan></text>
      <text x="${cx}" y="${cy + big * 0.3 + 14}" text-anchor="middle" font-size="${r > 44 ? 10.5 : 9}" fill="${C.muted}" letter-spacing="0.5">${esc(ring.label.toUpperCase())}</text>
      <text x="${cx}" y="${cy + r + stroke / 2 + 18}" text-anchor="middle" font-size="${r > 44 ? 12 : 10.5}" fill="${has ? C.muted : C.dim}">${esc(cut(ring.detail, detailMax))}</text>
    </g>`
}

function statusColor(state                         )         {
  return state === 'working' ? C.ember : state === 'thinking' ? C.amber : state === 'sleepy' ? C.dim : '#9BE3A8'
}

/** Status-Kasten und Spruch von Okti; gibt Grafik und Höhe zurück. */
function statusBlock(d      , x        , y        , w        , statusChars        , sayChars        )                             {
  const color = statusColor(d.status.state)
  const lines = wrap(d.status.text, statusChars, 2)
  const say = wrap(d.saying, sayChars, 3)
  const boxH = 20 + lines.length * 16
  const svg = `
  <rect x="${x}" y="${y}" width="${w}" height="${boxH}" rx="12" fill="#FFFFFF" fill-opacity="0.06" stroke="${color}" stroke-opacity="0.5"/>
  <circle cx="${x + 15}" cy="${y + 17}" r="4.5" fill="${color}" class="${d.status.state === 'idle' || d.status.state === 'sleepy' ? '' : 'pulse-dot'}" filter="url(#d-glow)"/>
  ${lines.map((l, i) => `<text x="${x + 28}" y="${y + 21 + i * 16}" font-size="12.5" font-weight="600" fill="${C.cream}">${esc(l)}</text>`).join('')}
  ${say.map((l, i) => `<text x="${x + 2}" y="${y + boxH + 20 + i * 15}" font-size="11.5" font-style="italic" fill="${C.muted}">${esc(l)}</text>`).join('')}`
  return { svg, h: boxH + 12 + say.length * 15 }
}

/** Das Team in einer Reihe: vier Oktopusse mit Name und Tätigkeit. */
function teamRow(d      , W        , top        , scale        , textMax        , x0 = 0)                             {
  const n = Math.max(1, d.team.length)
  // Zu schmal für alle nebeneinander (z. B. sechs auf dem Handy): auf zwei Reihen verteilen.
  const perRow = W / n < 120 * scale + 14 ? Math.ceil(n / 2) : n
  const rows = Math.ceil(n / perRow)
  const cellW = W / perRow
  const octoH = 150 * scale
  const rowH = octoH + 6 + 38 + (scale > 0.8 ? 0 : 12)
  textMax = Math.min(textMax, Math.max(10, Math.floor(cellW / 5.6)))
  const cells = d.team
    .map((m, idx) => {
      const look = HELPER_LOOK[m.kind]
      const i = idx % perRow
      const row = Math.floor(idx / perRow)
      const inRow = row === rows - 1 ? n - row * perRow : perRow
      const off = ((perRow - inRow) * cellW) / 2
      const cx = x0 + off + cellW * i + cellW / 2
      const y = top + 34 + row * rowH
      const dot = m.state === 'active' ? look.color : m.state === 'done' ? '#9BE3A8' : m.state === 'off' ? C.dim : C.muted
      // Schmal: Tätigkeit auf bis zu zwei Zeilen statt stark gekürzt.
      const lines = scale > 0.8 ? [cut(m.text, textMax)] : wrap(m.text, textMax, 2)
      const text = lines[0] ?? ''
      const ny = y + octoH + 6
      return `
    <g>
      <title>${esc(`${look.name} (${m.model}): ${look.role}. ${m.text}`)}</title>
      <g transform="translate(${(cx - 60 * scale).toFixed(1)} ${y}) scale(${scale})">${helperOcto(m.kind, m.state)}</g>
      <text x="${cx.toFixed(1)}" y="${ny}" text-anchor="middle" font-size="${scale > 0.8 ? 14.5 : 12.5}" font-weight="800" fill="${m.state === 'off' ? C.dim : look.color}">${esc(look.name)}</text>
      <text x="${cx.toFixed(1)}" y="${ny + 13}" text-anchor="middle" font-size="9.5" fill="${C.dim}">${esc(m.model)}</text>
      <circle cx="${(cx - text.length * (scale > 0.8 ? 2.8 : 2.45) - 7).toFixed(1)}" cy="${ny + 25}" r="3" fill="${dot}" class="${m.state === 'active' ? 'live' : ''}"/>
      ${lines.map((l, li) => `<text x="${cx.toFixed(1)}" y="${ny + 29 + li * 12}" text-anchor="middle" font-size="${scale > 0.8 ? 11 : 10}" font-style="${m.state === 'idle' ? 'italic' : 'normal'}" fill="${m.state === 'active' ? C.cream : C.muted}">${esc(l)}</text>`).join('')}
    </g>`
    })
    .join('')
  const svg = `
  <rect x="${x0 + 20}" y="${top}" width="${W - 40}" height="1" fill="url(#d-line)"/>
  ${label(x0 + 16, top + 22, 'DAS TEAM')}
  <text x="${x0 + W - 16}" y="${top + 22}" text-anchor="end" font-size="10.5" fill="${C.muted}">${esc(cut(d.teamNote, W < 400 ? 30 : 48))}</text>
  ${cells}`
  return { svg, h: 34 + rows * rowH }
}

/** Auf einen Blick: Okti mit Status, Limits und Kontext als Ringe, das ganze Team. */
function overviewSvg(d      , layout        )         {
  if (layout === 'phone') {
    const W = 360
    const head = statusBlock(d, 128, 44, W - 128 - 14, 22, 30)
    const headH = Math.max(150, 44 + head.h + 8)
    const ringTop = headH
    const r = 34
    const rings = d.rings.map((ring, i) => ringSvg(ring, Math.round((W / 6) * (2 * i + 1)), ringTop + 36 + r, r, 10, 19)).join('')
    const teamTop = ringTop + 36 + r * 2 + 44
    const team = teamRow(d, W, teamTop, 0.6, 13)
    const H = teamTop + team.h
    return frame('ov', W, H, `
  ${label(16, 30, 'OKTI · CLAUDE')}
  <g transform="translate(2 34) scale(0.52)">${okti(d.mood, d.pose, d.isPoked)}</g>
  ${head.svg}
  <rect x="20" y="${ringTop}" width="${W - 40}" height="1" fill="url(#d-line)"/>
  ${label(16, ringTop + 22, 'LIMITS & KONTEXT')}
  ${rings}
  ${team.svg}`)
  }
  // Tablet im Breitformat, damit alles auf einen Bildschirm passt:
  // links Okti mit Status, rechts oben die Ringe, rechts unten das Team.
  const W = TABLET_W
  const SB = 230
  const MW = W - SB
  const head = statusBlock(d, 14, 172, SB - 28, 26, 32)
  const leftH = 172 + head.h + 8
  const r = 42
  const step = MW / 3
  const rings = d.rings.map((ring, i) => ringSvg(ring, Math.round(SB + step * i + step / 2), 46 + r, r, 12, 22)).join('')
  const teamTop = 46 + r * 2 + 38
  const team = teamRow(d, MW, teamTop, 0.5, 24, SB)
  const H = Math.max(leftH, teamTop + team.h - 4)
  return frame('ov', W, H, `
  ${label(18, 30, 'OKTI · CLAUDE')}
  <g transform="translate(28 32) scale(0.55)">${okti(d.mood, d.pose, d.isPoked)}</g>
  ${head.svg}
  <rect x="${SB}" y="22" width="1" height="${H - 44}" fill="url(#d-vline)"/>
  ${label(SB + 20, 30, 'LIMITS & KONTEXT')}
  ${rings}
  ${team.svg}`)
}

/** Breite der Tablet-Grafiken: breit statt hoch, damit alles auf eine Seite passt. */
const TABLET_W = 900

/** Die vier Kacheln (Kontext, Cache, Session, Wert) zum Aufklappen. */
function tilesSvg(d      , layout        )         {
  const W = layout === 'phone' ? 360 : TABLET_W
  // Handy: untereinander (zum Aufklappen). Tablet: alle vier in einer flachen Reihe, immer sichtbar.
  const cols = layout === 'phone' ? 1 : 4
  const cw = W / cols
  const ch = 150
  const t = d.tiles
  const vw = cw - 40
  const sm = Math.floor(vw / 6.4)
  const at = (i        ) => [(i % cols) * cw, Math.floor(i / cols) * ch]         
  const [x0, y0] = at(0)
  const [x1, y1] = at(1)
  const [x2, y2] = at(2)
  const [x3, y3] = at(3)
  const ctxColor = t.ctx.pct === null ? C.ember : levelColor(t.ctx.pct)
  const ctxBar =
    t.ctx.pct === null
      ? ''
      : `<rect x="${x0 + 20}" y="${y0 + 104}" width="${vw}" height="5" rx="2.5" fill="#FFFFFF" fill-opacity="0.08"/>
         <rect x="${x0 + 20}" y="${y0 + 104}" width="${((vw * Math.min(100, t.ctx.pct)) / 100).toFixed(1)}" height="5" rx="2.5" fill="${ctxColor}" filter="url(#d-glow)"/>`
  const cacheLegend =
    t.cache.read + t.cache.write + t.cache.fresh > 0
      ? `${fmtK(t.cache.read)} Cache · ${fmtK(t.cache.write)} gespeichert · ${fmtK(t.cache.fresh)} neu`
      : 'Noch keine Antwort gemessen …'
  const rows = 4 / cols
  const lines = Array.from({ length: rows - 1 }, (_, i) => `<rect x="20" y="${(i + 1) * ch}" width="${W - 40}" height="1" fill="url(#d-line)"/>`).join('')
  const vline = Array.from({ length: cols - 1 }, (_, i) => `<rect x="${cw * (i + 1)}" y="16" width="1" height="${ch * rows - 32}" fill="url(#d-vline)"/>`).join('')
  return frame('tl', W, ch * rows, `
  ${lines}${vline}
  ${tileHead(x0, y0, '🧠', 'Kontext', t.ctx.value, t.ctx.sub, sm)}
  ${ctxBar}
  ${sparkline('k-sp1', x0 + 20, y0 + 114, vw, 24, t.ctx.series, ctxColor)}
  ${tileHead(x1, y1, '⚡', 'Cache', t.cache.value, t.cache.sub, sm)}
  ${stackBar(x1 + 20, y1 + 108, vw, [
    { v: t.cache.read, color: C.ember },
    { v: t.cache.write, color: C.amber },
    { v: t.cache.fresh, color: C.dim },
  ])}
  <text x="${x1 + 20}" y="${y1 + 134}" font-size="11" fill="${C.muted}">${esc(cut(cacheLegend, Math.floor(vw / 6.2)))}</text>
  ${tileHead(x2, y2, '⏱️', 'Session', t.session.value, t.session.sub, sm)}
  ${bars(x2 + 20, y2 + 106, vw, 32, t.session.bars, C.ember)}
  ${tileHead(x3, y3, '💸', 'Wert', t.cost.value, t.cost.sub, sm)}
  ${sparkline('k-sp2', x3 + 20, y3 + 108, vw, 30, t.cost.series, C.amber)}`)
}

/** Der zuletzt genutzte Chat und weitere Helfer außerhalb des Teams, zum Aufklappen. */
function moreSvg(d      , layout        )         {
  const W = layout === 'phone' ? 360 : TABLET_W
  const narrow = W < 400
  const chats = d.chats ?? []
  let y = 16
  let body = ''
  if (chats.length) {
    body += label(16, y + 14, 'ZULETZT GENUTZTER CHAT')
    y += 26
    for (const c of chats) {
      const color = c.state === 'working' ? C.ember : c.state === 'thinking' ? C.amber : C.dim
      const right = c.state === 'idle' ? `wartet · ${c.ago}` : c.text
      body += `
  <g><title>${esc(`${c.title} (${c.project}): ${right}`)}</title>
    <rect x="12" y="${y}" width="${W - 24}" height="${narrow ? 46 : 30}" rx="10" fill="#FFFFFF" fill-opacity="${c.state === 'idle' ? 0.03 : 0.07}" stroke="${color}" stroke-opacity="${c.state === 'idle' ? 0.12 : 0.45}"/>
    <circle cx="27" cy="${y + 15}" r="4.5" fill="${color}" class="${c.state === 'idle' ? '' : 'live'}"/>
    <text x="40" y="${y + 19.5}" font-size="12.5" font-weight="600" fill="${c.state === 'idle' ? C.muted : C.cream}">${esc(cut(c.title, narrow ? 34 : 40))}${narrow ? '' : `<tspan font-size="10.5" font-weight="400" fill="${C.dim}"> ${esc(cut(c.project, 18))}</tspan>`}</text>
    <text x="${narrow ? 40 : W - 26}" y="${narrow ? y + 36 : y + 19.5}" text-anchor="${narrow ? 'start' : 'end'}" font-size="11" fill="${c.state === 'idle' ? C.dim : color}">${esc(cut(narrow ? `${c.project} · ${right}` : right, narrow ? 44 : 34))}</text>
  </g>`
      y += narrow ? 54 : 36
    }
    y += 10
  }
  const running = d.agents.filter(a => !a.isDone).length
  body += label(16, y + 14, `WEITERE HELFER${running ? ` · ${running}` : ''}`)
  y += 24
  if (d.agents.length === 0) {
    body += `<text x="16" y="${y + 14}" font-size="11.5" fill="${C.dim}">Gerade keine Agenten außerhalb des Teams aktiv</text>`
    y += 28
  } else {
    d.agents.forEach((a, i) => {
      const color = a.kind === 'generic' ? MINI_COLORS[i % MINI_COLORS.length]  : HELPER_LOOK[a.kind].color
      body += `
  ${mini(10, y, color, a.isDone, i, a.kind)}
  <text x="54" y="${y + 15}" font-size="12.5" font-weight="700" fill="${a.isDone ? C.muted : C.cream}">${esc(cut(a.label, 30))}<tspan font-size="10" font-weight="500" fill="${C.dim}"> ${esc(a.model)}</tspan></text>
  <text x="54" y="${y + 32}" font-size="11" fill="${a.isDone ? C.dim : C.muted}">${esc(cut(a.isDone ? `✓ fertig · ${a.tools} Schritte` : a.activity, narrow ? 40 : 70))}</text>`
      y += 50
    })
    if (d.moreAgents > 0) {
      body += `<text x="16" y="${y + 10}" font-size="11" fill="${C.dim}">+ ${d.moreAgents} weitere</text>`
      y += 22
    }
  }
  return frame('mo', W, y + 8, body)
}

// ---------------------------------------------------------------- Skills-Galerie

/** Banner der Skills-Galerie: Glas, drei Mini-Oktopusse, Zahlen. */
function galleryHeaderSvg(s                                                                      )         {
  const W = 640
  const H = 132
  const stat = (x        , value        , label        ) => `
    <text x="${x}" y="98" font-size="26" font-weight="800" fill="${C.cream}">${value}</text>
    <text x="${x}" y="116" font-size="11" fill="${C.muted}" letter-spacing="0.8">${esc(label.toUpperCase())}</text>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" ${FONT}>
  <style>
    .mbob { animation: mbob 1.4s ease-in-out infinite; }
    @keyframes mbob { 50% { transform: translateY(-3px) rotate(-3deg); } }
    .blob1 { animation: blob1 12s ease-in-out infinite; }
    @keyframes blob1 { 50% { transform: translate(-120px, 20px); } }
  </style>
  <defs>
    <linearGradient id="g-glass" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="#2B1A12" stop-opacity="0.95"/><stop offset="1" stop-color="#0A0706" stop-opacity="0.98"/>
    </linearGradient>
    <linearGradient id="g-sheen" x1="0" y1="0" x2="0.9" y2="0.9">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.13"/><stop offset="0.4" stop-color="#FFFFFF" stop-opacity="0.02"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="g-edge" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${C.ember}" stop-opacity="0.9"/><stop offset="0.5" stop-color="${C.claude}" stop-opacity="0.15"/><stop offset="1" stop-color="${C.ember}" stop-opacity="0.6"/>
    </linearGradient>
    <radialGradient id="g-blob"><stop offset="0" stop-color="${C.ember}" stop-opacity="0.45"/><stop offset="1" stop-color="${C.claude}" stop-opacity="0"/></radialGradient>
    <filter id="g-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="20"/></filter>
    <clipPath id="g-clip"><rect width="${W}" height="${H}" rx="24"/></clipPath>
  </defs>
  <rect width="${W}" height="${H}" rx="24" fill="url(#g-glass)"/>
  <g clip-path="url(#g-clip)">
    <circle class="blob1" cx="${W - 80}" cy="40" r="110" fill="url(#g-blob)" filter="url(#g-soft)"/>
    <rect width="${W}" height="${H * 0.5}" fill="url(#g-sheen)"/>
  </g>
  <rect x="0.6" y="0.6" width="${W - 1.2}" height="${H - 1.2}" rx="23.5" fill="none" stroke="url(#g-edge)" stroke-width="1.3"/>
  <text x="24" y="40" font-size="12" font-weight="600" fill="${C.ember}" letter-spacing="1.5">🧩 SKILLS-GALERIE</text>
  <text x="24" y="62" font-size="13" fill="${C.muted}">Alles, was Claude für dich kann. Einfügen, ausprobieren, erklären lassen.</text>
  ${stat(24, s.skills, 'Skills')}
  ${stat(130, s.total, 'Befehle gesamt')}
  ${stat(270, s.categories, 'Kategorien')}
  ${stat(390, s.shown, 'gefunden')}
  ${mini(520, 74, '#FF9B5E', false, 0)}
  ${mini(556, 66, '#FFC15E', false, 1)}
  ${mini(592, 74, '#F27D63', false, 2)}
</svg>`
}

/** Breite und Höhe aus der viewBox eines SVG lesen. */
function viewBoxSize(svg        )                           {
  const m = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg)
  return m ? { w: Number(m[1]), h: Number(m[2]) } : { w: 640, h: 400 }
}

/** Pixelbreite für ein SVG im Panel: Zellen grob in Pixel, mal Zoom, begrenzt. */
function fitWidth(bodyColumns                    , zoom        , max        )         {
  const cols = bodyColumns && bodyColumns > 0 ? bodyColumns : 90
  const px = cols * 8.2 - 24
  return Math.round(Math.max(320, Math.min(max, px)) * zoom)
}

window.WIR_COCKPIT_SVG = { C, HELPER_LOOK, esc, levelColor, fmtK, dashboardSvg, overviewSvg, tilesSvg, moreSvg, galleryHeaderSvg, viewBoxSize, fitWidth };
})();
