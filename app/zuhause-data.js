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
    const state = { config: null, entities: {}, meta: null, klima: null, wetter: null, kalender: null, tv: null, logosInfo: null, logos: logoCache, todos: [], settings: {} };
    let onChange = () => {}, unsubs = [], gen = 0, raf = 0;

    const changed = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; onChange(state); }); };
    // Logos nur laden, wenn sich der Stand von wir-home ("_logos".stand) geändert hat
    let logoStand = null, logoBusy = false;
    function logosSoon() {
      const st = state.logosInfo?.stand || '';
      if (st === logoStand || logoBusy || !unsubs.length) return;
      logoBusy = true;
      loadLogos(pb).then(ch => { logoStand = st; if (ch) changed(); }, () => {}).finally(() => { logoBusy = false; if ((state.logosInfo?.stand || '') !== logoStand) logosSoon(); });
    }

    function applyState(rec, deleted) {
      const k = rec.key, d = deleted ? null : rec.data;
      if (k === '_config') state.config = d;
      else if (k === '_meta') state.meta = d;
      else if (k === '_klima') state.klima = d;
      else if (k === '_wetter') state.wetter = d;
      else if (k === '_kalender') state.kalender = d;
      else if (k === '_tv') state.tv = d;
      else if (k === '_logos') { state.logosInfo = d; logosSoon(); }
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

  // ---------------- App-Logos vom Fernseher (Collection home_logos, geschützte Dateien) ----------------
  // Jedes Bild wird genau einmal geladen (als Blob-URL) und bleibt für die ganze Sitzung im Speicher – auch über
  // Aktivierungen von Zuhause hinweg; neu geladen wird nur ein Logo, dessen Datei sich geändert hat.
  const logoCache = new Map();   // paket -> { key, url, farbe, art, w, h }
  // Hauptfarbe: kräftigste Farbtöne gewichtet (graue/fast weiße/schwarze Pixel zählen kaum)
  async function mainColor(blob) {
    try {
      const bmp = await createImageBitmap(blob, { resizeWidth: 32, resizeHeight: 32, resizeQuality: 'medium' });
      const c = document.createElement('canvas'); c.width = c.height = 32;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(bmp, 0, 0); bmp.close?.();
      const d = g.getImageData(0, 0, 32, 32).data;
      let r = 0, gr = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) {
        const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
        const w = (d[i + 3] / 255) * ((mx - mn) / 255) ** 2 * (mx > 40 ? 1 : 0.1);
        r += d[i] * w; gr += d[i + 1] * w; b += d[i + 2] * w; n += w;
      }
      if (n < 0.5) return '';
      // auf volle Leuchtkraft ziehen, damit der Glow trägt
      const f = 255 / Math.max(r / n, gr / n, b / n, 1);
      return '#' + [r, gr, b].map(v => Math.min(255, Math.round(v / n * f)).toString(16).padStart(2, '0')).join('');
    } catch (_) { return ''; }
  }
  async function loadLogos(pb) {
    const recs = await pb.collection('home_logos').getFullList({ batch: 100, requestKey: null });
    let token = null, changed = false;
    for (const r of recs) {
      if (!r.bild) continue;
      const key = r.id + '|' + r.bild;
      if (logoCache.get(r.paket)?.key === key) continue;
      try {
        token = token || await pb.files.getToken({ requestKey: null });
        const res = await fetch(pb.files.getURL(r, r.bild, { token }));
        if (!res.ok) continue;
        const blob = await res.blob();
        const alt = logoCache.get(r.paket);
        if (alt) URL.revokeObjectURL(alt.url);
        logoCache.set(r.paket, { key, url: URL.createObjectURL(blob), farbe: await mainColor(blob), art: r.art, w: r.breite, h: r.hoehe });
        changed = true;
      } catch (_) { /* ohne Logo bleibt die bisherige Kachel */ }
    }
    return changed;
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
