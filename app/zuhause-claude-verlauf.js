// Claude-Cockpit-Verlauf (automatisch erzeugt aus dem Cockpit-Mod, hooks/historyview.ts – nicht von Hand bearbeiten).
// Zeichnet aus dem Verlauf, den der Mod an /api/cockpit/verlauf schickt, dieselbe Verlaufs-Ansicht wie in der Claude-App.
(() => {
const { C, HELPER_LOOK, esc, fmtK } = window.WIR_COCKPIT_SVG;
// Reine Zeichen- und Rechenfunktionen des Verlaufs (ohne Engine), auch außerhalb des Mods nutzbar.

                                                     
                                       

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

function pad(n        )         {
  return n < 10 ? `0${n}` : String(n)
}

function dayKey(ms        )         {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function emptyDay()           {
  return {
    turns: 0,
    out: 0,
    units: 0,
    helperUnits: 0,
    helperAtMain: 0,
    peak5h: 0,
    peakWeek: 0,
    hours: Array.from({ length: 24 }, () => 0),
    helpers: {},
  }
}

                       
                                                                                         
                 
                   
                  
                  
                 
                                 
                  
 

function summarize(h             , now        )          {
  const days = Array.from({ length: 14 }, (_, i) => {
    const ms = now - (13 - i) * 86_400_000
    const key = dayKey(ms)
    const d = new Date(ms)
    return {
      key,
      label: WEEKDAYS[d.getDay()] ?? '',
      date: `${d.getDate()}.`,
      isToday: i === 13,
      stats: { ...emptyDay(), ...h.days[key] },
    }
  })
  const active = days.filter(d => d.stats.turns > 0)
  const all = Object.values(h.days)
  const helperUnits = all.reduce((s, d) => s + d.helperUnits, 0)
  const helperAtMain = all.reduce((s, d) => s + d.helperAtMain, 0)
  const hours = Array.from({ length: 24 }, (_, i) => days.reduce((s, d) => s + (d.stats.hours[i] ?? 0), 0))
  const helpers                         = {}
  for (const d of days) for (const [k, v] of Object.entries(d.stats.helpers)) helpers[k] = (helpers[k] ?? 0) + v
  return {
    days,
    today: days[13] .stats,
    weekTurns: days.slice(-7).reduce((s, d) => s + d.stats.turns, 0),
    avgTurns: active.length ? Math.round(active.reduce((s, d) => s + d.stats.turns, 0) / active.length) : 0,
    savedPct: helperAtMain > 0 ? Math.round((1 - helperUnits / helperAtMain) * 100) : 0,
    hours,
    helpers,
    hasData: all.some(d => d.turns > 0),
  }
}

function historySvg(s         )         {
  const W = 640
  const H = 560

  const kpi = (x        , value        , label        ) => `
    <text x="${x}" y="96" font-size="26" font-weight="800" fill="${C.cream}">${esc(value)}</text>
    <text x="${x}" y="114" font-size="10.5" fill="${C.muted}" letter-spacing="0.8">${esc(label.toUpperCase())}</text>`

  // Balken: Verbrauch je Tag (Hauptchat + Helfer), dazu Spitze des 5-Std.-Limits als Punkte
  const chartX = 40
  const chartY = 160
  const chartW = W - 80
  const chartH = 130
  const maxUnits = Math.max(1, ...s.days.map(d => d.stats.units + d.stats.helperUnits))
  const step = chartW / s.days.length
  const bw = step * 0.62
  const bars = s.days
    .map((d, i) => {
      const x = chartX + i * step + (step - bw) / 2
      const mainH = (d.stats.units / maxUnits) * chartH
      const helpH = (d.stats.helperUnits / maxUnits) * chartH
      const base = chartY + chartH
      const peak = d.stats.peak5h
      const py = chartY + chartH - (peak / 100) * chartH
      return `
      <g>
        <title>${esc(`${d.label} ${d.date}: ${d.stats.turns} Antworten, ${fmtK(d.stats.out)} Tokens geschrieben${peak ? `, 5-Std.-Limit bis ${Math.round(peak)} %` : ''}`)}</title>
        <rect x="${x.toFixed(1)}" y="${chartY}" width="${bw.toFixed(1)}" height="${chartH}" fill="transparent"/>
        ${mainH > 0 ? `<rect x="${x.toFixed(1)}" y="${(base - mainH).toFixed(1)}" width="${bw.toFixed(1)}" height="${mainH.toFixed(1)}" rx="3" fill="${d.isToday ? C.ember : C.claude}" fill-opacity="${d.isToday ? 1 : 0.75}"/>` : `<rect x="${x.toFixed(1)}" y="${base - 2}" width="${bw.toFixed(1)}" height="2" rx="1" fill="${C.dim}" fill-opacity="0.4"/>`}
        ${helpH > 0 ? `<rect x="${x.toFixed(1)}" y="${(base - mainH - helpH).toFixed(1)}" width="${bw.toFixed(1)}" height="${helpH.toFixed(1)}" rx="3" fill="#4FD1C5" fill-opacity="0.8"/>` : ''}
        ${peak > 0 ? `<circle cx="${(x + bw / 2).toFixed(1)}" cy="${py.toFixed(1)}" r="3.5" fill="${C.amber}" stroke="#0A0706" stroke-width="1.2"/>` : ''}
        <text x="${(x + bw / 2).toFixed(1)}" y="${base + 16}" text-anchor="middle" font-size="10.5" font-weight="${d.isToday ? 700 : 400}" fill="${d.isToday ? C.ember : C.muted}">${d.label}</text>
        <text x="${(x + bw / 2).toFixed(1)}" y="${base + 29}" text-anchor="middle" font-size="9.5" fill="${C.dim}">${d.date}</text>
      </g>`
    })
    .join('')

  // Heatmap: Antworten je Stunde (letzte 14 Tage)
  const hmY = 372
  const maxHour = Math.max(1, ...s.hours)
  const cw = (W - 80) / 24
  const heat = s.hours
    .map((v, i) => {
      const a = v === 0 ? 0.06 : 0.18 + 0.82 * (v / maxHour)
      return `<rect x="${(40 + i * cw + 1).toFixed(1)}" y="${hmY}" width="${(cw - 2).toFixed(1)}" height="26" rx="4" fill="${C.ember}" fill-opacity="${a.toFixed(2)}"><title>${i}–${i + 1} Uhr: ${v} Antworten</title></rect>`
    })
    .join('')
  const hourLabels = [0, 6, 12, 18, 23]
    .map(i => `<text x="${(40 + i * cw + cw / 2).toFixed(1)}" y="${hmY + 42}" text-anchor="middle" font-size="10" fill="${C.dim}">${i} Uhr</text>`)
    .join('')

  // Team: Einsätze je Helfer (letzte 14 Tage)
  const kinds               = ['pip', 'bubbles', 'inky', 'coral', 'shelly', 'luma', 'generic']
  const maxRuns = Math.max(1, ...kinds.map(k => s.helpers[k] ?? 0))
  const teamY = 470
  const colW = (W - 80) / kinds.length
  const team = kinds
    .map((k, i) => {
      const look = HELPER_LOOK[k]
      const runs = s.helpers[k] ?? 0
      const x = 40 + i * colW
      const bwid = ((colW - 24) * runs) / maxRuns
      return `
      <circle cx="${x + 6}" cy="${teamY - 4}" r="5" fill="${look.color}"/>
      <text x="${x + 16}" y="${teamY}" font-size="12" font-weight="700" fill="${look.color}">${esc(k === 'generic' ? 'Andere' : look.name)}</text>
      <rect x="${x}" y="${teamY + 10}" width="${colW - 24}" height="8" rx="4" fill="#FFFFFF" fill-opacity="0.07"/>
      ${runs > 0 ? `<rect x="${x}" y="${teamY + 10}" width="${bwid.toFixed(1)}" height="8" rx="4" fill="${look.color}"/>` : ''}
      <text x="${x}" y="${teamY + 36}" font-size="11" fill="${C.muted}">${runs} ${runs === 1 ? 'Einsatz' : 'Einsätze'}</text>`
    })
    .join('')

  const empty = s.hasData
    ? ''
    : `<text x="${W / 2}" y="${chartY + chartH / 2}" text-anchor="middle" font-size="14" fill="${C.muted}">Noch keine Daten. Ab jetzt zählt jede Antwort mit ✨</text>`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="'Segoe UI', system-ui, -apple-system, sans-serif">
  <defs>
    <linearGradient id="v-glass" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="#2B1A12" stop-opacity="0.95"/><stop offset="1" stop-color="#0A0706" stop-opacity="0.98"/>
    </linearGradient>
    <linearGradient id="v-sheen" x1="0" y1="0" x2="0.9" y2="0.9">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.12"/><stop offset="0.3" stop-color="#FFFFFF" stop-opacity="0.02"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="v-edge" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${C.ember}" stop-opacity="0.9"/><stop offset="0.5" stop-color="${C.claude}" stop-opacity="0.15"/><stop offset="1" stop-color="${C.ember}" stop-opacity="0.6"/>
    </linearGradient>
    <linearGradient id="v-line" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${C.ember}" stop-opacity="0"/><stop offset="0.5" stop-color="${C.ember}" stop-opacity="0.35"/><stop offset="1" stop-color="${C.ember}" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="v-clip"><rect width="${W}" height="${H}" rx="26"/></clipPath>
  </defs>
  <rect width="${W}" height="${H}" rx="26" fill="url(#v-glass)"/>
  <g clip-path="url(#v-clip)"><rect width="${W}" height="${H * 0.35}" fill="url(#v-sheen)"/></g>
  <rect x="0.6" y="0.6" width="${W - 1.2}" height="${H - 1.2}" rx="25.5" fill="none" stroke="url(#v-edge)" stroke-width="1.3"/>

  <text x="24" y="38" font-size="12" font-weight="600" fill="${C.ember}" letter-spacing="1.5">📈 VERLAUF · LETZTE 14 TAGE</text>
  ${kpi(24, String(s.today.turns), 'Antworten heute')}
  ${kpi(170, String(s.weekTurns), 'diese 7 Tage')}
  ${kpi(300, String(s.avgTurns), 'Ø pro aktivem Tag')}
  ${kpi(450, s.savedPct > 0 ? `${s.savedPct} %` : '–', 'gespart durchs Team')}

  <rect x="24" y="${chartY - 22}" width="${W - 48}" height="1" fill="url(#v-line)"/>
  <text x="24" y="${chartY - 4}" font-size="11" fill="${C.muted}">Verbrauch je Tag</text>
  <g font-size="10.5" fill="${C.muted}">
    <rect x="${W - 300}" y="${chartY - 13}" width="10" height="10" rx="2" fill="${C.claude}"/><text x="${W - 285}" y="${chartY - 4}">Hauptchat</text>
    <rect x="${W - 210}" y="${chartY - 13}" width="10" height="10" rx="2" fill="#4FD1C5"/><text x="${W - 195}" y="${chartY - 4}">Helfer</text>
    <circle cx="${W - 135}" cy="${chartY - 8}" r="4" fill="${C.amber}"/><text x="${W - 126}" y="${chartY - 4}">Spitze 5-Std.-Limit</text>
  </g>
  ${bars}
  ${empty}

  <rect x="24" y="${hmY - 30}" width="${W - 48}" height="1" fill="url(#v-line)"/>
  <text x="24" y="${hmY - 10}" font-size="11" fill="${C.muted}">Wann du am meisten mit Claude arbeitest</text>
  ${heat}
  ${hourLabels}

  <rect x="24" y="${teamY - 34}" width="${W - 48}" height="1" fill="url(#v-line)"/>
  <text x="24" y="${teamY - 16}" font-size="11" fill="${C.muted}">Einsätze des Teams</text>
  ${team}
</svg>`
}

window.WIR_COCKPIT_VERLAUF = { dayKey, emptyDay, summarize, historySvg };
})();
