// Stimmungskatze auf der Startseite (27.11.2026): im Stimmungs-Kasten links sitzt die Katze der ANDEREN Person (ihre gewählte Katze, sonst automatisch
// passend zu ihrer Stimmung). Tippen auf den Kasten öffnet „Deine Stimmung“: eigenen Wert und eigene Katze ändern (12 Pixel-Katzen oder automatisch).
// Von der anderen Person lässt sich nichts ändern. Die gewählte Katze geht mit dem Stimmungs-Eintrag (moods.katze, -1 = automatisch) an die andere Person.
(() => {
  const P = window.WIR_PIXEL, pb = window.WIR_PB;
  if (!P || !pb) return;
  const $ = id => document.getElementById(id);
  const me = () => pb.authStore.record || pb.authStore.model;
  const KEY = () => 'wir-katze-' + (me()?.id || 'x');
  // eigene Wahl: -1 = automatisch, 0–11 = Katze
  const get = () => { try { const v = localStorage.getItem(KEY()); return v == null || v === 'auto' ? -1 : +v; } catch (_) { return -1; } };
  const set = v => { try { localStorage.setItem(KEY(), String(v)); } catch (_) {} };
  window.WIR_KATZE = { get };
  let st = { me: null, meKatze: -1, partner: null, partnerKatze: -1, partnerName: 'Schatz' };
  const idxOf = (v, k) => k != null && k >= 0 ? k : P.catForMood(v);

  function mount() {
    const card = document.querySelector('.st-mood'); if (!card) return;
    let c = $('stCat');
    if (!c) {
      c = document.createElement('span'); c.id = 'stCat'; c.className = 'st-cat'; c.innerHTML = '<img alt="">'; card.prepend(c);
      card.classList.add('st-click'); card.setAttribute('role', 'button'); card.tabIndex = 0;
      card.addEventListener('click', e => { if (e.target.closest('#askMood')) return; openSheet(); });
      card.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('#askMood')) { e.preventDefault(); openSheet(); } });
    }
    const i = idxOf(st.partner, st.partnerKatze), img = c.querySelector('img');
    img.src = P.cat(i); c.title = st.partnerName + ': ' + P.CAT_NAMES[i];
  }

  function openSheet() {
    document.querySelector('.cat-ov')?.remove();
    let val = st.me == null ? 50 : st.me, choice = get();
    const ov = document.createElement('div'); ov.className = 'cat-ov';
    const pi = idxOf(st.partner, st.partnerKatze);
    ov.innerHTML = `<div class="cat-sh"><h3>Deine Stimmung</h3>
      <div class="km-me"><img id="kmPrev" alt=""><div><b id="kmVal"></b><input type="range" id="kmRange" min="0" max="100" value="${val}"></div></div>
      <h3>Deine Katze</h3><div class="cat-grid">${P.CAT_NAMES.map((n, i) => `<button type="button" data-i="${i}"><img alt="" src="${P.cat(i)}">${n}</button>`).join('')}</div>
      <button type="button" class="cat-auto" data-i="-1">Automatisch nach Stimmung</button>
      <button type="button" class="cat-save" id="kmSave">Speichern</button>
      <div class="km-other"><img alt="" src="${P.cat(pi)}"><span><b>${(st.partnerName || 'Schatz').replace(/[<>&]/g, '')}</b>${st.partner == null ? '' : ': ' + st.partner + ' %'}<small>Nur ansehen – das kann nur sie/er selbst ändern.</small></span></div></div>`;
    const paint = () => {
      ov.querySelector('#kmVal').textContent = val + ' %';
      ov.querySelector('#kmPrev').src = P.cat(idxOf(val, choice));
      ov.querySelectorAll('.cat-grid button').forEach(b => b.classList.toggle('on', +b.dataset.i === choice));
      ov.querySelector('.cat-auto').classList.toggle('on', choice < 0);
    };
    ov.addEventListener('input', e => { if (e.target.id === 'kmRange') { val = +e.target.value; paint(); } });
    ov.addEventListener('click', async e => {
      if (e.target === ov) return ov.remove();
      const b = e.target.closest('[data-i]');
      if (b) { choice = +b.dataset.i; paint(); return; }
      if (e.target.id === 'kmSave') {
        e.target.disabled = true;
        try {
          set(choice);
          await pb.collection('moods').create({ user: me().id, value: Math.round(val), katze: choice });
          await window.WIR_MOODS?.reload();
          ov.remove();
        } catch (err) { e.target.disabled = false; e.target.textContent = 'Ging nicht – nochmal?'; }
      }
    });
    document.body.appendChild(ov); paint();
  }
  document.addEventListener('wir:mood', e => { st = Object.assign(st, e.detail || {}); mount(); });
  document.addEventListener('wir:show', e => { if (e.detail === 's-home') mount(); });
  mount();
})();
