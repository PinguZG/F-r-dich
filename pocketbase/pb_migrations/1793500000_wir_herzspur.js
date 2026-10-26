/// <reference path="../pb_data/types.d.ts" />
// Herzspur (26.10.2026) – NUR additiv: neue Collection trail_matches (ein Match = Best of 5).
// Die Live-Daten (Positionen, Richtungswechsel) gehen NICHT in die DB, sondern als Realtime-Nachricht über
// /api/trail/{id}/msg direkt an die andere Person (Topic "trail/<id>"). Schreiben nur über die Hook-Routen.
migrate((app) => {
  try { app.findCollectionByNameOrId("trail_matches"); return; } catch (_) { /* neu */ }
  const users = app.findCollectionByNameOrId("users");
  const mine = '@request.auth.id != "" && (p1 = @request.auth.id || p2 = @request.auth.id)';
  app.save(new Collection({
    id: "pbc_wir_trail", name: "trail_matches", type: "base",
    listRule: mine, viewRule: mine, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { id: "tr_p1", name: "p1", type: "relation", collectionId: users.id, maxSelect: 1, required: true },   // lädt ein + rechnet (Host)
      { id: "tr_p2", name: "p2", type: "relation", collectionId: users.id, maxSelect: 1, required: true },
      { id: "tr_status", name: "status", type: "text", max: 10 },   // invited | playing | done | aborted
      { id: "tr_s1", name: "s1", type: "number", onlyInt: true },
      { id: "tr_s2", name: "s2", type: "number", onlyInt: true },
      { id: "tr_winner", name: "winner", type: "text", max: 15 },
      { id: "tr_created", name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { id: "tr_updated", name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
  }));
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("trail_matches")); } catch (_) {}
});
