// Stimmung + Mentaler Support (Start-Karte). Stimmung: runder Drehregler 0–100 %, Farbe/Emoji folgen dem Wert, Verlauf der
// letzten 14 Tage als Kurve (beide). Unter 50 % meldet der Server einmal an die andere Person (pb_hooks/chat_lib.js).
// Support: „Ich brauche dich“ mit Art + kurzer Nachricht -> Push; Antwort („Bin da 💗“ …) kommt zurück und wird angezeigt.
(() => {
  const pb = window.WIR_PB;
  const $ = id => document.getElementById(id);
  const myId = () => (pb.authStore.record || pb.authStore.model)?.id;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const pbMs = s => s ? Date.parse(String(s).replace(' ', 'T')) : 0;
  const post = (path, body = {}) => pb.send(path, { method: 'POST', body });
  const partner = () => window.WIR_LOOK?.partner();
  const pname = () => partner()?.name || 'Schatz';
  let started = false, moods = [], support = [];

  // ======================================================================
  // Stimmung: Farbe + Emoji
  // ======================================================================
  const STOPS = [[0, [108, 143, 230]], [25, [160, 120, 220]], [50, [255, 170, 80]], [75, [255, 120, 120]], [100, [255, 95, 162]]];
  function moodColor(v) {
    const i = Math.min(3, Math.floor(v / 25)), [a, ca] = STOPS[i], [b, cb] = STOPS[i + 1], t = (v - a) / (b - a);
    const c = ca.map((x, k) => Math.round(x + (cb[k] - x) * t));
    return `rgb(${c.join(',')})`;
  }
  const moodEmoji = v => v < 15 ? '😢' : v < 35 ? '😔' : v < 50 ? '😕' : v < 65 ? '🙂' : v < 85 ? '😊' : '🥰';
  function ago(ms) {
    const s = Math.round((Date.now() - ms) / 1000);
    if (s < 90) return 'gerade eben';
    if (s < 3600) return `vor ${Math.round(s / 60)} Min.`;
    if (s < 86400) return `vor ${Math.round(s / 3600)} Std.`;
    const d = Math.round(s / 86400); return d === 1 ? 'gestern' : `vor ${d} Tagen`;
  }
  const latest = uid => moods.filter(m => m.user === uid).sort((a, b) => pbMs(b.created) - pbMs(a.created))[0];

  async function loadMoods() {
    const since = new Date(Date.now() - 14 * 86400000).toISOString().replace('T', ' ');
    moods = await pb.collection('moods').getFullList({ filter: pb.filter('created >= {:t}', { t: since }), sort: 'created' });
    // ältere letzte Werte (falls 14 Tage nichts kam)
    for (const uid of [myId(), partner()?.id].filter(Boolean)) {
      if (!moods.some(m => m.user === uid)) {
        const r = await pb.collection('moods').getList(1, 1, { filter: pb.filter('user = {:u}', { u: uid }), sort: '-created' }).catch(() => null);
        if (r?.items[0]) moods.unshift(r.items[0]);
      }
    }
    renderMoodCard();
  }

  function renderMoodCard() {
    const p = partner(), mp = p && latest(p.id), mm = latest(myId());
    const chip = (box, label, m, mine) => {
      box.replaceChildren();
      const v = m ? m.value : null;
      const dot = el('span', 'mood-dot', v == null ? '❔' : moodEmoji(v));
      dot.style.setProperty('--mc', v == null ? 'var(--chip)' : moodColor(v));
      const t = el('span', 'mood-txt');
      t.append(el('b', '', label), el('small', '', v == null ? (mine ? 'Tippen zum Setzen' : 'noch nichts gesetzt') : `${v} % · ${ago(pbMs(m.created))}`));
      box.append(dot, t);
    };
    chip($('moodPartner'), p?.name || 'Schatz', mp, false);
    chip($('moodMine'), 'Du', mm, true);
  }

  // ======================================================================
  // Drehregler
  // ======================================================================
  let val = 50, dragging = false;
  const R = 100, CX = 130, CY = 130;
  function drawDial() {
    const a = val / 100 * Math.PI * 2 - Math.PI / 2;
    const x = CX + R * Math.cos(a), y = CY + R * Math.sin(a);
    const large = val > 50 ? 1 : 0;
    const c = moodColor(val);
    $('dialArc').setAttribute('d', val >= 99.9 ? `M ${CX} ${CY - R} A ${R} ${R} 0 1 1 ${CX - 0.01} ${CY - R}` : `M ${CX} ${CY - R} A ${R} ${R} 0 ${large} 1 ${x.toFixed(1)} ${y.toFixed(1)}`);
    $('dialArc').style.stroke = c;
    $('dialKnob').setAttribute('cx', x.toFixed(1)); $('dialKnob').setAttribute('cy', y.toFixed(1));
    $('dialKnob').style.fill = c;
    $('dialEmoji').textContent = moodEmoji(val);
    $('dialVal').textContent = Math.round(val) + ' %';
    $('moodSheet').querySelector('.sheet').style.setProperty('--mc', c);
  }
  function fromPointer(e) {
    const r = $('dial').getBoundingClientRect();
    const s = 260 / r.width;
    const x = (e.clientX - r.left) * s - CX, y = (e.clientY - r.top) * s - CY;
    let ang = Math.atan2(y, x) + Math.PI / 2;
    if (ang < 0) ang += Math.PI * 2;
    let v = ang / (Math.PI * 2) * 100;
    // nicht über 0/100 hinwegspringen
    if (val > 85 && v < 15) v = 100; else if (val < 15 && v > 85) v = 0;
    val = Math.max(0, Math.min(100, v));
    drawDial();
  }
  $('dial').addEventListener('pointerdown', e => { dragging = true; try { $('dial').setPointerCapture(e.pointerId); } catch (_) {} e.preventDefault(); fromPointer(e); });
  $('dial').addEventListener('pointermove', e => { if (dragging) { e.preventDefault(); fromPointer(e); } });
  for (const ev of ['pointerup', 'pointercancel']) $('dial').addEventListener(ev, () => { dragging = false; });
  $('dial').addEventListener('touchmove', e => e.preventDefault(), { passive: false });

  function openMood() {
    const m = latest(myId());
    val = m ? m.value : 50;
    drawDial();
    drawChart();
    $('moodStatus').textContent = '';
    UI.sheet('moodSheet');
  }
  $('moodMine').addEventListener('click', openMood);
  $('moodPartner').addEventListener('click', openMood);
  $('moodSave').addEventListener('click', async () => {
    try {
      await pb.collection('moods').create({ user: myId(), value: Math.round(val) });
      $('moodStatus').textContent = Math.round(val) < 50 ? `Gespeichert – ${pname()} bekommt Bescheid 💗` : 'Gespeichert ✓';
      await loadMoods(); drawChart();
      setTimeout(() => UI.sheet('moodSheet', false), 900);
    } catch (err) { $('moodStatus').textContent = 'Ging nicht: ' + UI.errText(err); }
  });

  // Verlauf 14 Tage (beide Personen, in ihren Herzfarben)
  function drawChart() {
    const W = 300, H = 90, t0 = Date.now() - 14 * 86400000, h = window.WIR_HEARTS || { me: '#ff5fa2', partner: '#3b9eff' };
    const line = uid => moods.filter(m => m.user === uid && pbMs(m.created) >= t0)
      .map(m => [((pbMs(m.created) - t0) / (14 * 86400000)) * W, H - 6 - m.value / 100 * (H - 12)]);
    const path = pts => pts.length ? 'M' + pts.map(p => p.map(n => n.toFixed(1)).join(' ')).join(' L') : '';
    const mine = line(myId()), theirs = line(partner()?.id);
    $('moodChart').innerHTML = `<line x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}" class="mc-mid"/>`
      + `<path d="${path(theirs)}" class="mc-line" style="stroke:${h.partner}"/>` + theirs.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3" style="fill:${h.partner}"/>`).join('')
      + `<path d="${path(mine)}" class="mc-line" style="stroke:${h.me}"/>` + mine.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3" style="fill:${h.me}"/>`).join('');
    $('moodLegend').innerHTML = '';
    $('moodLegend').append(el('span', '', '— Du'), el('span', '', '— ' + pname()));
    $('moodLegend').children[0].style.color = h.me; $('moodLegend').children[1].style.color = h.partner;
  }

  // ======================================================================
  // Support
  // ======================================================================
  const KINDS = { anruf: '📞 Anruf', ablenkung: '🎈 Ablenkung', da: '🫂 Einfach da sein', reden: '💬 Reden' };
  const ANSWERS = { da: 'Bin da 💗', anruf: 'Ruf dich gleich an 📞', gleich: 'Bin gleich für dich da ⏳' };
  let kind = 'da';

  async function loadSupport() {
    const since = new Date(Date.now() - 24 * 3600000).toISOString().replace('T', ' ');
    support = await pb.collection('support_requests').getFullList({ filter: pb.filter("status != 'closed' && created >= {:t}", { t: since }), sort: '-created' });
    renderSupport();
  }

  function renderSupport() {
    const box = $('supportBox');
    box.replaceChildren();
    for (const r of support) {
      const fromMe = r.from === myId();
      const c = el('div', 'sup-card' + (fromMe ? ' mine' : ' theirs') + (r.status === 'open' ? ' open' : ''));
      if (!fromMe) {
        c.append(el('b', '', `🫂 ${pname()} braucht dich – ${KINDS[r.kind] || ''}`));
        if (r.message) c.append(el('p', '', '„' + r.message + '“'));
        if (r.status === 'open') {
          const row = el('div', 'sup-answers');
          for (const [k, t] of Object.entries(ANSWERS)) {
            const b = el('button', k === 'da' ? 'mem-btn' : 'pack-btn', t);
            b.type = 'button';
            b.addEventListener('click', () => answer(r, k, b));
            row.append(b);
          }
          c.append(row);
        } else c.append(el('small', '', `Du hast geantwortet: ${ANSWERS[r.answer] || ''}`));
      } else {
        c.append(el('b', '', r.status === 'open' ? `Anfrage gesendet – ${KINDS[r.kind] || ''}` : `💗 ${pname()}: ${ANSWERS[r.answer] || ''}`));
        c.append(el('small', '', r.status === 'open' ? `Warte auf ${pname()} …` : 'auf deine Anfrage'));
      }
      const x = el('button', 'del-x sup-x', '✕');
      x.type = 'button'; x.setAttribute('aria-label', 'Ausblenden');
      x.addEventListener('click', async () => { await post(`/api/support/${r.id}/close`).catch(() => {}); loadSupport(); });
      c.append(x);
      box.append(c);
    }
  }

  async function answer(r, k, btn) {
    try {
      await post(`/api/support/${r.id}/answer`, { answer: k });
      const b = btn.getBoundingClientRect(); UI.burst(b.left + b.width / 2, b.top, 16);
      loadSupport();
    } catch (err) { alert(UI.errText(err)); loadSupport(); }
  }

  function openSupport() {
    $('supKinds').replaceChildren(...Object.entries(KINDS).map(([k, t]) => {
      const b = el('button', 'chip-btn' + (k === kind ? ' on' : ''), t);
      b.type = 'button';
      b.addEventListener('click', () => { kind = k; openSupportChips(); });
      return b;
    }));
    $('supStatus').textContent = '';
    UI.sheet('supportSheet');
  }
  const openSupportChips = () => document.querySelectorAll('#supKinds .chip-btn').forEach((b, i) => b.classList.toggle('on', Object.keys(KINDS)[i] === kind));
  document.addEventListener('click', e => { if (e.target.closest('[data-support]')) openSupport(); });
  $('supportForm').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await post('/api/support', { kind, message: $('supMsg').value.trim() });
      $('supMsg').value = '';
      $('supStatus').textContent = `Gesendet – ${pname()} bekommt sofort Bescheid 💗`;
      await loadSupport();
      setTimeout(() => UI.sheet('supportSheet', false), 900);
    } catch (err) { $('supStatus').textContent = 'Ging nicht: ' + UI.errText(err); }
  });

  // ======================================================================
  // Start
  // ======================================================================
  document.addEventListener('wir:show', e => { if (started && e.detail === 's-home') { loadMoods().catch(console.error); loadSupport().catch(console.error); } });
  document.addEventListener('wir:users', () => { if (started) renderMoodCard(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && started) { loadMoods().catch(console.error); loadSupport().catch(console.error); } });
  document.addEventListener('wir:started', () => {
    started = true;
    loadMoods().catch(console.error); loadSupport().catch(console.error);
    pb.collection('moods').subscribe('*', () => loadMoods().catch(console.error)).catch(console.error);
    pb.collection('support_requests').subscribe('*', () => loadSupport().catch(console.error)).catch(console.error);
    setInterval(() => { if (!document.hidden) renderMoodCard(); }, 60000);
  });
})();
