// Chat zu zweit (Echtzeit): Text, Emojis, Bilder, Antworten, Reaktionen, Gelesen-Status, „schreibt …“, Ungelesen-Badge.
// Zugang über 💬 oben rechts im Kopf. Lesen/Schreiben regelt der Server (chat_messages nur für die beiden; Empfänger,
// gelesen und Reaktionen setzt nur der Server, pb_hooks/wir_chat.pb.js). Push nur, wenn innerhalb von 15 s nicht gelesen.
(() => {
  const pb = window.WIR_PB;
  const $ = id => document.getElementById(id);
  const myId = () => (pb.authStore.record || pb.authStore.model)?.id;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const pbMs = s => s ? Date.parse(String(s).replace(' ', 'T')) : 0;
  const pad = n => String(n).padStart(2, '0');
  const REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥', '🥰'];
  const PAGE = 60;
  let msgs = [], started = false, token = '', replyTo = null, unread = 0, more = true, typingUntil = 0;

  // PC (ab 1100 px): Chat kann rechts angedockt bleiben, während man woanders ist
  const wide = matchMedia('(min-width: 1100px)');
  let docked = false;
  try { docked = localStorage.getItem('wir-chat-dock') === '1'; } catch (_) {}
  const dockedNow = () => docked && wide.matches && document.body.classList.contains('in-app');
  const visible = () => $('s-chat').classList.contains('active') || dockedNow();
  const isOpen = () => visible() && !document.hidden;
  async function refreshToken() { try { token = await pb.files.getToken(); } catch (_) {} }

  async function load(older) {
    await refreshToken();
    const before = older && msgs.length ? msgs[0].created : null;
    const r = await pb.collection('chat_messages').getList(1, PAGE, { sort: '-created', filter: before ? pb.filter('created < {:t}', { t: before }) : '' });
    const got = r.items.reverse();
    msgs = older ? [...got, ...msgs] : got;
    more = r.totalItems > msgs.length;
    render(!older);
    countUnread();
  }

  async function countUnread() {
    const r = await pb.collection('chat_messages').getList(1, 1, { filter: pb.filter("to = {:me} && read_at = ''", { me: myId() }), fields: 'id' }).catch(() => null);
    unread = r?.totalItems || 0;
    if (isOpen() && unread) return markRead();
    $('chatBadge').hidden = !unread;
    $('chatBadge').textContent = unread > 9 ? '9+' : String(unread);
  }
  let readT = 0;
  function markRead() {
    clearTimeout(readT);
    readT = setTimeout(async () => { await pb.send('/api/chat/read', { method: 'POST' }).catch(() => {}); unread = 0; $('chatBadge').hidden = true; }, 300);
  }

  // ======================================================================
  // Anzeige
  // ======================================================================
  const dayKey = ms => new Date(ms).toDateString();
  function dayLabel(ms) {
    const d = new Date(ms), t = new Date();
    const y = new Date(); y.setDate(y.getDate() - 1);
    if (d.toDateString() === t.toDateString()) return 'Heute';
    if (d.toDateString() === y.toDateString()) return 'Gestern';
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  }

  function bubble(m) {
    const mine = m.from === myId();
    const row = el('div', 'cm-row' + (mine ? ' mine' : ''));
    row.dataset.id = m.id;
    const b = el('div', 'cm-bubble');
    if (m.reply_to) {
      const o = msgs.find(x => x.id === m.reply_to);
      const q = el('div', 'cm-quote', o ? (o.text || '📷 Bild').slice(0, 80) : 'Nachricht');
      q.addEventListener('click', () => document.querySelector(`.cm-row[data-id="${m.reply_to}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      b.append(q);
    }
    if (m.image) {
      const i = el('img', 'cm-img'); i.alt = ''; i.loading = 'lazy';
      i.src = pb.files.getURL(m, m.image, { thumb: '400x0', token });
      i.addEventListener('click', e => { e.stopPropagation(); UI.lightbox(pb.files.getURL(m, m.image, { token }), m.text || ''); });
      b.append(i);
    }
    if (m.text) b.append(el('div', 'cm-text', m.text));
    const d = new Date(pbMs(m.created));
    const meta = el('div', 'cm-meta', `${pad(d.getHours())}:${pad(d.getMinutes())}`);
    if (mine) meta.append(el('span', 'cm-tick' + (m.read_at ? ' read' : ''), m.read_at ? ' ✓✓' : ' ✓'));
    b.append(meta);
    const re = Object.values(m.reactions || {});
    if (re.length) b.append(el('div', 'cm-react', re.join('')));
    row.append(b);
    longPress(b, () => actions(m));
    b.addEventListener('dblclick', () => react(m, '❤️')); // Doppeltipp = Herz
    return row;
  }

  function render(stick) {
    const box = $('chatList');
    const atBottom = stick || box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    const prevH = box.scrollHeight;
    const out = [];
    if (more) { const b = el('button', 'link-btn cm-older', 'Ältere Nachrichten'); b.type = 'button'; b.addEventListener('click', () => load(true)); out.push(b); }
    let day = '';
    for (const m of msgs) {
      const ms = pbMs(m.created);
      if (dayKey(ms) !== day) { day = dayKey(ms); out.push(el('div', 'cm-day', dayLabel(ms))); }
      out.push(bubble(m));
    }
    if (!msgs.length) out.push(el('div', 'empty-note', `Schreib ${window.WIR_LOOK?.partner()?.name || 'deinem Schatz'} etwas Liebes 💌`));
    box.replaceChildren(...out);
    if (atBottom) box.scrollTop = box.scrollHeight; else if (!stick) box.scrollTop += box.scrollHeight - prevH;
  }

  function longPress(node, fn) {
    let t = 0;
    node.addEventListener('pointerdown', () => { t = setTimeout(() => { t = -1; navigator.vibrate?.(10); fn(); }, 450); });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel', 'pointermove']) node.addEventListener(ev, () => { if (t > 0) clearTimeout(t); });
    node.addEventListener('contextmenu', e => { e.preventDefault(); fn(); });
  }

  // Aktionen zu einer Nachricht (gedrückt halten)
  let actMsg = null;
  function actions(m) {
    actMsg = m;
    $('cmReacts').replaceChildren(...REACTIONS.map(e => {
      const b = el('button', 'cm-r' + ((m.reactions || {})[myId()] === e ? ' on' : ''), e);
      b.type = 'button';
      b.addEventListener('click', () => { UI.sheet('chatActSheet', false); react(m, e); });
      return b;
    }));
    $('cmDel').hidden = m.from !== myId();
    UI.sheet('chatActSheet');
  }
  async function react(m, e) {
    if (!m) return;
    try { const r = await pb.send(`/api/chat/${m.id}/react`, { method: 'POST', body: { emoji: e } }); Object.assign(m, r); render(); } catch (err) { alert(UI.errText(err)); }
  }
  $('cmReply').addEventListener('click', () => { UI.sheet('chatActSheet', false); setReply(actMsg); });
  $('cmCopy').addEventListener('click', () => { UI.sheet('chatActSheet', false); try { navigator.clipboard?.writeText(actMsg?.text || ''); } catch (_) {} });
  $('cmDel').addEventListener('click', async () => {
    UI.sheet('chatActSheet', false);
    if (!actMsg || !confirm('Nachricht löschen?')) return;
    try { await pb.collection('chat_messages').delete(actMsg.id); msgs = msgs.filter(x => x.id !== actMsg.id); render(); } catch (err) { alert(UI.errText(err)); }
  });

  function setReply(m) {
    replyTo = m;
    $('chatReply').hidden = !m;
    if (m) { $('chatReplyText').textContent = (m.text || '📷 Bild').slice(0, 90); $('chatInput').focus(); }
  }
  $('chatReplyX').addEventListener('click', () => setReply(null));

  // ======================================================================
  // Senden
  // ======================================================================
  let sending = false;
  async function send(file) {
    const text = $('chatInput').value.trim();
    if ((!text && !file) || sending) return;
    sending = true;
    try {
      const fd = new FormData();
      fd.append('from', myId());
      fd.append('text', text);
      if (replyTo) fd.append('reply_to', replyTo.id);
      if (file) fd.append('image', await UI.shrink(file, 1600, 0.85), 'bild.jpg');
      $('chatInput').value = '';
      autosize();
      setReply(null);
      const r = await pb.collection('chat_messages').create(fd);
      if (!msgs.some(x => x.id === r.id)) msgs.push(r);
      render(true);
    } catch (err) { alert('Senden ging nicht: ' + UI.errText(err)); }
    sending = false;
  }
  $('chatForm').addEventListener('submit', e => { e.preventDefault(); send(); });
  $('chatInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
  });
  $('chatFile').addEventListener('change', e => { const f = e.target.files[0]; if (f) send(f); e.target.value = ''; });
  function autosize() { const t = $('chatInput'); t.style.height = 'auto'; t.style.height = Math.min(120, t.scrollHeight) + 'px'; }
  let lastTyping = 0;
  $('chatInput').addEventListener('input', () => {
    autosize();
    if (Date.now() - lastTyping > 2500) { lastTyping = Date.now(); pb.send('/api/chat/typing', { method: 'POST' }).catch(() => {}); }
  });

  // „schreibt …“
  function showTyping() {
    typingUntil = Date.now() + 3500;
    $('chatTyping').hidden = false;
    $('chatTyping').textContent = `${window.WIR_LOOK?.partner()?.name || 'Schatz'} schreibt …`;
    setTimeout(() => { if (Date.now() >= typingUntil) $('chatTyping').hidden = true; }, 3600);
  }

  // ======================================================================
  // Start
  // ======================================================================
  document.addEventListener('wir:show', e => {
    document.body.classList.toggle('chat-open', e.detail === 's-chat');
    if (!started) return;
    if (e.detail === 's-chat') { load().then(() => { if (unread) markRead(); }).catch(console.error); setTimeout(() => $('chatList').scrollTop = 1e9, 50); }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && started) (isOpen() ? load() : countUnread()).catch?.(() => {}); });
  document.addEventListener('wir:started', () => {
    started = true;
    if (dockedNow() || (docked && wide.matches)) load().catch(console.error); else countUnread();
    pb.collection('chat_messages').subscribe('*', e => {
      const m = e.record;
      if (e.action === 'delete') msgs = msgs.filter(x => x.id !== m.id);
      else { const i = msgs.findIndex(x => x.id === m.id); if (i >= 0) msgs[i] = m; else if (e.action === 'create') msgs.push(m); }
      if (e.action === 'create' && m.from !== myId()) { $('chatTyping').hidden = true; typingUntil = 0; }
      if (visible()) render();
      countUnread();
    }).catch(console.error);
    pb.realtime.subscribe('chat-typing', d => { if (d?.from && d.from !== myId() && isOpen()) showTyping(); }).catch(() => {});
  });
  function setDock(v) {
    docked = v;
    try { localStorage.setItem('wir-chat-dock', v ? '1' : '0'); } catch (_) {}
    document.body.classList.toggle('chat-docked', v && wide.matches);
    if (v && started) { load().then(() => { if (unread) markRead(); }).catch(console.error); setTimeout(() => $('chatList').scrollTop = 1e9, 50); }
    if (!v && $('s-chat').classList.contains('active')) UI.show('s-home');
  }
  // Am PC schaltet 💬 (und „Chat“ auf Start) das Seitenpanel um, ✕ im Panel schließt es
  document.addEventListener('click', e => {
    if (!wide.matches) return;
    const back = e.target.closest('#s-chat .back-btn');
    if (back && docked) { e.stopImmediatePropagation(); e.preventDefault(); setDock(false); return; }
    if (!e.target.closest('[data-go="s-chat"]')) return;
    e.stopImmediatePropagation(); e.preventDefault();
    setDock(!dockedNow());
    if (docked) $('chatInput').focus();
  }, true);
  wide.addEventListener('change', () => document.body.classList.toggle('chat-docked', docked && wide.matches));
  document.body.classList.toggle('chat-docked', docked && wide.matches);
  window.WIR_CHAT = { open: () => wide.matches ? setDock(true) : UI.show('s-chat') };
})();
