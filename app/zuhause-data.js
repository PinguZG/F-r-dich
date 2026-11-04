// Zuhause – Datenschicht. Die Oberfläche (zuhause.js) kennt nur dieses Interface, nicht den Transport:
//
//   const t = ZuhauseData.create('wir');   // jetzt: über PocketBase + Dienst wir-home
//   t.start(onChange)                       // onChange(state) bei jeder Änderung; state siehe unten
//   t.stop()
//   await t.call({ entity_id, service, data, scene, log })   // wirft Error mit .message bei Ablehnung/Fehler
//   t.state = { config, entities: { [entity_id]: { state, a, changed } }, meta, klima, wetter }
//
// Später kommt 'ha-direct' dazu (eigenständige Seite für das Wandtablet, spricht direkt per WebSocket mit Home
// Assistant und dem normalen HA-Login, siehe home/export/README.md). Es muss nur dasselbe Interface liefern.
(() => {
  // ---------------- Transport "wir": PocketBase-Collection home_state (Realtime) + POST /api/home/cmd ----------------
  function wirTransport() {
    const pb = window.WIR_PB;
    const state = { config: null, entities: {}, meta: null, klima: null, wetter: null };
    let onChange = () => {}, unsub = null, running = false, loading = null;

    function apply(rec, deleted) {
      const k = rec.key;
      if (k === '_config') state.config = deleted ? null : rec.data;
      else if (k === '_meta') state.meta = deleted ? null : rec.data;
      else if (k === '_klima') state.klima = deleted ? null : rec.data;
      else if (k === '_wetter') state.wetter = deleted ? null : rec.data;
      else if (deleted) delete state.entities[k];
      else state.entities[k] = rec.data;
    }

    async function load() {
      const list = await pb.collection('home_state').getFullList({ batch: 200, requestKey: 'zh-load' });
      state.entities = {};
      for (const r of list) apply(r, false);
      onChange(state);
    }

    // Realtime: kleine Änderungen sammeln (mehrere Datensätze in einem Rutsch -> einmal zeichnen)
    let raf = 0;
    const changed = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; onChange(state); }); };

    return {
      name: 'wir',
      state,
      async start(cb) {
        onChange = cb || onChange;
        if (running) return loading;
        running = true;
        loading = (async () => {
          unsub = await pb.collection('home_state').subscribe('*', e => { apply(e.record, e.action === 'delete'); changed(); });
          await load();
        })().catch(err => { running = false; throw err; });
        return loading;
      },
      async refresh() { if (running) await load(); },
      stop() { running = false; if (unsub) { unsub(); unsub = null; } },
      async call(cmd) {
        try {
          return await pb.send('/api/home/cmd', { method: 'POST', body: cmd, requestKey: null });
        } catch (err) {
          const e = new Error(err?.response?.message || err?.message || 'Fehler');
          e.status = err?.status;
          throw e;
        }
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
