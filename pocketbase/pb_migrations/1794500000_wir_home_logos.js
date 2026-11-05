/// <reference path="../pb_data/types.d.ts" />
// Zuhause – App-Logos vom Fernseher (05.11.2026) – NUR additiv, eine neue Collection:
//   home_logos  ein Datensatz pro App-Paket (z. B. "com.netflix.ninja"): Banner bzw. Symbol aus dem installierten APK.
// Die Bilddatei ist GESCHÜTZT (protected): nur mit Datei-Token eines eingeloggten Nutzers abrufbar. Lesen dürfen nur
// eingeloggte App-Nutzer (Collection users), schreiben nur der Dienst wir-home als Superuser.
migrate((app) => {
  let c;
  try { c = app.findCollectionByNameOrId("home_logos"); } catch (_) { c = null; }
  if (c) return;
  const users = '@request.auth.id != "" && @request.auth.collectionName = "users"';
  c = new Collection({
    id: "pbc_wir_homelogos", name: "home_logos", type: "base",
    listRule: users, viewRule: users, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { id: "hl_paket", name: "paket", type: "text", max: 120, required: true },
      { id: "hl_version", name: "version", type: "text", max: 40 },
      { id: "hl_art", name: "art", type: "text", max: 20 },
      { id: "hl_breite", name: "breite", type: "number" },
      { id: "hl_hoehe", name: "hoehe", type: "number" },
      { id: "hl_quelle", name: "quelle", type: "text", max: 200 },
      { id: "hl_bild", name: "bild", type: "file", maxSelect: 1, maxSize: 3000000, protected: true,
        mimeTypes: ["image/png", "image/webp", "image/jpeg"] },
      { id: "hl_updated", name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX `idx_home_logos_paket` ON `home_logos` (`paket`)"],
  });
  app.save(c);
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("home_logos")); } catch (_) {}
});
