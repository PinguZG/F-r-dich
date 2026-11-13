// Stimmung + Mentaler Support. Stimmung in Prozent (0–100): Balken „Ida: 80 %“ auf Start und in Wir zwei, eigener Regler in Wir zwei
// (speichert beim Loslassen einen moods-Eintrag), „Wie geht es dir?“ bittet die andere Person per POST /api/mood/ask um ihren Wert:
// bei ihr erscheint beim Öffnen/Sichtbarwerden ein Pop-up mit Regler, solange die Aufforderung offen ist (support_requests kind='mood').
// Drehregler-Sheet mit Verlauf der letzten 14 Tage: Antippen des Balkens der anderen Person in Wir zwei. Unter 50 % meldet der Server einmal (chat_lib.js).
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

  let sliding = false;
  const setBar = (nameId, barId, name, v) => {
    const n = $(nameId), bar = $(barId);
    if (n) n.textContent = `${name}: ${v == null ? '–' : v} %`;
    if (bar) bar.style.width = (v == null ? 0 : v) + '%';
  };
  function renderMoodCard() {
    const p = partner(), mp = p && latest(p.id), mm = latest(myId());
    const pn = p?.name || 'Schatz', pv = mp ? mp.value : null;
    setBar('stMoodName', 'stMoodBar', pn, pv);
    setBar('wzPName', 'wzPBar', pn, pv);
    if (!sliding && $('moodRange')) {
      $('moodRange').value = mm ? mm.value : 50;
      $('wzMeVal').textContent = mm ? mm.value : '–';
      paintRange($('moodRange'));
    }
  }
  const paintRange = r => r.style.setProperty('--rv', r.value + '%');

  // eigener Regler in Wir zwei: beim Loslassen speichern
  const range = $('moodRange');
  range.addEventListener('pointerdown', () => { sliding = true; });
  range.addEventListener('input', () => { sliding = true; $('wzMeVal').textContent = range.value; paintRange(range); });
  range.addEventListener('change', async () => {
    try {
      await pb.collection('moods').create({ user: myId(), value: Math.round(+range.value) });
      await loadMoods();
    } catch (err) { toast('Ging nicht: ' + UI.errText(err)); }
    finally { sliding = false; renderMoodCard(); }
  });
  range.addEventListener('blur', () => { sliding = false; });

  // kleiner Hinweis-Toast
  let toastEl = null, toastT = 0;
  function toast(text) {
    if (!toastEl) { toastEl = el('div', 'wir-toast glass'); toastEl.setAttribute('role', 'status'); document.body.append(toastEl); }
    toastEl.textContent = text;
    requestAnimationFrame(() => toastEl.classList.add('show'));
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('show'), 2800);
  }

  // „Wie geht es dir?“ – die andere Person fragen
  async function askMood(btn) {
    btn.disabled = true;
    try {
      await post('/api/mood/ask');
      toast(`${pname()} wird beim nächsten Öffnen gefragt 💗`);
    } catch (err) { toast(UI.errText(err)); }
    finally { setTimeout(() => { btn.disabled = false; }, 1500); }
  }
  for (const id of ['askMood', 'askMood2']) $(id)?.addEventListener('click', e => askMood(e.currentTarget));

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
  $('wzPartnerMood').addEventListener('click', openMood);
  $('wzPartnerMood').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openMood(); } });
  $('moodSave').addEventListener('click', async () => {
    try {
      await pb.collection('moods').create({ user: myId(), value: Math.round(val) });
      $('moodStatus').textContent = 'Gespeichert ✓';
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
    support = await pb.collection('support_requests').getFullList({ filter: pb.filter("status != 'closed' && kind != 'mood' && created >= {:t}", { t: since }), sort: '-created' });
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
      $('supStatus').textContent = 'Gesendet 💗';
      await loadSupport();
      setTimeout(() => UI.sheet('supportSheet', false), 900);
    } catch (err) { $('supStatus').textContent = 'Ging nicht: ' + UI.errText(err); }
  });

  // ======================================================================
  // Pop-up „Wie geht es dir?“ (wenn die andere Person gefragt hat)
  // ======================================================================
  let askReq = null, askBox = null, askSaved = false;
  function ensureAskSheet() {
    if (askBox) return;
    askBox = el('div', 'sheet-wrap');
    askBox.id = 'moodAskSheet';
    askBox.hidden = true;
    askBox.innerHTML = '<div class="sheet-backdrop" data-close></div><div class="sheet mood-ask"><div class="sheet-grip"></div>'
      + '<button class="sheet-x" data-close type="button" aria-label="Später">✕</button><h2 class="sheet-title">Wie geht es dir?</h2>'
      + '<div class="ma-big"><span id="maN">50</span> %</div>'
      + '<input type="range" id="maR" min="0" max="100" step="1" value="50" aria-label="Wie geht es dir – Prozent">'
      + '<button class="mem-btn" id="maSave" type="button">Speichern</button><div class="mem-status" id="maStatus"></div></div>';
    document.body.append(askBox);
    const r = $('maR');
    r.addEventListener('input', () => { $('maN').textContent = r.value; paintRange(r); });
    // schließen ohne Speichern = „später“: Aufforderung schließen, damit das Pop-up nicht bei jedem Öffnen kommt
    askBox.addEventListener('click', e => {
      if (!e.target.closest('[data-close]') || !askReq || askSaved) return;
      const id = askReq.id; askReq = null;
      post(`/api/support/${id}/close`).catch(() => {});
    });
    $('maSave').addEventListener('click', async () => {
      try {
        $('maSave').disabled = true;
        askSaved = true;
        await pb.collection('moods').create({ user: myId(), value: Math.round(+r.value) });   // der Server beantwortet die Aufforderung
        askReq = null;
        $('maStatus').textContent = 'Gespeichert ✓';
        loadMoods().catch(console.error);
        setTimeout(() => UI.sheet('moodAskSheet', false), 700);
      } catch (err) { askSaved = false; $('maStatus').textContent = 'Ging nicht: ' + UI.errText(err); }
      finally { $('maSave').disabled = false; }
    });
  }
  let checking = false;
  async function checkAsk() {
    if (!started || checking || askReq || document.hidden || !pb.authStore.isValid) return;
    if (document.querySelector('#s-gift.active, #s-lock.active') || document.querySelector('.sheet-wrap.open')) return;
    checking = true;
    try {
      const since = new Date(Date.now() - 24 * 3600000).toISOString().replace('T', ' ');
      const res = await pb.collection('support_requests').getList(1, 1, {
        filter: pb.filter("to = {:me} && kind = 'mood' && status = 'open' && created >= {:t}", { me: myId(), t: since }), sort: '-created' });
      const r = res.items[0];
      if (!r) return;
      ensureAskSheet();
      askReq = r; askSaved = false;
      const m = latest(myId());
      $('maR').value = m ? m.value : 50;
      $('maN').textContent = $('maR').value;
      paintRange($('maR'));
      $('maStatus').textContent = '';
      UI.sheet('moodAskSheet');
    } catch (err) { console.error('moodask', err); }
    finally { checking = false; }
  }

  // ======================================================================
  // Start
  // ======================================================================
  document.addEventListener('wir:show', e => { if (started && (e.detail === 's-home' || e.detail === 's-wir')) { loadMoods().catch(console.error); loadSupport().catch(console.error); } if (started) checkAsk(); });
  document.addEventListener('wir:users', () => { if (started) renderMoodCard(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && started) { loadMoods().catch(console.error); loadSupport().catch(console.error); checkAsk(); } });
  document.addEventListener('wir:started', () => {
    started = true;
    loadMoods().catch(console.error); loadSupport().catch(console.error); setTimeout(checkAsk, 600);
    pb.collection('moods').subscribe('*', () => loadMoods().catch(console.error)).catch(console.error);
    pb.collection('support_requests').subscribe('*', e => {
      loadSupport().catch(console.error);
      const r = e.record;
      if (r?.kind === 'mood' && r.to === myId()) {
        if (e.action === 'create') checkAsk();
        // woanders beantwortet (z. B. mit dem Regler in Wir zwei): Pop-up zu
        else if (askReq && askReq.id === r.id && r.status !== 'open') { askReq = null; UI.sheet('moodAskSheet', false); }
      }
    }).catch(console.error);
    setInterval(() => { if (!document.hidden) renderMoodCard(); }, 60000);
  });
})();
