/// <reference path="../pb_data/types.d.ts" />
// Puzzle (13.11.2026) – NUR additiv: Collection puzzles (Bild, Stufe, Teile-Zustand). Lesen: Besitzer und – bei „zusammen“ – die andere Person.
// Schreiben NUR über pb_hooks/wir_puzzle.pb.js (prüft Position/Einrasten, Zeit, Coins).
migrate((app) => {
  try { app.findCollectionByNameOrId("puzzles"); return; } catch (_) {}
  const users = app.findCollectionByNameOrId("users");
  const rule = '@request.auth.id != "" && (owner = @request.auth.id || partner = @request.auth.id)';
  app.save(new Collection({
    id: "pbc_wir_puzzle", name: "puzzles", type: "base",
    listRule: rule, viewRule: rule, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { id: "pz_owner", name: "owner", type: "relation", collectionId: users.id, maxSelect: 1, required: true },
      { id: "pz_partner", name: "partner", type: "relation", collectionId: users.id, maxSelect: 1 },   // leer = allein
      { id: "pz_variant", name: "variant", type: "text", max: 10 },   // normal | split | blind
      { id: "pz_level", name: "level", type: "text", max: 8 },        // easy | mid | hard | pro
      { id: "pz_cols", name: "cols", type: "number", onlyInt: true, min: 1 },
      { id: "pz_rows", name: "rows", type: "number", onlyInt: true, min: 1 },
      { id: "pz_rotate", name: "rotate", type: "bool" },
      { id: "pz_image", name: "image", type: "file", maxSelect: 1, maxSize: 2097152, mimeTypes: ["image/jpeg", "image/png", "image/webp"], protected: true },
      { id: "pz_state", name: "state", type: "json", maxSize: 60000 },
      { id: "pz_status", name: "status", type: "text", max: 8 },     // playing | done
      { id: "pz_started", name: "started", type: "number" },
      { id: "pz_seconds", name: "seconds", type: "number", onlyInt: true, min: 0 },
      { id: "pz_created", name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { id: "pz_updated", name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
  }));
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("puzzles")); } catch (_) {}
});
