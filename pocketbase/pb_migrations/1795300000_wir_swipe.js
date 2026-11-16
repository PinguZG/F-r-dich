/// <reference path="../pb_data/types.d.ts" />
// Foto-Swipen (16.11.2026) – NUR additiv: Collection photo_likes (pro Foto und Person ein Zähler).
// Lesen: alle angemeldeten Nutzer. Schreiben NUR über pb_hooks/wir_swipe.pb.js.
migrate((app) => {
  try { app.findCollectionByNameOrId("photo_likes"); return; } catch (_) {}
  const users = app.findCollectionByNameOrId("users");
  const photos = app.findCollectionByNameOrId("photos");
  app.save(new Collection({
    id: "pbc_wir_photolikes", name: "photo_likes", type: "base",
    listRule: '@request.auth.id != ""', viewRule: '@request.auth.id != ""',
    createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { id: "pl_photo", name: "photo", type: "relation", collectionId: photos.id, maxSelect: 1, required: true, cascadeDelete: true },
      { id: "pl_user", name: "user", type: "relation", collectionId: users.id, maxSelect: 1, required: true, cascadeDelete: true },
      { id: "pl_count", name: "count", type: "number", onlyInt: true, min: 0 },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_photo_likes_pu ON photo_likes (photo, user)"],
  }));
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("photo_likes")); } catch (_) {}
});
