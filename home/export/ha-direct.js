// Transport "ha-direct" für die eigenständige Zuhause-Seite auf Home Assistant (/config/www). NOCH NICHT GEBAUT.
// Muss dasselbe Interface liefern wie der Transport "wir" in app/zuhause-data.js:
//   state = { config, entities: { [entity_id]: { state, a, changed } }, meta, klima, wetter }
//   start(onChange) -> Promise, stop(), refresh() -> Promise, call({ entity_id, service, data, scene }) -> Promise
// Vorgehen siehe home/export/README.md.
(() => {
  window.ZuhauseData?.register('ha-direct', () => {
    throw new Error('Transport ha-direct ist noch nicht gebaut (siehe home/export/README.md)');
  });
})();
