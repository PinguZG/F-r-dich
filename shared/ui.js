// Gemeinsame UI-Helfer für Wir und die Spiele-App (/shared/ui.js): Seitenwechsel, Bottom-Sheets, Herz-Explosion,
// Zeit in Europe/Berlin, Bilder verkleinern. Vor allen anderen Skripten laden. Stellt window.UI bereit.
// Seitenwechsel melden sich als Event 'wir:show' (detail = Seiten-ID).
(function(){
  const $ = id => document.getElementById(id);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Hintergrund-Herzen */
  const bg = $('bgHearts');
  if (bg) for (let i = 0; i < 10; i++) {
    const s = document.createElement('span');
    s.textContent = ['💗','💕','🤍','💖'][i % 4];
    s.style.left = Math.random() * 100 + '%';
    s.style.fontSize = 12 + Math.random() * 14 + 'px';
    s.style.animationDuration = 12 + Math.random() * 12 + 's';
    s.style.animationDelay = -Math.random() * 22 + 's';
    bg.appendChild(s);
  }

  // alte Bereichsnamen (z. B. aus Push-Nachrichten) -> neue Seiten; die App ergänzt UI.alias
  const alias = {};
  const resolve = id => alias[id] || id;

  function show(id){
    id = resolve(id);
    const target = $(id);
    if (!target) return;
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s === target));
    document.querySelectorAll('.sheet-wrap.open').forEach(w => sheet(w.id, false));
    const inApp = target.classList.contains('page');
    document.body.classList.toggle('in-app', inApp);
    if (inApp) {
      const tab = target.dataset.tab ?? id;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('on', b.dataset.go === tab));
      // Unterseiten haben ihre eigene Überschrift mit Zurück-Knopf
      if ($('topTitle')) $('topTitle').textContent = target.classList.contains('sub') ? '' : target.dataset.title || '';
    }
    document.dispatchEvent(new CustomEvent('wir:show', { detail: id }));
  }

  function burst(x, y, n = 18){
    if (reduced()) n = Math.min(n, 4);
    for (let i = 0; i < n; i++) {
      const h = document.createElement('span');
      h.className = 'burst';
      h.textContent = ['❤️','💖','💕','✨'][i % 4];
      h.style.left = x + 'px'; h.style.top = y + 'px';
      const a = Math.random() * Math.PI * 2, d = 80 + Math.random() * 140;
      h.style.setProperty('--x', Math.cos(a) * d + 'px');
      h.style.setProperty('--y', Math.sin(a) * d + 'px');
      h.style.setProperty('--r', (Math.random() * 360 - 180) + 'deg');
      document.body.appendChild(h);
      setTimeout(() => h.remove(), 1500);
    }
  }

  function shake(el){
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 450);
  }

  // actions: [{ label, onClick }] – Knöpfe unter dem Bild (nur wenn die Seite eine #lightbox hat)
  function lightbox(src, cap, actions = []){
    $('lbImg').src = src; $('lbCap').textContent = cap || '';
    $('lbActions').replaceChildren(...actions.map(a => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pack-btn';
      b.textContent = a.label;
      b.addEventListener('click', e => { e.stopPropagation(); a.onClick(); });
      return b;
    }));
    $('lightbox').classList.add('show');
  }
  const closeLightbox = () => $('lightbox')?.classList.remove('show');
  $('lightbox')?.addEventListener('click', closeLightbox);

  // ---------- Bottom-Sheets ----------
  function sheet(id, open = true){
    const w = $(id);
    if (open) {
      w.hidden = false;
      requestAnimationFrame(() => requestAnimationFrame(() => w.classList.add('open')));
    } else {
      w.classList.remove('open');
      setTimeout(() => { if (!w.classList.contains('open')) w.hidden = true; }, 320);
    }
  }
  document.addEventListener('click', e => {
    const c = e.target.closest('[data-close]');
    if (c) sheet(c.closest('.sheet-wrap').id, false);
  });

  // ---------- Navigation über data-go ----------
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-go]');
    if (!b) return;
    const id = resolve(b.dataset.go);
    show(id); if ($(id)) $(id).scrollTop = 0;
  });

  // ---------- Zeit in Europe/Berlin ----------
  const DAY = 86400000;
  const bFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  // Berliner Uhrzeit als "UTC-Zahl" (zum Rechnen mit Kalendertagen)
  function berlinWall(ms){
    const p = Object.fromEntries(bFmt.formatToParts(new Date(ms)).map(x => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  }
  // Zeitpunkt von 00:00 Uhr (Berlin) des Tages von ms
  function berlinMidnight(ms = Date.now()){
    const w = berlinWall(ms), mid = w - (w % DAY);
    let real = mid - (berlinWall(mid) - mid);
    real = mid - (berlinWall(real) - real);
    return real;
  }

  // Bild verkleinern (längste Seite max px) -> JPEG-Blob
  function shrink(file, max = 2048, quality = 0.85){
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

  // Fehlermeldung aus einer PocketBase-Antwort
  function errText(err){
    const d = err?.response?.data;
    if (d && Object.keys(d).length) {
      return Object.entries(d).map(([k, v]) => k + ': ' + (v.message || JSON.stringify(v))).join(', ');
    }
    return err?.response?.message || err?.message || 'unbekannter Fehler';
  }

  window.UI = { show, resolve, alias, burst, wait, shake, lightbox, closeLightbox, sheet, berlinWall, berlinMidnight, shrink, reduced, errText, DAY };
})();
