// Lernen (17.11.2026): Daniels AP2-Lernmappen (Prüfung 25.11.2026) – Heute, To-dos, Stoff, Karten (Leitner), Rechnen, Probe, Dateien.
// Nur für Daniel sichtbar (Kachel auf Start); die Daten schützen zusätzlich die API-Regeln der lern_*-Collections (pb_migrations/1795400000).
// Inhalte: app/lernen/lernen-data.js (Kapitel, Karten, Plan) + lernen-gens.js (Rechengeneratoren), werden beim ersten Öffnen nachgeladen.
// Fortschritt: lokal gespeichert (Offline) und in eine Warteschlange gelegt, die bei Netz in PocketBase geschrieben wird (letzter Stand gewinnt).
(() => {
  const pb = window.WIR_PB;
  if (!pb) return;
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const meRec = () => pb.authStore.record || pb.authStore.model;
  const uid = () => meRec()?.id;
  const isDaniel = () => { const u = meRec(); return !!u && (/daniel/i.test(u.name || '') || /^daniel/i.test(u.email || '')); };
  const OFF_KEY = 'wir-lernen-aus';
  const off = () => { try { return localStorage.getItem(OFF_KEY) === '1'; } catch (_) { return false; } };

  const AREAS = { elek: 'Elektrotechnik', netz: 'Netzwerktechnik', wiso: 'WiSO' };
  const AREA_ORDER = ['elek', 'netz', 'wiso'];
  const PRI = { M: 'MUSS', S: 'SOLL', K: 'KANN' };
  const INT = { 1: 0, 2: 1, 3: 3 };              // Leitner: Box 1 sofort, Box 2 nach 1 Tag, Box 3 nach 3 Tagen
  const dstr = add => { const d = new Date(); d.setDate(d.getDate() + (add || 0)); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const dlabel = s => { const [y, m, d] = (s || '').split('-'); return d ? `${+d}.${+m}.` : ''; };
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pickOne = a => a[Math.floor(Math.random() * a.length)];
  const fmt = (x, d) => (+x).toFixed(d == null ? 2 : d).replace('.', ',');

  // ---------- sicheres Rendern von Kapitel-HTML (nur diese Tags/Klassen) ----------
  const OK_TAGS = new Set(['H2', 'H3', 'H4', 'SPAN', 'DIV', 'B', 'STRONG', 'I', 'EM', 'BR', 'P', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'UL', 'OL', 'LI', 'CODE', 'SUB', 'SUP', 'A']);
  const SKIP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE']);
  const OK_CLS = new Set(['f', 'ex', 't', 'warn', 'box']);
  const memo = new Map();
  function clean(html) {
    if (memo.has(html)) return memo.get(html);
    const src = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html').body;
    const root = document.createElement('div');
    const walk = (from, to) => {
      for (const n of from.childNodes) {
        if (n.nodeType === 3) to.append(document.createTextNode(n.nodeValue));
        else if (n.nodeType === 1) {
          if (SKIP.has(n.tagName)) continue;
          if (!OK_TAGS.has(n.tagName)) { walk(n, to); continue; }
          const e = document.createElement(n.tagName.toLowerCase());
          for (const c of n.classList) if (OK_CLS.has(c)) e.classList.add(c);
          if (n.tagName === 'A') { const h = n.getAttribute('href') || ''; if (/^https?:\/\//i.test(h)) { e.href = h; e.target = '_blank'; e.rel = 'noopener noreferrer'; } }
          walk(n, e); to.append(e);
        }
      }
    };
    walk(src, root);
    root.querySelectorAll('table').forEach(t => {
      const rows = [...t.querySelectorAll('tr')], hr = rows.find(r => r.querySelector('th')); if (!hr) return;
      const labels = [...hr.children].map(c => c.textContent.trim()); hr.classList.add('hdr');
      rows.forEach(r => { if (r !== hr) [...r.children].forEach((c, i) => { if (c.tagName === 'TD' && labels[i]) c.dataset.label = labels[i]; }); });
    });
    memo.set(html, root.innerHTML);
    return root.innerHTML;
  }
  const textOf = html => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').toLowerCase();

  // ---------- Zustand: lokal + Warteschlange nach PocketBase ----------
  let ST = { K: {}, G: {}, S: {}, T: [], PR: [], ids: {}, q: {} };
  let DATA = null, GENS = null, ready = false, online = true;
  const SKEY = () => 'lernen-v1-' + uid();
  const loadLocal = () => { try { const j = JSON.parse(localStorage.getItem(SKEY()) || 'null'); if (j) ST = Object.assign({ K: {}, G: {}, S: {}, T: [], PR: [], ids: {}, q: {} }, j); } catch (_) {} };
  const persist = () => { try { localStorage.setItem(SKEY(), JSON.stringify(ST)); } catch (_) {} };

  function enqueue(col, kf, k, data, del) { ST.q[col + '|' + k] = { col, kf, k, data, del: !!del }; persist(); flush(); }
  let flushing = false;
  async function send(e) {
    const coll = pb.collection(e.col), ik = e.col + '|' + e.k;
    let id = ST.ids[ik];
    if (!id && e.kf) {
      try { id = (await coll.getFirstListItem(pb.filter(e.kf + ' = {:v}', { v: e.k }), { requestKey: null, fields: 'id' })).id; ST.ids[ik] = id; }
      catch (x) { if (x.status !== 404) throw x; }
    }
    if (e.del) { if (id) { await coll.delete(id, { requestKey: null }); delete ST.ids[ik]; } return; }
    if (id) await coll.update(id, e.data, { requestKey: null });
    else ST.ids[ik] = (await coll.create(Object.assign({ user: uid() }, e.kf ? { [e.kf]: e.k } : {}, e.data), { requestKey: null })).id;
  }
  async function flush() {
    if (flushing || !uid() || !navigator.onLine) return;
    flushing = true;
    try {
      let more = true;
      while (more) {                                  // auch Einträge, die während des Sendens dazukommen
        more = false;
        for (const k of Object.keys(ST.q)) {
          try { await send(ST.q[k]); delete ST.q[k]; persist(); more = true; }
          catch (err) { if (err?.status >= 400 && err.status < 500 && err.status !== 429) { delete ST.q[k]; persist(); more = true; } else { more = false; break; } }
        }
      }
    } finally { flushing = false; banner(); }
  }
  async function pull() {
    await flush();
    if (Object.keys(ST.q).length) return false;            // noch Ungesendetes: lokalen Stand behalten
    const get = c => pb.collection(c).getFullList({ requestKey: null, batch: 500 });
    const [k, g, s, t, p] = await Promise.all(['lern_karten', 'lern_gens', 'lern_stoff', 'lern_todos', 'lern_proben'].map(get));
    ST.ids = {}; ST.K = {}; ST.G = {}; ST.S = {};
    k.forEach(r => { ST.K[r.cardId] = { b: r.box, d: r.due }; ST.ids['lern_karten|' + r.cardId] = r.id; });
    g.forEach(r => { ST.G[r.genId] = { r: r.right, n: r.total }; ST.ids['lern_gens|' + r.genId] = r.id; });
    s.forEach(r => { ST.S[r.sectionId] = !!r.gelesen; ST.ids['lern_stoff|' + r.sectionId] = r.id; });
    ST.T = t.map(r => { const key = r.planId || r.id; ST.ids['lern_todos|' + key] = r.id; return { key, planId: r.planId || '', title: r.title, date: r.date, area: r.area, done: !!r.done, doneAt: r.doneAt || '', custom: !!r.custom }; });
    ST.PR = p.map(r => ({ area: r.area, score: r.score, total: r.total, date: r.date })).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    // Plan-Aufgaben einmalig anlegen (nicht doppelt: eindeutiger Index user+planId + Abgleich hier)
    const have = new Set(ST.T.map(x => x.planId).filter(Boolean));
    for (const pt of DATA.plan.tasks) {
      if (have.has(pt.id)) continue;
      const t2 = { key: pt.id, planId: pt.id, title: pt.title, date: pt.date, area: pt.area, done: false, doneAt: '', custom: false };
      ST.T.push(t2); enqueue('lern_todos', 'planId', pt.id, todoData(t2));
    }
    ST.T = ST.T.filter(t => !t.planId || planOf(t.planId));
    persist();
    return true;
  }
  const todoData = t => ({ title: t.title, date: t.date || '', area: t.area || '', done: !!t.done, doneAt: t.doneAt || '', custom: !!t.custom });

  // ---------- Daten laden ----------
  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Laden fehlgeschlagen: ' + src)); document.head.append(s); });
  }
  async function init() {
    if (ready) return;
    loadLocal();
    if (!window.LERN_DATA) await loadScript('/lernen/lernen-data.js');
    if (!window.LERN_GENS) await loadScript('/lernen/lernen-gens.js');
    DATA = window.LERN_DATA; GENS = window.LERN_GENS;
    DATA.sec = {}; DATA.card = {};
    for (const a of AREA_ORDER) {
      DATA.areas[a].sections.forEach(s => { DATA.sec[a + ':' + s.id] = Object.assign({ area: a }, s); });
      DATA.areas[a].cards.forEach(c => { c.area = a; DATA.card[c.id] = c; });
    }
    ready = true;
    ST.T = ST.T.filter(t => !t.planId || planOf(t.planId));       // Plan vom 19.11. ersetzt den alten (andere IDs)
    // lokale Plan-Aufgaben sofort anzeigen (auch offline), Server-Stand danach
    if (!ST.T.length) ST.T = DATA.plan.tasks.map(pt => ({ key: pt.id, planId: pt.id, title: pt.title, date: pt.date, area: pt.area, done: false, doneAt: '', custom: false }));
  }
  async function sync(rerender) {
    try { if (await pull()) online = true; } catch (e) { online = false; console.warn('[lernen] offline/sync', e?.message); }
    if (rerender) render();
  }

  // ---------- Hilfen ----------
  const planOf = id => DATA.plan.tasks.find(t => t.id === id);
  const secOf = (a, id) => DATA.sec[a + ':' + id];
  const cardsOf = area => area === 'alle' ? AREA_ORDER.flatMap(a => DATA.areas[a].cards) : DATA.areas[area].cards;
  const isDue = c => { const s = ST.K[c.id]; return !s || s.d <= dstr(); };
  const isMust = c => DATA.sec[c.area + ':' + c.s]?.p === 'M';
  const stats = pool => { const r = { n: 0, b1: 0, b2: 0, b3: 0, due: 0, total: pool.length }; pool.forEach(c => { const s = ST.K[c.id]; if (!s) r.n++; else r['b' + Math.min(3, s.b)]++; if (isDue(c)) r.due++; }); return r; };
  function setBox(c, ok) {
    const s = ST.K[c.id], b = ok ? Math.min(3, (s ? s.b : 1) + 1) : 1;
    ST.K[c.id] = { b, d: dstr(INT[b]) };
    enqueue('lern_karten', 'cardId', c.id, { box: b, due: ST.K[c.id].d });
  }
  const parseNum = v => parseFloat(String(v).trim().replace(/\s/g, '').replace(',', '.'));
  const check = (q, v) => { const x = parseNum(v); if (isNaN(x)) return false; const tol = q.tol || 0.02; return Math.abs(x - q.ans) <= Math.max(Math.abs(q.ans) * tol, q.abs || 0.0005); };
  const gensOf = area => area === 'alle' ? AREA_ORDER.flatMap(a => GENS[a].map(g => Object.assign({ area: a }, g))) : GENS[area].map(g => Object.assign({ area }, g));
  const mkQ = g => { const q = g.gen(); q.g = g; return q; };
  const gKey = g => g.area + ':' + g.id;
  function recordGen(g, ok) { const k = gKey(g), s = ST.G[k] = ST.G[k] || { r: 0, n: 0 }; s.n++; if (ok) s.r++; enqueue('lern_gens', 'genId', k, { right: s.r, total: s.n }); }
  const resHtml = (q, ok) => `<div class="ln-res ${ok ? 'ok' : 'bad'}"><b class="h">${ok ? 'Richtig' : 'Nicht ganz'}: ${fmt(q.ans, q.dec == null ? 2 : q.dec)} ${esc(q.unit || '')}</b>${clean(q.sol)}</div>`;
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0;

  // ---------- Ansicht ----------
  const VIEWS = [['heute', 'Heute'], ['todos', 'Plan'], ['pruef', 'Aufgaben'], ['stoff', 'Stoff'], ['karten', 'Karten'], ['rechnen', 'Rechnen'], ['probe', 'Probe'], ['dateien', 'Dateien']];
  let view = 'heute';
  const V = {                       // Zustand je Ansicht
    st: { area: 'elek', q: '', focus: null, open: new Set() },
    kf: { area: 'alle', sec: 'all', secs: null, mode: 'due', must: false },
    pq: { area: 'elek', only: false, focus: null, o: new Set(), t: new Set(), sol: new Set() }, pl: { open: null },
    who: null, ses: null,                      // laufende Kartenrunde
    r: { area: 'elek', sel: 'mix', ids: null, cur: null, done: false },
    pf: { area: 'alle', cards: 15, calc: 5, min: 40, must: false },
    P: null, ptimer: null,
    files: null, token: '', add: { title: '', date: dstr(), area: 'alle' }, tdOpen: false,
  };
  const body = () => $('lnBody');

  function go(v) { view = v; render(); const s = $('s-lernen'); if (s) s.scrollTop = 0; window.scrollTo?.(0, 0); }
  function banner() { const b = $('lnSync'); if (!b) return; const n = Object.keys(ST.q).length; b.hidden = !(n || !navigator.onLine); b.textContent = navigator.onLine ? `${n} Änderung${n === 1 ? '' : 'en'} warten auf Synchronisation` : 'Offline – dein Stand wird später gespeichert'; }

  function render() {
    if (!ready || V.who !== 'daniel') return;
    const openTodos = ST.T.filter(t => !t.done && t.date === dstr()).length;
    $('lnNav').innerHTML = VIEWS.map(([k, n]) => `<button type="button" data-v="${k}" class="${k === view ? 'on' : ''}">${n}${k === 'todos' && openTodos ? `<i>${openTodos}</i>` : ''}</button>`).join('');
    const fn = { heute: vHeute, todos: vTodos, pruef: vPruef, stoff: vStoff, karten: vKarten, rechnen: vRechnen, probe: vProbe, dateien: vDateien }[view];
    const el = body(); el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    fn(el);
    banner();
  }

  // ===== Heute =====
  function ring(area) {
    const s = stats(cardsOf(area)), p = pct(s.b3, s.total), C = 2 * Math.PI * 32;
    return `<button class="ln-ring" type="button" data-act="ring" data-a="${area}"><svg viewBox="0 0 80 80"><circle class="bg" cx="40" cy="40" r="32"/><circle class="fg" cx="40" cy="40" r="32" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - p / 100)).toFixed(1)}"/></svg><em>${p}%</em><span>${AREAS[area]}</span>${area === 'elek' ? '<span class="ln-badge">Pflichtbereich: mind. ausreichend</span>' : ''}</button>`;
  }
  function todoRow(t, withGo) {
    const pt = t.planId && planOf(t.planId), title = pt ? pt.title : t.title, date = pt ? pt.date : t.date, area = pt ? pt.area : t.area;
    const canGo = pt && ['stoff', 'karten', 'rechnen', 'probe', 'pruef'].includes(pt.action);
    return `<div class="ln-todo glass ${t.done ? 'done' : ''}"><button class="ln-chk" type="button" data-act="chk" data-k="${esc(t.key)}" aria-label="Abhaken">✓</button>
      <div class="ln-sp"><div class="ln-tt">${esc(title)}</div><div class="ln-tm">${[dlabel(date), pt?.timeSlot, area && area !== 'alle' ? AREAS[area] : ''].filter(Boolean).map(esc).join(' · ')}</div></div>
      ${withGo && canGo && !t.done ? `<button class="ln-go" type="button" data-act="go" data-k="${esc(t.key)}">Los</button>` : ''}${t.custom ? `<button class="ln-del" type="button" data-act="del" data-k="${esc(t.key)}" aria-label="Löschen">✕</button>` : ''}</div>`;
  }
  function vHeute(el) {
    const today = dstr(), exam = DATA.plan.examDate, days = Math.round((new Date(exam + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000);
    const all = cardsOf('alle'), due = stats(all).due;
    const tt = ST.T.filter(t => t.date === today).sort((a, b) => a.done - b.done);
    const over = ST.T.filter(t => !t.done && t.date && t.date < today).length;
    const last = ST.PR[0];
    let head;
    if (days > 0) head = `<b>${days}</b><span>${days === 1 ? 'Tag' : 'Tage'} bis zur Prüfung</span><small>25.11.2026</small>`;
    else if (days === 0) head = `<b>Heute</b><span>ist Prüfungstag. Du packst das.</span>`;
    else head = `<b>Geschafft</b><span>Die Prüfung ist vorbei. Du hast viel gelernt.</span><small>Die Lernmappen bleiben für dich da.</small>`;
    el.innerHTML = `<div class="ln-card glass ln-count">${head}</div>
      ${days >= 0 ? `<div class="ln-card glass"><div class="ln-row"><div class="ln-sp"><h3 style="margin:0">Karten heute</h3><div class="ln-sub">${due} fällig oder neu</div></div></div><button class="ln-btn big" type="button" data-act="startdue" style="margin-top:12px" ${due ? '' : 'disabled'}>${due ? 'Karten starten' : 'Alles geschafft'}</button></div>` : ''}
      <div class="ln-card glass"><h3>Aufgaben heute</h3>${tt.length ? '' : '<div class="ln-sub">Für heute steht nichts im Plan.</div>'}<div style="display:flex;flex-direction:column;gap:8px">${tt.map(t => todoRow(t, true)).join('')}</div>
        ${over ? `<button class="ln-link" type="button" data-v="todos" style="margin-top:8px">${over} überfällig anzeigen</button>` : ''}</div>
      <div class="ln-card glass" id="lnPqHeute"><h3>Prüfungsaufgaben</h3><div class="ln-sub">Lade …</div></div>
      <div class="ln-card glass"><h3>Fortschritt (Karten in Box 3)</h3><div class="ln-rings">${AREA_ORDER.map(ring).join('')}</div></div>
      ${last ? `<div class="ln-card glass"><h3>Letzte Probe</h3><div class="ln-row"><div class="ln-sp"><b style="color:var(--ink);font-size:22px">${last.score} / ${last.total}</b> <span class="ln-sub">(${pct(last.score, last.total)} %)</span></div><div class="ln-sub">${last.area && last.area !== 'alle' ? esc(AREAS[last.area]) + ' · ' : ''}${esc((last.date || '').slice(0, 10).split('-').reverse().join('.'))}</div></div></div>` : ''}`;
    needPQ().then(() => { if (view === 'heute') pqHeute(); }).catch(() => { const e = $('lnPqHeute'); if (e) e.hidden = true; });
  }

  function pqHeute() {
    const el = $('lnPqHeute'); if (!el || !PQ) return;
    el.innerHTML = `<h3>Prüfungsaufgaben</h3><div class="pq-bars">${AREA_ORDER.map(a => { const c = pqCount(a); return `<div class="pq-bar"><span>${AREAS[a]}</span><div class="ln-prog"><i style="width:${pct(c.seen, c.n)}%"></i></div><b>${c.seen}/${c.n}</b></div>`; }).join('')}</div>
      <button class="ln-btn sm soft" type="button" data-v="pruef" style="margin-top:12px">Aufgaben öffnen</button>`;
  }

  // ===== To-dos =====
  const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const wd = d => d ? WD[new Date(d + 'T00:00:00').getDay()] + ' ' + dlabel(d) : 'Ohne Datum';
  function planDays() {
    const g = {};
    ST.T.forEach(t => { const d = (t.planId && planOf(t.planId)?.date) || t.date || ''; (g[d] = g[d] || []).push(t); });
    return Object.keys(g).sort((a, b) => (a || '9').localeCompare(b || '9')).map(d => [d, g[d]]);
  }
  function daysHtml() {
    const today = dstr(), P = V.pl;
    return planDays().map(([d, L], i) => {
      const done = L.filter(t => t.done).length, open = P.open.has(d || '-'), pt = L.map(t => t.planId && planOf(t.planId)).find(Boolean);
      return `<div class="ln-card glass ln-sec ${open ? 'open' : ''} ${done === L.length ? 'read' : ''}"><button class="hd" type="button" data-act="day" data-d="${esc(d || '-')}"><span class="ln-t">${wd(d)}${d === today ? ' · Heute' : ''}<small class="pq-sm">${esc(pt?.dayTitle || 'Eigene To-dos')}</small></span><span class="pq-cnt">${done}/${L.length}</span><span class="ar">›</span></button>
        <div class="bd">${open ? `<div style="display:flex;flex-direction:column;gap:8px">${L.map(t => todoRow(t, true)).join('')}</div>` : ''}</div></div>`;
    }).join('');
  }
  function vTodos(el) {
    const today = dstr(), P = V.pl;
    if (!P.open) { const ds = planDays().map(x => x[0]); P.open = new Set([ds.includes(today) ? today : (ds.find(d => d > today) || ds[ds.length - 1] || '-')]); }
    const a = V.add;
    el.innerHTML = `${V.tdOpen ? `<div class="ln-card glass ln-add"><h3 style="margin:0">Neues To-do</h3><input class="ln-input" id="tdTitle" placeholder="Titel" maxlength="200" value="${esc(a.title)}">
        <div class="ln-row"><input class="ln-input" id="tdDate" type="date" value="${esc(a.date)}"><select class="ln-input" id="tdArea"><option value="alle">Alle</option>${AREA_ORDER.map(k => `<option value="${k}" ${a.area === k ? 'selected' : ''}>${AREAS[k]}</option>`).join('')}</select></div>
        <div class="ln-row"><button class="ln-btn soft sm" type="button" data-act="tdcancel">Abbrechen</button><div class="ln-sp"></div><button class="ln-btn sm" type="button" data-act="tdsave">Speichern</button></div></div>`
      : `<button class="ln-btn soft sm" type="button" data-act="tdnew" style="align-self:flex-start">+ Eigenes To-do</button>`}
      <div class="pq-grid" id="lnDays">${daysHtml()}</div>`;
  }

  // ===== Stoff =====
  function secCard(s, open) {
    const k = s.area + ':' + s.id, read = ST.S[k];
    return `<div class="ln-card glass ln-sec ${open ? 'open' : ''} ${read ? 'read' : ''}" data-sk="${k}"><button class="hd" type="button" data-act="sec" data-sk="${k}"><span class="ln-t">${esc(s.title)}</span><span class="ln-pri ${s.p}">${PRI[s.p]}</span><span class="ar">›</span></button>
      <div class="bd">${open ? `<div class="ln-html">${clean(s.html)}</div><div class="ln-row" style="margin-top:14px"><button class="ln-btn sm ${read ? 'soft' : ''}" type="button" data-act="read" data-sk="${k}">${read ? 'Gelesen ✓' : 'Als gelesen markieren'}</button></div>` : ''}</div></div>`;
  }
  function stoffList() {
    const st = V.st, q = st.q.trim().toLowerCase();
    let list;
    if (st.focus) list = st.focus.ids.map(id => secOf(st.focus.area, id)).filter(Boolean);
    else if (q) list = AREA_ORDER.flatMap(a => DATA.areas[a].sections.map(s => DATA.sec[a + ':' + s.id])).filter(s => (s.title + ' ' + textOf(s.html)).toLowerCase().includes(q));
    else list = DATA.areas[st.area].sections.map(s => DATA.sec[st.area + ':' + s.id]);
    const info = st.focus ? `<div class="ln-focus"><span class="ln-sp">Aus dem Plan: ${list.length} Kapitel</span><button class="ln-link" type="button" data-act="unfocus">Alle Kapitel</button></div>` : '';
    return info + (list.length ? list.map(s => secCard(s, st.open.has(s.area + ':' + s.id))).join('') : '<div class="ln-empty">Nichts gefunden.</div>');
  }
  function vStoff(el) {
    const st = V.st, rd = a => DATA.areas[a].sections.filter(s => ST.S[a + ':' + s.id]).length;
    el.innerHTML = `<input class="ln-input" id="stQ" type="search" placeholder="Alle Kapitel durchsuchen" value="${esc(st.q)}" autocomplete="off">
      ${st.q.trim() || st.focus ? '' : `<div class="ln-seg">${AREA_ORDER.map(a => `<button type="button" data-act="starea" data-a="${a}" class="${st.area === a ? 'on' : ''}">${AREAS[a]} ${rd(a)}/${DATA.areas[a].sections.length}</button>`).join('')}</div>
      <div class="ln-note"><span class="ln-pri M">MUSS</span> prüfungsnah, zuerst · <span class="ln-pri S">SOLL</span> wichtig · <span class="ln-pri K">KANN</span> bei Zeit</div>`}
      <div id="lnStList" style="display:flex;flex-direction:column;gap:12px">${stoffList()}</div>`;
    $('stQ').oninput = e => { V.st.q = e.target.value; V.st.focus = null; $('lnStList').innerHTML = stoffList(); };
  }

  // ===== Prüfungsaufgaben (echte AP2-Aufgaben nach Thema, Lösung zum Aufklappen) =====
  let PQ = null;
  const PQX = ['S26', 'S25', 'W24/25', 'S24', 'W23/24', 'S23', 'W22/23', 'S22', 'W21/22'];
  async function needPQ() {
    if (PQ) return PQ;
    if (!window.LERN_PRUEF) await loadScript('/lernen/lernen-pruef.js');
    const all = window.LERN_PRUEF.tasks.map((t, i) => Object.assign({ i }, t)), P = { all, by: {}, byId: {}, ex: {} };
    for (const t of all) { P.byId[t.id] = t; (P.by[t.a + ':' + t.s] = P.by[t.a + ':' + t.s] || []).push(t); (P.ex[t.a] = P.ex[t.a] || new Set()).add(t.ex); }
    for (const k in P.by) P.by[k].sort((x, y) => (PQX.indexOf(x.ex) - PQX.indexOf(y.ex)) || x.i - y.i);
    return (PQ = P);
  }
  const pqSeen = t => !!ST.K['pq:' + t.id];
  const pqCount = a => { const L = PQ.all.filter(t => t.a === a); return { n: L.length, seen: L.filter(pqSeen).length }; };
  function pqSecs(a) {
    const f = V.pq.focus;
    return DATA.areas[a].sections.filter(s => PQ.by[a + ':' + s.id] && (!f || f.ids.includes(s.id))).map(s => { const L = PQ.by[a + ':' + s.id]; return { s, L, n: new Set(L.map(t => t.ex)).size }; })
      .sort((x, y) => f ? 0 : (y.n - x.n || y.L.length - x.L.length));
  }
  function pqRow(t) {
    const q = V.pq, open = q.t.has(t.id), sol = q.sol.has(t.id), seen = pqSeen(t), id = esc(t.id);
    return `<div class="pq-row ${open ? 'open' : ''} ${seen ? 'seen' : ''}"><button type="button" class="pq-hd" data-act="pqt" data-id="${id}"><span class="pq-ex">${esc(t.ex)}</span><span class="pq-t">${esc(t.t)}<small>${esc(t.n)}${t.p ? ' · ' + t.p + ' P.' : ''}</small></span><span class="pq-ok">✓</span></button>
      ${open ? `<div class="pq-bd"><div class="ln-html pq-q">${clean(t.q)}</div>${sol ? `<div class="pq-solh">Lösung</div><div class="ln-html pq-sol">${clean(t.sol)}</div>` : ''}
        <div class="pq-acts"><button type="button" class="ln-btn sm ${sol ? 'soft' : ''}" data-act="pqsol" data-id="${id}">${sol ? 'Lösung verbergen' : 'Lösung anzeigen'}</button><button type="button" class="ln-btn sm soft" data-act="pqseen" data-id="${id}">${seen ? 'Gesehen ✓' : 'Gesehen'}</button></div></div>` : ''}</div>`;
  }
  function pqListHtml() {
    const q = V.pq, a = q.area, N = PQ.ex[a]?.size || 0;
    const secs = pqSecs(a).map(o => ({ ...o, L: q.only ? o.L.filter(t => !pqSeen(t)) : o.L, all: o.L })).filter(o => o.L.length);
    if (!secs.length) return `<div class="ln-empty">${q.only ? 'Alles gesehen. Stark.' : 'Keine Aufgaben.'}</div>`;
    return secs.map(o => {
      const k = a + ':' + o.s.id, open = q.o.has(k), seenN = o.all.filter(pqSeen).length, heat = N ? (o.n / N >= 0.7 ? 'h3' : o.n / N >= 0.4 ? 'h2' : 'h1') : 'h1';
      return `<div class="ln-card glass ln-sec ${open ? 'open' : ''} ${seenN === o.all.length ? 'read' : ''}"><button class="hd" type="button" data-act="pqsec" data-sk="${esc(k)}"><span class="ln-t">${esc(o.s.title.replace(/^\d+\s*·\s*/, ''))}<small class="pq-sm">${o.all.length} Aufgaben · ${seenN} gesehen</small></span><span class="pq-freq ${heat}" title="Kam in ${o.n} von ${N} Prüfungen vor">${o.n}/${N}</span><span class="ar">›</span></button>
        <div class="bd">${open ? `<div class="pq-list">${o.L.map(pqRow).join('')}</div>` : ''}</div></div>`;
    }).join('');
  }
  function pqHeadHtml() {
    const q = V.pq, f = q.focus, tot = AREA_ORDER.reduce((x, a) => { const c = pqCount(a); return { n: x.n + c.n, seen: x.seen + c.seen }; }, { n: 0, seen: 0 });
    return `<div class="ln-prog"><i style="width:${pct(tot.seen, tot.n)}%"></i></div><div class="ln-sub" style="margin-top:6px">${tot.seen} von ${tot.n} Aufgaben gesehen · Zahl am Thema = in so vielen Prüfungen kam es vor</div>
      <div class="ln-seg" style="margin-top:10px">${AREA_ORDER.map(a => { const c = pqCount(a); return `<button type="button" data-act="pqarea" data-a="${a}" class="${q.area === a ? 'on' : ''}">${AREAS[a]} ${c.seen}/${c.n}</button>`; }).join('')}</div>
      <div class="ln-row" style="margin-top:10px"><button type="button" class="pq-chip ${q.only ? 'on' : ''}" data-act="pqonly">Nur offene</button><div class="ln-sp"></div>${f ? `<span class="ln-sub">Aus dem Plan</span><button class="ln-link" type="button" data-act="pqunfocus">Alle Themen</button>` : ''}</div>`;
  }
  function pqRefresh() { const h = $('lnPqHead'), l = $('lnPqList'); if (h) h.innerHTML = pqHeadHtml(); if (l) l.innerHTML = pqListHtml(); }
  async function vPruef(el) {
    if (!PQ) {
      el.innerHTML = '<div class="ln-empty">Lade Prüfungsaufgaben …</div>';
      try { await needPQ(); } catch (_) { el.innerHTML = '<div class="ln-empty">Konnte nicht geladen werden. Bitte einmal mit Netz öffnen.</div>'; return; }
      if (view !== 'pruef') return;
    }
    el.innerHTML = `<div class="ln-card glass" id="lnPqHead">${pqHeadHtml()}</div><div class="pq-grid" id="lnPqList">${pqListHtml()}</div>`;
  }
  function pqMark(t, on) {
    const k = 'pq:' + t.id;
    if (on) { ST.K[k] = { b: 1, d: '' }; enqueue('lern_karten', 'cardId', k, { box: 1, due: '' }); }
    else { delete ST.K[k]; enqueue('lern_karten', 'cardId', k, null, true); }
  }

  // ===== Karten (Leitner) =====
  function kPool() {
    const f = V.kf; let pool = cardsOf(f.area);
    if (f.secs) pool = pool.filter(c => f.secs.includes(c.s));
    else if (f.sec !== 'all') pool = pool.filter(c => c.s === f.sec);
    if (f.must) pool = pool.filter(isMust);
    return pool;
  }
  function vKarten(el) {
    if (V.ses) return vSession(el);
    const f = V.kf, pool = kPool(), s = stats(pool);
    const secOpts = f.area === 'alle' ? '' : DATA.areas[f.area].sections.filter(x => DATA.areas[f.area].cards.some(c => c.s === x.id)).map(x => `<option value="${x.id}" ${f.sec === x.id && !f.secs ? 'selected' : ''}>${esc(x.title)}</option>`).join('');
    const queue = buildQueue();
    el.innerHTML = `<div class="ln-card glass" style="display:flex;flex-direction:column;gap:12px">
        <div class="ln-seg">${['alle', ...AREA_ORDER].map(a => `<button type="button" data-act="kfarea" data-a="${a}" class="${f.area === a ? 'on' : ''}">${a === 'alle' ? 'Alle' : AREAS[a]}</button>`).join('')}</div>
        ${f.area === 'alle' ? '' : `<select class="ln-input" id="kfSec"><option value="all">Alle Themen</option>${f.secs ? `<option value="__plan" selected>Aus dem Plan (${f.secs.length} Kapitel)</option>` : ''}${secOpts}</select>`}
        <select class="ln-input" id="kfMode"><option value="due" ${f.mode === 'due' ? 'selected' : ''}>Heute fällig + neu</option><option value="b1" ${f.mode === 'b1' ? 'selected' : ''}>Box 1 (Fehlerliste)</option><option value="all" ${f.mode === 'all' ? 'selected' : ''}>Alle</option></select>
        <label class="check"><input type="checkbox" class="switch" id="kfMust" ${f.must ? 'checked' : ''}><span>Nur MUSS-Themen</span></label></div>
      <div class="ln-card glass"><div class="ln-prog"><i style="width:${pct(s.b3, s.total)}%"></i></div>
        <div class="ln-boxes" style="margin-top:12px"><div><b>${s.n}</b><span>Neu</span></div><div><b>${s.b1}</b><span>Box 1</span></div><div><b>${s.b2}</b><span>Box 2</span></div><div><b>${s.b3}</b><span>Box 3</span></div></div>
        <div class="ln-note" style="margin-top:10px">Sehr gut → Box 3 (kommt in 3 Tagen), Okay → Box 2 (1 Tag), Schlecht → Box 1 (gleich wieder). Reiter oben in der Runde wählen die Stufen.</div></div>
      <button class="ln-btn big" type="button" data-act="kstart" ${queue.length ? '' : 'disabled'}>${queue.length ? `${queue.length} Karten starten` : 'Nichts in dieser Auswahl'}</button>`;
    $('kfSec') && ($('kfSec').onchange = e => { if (e.target.value === '__plan') return; V.kf.secs = null; V.kf.sec = e.target.value; render(); });
    $('kfMode').onchange = e => { V.kf.mode = e.target.value; render(); };
    $('kfMust').onchange = e => { V.kf.must = e.target.checked; render(); };
  }
  function buildQueue() {
    const f = V.kf, pool = kPool();
    return shuffle(pool.filter(c => f.mode === 'all' || (f.mode === 'b1' ? ST.K[c.id]?.b === 1 : isDue(c))));
  }
  // Rundenlogik wie bei Ida: Reiter oben = welche Stufen drankommen, Karte dreht sich beim Tippen, drei Knöpfe bewerten.
  // Schlecht → Box 1 (gleich wieder), Okay → Box 2 (1 Tag), Sehr gut → Box 3 (3 Tage). Neue Karten zählen als „Schlecht“.
  const LVN = { 0: 'Schlecht', 1: 'Okay', 2: 'Sehr gut' }, LORD = [2, 1, 0];
  const lvOf = c => { const s = ST.K[c.id]; return !s ? 0 : s.b >= 3 ? 2 : s.b === 2 ? 1 : 0; };
  function setBoxTo(c, b) { ST.K[c.id] = { b, d: dstr(INT[b]) }; enqueue('lern_karten', 'cardId', c.id, { box: b, due: ST.K[c.id].d }); }
  function startSession() { V.ses = { base: buildQueue(), sel: [0, 1, 2], deck: null, pos: 0, flip: false, busy: false, n: [0, 0, 0] }; render(); }
  function sesDeck(S) { if (!S.deck) { S.deck = shuffle(S.base.filter(c => S.sel.includes(lvOf(c)))); S.pos = 0; } return S.deck; }
  function vSession(el) {
    const S = V.ses, deck = sesDeck(S);
    const tabs = `<div class="kk-tabs">${LORD.map(x => `<button type="button" class="kk-tab t${x} ${S.sel.includes(x) ? 'on' : ''}" data-act="ksel" data-l="${x}" aria-pressed="${S.sel.includes(x)}">${LVN[x]}</button>`).join('')}</div>`;
    const top = `<div class="ln-row"><button class="ln-link" type="button" data-act="kend">‹ Beenden</button><div class="ln-sp"></div><span class="ln-sub">${Math.max(0, deck.length - S.pos)} übrig</span></div>`;
    if (!S.base.length) { el.innerHTML = top + `<div class="kk kk-none">${tabs}<div class="kk-empty"><b>Nichts fällig</b><button type="button" class="ln-btn" data-act="kend">Fertig</button></div></div>`; return; }
    if (!deck.length) { el.innerHTML = top + `<div class="kk kk-none">${tabs}<div class="kk-empty">Hier sind gerade keine Karten.</div></div>`; return; }
    if (S.pos >= deck.length) {
      el.innerHTML = top + `<div class="kk kk-none">${tabs}<div class="kk-empty"><b>Runde geschafft</b><span>${S.n[2]} sehr gut · ${S.n[1]} okay · ${S.n[0]} schlecht</span><button type="button" class="ln-btn" data-act="kagain">Nochmal</button><button type="button" class="ln-link" data-act="kend">Fertig</button></div></div>`;
      return;
    }
    const c = deck[S.pos], sec = DATA.sec[c.area + ':' + c.s], face = (cls, side, body) => `<div class="kk-face ${cls}"><div class="kk-head"><span>${side}</span><span>${S.pos + 1} / ${deck.length}</span></div><div class="kk-mid">${body}</div></div>`;
    el.innerHTML = top + `<div class="kk lnk" id="lnKK" data-l="${lvOf(c)}">${tabs}
      <div class="kk-card ${S.flip ? 'flip' : ''}" id="lnKc" data-act="kflip" role="button" tabindex="0" aria-label="Karte umdrehen"><div class="kk-in">
        ${face('', 'Frage · ' + esc(sec?.title || ''), `<div class="kk-big kk-q">${esc(c.q)}</div>`)}${face('kk-back', 'Antwort', `<div class="kk-ans ln-html">${clean(c.a)}</div>`)}
      </div></div></div>
      <div class="kk-rate">${LORD.slice().reverse().map(x => `<button type="button" class="r${x}" data-act="krate" data-l="${x}">${LVN[x]}</button>`).join('')}</div>
      <div class="ln-hint">Erst selbst antworten, dann tippen zum Umdrehen und bewerten.</div>`;
    const kc = $('lnKc'); kc.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); kc.click(); } };
  }
  function rateCard(l, btn) {
    const S = V.ses, c = S.deck?.[S.pos]; if (!c || S.busy) return;
    S.busy = true; btn?.classList.add('hit'); setBoxTo(c, l + 1); S.n[l]++;
    const k = $('lnKK'); if (k) k.dataset.l = l;
    setTimeout(() => { S.busy = false; S.pos++; S.flip = false; if (V.ses === S && view === 'karten') render(); }, 260);
  }

  // ===== Rechnen =====
  function rGens() { const R = V.r; const all = gensOf(R.area); return R.ids ? all.filter(g => R.ids.includes(g.id)) : all; }
  function newR() { const R = V.r, list = R.sel === 'mix' ? rGens() : gensOf(R.area).filter(g => g.id === R.sel); R.cur = mkQ(pickOne(list.length ? list : gensOf(R.area))); R.done = false; }
  function vRechnen(el) {
    const R = V.r; if (!R.cur) newR();
    const gl = gensOf(R.area);
    el.innerHTML = `<div class="ln-seg">${AREA_ORDER.map(a => `<button type="button" data-act="rarea" data-a="${a}" class="${R.area === a ? 'on' : ''}">${AREAS[a]}</button>`).join('')}</div>
      <select class="ln-input" id="rSel"><option value="mix">Mix${R.ids ? ' (aus dem Plan)' : ''}</option>${gl.map(g => `<option value="${g.id}" ${R.sel === g.id ? 'selected' : ''}>${esc(g.title)}</option>`).join('')}</select>
      <div class="ln-card glass" style="display:flex;flex-direction:column;gap:14px"><div class="ln-sub">${esc(R.cur.g.title)}</div><div class="ln-q">${esc(R.cur.q)}</div>
        <div class="ln-ans"><input class="ln-input" id="rIn" inputmode="decimal" autocomplete="off" placeholder="Ergebnis" ${R.done ? 'readonly' : ''} value="${esc(R.val || '')}"><b>${esc(R.cur.unit || '')}</b></div>
        <div id="rRes">${R.done ? resHtml(R.cur, R.ok) : ''}</div>
        <button class="ln-btn big" type="button" data-act="${R.done ? 'rnext' : 'rcheck'}">${R.done ? 'Nächste Aufgabe' : 'Prüfen'}</button></div>
      <div class="ln-card glass"><h3>Trefferquote</h3>${gl.map(g => { const s = ST.G[gKey(g)]; return `<div class="ln-stat"><span>${esc(g.title)}</span><span>${s ? `${s.r}/${s.n} (${pct(s.r, s.n)} %)` : '–'}</span></div>`; }).join('')}</div>`;
    $('rSel').onchange = e => { V.r.sel = e.target.value; V.r.ids = null; newR(); V.r.val = ''; render(); };
    const inp = $('rIn'); if (inp && !R.done) { inp.oninput = e => { R.val = e.target.value; }; inp.onkeydown = e => { if (e.key === 'Enter') rCheck(); }; }
    else if (inp) inp.onkeydown = e => { if (e.key === 'Enter') { newR(); R.val = ''; render(); } };
  }
  function rCheck() { const R = V.r; if (R.done || !R.val?.trim()) return; R.ok = check(R.cur, R.val); R.done = true; recordGen(R.cur.g, R.ok); render(); }

  // ===== Probe =====
  function probeStart() {
    const f = V.pf;
    let pool = cardsOf(f.area); if (f.must) pool = pool.filter(isMust);
    const w = c => { const p = DATA.sec[c.area + ':' + c.s]?.p; return p === 'M' ? 3 : p === 'S' ? 2 : 1; };
    const wp = []; pool.forEach(c => { for (let i = 0; i < w(c); i++) wp.push(c); }); shuffle(wp);
    const cards = []; for (const c of wp) { if (!cards.includes(c)) cards.push(c); if (cards.length >= f.cards) break; }
    const gl = shuffle(gensOf(f.area).slice()), items = cards.map(c => ({ t: 'c', c }));
    for (let i = 0; i < f.calc; i++) items.push({ t: 'g', q: mkQ(gl[i % gl.length]) });
    shuffle(items);
    V.P = { items, i: 0, score: 0, fails: [], end: Date.now() + f.min * 60000, done: false, shown: false, area: f.area, val: '', ans: false };
    clearInterval(V.ptimer); V.ptimer = setInterval(tick, 500);
    render();
  }
  function tick() {
    const P = V.P; if (!P || P.done) { clearInterval(V.ptimer); return; }
    const left = P.end - Date.now(), el = $('lnTm');
    if (el) { const m = Math.max(0, Math.floor(left / 60000)), s = Math.max(0, Math.floor(left / 1000) % 60); el.textContent = m + ':' + String(s).padStart(2, '0'); el.classList.toggle('low', left < 120000); }
    if (left <= 0) probeFinish();
  }
  function probeFinish() {
    const P = V.P; if (!P || P.done) return;
    P.done = true; clearInterval(V.ptimer);
    P.fails.forEach(f => { if (f.t === 'c') setBox(f.c, false); });
    const rec = { area: P.area, score: P.score, total: P.items.length, date: new Date().toISOString() };
    ST.PR.unshift(rec); enqueue('lern_proben', null, 'p' + Date.now().toString(36), rec);
    if (view === 'probe') render();
  }
  function vProbe(el) {
    const P = V.P, f = V.pf;
    if (!P) {
      const sel = (id, arr, cur) => `<select class="ln-input" id="${id}">${arr.map(v => `<option ${v == cur ? 'selected' : ''}>${v}</option>`).join('')}</select>`;
      const last = ST.PR[0];
      el.innerHTML = `<div class="ln-card glass" style="display:flex;flex-direction:column;gap:12px"><h3 style="margin:0">Probeklausur</h3>
        <div class="ln-seg">${['alle', ...AREA_ORDER].map(a => `<button type="button" data-act="pfarea" data-a="${a}" class="${f.area === a ? 'on' : ''}">${a === 'alle' ? 'Alle' : AREAS[a]}</button>`).join('')}</div>
        <div class="ln-row"><div class="ln-sp"><div class="ln-sub">Karten</div>${sel('pfC', [5, 10, 15, 25, 40], f.cards)}</div><div class="ln-sp"><div class="ln-sub">Rechnen</div>${sel('pfR', [0, 3, 5, 8, 12], f.calc)}</div><div class="ln-sp"><div class="ln-sub">Minuten</div>${sel('pfM', [10, 20, 40, 60, 90], f.min)}</div></div>
        <label class="check"><input type="checkbox" class="switch" id="pfMust" ${f.must ? 'checked' : ''}><span>Nur MUSS-Themen</span></label>
        <div class="ln-note">Gemischte Fragen, MUSS-Themen häufiger. Karten bewertest du selbst, falsche landen automatisch in Box 1.</div></div>
        <button class="ln-btn big" type="button" data-act="pstart">Start</button>
        ${last ? `<div class="ln-sub" style="text-align:center">Letzte Probe: ${last.score} von ${last.total} (${(last.date || '').slice(0, 10).split('-').reverse().join('.')})</div>` : ''}`;
      $('pfC').onchange = e => { f.cards = +e.target.value; }; $('pfR').onchange = e => { f.calc = +e.target.value; }; $('pfM').onchange = e => { f.min = +e.target.value; }; $('pfMust').onchange = e => { f.must = e.target.checked; };
      return;
    }
    if (P.done || P.i >= P.items.length) { if (!P.done) probeFinish(); return probeResult(el); }
    const it = P.items[P.i];
    const head = `<div class="ln-timer" id="lnTm"></div><div class="ln-sub" style="text-align:center">Frage ${P.i + 1} / ${P.items.length}</div>`;
    if (it.t === 'c') {
      const sec = DATA.sec[it.c.area + ':' + it.c.s];
      el.innerHTML = `${head}<div class="ln-card glass" style="display:flex;flex-direction:column;gap:14px"><div class="ln-sub">${esc(sec?.title || '')}</div><div class="ln-q ln-html">${clean(it.c.q)}</div>
        ${P.shown ? `<div class="ln-res ln-html">${clean(it.c.a)}</div><div class="ln-acts"><button class="ln-btn no" type="button" data-act="pno">Falsch</button><button class="ln-btn ok" type="button" data-act="pyes">Richtig</button></div>` : `<button class="ln-btn big" type="button" data-act="pshow">Antwort zeigen</button>`}</div>`;
    } else {
      const q = it.q;
      el.innerHTML = `${head}<div class="ln-card glass" style="display:flex;flex-direction:column;gap:14px"><div class="ln-sub">${esc(q.g.title)}</div><div class="ln-q">${esc(q.q)}</div>
        <div class="ln-ans"><input class="ln-input" id="pIn" inputmode="decimal" autocomplete="off" placeholder="Ergebnis" value="${esc(P.val)}" ${P.ans ? 'readonly' : ''}><b>${esc(q.unit || '')}</b></div>
        ${P.ans ? resHtml(q, P.ok) : ''}<button class="ln-btn big" type="button" data-act="${P.ans ? 'pnext' : 'pcheck'}">${P.ans ? 'Weiter' : 'Prüfen'}</button></div>`;
      const inp = $('pIn'); if (inp && !P.ans) { inp.oninput = e => { P.val = e.target.value; }; inp.onkeydown = e => { if (e.key === 'Enter') pCheck(); }; }
    }
    tick();
  }
  function pCheck() { const P = V.P, it = P.items[P.i]; if (P.ans || !P.val.trim()) return; P.ok = check(it.q, P.val); P.ans = true; if (P.ok) P.score++; else P.fails.push(it); recordGen(it.q.g, P.ok); render(); }
  const pAdvance = () => { const P = V.P; P.i++; P.shown = false; P.ans = false; P.val = ''; render(); };
  function probeResult(el) {
    const P = V.P, total = P.items.length, p = pct(P.score, total), fc = P.fails.filter(f => f.t === 'c'), fg = P.fails.filter(f => f.t === 'g');
    el.innerHTML = `<div class="ln-card glass ln-count"><b>${P.score} / ${total}</b><span>${p} %</span><small>${p >= 75 ? 'Stark, das sitzt.' : p >= 50 ? 'Über der Bestehensgrenze (50 %). Jetzt gezielt die Fehler schließen.' : 'Unter 50 %: Fehlerkarten (Box 1) heute noch durchgehen und dann nochmal Probe.'}</small></div>
      ${fc.length ? `<div class="ln-card glass"><h3>Falsche Karten (jetzt in Box 1)</h3>${fc.map(f => `<div class="ln-fail ln-html"><b>${clean(f.c.q)}</b><br>${clean(f.c.a)}</div>`).join('')}</div>` : ''}
      ${fg.length ? `<div class="ln-card glass"><h3>Falsche Rechnungen</h3>${fg.map(f => `<div class="ln-fail"><b>${esc(f.q.g.title)}</b>: ${esc(f.q.q)}<br>→ ${fmt(f.q.ans, f.q.dec == null ? 2 : f.q.dec)} ${esc(f.q.unit || '')}<div class="ln-sub">${clean(f.q.sol)}</div></div>`).join('')}</div>` : ''}
      ${!fc.length && !fg.length ? '<div class="ln-empty">Keine Fehler. Sehr gut.</div>' : ''}
      <button class="ln-btn big" type="button" data-act="pagain">Neue Probe</button>`;
  }

  // ===== Dateien =====
  const FILES = [['netz', 'Netzwerktechnik', 'Lernmappe offline'], ['elek', 'Elektrotechnik', 'Lernmappe offline'], ['wiso', 'WiSO', 'Lernmappe offline']];
  const ext = n => (n.split('.').pop() || '').slice(0, 4).toUpperCase();
  async function loadFiles() {
    try { V.files = (await pb.collection('lern_dateien').getFullList({ requestKey: null })).reverse(); try { V.token = await pb.files.getToken(); } catch (_) {} }
    catch (_) { V.files = V.files || []; V.filesErr = true; }
    if (view === 'dateien') render();
  }
  const fileUrl = (r, o) => pb.files.getURL(r, r.datei, o || {});
  function vDateien(el) {
    if (V.files === null) { el.innerHTML = '<div class="ln-empty">Lade …</div>'; loadFiles(); return; }
    const fl = V.fFilter || 'alle', list = V.files.filter(r => fl === 'alle' || r.bereich === fl);
    el.innerHTML = `<div class="ln-card glass" style="display:flex;flex-direction:column;gap:8px"><h3 style="margin:0">Lernmappen (offline)</h3>
        ${FILES.map(([k, n, s]) => `<div class="ln-file"><div class="ln-fi">HTML</div><div class="ln-sp"><div class="ln-tt">${n}</div><div class="ln-tm">${s}</div></div><a class="ln-go" href="/lernen/files/${k}.html" target="_blank" rel="noopener">Öffnen</a><a class="ln-go" href="/lernen/files/${k}.html" download="${k}.html">Laden</a></div>`).join('')}</div>
      <div class="ln-card glass" style="display:flex;flex-direction:column;gap:8px"><h3 style="margin:0">Lesen</h3>
        ${[['struktur', 'Prüfungsstruktur', 'Teile, Dauer, Gewichtung, Bestehen'], ['methoden', 'Lernmethoden', 'Was beim Lernen wirklich hilft']].map(([k, n, s]) => `<button class="ln-file" type="button" data-act="doc" data-d="${k}" style="width:100%;text-align:left;border:0;background:none"><div class="ln-fi">MD</div><div class="ln-sp"><div class="ln-tt">${n}</div><div class="ln-tm">${s}</div></div><span class="ln-go">Lesen</span></button>${V.doc === k ? `<div class="ln-doc ln-html">${clean(DATA.docs[k])}</div>` : ''}`).join('')}</div>
      <div class="ln-card glass" style="display:flex;flex-direction:column;gap:10px"><h3 style="margin:0">Meine Dateien</h3>
        <div class="ln-seg">${['alle', ...AREA_ORDER].map(a => `<button type="button" data-act="ffilter" data-a="${a}" class="${fl === a ? 'on' : ''}">${a === 'alle' ? 'Alle' : AREAS[a]}</button>`).join('')}</div>
        ${V.filesErr && !V.files.length ? '<div class="ln-sub">Nicht erreichbar (offline?).</div>' : ''}
        ${list.length ? list.map(r => { const img = /\.(jpe?g|png|webp|gif)$/i.test(r.datei); return `<div class="ln-file"><div class="ln-fi">${img ? `<img alt="" src="${fileUrl(r, { thumb: '100x100', token: V.token })}" onerror="this.remove()">` : ext(r.datei)}</div>
          <div class="ln-sp"><div class="ln-tt">${esc(r.titel)}</div><div class="ln-tm">${r.bereich && r.bereich !== 'alle' ? esc(AREAS[r.bereich]) : 'Allgemein'}</div></div>
          <button class="ln-go" type="button" data-act="fopen" data-id="${r.id}">Ansehen</button><button class="ln-go" type="button" data-act="fdl" data-id="${r.id}">Laden</button><button class="ln-del" type="button" data-act="fdel" data-id="${r.id}" aria-label="Löschen">${V.sure === r.id ? '?' : '✕'}</button></div>`; }).join('') : '<div class="ln-sub">Noch nichts hochgeladen.</div>'}
        <div class="ln-add" style="margin-top:6px"><input class="ln-input" id="fTitle" placeholder="Titel (optional)" maxlength="150"><div class="ln-row"><select class="ln-input" id="fArea"><option value="alle">Allgemein</option>${AREA_ORDER.map(a => `<option value="${a}">${AREAS[a]}</option>`).join('')}</select>
          <label class="ln-btn soft sm" style="flex:none;cursor:pointer">Datei wählen<input class="sr-only" id="fFile" type="file" accept=".pdf,.xlsx,.xls,.docx,.doc,.csv,.txt,image/*"></label></div>
        <div class="ln-note" id="fMsg">PDF, Bilder, Excel, Word bis 30 MB. Zum Hochladen ist Netz nötig.</div></div></div>`;
    $('fFile').onchange = uploadFile;
  }
  async function uploadFile(e) {
    const f = e.target.files[0], msg = $('fMsg'); if (!f) return;
    if (!navigator.onLine) { msg.textContent = 'Offline: Hochladen geht erst mit Netz.'; return; }
    if (f.size > 31457280) { msg.textContent = 'Datei ist größer als 30 MB.'; return; }
    msg.textContent = 'Lade hoch …';
    const fd = new FormData(); fd.append('user', uid()); fd.append('titel', $('fTitle').value.trim() || f.name.replace(/\.[^.]+$/, '')); fd.append('bereich', $('fArea').value); fd.append('datei', f);
    try { await pb.collection('lern_dateien').create(fd, { requestKey: null }); V.files = null; render(); }
    catch (x) { msg.textContent = 'Hat nicht geklappt: ' + (x?.response?.data?.datei?.message || x?.message || 'Fehler'); }
  }
  async function openFile(id, dl) {
    const r = V.files.find(x => x.id === id); if (!r) return;
    const w = dl ? null : window.open('about:blank', '_blank');
    try {
      const tk = await pb.files.getToken(), url = fileUrl(r, { token: tk, download: dl ? 1 : undefined });
      if (w) w.location = url; else { const a = document.createElement('a'); a.href = url; a.download = r.datei; document.body.append(a); a.click(); a.remove(); }
    } catch (_) { w?.close(); }
  }

  // ---------- Klicks ----------
  function onClick(e) {
    const v = e.target.closest('[data-v]'); if (v) { go(v.dataset.v); return; }
    const b = e.target.closest('[data-act]'); if (!b) return;
    const d = b.dataset, act = d.act;
    const todo = () => ST.T.find(t => t.key === d.k);
    switch (act) {
      case 'who': pickWho(d.w); break;
      case 'whoback': showWho(); break;
      case 'startdue': V.kf = { area: 'alle', sec: 'all', secs: null, mode: 'due', must: false }; V.ses = null; view = 'karten'; startSession(); break;
      case 'ring': V.kf = { area: d.a, sec: 'all', secs: null, mode: 'due', must: false }; V.ses = null; go('karten'); break;
      case 'chk': { const t = todo(); if (!t) break; t.done = !t.done; t.doneAt = t.done ? new Date().toISOString() : ''; persist(); enqueue('lern_todos', t.custom ? null : 'planId', t.key, todoData(t)); render(); break; }
      case 'del': { const t = todo(); if (!t) break; ST.T = ST.T.filter(x => x !== t); enqueue('lern_todos', null, t.key, null, true); render(); break; }
      case 'tdnew': V.tdOpen = true; render(); break;
      case 'tdcancel': V.tdOpen = false; render(); break;
      case 'tdsave': {
        const title = $('tdTitle').value.trim(); if (!title) { $('tdTitle').focus(); break; }
        const t = { key: 'c' + Date.now().toString(36), planId: '', title, date: $('tdDate').value || '', area: $('tdArea').value, done: false, doneAt: '', custom: true };
        ST.T.push(t); enqueue('lern_todos', null, t.key, todoData(t)); V.tdOpen = false; V.add = { title: '', date: dstr(), area: 'alle' }; render(); break;
      }
      case 'go': planGo(planOf(d.k) || planOf(todo()?.planId)); break;
      case 'sec': { const o = V.st.open; o.has(d.sk) ? o.delete(d.sk) : o.add(d.sk); $('lnStList').innerHTML = stoffList(); break; }
      case 'read': { ST.S[d.sk] = !ST.S[d.sk]; enqueue('lern_stoff', 'sectionId', d.sk, { gelesen: !!ST.S[d.sk] }); $('lnStList').innerHTML = stoffList(); const rd = AREA_ORDER; document.querySelectorAll('[data-act=starea]').forEach(x => x.textContent = `${AREAS[x.dataset.a]} ${DATA.areas[x.dataset.a].sections.filter(s => ST.S[x.dataset.a + ':' + s.id]).length}/${DATA.areas[x.dataset.a].sections.length}`); break; }
      case 'starea': V.st.area = d.a; V.st.focus = null; render(); break;
      case 'unfocus': V.st.focus = null; render(); break;
      case 'kfarea': V.kf.area = d.a; V.kf.sec = 'all'; V.kf.secs = null; render(); break;
      case 'kstart': startSession(); break;
      case 'kend': V.ses = null; render(); break;
      case 'kflip': { const S = V.ses, k = $('lnKc'); if (S && k) { S.flip = !S.flip; k.classList.toggle('flip', S.flip); } break; }
      case 'krate': rateCard(+d.l, b); break;
      case 'ksel': { const S = V.ses, l = +d.l, i = S.sel.indexOf(l); if (i >= 0) { if (S.sel.length === 1) { const k = $('lnKK'); if (k) { k.classList.remove('wig'); void k.offsetWidth; k.classList.add('wig'); } break; } S.sel.splice(i, 1); } else S.sel.push(l); S.deck = null; render(); break; }
      case 'kagain': V.ses.deck = null; V.ses.n = [0, 0, 0]; render(); break;
      case 'day': { const o = V.pl.open; o.has(d.d) ? o.delete(d.d) : o.add(d.d); const e = $('lnDays'); if (e) e.innerHTML = daysHtml(); break; }
      case 'pqarea': V.pq.area = d.a; pqRefresh(); break;
      case 'pqonly': V.pq.only = !V.pq.only; pqRefresh(); break;
      case 'pqunfocus': V.pq.focus = null; V.pq.o = new Set(); pqRefresh(); break;
      case 'pqsec': { const o = V.pq.o; o.has(d.sk) ? o.delete(d.sk) : o.add(d.sk); pqRefresh(); break; }
      case 'pqt': { const o = V.pq.t; o.has(d.id) ? o.delete(d.id) : o.add(d.id); pqRefresh(); break; }
      case 'pqsol': { const t = PQ.byId[d.id], sl = V.pq.sol; if (!t) break; if (sl.has(d.id)) sl.delete(d.id); else { sl.add(d.id); if (!pqSeen(t)) pqMark(t, true); } pqRefresh(); break; }
      case 'pqseen': { const t = PQ.byId[d.id]; if (!t) break; pqMark(t, !pqSeen(t)); pqRefresh(); break; }
      case 'rarea': V.r.area = d.a; V.r.sel = 'mix'; V.r.ids = null; V.r.val = ''; newR(); render(); break;
      case 'rcheck': rCheck(); break;
      case 'rnext': newR(); V.r.val = ''; render(); break;
      case 'pfarea': V.pf.area = d.a; render(); break;
      case 'pstart': probeStart(); break;
      case 'pshow': V.P.shown = true; render(); break;
      case 'pyes': V.P.score++; pAdvance(); break;
      case 'pno': V.P.fails.push(V.P.items[V.P.i]); pAdvance(); break;
      case 'pcheck': pCheck(); break;
      case 'pnext': pAdvance(); break;
      case 'pagain': clearInterval(V.ptimer); V.P = null; render(); break;
      case 'doc': V.doc = V.doc === d.d ? '' : d.d; render(); break;
      case 'ffilter': V.fFilter = d.a; render(); break;
      case 'fopen': openFile(d.id, false); break;
      case 'fdl': openFile(d.id, true); break;
      case 'fdel':
        if (V.sure !== d.id) { V.sure = d.id; render(); setTimeout(() => { if (V.sure === d.id) { V.sure = null; if (view === 'dateien') render(); } }, 3000); break; }
        V.sure = null; pb.collection('lern_dateien').delete(d.id, { requestKey: null }).then(() => { V.files = null; render(); }).catch(() => { V.files = null; render(); }); break;
    }
  }
  // „Los“ aus dem Plan: springt zum passenden Ziel
  function planGo(pt) {
    if (!pt) return;
    const a = pt.area, t = pt.target || {};
    if (pt.action === 'stoff') { V.st = { area: AREAS[a] ? a : 'elek', q: '', focus: t.sections ? { area: a, ids: t.sections } : null, open: new Set((t.sections || []).map(id => a + ':' + id)) }; go('stoff'); }
    else if (pt.action === 'karten') { V.kf = { area: AREAS[a] ? a : 'alle', sec: 'all', secs: t.sections || null, mode: t.mode || 'due', must: false }; V.ses = null; view = 'karten'; startSession(); }
    else if (pt.action === 'pruef') { V.pq.area = AREAS[a] ? a : 'elek'; V.pq.focus = t.sections ? { area: a, ids: t.sections } : null; V.pq.only = !!t.only; V.pq.o = new Set((t.sections || []).map(id => a + ':' + id)); go('pruef'); }
    else if (pt.action === 'rechnen') { V.r = { area: AREAS[a] ? a : 'elek', sel: 'mix', ids: t.generators || null, cur: null, done: false, val: '' }; go('rechnen'); }
    else if (pt.action === 'probe') { V.pf = { area: AREAS[a] ? a : 'alle', cards: t.cards || 15, calc: t.calc || 5, min: t.minutes || 40, must: !!t.onlyMust }; if (!V.P) go('probe'); else go('probe'); }
  }

  // ---------- Start ----------
  function updateEntry() {
    const show = !!uid() && !off();
    const tile = $('lnTile'); if (tile) tile.hidden = !show;
    const card = $('lnSetCard'); if (card) { card.hidden = !uid(); const sw = $('lnSwitch'); if (sw) sw.checked = !off(); }
    return show;
  }
  // Profilwahl: „Wer lernt?“ – Daniel hat die Lernmappen, Ida bekommt ihren Bereich später
  function showWho() {
    V.who = null; clearInterval(V.ptimer); window.WIR_ENGLISCH?.unmount();
    $('lnNav').innerHTML = ''; $('lnNav').classList.remove('solo'); $('lnSync').hidden = true; const wb = $('lnWhoBtn'); if (wb) wb.hidden = true;
    const card = (w, n, sub) => `<button class="ln-who glass" type="button" data-act="who" data-w="${w}"><span class="ln-av">${n[0]}</span><b>${n}</b><small>${sub}</small></button>`;
    body().innerHTML = '<div class="ln-big" style="font-size:24px">Wer lernt?</div><div class="ln-whos">' + card('daniel', 'Daniel', 'AP2-Prüfung 25.11.') + card('ida', 'Ida', 'Dein Bereich') + '</div>';
  }
  async function pickWho(w) {
    const wb = $('lnWhoBtn'); if (wb) wb.hidden = false;
    $('lnNav').innerHTML = '';
    if (w === 'ida') {                                   // Idas Bereich: Reiter „Englisch“ (englisch.js, Vokabeln)
      V.who = 'ida'; $('lnNav').classList.add('solo'); $('lnNav').innerHTML = '<button type="button" class="on">Englisch</button>';
      if (window.WIR_ENGLISCH) window.WIR_ENGLISCH.mount(body()); else body().innerHTML = '<div class="ln-empty">Englisch konnte nicht geladen werden.</div>';
      return;
    }
    if (!isDaniel()) { V.who = 'x'; body().innerHTML = '<div class="ln-card glass ln-count"><b style="font-size:40px">Daniel</b><span>Das ist Daniels Lernbereich.</span><small>Er ist privat.</small></div>'; return; }
    V.who = 'daniel';
    if (!ready) {
      body().innerHTML = '<div class="ln-empty">Lade …</div>';
      try { await init(); } catch (e) { body().innerHTML = '<div class="ln-empty">Konnte nicht geladen werden. Bitte einmal mit Netz öffnen.</div>'; return; }
    }
    render(); sync(true);
  }
  function open() { if (off()) { UI.show('s-home'); return; } showWho(); }

  document.addEventListener('click', e => { if (e.target.closest('#s-lernen')) onClick(e); });
  document.addEventListener('change', e => {
    if (e.target.id === 'lnSwitch') { try { localStorage.setItem(OFF_KEY, e.target.checked ? '0' : '1'); } catch (_) {} updateEntry(); }
    if (e.target.id === 'tdTitle' || e.target.id === 'tdDate' || e.target.id === 'tdArea') V.add = { title: $('tdTitle').value, date: $('tdDate').value, area: $('tdArea').value };
  });
  document.addEventListener('wir:show', e => { if (e.detail === 's-lernen') open(); else if (e.detail === 's-home' || e.detail === 's-settings') updateEntry(); });
  document.addEventListener('wir:started', () => { updateEntry(); if (isDaniel()) flush(); });
  document.addEventListener('wir:users', updateEntry);
  window.addEventListener('online', () => { if (ready) { flush().then(() => ready && view !== 'karten' && render()); } banner(); });
  window.addEventListener('offline', banner);
  updateEntry();
})();
