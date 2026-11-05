// Zuhause – Datenschicht. Die Oberfläche (zuhause.js) kennt nur dieses Interface, nicht den Transport:
//
//   const t = ZuhauseData.create('wir');   // jetzt: über PocketBase + Dienst wir-home
//   t.start(onChange)    Abos starten (genau einmal, auch bei mehrfachem Aufruf); onChange(state) bei jeder Änderung
//   t.stop()             alle Abos beenden (auch wenn start() noch läuft)
//   await t.call({ entity_id, service, data, scene, log })     Befehl; wirft Error(.message) bei Ablehnung/Fehler
//   t.todos.add({ list, text, who }) / .update(id, patch) / .remove(id)
//   t.settings.save(key, data)
//   t.state = { config, entities: { [entity_id]: { state, a, changed } }, meta, klima, wetter, kalender, tv (Titel per ADB),
//               todos: [ { id, list, text, note, who, done } ], settings: { [key]: data } }
//
// Später kommt 'ha-direct' dazu (eigenständige Seite für das Wandtablet, spricht direkt per WebSocket mit Home
// Assistant und dem normalen HA-Login, siehe home/export/README.md). Es muss nur dasselbe Interface liefern.
(() => {
  // ---------------- Transport "wir": PocketBase (home_state, home_todos, home_settings) + POST /api/home/cmd ----------------
  function wirTransport() {
    const pb = window.WIR_PB;
    const state = { config: null, entities: {}, meta: null, klima: null, wetter: null, kalender: null, tv: null, tvx: null, shot: null, todos: [], settings: {} };
    let onChange = () => {}, unsubs = [], gen = 0, raf = 0;

    const changed = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; onChange(state); }); };
    // Bildschirmfoto vom Fernseher (home_logos "_bildschirm", geschützte Datei): nur laden, wenn ein neues da ist
    let shotAt = '', shotBusy = false;
    async function shotSoon() {
      const at = state.tvx?.bildschirm?.at || '';
      // nur frische Fotos (gerade angefordert) – kein altes Foto bei jedem Öffnen laden
      if (!at || at === shotAt || shotBusy || !unsubs.length || Date.now() - Date.parse(at) > 120000) return;
      shotBusy = true;
      try {
        const r = await pb.collection('home_logos').getFirstListItem('paket="_bildschirm"', { requestKey: null });
        const token = await pb.files.getToken({ requestKey: null });
        const res = await fetch(pb.files.getURL(r, r.bild, { token }));
        if (res.ok) {
          if (state.shot) URL.revokeObjectURL(state.shot.url);
          state.shot = { url: URL.createObjectURL(await res.blob()), at };
          shotAt = at;
          changed();
        }
      } catch (_) { /* nächster Versuch beim nächsten Stand */ }
      finally { shotBusy = false; if ((state.tvx?.bildschirm?.at || '') !== shotAt) setTimeout(shotSoon, 3000); }
    }
    function applyState(rec, deleted) {
      const k = rec.key, d = deleted ? null : rec.data;
      if (k === '_config') state.config = d;
      else if (k === '_meta') state.meta = d;
      else if (k === '_klima') state.klima = d;
      else if (k === '_wetter') state.wetter = d;
      else if (k === '_kalender') state.kalender = d;
      else if (k === '_tv') state.tv = d;
      else if (k === '_tvx') { state.tvx = d; shotSoon(); }
      else if (deleted) delete state.entities[k];
      else state.entities[k] = d;
    }
    const slimTodo = r => ({ id: r.id, list: r.list, text: r.text, note: r.note, who: r.who || 'g', done: !!r.done, created: r.created });
    function applyTodo(rec, action) {
      const i = state.todos.findIndex(t => t.id === rec.id);
      if (action === 'delete') { if (i >= 0) state.todos.splice(i, 1); return; }
      if (i >= 0) state.todos[i] = slimTodo(rec); else state.todos.push(slimTodo(rec));
    }

    async function loadAll(my) {
      const [hs, td, st] = await Promise.all([
        pb.collection('home_state').getFullList({ batch: 200, requestKey: null }),
        pb.collection('home_todos').getFullList({ batch: 200, sort: 'created', requestKey: null }),
        pb.collection('home_settings').getFullList({ batch: 50, requestKey: null }),
      ]);
      if (my !== gen) return;
      state.entities = {};
      for (const r of hs) applyState(r, false);
      state.todos = td.map(slimTodo);
      state.settings = Object.fromEntries(st.map(r => [r.key, r.data]));
      settingIds = Object.fromEntries(st.map(r => [r.key, r.id]));
      onChange(state);
    }
    let settingIds = {};

    return {
      name: 'wir',
      state,
      async start(cb) {
        onChange = cb || onChange;
        if (unsubs.length || this.starting) return this.starting;
        const my = ++gen;
        this.starting = (async () => {
          const subs = await Promise.all([
            pb.collection('home_state').subscribe('*', e => { applyState(e.record, e.action === 'delete'); changed(); }),
            pb.collection('home_todos').subscribe('*', e => { applyTodo(e.record, e.action); changed(); }),
            pb.collection('home_settings').subscribe('*', e => { state.settings[e.record.key] = e.record.data; settingIds[e.record.key] = e.record.id; changed(); }),
          ]);
          // stop() kam während des Starts -> sofort wieder abmelden (keine verwaisten Abos)
          if (my !== gen) { subs.forEach(u => Promise.resolve(u()).catch(() => {})); return; }
          unsubs = subs;
          await loadAll(my);
        })().finally(() => { this.starting = null; });
        return this.starting;
      },
      stop() {
        gen++;
        // unsubscribe() liefert ein Promise – Fehler (z. B. abgelaufene Realtime-Verbindung beim schnellen Wechsel) abfangen
        unsubs.forEach(u => { try { Promise.resolve(u()).catch(() => {}); } catch (_) {} });
        unsubs = [];
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
      },
      async refresh() { if (unsubs.length) await loadAll(gen); },
      async call(cmd) {
        try {
          return await pb.send('/api/home/cmd', { method: 'POST', body: cmd, requestKey: null });
        } catch (err) {
          const e = new Error(err?.response?.message || err?.message || 'Fehler');
          e.status = err?.status;
          throw e;
        }
      },
      todos: {
        add: t => pb.collection('home_todos').create({ list: t.list, text: t.text, note: t.note || '', who: t.who || 'g', done: false }, { requestKey: null }),
        update: (id, patch) => pb.collection('home_todos').update(id, patch, { requestKey: null }),
        remove: id => pb.collection('home_todos').delete(id, { requestKey: null }),
      },
      settings: {
        async save(key, data) {
          state.settings[key] = data;
          if (settingIds[key]) return pb.collection('home_settings').update(settingIds[key], { data }, { requestKey: null });
          try { settingIds[key] = (await pb.collection('home_settings').create({ key, data }, { requestKey: null })).id; }
          catch (err) {
            // gibt es schon (die andere Person war schneller) -> aktualisieren
            const r = await pb.collection('home_settings').getFirstListItem(pb.filter('key = {:k}', { k: key }), { requestKey: null });
            settingIds[key] = r.id;
            await pb.collection('home_settings').update(r.id, { data }, { requestKey: null });
          }
        },
      },
    };
  }

  const TRANSPORTS = { wir: wirTransport };
  window.ZuhauseData = {
    create(kind = 'wir') {
      const f = TRANSPORTS[kind];
      if (!f) throw new Error('Unbekannter Transport: ' + kind);
      return f();
    },
    register(kind, factory) { TRANSPORTS[kind] = factory; },
  };
})();
