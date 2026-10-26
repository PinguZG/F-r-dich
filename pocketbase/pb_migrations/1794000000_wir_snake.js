/// <reference path="../pb_data/types.d.ts" />
// Snake (26.10.2026) – NUR additiv: neue Collection snake_games (Runden; schreibt nur der Server über /api/games/snake/…).
migrate((app) => {
  try { app.findCollectionByNameOrId("snake_games"); return; } catch (_) {}
  const users = app.findCollectionByNameOrId("users");
  const authed = '@request.auth.id != ""';
  app.save(new Collection({
    id: "pbc_wir_snake", name: "snake_games", type: "base",
    listRule: authed, viewRule: authed, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { id: "sn_user", name: "user", type: "relation", collectionId: users.id, maxSelect: 1, required: true },
      { id: "sn_status", name: "status", type: "text", max: 10 },   // active | done | given
      { id: "sn_score", name: "score", type: "number", onlyInt: true, min: 0 },
      { id: "sn_hearts", name: "hearts", type: "number", onlyInt: true, min: 0 },
      { id: "sn_level", name: "level", type: "number", onlyInt: true, min: 0 },
      { id: "sn_seconds", name: "seconds", type: "number", onlyInt: true, min: 0 },
      { id: "sn_coins", name: "coins", type: "number", onlyInt: true, min: 0 },
      { id: "sn_created", name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { id: "sn_updated", name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE INDEX `idx_snake_user` ON `snake_games` (`user`, `status`)"],
  }));
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("snake_games")); } catch (_) {}
});
