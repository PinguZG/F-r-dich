const pb = new PocketBase(window.location.origin);
const $ = s => document.querySelector(s);
const me = () => (pb.authStore.record || pb.authStore.model)?.id;
let fileToken = null;

async function refreshToken() { fileToken = await pb.files.getToken(); }
function show(v) { $('#login').hidden = v !== 'login'; $('#app').hidden = v !== 'app'; }

// ---------- Login ----------
$('#login-form').addEventListener('submit', async e => {
  e.preventDefault();
  $('#login-error').textContent = '';
  try {
    await pb.collection('users').authWithPassword($('#email').value, $('#password').value);
    start();
  } catch { $('#login-error').textContent = 'Login fehlgeschlagen'; }
});

$('#logout').onclick = () => {
  pb.realtime.unsubscribe();
  pb.authStore.clear();
  show('login');
};

// ---------- Galerie ----------
function card(r) {
  const fig = document.createElement('figure');
  fig.id = 'p-' + r.id;

  const img = document.createElement('img');
  img.loading = 'lazy';
  img.src = pb.files.getURL(r, r.image, { thumb: '600x0', token: fileToken });
  img.onclick = () => openViewer(r);

  const cap = document.createElement('figcaption');
  const who = r.expand?.author?.name;
  cap.textContent = [r.caption, who && '– ' + who].filter(Boolean).join(' ');

  fig.append(img, cap);

  if (r.author === me()) {
    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '🗑';
    del.onclick = async ev => {
      ev.stopPropagation();
      if (confirm('Foto löschen?')) await pb.collection('photos').delete(r.id);
    };
    fig.append(del);
  }
  return fig;
}

async function loadPhotos() {
  await refreshToken();
  const list = await pb.collection('photos').getFullList({ sort: '-created', expand: 'author' });
  $('#gallery').replaceChildren(...list.map(card));
}

async function openViewer(r) {
  await refreshToken();
  $('#viewer img').src = pb.files.getURL(r, r.image, { token: fileToken });
  $('#viewer').hidden = false;
}
$('#viewer').onclick = () => { $('#viewer').hidden = true; $('#viewer img').src = ''; };

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
      c.toBlob(b => b ? res(b) : rej(new Error('toBlob')), 'image/jpeg', quality);
    };
    img.onerror = rej;
    img.src = url;
  });
}

$('#file-input').addEventListener('change', async e => {
  const files = [...e.target.files];
  if (!files.length) return;
  const caption = $('#caption').value.trim();
  try {
    for (let i = 0; i < files.length; i++) {
      $('#status').textContent = `Lade ${i + 1}/${files.length} hoch…`;
      const fd = new FormData();
      fd.append('image', await shrink(files[i]), 'foto.jpg');
      fd.append('caption', caption);
      fd.append('author', me());
      await pb.collection('photos').create(fd);
    }
    $('#status').textContent = 'Fertig ✓';
    $('#caption').value = '';
  } catch (err) {
    console.error(err);
    $('#status').textContent = 'Upload fehlgeschlagen';
  }
  e.target.value = '';
});

// ---------- Start / Live-Updates ----------
async function start() {
  show('app');
  try { await pb.collection('users').authRefresh(); }
  catch { pb.authStore.clear(); return show('login'); }

  await loadPhotos();
  pb.collection('photos').subscribe('*', async e => {
    if (e.action === 'create') {
      await refreshToken();
      const r = await pb.collection('photos').getOne(e.record.id, { expand: 'author' });
      $('#gallery').prepend(card(r));
    }
    if (e.action === 'delete') document.getElementById('p-' + e.record.id)?.remove();
  });
}

// iOS kappt die Live-Verbindung im Hintergrund -> beim Zurückkommen neu laden
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && pb.authStore.isValid) loadPhotos();
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
pb.authStore.isValid ? start() : show('login');