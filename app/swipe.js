// Foto-Swipen (16.11.2026): zufällige Fotos aus Erinnerungen, rechts = Like (zählt der Server), links = weiter.
// Zwei kleine Herzen in den Herzfarben zeigen, wie oft jede Person das Foto schon geliked hat.
(() => {
  const pb = window.WIR_PB;
  if (!pb) return;
  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const me = () => (pb.authStore.record || pb.authStore.model)?.id;
  const HEART = '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.3C1 8.4 3 5 6.3 5c2 0 3.6 1.1 4.4 2.6h2.6C14.1 6.1 15.7 5 17.7 5 21 5 23 8.4 21.6 11.7 19.5 16.4 12 21 12 21z"/></svg>';
  let photos = [], deck = [], likes = {}, token = '', mode = false, busy = false;

  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const hearts = () => window.WIR_HEARTS || { me: '#ff5fa2', partner: '#3b9eff' };
  const partnerId = () => window.WIR_LOOK?.partner?.()?.id || window.WIR_LOOK?.partner?.() || '';
  const cnt = (photo, user) => (likes[photo + '|' + user] || 0);
  const url = p => pb.files.getURL(p, p.image, { thumb: '900x0', token });

  async function load() {
    try { token = await pb.files.getToken(); } catch (_) {}
    photos = await pb.collection('photos').getFullList({ fields: 'id,collectionId,collectionName,image,caption', requestKey: null });
    const rows = await pb.collection('photo_likes').getFullList({ requestKey: null });
    likes = {}; rows.forEach(r => { likes[r.photo + '|' + r.user] = r.count || 0; });
    deck = [];
    render();
  }

  function next() {
    if (!deck.length) deck = shuffle(photos.slice());
    return deck.pop();
  }

  let cur = null, nxt = null;
  function render() {
    const box = $('swipeBox'); if (!box) return;
    box.textContent = '';
    if (!photos.length) { box.append(el('div', 'sw-empty glass', 'Noch keine Fotos in den Erinnerungen 💗')); return; }
    cur = cur && photos.includes(cur) ? cur : next();
    nxt = next();
    const stage = el('div', 'sw-stage');
    stage.append(card(nxt, true), card(cur, false));
    const hs = el('div', 'sw-hearts');
    const mk = (who, col) => { const h = el('div', 'sw-h'); h.dataset.who = who; h.style.setProperty('--c', col); h.innerHTML = HEART; h.append(el('b', '', '0')); return h; };
    hs.append(mk('me', hearts().me), mk('partner', hearts().partner));
    const btns = el('div', 'sw-btns');
    const no = el('button', 'no', '✕'), yes = el('button', 'yes', '♥');
    no.type = yes.type = 'button'; no.setAttribute('aria-label', 'Weiter'); yes.setAttribute('aria-label', 'Gefällt mir');
    no.addEventListener('click', () => fling(-1, false)); yes.addEventListener('click', () => fling(1, true));
    btns.append(no, yes);
    box.append(stage, hs, btns);
    updateHearts();
    attach(stage.lastChild);
  }

  function card(p, back) {
    const c = el('div', 'sw-card' + (back ? ' back' : ''));
    const img = el('img'); img.src = url(p); img.alt = ''; img.draggable = false;
    c.append(img);
    if (p.caption && !back) c.append(el('div', 'sw-cap', p.caption));
    if (!back) { c.append(el('div', 'sw-tag like', 'LIKE'), el('div', 'sw-tag nope', 'WEITER')); }
    return c;
  }

  function updateHearts() {
    if (!cur) return;
    const m = me(), pid = partnerId();
    const set = (who, n) => { const h = document.querySelector('.sw-h[data-who="' + who + '"]'); if (h) h.querySelector('b').textContent = n; };
    set('me', cnt(cur.id, m));
    set('partner', pid ? cnt(cur.id, pid) : 0);
  }

  function attach(c) {
    let sx = 0, sy = 0, dx = 0, drag = false;
    const like = c.querySelector('.sw-tag.like'), nope = c.querySelector('.sw-tag.nope');
    const apply = () => {
      c.style.transform = 'translateX(' + dx + 'px) rotate(' + dx / 18 + 'deg)';
      const k = Math.min(Math.abs(dx) / 90, 1);
      like.style.opacity = dx > 0 ? k : 0; nope.style.opacity = dx < 0 ? k : 0;
    };
    c.addEventListener('pointerdown', e => { if (busy) return; drag = true; sx = e.clientX; sy = e.clientY; dx = 0; c.style.transition = 'none'; c.setPointerCapture(e.pointerId); });
    c.addEventListener('pointermove', e => { if (!drag) return; dx = e.clientX - sx; apply(); });
    const end = () => {
      if (!drag) return; drag = false;
      if (Math.abs(dx) > 90) fling(dx > 0 ? 1 : -1, dx > 0);
      else { c.style.transition = 'transform .25s'; dx = 0; apply(); }
    };
    c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
  }

  async function fling(dir, isLike) {
    if (busy) return; busy = true;
    const c = document.querySelector('#swipeBox .sw-card:not(.back)');
    const done = cur;
    if (c) { c.style.transition = 'transform .3s, opacity .3s'; c.style.transform = 'translateX(' + dir * 600 + 'px) rotate(' + dir * 25 + 'deg)'; c.style.opacity = '0'; }
    if (isLike) {
      const k = done.id + '|' + me();
      likes[k] = cnt(done.id, me()) + 1; // sofort anzeigen, Server bestätigt gleich
      const h = document.querySelector('.sw-h[data-who="me"]'); if (h) { h.querySelector('b').textContent = likes[k]; h.classList.add('pop'); }
      window.WIR_FX?.hearts?.();
      pb.send('/api/wir/photo-like', { method: 'POST', body: { photo: done.id }, requestKey: null })
        .then(r => { likes[k] = r.count; }).catch(() => { likes[k]--; });
    }
    setTimeout(() => { cur = nxt; busy = false; render(); }, 280);
  }

  function setMode(on) {
    mode = on;
    const s = $('s-memories'); if (!s) return;
    s.classList.toggle('sw-mode', on);
    s.querySelectorAll('.sw-seg button').forEach(b => b.classList.toggle('on', (b.dataset.m === 'swipe') === on));
    if (on) load().catch(console.error);
  }

  function init() {
    const s = $('s-memories'); if (!s || s.querySelector('.sw-seg')) return;
    const seg = el('div', 'sw-seg');
    [['gal', 'Galerie'], ['swipe', '💗 Swipen']].forEach(([m, t]) => {
      const b = el('button', m === 'gal' ? 'on' : '', t); b.type = 'button'; b.dataset.m = m;
      b.addEventListener('click', () => setMode(m === 'swipe'));
      seg.append(b);
    });
    const box = el('div'); box.id = 'swipeBox';
    s.prepend(seg); s.append(box);
  }

  init();
  document.addEventListener('wir:show', e => { if (e.detail === 's-memories' && mode) load().catch(console.error); });
  document.addEventListener('wir:hearts', () => { if (mode) render(); });
})();
