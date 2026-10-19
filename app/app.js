(() => {
  const pb = new PocketBase(window.location.origin);
  pb.autoCancellation(false);

  const $ = id => document.getElementById(id);
  const me = () => (pb.authStore.record || pb.authStore.model)?.id;
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

  function shrink(file, max = 2048, quality = 0.85) {
    return new Promise((res, rej) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s);
        c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(b => b ? res(b) : rej(new Error('Bild konnte nicht umgewandelt werden')), 'image/jpeg', quality);
      };
      img.onerror = () => rej(new Error('Bild konnte nicht gelesen werden'));
      img.src = url;
    });
  }

  // ======================================================================
  // Foto-Galerien (Erinnerungen + fertige Clay-Figuren)
  // ======================================================================
  function gallery({ collection, grid, status, caption, input, sortable, empty }) {
    let records = [];
    let dragging = false;
    const sort = sortable ? 'order,-created' : '-created';

    function card(r) {
      const d = document.createElement('div');
      d.className = 'photo live';
      d.dataset.id = r.id;

      const img = document.createElement('img');
      img.alt = '';
      img.loading = 'lazy';
      img.src = pb.files.getURL(r, r.image, { thumb: '600x0', token: fileToken });
      d.append(img);

      const who = r.expand?.author?.name;
      const capText = [r.caption, who && '– ' + who].filter(Boolean).join(' ');
      if (capText) {
        const c = document.createElement('div');
        c.className = 'cap';
        c.textContent = capText;
        d.append(c);
      }

      if (r.author === me()) {
        const del = document.createElement('button');
        del.className = 'photo-del';
        del.setAttribute('aria-label', 'Foto löschen');
        del.textContent = '✕';
        del.addEventListener('click', async ev => {
          ev.stopPropagation();
          if (!confirm('Dieses Foto löschen?')) return;
          try {
            await pb.collection(collection).delete(r.id);
            d.remove();
            records = records.filter(x => x.id !== r.id);
            if (!records.length) render();
          } catch (err) {
            status.textContent = 'Löschen fehlgeschlagen: ' + errText(err);
          }
        });
        d.append(del);
      }

      d.addEventListener('click', async () => {
        await refreshToken();
        UI.lightbox(pb.files.getURL(r, r.image, { token: fileToken }), capText);
      });
      return d;
    }

    function render() {
      grid.replaceChildren(...records.map(card));
      if (!records.length) {
        const e = document.createElement('div');
        e.className = 'empty-note';
        e.textContent = empty;
        grid.append(e);
      }
    }

    async function load() {
      if (dragging) return;
      await refreshToken();
      records = await pb.collection(collection).getFullList({ sort, expand: 'author' });
      render();
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
        const changed = ids.map((id, i) => [byId[id], i]).filter(([r, i]) => r && r.order !== i);
        records = ids.map(id => byId[id]).filter(Boolean);
        try {
          if (changed.length) status.textContent = 'Speichere Reihenfolge …';
          await Promise.all(changed.map(([r, i]) => pb.collection(collection).update(r.id, { order: i }).then(() => { r.order = i; })));
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
    sortable: true, empty: 'Noch keine Fotos – füg das erste hinzu 📷',
  });
  const clayDone = gallery({
    collection: 'clay_photos', grid: $('clayPhotos'), status: $('clayStatus'), caption: $('clayCaption'), input: $('clayFile'),
    sortable: false, empty: 'Hier kommen unsere fertigen Figuren hin 🧸',
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
    $('dates').replaceChildren(...list.map(x => {
      let dateTxt, info;
      if (x.birthday) {
        const [m, d] = x.date.slice(-5).split('-').map(Number);
        let next = new Date(today.getFullYear(), m - 1, d);
        if (next < today) next = new Date(today.getFullYear() + 1, m - 1, d);
        const left = Math.round((next - today) / DAY);
        dateTxt = fmt(next);
        info = left === 0 ? 'Heute! 🎉' : 'noch ' + left + (left === 1 ? ' Tag' : ' Tage');
      } else {
        const [y, m, d] = x.date.split('-').map(Number);
        const dt = new Date(y, m - 1, d);
        dateTxt = fmt(dt) + dt.getFullYear();
        const diff = Math.round((today - dt) / DAY);
        info = diff === 0 ? 'Heute! 🎉' : diff > 0 ? 'vor ' + diff + (diff === 1 ? ' Tag' : ' Tagen') : 'in ' + (-diff) + (diff === -1 ? ' Tag' : ' Tagen');
      }
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
    if (!t) { UI.show('s-final'); return; }
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
          await Promise.all(others.map(o => pb.collection('tab_entries').update(o.id, { selected: false })));
        }
        await pb.collection('tab_entries').update(r.id, { selected: on });
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
      UI.show('s-final');
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
  // Laden, Live-Updates, Login
  // ======================================================================
  async function loadAll() {
    await seedDates().catch(console.error);
    await Promise.all([
      memories.load(), clayDone.load(), loadDates(), loadTabs(),
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
      pb.collection('clay_photos').subscribe('*', clayDone.reload),
      pb.collection('dates').subscribe('*', reloadDates),
      pb.collection('tabs').subscribe('*', reloadTabs),
      pb.collection('tab_entries').subscribe('*', e => { if (e.record.tab === currentTab) reloadEntries(); }),
    ]).catch(console.error);
  }

  async function enter() {
    await loadAll();
    subscribe();
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
      UI.show('s-gift');
      enter();
    } catch {
      UI.shake($('lockCard'));
      $('err').textContent = 'Hmm, nicht ganz … versuch’s nochmal 💭';
    }
  });

  $('logoutBtn').addEventListener('click', () => {
    if (!confirm('Wirklich abmelden?')) return;
    pb.authStore.clear();
    location.reload();
  });

  // iOS trennt die Live-Verbindung im Hintergrund -> beim Zurückkommen neu laden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !pb.authStore.isValid || !started) return;
    memories.load().catch(console.error);
    clayDone.load().catch(console.error);
    loadDates().catch(console.error);
    loadTabs().then(() => { if ($('s-tab').classList.contains('active')) return renderTab(); }).catch(console.error);
  });
  // neue gesperrte Reiter der anderen Person kommen nicht per Realtime -> ab und zu nachsehen
  setInterval(() => {
    if (!document.hidden && pb.authStore.isValid && started) loadTabs().catch(console.error);
  }, 60000);

  async function boot() {
    if (!pb.authStore.isValid) { UI.show('s-lock'); return; }
    UI.show('s-gift');
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
    enter();
  }

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
  boot();
})();
