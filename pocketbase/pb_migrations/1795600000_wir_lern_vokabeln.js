/// <reference path="../pb_data/types.d.ts" />
// Englisch-Vokabeln (18.11.2026) – NUR additiv: Collection lern_vokabeln (Stand je Wort: 0 nicht, 1 kann ich, 2 kann ich gut).
// Zugriff: jeder angemeldete Nutzer, aber nur die eigenen Zeilen (Regeln serverseitig, kein Hook nötig).
migrate((app) => {
  try { app.findCollectionByNameOrId("lern_vokabeln"); return; } catch (_) {}
  const users = app.findCollectionByNameOrId("users");
  const own = '@request.auth.id != "" && user = @request.auth.id';
  app.save(new Collection({
    id: "pbc_lern_vokabeln", name: "lern_vokabeln", type: "base",
    listRule: own, viewRule: own, deleteRule: own,
    createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
    updateRule: own + ' && (@request.body.user:isset = false || @request.body.user = @request.auth.id)',
    fields: [
      { id: "lv_user", name: "user", type: "relation", collectionId: users.id, maxSelect: 1, required: true, cascadeDelete: true },
      { id: "lv_wordId", name: "wordId", type: "text", required: true, max: 200 },
      { id: "lv_level", name: "level", type: "number", onlyInt: true, min: 0, max: 2 },
      { id: "lv_created", name: "created", type: "autodate", onCreate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_lern_vokabeln_uw ON lern_vokabeln (user, wordId)"],
  }));
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("lern_vokabeln")); } catch (_) {}
});
