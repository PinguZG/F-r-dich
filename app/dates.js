// Dates (seit 26.10.2026): ein Bereich mit „Geplant“ (nächstes zuerst), „Vergangen“ (neuestes zuerst) und „Zeitstrahl“.
// Ein Date = date_events: Titel, Art, Zeitpunkt, Ort, Notiz, verknüpfte Erinnerungs-Fotos (photos) + eigene Bilder.
// Nach seinem Zeitpunkt rutscht ein Date von selbst zu „Vergangen“ und fragt nach Bildern. Clay Date ist eine normale Art
// (kind "clay") mit Ideen + Figuren als Unterbereich. Treffen sind beim Umzug zu Dates der Art „treffen“ geworden.
(() => {
  const pb = window.WIR_PB;
  const $ = id => document.getElementById(id);
  const myId = () => (pb.authStore.record || pb.authStore.model)?.id;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const pbMs = s => s ? Date.parse(String(s).replace(' ', 'T')) : 0;
  const pad = n => String(n).padStart(2, '0');
  const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const MON = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const fmt = ms => { const d = new Date(ms); return `${WD[d.getDay()]}, ${d.getDate()}. ${MON[d.getMonth()]} ${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const toInput = ms => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const KINDS = {
    date: ['💗', 'Date'], treffen: ['🫶', 'Treffen'], essen: ['🍝', 'Essen'], film: ['🎬', 'Film'], ausflug: ['🌳', 'Ausflug'],
    reise: ['✈️', 'Reise'], clay: ['🧸', 'Clay Date'], sonstiges: ['✨', 'Sonstiges'],
  };
  let list = [], seg = 'planned', current = null, token = '', started = false;
  try { seg = localStorage.getItem('wir-dates-seg') || 'planned'; } catch (_) {}

  const isPast = d => pbMs(d.when) < Date.now() - 3 * 3600000; // 3 Std. nach Beginn gilt ein Date als vergangen
  const imgCount = d => (d.photos?.length || 0) + (d.images?.length || 0);
  async function refreshToken() { try { token = await pb.files.getToken(); } catch (_) {} }
  const imgUrl = (r, f, thumb) => pb.files.getURL(r, f, { thumb, token });

  async function load() {
    await refreshToken();
    list = await pb.collection('date_events').getFullList({ sort: 'when', expand: 'photos,author' });
    render();
    if (current) { const c = list.find(x => x.id === current.id); if (c) { current = c; renderDetail(); } }
  }

  // ======================================================================
  // Übersicht: Geplant / Vergangen / Zeitstrahl
  // ======================================================================
  function thumbs(d, n = 4) {
    const box = el('div', 'dt-thumbs');
    const all = [...(d.expand?.photos || []).map(p => imgUrl(p, p.image, '200x200')), ...(d.images || []).map(f => imgUrl(d, f, '200x200'))];
    for (const u of all.slice(0, n)) { const i = el('img'); i.loading = 'lazy'; i.alt = ''; i.src = u; box.append(i); }
    if (all.length > n) box.append(el('span', 'dt-more', '+' + (all.length - n)));
    return all.length ? box : null;
  }

  function card(d) {
    const ms = pbMs(d.when), past = isPast(d);
    const b = el('button', 'dt-card glass' + (past ? ' past' : ''));
    b.type = 'button';
    const ico = el('span', 'dt-ico', d.emoji || KINDS[d.kind]?.[0] || '💗');
    const txt = el('div', 'dt-text');
    txt.append(el('b', '', d.title), el('small', '', fmt(ms) + (d.place ? ' · 📍 ' + d.place : '')));
    if (!past) {
      const days = Math.round((new Date(new Date(ms).toDateString()) - new Date(new Date().toDateString())) / 86400000);
      txt.append(el('em', 'dt-when', days <= 0 ? 'Heute 💗' : days === 1 ? 'Morgen' : `in ${days} Tagen`));
    } else if (!imgCount(d)) txt.append(el('em', 'dt-ask', '📷 Bilder hinzufügen?'));
    b.append(ico, txt);
    const t = thumbs(d);
    if (t) b.append(t);
    b.addEventListener('click', () => open(d.id));
    return b;
  }

  function render() {
    document.querySelectorAll('[data-dtseg]').forEach(x => x.classList.toggle('on', x.dataset.dtseg === seg));
    $('dtList').hidden = seg === 'timeline';
    $('dtTimeline').hidden = seg !== 'timeline';
    const planned = list.filter(d => !isPast(d));
    const past = list.filter(isPast).reverse();
    $('dtCount').textContent = `${planned.length} geplant · ${past.length} vergangen`;
    if (seg === 'timeline') return renderTimeline();
    const rows = seg === 'planned' ? planned : past;
    $('dtList').replaceChildren(...rows.map(card));
    if (!rows.length) $('dtList').append(el('div', 'empty-note', seg === 'planned' ? 'Noch nichts geplant – plan euer nächstes Date 💭' : 'Noch keine vergangenen Dates'));
  }

  // Zeitstrahl: eure Geschichte von oben (neu) nach unten (alt), Monatsmarken, Bilder als Streifen
  function renderTimeline() {
    const box = $('dtTimeline');
    const rows = list.slice().reverse();
    let month = '';
    const out = [];
    const nowMs = Date.now();
    let nowPlaced = false;
    for (const d of rows) {
      const ms = pbMs(d.when), dt = new Date(ms);
      if (!nowPlaced && ms < nowMs) { out.push(el('div', 'tl-now', 'Heute 💗')); nowPlaced = true; }
      const mk = `${MON[dt.getMonth()]} ${dt.getFullYear()}`;
      if (mk !== month) { month = mk; out.push(el('div', 'tl-month', mk)); }
      const item = el('button', 'tl-item' + (ms > nowMs ? ' future' : ''));
      item.type = 'button';
      item.append(el('span', 'tl-dot', d.emoji || KINDS[d.kind]?.[0] || '💗'));
      const body = el('div', 'tl-body glass');
      body.append(el('b', '', d.title), el('small', '', fmt(ms) + (d.place ? ' · 📍 ' + d.place : '')));
      if (d.note) body.append(el('p', '', d.note));
      const t = thumbs(d, 6);
      if (t) body.append(t);
      item.append(body);
      item.addEventListener('click', () => open(d.id));
      out.push(item);
    }
    if (!nowPlaced) out.push(el('div', 'tl-now', 'Heute 💗'));
    box.replaceChildren(...out);
    if (!rows.length) box.append(el('div', 'empty-note', 'Euer Zeitstrahl füllt sich mit jedem Date 💗'));
  }

  document.querySelectorAll('[data-dtseg]').forEach(b => b.addEventListener('click', () => {
    seg = b.dataset.dtseg; try { localStorage.setItem('wir-dates-seg', seg); } catch (_) {}
    render();
  }));

  // ======================================================================
  // Detail
  // ======================================================================
  function open(id) {
    current = list.find(x => x.id === id) || null;
    if (!current) return;
    renderDetail();
    UI.show('s-date');
    $('s-date').scrollTop = 0;
  }

  function renderDetail() {
    const d = current;
    if (!d) return;
    const ms = pbMs(d.when), past = isPast(d);
    $('dtdTitle').textContent = `${d.emoji || KINDS[d.kind]?.[0] || '💗'} ${d.title}`;
    $('dtdMeta').replaceChildren(
      el('span', 'sd-chip', KINDS[d.kind]?.[1] || 'Date'),
      el('span', 'sd-chip', fmt(ms)),
      ...(d.place ? [el('span', 'sd-chip', '📍 ' + d.place)] : []),
    );
    $('dtdNote').textContent = d.note || '';
    $('dtdNote').hidden = !d.note;
    $('dtdAsk').hidden = !(past && !imgCount(d));
    $('dtdClay').hidden = d.kind !== 'clay';
    const grid = $('dtdPhotos');
    const items = [
      ...(d.expand?.photos || []).map(p => ({ src: imgUrl(p, p.image, '600x0'), big: imgUrl(p, p.image), cap: p.caption, linked: p.id })),
      ...(d.images || []).map(f => ({ src: imgUrl(d, f, '600x0'), big: imgUrl(d, f), file: f })),
    ];
    grid.replaceChildren(...items.map(it => {
      const c = el('div', 'photo polaroid');
      const pic = el('div', 'pic'); const i = el('img'); i.alt = ''; i.loading = 'lazy'; i.src = it.src; pic.append(i);
      c.append(pic, el('div', 'pc-cap' + (it.cap ? '' : ' who'), it.cap || (it.linked ? '📸 aus Erinnerungen' : '♡')));
      c.addEventListener('click', () => UI.lightbox(it.big, it.cap || d.title, [
        { label: it.linked ? '🔗 Verknüpfung lösen' : '🗑 Bild löschen', onClick: () => removeImg(it) },
      ]));
      return c;
    }));
    if (!items.length) grid.append(el('div', 'empty-note', past ? 'Noch keine Bilder – füg eure schönsten hinzu 📷' : 'Bilder kannst du nach dem Date hinzufügen 📷'));
  }

  async function removeImg(it) {
    if (!confirm(it.linked ? 'Foto von diesem Date lösen? (In Erinnerungen bleibt es.)' : 'Dieses Bild löschen?')) return;
    try {
      if (it.linked) await pb.collection('date_events').update(current.id, { 'photos-': it.linked });
      else await pb.collection('date_events').update(current.id, { 'images-': it.file });
      UI.closeLightbox();
      await load();
    } catch (err) { alert('Ging nicht: ' + UI.errText(err)); }
  }

  // eigene Bilder hochladen
  $('dtdFile').addEventListener('change', async e => {
    const files = [...e.target.files];
    if (!files.length || !current) return;
    try {
      for (let i = 0; i < files.length; i++) {
        $('dtdStatus').textContent = `Lade ${i + 1}/${files.length} hoch …`;
        const fd = new FormData();
        fd.append('images+', await UI.shrink(files[i]), 'date.jpg');
        await pb.collection('date_events').update(current.id, fd);
      }
      $('dtdStatus').textContent = 'Hochgeladen ✓';
      await load();
    } catch (err) { $('dtdStatus').textContent = 'Hochladen fehlgeschlagen: ' + UI.errText(err); }
    e.target.value = '';
  });

  // aus Erinnerungen verknüpfen
  let pickSel = new Set();
  $('dtdPick').addEventListener('click', async () => {
    await refreshToken();
    const photos = await pb.collection('photos').getFullList({ sort: '-created' });
    pickSel = new Set(current.photos || []);
    $('dtPickGrid').replaceChildren(...photos.map(p => {
      const b = el('button', 'dt-pick' + (pickSel.has(p.id) ? ' on' : ''));
      b.type = 'button';
      const i = el('img'); i.alt = ''; i.loading = 'lazy'; i.src = imgUrl(p, p.image, '200x200'); b.append(i);
      b.addEventListener('click', () => { pickSel.has(p.id) ? pickSel.delete(p.id) : pickSel.add(p.id); b.classList.toggle('on'); });
      return b;
    }));
    if (!photos.length) $('dtPickGrid').append(el('div', 'empty-note', 'Noch keine Fotos in Erinnerungen'));
    UI.sheet('dtPickSheet');
  });
  $('dtPickSave').addEventListener('click', async () => {
    try { await pb.collection('date_events').update(current.id, { photos: [...pickSel] }); UI.sheet('dtPickSheet', false); await load(); }
    catch (err) { alert('Ging nicht: ' + UI.errText(err)); }
  });

  // ======================================================================
  // Anlegen / Bearbeiten
  // ======================================================================
  let edit = null, kind = 'date';
  function renderKinds() {
    $('dtKinds').replaceChildren(...Object.entries(KINDS).map(([k, [e, n]]) => {
      const b = el('button', 'chip-btn' + (k === kind ? ' on' : ''), `${e} ${n}`);
      b.type = 'button';
      b.addEventListener('click', () => {
        const prevEmoji = KINDS[kind][0];
        kind = k; renderKinds();
        if (!$('dtEmoji').value || $('dtEmoji').value === prevEmoji) $('dtEmoji').value = e;
      });
      return b;
    }));
  }
  function openForm(d) {
    edit = d || null;
    kind = d?.kind || 'date';
    $('dtFormTitle').textContent = d ? 'Date bearbeiten' : 'Neues Date 💗';
    $('dtEmoji').value = d?.emoji || KINDS[kind][0];
    $('dtTitleIn').value = d?.title || '';
    const def = new Date(Date.now() + 86400000); def.setHours(18, 0, 0, 0);
    $('dtWhen').value = toInput(d ? pbMs(d.when) : def.getTime());
    $('dtPlace').value = d?.place || '';
    $('dtNoteIn').value = d?.note || '';
    $('dtDel').hidden = !d;
    $('dtErr').textContent = '';
    renderKinds();
    UI.sheet('dtFormSheet');
  }
  $('dtNewBtn').addEventListener('click', () => openForm());
  $('dtdEdit').addEventListener('click', () => openForm(current));
  $('dtForm').addEventListener('submit', async e => {
    e.preventDefault();
    const data = {
      title: $('dtTitleIn').value.trim() || KINDS[kind][1], emoji: $('dtEmoji').value.trim() || KINDS[kind][0], kind,
      when: new Date($('dtWhen').value).toISOString(), place: $('dtPlace').value.trim(), note: $('dtNoteIn').value.trim(),
    };
    try {
      const r = edit ? await pb.collection('date_events').update(edit.id, data) : await pb.collection('date_events').create({ ...data, author: myId() });
      UI.sheet('dtFormSheet', false);
      await load();
      window.WIR_COUNTDOWN?.reload();
      if (!edit) { const b = $('dtList').getBoundingClientRect(); UI.burst(b.left + b.width / 2, b.top + 40, 16); }
      if (edit) { current = list.find(x => x.id === r.id); renderDetail(); }
    } catch (err) { $('dtErr').textContent = 'Speichern fehlgeschlagen: ' + UI.errText(err); }
  });
  $('dtDel').addEventListener('click', async () => {
    if (!edit || !confirm(`„${edit.title}“ wirklich löschen?`)) return;
    try { await pb.collection('date_events').delete(edit.id); UI.sheet('dtFormSheet', false); current = null; UI.show('s-plans'); await load(); window.WIR_COUNTDOWN?.reload(); }
    catch (err) { $('dtErr').textContent = 'Löschen fehlgeschlagen: ' + UI.errText(err); }
  });

  // ======================================================================
  // Start
  // ======================================================================
  document.addEventListener('wir:show', e => {
    if (!started) return;
    if (e.detail === 's-plans') load().catch(console.error);
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && started) load().catch(console.error); });
  document.addEventListener('wir:started', () => {
    started = true;
    load().catch(console.error);
    pb.collection('date_events').subscribe('*', () => load().catch(console.error)).catch(console.error);
  });
  window.WIR_DATES = { openForm, open, reload: load };
})();
