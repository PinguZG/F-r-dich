// Lernseite NEW (27.11.2026): Idas Fächer als Pixel-Tiere. Lernen (Aufgaben erledigen, Karteikarten) gibt XP -> Entwicklungsstufen (Baby/Teen/Adult).
// Stimmung des Tiers = Anteil Gelerntes im Vergleich zum Soll, das mit dem Prüfungstermin steigt. Erledigtes liegt im Reiter „Erledigt“.
// Daten: lnew_faecher + lnew_items (pb_migrations/1795900000), gehören Idas Konto; Daniel darf für Ida Inhalte anlegen. Bilder: pixel.js.
(() => {
  const pb = window.WIR_PB, P = window.WIR_PIXEL;
  if (!pb || !P) return;
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const meRec = () => pb.authStore.record || pb.authStore.model;
  const isIda = u => !!u && (/\bida\b/i.test(u.name || '') || /^ida/i.test(u.email || ''));
  const learner = () => { const me = meRec(); if (!me) return null; if (isIda(me)) return me; return window.WIR_LOOK?.partner?.() || null; };   // Daniel: Idas Konto = sein Partner
  const learnerId = () => learner()?.id;
  const firstName = () => (learner()?.name || 'Ida').split(/\s+/)[0];
  const dstr = add => { const d = new Date(); d.setDate(d.getDate() + (add || 0)); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const dlabel = s => { const [, m, d] = (s || '').split('-'); return d ? `${+d}.${+m}.` : ''; };
  const daysTo = s => s ? Math.round((Date.parse(s + 'T00:00:00') - Date.parse(dstr(0) + 'T00:00:00')) / 864e5) : null;
  const errText = e => (e && (e.response?.message || e.message)) || 'Fehler';

  // ---------- feste Werte ----------
  const LEGACY = new Set(['GT', 'D', 'M', 'GP', 'PuG', 'SLZ', 'E', 'Gex', 'E-Con', 'Eth', 'Smw', 'Me', 'AdP', 'Nw']);
  const STAGES = [{ n: 'Baby', xp: 0 }, { n: 'Teen', xp: 300 }, { n: 'Adult', xp: 900 }];
  const XP_TODO = 40, XP_CARD = 5, XP_LEARNED = 15;
  const FONTS = { pixelify: ["Pixelify Sans", "'Pixelify Sans','Quicksand',sans-serif", 1], press: ['Press Start', "'Press Start 2P',monospace", .62], silk: ['Silkscreen', "'Silkscreen',monospace", .8], quick: ['Quicksand', "'Quicksand',sans-serif", 1], caveat: ['Handschrift', "'Caveat',cursive", 1.2] };
  const CARDCOL = { rosa: ['Rosa', '#ffd3e0'], mint: ['Mint', '#cdeed8'], himmel: ['Himmel', '#cfe6f7'], gelb: ['Gelb', '#fff0b8'], flieder: ['Flieder', '#e3d8f7'] };
  const SCENES = { wiese: 'Wiese', strand: 'Strand', schnee: 'Schnee', sakura: 'Sakura' };
  const PKEY = 'wir-lnn-prefs';
  let prefs = { font: 'pixelify', size: 100, card: 'rosa', scene: 'wiese' };
  try { Object.assign(prefs, JSON.parse(localStorage.getItem(PKEY) || '{}')); } catch (_) {}
  const savePrefs = () => { try { localStorage.setItem(PKEY, JSON.stringify(prefs)); } catch (_) {} applyPrefs(); };
  function applyPrefs() {
    const s = $('s-lernennew'); if (!s) return;
    const f = FONTS[prefs.font] || FONTS.pixelify;
    s.style.setProperty('--lnn-font', f[1]);
    s.style.setProperty('--lnn-fs', String((prefs.size / 100) * f[2]));
    s.style.setProperty('--lnn-card', (CARDCOL[prefs.card] || CARDCOL.rosa)[1]);
    s.dataset.scene = SCENES[prefs.scene] ? prefs.scene : 'wiese';
  }

  // ---------- Zustand ----------
  let FA = [], IT = [], loaded = false, loadErr = '', tries = 0;
  let V = { tab: 'tiere', fach: null, sub: null, ses: null };
  let SEL = [1, 2, 3];   // gewählte Karten-Stufen (bleibt beim Seitenwechsel erhalten)
  const stageOf = xp => STAGES.reduce((a, s, i) => xp >= s.xp ? i : a, 0);
  const fach = k => FA.find(f => f.key === k);
  const itemsOf = k => IT.filter(i => i.fach === k);

  const needFor = f => { const d = daysTo(f.exam); if (d == null) return 50; if (d < 0) return 95; return Math.round(30 + 60 * (1 - Math.min(d, 28) / 28)); };
  function stats(f) {
    const its = itemsOf(f.key), todos = its.filter(i => i.typ === 'todo'), cards = its.filter(i => i.typ === 'karte');
    const learned = todos.filter(i => i.done).length + cards.filter(i => i.box >= 3).length, total = its.length;
    const need = needFor(f), pct = total ? Math.round(learned / total * 100) : null;
    let mood = 'ok', text = 'Gib mir Lernstoff, dann wachse ich!';
    if (total) {
      if (learned === total) { mood = 'happy'; text = 'Alles geschafft – ich bin happy bis zur nächsten Prüfung!'; }
      else { const r = pct / need; if (r >= 1) { mood = 'happy'; text = 'Alles im Plan – ich bin glücklich!'; } else if (r >= .75) { mood = 'ok'; text = 'Läuft ganz gut, weiter so!'; } else if (r >= .45) { mood = 'meh'; text = 'Hmm … ich brauche mehr Futter (Lernstoff)!'; } else { mood = 'sad'; text = 'Ich bin traurig – lass uns lernen!'; } }
    }
    return { todos, cards, learned, total, need, pct, mood, text, open: todos.filter(i => !i.done), done: todos.filter(i => i.done), due: cards.filter(c => (c.box || 1) < 3), all: learned === total && total > 0 };
  }
  const sprite = (f, mood, cls) => `<img class="${cls || 'lnn-spr'}" alt="" src="${P.animal(f.tier || 'fuchs', { mood: mood || stats(f).mood, stage: stageOf(f.xp || 0) })}">`;

  // ---------- Laden / Speichern ----------
  async function load() {
    const uid = learnerId(); if (!uid) { loadErr = 'Idas Konto wird noch gesucht …'; if (++tries < 6) setTimeout(() => { if (!loaded && $('s-lernennew')?.offsetParent) open(); }, 1200); return; }
    try {
      const flt = pb.filter('user = {:u}', { u: uid });
      [FA, IT] = await Promise.all([pb.collection('lnew_faecher').getFullList({ filter: flt, sort: 'created' }), pb.collection('lnew_items').getFullList({ filter: flt, sort: 'created' })]);
      // frühere Standard-Fächer (Stand 27.11.), die nie benutzt wurden, räumen wir auf – Fächer legt man jetzt selbst an
      const stale = FA.filter(f => LEGACY.has(f.key) && f.name === f.key && !f.xp && !f.exam && !IT.some(i => i.fach === f.key));
      for (const f of stale) { try { await pb.collection('lnew_faecher').delete(f.id); } catch (_) {} }
      FA = FA.filter(f => !stale.includes(f));
      loadErr = ''; loaded = true;
    } catch (e) { loadErr = errText(e); }
  }
  const toastEl = () => { let t = $('lnnToast'); if (!t) { t = document.createElement('div'); t.id = 'lnnToast'; document.body.appendChild(t); } return t; };
  let tt; function toast(msg) { const t = toastEl(); t.textContent = msg; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 2600); }
  async function addXp(f, n) {
    const before = stageOf(f.xp || 0); f.xp = Math.max(0, (f.xp || 0) + n);
    try { await pb.collection('lnew_faecher').update(f.id, { xp: f.xp }); } catch (e) { toast('XP nicht gespeichert: ' + errText(e)); }
    const after = stageOf(f.xp);
    if (after > before) setTimeout(() => evoSheet(f, true), 350);
  }
  async function patchItem(it, data) {
    Object.assign(it, data);
    try { await pb.collection('lnew_items').update(it.id, data); } catch (e) { toast('Ging nicht: ' + errText(e)); }
  }
  async function addItem(fk, typ, title, back, date) {
    title = String(title || '').trim(); if (!title) return null;
    const me = meRec();
    const rec = await pb.collection('lnew_items').create({ user: learnerId(), fach: fk, typ, title: title.slice(0, 300), back: String(back || '').slice(0, 1000), date: date || '', box: 1, done: false, by: (me?.name || '').slice(0, 30) });
    IT.push(rec); return rec;
  }

  // ---------- Bausteine ----------
  const bar = (pct, mark) => `<div class="lnn-bar"><i style="width:${Math.max(0, Math.min(100, pct || 0))}%"></i>${mark != null ? `<b style="left:${Math.min(98, mark)}%"></b>` : ''}</div>`;
  const examChip = f => { const d = daysTo(f.exam); return d == null ? 'Kein Termin' : d < 0 ? 'Prüfung vorbei' : d === 0 ? 'Prüfung heute!' : `Prüfung in ${d} Tag${d === 1 ? '' : 'en'}`; };
  const clouds = () => '<i class="lnn-cl c1"></i><i class="lnn-cl c2"></i><i class="lnn-cl c3"></i>';
  const tabsHtml = () => `<div class="lnn-tabs">${[['tiere', 'Tiere'], ['erledigt', 'Erledigt'], ['einst', 'Einstellungen']].map(([k, n]) => `<button type="button" data-act="tab" data-v="${k}" class="${V.tab === k && !V.fach ? 'on' : ''}">${n}</button>`).join('')}</div>`;

  // ---------- Ansichten ----------
  function vHome() {
    const list = FA.filter(f => !f.hidden).sort((a, b) => { const da = daysTo(a.exam), db = daysTo(b.exam); return (da == null ? 9999 : da) - (db == null ? 9999 : db) || a.created.localeCompare(b.created); });
    const happy = list.filter(f => stats(f).mood === 'happy').length;
    return `<div class="lnn-scene lnn-top">${clouds()}<h2 class="lnn-hello">Hi, ${esc(firstName())}!</h2><p class="lnn-sub">${list.length ? happy + ' von ' + list.length + ' Tieren sind glücklich' : 'Erstelle dein erstes Fach und such dir ein Tier aus'}</p></div>
      ${list.length ? '' : '<div class="lnn-box px"><p class="lnn-empty">Noch kein Fach da. Jedes Fach bekommt ein eigenes Pixel-Tier, das mit dir lernt.</p></div>'}
      <div class="lnn-grid">${list.map(f => { const s = stats(f); const st = stageOf(f.xp || 0);
        return `<button type="button" class="lnn-pet px m-${s.mood}" data-act="open" data-k="${esc(f.key)}">${sprite(f, s.mood)}<b>${esc(f.name || f.key)}</b><span>${STAGES[st].n} · ${f.xp || 0} XP</span>${bar(s.pct == null ? 0 : s.pct, s.total ? s.need : null)}<small>${s.total ? s.learned + '/' + s.total + ' gelernt' : 'noch kein Stoff'} · ${examChip(f)}</small></button>`; }).join('')}</div>
      <button type="button" class="lnn-btn px" data-act="newfach">+ Fach erstellen</button>`;
  }

  function vFach(f) {
    const s = stats(f), st = stageOf(f.xp || 0), nxt = STAGES[st + 1], from = STAGES[st].xp;
    const xpPct = nxt ? Math.round(((f.xp || 0) - from) / (nxt.xp - from) * 100) : 100;
    const d = daysTo(f.exam);
    return `<div class="lnn-scene lnn-big">${clouds()}
      <button type="button" class="lnn-back px" data-act="home" aria-label="Zurück">‹</button>
      <h2 class="lnn-hello">${esc(f.name || f.key)}</h2>
      <div class="lnn-stage"><div class="lnn-bubble px">${esc(s.text)}</div>${sprite(f, s.mood, 'lnn-spr big m-' + s.mood)}</div>
      <button type="button" class="lnn-xp" data-act="evo"><span>XP ${f.xp || 0}</span>${bar(xpPct)}<em>${STAGES[st].n}${nxt ? ' → ' + nxt.n : ' ★'}</em></button>
      <div class="lnn-btns"><button type="button" class="lnn-b pink px" data-act="cards"><b>Karteikarten</b><small>${s.due.length} offen</small></button>
      <button type="button" class="lnn-b green px" data-act="todo"><b>To-Do-Liste</b><small>${s.open.length} offen</small></button></div></div>
      <div class="lnn-box px"><div class="lnn-row"><div><b>${d == null ? 'Kein Prüfungstermin' : 'Prüfung ' + esc(f.examName || '') + ' ' + dlabel(f.exam)}</b><div class="lnn-sub">${examChip(f)}${s.total ? ` · Soll heute: ${s.need} %` : ''}</div></div><button type="button" class="lnn-sm px" data-act="exam">Termin</button></div>
        ${s.total ? `<div class="lnn-sub" style="margin-top:8px">Gelernt: ${s.learned} von ${s.total} (${s.pct} %)</div>${bar(s.pct, s.need)}` : ''}</div>
      <div class="lnn-row two"><button type="button" class="lnn-btn px" data-act="add">+ Stoff hinzufügen</button></div>
      ${isEthik(f) ? '<div class="lnn-row two"><button type="button" class="lnn-btn soft px" data-act="ueber">Übersicht (Themen mit Quelle)</button></div><div class="lnn-row two"><button type="button" class="lnn-btn soft px" data-act="ethimp">KAE1-Karten einfügen / ergänzen</button></div>' : ''}
      ${itemsOf(f.key).length ? `<details class="lnn-box px"><summary>Alle Inhalte (${itemsOf(f.key).length})</summary>${itemsOf(f.key).map(i => `<div class="lnn-li"><span>${i.typ === 'karte' ? '🃏' : '✅'} ${esc(i.title)}${i.typ === 'karte' && i.back ? ' → ' + esc(i.back) : ''}</span><button type="button" class="lnn-x" data-act="del" data-id="${i.id}" aria-label="Löschen">×</button></div>`).join('')}</details>` : ''}`;
  }

  // ---------- Ethik (Klausur KAE1): Inhalte aus app/lernen/ethik-data.js ----------
  const isEthik = f => /ethik/i.test(f.name || '');
  const loadEthik = () => window.WIR_ETHIK ? Promise.resolve() : new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = '/lernen/ethik-data.js'; sc.onload = res; sc.onerror = () => rej(new Error('Ethik-Inhalte nicht ladbar')); document.head.append(sc); });
  const IMPKEY = f => 'wir-lnn-eth-imp-' + f.id;
  async function importEthik(f, manual) {
    await loadEthik();
    const have = new Set(itemsOf(f.key).filter(i => i.typ === 'karte').map(i => i.title)), todo = [];
    window.WIR_ETHIK.themen.forEach(t => t.karten.forEach(k => { if (!have.has(k[0])) todo.push(k); }));
    if (!todo.length) { if (manual) toast('Alle Karten sind schon da'); return; }
    let n = 0;
    for (let i = 0; i < todo.length; i += 5) {
      const mk = k => pb.collection('lnew_items').create({ user: learnerId(), fach: f.key, typ: 'karte', title: k[0].slice(0, 300), back: (k[1] + (k[2] ? '\n\nQuelle: ' + k[2] : '')).slice(0, 1000), box: 1, done: false, by: 'ethik-kae1' }, { requestKey: null });
      for (const k of todo.slice(i, i + 5)) {
        let rec = null;
        for (let t = 0; t < 3 && !rec; t++) { try { rec = await mk(k); } catch (e) { if (t === 2) { toast(n + ' von ' + todo.length + ' Karten eingefügt – Knopf „KAE1-Karten einfügen / ergänzen“ holt den Rest'); throw e; } await new Promise(r => setTimeout(r, 700 * (t + 1))); } }
        IT.push(rec); n++;
      }
    }
    try { localStorage.setItem(IMPKEY(f), String(window.WIR_ETHIK.themen.reduce((a, t) => a + t.karten.length, 0))); } catch (_) {}
    toast(todo.length + ' Karten für KAE1 eingefügt');
  }
  // Karten, die früher aus den Ethik-Daten kamen und dort nicht mehr stehen, werden entfernt (eigene Karten bleiben)
  async function pruneEthik(f) {
    await loadEthik();
    const keep = new Set(); window.WIR_ETHIK.themen.forEach(t => t.karten.forEach(k => keep.add(k[0].slice(0, 300))));
    const stale = itemsOf(f.key).filter(i => i.by === 'ethik-kae1' && !keep.has(i.title));
    for (let i = 0; i < stale.length; i += 5) await Promise.all(stale.slice(i, i + 5).map(it => pb.collection('lnew_items').delete(it.id, { requestKey: null }).catch(() => {})));
    if (stale.length) { IT = IT.filter(i => !stale.includes(i)); try { localStorage.setItem(IMPKEY(f), String(keep.size)); } catch (_) {} }
  }
  function vUeber(f) {
    const D = window.WIR_ETHIK;
    return `<div class="lnn-scene lnn-top">${clouds()}<button type="button" class="lnn-back px" data-act="fach" aria-label="Zurück">‹</button><h2 class="lnn-hello">Übersicht</h2><p class="lnn-sub">${esc(D ? D.anlass : '')}</p></div>
      ${D ? D.themen.map(t => `<details class="lnn-box px"><summary>${esc(t.name)}</summary>${t.sektionen.map(s => `<h3>${esc(s.h)}</h3><ul class="lnn-ul">${s.punkte.map(p => `<li>${esc(p)}</li>`).join('')}</ul><div class="lnn-sub">Quelle: ${esc(s.q || '')}</div>`).join('')}</details>`).join('') : '<div class="lnn-box px"><p class="lnn-empty">Lade …</p></div>'}`;
  }

  function vTodo(f) {
    const s = stats(f), list = s.open.slice().sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
    return `<div class="lnn-scene lnn-top">${clouds()}<button type="button" class="lnn-back px" data-act="fach" aria-label="Zurück">‹</button><h2 class="lnn-hello">To-Do · ${esc(f.name || f.key)}</h2><p class="lnn-sub">Jede erledigte Aufgabe gibt +${XP_TODO} XP</p></div>
      <div class="lnn-box px">${list.length ? list.map(i => { const late = i.date && i.date < dstr(0);
        return `<label class="lnn-todo"><input type="checkbox" data-act="tick" data-id="${i.id}"><i class="lnn-chk"></i><span>${esc(i.title)}${i.date ? `<small class="${late ? 'late' : ''}">${dlabel(i.date)}</small>` : ''}</span></label>`; }).join('') : '<p class="lnn-empty">Nichts offen – dein Tier ist happy!</p>'}</div>
      <button type="button" class="lnn-btn px" data-act="add">+ Aufgabe hinzufügen</button>`;
  }

  const LVN = { 1: 'Schlecht', 2: 'Okay', 3: 'Sehr gut' };   // Stufe steht in item.box (1 = Schlecht/neu, 2 = Okay, 3 = Sehr gut = gelernt)
  const lvlOf = c => Math.min(3, Math.max(1, c.box || 1));
  const selTabs = s => `<div class="lnn-lv">${[1, 2, 3].map(l => `<button type="button" class="lv${l} px ${SEL.includes(l) ? 'on' : ''}" data-act="sel" data-l="${l}" aria-pressed="${SEL.includes(l)}">${LVN[l]}<i>${s.cards.filter(c => lvlOf(c) === l).length}</i></button>`).join('')}</div>`;
  function vCards(f) {
    const s = stats(f), ses = V.ses, pool = s.cards.filter(c => SEL.includes(lvlOf(c)));
    const head = `<div class="lnn-scene lnn-top">${clouds()}<button type="button" class="lnn-back px" data-act="fach" aria-label="Zurück">‹</button><h2 class="lnn-hello">Karten · ${esc(f.name || f.key)}</h2><p class="lnn-sub">${s.cards.length} Karten · ${s.cards.filter(c => lvlOf(c) === 3).length} sehr gut</p></div>`;
    if (!s.cards.length) return head + `<div class="lnn-box px"><p class="lnn-empty">Noch keine Karteikarten. Leg welche an!</p></div><button type="button" class="lnn-btn px" data-act="add">+ Karte hinzufügen</button>`;
    if (!ses) return head + selTabs(s) + `<div class="lnn-box px center"><p>${pool.length ? `<b>${pool.length}</b> Karte${pool.length === 1 ? '' : 'n'} in der Auswahl` : 'In dieser Auswahl sind keine Karten. Wähle oben andere Stufen.'}</p><button type="button" class="lnn-btn px" data-act="start" ${pool.length ? '' : 'disabled'}>Los geht’s</button></div><button type="button" class="lnn-btn soft px" data-act="add">+ Karte hinzufügen</button>`;
    if (ses.i >= ses.q.length) return head + selTabs(s) + `<div class="lnn-box px center">${sprite(f, 'happy', 'lnn-spr big')}<h3>Runde geschafft!</h3><p>${ses.cnt[3]} sehr gut · ${ses.cnt[2]} okay · ${ses.cnt[1]} schlecht · +${ses.xp} XP</p><button type="button" class="lnn-btn px" data-act="start" ${pool.length ? '' : 'disabled'}>Nochmal</button><button type="button" class="lnn-btn soft px" data-act="fach">Zurück zu ${esc(f.name || f.key)}</button></div>`;
    const c = IT.find(i => i.id === ses.q[ses.i]);
    return head + selTabs(s) + `<div class="lnn-prog">${ses.i + 1} / ${ses.q.length}</div>
      <button type="button" class="lnn-card px ${ses.flip ? 'flip' : ''}" data-act="flip"><small>${ses.flip ? 'Antwort' : 'Frage'}</small><div>${esc(ses.flip ? (c.back || '–') : c.title)}</div><em>${ses.flip ? '' : 'Antippen zum Umdrehen'}</em></button>
      ${ses.flip ? `<div class="lnn-rate">${[1, 2, 3].map(l => `<button type="button" class="lv${l} px" data-act="rate" data-l="${l}"><b>${LVN[l]}</b></button>`).join('')}</div>` : ''}`;
  }

  function vDone() {
    const rows = FA.filter(f => !f.hidden).map(f => ({ f, s: stats(f) })).filter(x => x.s.done.length || x.s.cards.some(c => c.box >= 3));
    return `<div class="lnn-scene lnn-top">${clouds()}<h2 class="lnn-hello">Erledigt</h2><p class="lnn-sub">Alles, was du schon geschafft hast</p></div>
      ${rows.length ? rows.map(({ f, s }) => `<div class="lnn-box px"><div class="lnn-row">${sprite(f, s.mood, 'lnn-spr sm')}<div class="lnn-sp"><b>${esc(f.name || f.key)}</b><div class="lnn-sub">${s.all ? 'Alles geschafft – ' : ''}${s.done.length} Aufgabe${s.done.length === 1 ? '' : 'n'} · ${s.cards.filter(c => c.box >= 3).length} Karten gelernt</div></div></div>
        ${s.done.map(i => `<div class="lnn-li"><span>✔ ${esc(i.title)}</span><button type="button" class="lnn-sm px" data-act="undo" data-id="${i.id}">Zurück</button></div>`).join('')}</div>`).join('') : '<div class="lnn-box px"><p class="lnn-empty">Noch nichts erledigt – leg los!</p></div>'}`;
  }

  function vSet() {
    return `<div class="lnn-scene lnn-top">${clouds()}<h2 class="lnn-hello">Einstellungen</h2></div>
      <div class="lnn-box px"><h3>Schrift</h3><div class="lnn-chips">${Object.entries(FONTS).map(([k, v]) => `<button type="button" class="lnn-chip px ${prefs.font === k ? 'on' : ''}" data-act="font" data-v="${k}" style="font-family:${v[1]}">${v[0]}</button>`).join('')}</div>
        <h3>Schriftgröße <span id="lnnSizeV">${prefs.size} %</span></h3><input type="range" class="lnn-range" id="lnnSize" min="80" max="135" step="5" value="${prefs.size}">
        <h3>Karteikarten-Farbe</h3><div class="lnn-chips">${Object.entries(CARDCOL).map(([k, v]) => `<button type="button" class="lnn-chip px ${prefs.card === k ? 'on' : ''}" data-act="cardcol" data-v="${k}" style="background:${v[1]}">${v[0]}</button>`).join('')}</div>
        <h3>Szene</h3><div class="lnn-chips">${Object.entries(SCENES).map(([k, n]) => `<button type="button" class="lnn-chip px ${prefs.scene === k ? 'on' : ''}" data-act="scene" data-v="${k}">${n}</button>`).join('')}</div></div>
      <div class="lnn-box px"><h3>Fächer</h3>${FA.map(f => `<div class="lnn-frow"><button type="button" class="lnn-pick px" data-act="pick" data-k="${esc(f.key)}" aria-label="Tier wählen">${sprite(f, 'ok', 'lnn-spr xs')}</button><input class="lnn-in" data-act="rename" data-k="${esc(f.key)}" value="${esc(f.name || f.key)}" maxlength="40" aria-label="Fachname"><label class="lnn-hide"><input type="checkbox" data-act="hide" data-k="${esc(f.key)}" ${f.hidden ? 'checked' : ''}><span>aus</span></label></div>`).join('')}
        <button type="button" class="lnn-btn px" data-act="newfach">+ Fach erstellen</button></div>`;
  }

  // ---------- Pop-ups ----------
  function sheet(html) { closeSheet(); const d = document.createElement('div'); d.id = 'lnnSheet'; d.className = 'lnn-ov'; d.innerHTML = `<div class="lnn-sh px" role="dialog">${html}</div>`; d.addEventListener('click', e => { if (e.target === d) closeSheet(); }); $('s-lernennew').appendChild(d); }
  const closeSheet = () => { $('lnnSheet')?.remove(); };
  function evoSheet(f, up) {
    sheet(`<h3>Entwicklung</h3>${up ? `<p><b>${esc(f.name || f.key)}</b> ist jetzt <b>${STAGES[stageOf(f.xp || 0)].n}</b>!</p>` : ''}<div class="lnn-evo">${STAGES.map((s, i) => `<div class="${i === stageOf(f.xp || 0) ? 'on' : ''}"><img src="${P.animal(f.tier || 'fuchs', { mood: 'happy', stage: i })}" alt=""><b>${s.n}</b><small>${s.xp} XP</small></div>`).join('<span>→</span>')}</div>
      <p class="lnn-sub">XP bekommst du für erledigte Aufgaben (+${XP_TODO}) und Karteikarten (+${XP_CARD}, neue gelernte Karte +${XP_LEARNED}).</p><button type="button" class="lnn-btn px" data-act="close">Verstanden</button>`);
  }
  function addSheet(f, mode) {
    mode = mode || (V.sub === 'cards' ? 'karte' : 'todo');
    sheet(`<h3>Stoff für ${esc(f.name || f.key)}</h3><div class="lnn-chips"><button type="button" class="lnn-chip px ${mode === 'todo' ? 'on' : ''}" data-act="addmode" data-v="todo">Aufgabe</button><button type="button" class="lnn-chip px ${mode === 'karte' ? 'on' : ''}" data-act="addmode" data-v="karte">Karte</button><button type="button" class="lnn-chip px ${mode === 'multi' ? 'on' : ''}" data-act="addmode" data-v="multi">Viele Karten</button></div>
      ${mode === 'todo' ? `<input class="lnn-in" id="lnnT" placeholder="Was ist zu tun?" maxlength="300"><label class="lnn-sub">Bis wann (optional)</label><input class="lnn-in" id="lnnD" type="date">`
        : mode === 'karte' ? `<input class="lnn-in" id="lnnT" placeholder="Vorderseite (Frage)" maxlength="300"><textarea class="lnn-in" id="lnnB" rows="3" placeholder="Rückseite (Antwort)" maxlength="1000"></textarea>`
          : `<textarea class="lnn-in" id="lnnM" rows="8" placeholder="Pro Zeile eine Karte:&#10;Frage ; Antwort"></textarea>`}
      <div class="lnn-btns"><button type="button" class="lnn-btn soft px" data-act="close">Abbrechen</button><button type="button" class="lnn-btn px" data-act="addsave" data-mode="${mode}">Speichern</button></div>`);
    $('lnnT')?.focus();
  }
  function examSheet(f) {
    sheet(`<h3>Prüfungstermin ${esc(f.name || f.key)}</h3><input class="lnn-in" id="lnnEn" placeholder="Name (z. B. Klausur Kap. 3)" maxlength="80" value="${esc(f.examName || '')}"><input class="lnn-in" id="lnnEd" type="date" value="${esc(f.exam || '')}">
      <p class="lnn-sub">Je näher der Termin, desto mehr Prozent braucht dein Tier, um glücklich zu sein.</p><div class="lnn-btns"><button type="button" class="lnn-btn soft px" data-act="examclear">Termin löschen</button><button type="button" class="lnn-btn px" data-act="examsave">Speichern</button></div>`);
  }
  let np = { tier: 'fuchs' };
  function newSheet() {
    const used = new Set(FA.map(f => f.tier)); np = { tier: P.KEYS.find(k => !used.has(k)) || P.KEYS[0] };
    sheet(`<h3>Neues Fach</h3><input class="lnn-in" id="lnnNew" placeholder="Name (z. B. Mathe)" maxlength="40"><p class="lnn-sub">Such dir ein Tier aus:</p>
      <div class="lnn-pgrid">${P.KEYS.map(k => `<button type="button" class="lnn-pick px ${k === np.tier ? 'on' : ''}" data-act="npick" data-v="${k}"><img class="lnn-spr xs" alt="${esc(P.names[k])}" src="${P.animal(k, { mood: 'happy', stage: 0 })}"><small>${esc(P.names[k])}</small></button>`).join('')}</div>
      <div class="lnn-btns"><button type="button" class="lnn-btn soft px" data-act="close">Abbrechen</button><button type="button" class="lnn-btn px" data-act="nsave">Erstellen</button></div>`);
    $('lnnNew')?.focus();
  }
  function pickSheet(f) {
    sheet(`<h3>Tier für ${esc(f.name || f.key)}</h3><div class="lnn-pgrid">${P.KEYS.map(k => `<button type="button" class="lnn-pick px ${k === f.tier ? 'on' : ''}" data-act="settier" data-k="${esc(f.key)}" data-v="${k}"><img class="lnn-spr xs" alt="${esc(P.names[k])}" src="${P.animal(k, { mood: 'happy', stage: stageOf(f.xp || 0) })}"><small>${esc(P.names[k])}</small></button>`).join('')}</div>`);
  }

  // ---------- Rendern ----------
  function render() {
    const root = $('lnnBody'); if (!root) return;
    if (!loaded) { root.innerHTML = `<div class="lnn-box px"><p class="lnn-empty">${loadErr ? 'Konnte nicht laden: ' + esc(loadErr) : 'Lade …'}</p></div>`; return; }
    const f = V.fach ? fach(V.fach) : null;
    let h;
    if (f) h = V.sub === 'todo' ? vTodo(f) : V.sub === 'cards' ? vCards(f) : V.sub === 'ueber' ? vUeber(f) : vFach(f);
    else h = (V.tab === 'erledigt' ? vDone() : V.tab === 'einst' ? vSet() : vHome());
    $('s-lernennew').classList.toggle('lnn-in-fach', !!f);   // im Fach: Kopfzeile „← Lernen NEW“ weg, alles rückt nach oben
    root.innerHTML = (f ? '' : tabsHtml()) + h;
  }
  const rerender = () => { const y = window.scrollY; render(); window.scrollTo?.(0, y); };

  async function open() { applyPrefs(); render(); await load(); render(); }
  document.addEventListener('wir:users', () => { if (!loaded && $('s-lernennew')?.offsetParent) open(); });

  // ---------- Aktionen ----------
  const act = {
    tab: el => { V = { tab: el.dataset.v, fach: null, sub: null, ses: null }; render(); },
    open: async el => {
      V.fach = el.dataset.k; V.sub = null; render(); window.scrollTo?.(0, 0);
      const f = fach(V.fach);
      if (f && isEthik(f)) {
        let seen = 0; try { seen = +(localStorage.getItem(IMPKEY(f)) || 0); } catch (_) {}
        try {
          await pruneEthik(f); if (V.fach === f.key) render();
          const total = window.WIR_ETHIK.themen.reduce((a, t) => a + t.karten.length, 0);
          if (total > seen && (seen > 0 || !itemsOf(f.key).length || itemsOf(f.key).some(i => i.by === 'ethik-kae1'))) { toast('Lade Ethik-Karten für KAE1 …'); await importEthik(f); if (V.fach === f.key) render(); }
        } catch (e) { toast('Ging nicht: ' + errText(e)); }
      }
    },
    home: () => { V.fach = null; V.sub = null; render(); },
    fach: () => { V.sub = null; V.ses = null; render(); },
    todo: () => { V.sub = 'todo'; render(); },
    ueber: async () => { V.sub = 'ueber'; render(); await loadEthik(); render(); },
    ethimp: async () => { await importEthik(fach(V.fach), true); render(); },
    cards: () => { V.sub = 'cards'; V.ses = null; render(); },
    evo: () => evoSheet(fach(V.fach)),
    add: () => addSheet(fach(V.fach)),
    addmode: el => addSheet(fach(V.fach), el.dataset.v),
    close: () => closeSheet(),
    exam: () => examSheet(fach(V.fach)),
    pick: el => pickSheet(fach(el.dataset.k)),
    font: el => { prefs.font = el.dataset.v; savePrefs(); render(); },
    cardcol: el => { prefs.card = el.dataset.v; savePrefs(); render(); },
    scene: el => { prefs.scene = el.dataset.v; savePrefs(); render(); },
    flip: () => { V.ses.flip = true; render(); },
    start: () => {
      const f = fach(V.fach), pool = stats(f).cards.filter(c => SEL.includes(lvlOf(c))).map(c => c.id);
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      V.ses = { q: pool, i: 0, flip: false, cnt: { 1: 0, 2: 0, 3: 0 }, xp: 0 }; render();
    },
    sel: el => {
      const l = +el.dataset.l, i = SEL.indexOf(l);
      if (i >= 0) { if (SEL.length === 1) return; SEL.splice(i, 1); } else SEL.push(l);
      if (V.ses) act.start(); else render();
    },
    rate: async el => { await answer(+el.dataset.l); },
    undo: async el => { const it = IT.find(i => i.id === el.dataset.id); if (!it) return; await patchItem(it, { done: false, doneAt: '' }); await addXp(fach(it.fach), -XP_TODO); rerender(); },
    del: async el => { const it = IT.find(i => i.id === el.dataset.id); if (!it || !confirm('Wirklich löschen?')) return; try { await pb.collection('lnew_items').delete(it.id); IT = IT.filter(i => i !== it); } catch (e) { toast(errText(e)); } rerender(); },
    examclear: async () => { const f = fach(V.fach); await saveFach(f, { exam: '', examName: '' }); closeSheet(); render(); },
    examsave: async () => { const f = fach(V.fach); await saveFach(f, { exam: $('lnnEd').value || '', examName: $('lnnEn').value.trim().slice(0, 80) }); closeSheet(); render(); },
    settier: async el => { await saveFach(fach(el.dataset.k), { tier: el.dataset.v }); closeSheet(); render(); },
    newfach: () => newSheet(),
    npick: el => { np.tier = el.dataset.v; document.querySelectorAll('#lnnSheet .lnn-pick').forEach(b => b.classList.toggle('on', b === el)); },
    nsave: async () => {
      const name = ($('lnnNew').value || '').trim().slice(0, 40); if (!name) { toast('Gib dem Fach einen Namen'); return; }
      const key = 'f' + Date.now().toString(36).slice(-6);
      try { FA.push(await pb.collection('lnew_faecher').create({ user: learnerId(), key, name, tier: np.tier, xp: 0 })); } catch (e) { toast('Ging nicht: ' + errText(e)); return; }
      closeSheet(); V = { tab: 'tiere', fach: key, sub: null, ses: null }; render(); window.scrollTo?.(0, 0);
      if (isEthik(fach(key))) act.open({ dataset: { k: key } });
    },
    tick: async el => {
      const it = IT.find(i => i.id === el.dataset.id); if (!it) return;
      el.closest('.lnn-todo')?.classList.add('gone');
      await patchItem(it, { done: true, doneAt: new Date().toISOString().slice(0, 19).replace('T', ' ') });
      const f = fach(it.fach); await addXp(f, XP_TODO); toast(`+${XP_TODO} XP für ${f.name || f.key}!`);
      setTimeout(rerender, 350);
    },
    addsave: async el => {
      const f = fach(V.fach), mode = el.dataset.mode; let n = 0;
      try {
        if (mode === 'multi') {
          for (const line of ($('lnnM').value || '').split('\n')) { const [q, ...r] = line.split(';'); if (q && q.trim() && await addItem(f.key, 'karte', q, r.join(';').trim())) n++; }
        } else if (mode === 'karte') { if (await addItem(f.key, 'karte', $('lnnT').value, $('lnnB').value)) n++; }
        else if (await addItem(f.key, 'todo', $('lnnT').value, '', $('lnnD').value)) n++;
      } catch (e) { toast('Ging nicht: ' + errText(e)); return; }
      if (!n) { toast('Bitte etwas eintragen'); return; }
      closeSheet(); toast(n === 1 ? 'Gespeichert' : n + ' Karten gespeichert'); rerender();
    },
  };
  async function saveFach(f, data) { Object.assign(f, data); try { await pb.collection('lnew_faecher').update(f.id, data); } catch (e) { toast('Ging nicht: ' + errText(e)); } }
  async function answer(level) {
    const ses = V.ses, c = IT.find(i => i.id === ses.q[ses.i]), f = fach(c.fach), before = lvlOf(c);
    const gain = level === 3 ? XP_CARD + (before < 3 ? XP_LEARNED : 0) : level === 2 ? 2 : 0;
    await patchItem(c, { box: level, due: '' }); ses.cnt[level]++;
    if (gain) { ses.xp += gain; await addXp(f, gain); }
    ses.i++; ses.flip = false; render();
  }

  function onClick(e) {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const a = el.dataset.act;
    if (el.tagName === 'INPUT' && (a === 'tick' || a === 'rename' || a === 'hide')) return;   // Eingabefelder reagieren auf change
    if (act[a]) { e.preventDefault(); Promise.resolve(act[a](el)).catch(err => toast(errText(err))); }
  }
  document.addEventListener('click', e => { if (e.target.closest('#s-lernennew')) onClick(e); });
  document.addEventListener('change', async e => {
    const el = e.target; if (!el.closest || !el.closest('#s-lernennew')) return;
    if (el.dataset.act === 'tick') act.tick(el).catch(() => {});
    else if (el.dataset.act === 'rename') { const f = fach(el.dataset.k); const v = el.value.trim().slice(0, 40); if (f && v && v !== f.name) await saveFach(f, { name: v }); }
    else if (el.dataset.act === 'hide') { const f = fach(el.dataset.k); if (f) { await saveFach(f, { hidden: el.checked }); } }
  });
  document.addEventListener('input', e => { if (e.target.id === 'lnnSize') { prefs.size = +e.target.value; $('lnnSizeV').textContent = prefs.size + ' %'; savePrefs(); } });
  document.addEventListener('wir:show', e => { if (e.detail === 's-lernennew') { tries = 0; V = { tab: V.tab, fach: null, sub: null, ses: null }; open(); } });
  applyPrefs();
})();
