// Treffen-Countdown, "Öffne wenn …" (Lesen + Schreiben im Briefpapier-Sheet).
// Läuft neben app.js und nutzt dessen PocketBase-Verbindung (Update-Hinweis: /shared/update.js).
(() => {
  const pb = window.WIR_PB;
  pb.autoCancellation(false);

  const $ = id => document.getElementById(id);
  const me = () => (pb.authStore.record || pb.authStore.model);
  const myId = () => me()?.id;
  const TZ = 'Europe/Berlin';
  const DAY = 86400000;
  let partner = { id: '', name: '' };
  let started = false;

  function errText(err) {
    const d = err?.response?.data;
    if (d && Object.keys(d).length) {
      return Object.entries(d).map(([k, v]) => k + ': ' + (v.message || JSON.stringify(v))).join(', ');
    }
    return err?.response?.message || err?.message || 'unbekannter Fehler';
  }
  function debounce(fn, ms = 400) {
    let t;
    return () => { clearTimeout(t); t = setTimeout(() => fn().catch(console.error), ms); };
  }
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function delBtn(label, onClick, ico = '✕') {
    const b = el('button', 'del-x', ico);
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.addEventListener('click', e => { e.stopPropagation(); onClick(); });
    return b;
  }
  const burstAt = (node, n = 12) => {
    const r = node.getBoundingClientRect();
    UI.burst(r.left + r.width / 2, r.top + r.height / 2, n);
  };

  // ---------- Zeit in Europe/Berlin ----------
  const pad = n => String(n).padStart(2, '0');
  const pbMs = s => s ? Date.parse(s.replace(' ', 'T')) : NaN;
  const partsFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  function berlin(ms) {
    const p = Object.fromEntries(partsFmt.formatToParts(new Date(ms)).map(x => [x.type, x.value]));
    return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, key: `${p.year}-${p.month}-${p.day}` };
  }
  const wallMs = ms => { const b = berlin(ms); return Date.UTC(b.y, b.m - 1, b.d, b.h, b.min); };
  // "YYYY-MM-DDTHH:MM" (Berliner Uhrzeit) -> Zeitstempel
  function fromBerlinInput(v) {
    const [d, t] = v.split('T');
    const [y, m, day] = d.split('-').map(Number);
    const [h, min] = t.split(':').map(Number);
    const guess = Date.UTC(y, m - 1, day, h, min);
    let ms = guess - (wallMs(guess) - guess);
    ms = guess - (wallMs(ms) - ms);
    return ms;
  }
  const toBerlinInput = ms => { const b = berlin(ms); return `${b.key}T${pad(b.h)}:${pad(b.min)}`; };
  const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  function fmtWhen(ms) {
    const b = berlin(ms);
    const wd = WD[new Date(Date.UTC(b.y, b.m - 1, b.d)).getUTCDay()];
    return `${wd}, ${pad(b.d)}.${pad(b.m)}. um ${pad(b.h)}:${pad(b.min)}`;
  }
  const dayDiff = (a, b) => Math.round((Date.parse(berlin(b).key) - Date.parse(berlin(a).key)) / DAY);
  function startOfTodayMs() {
    const b = berlin(Date.now());
    return fromBerlinInput(`${b.key}T00:00`);
  }

  function countdownText(ms) {
    const now = Date.now();
    if (berlin(ms).key === berlin(now).key) return { txt: 'Heute sehen wir uns 💗', today: true };
    const diff = ms - now;
    if (diff < DAY) {
      const total = Math.max(1, Math.ceil(diff / 60000)), h = Math.floor(total / 60), m = total % 60;
      return { txt: 'Noch ' + [h && `${h} Std.`, m && `${m} Min.`].filter(Boolean).join(' ') + ' 💗' };
    }
    const d = dayDiff(now, ms);
    return { txt: `Noch ${d} ${d === 1 ? 'Tag' : 'Tage'} 💗` };
  }

  // ======================================================================
  // DOM: Treffen-Karte (Startseite), Brief-Overlay
  // ======================================================================
  const cdBox = el('button', 'countdown glass');
  cdBox.type = 'button';
  cdBox.hidden = true;
  cdBox.innerHTML = '<span class="cd-ico">💗</span><div><small>Nächstes Treffen</small><div class="cd-num"></div><em></em></div>';
  cdBox.dataset.go = 's-meetings';
  const cdEmpty = el('button', 'cd-empty', '+ Nächstes Treffen eintragen');
  cdEmpty.type = 'button';
  cdEmpty.hidden = true;
  cdEmpty.addEventListener('click', () => openMeetingForm());
  $('homeMeet').append(cdBox, cdEmpty);

  const lightbox = $('lightbox');
  const overlay = el('div', 'ow-overlay');
  overlay.innerHTML = `
  <div class="ow-env-wrap" id="owEnvWrap">
    <div class="ow-envelope" id="owEnvelope">
      <div class="ow-env-back"></div>
      <div class="ow-paper">Für dich 💌</div>
      <div class="ow-env-front"></div>
      <div class="ow-flap"></div>
      <div class="ow-seal">❤</div>
    </div>
  </div>
  <div class="ow-letter" id="owLetter">
    <div class="small">Öffne wenn …</div>
    <h2 id="owLetterTitle"></h2>
    <p id="owLetterText"></p>
    <div class="sign" id="owLetterSign"></div>
    <button class="mem-btn" id="owLetterClose" type="button">Schließen 💗</button>
  </div>`;
  document.body.insertBefore(overlay, lightbox);

  // ======================================================================
  // Treffen
  // ======================================================================
  let meetings = [];
  let editMeeting = null;

  async function loadMeetings() {
    meetings = await pb.collection('meetings').getFullList({
      filter: pb.filter('when >= {:t}', { t: new Date(startOfTodayMs()) }), sort: 'when', expand: 'author',
    });
    renderCountdown();
    renderMeetings();
  }

  // nächstes Treffen: heute (auch wenn schon vorbei) oder in der Zukunft
  function nextMeeting() {
    const now = Date.now(), today = berlin(now).key;
    return meetings.find(m => { const ms = pbMs(m.when); return ms > now || berlin(ms).key === today; });
  }

  function renderCountdown() {
    if (!started) return;
    const m = nextMeeting();
    cdBox.hidden = !m;
    cdEmpty.hidden = !!m;
    if (!m) { $('planMeetInfo').textContent = 'Noch keins geplant 💭'; return; }
    const ms = pbMs(m.when);
    const c = countdownText(ms);
    cdBox.classList.toggle('today', !!c.today);
    cdBox.querySelector('.cd-num').textContent = c.txt;
    cdBox.querySelector('em').textContent = fmtWhen(ms) + (m.note ? ' · ' + m.note : '');
    $('planMeetInfo').textContent = c.txt;
  }

  function renderMeetings() {
    const list = $('meetList');
    const now = Date.now();
    const shown = meetings.filter(m => { const ms = pbMs(m.when); return ms > now || berlin(ms).key === berlin(now).key; });
    list.replaceChildren(...shown.map(m => {
      const ms = pbMs(m.when);
      const d = el('div', 'date');
      d.innerHTML = '<span class="ico">💗</span><div><b></b><span class="d"></span><em></em></div>';
      d.querySelector('b').textContent = fmtWhen(ms);
      d.querySelector('.d').textContent = m.note || '';
      d.querySelector('em').textContent = countdownText(ms).txt + (m.expand?.author?.name ? ' · von ' + m.expand.author.name : '');
      const acts = el('div', 'acts');
      acts.append(
        delBtn('Treffen ändern', () => openMeetingForm(m), '✎'),
        delBtn('Treffen löschen', async () => {
          if (!confirm(`Treffen am ${fmtWhen(ms)} löschen?`)) return;
          try { await pb.collection('meetings').delete(m.id); await loadMeetings(); }
          catch (err) { alert('Löschen fehlgeschlagen: ' + errText(err)); }
        }),
      );
      d.append(acts);
      return d;
    }));
    if (!shown.length) list.append(el('div', 'empty-note', 'Noch kein Treffen geplant 💭'));
  }

  function openMeetingForm(m) {
    editMeeting = m || null;
    $('meetErr').textContent = '';
    $('meetFormTitle').textContent = m ? 'Treffen ändern' : 'Nächstes Treffen';
    if (m) {
      $('meetWhen').value = toBerlinInput(pbMs(m.when));
      $('meetNote').value = m.note || '';
    } else {
      $('meetForm').reset();
      const b = berlin(Date.now() + DAY);
      $('meetWhen').value = `${b.key}T18:00`;
    }
    $('meetForm').hidden = false;
    UI.show('s-meetings');
    setTimeout(() => $('meetForm').scrollIntoView({ behavior: 'smooth', block: 'center' }), 350);
  }

  $('meetToggle').addEventListener('click', () => {
    if ($('meetForm').hidden || editMeeting) openMeetingForm();
    else $('meetForm').hidden = true;
  });

  $('meetForm').addEventListener('submit', async e => {
    e.preventDefault();
    $('meetErr').textContent = '';
    const v = $('meetWhen').value;
    if (!v) return;
    const ms = fromBerlinInput(v);
    if (!editMeeting && ms <= Date.now()) { $('meetErr').textContent = 'Bitte einen Zeitpunkt in der Zukunft wählen'; return; }
    const data = { when: new Date(ms).toISOString(), note: $('meetNote').value.trim() };
    try {
      if (editMeeting) await pb.collection('meetings').update(editMeeting.id, data);
      else await pb.collection('meetings').create({ ...data, author: myId() });
      editMeeting = null;
      $('meetForm').reset();
      $('meetForm').hidden = true;
      await loadMeetings();
      burstAt($('meetList'), 14);
    } catch (err) {
      $('meetErr').textContent = 'Speichern fehlgeschlagen: ' + errText(err);
    }
  });

  // ======================================================================
  // Öffne wenn – Umschalter "Für mich" / "Schreiben"
  // ======================================================================
  function setSeg(seg) {
    document.querySelectorAll('.seg').forEach(b => b.classList.toggle('on', b.dataset.seg === seg));
    $('owInPane').hidden = seg !== 'in';
    $('owWritePane').hidden = seg !== 'write';
    if (seg === 'in') loadInbox().catch(showInboxErr);
    else loadWriter().catch(console.error);
  }
  document.querySelectorAll('.seg').forEach(b => b.addEventListener('click', () => setSeg(b.dataset.seg)));

  // ======================================================================
  // Öffne wenn – Empfängerin
  // ======================================================================
  function showInboxErr(err) {
    console.error(err);
    $('owInbox').replaceChildren(el('div', 'empty-note', 'Konnte nicht laden: ' + errText(err)));
  }

  async function loadInbox() {
    const cats = await pb.send('/api/open-when/categories', {});
    $('navOwDot').hidden = !cats.some(c => c.fresh);
    $('owInbox').replaceChildren(...cats.map(c => {
      const b = el('button', 'opt ow-letter-card');
      b.type = 'button';
      b.innerHTML = '<span class="ico">💌</span><span><b></b><small></small></span>';
      b.querySelector('b').textContent = 'Öffne wenn ' + c.title;
      b.querySelector('small').textContent = c.fresh ? 'Ein neuer Brief wartet' : 'Tippen zum Öffnen';
      if (c.fresh) b.querySelector('small').append(el('span', 'ow-dot'));
      b.addEventListener('click', () => openLetter(c));
      return b;
    }));
    if (!cats.length) $('owInbox').append(el('div', 'empty-note', 'Hier ist noch nichts für dich – bald 💭'));
  }

  let letterBusy = false;
  async function openLetter(c) {
    if (letterBusy) return;
    letterBusy = true;
    const env = $('owEnvelope');
    const fetchMsg = pb.send('/api/open-when/random', { query: { category: c.id } }).then(r => ({ r }), err => ({ err }));
    env.classList.remove('flap-open', 'flap-back', 'out');
    $('owEnvWrap').classList.remove('hidden');
    $('owLetter').classList.remove('show');
    overlay.classList.add('show');
    await UI.wait(450);
    env.classList.add('flap-open');
    await UI.wait(600);
    env.classList.add('flap-back', 'out');
    await UI.wait(1000);
    const { r, err } = await fetchMsg;
    burstAt(env, 26);
    $('owEnvWrap').classList.add('hidden');
    await UI.wait(350);
    $('owLetterTitle').textContent = c.title;
    $('owLetterText').textContent = r ? r.text : (err?.status === 404 ? 'Hier ist gerade kein Brief 💭' : 'Ging nicht: ' + errText(err));
    $('owLetterSign').textContent = r?.from ? '– ' + r.from + ' 💗' : '';
    $('owLetter').scrollTop = 0;
    $('owLetter').classList.add('show');
    letterBusy = false;
  }

  $('owLetterClose').addEventListener('click', async () => {
    $('owLetter').classList.remove('show');
    await UI.wait(300);
    overlay.classList.remove('show');
    loadInbox().catch(showInboxErr);
  });

  // ======================================================================
  // Öffne wenn – Schreiben (Briefe im Bottom-Sheet)
  // ======================================================================
  let cats = [];
  let msgs = [];
  const openCats = new Set();

  // Startkategorien von Daniel für sie (nur Titel, die Texte schreibt er selbst)
  const SEED_CATS = [
    { id: 'owseed000000001', title: '… du dich nicht bonita findest' },
    { id: 'owseed000000002', title: '… du traurig bist' },
    { id: 'owseed000000003', title: '… du das Gefühl hast, nicht gut genug zu sein' },
    { id: 'owseed000000004', title: '… du dich alleine fühlst' },
  ];
  const isDaniel = () => /daniel/i.test(me()?.name || '') || /^daniel/i.test(me()?.email || '');

  async function seedCats() {
    if (!isDaniel()) return;
    const { totalItems } = await pb.collection('open_when_categories').getList(1, 1, { filter: pb.filter('author = {:me}', { me: myId() }) });
    if (totalItems) return;
    for (let i = 0; i < SEED_CATS.length; i++) {
      try { await pb.collection('open_when_categories').create({ ...SEED_CATS[i], order: i, author: myId() }); }
      catch (err) { console.warn('seed', SEED_CATS[i].id, errText(err)); } // z.B. schon vom anderen Gerät angelegt
    }
  }

  async function loadWriter() {
    [cats, msgs] = await Promise.all([
      pb.collection('open_when_categories').getFullList({ filter: pb.filter('author = {:me}', { me: myId() }), sort: 'order,created' }),
      pb.collection('open_when_messages').getFullList({ filter: pb.filter('author = {:me}', { me: myId() }), sort: 'created' }),
    ]);
    renderWriter();
  }

  function renderWriter() {
    $('owCats').replaceChildren(...cats.map((c, i) => catCard(c, i)));
    if (!cats.length) $('owCats').append(el('div', 'empty-note', 'Leg unten die erste Kategorie an ✨'));
  }

  function catCard(c, i) {
    const mine = msgs.filter(m => m.category === c.id);
    const opened = mine.filter(m => m.opened_at).length;
    const card = el('div', 'ow-cat');
    const head = el('div', 'ow-cat-head');
    const info = el('div');
    const isOpen = openCats.has(c.id);
    const count = mine.length ? `${opened} von ${mine.length} geöffnet` : 'Noch leer – erst mit Brief sichtbar';
    info.append(el('b', '', `${isOpen ? '▾' : '▸'} ${c.title}`), el('small', '', isOpen ? count : `${count} · Tippen zum Schreiben ✍️`));
    head.append(info);
    if (i > 0) head.append(delBtn('Nach oben', () => moveCat(i, -1), '▲'));
    if (i < cats.length - 1) head.append(delBtn('Nach unten', () => moveCat(i, 1), '▼'));
    head.append(
      delBtn('Kategorie umbenennen', async () => {
        const t = prompt('Öffne wenn …', c.title);
        if (!t || !t.trim() || t.trim() === c.title) return;
        try { await pb.collection('open_when_categories').update(c.id, { title: t.trim() }); await loadWriter(); }
        catch (err) { alert('Ging nicht: ' + errText(err)); }
      }, '✎'),
      delBtn('Kategorie löschen', async () => {
        if (!confirm(`„${c.title}“ mit ${mine.length} Brief(en) löschen?`)) return;
        try { await pb.collection('open_when_categories').delete(c.id); await loadWriter(); }
        catch (err) { alert('Löschen fehlgeschlagen: ' + errText(err)); }
      }),
    );
    head.addEventListener('click', () => {
      if (openCats.has(c.id)) openCats.delete(c.id); else openCats.add(c.id);
      renderWriter();
    });
    card.append(head);
    if (isOpen) {
      const body = el('div', 'ow-cat-body');
      for (const m of mine) {
        const b = el('button', 'ow-msg');
        b.type = 'button';
        b.append(el('p', '', m.text), el('small', '', (m.opened_at ? '✓ geöffnet' : 'noch nicht geöffnet') + ' · tippen zum Bearbeiten'));
        b.addEventListener('click', () => openLetterSheet(c, m));
        body.append(b);
      }
      const add = el('button', 'mem-btn ow-write', '✍️ Neuen Brief schreiben');
      add.type = 'button';
      add.addEventListener('click', () => openLetterSheet(c, null));
      body.append(add);
      card.append(body);
    }
    return card;
  }

  // ---------- Briefpapier-Sheet ----------
  let sheetCat = null, sheetMsg = null;
  const MAX = 5000;
  const countLetter = () => { $('letterCount').textContent = `${$('letterText').value.length}/${MAX}`; };

  function openLetterSheet(c, m) {
    sheetCat = c; sheetMsg = m;
    $('letterHead').textContent = 'Öffne wenn ' + c.title;
    $('letterText').value = m?.text || '';
    $('letterDelete').hidden = !m;
    $('letterSave').textContent = m ? 'Änderung speichern 💌' : 'Brief speichern 💌';
    $('letterStatus').textContent = partner.name && !m ? `Nur ${partner.name} kann ihn öffnen.` : '';
    countLetter();
    UI.sheet('letterSheet');
    setTimeout(() => $('letterText').focus(), 380);
  }
  $('letterText').addEventListener('input', countLetter);

  $('letterForm').addEventListener('submit', async e => {
    e.preventDefault();
    const text = $('letterText').value.trim();
    if (!text) return;
    try {
      $('letterStatus').textContent = 'Speichere …';
      if (sheetMsg) await pb.collection('open_when_messages').update(sheetMsg.id, { text });
      else await pb.collection('open_when_messages').create({ category: sheetCat.id, text, author: myId() });
      openCats.add(sheetCat.id);
      UI.sheet('letterSheet', false);
      await loadWriter();
      burstAt($('owCats'), 14);
    } catch (err) {
      $('letterStatus').textContent = 'Speichern fehlgeschlagen: ' + errText(err);
    }
  });

  $('letterDelete').addEventListener('click', async () => {
    if (!sheetMsg || !confirm('Diesen Brief löschen?')) return;
    try {
      await pb.collection('open_when_messages').delete(sheetMsg.id);
      UI.sheet('letterSheet', false);
      await loadWriter();
    } catch (err) {
      $('letterStatus').textContent = 'Löschen fehlgeschlagen: ' + errText(err);
    }
  });

  async function moveCat(i, dir) {
    const list = cats.slice();
    [list[i], list[i + dir]] = [list[i + dir], list[i]];
    const changed = list.map((c, n) => [c, n]).filter(([c, n]) => c.order !== n);
    cats = list;
    renderWriter();
    try {
      await Promise.all(changed.map(([c, n]) => pb.collection('open_when_categories').update(c.id, { order: n }).then(() => { c.order = n; })));
    } catch (err) {
      alert('Sortieren fehlgeschlagen: ' + errText(err));
      await loadWriter();
    }
  }

  $('owCatForm').addEventListener('submit', async e => {
    e.preventDefault();
    $('owCatErr').textContent = '';
    let t = $('owCatTitle').value.trim();
    if (!t) return;
    if (!t.startsWith('…') && !t.startsWith('...')) t = '… ' + t;
    try {
      const c = await pb.collection('open_when_categories').create({
        title: t, order: Math.max(-1, ...cats.map(x => x.order || 0)) + 1, author: myId(),
      });
      openCats.add(c.id);
      $('owCatForm').reset();
      await loadWriter();
      burstAt($('owCats'), 14);
    } catch (err) {
      $('owCatErr').textContent = 'Anlegen fehlgeschlagen: ' + errText(err);
    }
  });

  // ======================================================================
  // Start (sobald app.js eingeloggt hat)
  // ======================================================================
  async function start() {
    started = true;
    pb.send('/api/wir/partner', {}).then(p => {
      partner = p;
      if (p.name) $('owWriteIntro').textContent = `Nur ${p.name} kann sie öffnen – immer einen zufälligen Brief.`;
    }).catch(console.error);
    await Promise.all([
      loadMeetings(),
      seedCats(),
      loadInbox(),
    ].map(p => p.catch(console.error)));
    pb.collection('meetings').subscribe('*', debounce(loadMeetings)).catch(console.error);
    if (location.hash === '#open-when') {
      history.replaceState(null, '', location.pathname);
      UI.show('s-openwhen');
      setSeg('in');
    }
  }

  // Seitenwechsel: passende Bereiche frisch laden
  document.addEventListener('wir:show', e => {
    if (!started) return;
    if (e.detail === 's-openwhen') setSeg($('owWritePane').hidden ? 'in' : 'write');
    if (e.detail === 's-plans' || e.detail === 's-home') renderCountdown();
  });

  // app.js hat einen Bereich geöffnet (z. B. per Tippen auf einen Push)
  document.addEventListener('wir:go', e => {
    if (e.detail === 's-write') setSeg('write');
    else if (e.detail === 's-openwhen') setSeg('in');
  });

  setInterval(() => { if (started && !document.hidden) { renderCountdown(); if ($('s-meetings').classList.contains('active')) renderMeetings(); } }, 30000);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !started || !pb.authStore.isValid) return;
    loadMeetings().catch(console.error);
    loadInbox().catch(showInboxErr);
  });

  // app.js meldet an und lädt; danach starten wir
  document.addEventListener('wir:started', () => { if (!started) start(); });
})();
