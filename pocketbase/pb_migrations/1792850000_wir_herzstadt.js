/// <reference path="../pb_data/types.d.ts" />
// Herzstadt (22.10.2026) – NUR additiv: eine neue Collection, nichts an bestehenden geändert.
//   mono_games   Partien "Herzstadt" (Immobilienspiel). Spielstand als JSON, Aktionen nur über /api/games/mono/... (pb_hooks/wir_spiele.pb.js)
migrate((app) => {
  try { app.findCollectionByNameOrId("mono_games"); return; } catch (_) { /* noch nicht da */ }
  const users = app.findCollectionByNameOrId("users");
  const rel = (id, name, required) => ({ id, name, type: "relation", collectionId: users.id, maxSelect: 1, cascadeDelete: false, required: !!required });
  const mine = "@request.auth.id != \"\" && (p1 = @request.auth.id || p2 = @request.auth.id)";
  app.save(new Collection({
    id: "pbc_wir_mono",
    name: "mono_games",
    type: "base",
    listRule: mine,
    viewRule: mine,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      rel("mg_p1", "p1", true),                                   // Spieler 1 (fängt an)
      rel("mg_p2", "p2", true),
      { id: "mg_status", name: "status", type: "text", max: 20 },  // active | finished
      rel("mg_winner", "winner"),
      { id: "mg_state", name: "state", type: "json", maxSize: 2000000 },
      { id: "mg_created", name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { id: "mg_updated", name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE INDEX `idx_mono_status` ON `mono_games` (`status`)"],
  }));
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("mono_games")); } catch (_) {}
});
