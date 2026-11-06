/// <reference path="../pb_data/types.d.ts" />
// Zuhause-Extras (06.11.2026) – NUR additiv, eine neue Collection:
//   home_prefs  persönliche Zuhause-Einstellungen, ein Datensatz pro Person: Haltestelle für die Abfahrten, Verkehrsmittel,
//               Start/Ziel für "Fahrt zu …" (data = { haltestelle: {id,name}, arten: {bus,bahn}, fahrt: {von:{id,name}, nach:{id,name}} }).
// Lesen und schreiben darf NUR die Person selbst (auch nicht die andere). Inhalt prüft pb_hooks/wir_zuhause_extra.pb.js.
migrate((app) => {
  let c;
  try { c = app.findCollectionByNameOrId("home_prefs"); } catch (_) { c = null; }
  if (c) return;
  const own = '@request.auth.collectionName = "users" && user = @request.auth.id';
  c = new Collection({
    id: "pbc_wir_homeprefs", name: "home_prefs", type: "base",
    listRule: own, viewRule: own,
    createRule: '@request.auth.collectionName = "users" && @request.body.user = @request.auth.id',
    updateRule: own + ' && (@request.body.user:isset = false || @request.body.user = @request.auth.id)',
    deleteRule: own,
    fields: [
      { id: "hp_user", name: "user", type: "relation", collectionId: app.findCollectionByNameOrId("users").id, maxSelect: 1, required: true, cascadeDelete: false },
      { id: "hp_data", name: "data", type: "json", maxSize: 4000 },
      { id: "hp_updated", name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX `idx_home_prefs_user` ON `home_prefs` (`user`)"],
  });
  app.save(c);
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("home_prefs")); } catch (_) {}
});
