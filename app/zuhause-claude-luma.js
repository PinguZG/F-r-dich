// Luma, der Limit-Coach (07.11.2026): wertet den Verlauf aus, den der Cockpit-Mod an /api/cockpit/verlauf schickt
// (je Tag: Antworten, Verbrauch, Helfer, Limit-Spitzen, Antworten je Stunde), und schreibt daraus Analyse und Tipps.
// Läuft komplett in der App – kostet kein Nutzungslimit. Ausgabe: HTML für das Shadow-DOM von zuhause-claude.js.
(() => {
  const DAY = 864e5;
  const pad = n => String(n).padStart(2, '0');
  const keyOf = t => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const k = n => (n >= 1e6 ? (n / 1e6).toFixed(1).replace('.', ',') + ' Mio.' : n >= 1000 ? Math.round(n / 1000) + 'k' : String(Math.round(n)));
  const pct = n => `${Math.round(n)} %`;

  // Summe über die Tage [von, bis) relativ zu heute (0 = heute)
  function range(days, now, from, to) {
    const s = { turns: 0, units: 0, helperUnits: 0, helperAtMain: 0, peak5h: 0, peakWeek: 0, n: 0, hot: 0, hours: Array(24).fill(0), list: [] };
    for (let i = from; i < to; i++) {
      const t = now - i * DAY, key = keyOf(t), d = days[key];
      s.list.push({ key, t, d: d || null });
      if (!d) continue;
      s.n += d.turns > 0 ? 1 : 0;
      s.turns += d.turns || 0; s.units += d.units || 0;
      s.helperUnits += d.helperUnits || 0; s.helperAtMain += d.helperAtMain || 0;
      s.peak5h = Math.max(s.peak5h, d.peak5h || 0); s.peakWeek = Math.max(s.peakWeek, d.peakWeek || 0);
      if ((d.peak5h || 0) >= 80) s.hot++;
      (d.hours || []).forEach((v, h) => { s.hours[h] += v || 0; });
    }
    s.list.reverse();
    s.perTurn = s.turns ? s.units / s.turns : 0;
    const all = s.units + s.helperUnits;
    s.helperShare = all ? (s.helperUnits / all) * 100 : 0;
    s.saved = Math.max(0, s.helperAtMain - s.helperUnits);
    return s;
  }

  // Vergleich: weniger Verbrauch je Antwort = besser. Unter 10 % Unterschied = gleich.
  function trend(cur, prev) {
    if (!cur.turns || !prev.turns) return { dir: 'neu', diff: 0 };
    const diff = ((cur.perTurn - prev.perTurn) / prev.perTurn) * 100;
    return { dir: diff <= -10 ? 'besser' : diff >= 10 ? 'schlechter' : 'gleich', diff };
  }

  const SPANS = {
    tag: { label: 'Heute', cur: [0, 1], prev: [1, 8], vs: 'gegen den Schnitt der letzten 7 Tage' },
    woche: { label: '7 Tage', cur: [0, 7], prev: [7, 14], vs: 'gegen die Woche davor' },
    monat: { label: '30 Tage', cur: [0, 30], prev: [30, 60], vs: 'gegen die 30 Tage davor' },
  };

  function analyse(verlauf, now, span) {
    const days = (verlauf && verlauf.days) || {};
    const sp = SPANS[span] || SPANS.woche;
    const cur = range(days, now, ...sp.cur), prev = range(days, now, ...sp.prev);
    if (span === 'tag' && prev.n) {   // Tag gegen Tagesschnitt: auf einen Tag herunterrechnen
      prev.turns /= prev.n; prev.units /= prev.n;
    }
    const tr = trend(cur, prev);
    const total = Object.keys(days).length;
    const week = range(days, now, 0, 7), month = range(days, now, 0, 30);
    const busiest = month.hours.indexOf(Math.max(...month.hours));
    return { span, sp, cur, prev, tr, total, week, month, busiest, tips: tips(cur, prev, tr, week, month, busiest, total) };
  }

  // Tipps nach Wichtigkeit: was gerade am meisten Limit kostet zuerst, Lob am Ende
  function tips(cur, prev, tr, week, month, busiest, total) {
    const out = [];
    if (total < 3) out.push({ ic: '🌱', t: 'Ich sammle noch Daten', s: 'Nach ein paar Tagen mit Claude Code kann ich dir sagen, wie du dein Limit nutzt und was sich ändert.' });
    if (tr.dir === 'schlechter') out.push({ ic: '🧵', t: 'Chats früher neu starten', s: `Jede Antwort kostet gerade ${Math.round(tr.diff)} % mehr als vorher. Lange Chats schicken bei jeder Nachricht den ganzen Verlauf mit – bei einem neuen Thema lieber einen neuen Chat beginnen oder komprimieren.` });
    if (week.hot >= 2) out.push({ ic: '⏱️', t: 'Arbeit über den Tag verteilen', s: `An ${week.hot} Tagen war das 5-Stunden-Limit über 80 %. Zwei kürzere Blöcke mit Pause dazwischen reichen weiter als ein langer.` });
    else if (week.peak5h >= 80) out.push({ ic: '⏱️', t: 'Das 5-Stunden-Limit war knapp', s: `Spitze diese Woche: ${pct(week.peak5h)}. Große Aufgaben lieber am Anfang eines 5-Stunden-Fensters starten.` });
    if (week.peakWeek >= 70) out.push({ ic: '📅', t: 'Wochenlimit im Blick behalten', s: `Das Wochenlimit stand bei ${pct(week.peakWeek)}. Kleine Fragen bündeln: eine ausführliche Nachricht kostet weniger als fünf kurze Nachfragen.` });
    if (cur.turns >= 15 && cur.helperShare < 12) out.push({ ic: '🐙', t: 'Mehr an das Team abgeben', s: `Nur ${pct(cur.helperShare)} der Arbeit haben Helfer gemacht. Sag ruhig „nimm Helfer dafür“: Pip und Inky suchen und lesen viel günstiger.` });
    if (cur.perTurn > 0 && prev.perTurn > 0 && cur.perTurn > prev.perTurn * 1.4) out.push({ ic: '📄', t: 'Weniger auf einmal lesen lassen', s: 'Sehr teure Antworten entstehen oft, wenn ganze Ordner oder lange Seiten gelesen werden. Sag genauer, wo Claude suchen soll.' });
    out.push({ ic: '☕', t: 'Pausen kosten Cache', s: 'Nach etwa 5 Minuten Pause verfällt der Cache, die nächste Nachricht ist dann teurer. Kurze Rückfragen lieber gleich beantworten.' });
    if (busiest >= 0 && month.turns > 30) out.push({ ic: '🕰️', t: `Deine Hauptzeit: ${busiest}–${busiest + 1} Uhr`, s: 'Läuft dort oft das 5-Stunden-Limit voll, lohnt es sich, Größeres davor zu starten.' });
    if (tr.dir === 'besser') out.push({ ic: '✨', t: 'Weiter so', s: `Jede Antwort kostet ${Math.round(-tr.diff)} % weniger als vorher. Was du gerade machst, funktioniert.`, good: true });
    if (cur.saved > 0 && cur.helperUnits > 0) out.push({ ic: '💸', t: 'Das Team hat gespart', s: `Ohne Helfer hätte dieselbe Arbeit etwa ${k(cur.saved)} Verbrauchspunkte mehr gekostet.`, good: true });
    return out.slice(0, 5);
  }

  // Säulen: Woche/Monat je Tag den Verbrauch, Tag je Stunde die Antworten. Dünne Säulen, runde Enden, Wert beim Antippen.
  function bars(a) {
    const W = 600, H = 150, top = 14, base = 120;
    let items;
    if (a.span === 'tag') {
      const d = a.cur.list[0].d;
      items = (d ? d.hours : Array(24).fill(0)).map((v, h) => ({ v: v || 0, lab: h % 3 === 0 ? String(h) : '', tip: `${h}–${h + 1} Uhr: ${v || 0} Antworten`, now: h === new Date().getHours() }));
    } else {
      items = a.cur.list.map((x, i, arr) => {
        const dt = new Date(x.t), v = x.d ? (x.d.units || 0) + (x.d.helperUnits || 0) : 0;
        const lab = a.span === 'woche' ? WD[dt.getDay()] : (i % 5 === 0 || i === arr.length - 1) ? `${dt.getDate()}.` : '';
        return { v, lab, tip: `${WD[dt.getDay()]} ${dt.getDate()}.${dt.getMonth() + 1}.: ${k(v)} Verbrauch · ${x.d ? x.d.turns : 0} Antworten${x.d && x.d.peak5h ? ` · 5-Std.-Spitze ${pct(x.d.peak5h)}` : ''}`, now: i === arr.length - 1, hot: x.d && x.d.peak5h >= 80 };
      });
    }
    const max = Math.max(1, ...items.map(i => i.v));
    const step = W / items.length, bw = Math.max(4, Math.min(28, step * 0.55));
    const avg = items.reduce((s, i) => s + i.v, 0) / Math.max(1, items.filter(i => i.v > 0).length);
    const ay = base - (avg / max) * (base - top);
    const cols = items.map((it, i) => {
      const x = i * step + step / 2, h = it.v ? Math.max(3, (it.v / max) * (base - top)) : 0;
      const r = Math.min(4, bw / 2, h);
      const path = h ? `M${(x - bw / 2).toFixed(1)} ${base}V${(base - h + r).toFixed(1)}q0 -${r} ${r} -${r}h${(bw - 2 * r).toFixed(1)}q${r} 0 ${r} ${r}V${base}Z` : '';
      return `<g class="hit" data-tip="${esc(it.tip)}"><rect x="${(x - step / 2).toFixed(1)}" y="0" width="${step.toFixed(1)}" height="${H}" fill="transparent"/>`
        + (path ? `<path d="${path}" class="${it.now ? 'bar now' : it.hot ? 'bar hot' : 'bar'}"/>` : `<rect x="${(x - 1.5).toFixed(1)}" y="${base - 2}" width="3" height="2" rx="1" class="zero"/>`)
        + (it.lab ? `<text x="${x.toFixed(1)}" y="${base + 18}" text-anchor="middle" class="ax${it.now ? ' axn' : ''}">${it.lab}</text>` : '') + '</g>';
    }).join('');
    const avgLine = items.some(i => i.v) ? `<line x1="0" x2="${W}" y1="${ay.toFixed(1)}" y2="${ay.toFixed(1)}" class="avg"/><text x="${W}" y="${(ay - 5).toFixed(1)}" text-anchor="end" class="ax">Ø</text>` : '';
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${a.span === 'tag' ? 'Antworten je Stunde heute' : 'Verbrauch je Tag'}"><line x1="0" x2="${W}" y1="${base}" y2="${base}" class="base"/>${avgLine}${cols}</svg>`;
  }

  const TR = {
    besser: ['↘', 'sparsamer', 'good'], schlechter: ['↗', 'teurer', 'bad'], gleich: ['→', 'wie vorher', 'same'], neu: ['·', 'noch kein Vergleich', 'same'],
  };

  function html(verlauf, now, span) {
    if (!verlauf || !verlauf.days || !Object.keys(verlauf.days).length) {
      return `<div class="lu"><p class="lu-empty">Luma wartet auf den ersten Verlauf. Er kommt, sobald das Cockpit in Claude Code läuft (alle 10 Minuten).</p></div>`;
    }
    const a = analyse(verlauf, now, span);
    const [arrow, word, cls] = TR[a.tr.dir];
    const c = a.cur;
    const head = a.tr.dir === 'neu' ? 'Für einen Vergleich fehlen noch Tage – hier ist, was ich schon sehe.'
      : a.tr.dir === 'besser' ? `Du nutzt dein Limit sparsamer: ${Math.round(-a.tr.diff)} % weniger je Antwort.`
        : a.tr.dir === 'schlechter' ? `Jede Antwort kostet ${Math.round(a.tr.diff)} % mehr – hier lässt sich sparen.`
          : 'Dein Verbrauch je Antwort ist stabil.';
    const seg = Object.entries(SPANS).map(([id, s]) => `<button type="button" data-span="${id}" class="${id === a.span ? 'on' : ''}" aria-pressed="${id === a.span}">${s.label}</button>`).join('');
    const stat = (v, l, sub = '') => `<div class="st"><b>${v}</b><span>${l}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
    const tips = a.tips.map(t => `<li class="${t.good ? 'good' : ''}"><i aria-hidden="true">${t.ic}</i><div><b>${esc(t.t)}</b><span>${esc(t.s)}</span></div></li>`).join('');
    return `<div class="lu">
      <div class="lu-seg" role="group" aria-label="Zeitraum">${seg}</div>
      <div class="lu-head"><span class="lu-tr ${cls}"><b aria-hidden="true">${arrow}</b>${word}</span><p>${esc(head)}<small>${esc(a.sp.vs)}</small></p></div>
      <div class="lu-stats">
        ${stat(String(Math.round(c.turns)), 'Antworten', a.span === 'tag' ? '' : `${c.n} aktive Tage`)}
        ${stat(c.perTurn ? k(c.perTurn) : '–', 'je Antwort', 'Verbrauchspunkte')}
        ${stat(pct(c.helperShare), 'vom Team', c.saved ? `${k(c.saved)} gespart` : '')}
        ${stat(c.peak5h ? pct(c.peak5h) : '–', '5-Std.-Spitze', c.peakWeek ? `Woche ${pct(c.peakWeek)}` : '')}
      </div>
      <div class="lu-chart"><div class="lu-ct"><span>${a.span === 'tag' ? 'Antworten je Stunde' : 'Verbrauch je Tag'}${a.span !== 'tag' && a.cur.hot ? '<i class="lu-hot">5-Std.-Limit über 80 %</i>' : ''}</span><em class="lu-tip">antippen für Werte</em></div>${bars(a)}</div>
      <ul class="lu-tips">${tips}</ul>
    </div>`;
  }

  const CSS = `
    .lu{display:grid;gap:12px;padding:6px 10px 12px;color:#F6E7DA}
    .lu-empty{margin:4px 6px 8px;color:#B09A8A;font-size:14px;line-height:1.45}
    .lu-seg{display:flex;gap:4px;padding:3px;border-radius:14px;background:rgba(255,255,255,.05);justify-self:start}
    .lu-seg button{font:inherit;font-size:13px;font-weight:600;color:#B09A8A;background:none;border:0;border-radius:11px;padding:7px 14px;cursor:pointer;-webkit-tap-highlight-color:transparent}
    .lu-seg button.on{background:rgba(127,200,255,.16);color:#CFE9FF}
    .lu-seg button:focus-visible,.hit:focus-visible{outline:2px solid #7FC8FF;outline-offset:2px}
    .lu-head{display:flex;gap:12px;align-items:flex-start}
    .lu-tr{flex:none;display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:5px 11px 5px 9px;font-size:13px;font-weight:650}
    .lu-tr b{font-size:16px;line-height:1}
    .lu-tr.good{background:rgba(95,224,160,.14);color:#8EF0BE}.lu-tr.bad{background:rgba(255,107,122,.14);color:#FF9AA5}.lu-tr.same{background:rgba(255,255,255,.07);color:#C9B8AA}
    .lu-head p{margin:2px 0 0;font-size:15px;line-height:1.35;font-weight:600}
    .lu-head small{display:block;font-size:12px;font-weight:400;color:#8F7B6D;margin-top:2px}
    .lu-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
    .st{border-radius:16px;background:rgba(255,255,255,.04);border:1px solid rgba(127,200,255,.14);padding:10px 12px;display:grid;gap:1px;min-width:0}
    .st b{font-size:22px;font-weight:700;letter-spacing:-.3px;font-variant-numeric:tabular-nums}
    .st span{font-size:12px;color:#C9B8AA}.st small{font-size:11px;color:#8F7B6D;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .lu-chart{border-radius:16px;background:rgba(0,0,0,.25);padding:10px 12px 4px}
    .lu-ct{display:flex;justify-content:space-between;align-items:baseline;font-size:12px;color:#C9B8AA;margin-bottom:4px;gap:8px}
    .lu-tip{font-style:normal;color:#8F7B6D;text-align:right;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .lu-tip.set{color:#CFE9FF}
    .lu-hot{font-style:normal;margin-left:10px;color:#C9B8AA}.lu-hot::before{content:"";display:inline-block;width:9px;height:9px;border-radius:3px;background:#FFC15E;opacity:.8;margin-right:5px}
    .lu-chart svg{max-height:190px}
    .lu-chart svg{display:block;width:100%;height:auto;border-radius:0}
    .bar{fill:#7FC8FF;opacity:.55}.bar.now{opacity:1}.bar.hot{fill:#FFC15E;opacity:.75}
    .hit.sel .bar{opacity:1;stroke:#F6E7DA;stroke-width:1.5}
    .zero{fill:#5A4A40}.base{stroke:#3A2E28;stroke-width:1}.avg{stroke:#8F7B6D;stroke-width:1;stroke-dasharray:3 4}
    .ax{font-size:11px;fill:#8F7B6D}.axn{fill:#CFE9FF;font-weight:600}
    .hit{cursor:pointer}
    .lu-tips{list-style:none;margin:0;padding:0;display:grid;gap:8px}
    .lu-tips li{display:flex;gap:11px;align-items:flex-start;border-radius:16px;padding:10px 12px;background:rgba(255,255,255,.035);border-left:3px solid rgba(127,200,255,.5)}
    .lu-tips li.good{border-left-color:rgba(95,224,160,.6)}
    .lu-tips i{font-style:normal;font-size:18px;line-height:1.2}
    .lu-tips b{display:block;font-size:14px;font-weight:650;margin-bottom:1px}
    .lu-tips span{font-size:13px;line-height:1.4;color:#C9B8AA}
    .wrap.tab .lu-tips{grid-template-columns:1fr 1fr}
    @media (max-width:520px){.lu-stats{grid-template-columns:1fr 1fr}.st b{font-size:20px}}
    .vl{padding:0 6px 6px}.vl svg{border-radius:16px}
    .vl-empty{margin:4px 10px 10px;color:#B09A8A;font-size:14px}`;

  window.WIR_LUMA = { analyse, html, CSS };
})();
