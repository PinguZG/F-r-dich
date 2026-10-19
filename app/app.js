(() => {
  const pb = new PocketBase(window.location.origin);
  pb.autoCancellation(false);

  const $ = id => document.getElementById(id);
  const me = () => (pb.authStore.record || pb.authStore.model)?.id;
  const grid = $('photos');
  let fileToken = null;
  let subscribed = false;

  async function refreshToken() { fileToken = await pb.files.getToken(); }

  function setView(loggedIn) {
    $('memLogin').hidden = loggedIn;
    $('memTools').hidden = !loggedIn;
  }

  function openLightbox(src, cap) {
    $('lbImg').src = src;
    $('lbCap').textContent = cap || '';
    $('lightbox').classList.add('show');
  }

  function errText(err) {
    const d = err?.response?.data;
    if (d && Object.keys(d).length) {
      return Object.entries(d).map(([k, v]) => k + ': ' + (v.message || JSON.stringify(v))).join(', ');
    }
    return err?.response?.message || err?.message || 'unbekannter Fehler';
  }

  // ---------- Foto-Kachel im gleichen Stil wie die festen Fotos ----------
  function card(r) {
    const d = document.createElement('div');
    d.className = 'photo live';
    d.id = 'p-' + r.id;

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
          await pb.collection('photos').delete(r.id);
          document.getElementById('p-' + r.id)?.remove();
        } catch (err) {
          $('memStatus').textContent = 'Löschen fehlgeschlagen: ' + errText(err);
        }
      });
      d.append(del);
    }

    d.addEventListener('click', async () => {
      await refreshToken();
      openLightbox(pb.files.getURL(r, r.image, { token: fileToken }), capText);
    });
    return d;
  }

  async function loadPhotos() {
    await refreshToken();
    const list = await pb.collection('photos').getFullList({ sort: '-created', expand: 'author' });
    grid.querySelectorAll('.photo.live').forEach(e => e.remove());
    grid.prepend(...list.map(card));
  }

  async function subscribe() {
    if (subscribed) return;
    subscribed = true;
    await pb.collection('photos').subscribe('*', async e => {
      if (e.action === 'create' && !document.getElementById('p-' + e.record.id)) {
        await refreshToken();
        const r = await pb.collection('photos').getOne(e.record.id, { expand: 'author' });
        grid.prepend(card(r));
      }
      if (e.action === 'delete') document.getElementById('p-' + e.record.id)?.remove();
    });
  }

  async function start() {
    try { await pb.collection('users').authRefresh(); }
    catch { pb.authStore.clear(); setView(false); return; }
    setView(true);
    try {
      await loadPhotos();
      await subscribe();
    } catch (err) {
      console.error(err);
      $('memStatus').textContent = 'Fotos konnten nicht geladen werden: ' + errText(err);
    }
  }

  // ---------- Login ----------
  $('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    $('loginErr').textContent = '';
    try {
      await pb.collection('users').authWithPassword($('loginEmail').value.trim(), $('loginPass').value);
      $('loginPass').value = '';
      start();
    } catch {
      $('loginErr').textContent = 'E-Mail oder Passwort stimmt nicht';
    }
  });

  // ---------- Upload ----------
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

  $('fileInput').addEventListener('change', async e => {
    const files = [...e.target.files];
    if (!files.length) return;
    const caption = $('caption').value.trim();
    try {
      for (let i = 0; i < files.length; i++) {
        $('memStatus').textContent = `Lade ${i + 1}/${files.length} hoch …`;
        const fd = new FormData();
        fd.append('image', await shrink(files[i]), 'foto.jpg');
        fd.append('caption', caption);
        fd.append('author', me());
        const rec = await pb.collection('photos').create(fd);
        if (!document.getElementById('p-' + rec.id)) {
          await refreshToken();
          grid.prepend(card(await pb.collection('photos').getOne(rec.id, { expand: 'author' })));
        }
      }
      $('memStatus').textContent = 'Hochgeladen ✓';
      $('caption').value = '';
    } catch (err) {
      console.error(err);
      $('memStatus').textContent = 'Hochladen fehlgeschlagen: ' + errText(err);
    }
    e.target.value = '';
  });

  // iOS trennt die Live-Verbindung im Hintergrund -> beim Zurückkommen neu laden
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && pb.authStore.isValid) loadPhotos().catch(console.error);
  });

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
  pb.authStore.isValid ? start() : setView(false);
})();
