(() => {
  const pb = new PocketBase(window.location.origin);
  pb.autoCancellation(false);
  window.WIR_PB = pb; // extra.js, home.js und /shared/… nutzen dieselbe Verbindung

  const $ = id => document.getElementById(id);
  const me = () => (pb.authStore.record || pb.authStore.model)?.id;
  const shrink = UI.shrink;
  let fileToken = null;
  let started = false;

  async function refreshToken() { fileToken = await pb.files.getToken(); }

  function errText(err) {
    const d = err?.response?.data;
    if (d && Object.keys(d).length) {
      return Object.entries(d).map(([k, v]) => k + ': ' + (v.message || JSON.stringify(v))).join(', ');
    }
    return err?.response?.message || err?.message || 'unbekannter Fehler';
  }

  // mehrere Realtime-Events kurz hintereinander -> nur einmal neu laden
  function debounce(fn, ms = 400) {
    let t;
    return () => { clearTimeout(t); t = setTimeout(() => fn().catch(console.error), ms); };
  }

  const pbDate = s => s ? new Date(s.replace(' ', 'T')) : null;
  const pad = n => String(n).padStart(2, '0');
  const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const fmtWhen = d => `${WD[d.getDay()]}, ${pad(d.getDate())}.${pad(d.getMonth() + 1)}. um ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const toLocalInput = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

  // ======================================================================
  // Foto-Galerien im Polaroid-Look (Erinnerungen + fertige Clay-Figuren)
  // ======================================================================
  function gallery({ collection, grid, status, caption, input, sortable, empty, folders }) {
    let records = [];
    let dragging = false;
    let filter = '';       // '' = alle, sonst ID des Ordners
    let folderList = [];
    const sort = sortable ? 'order,-created' : '-created';
    const visible = () => filter ? records.filter(r => r.folder === filter) : records;

    function card(r) {
      const d = document.createElement('div');
      d.className = 'photo polaroid live';
      d.dataset.id = r.id;

      const pic = document.createElement('div');
      pic.className = 'pic';
      const img = document.createElement('img');
      img.alt = '';
      img.loading = 'lazy';
      img.src = pb.files.getURL(r, r.image, { thumb: '600x0', token: fileToken });
      pic.append(img);

      const who = r.expand?.author?.name;
      const cap = document.createElement('div');
      cap.className = 'pc-cap' + (r.caption ? '' : ' who');
      cap.textContent = r.caption || (who ? '♡ ' + who : '♡');
      d.append(pic, cap);

      const capText = [r.caption, who && '– ' + who].filter(Boolean).join(' ');
      d.addEventListener('click', async () => {
        await refreshToken();
        const actions = [];
        if (folders) actions.push({ label: '📁 Ordner', onClick: () => openMove(r) });
        if (r.author === me()) actions.push({ label: '🗑 Löschen', onClick: () => remove(r) });
        UI.lightbox(pb.files.getURL(r, r.image, { token: fileToken }), capText, actions);
      });
      return d;
    }

    async function remove(r) {
      if (!confirm('Dieses Foto löschen?')) return;
      try {
        await pb.collection(collection).delete(r.id);
        UI.closeLightbox();
        records = records.filter(x => x.id !== r.id);
        render();
      } catch (err) {
        status.textContent = 'Löschen fehlgeschlagen: ' + errText(err);
      }
    }

    function render() {
      const list = visible();
      grid.replaceChildren(...list.map(card));
      if (!list.length) {
        const e = document.createElement('div');
        e.className = 'empty-note';
        e.textContent = filter ? 'Noch keine Fotos in diesem Ordner – lad eins hoch oder verschieb eins hierher 📁' : empty;
        grid.append(e);
      }
      if (folders) renderFolders();
    }

    async function load() {
      if (dragging) return;
      await refreshToken();
      const [recs, fl] = await Promise.all([
        pb.collection(collection).getFullList({ sort, expand: 'author' }),
        folders ? pb.collection('photo_folders').getFullList({ sort: 'order,created' }) : [],
      ]);
      records = recs;
      folderList = fl;
      if (filter && !folderList.some(f => f.id === filter)) filter = '';
      render();
    }

    // ---------- Ordner ----------
    let editFolder = null;

    function folderCard(ico, name, count, on, onClick, extra = '') {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'folder' + (on ? ' on' : '') + extra;
      b.innerHTML = '<span class="f-ico"></span><b></b><small></small>';
      b.querySelector('.f-ico').textContent = ico;
      b.querySelector('b').textContent = name;
      b.querySelector('small').textContent = count;
      b.addEventListener('click', onClick);
      return b;
    }

    function renderFolders() {
      const n = id => records.filter(r => r.folder === id).length;
      const cnt = k => k === 1 ? '1 Foto' : k + ' Fotos';
      $('folderBar').replaceChildren(
        folderCard('🖼️', 'Alle', cnt(records.length), !filter, () => { filter = ''; render(); }),
        ...folderList.map(f => folderCard(f.emoji || '📁', f.name, cnt(n(f.id)), filter === f.id, () => { filter = f.id; render(); })),
        folderCard('➕', 'Ordner', 'neu', false, () => openFolderSheet(null), ' add'),
      );
      const cur = folderList.find(f => f.id === filter);
      $('folderTools').hidden = !cur;
      if (cur) $('folderLabel').textContent = (cur.emoji || '📁') + ' ' + cur.name;
    }

    function openFolderSheet(f) {
      editFolder = f;
      $('folderSheetTitle').textContent = f ? 'Ordner umbenennen' : 'Neuer Ordner 📁';
      $('folderEmoji').value = f?.emoji || '';
      $('folderName').value = f?.name || '';
      $('folderErr').textContent = '';
      UI.sheet('folderSheet');
      setTimeout(() => $('folderName').focus(), 350);
    }

    function openMove(r) {
      const choose = async id => {
        try {
          await pb.collection(collection).update(r.id, { folder: id });
          r.folder = id;
          UI.sheet('moveSheet', false);
          UI.closeLightbox();
          render();
          status.textContent = id ? 'Verschoben ✓' : 'Aus dem Ordner genommen ✓';
        } catch (err) {
          status.textContent = 'Verschieben fehlgeschlagen: ' + errText(err);
        }
      };
      const row = (ico, name, id) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'opt' + ((r.folder || '') === id ? ' on' : '');
        b.innerHTML = '<span class="ico"></span><span><b></b></span>';
        b.querySelector('.ico').textContent = ico;
        b.querySelector('b').textContent = name;
        b.addEventListener('click', () => choose(id));
        return b;
      };
      $('moveList').replaceChildren(row('🖼️', 'Ohne Ordner', ''), ...folderList.map(f => row(f.emoji || '📁', f.name, f.id)));
      if (!folderList.length) {
        const e = document.createElement('div');
        e.className = 'empty-note';
        e.textContent = 'Noch keine Ordner – leg oben unter „➕ Ordner“ einen an.';
        $('moveList').append(e);
      }
      UI.sheet('moveSheet');
    }

    if (folders) {
      $('folderForm').addEventListener('submit', async e => {
        e.preventDefault();
        const data = { name: $('folderName').value.trim(), emoji: $('folderEmoji').value.trim() || '📁' };
        if (!data.name) return;
        try {
          if (editFolder) await pb.collection('photo_folders').update(editFolder.id, data);
          else {
            const f = await pb.collection('photo_folders').create({
              ...data, order: Math.max(-1, ...folderList.map(x => x.order || 0)) + 1, author: me(),
            });
            filter = f.id;
          }
          UI.sheet('folderSheet', false);
          await load();
        } catch (err) {
          $('folderErr').textContent = 'Speichern fehlgeschlagen: ' + errText(err);
        }
      });
      $('folderEdit').addEventListener('click', () => openFolderSheet(folderList.find(f => f.id === filter)));
      $('folderDel').addEventListener('click', async () => {
        const f = folderList.find(x => x.id === filter);
        if (!f || !confirm(`Ordner „${f.name}“ löschen?\nDie Fotos bleiben erhalten – nur ohne Ordner.`)) return;
        try {
          await pb.collection('photo_folders').delete(f.id);
          filter = '';
          await load();
          status.textContent = 'Ordner gelöscht – die Fotos sind unter „Alle“ ✓';
        } catch (err) {
          status.textContent = 'Löschen fehlgeschlagen: ' + errText(err);
        }
      });
    }

    input.addEventListener('change', async e => {
      const files = [...e.target.files];
      if (!files.length) return;
      const cap = caption.value.trim();
      try {
        for (let i = 0; i < files.length; i++) {
          status.textContent = `Lade ${i + 1}/${files.length} hoch …`;
          const fd = new FormData();
          fd.append('image', await shrink(files[i]), 'foto.jpg');
          fd.append('caption', cap);
          fd.append('author', me());
          if (folders && filter) fd.append('folder', filter);
          // neue Fotos landen ganz vorne
          if (sortable) fd.append('order', Math.min(0, ...records.map(x => x.order || 0)) - 1 - i);
          await pb.collection(collection).create(fd);
        }
        status.textContent = 'Hochgeladen ✓';
        caption.value = '';
        await load();
      } catch (err) {
        console.error(err);
        status.textContent = 'Hochladen fehlgeschlagen: ' + errText(err);
      }
      e.target.value = '';
    });

    if (sortable) enableSort();

    // Gedrückt halten -> ziehen -> loslassen
    function enableSort() {
      let timer = null, drag = null, sx = 0, sy = 0, suppressClick = false;

      grid.addEventListener('contextmenu', e => { if (e.target.closest('.photo')) e.preventDefault(); });
      grid.addEventListener('click', e => {
        if (suppressClick) { e.stopPropagation(); e.preventDefault(); suppressClick = false; }
      }, true);

      grid.addEventListener('pointerdown', e => {
        const el = e.target.closest('.photo.live');
        if (!el || e.target.closest('button') || (e.pointerType === 'mouse' && e.button !== 0)) return;
        sx = e.clientX; sy = e.clientY;
        clearTimeout(timer);
        timer = setTimeout(() => {
          timer = null;
          const r = el.getBoundingClientRect();
          drag = { el, offX: sx - r.left, offY: sy - r.top };
          dragging = true;
          el.classList.add('dragging');
          navigator.vibrate?.(15);
        }, 380);
      });

      function move(x, y) {
        const el = drag.el;
        const over = document.elementFromPoint(x, y)?.closest('.photo.live');
        if (over && over !== el && over.parentNode === grid) {
          const items = [...grid.children];
          if (items.indexOf(el) < items.indexOf(over)) over.after(el); else over.before(el);
        }
        el.style.transform = '';
        const r = el.getBoundingClientRect();
        el.style.transform = `translate(${x - drag.offX - r.left}px, ${y - drag.offY - r.top}px) scale(1.05)`;
      }

      window.addEventListener('pointermove', e => {
        if (timer && Math.hypot(e.clientX - sx, e.clientY - sy) > 8) { clearTimeout(timer); timer = null; }
        if (drag) { e.preventDefault(); move(e.clientX, e.clientY); }
      }, { passive: false });

      // verhindert Scrollen während des Ziehens (iOS/Android)
      grid.addEventListener('touchmove', e => { if (drag) e.preventDefault(); }, { passive: false });

      async function end() {
        clearTimeout(timer); timer = null;
        if (!drag) return;
        const el = drag.el;
        drag = null;
        el.classList.remove('dragging');
        el.style.transform = '';
        suppressClick = true;
        setTimeout(() => { suppressClick = false; }, 400);

        const ids = [...grid.querySelectorAll('.photo.live')].map(x => x.dataset.id);
        const byId = Object.fromEntries(records.map(r => [r.id, r]));
        // In einem Ordner nur die Plätze der sichtbaren Fotos untereinander tauschen,
        // damit die Reihenfolge unter „Alle“ sonst gleich bleibt.
        let slots = ids.map((_, i) => i);
        if (filter) {
          slots = ids.map(id => byId[id]?.order ?? 0).sort((a, b) => a - b);
          for (let i = 1; i < slots.length; i++) if (slots[i] <= slots[i - 1]) slots[i] = slots[i - 1] + 0.001;
        }
        const changed = ids.map((id, i) => [byId[id], slots[i]]).filter(([r, o]) => r && r.order !== o);
        if (filter) records.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        else records = ids.map(id => byId[id]).filter(Boolean);
        try {
          if (changed.length) status.textContent = 'Speichere Reihenfolge …';
          await Promise.all(changed.map(([r, o]) => pb.collection(collection).update(r.id, { order: o }).then(() => { r.order = o; })));
          if (filter) records.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          if (changed.length) status.textContent = 'Reihenfolge gespeichert ✓';
        } catch (err) {
          console.error(err);
          status.textContent = 'Sortieren fehlgeschlagen: ' + errText(err);
          dragging = false;
          await load();
        }
        dragging = false;
      }
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
    }

    return { load, reload: debounce(load) };
  }

  const memories = gallery({
    collection: 'photos', grid: $('photos'), status: $('memStatus'), caption: $('caption'), input: $('fileInput'),
    sortable: true, folders: true, empty: 'Noch keine Fotos – füg das erste hinzu 📷',
  });
  const clayDone = gallery({
    collection: 'clay_photos', grid: $('clayPhotos'), status: $('clayStatus'), caption: $('clayCaption'), input: $('clayFile'),
    sortable: false, folders: false, empty: 'Hier kommen unsere fertigen Figuren hin 🧸',
  });

  // ======================================================================
  // Unsere Daten
  // ======================================================================
  // Die bisherigen festen Daten – werden einmalig in die DB übernommen
  const SEED_DATES = [
    { id: 'seeddate0000001', emoji: '💞', title: 'Zusammengekommen', date: '2026-04-10' },
    { id: 'seeddate0000002', emoji: '💋', title: 'Erster Kuss',       date: '2026-04-06' },
    { id: 'seeddate0000003', emoji: '🍝', title: 'Erstes Date',       date: '2026-04-07' },
    { id: 'seeddate0000004', emoji: '🎂', title: 'Dein Geburtstag',   date: '--11-26', birthday: true },
    { id: 'seeddate0000005', emoji: '🎂', title: 'Mein Geburtstag',   date: '--08-20', birthday: true },
  ];

  async function seedDates() {
    const { totalItems } = await pb.collection('dates').getList(1, 1);
    if (totalItems) return;
    for (const d of SEED_DATES) {
      try { await pb.collection('dates').create({ ...d, birthday: !!d.birthday, author: me() }); }
      catch (err) { console.warn('seed', d.id, errText(err)); } // z.B. schon vom anderen Handy angelegt
    }
  }

  function renderDates(list) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const DAY = 86400000;
    const fmt = d => pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.';
    let next = null; // nächster Tag in der Zukunft (für die Dates-Übersicht)
    $('dates').replaceChildren(...list.map(x => {
      let dateTxt, info, left = null;
      if (x.birthday) {
        const [m, d] = x.date.slice(-5).split('-').map(Number);
        let nx = new Date(today.getFullYear(), m - 1, d);
        if (nx < today) nx = new Date(today.getFullYear() + 1, m - 1, d);
        left = Math.round((nx - today) / DAY);
        dateTxt = fmt(nx);
        info = left === 0 ? 'Heute! 🎉' : 'noch ' + left + (left === 1 ? ' Tag' : ' Tage');
      } else {
        const [y, m, d] = x.date.split('-').map(Number);
        const dt = new Date(y, m - 1, d);
        dateTxt = fmt(dt) + dt.getFullYear();
        const diff = Math.round((today - dt) / DAY);
        if (diff <= 0) left = -diff;
        info = diff === 0 ? 'Heute! 🎉' : diff > 0 ? 'vor ' + diff + (diff === 1 ? ' Tag' : ' Tagen') : 'in ' + (-diff) + (diff === -1 ? ' Tag' : ' Tagen');
      }
      if (left !== null && (!next || left < next.left)) next = { left, x };
      const el = document.createElement('div');
      el.className = 'date';
      el.innerHTML = '<span class="ico"></span><div><b></b><span class="d"></span><em></em></div>';
      el.querySelector('.ico').textContent = x.emoji || '💗';
      el.querySelector('b').textContent = x.title;
      el.querySelector('.d').textContent = dateTxt;
      el.querySelector('em').textContent = info;
      if (x.author === me()) {
        const del = document.createElement('button');
        del.className = 'del-x';
        del.type = 'button';
        del.setAttribute('aria-label', 'Datum löschen');
        del.textContent = '✕';
        del.addEventListener('click', async () => {
          if (!confirm(`„${x.title}“ löschen?`)) return;
          try { await pb.collection('dates').delete(x.id); el.remove(); }
          catch (err) { alert('Löschen fehlgeschlagen: ' + errText(err)); }
        });
        el.append(del);
      }
      return el;
    }));
    $('planDatesInfo').textContent = next
      ? `${next.x.emoji || '💗'} ${next.x.title}: ${next.left === 0 ? 'heute 🎉' : 'in ' + next.left + (next.left === 1 ? ' Tag' : ' Tagen')}`
      : 'Die wichtigsten Tage';
  }

  async function loadDates() {
    renderDates(await pb.collection('dates').getFullList({ sort: 'created,id' }));
  }

  $('dateToggle').addEventListener('click', () => {
    $('dateForm').hidden = !$('dateForm').hidden;
    if (!$('dateForm').hidden) $('dateTitle').focus();
  });

  $('dateForm').addEventListener('submit', async e => {
    e.preventDefault();
    $('dateErr').textContent = '';
    const birthday = $('dateBirthday').checked;
    const v = $('dateValue').value; // YYYY-MM-DD
    try {
      await pb.collection('dates').create({
        emoji: $('dateEmoji').value.trim() || (birthday ? '🎂' : '💗'),
        title: $('dateTitle').value.trim(),
        date: birthday ? '--' + v.slice(5) : v,
        birthday,
        author: me(),
      });
      $('dateForm').reset();
      $('dateForm').hidden = true;
      await loadDates();
      const r = $('dates').lastElementChild?.getBoundingClientRect();
      if (r) UI.burst(r.left + 40, r.top + r.height / 2, 12);
    } catch (err) {
      $('dateErr').textContent = 'Speichern fehlgeschlagen: ' + errText(err);
    }
  });

  // ======================================================================
  // Eigene Reiter (+ geplante Freigabe)
  // ======================================================================
  let tabs = [];        // für mich sichtbare Reiter
  let locks = [];       // gesperrte Reiter der anderen Person (nur Zeitpunkt)
  let currentTab = null;
  let unlockTimer = null;
  const seenTabs = new Set();

  const isLocked = t => t.unlock_at && pbDate(t.unlock_at) > new Date();

  function optButton(ico, title, small, note) {
    const b = document.createElement('button');
    b.className = 'opt';
    b.type = 'button';
    b.innerHTML = '<span class="ico"></span><span><b></b><small></small></span>';
    b.querySelector('.ico').textContent = ico;
    b.querySelector('b').textContent = title;
    b.querySelector('small').textContent = small;
    if (note) {
      const n = document.createElement('span');
      n.className = 'lock-note';
      n.textContent = note;
      b.lastElementChild.append(n);
    }
    return b;
  }

  function renderTabMenu() {
    const items = [];
    for (const t of tabs) {
      const mine = t.author === me();
      const note = isLocked(t) ? '🔒 Freigabe ' + fmtWhen(pbDate(t.unlock_at)) + ' · nur du siehst das' : '';
      const b = optButton(t.emoji || '✨', t.name, mine ? 'Von dir' : (t.expand?.author?.name ? 'Von ' + t.expand.author.name : 'Gemeinsam'), note);
      b.addEventListener('click', () => openTab(t.id));
      if (started && !seenTabs.has(t.id) && !mine) b.classList.add('fresh');
      seenTabs.add(t.id);
      items.push({ at: t.created, el: b });
    }
    for (const l of locks) {
      if (l.author === me()) continue;
      const b = optButton('🔒', 'Neues Date geplant 🔒', 'Freigabe am ' + fmtWhen(pbDate(l.unlock_at)));
      b.classList.add('locked');
      b.addEventListener('click', () => {
        const r = b.getBoundingClientRect(); UI.burst(r.left + 40, r.top + r.height / 2, 8);
      });
      items.push({ at: l.id, el: b, lock: true });
    }
    // gesperrte Kärtchen ans Ende
    $('tabMenu').replaceChildren(...items.filter(i => !i.lock).map(i => i.el), ...items.filter(i => i.lock).map(i => i.el));
  }

  function scheduleUnlock() {
    clearTimeout(unlockTimer);
    const times = [...locks.map(l => l.unlock_at), ...tabs.filter(isLocked).map(t => t.unlock_at)]
      .map(pbDate).filter(d => d > new Date()).map(d => d.getTime());
    if (!times.length) return;
    // +1,5 s Puffer, falls die Uhr des Handys etwas vorgeht
    const ms = Math.min(Math.min(...times) - Date.now() + 1500, 2 ** 31 - 1);
    unlockTimer = setTimeout(async () => {
      await loadTabs();
      if (currentTab && $('s-tab').classList.contains('active')) renderTab();
    }, Math.max(ms, 1000));
  }

  async function loadTabs() {
    [tabs, locks] = await Promise.all([
      pb.collection('tabs').getFullList({ sort: 'created', expand: 'author' }),
      pb.collection('tab_locks').getFullList(),
    ]);
    renderTabMenu();
    scheduleUnlock();
  }

  async function openTab(id) {
    currentTab = id;
    $('entries').replaceChildren();
    UI.show('s-tab');
    $('s-tab').scrollTop = 0;
    await renderTab();
  }

  async function renderTab() {
    const t = tabs.find(x => x.id === currentTab);
    if (!t) { UI.show('s-plans'); return; }
    const mine = t.author === me();
    $('tabTitle').textContent = t.name + ' ' + (t.emoji || '');
    $('tabDelete').hidden = !mine;
    $('tabLock').hidden = !(mine && isLocked(t));
    if (mine && isLocked(t)) {
      const d = pbDate(t.unlock_at);
      $('tabLockText').textContent = 'Freigabe ' + fmtWhen(d) + ' – bis dahin sieht die andere Person nur ein gesperrtes Kärtchen.';
      $('tabUnlockEdit').value = toLocalInput(d);
    }
    await loadEntries();
  }

  async function loadEntries() {
    if (!currentTab) return;
    await refreshToken();
    const list = await pb.collection('tab_entries').getFullList({
      filter: pb.filter('tab = {:t}', { t: currentTab }), sort: 'created', expand: 'author',
    });
    $('entries').replaceChildren(...list.map(entryCard));
    if (!list.length) {
      const e = document.createElement('div');
      e.className = 'empty-note';
      e.textContent = 'Noch leer – schreib die erste Idee rein ✨';
      $('entries').append(e);
    }
  }

  function entryCard(r) {
    const d = document.createElement('div');
    d.className = 'entry' + (r.selected ? ' sel' : '');
    if (r.image) {
      const img = document.createElement('img');
      img.alt = '';
      img.loading = 'lazy';
      img.src = pb.files.getURL(r, r.image, { thumb: '600x0', token: fileToken });
      img.addEventListener('click', async () => {
        await refreshToken();
        UI.lightbox(pb.files.getURL(r, r.image, { token: fileToken }), r.title);
      });
      d.append(img);
    }
    const row = document.createElement('div');
    row.className = 'e-row';
    const title = document.createElement('div');
    title.className = 'e-title';
    title.textContent = r.title;
    const sub = document.createElement('small');
    sub.textContent = (r.selected ? '❤️ Ausgewählt · ' : '') + (r.expand?.author?.name || '');
    title.append(sub);
    const heart = document.createElement('button');
    heart.className = 'heart-btn' + (r.selected ? ' on' : '');
    heart.type = 'button';
    heart.setAttribute('aria-label', r.selected ? 'Auswahl aufheben' : 'Auswählen');
    heart.textContent = '❤️';
    heart.addEventListener('click', async () => {
      try {
        const on = !r.selected;
        if (on) {
          // nur einer pro Reiter: die anderen abwählen
          const others = await pb.collection('tab_entries').getFullList({
            filter: pb.filter('tab = {:t} && selected = true && id != {:id}', { t: r.tab, id: r.id }),
          });
          await Promise.all(others.map(o => pb.collection('tab_entries').update(o.id, { selected: false, selected_by: me() })));
        }
        // selected_by: damit der Push-Dienst weiß, wer es war
        await pb.collection('tab_entries').update(r.id, { selected: on, selected_by: me() });
        if (on) { const b = heart.getBoundingClientRect(); UI.burst(b.left + 21, b.top + 21, 14); }
        await loadEntries();
      } catch (err) {
        $('entryStatus').textContent = 'Ging nicht: ' + errText(err);
      }
    });
    row.append(title, heart);
    if (r.author === me()) {
      const del = document.createElement('button');
      del.className = 'del-x';
      del.type = 'button';
      del.setAttribute('aria-label', 'Eintrag löschen');
      del.textContent = '✕';
      del.addEventListener('click', async () => {
        if (!confirm(`„${r.title}“ löschen?`)) return;
        try { await pb.collection('tab_entries').delete(r.id); await loadEntries(); }
        catch (err) { $('entryStatus').textContent = 'Löschen fehlgeschlagen: ' + errText(err); }
      });
      row.append(del);
    }
    d.append(row);
    return d;
  }

  $('entryFile').addEventListener('change', () => {
    const has = $('entryFile').files.length > 0;
    $('entryPick').classList.toggle('has', has);
    $('entryPick').firstChild.textContent = has ? '🖼️ ✓' : '🖼️ Bild';
  });

  $('entryForm').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('tab', currentTab);
    fd.append('title', $('entryTitle').value.trim());
    fd.append('author', me());
    try {
      $('entryStatus').textContent = 'Speichere …';
      const f = $('entryFile').files[0];
      if (f) fd.append('image', await shrink(f), 'bild.jpg');
      await pb.collection('tab_entries').create(fd);
      $('entryForm').reset();
      $('entryFile').dispatchEvent(new Event('change'));
      $('entryStatus').textContent = '';
      await loadEntries();
    } catch (err) {
      $('entryStatus').textContent = 'Speichern fehlgeschlagen: ' + errText(err);
    }
  });

  async function setUnlock(value) {
    try {
      await pb.collection('tabs').update(currentTab, { unlock_at: value });
      await loadTabs();
      await renderTab();
    } catch (err) {
      $('entryStatus').textContent = 'Ging nicht: ' + errText(err);
    }
  }
  $('tabUnlockSave').addEventListener('click', () => {
    const v = $('tabUnlockEdit').value;
    if (v) setUnlock(new Date(v).toISOString());
  });
  $('tabUnlockNow').addEventListener('click', async () => {
    if (!confirm('Jetzt für euch beide freigeben?')) return;
    await setUnlock('');
    const r = $('tabTitle').getBoundingClientRect();
    UI.burst(r.left + r.width / 2, r.top + 20, 22);
  });

  $('tabDelete').addEventListener('click', async () => {
    const t = tabs.find(x => x.id === currentTab);
    if (!t || !confirm(`Reiter „${t.name}“ mit allen Einträgen löschen?`)) return;
    try {
      await pb.collection('tabs').delete(t.id);
      currentTab = null;
      await loadTabs();
      UI.show('s-plans');
    } catch (err) {
      $('entryStatus').textContent = 'Löschen fehlgeschlagen: ' + errText(err);
    }
  });

  // ---------- Neuer Reiter ----------
  $('newTabBtn').addEventListener('click', () => {
    $('tabForm').reset();
    $('tabPlanBox').hidden = true;
    $('tabErr').textContent = '';
    UI.show('s-newtab');
  });
  $('tabPlan').addEventListener('change', () => {
    $('tabPlanBox').hidden = !$('tabPlan').checked;
    if ($('tabPlan').checked && !$('tabUnlock').value) {
      const d = new Date(Date.now() + 86400000); d.setHours(18, 0, 0, 0);
      $('tabUnlock').value = toLocalInput(d);
    }
  });
  $('tabForm').addEventListener('submit', async e => {
    e.preventDefault();
    $('tabErr').textContent = '';
    let unlock = '';
    if ($('tabPlan').checked) {
      const d = new Date($('tabUnlock').value);
      if (isNaN(d) || d <= new Date()) { $('tabErr').textContent = 'Bitte einen Zeitpunkt in der Zukunft wählen'; return; }
      unlock = d.toISOString();
    }
    try {
      const t = await pb.collection('tabs').create({
        name: $('tabName').value.trim(),
        emoji: $('tabEmoji').value.trim() || '✨',
        unlock_at: unlock,
        author: me(),
      });
      await loadTabs();
      openTab(t.id);
    } catch (err) {
      $('tabErr').textContent = 'Anlegen fehlgeschlagen: ' + errText(err);
    }
  });

  // ======================================================================
  // Wir zwei (Pings) + Liebe-Glas
  // ======================================================================
  let partner = null;
  const PING = {
    heart:   { ico: '❤️', label: 'Herz' },
    call:    { ico: '📞', label: 'Möchte dich anrufen' },
    love:    { ico: '💗', label: 'Ganz viel Liebe' },
    support: { ico: '🫂', label: 'Mentaler Support – ich bin für dich da' },
    message: { ico: '✏️', label: 'Nachricht' },
  };
  const isLove = t => t === 'love' || t === 'heart';

  function ago(d) {
    const s = Math.round((Date.now() - d) / 1000);
    if (s < 60) return 'gerade eben';
    if (s < 3600) return 'vor ' + Math.floor(s / 60) + ' Min.';
    if (s < 86400) return 'vor ' + Math.floor(s / 3600) + ' Std.';
    return fmtWhen(d);
  }

  function pingStatus(text) {
    document.querySelectorAll('.ping-status').forEach(el => { el.textContent = text; });
  }

  async function loadPartner() {
    const list = await pb.collection('users').getFullList({ filter: pb.filter('id != {:me}', { me: me() }) });
    partner = list[0] || null;
    $('partnerName').textContent = partner ? (partner.name || 'Dein Schatz') + ' 💕' : 'Noch niemand da';
  }

  // Verlauf: Liebe-Tipps derselben Person kurz hintereinander werden zu einer Zeile zusammengefasst
  function groupPings(items) {
    const out = [];
    for (const p of items) {
      const last = out[out.length - 1];
      if (last && isLove(p.type) && isLove(last.type) && last.from === p.from
        && pbDate(last.items[last.items.length - 1].created) - pbDate(p.created) < 15 * 60000) {
        last.items.push(p);
      } else {
        out.push({ type: p.type, from: p.from, items: [p] });
      }
    }
    return out;
  }

  async function loadPings() {
    const { items } = await pb.collection('pings').getList(1, 120, { sort: '-created', expand: 'from' });
    $('pings').replaceChildren(...groupPings(items).slice(0, 40).map(g => {
      const p = g.items[0];
      const sent = p.from === me();
      const meta = PING[p.type] || PING.heart;
      const el = document.createElement('div');
      el.className = 'date' + (sent ? '' : ' in');
      el.innerHTML = '<span class="ico"></span><div><b></b><span class="d"></span><em></em></div>';
      el.querySelector('.ico').textContent = isLove(p.type) ? '💗' : meta.ico;
      el.querySelector('b').textContent = sent ? 'Du → ' + (partner?.name || 'Schatz') : (p.expand?.from?.name || 'Schatz') + ' → dich';
      el.querySelector('.d').textContent = p.type === 'message' ? p.message
        : isLove(p.type) ? (g.items.length > 1 ? `${g.items.length}× Liebe` : 'Liebe') : meta.label;
      el.querySelector('em').textContent = ago(pbDate(p.created));
      if (sent) {
        const del = document.createElement('button');
        del.className = 'del-x';
        del.type = 'button';
        del.setAttribute('aria-label', 'Aus dem Verlauf löschen');
        del.textContent = '✕';
        del.addEventListener('click', async () => {
          if (!confirm('Aus dem Verlauf löschen?')) return;
          try { await Promise.all(g.items.map(x => pb.collection('pings').delete(x.id))); el.remove(); loadLove().catch(console.error); }
          catch (err) { pingStatus('Löschen fehlgeschlagen: ' + errText(err)); }
        });
        el.append(del);
      }
      return el;
    }));
    if (!items.length) {
      const e = document.createElement('div');
      e.className = 'empty-note';
      e.textContent = 'Noch nichts geschickt – fang mit Liebe an 💗';
      $('pings').append(e);
    }
  }
  const reloadPings = debounce(loadPings, 600);

  async function sendPing(type, message, btn) {
    if (!partner) { pingStatus('Niemand zum Anschicken gefunden 🥺'); return false; }
    const data = { from: me(), to: partner.id, type };
    if (type === 'message') data.message = message;
    try {
      if (btn) btn.disabled = true;
      await pb.collection('pings').create(data);
      const r = (btn || $('msgForm')).getBoundingClientRect();
      UI.burst(r.left + r.width / 2, r.top + r.height / 2, 16);
      pingStatus('Gesendet an ' + (partner.name || 'Schatz') + ' ✓');
      reloadPings();
      return true;
    } catch (err) {
      pingStatus('Senden fehlgeschlagen: ' + errText(err));
      return false;
    } finally {
      if (btn) setTimeout(() => { btn.disabled = false; }, 1500);
    }
  }

  document.querySelectorAll('[data-ping]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.ping === 'love') sendLove(b); else sendPing(b.dataset.ping, '', b);
  }));

  // ---------- Nachricht (Bottom-Sheet) ----------
  document.querySelectorAll('[data-msg]').forEach(b => b.addEventListener('click', () => {
    UI.sheet('msgSheet');
    setTimeout(() => $('msgText').focus(), 350);
  }));
  $('msgText').addEventListener('input', () => { $('msgCount').textContent = $('msgText').value.length + '/200'; });
  $('msgForm').addEventListener('submit', async e => {
    e.preventDefault();
    const text = $('msgText').value.trim().slice(0, 200);
    if (!text) return;
    if (await sendPing('message', text)) {
      $('msgForm').reset();
      $('msgCount').textContent = '0/200';
      UI.sheet('msgSheet', false);
    }
  });

  // ---------- Liebe-Glas: EIN gemeinsames Herz, ab dem ersten Tipp voll, harter Schnitt zwischen beiden Herzfarben ----------
  const LOVE_COOLDOWN = 500;
  const HEART = 'M50 88 C22 68 4 52 4 31 C4 15 15 4 29 4 C38 4 46 9 50 17 C54 9 62 4 71 4 C85 4 96 15 96 31 C96 52 78 68 50 88Z';
  const love = { mine: 0, theirs: 0 };
  const heartHex = { me: '#3b9eff', partner: '#ff5fa2' };
  let midnightTimer = null;

  // Flüssigkeit: oben meine Farbe, unten die der anderen Person, harte Kante dazwischen
  $('loveHeart').insertAdjacentHTML('afterbegin', `
<svg viewBox="0 0 100 92" aria-hidden="true">
  <defs>
    <clipPath id="hc-love"><path d="${HEART}"/></clipPath>
    <linearGradient id="hl-love" gradientUnits="userSpaceOnUse" x1="0" y1="-6" x2="0" y2="88">
      <stop class="s-me" offset="0"/><stop class="s-me" offset=".45"/>
      <stop class="s-pa" offset=".55"/><stop class="s-pa" offset="1"/>
    </linearGradient>
    <linearGradient id="hs-love" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity=".14"/>
    </linearGradient>
  </defs>
  <path class="h-glass" d="${HEART}"/>
  <g clip-path="url(#hc-love)">
    <g class="h-liquid" transform="translate(0 92)">
      <path class="h-wave back" d="M-100 2 Q-75 -5 -50 2 T0 2 T50 2 T100 2 T150 2 T200 2 V120 H-100Z" fill="url(#hl-love)"/>
      <path class="h-wave" d="M-100 0 Q-75 6 -50 0 T0 0 T50 0 T100 0 T150 0 T200 0 V120 H-100Z" fill="url(#hl-love)"/>
    </g>
    <rect x="0" y="0" width="100" height="92" fill="url(#hs-love)"/>
  </g>
  <path class="h-rim" d="${HEART}"/>
  <path class="h-shine" d="M21 18 C14 22 11 29 12 37"/>
  <circle class="h-shine2" cx="25" cy="45" r="2.4"/>
</svg>`);

  // weich zum Ziel gleiten (Füllstand + Anteil), statt zu springen
  const shown = { fill: 0, share: 0.5 };
  const target = { fill: 0, share: 0.5 };
  let anim = 0;
  // Fläche des Herzens pro Zeile (von oben aufsummiert) -> Schnitt so, dass der Anteil der FLÄCHE stimmt
  const heartRows = (() => {
    const out = new Float64Array(93);
    try {
      const ctx = document.createElement('canvas').getContext('2d'), p = new Path2D(HEART);
      for (let y = 0; y < 92; y++) {
        let n = 0;
        for (let x = 0; x < 100; x += 0.5) if (ctx.isPointInPath(p, x, y + 0.5)) n++;
        out[y + 1] = out[y] + n;
      }
    } catch (_) { for (let y = 0; y < 92; y++) out[y + 1] = y + 1; }
    return out;
  })();
  // Markierungen bei 25/50/75 % (nach Fläche, volles Herz): kurze Striche innen am linken und rechten Rand
  (function drawTicks() {
    let ctx, p;
    try { ctx = document.createElement('canvas').getContext('2d'); p = new Path2D(HEART); } catch (_) { return; }
    const marks = [0.25, 0.5, 0.75].map(share => {
      const y = cutY(4, share);
      let l = 50, r = 50;
      while (l > 0 && ctx.isPointInPath(p, l - 0.25, y)) l -= 0.25;
      while (r < 100 && ctx.isPointInPath(p, r + 0.25, y)) r += 0.25;
      const len = share === 0.5 ? 9 : 6;
      return `<path class="h-tick${share === 0.5 ? ' mid' : ''}" d="M${(l + 1.5).toFixed(2)} ${y.toFixed(2)}h${len}M${(r - 1.5).toFixed(2)} ${y.toFixed(2)}h-${len}"/>`;
    }).join('');
    $('loveHeart').querySelector('svg .h-rim').insertAdjacentHTML('beforebegin', `<g class="h-ticks">${marks}</g>`);
  })();
  function cutY(top, share) {
    const t0 = Math.max(0, Math.floor(top)), total = heartRows[92] - heartRows[t0];
    const want = heartRows[t0] + share * total;
    let y = t0;
    while (y < 92 && heartRows[y + 1] < want) y++;
    const row = heartRows[y + 1] - heartRows[y];
    return y + (row ? (want - heartRows[y]) / row : 0);
  }
  function drawLove() {
    const box = $('loveHeart');
    const top = 92 - shown.fill * 88; // 92 = leer, 4 = randvoll
    box.querySelector('.h-liquid').setAttribute('transform', `translate(0 ${top.toFixed(2)})`);
    // Verlauf in Koordinaten der Flüssigkeit: 0 = Oberfläche (inkl. Welle), unten = Herzspitze
    const g = box.querySelector('#hl-love');
    g.setAttribute('y2', (88 - top).toFixed(2));
    // harte Kante: beide Stopps an derselben Stelle (y-Werte in Koordinaten der Flüssigkeit, Verlauf läuft von -6 bis 88 - top)
    const a = Math.min(1, Math.max(0, shown.share));
    const local = cutY(top, a) - top;
    const off = Math.min(1, Math.max(0, (local + 6) / (88 - top + 6)));
    const st = g.querySelectorAll('stop');
    st[1].setAttribute('offset', a >= 1 ? 1 : a <= 0 ? 0 : off);
    st[2].setAttribute('offset', a >= 1 ? 1 : a <= 0 ? 0 : off);
    box.classList.toggle('wet', shown.fill >= 0.42);
  }
  function stepLove() {
    const k = UI.reduced() ? 1 : 0.12;
    let moving = false;
    for (const p of ['fill', 'share']) {
      const d = target[p] - shown[p];
      if (Math.abs(d) > 0.001) { shown[p] += d * k; moving = true; } else shown[p] = target[p];
    }
    drawLove();
    anim = moving ? requestAnimationFrame(stepLove) : 0;
  }
  function paintColors() {
    const st = $('loveHeart').querySelectorAll('#hl-love stop');
    st[0].setAttribute('stop-color', heartHex.me); st[1].setAttribute('stop-color', heartHex.me);
    st[2].setAttribute('stop-color', heartHex.partner); st[3].setAttribute('stop-color', heartHex.partner);
    $('loveWhoMe').style.setProperty('--c', heartHex.me);
    $('loveWhoPartner').style.setProperty('--c', heartHex.partner);
    document.documentElement.style.setProperty('--heart-me', heartHex.me);
  }
  paintColors();
  document.addEventListener('wir:hearts', e => { Object.assign(heartHex, e.detail); paintColors(); });

  function renderLove() {
    const total = love.mine + love.theirs;
    target.fill = total ? 1 : 0;
    if (total) target.share = love.mine / total;
    if (!anim) anim = requestAnimationFrame(stepLove);
    $('loveTotal').textContent = total;
    $('loveNumMe').textContent = love.mine;
    $('loveNumPartner').textContent = love.theirs;
    $('loveHeart').classList.toggle('full', total > 0);
    const pn = partner?.name || 'Schatz';
    $('wirToday').textContent = love.theirs || love.mine ? `Heute: 💗 ${love.theirs}× von ${pn} · ${love.mine}× von dir` : '';
  }

  function pulse(box) {
    box.classList.remove('pulse');
    void box.offsetWidth;
    box.classList.add('pulse');
  }

  async function loadLove() {
    if (!partner) return;
    const t = new Date(UI.berlinMidnight());
    const f = (from, to) => pb.filter('from = {:f} && to = {:to} && (type = "love" || type = "heart") && created >= {:t}', { f: from, to, t });
    const [a, b] = await Promise.all([
      pb.collection('pings').getList(1, 1, { filter: f(partner.id, me()), fields: 'id' }),
      pb.collection('pings').getList(1, 1, { filter: f(me(), partner.id), fields: 'id' }),
    ]);
    love.theirs = a.totalItems;
    love.mine = Math.max(b.totalItems, pendingLove ? love.mine : 0);
    renderLove();
    // um 00:00 (Berlin) zurücksetzen
    clearTimeout(midnightTimer);
    const next = UI.berlinMidnight(UI.berlinMidnight() + UI.DAY + 3 * 3600000); // morgen 00:00 (auch bei Zeitumstellung)
    midnightTimer = setTimeout(() => loadLove().catch(console.error), Math.min(next - Date.now() + 1000, 2 ** 31 - 1));
  }
  const reloadLove = debounce(loadLove, 1200);

  let pendingLove = 0;
  function floatHearts(btn) {
    const r = btn.getBoundingClientRect();
    const n = UI.reduced() ? 1 : 4;
    for (let i = 0; i < n; i++) {
      const h = document.createElement('span');
      h.className = 'float-heart';
      h.textContent = ['💗', '💖', '💕', '❤️'][i % 4];
      h.style.left = r.left + r.width / 2 + (Math.random() - 0.5) * r.width * 0.5 + 'px';
      h.style.top = r.top + 'px';
      h.style.setProperty('--dx', (Math.random() - 0.5) * 120 + 'px');
      h.style.animationDelay = i * 70 + 'ms';
      document.body.append(h);
      setTimeout(() => h.remove(), 1400);
    }
  }

  // 0,5 s Pause pro Tipp: alle Liebe-Knöpfe kurz gesperrt, mit sichtbarem Ablauf
  let loveCoolUntil = 0;
  function coolDown() {
    loveCoolUntil = Date.now() + LOVE_COOLDOWN;
    const btns = [$('loveBtn'), ...document.querySelectorAll('[data-ping="love"]')];
    btns.forEach(b => { b.disabled = true; b.classList.remove('cooling'); void b.offsetWidth; b.classList.add('cooling'); });
    setTimeout(() => btns.forEach(b => { b.disabled = false; b.classList.remove('cooling'); }), LOVE_COOLDOWN);
  }

  async function sendLove(btn) {
    if (!partner) { pingStatus('Niemand zum Anschicken gefunden 🥺'); return; }
    if (Date.now() < loveCoolUntil) return;
    coolDown();
    love.mine++;
    pendingLove++;
    renderLove();
    pulse($('loveHeart'));
    floatHearts(btn);
    navigator.vibrate?.(15);
    try {
      await pb.collection('pings').create({ from: me(), to: partner.id, type: 'love' });
      pingStatus('💗 Liebe an ' + (partner.name || 'Schatz') + ' geschickt');
    } catch (err) {
      love.mine = Math.max(0, love.mine - 1);
      renderLove();
      pingStatus('Senden fehlgeschlagen: ' + errText(err));
    } finally {
      pendingLove--;
      reloadPings();
      if (!pendingLove) reloadLove();
    }
  }
  $('loveBtn').addEventListener('click', () => sendLove($('loveBtn')));

  // ======================================================================
  // Spiele (eigene App unter :8443) – Kachel auf Start mit „Du bist am Zug“, Tagesbonus
  // Push-Benachrichtigungen: /shared/push.js (Abo mit app = "wir")
  // ======================================================================
  async function loadSpieleHint() {
    const mine = pb.filter('status = "active" && turn = {:me}', { me: me() });
    const [c, t] = await Promise.all([
      pb.collection('chess_games').getList(1, 1, { filter: mine, fields: 'id' }),
      pb.collection('ttt_games').getList(1, 1, { filter: mine + ' && mode = "pvp"', fields: 'id' }),
    ]);
    const games = [c.totalItems && 'Schach', t.totalItems && 'Tic Tac Toe'].filter(Boolean);
    $('spieleInfo').textContent = games.length ? '🎲 Du bist am Zug: ' + games.join(' · ') : 'Schach, Sudoku, Herzstadt, Casino & Shop';
    $('spieleLink').classList.toggle('hot', games.length > 0);
  }
  // Heart Coins sammelt man auch hier; den Tagesbonus gibt es beim ersten Öffnen einer der beiden Apps
  const dailyBonus = () => pb.send('/api/coins/daily', { method: 'POST' });

  // ---------- aus einer Benachrichtigung heraus öffnen ----------
  async function goTo(target) {
    if (!target) return;
    if (target.startsWith('tab:')) {
      const id = target.slice(4);
      await loadTabs().catch(console.error);
      if (tabs.some(t => t.id === id)) { openTab(id); return; }
      target = 's-plans';
    }
    const orig = target;
    target = UI.resolve(target);
    if (!$(target)?.classList.contains('page')) target = 's-home';
    UI.show(target);
    $(target).scrollTop = 0;
    if (target === 's-wir') loadPings().catch(console.error);
    document.dispatchEvent(new CustomEvent('wir:go', { detail: orig })); // extra.js lädt seine Bereiche nach
  }

  // Ziel aus der URL (/#go=...) – wird vom Service Worker beim Öffnen gesetzt
  const startGo = new URLSearchParams(location.hash.slice(1)).get('go');
  if (startGo) history.replaceState(null, '', location.pathname + location.search);
  window.addEventListener('hashchange', () => {
    const go = new URLSearchParams(location.hash.slice(1)).get('go');
    if (!go) return;
    history.replaceState(null, '', location.pathname + location.search);
    if (pb.authStore.isValid && started) goTo(go);
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data?.go && pb.authStore.isValid && started) goTo(e.data.go);
    });
  }

  // beim Öffnen der Bereiche frisch laden
  document.addEventListener('wir:show', e => {
    if (!started) return;
    if (e.detail === 's-wir') { pingStatus(''); loadPings().catch(console.error); loadLove().catch(console.error); }
    if (e.detail === 's-home') { loadLove().catch(console.error); loadSpieleHint().catch(console.error); }
  });

  // ======================================================================
  // Laden, Live-Updates, Login
  // ======================================================================
  async function loadAll() {
    await seedDates().catch(console.error);
    await loadPartner().catch(console.error);
    await Promise.all([
      memories.load(), clayDone.load(), loadDates(), loadTabs(), loadPings(), loadLove(), loadSpieleHint(), dailyBonus(),
    ].map(p => p.catch(err => console.error(err))));
    started = true;
  }

  let subscribed = false;
  async function subscribe() {
    if (subscribed) return;
    subscribed = true;
    const reloadTabs = debounce(async () => {
      await loadTabs();
      if ($('s-tab').classList.contains('active')) await renderTab();
    });
    const reloadEntries = debounce(loadEntries);
    const reloadDates = debounce(loadDates);
    await Promise.all([
      pb.collection('photos').subscribe('*', memories.reload),
      pb.collection('photo_folders').subscribe('*', memories.reload),
      pb.collection('clay_photos').subscribe('*', clayDone.reload),
      pb.collection('dates').subscribe('*', reloadDates),
      pb.collection('tabs').subscribe('*', reloadTabs),
      pb.collection('tab_entries').subscribe('*', e => { if (e.record.tab === currentTab) reloadEntries(); }),
      pb.collection('pings').subscribe('*', e => {
        reloadPings();
        if (e.action === 'create' && e.record.to === me()) {
          if (isLove(e.record.type)) {
            love.theirs++;
            renderLove();
            pulse($('loveHeart'));
            reloadLove();
          } else if ($('s-wir').classList.contains('active') || $('s-home').classList.contains('active')) {
            UI.burst(window.innerWidth / 2, window.innerHeight / 3, 22);
          }
        }
      }),
    ]).catch(console.error);
  }

  async function enter(target) {
    await loadAll();
    subscribe();
    document.dispatchEvent(new CustomEvent('wir:started'));
    if (target) goTo(target);
  }

  $('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    $('err').textContent = '';
    try {
      await pb.collection('users').authWithPassword($('loginEmail').value.trim(), $('loginPass').value);
      $('loginPass').value = '';
      const r = $('lockCard').getBoundingClientRect();
      UI.burst(r.left + r.width / 2, r.top + r.height / 2, 24);
      await UI.wait(500);
      UI.show(startGo ? 's-home' : 's-gift');
      enter(startGo);
    } catch {
      UI.shake($('lockCard'));
      $('err').textContent = 'Hmm, nicht ganz … versuch’s nochmal 💭';
    }
  });

  $('logoutBtn').addEventListener('click', async () => {
    if (!confirm('Wirklich abmelden?')) return;
    // dieses Handy soll keine Benachrichtigungen für den alten Account mehr bekommen
    await window.WIR_PUSH?.drop().catch(console.error);
    pb.authStore.clear();
    location.reload();
  });

  // iOS trennt die Live-Verbindung im Hintergrund -> beim Zurückkommen neu laden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !pb.authStore.isValid || !started) return;
    memories.load().catch(console.error);
    clayDone.load().catch(console.error);
    loadDates().catch(console.error);
    loadPings().catch(console.error);
    loadLove().catch(console.error);
    loadSpieleHint().catch(console.error);
    dailyBonus().catch(console.error);
    loadTabs().then(() => { if ($('s-tab').classList.contains('active')) return renderTab(); }).catch(console.error);
  });
  // neue gesperrte Reiter der anderen Person kommen nicht per Realtime -> ab und zu nachsehen
  setInterval(() => {
    if (!document.hidden && pb.authStore.isValid && started) loadTabs().catch(console.error);
  }, 60000);

  async function boot() {
    if (!pb.authStore.isValid) { UI.show('s-lock'); return; }
    UI.show(startGo ? 's-home' : 's-gift');
    try {
      await pb.collection('users').authRefresh();
    } catch (err) {
      // nur bei ungültigem Login abmelden – offline einfach weitermachen
      if ([401, 403, 404].includes(err?.status)) {
        pb.authStore.clear();
        UI.show('s-lock');
        return;
      }
    }
    enter(startGo);
  }

  boot();
})();
