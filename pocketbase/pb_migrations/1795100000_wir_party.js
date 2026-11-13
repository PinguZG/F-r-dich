/// <reference path="../pb_data/types.d.ts" />
// Zusammen spielen (13.11.2026) – NUR additiv: party_games (eine Partie) + party_steps (jeder Zug: Text oder Zeichnung).
// Lesen dürfen nur die beiden Mitspielenden. Schreiben NUR über die Routen in pb_hooks/wir_party.pb.js.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  let g;
  try { g = app.findCollectionByNameOrId("party_games"); } catch (_) { g = null; }
  if (!g) {
    g = new Collection({
      id: "pbc_wir_partyg", name: "party_games", type: "base",
      listRule: '@request.auth.id != "" && (p1 = @request.auth.id || p2 = @request.auth.id)',
      viewRule: '@request.auth.id != "" && (p1 = @request.auth.id || p2 = @request.auth.id)',
      createRule: null, updateRule: null, deleteRule: null,
      fields: [
        { id: "pg_mode", name: "mode", type: "text", max: 20 },        // normal | complement | story | animation | knockoff
        { id: "pg_p1", name: "p1", type: "relation", collectionId: users.id, maxSelect: 1, required: true },
        { id: "pg_p2", name: "p2", type: "relation", collectionId: users.id, maxSelect: 1, required: true },
        { id: "pg_status", name: "status", type: "text", max: 10 },    // playing | done
        { id: "pg_rounds", name: "rounds", type: "number", onlyInt: true, min: 1 },
        { id: "pg_round", name: "round", type: "number", onlyInt: true, min: 0 },
        { id: "pg_turns", name: "turn_s", type: "number", onlyInt: true, min: 0 },     // 0 = ohne Zeitlimit
        { id: "pg_brush", name: "brush", type: "text", max: 10 },      // free | pen
        { id: "pg_look", name: "look_s", type: "number", onlyInt: true, min: 0 },      // Knock Off: Sekunden Original zeigen
        { id: "pg_fps", name: "fps", type: "number", onlyInt: true, min: 0 },
        { id: "pg_deadline", name: "deadline", type: "date" },
        { id: "pg_paused", name: "paused", type: "bool" },
        { id: "pg_created", name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { id: "pg_updated", name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE INDEX `idx_party_games_status` ON `party_games` (`status`, `updated`)"],
    });
    app.save(g);
  }
  try { app.findCollectionByNameOrId("party_steps"); return; } catch (_) {}
  app.save(new Collection({
    id: "pbc_wir_partys", name: "party_steps", type: "base",
    listRule: '@request.auth.id != "" && (game.p1 = @request.auth.id || game.p2 = @request.auth.id)',
    viewRule: '@request.auth.id != "" && (game.p1 = @request.auth.id || game.p2 = @request.auth.id)',
    createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { id: "ps_game", name: "game", type: "relation", collectionId: g.id, maxSelect: 1, required: true, cascadeDelete: true },
      { id: "ps_chain", name: "chain", type: "number", onlyInt: true, min: 0 },
      { id: "ps_idx", name: "idx", type: "number", onlyInt: true, min: 0 },
      { id: "ps_author", name: "author", type: "relation", collectionId: users.id, maxSelect: 1, required: true },
      { id: "ps_kind", name: "kind", type: "text", max: 6 },           // text | draw | skip
      { id: "ps_text", name: "text", type: "text", max: 200 },
      { id: "ps_image", name: "image", type: "file", maxSelect: 1, maxSize: 1048576, mimeTypes: ["image/png", "image/webp", "image/jpeg"], protected: true },
      { id: "ps_fav", name: "fav", type: "bool" },
      { id: "ps_created", name: "created", type: "autodate", onCreate: true, onUpdate: false },
    ],
    indexes: ["CREATE UNIQUE INDEX `idx_party_steps_slot` ON `party_steps` (`game`, `chain`, `idx`)"],
  }));
}, (app) => {
  for (const n of ["party_steps", "party_games"]) { try { app.delete(app.findCollectionByNameOrId(n)); } catch (_) {} }
});
