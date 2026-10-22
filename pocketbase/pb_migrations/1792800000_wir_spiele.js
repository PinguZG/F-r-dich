/// <reference path="../pb_data/types.d.ts" />
// Spiele (22.10.2026) – NUR additiv: vier neue Collections, nichts an bestehenden geändert.
// Die App-Version "vor-spiele" läuft mit diesem Schema unverändert weiter.
//   chess_games       Schach-Partien (asynchron). Züge nur über /api/games/chess/... (pb_hooks/wir_spiele.pb.js)
//   ttt_games         Tic Tac Toe: gegeneinander (asynchron) + Ergebnisse gegen die KI
//   sudoku_progress   laufendes Sudoku pro Person (nur für die Person selbst sichtbar)
//   sudoku_scores     gelöste Sudokus mit Punkten (für beide sichtbar, anlegen nur über den Server)
// Jeder Schritt prüft, ob es ihn schon gibt -> ein zweiter Lauf schadet nicht.
migrate((app) => {
  const has = (name) => { try { return app.findCollectionByNameOrId(name); } catch (_) { return null; } };
  const users = app.findCollectionByNameOrId("users");
  const rel = (id, name, required) => ({ id, name, type: "relation", collectionId: users.id, maxSelect: 1, cascadeDelete: false, required: !!required });
  const dates = (p) => [
    { id: p + "_created", name: "created", type: "autodate", onCreate: true, onUpdate: false },
    { id: p + "_updated", name: "updated", type: "autodate", onCreate: true, onUpdate: true },
  ];

  // ---------- chess_games ----------
  if (!has("chess_games")) {
    const mine = "@request.auth.id != \"\" && (white = @request.auth.id || black = @request.auth.id)";
    app.save(new Collection({
      id: "pbc_wir_chess",
      name: "chess_games",
      type: "base",
      listRule: mine,
      viewRule: mine,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        rel("cg_white", "white", true),
        rel("cg_black", "black", true),
        { id: "cg_fen", name: "fen", type: "text", max: 120 },
        { id: "cg_moves", name: "moves", type: "json", maxSize: 500000 },
        { id: "cg_status", name: "status", type: "text", max: 20 },     // active | checkmate | stalemate | draw | agreed | resigned
        { id: "cg_reason", name: "reason", type: "text", max: 30 },     // bei draw: threefold | insufficient | fifty
        rel("cg_turn", "turn"),
        rel("cg_winner", "winner"),
        rel("cg_offer", "draw_offer"),
        ...dates("cg"),
      ],
      indexes: ["CREATE INDEX `idx_chess_status` ON `chess_games` (`status`)"],
    }));
  }

  // ---------- ttt_games ----------
  if (!has("ttt_games")) {
    const mine = "@request.auth.id != \"\" && (x = @request.auth.id || o = @request.auth.id)";
    app.save(new Collection({
      id: "pbc_wir_ttt",
      name: "ttt_games",
      type: "base",
      listRule: mine,
      viewRule: mine,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { id: "tt_mode", name: "mode", type: "text", max: 10 },         // pvp | ai
        { id: "tt_level", name: "level", type: "text", max: 10 },       // ai: easy | medium | hard
        rel("tt_x", "x", true),
        rel("tt_o", "o"),                                               // leer bei KI
        { id: "tt_board", name: "board", type: "text", max: 9 },        // 9 Zeichen: - x o
        { id: "tt_status", name: "status", type: "text", max: 20 },     // active | won | draw | resigned
        rel("tt_turn", "turn"),
        rel("tt_winner", "winner"),
        { id: "tt_result", name: "result", type: "text", max: 10 },     // ai: win | draw | loss (Sicht der Person)
        { id: "tt_line", name: "line", type: "json", maxSize: 200 },
        ...dates("tt"),
      ],
      indexes: ["CREATE INDEX `idx_ttt_status` ON `ttt_games` (`mode`, `status`)"],
    }));
  }

  // ---------- sudoku_progress ----------
  if (!has("sudoku_progress")) {
    const own = "@request.auth.id != \"\" && user = @request.auth.id";
    app.save(new Collection({
      id: "pbc_wir_sudprog",
      name: "sudoku_progress",
      type: "base",
      listRule: own,
      viewRule: own,
      createRule: "@request.auth.id != \"\" && @request.body.user = @request.auth.id",
      updateRule: own + " && @request.body.user:changed = false",
      deleteRule: own,
      fields: [
        rel("sp_user", "user", true),
        { id: "sp_diff", name: "difficulty", type: "text", max: 10, pattern: "^(easy|medium|hard)$" },
        { id: "sp_puzzle", name: "puzzle", type: "text", max: 81, pattern: "^[0-9]{81}$" },
        { id: "sp_solution", name: "solution", type: "text", max: 81, pattern: "^[1-9]{81}$" },
        { id: "sp_cells", name: "cells", type: "text", max: 81, pattern: "^[0-9]{81}$" },
        { id: "sp_notes", name: "notes", type: "json", maxSize: 4000 },
        { id: "sp_elapsed", name: "elapsed", type: "number", onlyInt: true, min: 0 },
        { id: "sp_mistakes", name: "mistakes", type: "number", onlyInt: true, min: 0 },
        { id: "sp_errors", name: "show_errors", type: "bool" },
        ...dates("sp"),
      ],
      indexes: ["CREATE UNIQUE INDEX `idx_sudoku_progress_user` ON `sudoku_progress` (`user`)"],
    }));
  }

  // ---------- sudoku_scores ----------
  if (!has("sudoku_scores")) {
    app.save(new Collection({
      id: "pbc_wir_sudscore",
      name: "sudoku_scores",
      type: "base",
      listRule: "@request.auth.id != \"\"",
      viewRule: "@request.auth.id != \"\"",
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        rel("ss2_user", "user", true),
        { id: "ss2_diff", name: "difficulty", type: "text", max: 10 },
        { id: "ss2_secs", name: "seconds", type: "number", onlyInt: true, min: 0 },
        { id: "ss2_mist", name: "mistakes", type: "number", onlyInt: true, min: 0 },
        { id: "ss2_points", name: "points", type: "number", onlyInt: true },
        ...dates("ss2"),
      ],
    }));
  }
}, (app) => {
  // zurück: nur das Neue entfernen
  for (const name of ["chess_games", "ttt_games", "sudoku_progress", "sudoku_scores"]) {
    try { app.delete(app.findCollectionByNameOrId(name)); } catch (_) {}
  }
});
