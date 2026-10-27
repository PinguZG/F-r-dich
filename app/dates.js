// Dates (seit 26.10.2026): ein Bereich mit „Geplant“ (nächstes zuerst), „Vergangen“ (neuestes zuerst) und „Zeitstrahl“.
// Ein Date = date_events: Titel, Art, Zeitpunkt (Uhrzeit optional), Ort, Notiz, verknüpfte Erinnerungs-Fotos (photos)
// + eigene Bilder, Titelbild (cover) und Reihenfolge (img_order). Eigene Arten liegen in date_kinds.
// Nach seinem Zeitpunkt rutscht ein Date von selbst zu „Vergangen“. Clay Date ist eine normale Art (kind "clay")
// mit Ideen + Figuren als Unterbereich. Alles ist für beide bearbeitbar, Änderungen kommen per Realtime.
(() => {
  const pb = window.WIR_PB;
  const $ = id => document.getElementById(id);
  const myId = () => (pb.authStore.record || pb.authStore.model)?.id;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const pbMs = s => s ? Date.parse(String(s).replace(' ', 'T')) : 0;
  const pad = n => String(n).padStart(2, '0');
  const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const MON = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const fmtDay = ms => { const d = new Date(ms); return `${WD[d.getDay()]}, ${d.getDate()}. ${MON[d.getMonth()]} ${d.getFullYear()}`; };
  const fmt = (ms, allDay) => { const d = new Date(ms); return fmtDay(ms) + (allDay ? '' : ` · ${pad(d.getHours())}:${pad(d.getMinutes())}`); };
  const dayInput = ms => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const timeInput = ms => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const KINDS = {
    date: ['💗', 'Date'], treffen: ['🫶', 'Treffen'], essen: ['🍝', 'Essen'], film: ['🎬', 'Film'], ausflug: ['🌳', 'Ausflug'],
    reise: ['✈️', 'Reise'], clay: ['🧸', 'Clay Date'], sonstiges: ['✨', 'Sonstiges'],
  };
  let list = [], customKinds = [], seg = 'planned', current = null, token = '', started = false;
  try { seg = localStorage.getItem('wir-dates-seg') || 'planned'; } catch (_) {}

  // ohne Uhrzeit: vergangen ab dem nächsten Tag, sonst 3 Std. nach Beginn
  const isPast = d => d.all_day
    ? new Date(new Date(pbMs(d.when)).toDateString()).getTime() + 86400000 <= Date.now()
    : pbMs(d.when) < Date.now() - 3 * 3600000;
  const kindName = d => d.kind_label || KINDS[d.kind]?.[1] || 'Date';
  const icon = d => d.emoji || d.kind_emoji || KINDS[d.kind]?.[0] || '💗';
  async function refreshToken() { try { token = await pb.files.getToken(); } catch (_) {} }
  const imgUrl = (r, f, thumb) => pb.files.getURL(r, f, { thumb, token });

  // alle Bilder eines Dates in der gespeicherten Reihenfolge (Schlüssel "p:<foto>" bzw. "f:<datei>")
  function items(d) {
    const arr = [
      ...(d.expand?.photos || []).map(p => ({ key: 'p:' + p.id, rec: p, file: p.image, linked: p.id, cap: p.caption })),
      ...(d.images || []).map(f => ({ key: 'f:' + f, rec: d, file: f })),
    ];
    const ord = Array.isArray(d.img_order) ? d.img_order : [];
    const pos = k => { const i = ord.indexOf(k); return i < 0 ? 1e6 : i; };
    return arr.map((x, i) => ({ ...x, i })).sort((a, b) => pos(a.key) - pos(b.key) || a.i - b.i);
  }
  const coverOf = d => { const all = items(d); return all.find(x => x.key === d.cover) || all[0] || null; };

  async function load() {
    await refreshToken();
    [list, customKinds] = await Promise.all([
      pb.collection('date_events').getFullList({ sort: 'when', expand: 'photos,author' }),
      pb.collection('date_kinds').getFullList({ sort: 'created' }).catch(() => []),
    ]);
    render();
    if (current) {
      const c = list.find(x => x.id === current.id);
      if (c) { current = c; renderDetail(); if (edit?.id === c.id) { edit = c; renderStrip(); } }
      else if ($('s-date').classList.contains('active')) { current = null; UI.show('s-plans'); }
    }
  }

  // ======================================================================
  // Übersicht: Geplant / Vergangen / Zeitstrahl
  // ======================================================================
  function thumbs(d, n = 4) {
    const all = items(d), cov = coverOf(d);
    const ordered = cov ? [cov, ...all.filter(x => x !== cov && x.key !== cov.key)] : all;
    const box = el('div', 'dt-thumbs');
    for (const it of ordered.slice(0, n)) { const i = el('img'); i.loading = 'lazy'; i.alt = ''; i.src = imgUrl(it.rec, it.file, '200x200'); box.append(i); }
    if (ordered.length > n) box.append(el('span', 'dt-more', '+' + (ordered.length - n)));
    return ordered.length ? box : null;
  }

  function card(d) {
    const ms = pbMs(d.when), past = isPast(d);
    const b = el('button', 'dt-card glass' + (past ? ' past' : ''));
    b.type = 'button';
    const cov = coverOf(d);
    const ico = el('span', 'dt-ico', icon(d));
    if (cov) { ico.classList.add('pic'); ico.style.backgroundImage = `url("${imgUrl(cov.rec, cov.file, '200x200')}")`; ico.textContent = ''; }
    const txt = el('div', 'dt-text');
    txt.append(el('b', '', d.title), el('small', '', fmt(ms, d.all_day) + (d.place ? ' · 📍 ' + d.place : '')));
    if (!past) {
      const days = Math.round((new Date(new Date(ms).toDateString()) - new Date(new Date().toDateString())) / 86400000);
      txt.append(el('em', 'dt-when', days <= 0 ? 'Heute 💗' : days === 1 ? 'Morgen' : `in ${days} Tagen`));
    } else if (!items(d).length) txt.append(el('em', 'dt-ask', '📷 Bilder hinzufügen?'));
    b.append(ico, txt);
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
    if (!rows.length) $('dtList').append(el('div', 'empty-note', seg === 'planned' ? 'Noch nichts geplant' : 'Noch keine vergangenen Dates'));
  }

  // Zeitstrahl: von oben (neu) nach unten (alt), Monatsmarken, Punkte und Karten mit Bildern
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
      item.append(el('span', 'tl-dot', icon(d)));
      const body = el('div', 'tl-body glass');
      const cov = coverOf(d);
      if (cov) { const c = el('img', 'tl-cover'); c.alt = ''; c.loading = 'lazy'; c.src = imgUrl(cov.rec, cov.file, '600x0'); body.append(c); }
      body.append(el('b', '', d.title), el('small', '', fmt(ms, d.all_day) + (d.place ? ' · 📍 ' + d.place : '')));
      if (d.note) body.append(el('p', '', d.note));
      if (items(d).length > 1) { const t = thumbs(d, 6); if (t) body.append(t); }
      item.append(body);
      item.addEventListener('click', () => open(d.id));
      out.push(item);
    }
    if (!nowPlaced) out.push(el('div', 'tl-now', 'Heute 💗'));
    box.replaceChildren(...out);
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
    $('dtdTitle').textContent = `${icon(d)} ${d.title}`;
    const cov = coverOf(d);
    $('dtdCover').hidden = !cov;
    if (cov) $('dtdCover').src = imgUrl(cov.rec, cov.file, '600x0');
    $('dtdMeta').replaceChildren(
      el('span', 'sd-chip', kindName(d)),
      el('span', 'sd-chip', fmt(ms, d.all_day)),
      ...(d.place ? [el('span', 'sd-chip', '📍 ' + d.place)] : []),
    );
    $('dtdNote').textContent = d.note || '';
    $('dtdNote').hidden = !d.note;
    const all = items(d);
    $('dtdAsk').hidden = !(past && !all.length);
    $('dtdClay').hidden = d.kind !== 'clay';
    $('dtdPhotos').replaceChildren(...all.map(it => {
      const c = el('div', 'photo polaroid');
      const pic = el('div', 'pic'); const i = el('img'); i.alt = ''; i.loading = 'lazy'; i.src = imgUrl(it.rec, it.file, '600x0'); pic.append(i);
      c.append(pic, el('div', 'pc-cap' + (it.cap ? '' : ' who'), it.cap || (it.key === cov?.key ? '★' : '♡')));
      c.addEventListener('click', () => UI.lightbox(imgUrl(it.rec, it.file), it.cap || d.title, [
        { label: '★ Titelbild', onClick: () => setCover(d, it.key).then(UI.closeLightbox) },
        { label: it.linked ? '🔗 Lösen' : '🗑 Löschen', onClick: () => removeImg(d, it) },
      ]));
      return c;
    }));
    if (!all.length) $('dtdPhotos').append(el('div', 'empty-note', 'Noch keine Bilder'));
  }

  // ======================================================================
  // Bilder: hochladen, aus Erinnerungen, Titelbild, Reihenfolge, entfernen
  // ======================================================================
  const save = (d, data) => pb.collection('date_events').update(d.id, data);

  async function setCover(d, key) {
    try { await save(d, { cover: key }); await load(); } catch (err) { alert('Ging nicht: ' + UI.errText(err)); }
  }
  async function move(d, key, dir) {
    const keys = items(d).map(x => x.key), i = keys.indexOf(key), j = i + dir;
    if (i < 0 || j < 0 || j >= keys.length) return;
    [keys[i], keys[j]] = [keys[j], keys[i]];
    try { await save(d, { img_order: keys }); await load(); } catch (err) { alert('Ging nicht: ' + UI.errText(err)); }
  }
  async function removeImg(d, it) {
    if (!confirm(it.linked ? 'Foto von diesem Date lösen? (In Erinnerungen bleibt es.)' : 'Dieses Bild löschen?')) return;
    try {
      const data = it.linked ? { 'photos-': it.linked } : { 'images-': it.file };
      if (d.cover === it.key) data.cover = '';
      if (Array.isArray(d.img_order)) data.img_order = d.img_order.filter(k => k !== it.key);
      await save(d, data);
      UI.closeLightbox();
      await load();
    } catch (err) { alert('Ging nicht: ' + UI.errText(err)); }
  }

  $('dtdFile').addEventListener('change', async e => {
    const files = [...e.target.files];
    const d = edit || current;
    if (!files.length || !d) return;
    const st = t => { $('dtdStatus').textContent = t; $('dtImgStatus').textContent = t; };
    try {
      for (let i = 0; i < files.length; i++) {
        st(`Lade ${i + 1}/${files.length} hoch …`);
        const fd = new FormData();
        fd.append('images+', await UI.shrink(files[i]), 'date.jpg');
        await pb.collection('date_events').update(d.id, fd);
      }
      st('');
      await load();
    } catch (err) { st('Hochladen fehlgeschlagen: ' + UI.errText(err)); }
    e.target.value = '';
  });

  let pickSel = new Set(), pickFor = null;
  async function openPick() {
    pickFor = edit || current;
    if (!pickFor) return;
    await refreshToken();
    const photos = await pb.collection('photos').getFullList({ sort: '-created' });
    pickSel = new Set(pickFor.photos || []);
    $('dtPickGrid').replaceChildren(...photos.map(p => {
      const b = el('button', 'dt-pick' + (pickSel.has(p.id) ? ' on' : ''));
      b.type = 'button';
      const i = el('img'); i.alt = ''; i.loading = 'lazy'; i.src = imgUrl(p, p.image, '200x200'); b.append(i);
      b.addEventListener('click', () => { pickSel.has(p.id) ? pickSel.delete(p.id) : pickSel.add(p.id); b.classList.toggle('on'); });
      return b;
    }));
    if (!photos.length) $('dtPickGrid').append(el('div', 'empty-note', 'Noch keine Fotos in Erinnerungen'));
    UI.sheet('dtPickSheet');
  }
  $('dtdPick').addEventListener('click', openPick);
  $('dtPick2').addEventListener('click', openPick);
  $('dtPickSave').addEventListener('click', async () => {
    try { await save(pickFor, { photos: [...pickSel] }); UI.sheet('dtPickSheet', false); await load(); }
    catch (err) { alert('Ging nicht: ' + UI.errText(err)); }
  });

  // Bilder-Leiste im Bearbeiten-Sheet: ★ Titelbild, ‹ › Reihenfolge, ✕ entfernen
  function renderStrip() {
    const d = edit;
    $('dtImgBox').hidden = !d;
    if (!d) return;
    const all = items(d), cov = coverOf(d);
    $('dtStrip').replaceChildren(...all.map((it, i) => {
      const c = el('div', 'dt-si' + (it.key === cov?.key ? ' cover' : ''));
      const img = el('img'); img.alt = ''; img.loading = 'lazy'; img.src = imgUrl(it.rec, it.file, '200x200');
      const bar = el('div', 'dt-si-bar');
      const btn = (t, label, fn, off) => { const b = el('button', '', t); b.type = 'button'; b.setAttribute('aria-label', label); b.disabled = !!off; b.addEventListener('click', fn); return b; };
      bar.append(
        btn('‹', 'Nach vorne', () => move(d, it.key, -1), i === 0),
        btn('★', 'Titelbild', () => setCover(d, it.key)),
        btn('›', 'Nach hinten', () => move(d, it.key, 1), i === all.length - 1),
        btn('✕', it.linked ? 'Verknüpfung lösen' : 'Bild löschen', () => removeImg(d, it)),
      );
      c.append(img, bar);
      return c;
    }));
  }

  // ======================================================================
  // Anlegen / Bearbeiten (Bottom-Sheet)
  // ======================================================================
  let edit = null, sel = { kind: 'date', label: '', emoji: '' };
  const selEmoji = () => sel.emoji || KINDS[sel.kind]?.[0] || '💗';
  function renderKinds() {
    const chip = (text, on, fn) => { const b = el('button', 'chip-btn' + (on ? ' on' : ''), text); b.type = 'button'; b.addEventListener('click', fn); return b; };
    const pick = next => {
      const prev = selEmoji();
      sel = next; renderKinds();
      if (!$('dtEmoji').value || $('dtEmoji').value === prev) $('dtEmoji').value = selEmoji();
    };
    $('dtKinds').replaceChildren(
      ...Object.entries(KINDS).map(([k, [e, n]]) => chip(`${e} ${n}`, !sel.label && sel.kind === k, () => pick({ kind: k, label: '', emoji: '' }))),
      ...customKinds.map(c => {
        const b = chip(`${c.emoji || '✨'} ${c.name}`, sel.label === c.name, () => pick({ kind: 'sonstiges', label: c.name, emoji: c.emoji || '✨' }));
        const x = el('span', 'dk-x', '✕');
        x.addEventListener('click', async ev => {
          ev.stopPropagation();
          if (!confirm(`Art „${c.name}“ entfernen? (Dates behalten sie.)`)) return;
          await pb.collection('date_kinds').delete(c.id).catch(err => alert(UI.errText(err)));
          await load(); renderKinds();
        });
        b.append(x);
        return b;
      }),
      // eine eigene Art, die es in date_kinds (noch) nicht gibt, trotzdem zeigen
      ...(sel.label && !customKinds.some(c => c.name === sel.label) ? [chip(`${sel.emoji || '✨'} ${sel.label}`, true, () => {})] : []),
      chip('＋ Eigene', false, () => { $('dtNewKind').hidden = !$('dtNewKind').hidden; if (!$('dtNewKind').hidden) $('dtKindName').focus(); }),
    );
  }
  $('dtKindAdd').addEventListener('click', async () => {
    const name = $('dtKindName').value.trim(), emoji = $('dtKindEmoji').value.trim() || '✨';
    if (!name) return;
    try {
      if (!customKinds.some(c => c.name === name)) await pb.collection('date_kinds').create({ name, emoji, author: myId() });
      await load();
      $('dtKindName').value = ''; $('dtKindEmoji').value = ''; $('dtNewKind').hidden = true;
      const prev = selEmoji();
      sel = { kind: 'sonstiges', label: name, emoji };
      if (!$('dtEmoji').value || $('dtEmoji').value === prev) $('dtEmoji').value = emoji;
      renderKinds();
    } catch (err) { $('dtErr').textContent = UI.errText(err); }
  });

  function syncTime() { $('dtTime').disabled = $('dtAllDay').checked; $('dtTime').classList.toggle('off', $('dtAllDay').checked); }
  $('dtAllDay').addEventListener('change', syncTime);

  function openForm(d) {
    edit = d || null;
    if (d) current = d;
    sel = d ? { kind: d.kind || 'date', label: d.kind_label || '', emoji: d.kind_emoji || '' } : { kind: 'date', label: '', emoji: '' };
    $('dtFormTitle').textContent = d ? 'Date bearbeiten' : 'Neues Date 💗';
    $('dtEmoji').value = d?.emoji || selEmoji();
    $('dtTitleIn').value = d?.title || '';
    const def = new Date(Date.now() + 86400000); def.setHours(18, 0, 0, 0);
    const ms = d ? pbMs(d.when) : def.getTime();
    $('dtDate').value = dayInput(ms);
    $('dtTime').value = d?.all_day ? '' : timeInput(ms);
    $('dtAllDay').checked = !!d?.all_day;
    syncTime();
    $('dtPlace').value = d?.place || '';
    $('dtNoteIn').value = d?.note || '';
    $('dtDel').hidden = !d;
    $('dtNewKind').hidden = true;
    $('dtErr').textContent = ''; $('dtImgStatus').textContent = '';
    renderKinds();
    renderStrip();
    UI.sheet('dtFormSheet');
  }
  $('dtNewBtn').addEventListener('click', () => openForm());
  $('dtdEdit').addEventListener('click', () => openForm(current));
  $('dtForm').addEventListener('submit', async e => {
    e.preventDefault();
    const day = $('dtDate').value;
    if (!day) return;
    const allDay = $('dtAllDay').checked || !$('dtTime').value;
    const when = new Date(`${day}T${allDay ? '12:00' : $('dtTime').value}`);
    const data = {
      title: $('dtTitleIn').value.trim() || sel.label || KINDS[sel.kind][1], emoji: $('dtEmoji').value.trim() || selEmoji(),
      kind: sel.label ? 'sonstiges' : sel.kind, kind_label: sel.label, kind_emoji: sel.label ? sel.emoji : '',
      when: when.toISOString(), all_day: allDay, place: $('dtPlace').value.trim(), note: $('dtNoteIn').value.trim(),
    };
    try {
      const r = edit ? await pb.collection('date_events').update(edit.id, data) : await pb.collection('date_events').create({ ...data, author: myId() });
      UI.sheet('dtFormSheet', false);
      const wasEdit = !!edit;
      edit = null;
      await load();
      window.WIR_COUNTDOWN?.reload();
      // Geplant/Vergangen folgt dem Datum: passenden Umschalter zeigen
      const d = list.find(x => x.id === r.id);
      if (d && seg !== 'timeline') { seg = isPast(d) ? 'past' : 'planned'; render(); }
      if (!wasEdit) { const b = $('dtList').getBoundingClientRect(); UI.burst(b.left + b.width / 2, b.top + 40, 16); }
      else { current = d || current; renderDetail(); }
    } catch (err) { $('dtErr').textContent = 'Speichern fehlgeschlagen: ' + UI.errText(err); }
  });
  $('dtDel').addEventListener('click', async () => {
    if (!edit || !confirm(`„${edit.title}“ wirklich löschen?`)) return;
    try {
      await pb.collection('date_events').delete(edit.id);
      UI.sheet('dtFormSheet', false); edit = null; current = null; UI.show('s-plans');
      await load(); window.WIR_COUNTDOWN?.reload();
    } catch (err) { $('dtErr').textContent = 'Löschen fehlgeschlagen: ' + UI.errText(err); }
  });
  // Sheet zu -> Bearbeiten beendet
  $('dtFormSheet').addEventListener('click', e => { if (e.target.closest('[data-close]')) edit = null; });

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
    pb.collection('date_kinds').subscribe('*', () => load().catch(console.error)).catch(() => {});
  });
  window.WIR_DATES = { openForm, open, reload: load };
})();
