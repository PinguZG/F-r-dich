// Einkaufsliste (19.11.2026): Zwei-Wege-Abgleich zwischen der Wir-Liste „🛒 Einkauf“ (grocery_entries) und der
// Home-Assistant-To-do-Liste (todo.einkaufsliste) – damit Daniel per Sprachassistent Sachen draufsetzen, abfragen, abhaken kann.
// - Läuft alle 60 s und kurz nach jeder Änderung der To-do-Entität in HA. Nutzt die bestehende HA-Verbindung (kein neues Token).
// - Paare über grocery_entries.ha_uid. Der zuletzt abgeglichene Stand je Paar (Name, erledigt, Angabe) liegt in home_state
//   „_einkauf“ (der Dienst darf wegen ProtectHome keine Dateien schreiben). Daran erkennt der Abgleich, welche Seite sich
//   geändert hat; haben sich beide geändert, gewinnt PocketBase.
// - HA neu (offen) -> in Wir: gleichnamigen Eintrag verknüpfen (erledigten wieder öffnen) oder neu anlegen (Emoji/Kategorie aus
//   dem App-Katalog bzw. grocery_custom, Autor laut Konfiguration -> die Push-Logik in grocery_lib.js greift normal).
// - Wir neu (offen, ohne ha_uid) -> in HA anlegen. Abhaken und Löschen in beide Richtungen (nur verknüpfte Einträge).
// - Angabe (spec) <-> description nur, wenn die HA-Liste Beschreibungen kann (supported_features & 64).
// - HA getrennt / Fehler: nichts löschen, beim nächsten Lauf nachholen. Fehler nur ins Log (gleiche Meldung nur einmal).
'use strict';
const fs = require('fs');
const conf = require('./config');
const { norm, find } = require('../app/lib/grocery-catalog.js');

const EVERY_MS = 60000;
const SET_DESCRIPTION = 64;
const ENTRIES = '/api/collections/grocery_entries/records';

module.exports = function einkauf({ log, api, configFile, backend, meta, states, store }) {
  // ------------------------------------------------------------ Konfiguration (Abschnitt "einkauf")
  let E = null;
  function readConfig() {
    let raw = {};
    try { raw = conf.parseJsonc(fs.readFileSync(configFile, 'utf8')).einkauf || {}; } catch (err) { log('Einkauf-Konfiguration:', err.message); }
    const entity = typeof raw.entity === 'string' && /^todo\.[a-z0-9_]+$/.test(raw.entity) ? raw.entity : '';
    if (raw.entity && !entity) log('Einkauf-Konfiguration: "entity" muss todo.… sein');
    E = { entity, liste: String(raw.liste || 'Einkauf').trim(), autor: String(raw.autor || '').trim(), an: raw.an !== false && !!entity };
    autorId = '';
  }
  let autorId = '';
  readConfig();

  // zuletzt abgeglichener Stand: uid -> { n: Name, d: erledigt, s: Angabe }
  const saved = store.get();
  const P = saved && typeof saved.items === 'object' && saved.items ? saved.items : {};
  const save = () => store.set({ v: 1, items: P });

  // ------------------------------------------------------------ PocketBase
  async function all(coll, filter = '', sort = '') {
    const out = [];
    for (let page = 1; ; page++) {
      const r = await api('GET', `/api/collections/${coll}/records?page=${page}&perPage=200&skipTotal=1`
        + (filter ? '&filter=' + encodeURIComponent(filter) : '') + (sort ? '&sort=' + sort : ''));
      out.push(...r.items);
      if (r.items.length < 200) return out;
    }
  }
  async function autor() {
    if (autorId) return autorId;
    const users = await all('users', '', 'created');
    let u = users.find(x => x.id === E.autor) || users.find(x => E.autor && norm(x.name) === norm(E.autor));
    if (!u) { u = users[0]; if (u) log('Einkauf: Autor', E.autor || '(leer)', 'nicht gefunden – nehme den ersten Nutzer'); }
    if (!u) throw new Error('kein Nutzer für den Autor');
    return (autorId = u.id);
  }
  async function art(name) {
    const k = find(name);
    if (k) return { name: k.name, emoji: k.emoji, cat: k.cat };   // Schreibweise des Katalogs („brot“ -> „Brot“)
    const own = (await all('grocery_custom')).find(c => norm(c.name) === norm(name));
    return own ? { name: own.name, emoji: own.emoji || '', cat: own.cat || 'sonst' } : { name, emoji: '', cat: 'sonst' };
  }
  const patch = (w, data) => api('PATCH', `${ENTRIES}/${w.id}`, data).then(() => Object.assign(w, data));

  // ------------------------------------------------------------ Home Assistant
  const ha = (service, data) => backend().todo(service, E.entity, data);
  async function haItems() {
    const r = await ha('get_items', {});
    if (!r || !Array.isArray(r.items)) throw new Error('To-do-Liste ' + E.entity + ' nicht lesbar');
    const m = new Map();
    for (const it of r.items) {
      if (!it || !it.uid) continue;
      m.set(String(it.uid), { n: String(it.summary || '').trim().slice(0, 60), d: it.status === 'completed', s: String(it.description || '').trim().slice(0, 40) });
    }
    return m;
  }
  const descOk = () => (Number(states.get(E.entity)?.attributes?.supported_features) & SET_DESCRIPTION) !== 0;
  const snap = w => ({ n: w.name, d: !!w.done, s: w.spec || '' });
  const q = s => '„' + s + '“';

  // ------------------------------------------------------------ Abgleich
  async function sync() {
    const lists = await all('grocery_lists', '', 'order,created');
    const l = lists.find(x => norm(x.name) === norm(E.liste));
    if (!l) throw new Error('Wir-Liste ' + q(E.liste) + ' fehlt');
    const H = await haItems();                       // wirft, wenn HA nicht antwortet -> nichts passiert
    const W = await all('grocery_entries', `list="${l.id}"`, 'created');
    const desc = descOk();
    const byUid = new Map(W.filter(w => w.ha_uid).map(w => [w.ha_uid, w]));
    const used = new Set();                          // in diesem Lauf verknüpfte Wir-Einträge
    const neuHa = [];
    // Sicherung: fehlen in HA auf einmal viele verknüpfte Einträge (≥ 2 und mehr als die Hälfte, z. B. Liste geleert oder
    // neu angelegt) -> in Wir nichts löschen, nur Verknüpfungen lösen (offene werden danach neu in HA angelegt)
    const known = [...byUid.keys()].filter(u => P[u]), gone = known.filter(u => !H.has(u));
    const wipe = gone.length >= 2 && gone.length * 2 > known.length;
    if (wipe) log(`Einkauf: ${gone.length} von ${known.length} Einträgen fehlen in HA – lösche in Wir nichts, offene werden neu übertragen`);

    try {
      for (const uid of new Set([...Object.keys(P), ...H.keys(), ...byUid.keys()])) {
        const h = H.get(uid), w = byUid.get(uid), p = P[uid];
        if (h && w) {
          used.add(w.id);
          const cur = snap(w), wp = {}, hp = {};
          for (const [k, wf, hf] of [['n', 'name', 'rename'], ['d', 'done', 'status'], ...(desc ? [['s', 'spec', 'description']] : [])]) {
            if (cur[k] === h[k] || (k === 'n' && !h.n)) continue;
            if (p && cur[k] === p[k]) wp[wf] = h[k];                                     // nur HA hat sich geändert
            else hp[hf] = k === 'd' ? (cur.d ? 'completed' : 'needs_action') : cur[k];   // Wir (oder beide) -> PocketBase gewinnt
          }
          if (Object.keys(wp).length) { await patch(w, wp); log('Einkauf: HA → Wir', q(w.name), JSON.stringify(wp)); }
          if (Object.keys(hp).length) { await ha('update_item', { item: uid, ...hp }); log('Einkauf: Wir → HA', q(w.name), JSON.stringify(hp)); }
          P[uid] = snap(w);
        } else if (h) {
          if (p) { await ha('remove_item', { item: uid }); delete P[uid]; log('Einkauf: in Wir gelöscht → in HA entfernt', q(h.n)); }
          else if (!h.d && h.n) neuHa.push([uid, h]);   // neu in HA (erledigte neue Einträge bleiben in HA)
        } else if (w) {
          if (p && !wipe) { await api('DELETE', `${ENTRIES}/${w.id}`); log('Einkauf: in HA gelöscht → in Wir entfernt', q(w.name)); }
          else await patch(w, { ha_uid: '' });            // Gegenstück fehlt (oder Sicherung) -> lösen, offene kommen neu nach HA
          delete P[uid];
        } else delete P[uid];
      }

      // neu in HA -> in Wir verknüpfen oder anlegen
      for (const [uid, h] of neuHa) {
        const cand = W.filter(x => !x.ha_uid && !used.has(x.id) && norm(x.name) === norm(h.n));
        let w = cand.find(x => !x.done) || cand[0];
        if (w) {
          const data = { ha_uid: uid };
          if (w.done) data.done = false;
          if (desc && h.s && !w.spec) data.spec = h.s;
          await patch(w, data);
          log('Einkauf: HA → Wir verknüpft', q(w.name), data.done === false ? '(wieder offen)' : '');
        } else {
          const a = await art(h.n);
          w = await api('POST', ENTRIES, { list: l.id, name: a.name.slice(0, 60), emoji: a.emoji, cat: a.cat, spec: desc ? h.s : '', done: false, author: await autor(), ha_uid: uid });
          W.push(w);
          log('Einkauf: HA → Wir neu', q(w.name));
        }
        used.add(w.id);
        // Schreibweise/Angabe der Wir-Seite auch in HA (z. B. „milch“ -> „Milch“)
        const hp = {};
        if (h.n !== w.name) hp.rename = w.name;
        if (desc && h.s !== (w.spec || '')) hp.description = w.spec || '';
        if (Object.keys(hp).length) await ha('update_item', { item: uid, ...hp });
        P[uid] = snap(w);
      }

      // neu in Wir (offen, ohne ha_uid) -> in HA anlegen und uid merken
      const neuWir = W.filter(w => !w.ha_uid && !w.done && !used.has(w.id));
      if (neuWir.length) {
        const before = new Set((await haItems()).keys());
        for (const w of neuWir) {
          await ha('add_item', { item: w.name, ...(desc && w.spec ? { description: w.spec } : {}) });
          log('Einkauf: Wir → HA neu', q(w.name));
        }
        const after = await haItems(), taken = new Set();
        for (const w of neuWir) {
          const hit = [...after.entries()].find(([u, h]) => !before.has(u) && !taken.has(u) && norm(h.n) === norm(w.name));
          if (!hit) continue;                               // findet der nächste Lauf über den Namen
          taken.add(hit[0]);
          await patch(w, { ha_uid: hit[0] });
          P[hit[0]] = snap(w);
        }
      }
    } finally { save(); }
  }

  // ------------------------------------------------------------ Steuerung
  let busy = false, again = false, timer = null, lastErr = '';
  function soon(ms = 1500) { clearTimeout(timer); timer = setTimeout(run, ms); }
  async function run() {
    timer = null;
    if (!E.an || !meta.connected || !backend()?.todo) return;
    if (busy) { again = true; return; }
    busy = true;
    try {
      await sync();
      if (lastErr) log('Einkauf-Abgleich läuft wieder');
      lastErr = '';
    } catch (err) {
      if (err.message !== lastErr) log('Einkauf-Abgleich:', err.message);
      lastErr = err.message;
    } finally {
      busy = false;
      if (again) { again = false; soon(500); }
    }
  }
  setInterval(run, EVERY_MS);

  return { entity: () => (E.an ? E.entity : ''), soon, run, reload: () => { readConfig(); soon(); } };
};
