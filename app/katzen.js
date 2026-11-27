// Stimmungskatze auf der Startseite (27.11.2026): im Stimmungs-Kasten links. Automatisch passend zu deiner Stimmung (0–100 %, care.js schickt 'wir:mood'),
// Antippen öffnet die Auswahl mit 12 Pixel-Katzen – oder wieder „Automatisch“. Die Wahl wird nur auf diesem Gerät gespeichert.
(() => {
  const P = window.WIR_PIXEL, pb = window.WIR_PB;
  if (!P || !pb) return;
  const $ = id => document.getElementById(id);
  const uid = () => (pb.authStore.record || pb.authStore.model)?.id || 'x';
  const KEY = () => 'wir-katze-' + uid();
  const get = () => { try { const v = localStorage.getItem(KEY()); return v == null || v === 'auto' ? 'auto' : +v; } catch (_) { return 'auto'; } };
  const set = v => { try { localStorage.setItem(KEY(), String(v)); } catch (_) {} };
  let mood = null;
  const idx = () => { const c = get(); return c === 'auto' ? P.catForMood(mood) : c; };
  function mount() {
    const card = document.querySelector('.st-mood'); if (!card) return;
    let b = $('stCat');
    if (!b) { b = document.createElement('button'); b.type = 'button'; b.id = 'stCat'; b.className = 'st-cat'; b.setAttribute('aria-label', 'Stimmungskatze wählen'); b.innerHTML = '<img alt="">'; card.prepend(b); b.addEventListener('click', openPicker); }
    const i = idx(); b.querySelector('img').src = P.cat(i); b.title = P.CAT_NAMES[i];
  }
  function openPicker() {
    document.querySelector('.cat-ov')?.remove();
    const cur = get(), ov = document.createElement('div'); ov.className = 'cat-ov';
    ov.innerHTML = `<div class="cat-sh"><h3>Deine Stimmungskatze</h3><div class="cat-grid">${P.CAT_NAMES.map((n, i) => `<button type="button" data-i="${i}" class="${cur === i ? 'on' : ''}"><img alt="" src="${P.cat(i)}">${n}</button>`).join('')}</div>
      <button type="button" class="cat-auto ${cur === 'auto' ? 'on' : ''}" data-i="auto">Automatisch nach Stimmung</button></div>`;
    ov.addEventListener('click', e => {
      if (e.target === ov) return ov.remove();
      const b = e.target.closest('[data-i]'); if (!b) return;
      set(b.dataset.i === 'auto' ? 'auto' : +b.dataset.i); mount(); ov.remove();
    });
    document.body.appendChild(ov);
  }
  document.addEventListener('wir:mood', e => { mood = e.detail?.me ?? null; mount(); });
  document.addEventListener('wir:show', e => { if (e.detail === 's-home') mount(); });
  mount();
})();
