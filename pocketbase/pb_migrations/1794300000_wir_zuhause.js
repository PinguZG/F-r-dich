/// <reference path="../pb_data/types.d.ts" />
// Zuhause / Smart Home (04.11.2026) – NUR additiv, eine neue Collection:
//   home_state  ein Datensatz pro Schlüssel: Gerät aus Home Assistant (key = entity_id, z. B. "light.stehlampe")
//               oder Sonderdaten des Dienstes wir-home ("_meta" Verbindung/Testmodus, "_config" Bereiche ohne Geheimnisse,
//               "_klima" 24-h-Verlauf, "_wetter" Open-Meteo-Cache).
// Lesen (auch Realtime) dürfen nur eingeloggte App-Nutzer (Collection users = ihr zwei). Schreiben darf NUR der
// Dienst wir-home als Superuser – alle Schreibregeln sind gesperrt (null). Befehle laufen über POST /api/home/cmd.
migrate((app) => {
  let c;
  try { c = app.findCollectionByNameOrId("home_state"); } catch (_) { c = null; }
  if (c) return;
  const users = '@request.auth.id != "" && @request.auth.collectionName = "users"';
  c = new Collection({
    id: "pbc_wir_homestate", name: "home_state", type: "base",
    listRule: users, viewRule: users, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { id: "hs_key", name: "key", type: "text", max: 120, required: true },
      { id: "hs_data", name: "data", type: "json", maxSize: 200000 },
      { id: "hs_updated", name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX `idx_home_state_key` ON `home_state` (`key`)"],
  });
  app.save(c);
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("home_state")); } catch (_) {}
});
