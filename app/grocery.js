// Einkaufsliste wie Bring: bunte Kacheln nach Kategorien. Antippen im Katalog = auf die Liste, Antippen auf der Liste =
// gekauft (wandert zu „Zuletzt verwendet“, von dort mit einem Tipp wieder drauf). Gedrückt halten = Angabe (2x, bio, 500 g).
// Mehrere Listen, eigene Artikel, Suche mit Vorschlägen, Live-Sync (Realtime). Push an die andere Person bündelt der Server.
(() => {
  const pb = window.WIR_PB;
  const $ = id => document.getElementById(id);
  const myId = () => (pb.authStore.record || pb.authStore.model)?.id;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  const CATS = [
    ['obst', 'Obst & Gemüse', '🥦'], ['kuehl', 'Kühlregal', '🧀'], ['fleisch', 'Fleisch & Fisch', '🥩'], ['brot', 'Brot & Backwaren', '🥖'],
    ['vorrat', 'Vorrat & Konserven', '🥫'], ['gewuerz', 'Gewürze & Backen', '🧂'], ['suess', 'Süßes & Snacks', '🍫'], ['getraenke', 'Getränke', '🥤'],
    ['tk', 'Tiefkühl', '🧊'], ['haushalt', 'Haushalt', '🧽'], ['drogerie', 'Drogerie', '🧴'], ['sonst', 'Sonstiges', '📦'],
  ];
  const C = (cat, s) => s.split('|').map(x => { const [e, n] = x.split(' ', 2).length === 2 ? [x.split(' ')[0], x.slice(x.indexOf(' ') + 1)] : ['🛒', x]; return { cat, emoji: e, name: n }; });
  const CATALOG = [
    ...C('obst', '🍎 Äpfel|🍌 Bananen|🍐 Birnen|🍇 Trauben|🍓 Erdbeeren|🫐 Heidelbeeren|🍊 Orangen|🍋 Zitronen|🥝 Kiwi|🍉 Wassermelone|🥭 Mango|🍍 Ananas|🥑 Avocado|🍅 Tomaten|🥒 Gurke|🥕 Karotten|🥔 Kartoffeln|🧅 Zwiebeln|🧄 Knoblauch|🫑 Paprika|🥦 Brokkoli|🥬 Salat|🥬 Spinat|🍄 Champignons|🌽 Mais|🥒 Zucchini|🍆 Aubergine|🌿 Basilikum|🌿 Petersilie|🫚 Ingwer|🥬 Rucola|🍠 Süßkartoffeln|🫛 Erbsen|🥬 Lauch|🥗 Blumenkohl'),
    ...C('kuehl', '🥛 Milch|🧈 Butter|🧀 Käse|🧀 Gouda|🧀 Mozzarella|🧀 Feta|🧀 Parmesan|🥚 Eier|🥣 Joghurt|🥣 Quark|🥛 Sahne|🥛 Schmand|🧀 Frischkäse|🥛 Hafermilch|🍮 Pudding|🥟 Tortellini|🧈 Margarine|🌭 Würstchen|🥓 Speck|🍕 Pizzateig'),
    ...C('fleisch', '🍗 Hähnchen|🥩 Hackfleisch|🥩 Steak|🍖 Schnitzel|🐟 Lachs|🍤 Garnelen|🐟 Thunfisch|🥓 Schinken|🍖 Salami|🦃 Putenbrust'),
    ...C('brot', '🍞 Brot|🥖 Baguette|🥐 Croissants|🥯 Brötchen|🍞 Toast|🥨 Brezeln|🫓 Wraps|🍰 Kuchen|🫓 Knäckebrot'),
    ...C('vorrat', '🍝 Nudeln|🍚 Reis|🥫 Tomatensoße|🥫 Passierte Tomaten|🥫 Kidneybohnen|🥫 Kichererbsen|🥫 Mais (Dose)|🫒 Oliven|🥣 Müsli|🥣 Haferflocken|🍯 Honig|🍓 Marmelade|🥜 Erdnussbutter|🍫 Nutella|☕ Kaffee|🍵 Tee|🫙 Linsen|🥫 Suppe|🍜 Ramen|🫒 Olivenöl|🌻 Sonnenblumenöl|🍶 Essig|🍶 Sojasoße|🥫 Ketchup|🥫 Mayo|🥫 Senf'),
    ...C('gewuerz', '🧂 Salz|🌶️ Pfeffer|🌶️ Paprikapulver|🌿 Oregano|🧂 Zucker|🌾 Mehl|🧁 Backpulver|🍫 Kakao|🌰 Nüsse|🍦 Vanillezucker|🥥 Kokosmilch|🧂 Brühe'),
    ...C('suess', '🍫 Schokolade|🍪 Kekse|🍬 Gummibärchen|🍿 Popcorn|🥨 Chips|🥜 Erdnüsse|🍦 Eis|🍩 Donuts|🍫 Riegel|🍭 Bonbons'),
    ...C('getraenke', '💧 Wasser|💧 Sprudel|🧃 Apfelsaft|🧃 Orangensaft|🥤 Cola|🥤 Limo|🍺 Bier|🍷 Wein|🍾 Sekt|🧋 Eistee|☕ Kaffeebohnen|🥤 Energy Drink'),
    ...C('tk', '🍕 Pizza|🍟 Pommes|🥦 TK-Gemüse|🍨 Eiscreme|🫐 TK-Beeren|🐟 Fischstäbchen|🥟 Maultaschen|🍤 TK-Garnelen'),
    ...C('haushalt', '🧻 Toilettenpapier|🧻 Küchenrolle|🧽 Schwämme|🧴 Spülmittel|🫧 Spülmaschinentabs|🧺 Waschmittel|🧺 Weichspüler|🗑️ Müllbeutel|🧹 Putzmittel|💡 Glühbirne|🔋 Batterien|🕯️ Kerzen|🍱 Frischhaltefolie|🧻 Taschentücher|🧯 Alufolie|🧺 Backpapier'),
    ...C('drogerie', '🪥 Zahnpasta|🪥 Zahnbürste|🧴 Shampoo|🧴 Duschgel|🧼 Seife|🧴 Bodylotion|🧴 Deo|🧴 Sonnencreme|🪒 Rasierer|🩹 Pflaster|💊 Schmerztabletten|🧴 Handcreme|💄 Lippenpflege|🧻 Wattepads|🩲 Binden|🧴 Haarspülung|🧴 Gesichtscreme'),
  ];
  const catOf = k => CATS.find(c => c[0] === k) || CATS[CATS.length - 1];
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim();

  let lists = [], listId = '', entries = [], custom = [], started = false, openCats = new Set();
  try { listId = localStorage.getItem('wir-grocery-list') || ''; } catch (_) {}

  async function load() {
    [lists, custom] = await Promise.all([
      pb.collection('grocery_lists').getFullList({ sort: 'order,created' }),
      pb.collection('grocery_custom').getFullList({ sort: 'name' }),
    ]);
    if (!lists.find(l => l.id === listId)) listId = lists[0]?.id || '';
    entries = listId ? await pb.collection('grocery_entries').getFullList({ filter: pb.filter('list = {:l}', { l: listId }), sort: '-updated' }) : [];
    render();
    homeTile();
  }

  // ======================================================================
  // Anzeige
  // ======================================================================
  function tile(item, opts = {}) {
    const [, , cEmoji] = catOf(item.cat);
    const b = el('button', 'gr-tile cat-' + (item.cat || 'sonst') + (opts.cls ? ' ' + opts.cls : ''));
    b.type = 'button';
    b.append(el('span', 'gr-emoji', item.emoji || cEmoji), el('b', '', item.name));
    if (item.spec) b.append(el('small', '', item.spec));
    return b;
  }

  function render() {
    const page = $('s-grocery');
    if (!page) return;
    // Listen
    $('grLists').replaceChildren(...lists.map(l => {
      const b = el('button', 'chip-btn' + (l.id === listId ? ' on' : ''), `${l.emoji || '🛒'} ${l.name}`);
      b.type = 'button';
      b.addEventListener('click', () => { listId = l.id; try { localStorage.setItem('wir-grocery-list', listId); } catch (_) {} load(); });
      return b;
    }), (() => { const b = el('button', 'chip-btn add', '➕ Liste'); b.type = 'button'; b.addEventListener('click', newList); return b; })());
    const cur = lists.find(l => l.id === listId);
    $('grListTools').hidden = !cur || lists.length < 2 && cur?.name === 'Einkauf';
    // Auf der Liste – nach Kategorien
    const open = entries.filter(e => !e.done);
    const box = $('grOpen');
    box.replaceChildren();
    if (!open.length) box.append(el('div', 'empty-note', 'Die Liste ist leer – tippe unten auf etwas, das ihr braucht 🛒'));
    for (const [k, name, emoji] of CATS) {
      const items = open.filter(e => (e.cat || 'sonst') === k);
      if (!items.length) continue;
      box.append(el('div', 'gr-cat', `${emoji} ${name}`));
      const g = el('div', 'gr-grid');
      for (const it of items) {
        const t = tile(it, { cls: 'on' });
        t.addEventListener('click', () => setDone(it, true));
        longPress(t, () => editSpec(it));
        g.append(t);
      }
      box.append(g);
    }
    $('grOpenCount').textContent = open.length ? `${open.length} ${open.length === 1 ? 'Sache' : 'Sachen'}` : '';
    // Zuletzt verwendet
    const recent = entries.filter(e => e.done).slice(0, 18);
    $('grRecentWrap').hidden = !recent.length;
    $('grRecent').replaceChildren(...recent.map(it => { const t = tile(it, { cls: 'recent' }); t.addEventListener('click', () => setDone(it, false)); return t; }));
    renderCatalog();
  }

  function renderCatalog() {
    const q = norm($('grSearch').value);
    const onList = new Set(entries.filter(e => !e.done).map(e => norm(e.name)));
    const all = [...custom.map(c => ({ cat: c.cat || 'sonst', emoji: c.emoji, name: c.name, own: true })), ...CATALOG];
    const box = $('grCatalog');
    box.replaceChildren();
    if (q) {
      const hits = all.filter(i => norm(i.name).includes(q)).sort((a, b) => norm(a.name).indexOf(q) - norm(b.name).indexOf(q)).slice(0, 24);
      const g = el('div', 'gr-grid');
      for (const it of hits) { const t = tile(it, { cls: onList.has(norm(it.name)) ? 'added' : '' }); t.addEventListener('click', () => add(it)); g.append(t); }
      if (!hits.some(h => norm(h.name) === q)) {
        const own = el('button', 'gr-tile new', '');
        own.type = 'button';
        own.append(el('span', 'gr-emoji', '➕'), el('b', '', $('grSearch').value.trim()), el('small', '', 'eigener Artikel'));
        own.addEventListener('click', () => addCustom($('grSearch').value.trim()));
        g.prepend(own);
      }
      box.append(g);
      return;
    }
    for (const [k, name, emoji] of CATS) {
      const items = all.filter(i => i.cat === k);
      if (!items.length) continue;
      const head = el('button', 'gr-cat toggle', `${openCats.has(k) ? '▾' : '▸'} ${emoji} ${name}`);
      head.type = 'button';
      head.addEventListener('click', () => { openCats.has(k) ? openCats.delete(k) : openCats.add(k); renderCatalog(); });
      box.append(head);
      if (!openCats.has(k)) continue;
      const g = el('div', 'gr-grid');
      for (const it of items) { const t = tile(it, { cls: onList.has(norm(it.name)) ? 'added' : '' }); t.addEventListener('click', () => add(it)); g.append(t); }
      box.append(g);
    }
  }
  $('grSearch').addEventListener('input', renderCatalog);
  $('grSearch').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const first = $('grCatalog').querySelector('.gr-tile:not(.new)') || $('grCatalog').querySelector('.gr-tile.new');
    first?.click();
  });

  function longPress(node, fn) {
    let t = 0;
    node.addEventListener('pointerdown', () => { t = setTimeout(() => { t = -1; fn(); }, 550); });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) node.addEventListener(ev, () => { if (t > 0) clearTimeout(t); });
    node.addEventListener('click', e => { if (t === -1) { e.stopImmediatePropagation(); t = 0; } }, true);
    node.addEventListener('contextmenu', e => e.preventDefault());
  }

  // ======================================================================
  // Aktionen
  // ======================================================================
  async function add(it) {
    if (!listId) return;
    const name = it.name;
    const existing = entries.find(e => norm(e.name) === norm(name));
    try {
      if (existing && !existing.done) { pop(); return; }
      if (existing) await pb.collection('grocery_entries').update(existing.id, { done: false });
      else await pb.collection('grocery_entries').create({ list: listId, name, emoji: it.emoji || '', cat: it.cat || 'sonst', author: myId() });
      $('grSearch').value = '';
      pop();
      await load();
    } catch (err) { alert('Ging nicht: ' + UI.errText(err)); }
  }
  async function addCustom(name) {
    if (!name) return;
    try {
      await pb.collection('grocery_custom').create({ name, emoji: '', cat: 'sonst', author: myId() });
      await add({ name, cat: 'sonst', emoji: '' });
    } catch (err) { alert('Ging nicht: ' + UI.errText(err)); }
  }
  async function setDone(it, done) {
    it.done = done; render();
    try { await pb.collection('grocery_entries').update(it.id, { done }); } catch (err) { alert('Ging nicht: ' + UI.errText(err)); }
    load();
  }
  async function editSpec(it) {
    const v = prompt(`Angabe für „${it.name}“ (z. B. 2x, bio, 500 g):`, it.spec || '');
    if (v === null) return;
    try { await pb.collection('grocery_entries').update(it.id, { spec: v.trim().slice(0, 40) }); await load(); } catch (err) { alert('Ging nicht: ' + UI.errText(err)); }
  }
  async function newList() {
    const n = prompt('Name der neuen Liste (z. B. Drogerie):');
    if (!n || !n.trim()) return;
    try {
      const l = await pb.collection('grocery_lists').create({ name: n.trim().slice(0, 40), emoji: '📝', order: lists.length, author: myId() });
      listId = l.id; try { localStorage.setItem('wir-grocery-list', listId); } catch (_) {}
      await load();
    } catch (err) { alert('Ging nicht: ' + UI.errText(err)); }
  }
  $('grRename').addEventListener('click', async () => {
    const cur = lists.find(l => l.id === listId); if (!cur) return;
    const n = prompt('Neuer Name:', cur.name); if (!n || !n.trim()) return;
    await pb.collection('grocery_lists').update(cur.id, { name: n.trim().slice(0, 40) }).catch(err => alert(UI.errText(err)));
    load();
  });
  $('grDelete').addEventListener('click', async () => {
    const cur = lists.find(l => l.id === listId); if (!cur || lists.length < 2) { alert('Die letzte Liste bleibt 💗'); return; }
    if (!confirm(`Liste „${cur.name}“ mit allen Artikeln löschen?`)) return;
    await pb.collection('grocery_lists').delete(cur.id).catch(err => alert(UI.errText(err)));
    listId = ''; load();
  });
  $('grClear').addEventListener('click', async () => {
    const done = entries.filter(e => e.done);
    if (!done.length || !confirm('„Zuletzt verwendet“ leeren?')) return;
    await Promise.all(done.map(e => pb.collection('grocery_entries').delete(e.id))).catch(() => {});
    load();
  });
  function pop() { const r = $('grOpen').getBoundingClientRect(); UI.burst(r.left + r.width / 2, r.top + 30, 8); }

  // Kachel auf Start
  function homeTile() {
    const n = entries.filter(e => !e.done).length;
    if ($('homeGroceryInfo')) $('homeGroceryInfo').textContent = n ? `${n} ${n === 1 ? 'Sache' : 'Sachen'} auf „${lists.find(l => l.id === listId)?.name || 'Einkauf'}“` : 'Alles da – oder doch was vergessen?';
  }

  document.addEventListener('wir:show', e => { if (started && e.detail === 's-grocery') { $('grSearch').value = ''; load().catch(console.error); } });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && started) load().catch(console.error); });
  document.addEventListener('wir:started', () => {
    started = true;
    load().catch(console.error);
    let t = 0;
    const re = () => { clearTimeout(t); t = setTimeout(() => load().catch(console.error), 300); };
    for (const c of ['grocery_entries', 'grocery_lists', 'grocery_custom']) pb.collection(c).subscribe('*', re).catch(console.error);
  });
})();
