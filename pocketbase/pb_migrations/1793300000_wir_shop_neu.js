/// <reference path="../pb_data/types.d.ts" />
// Neuer Shop, Solitär, Schach gegen KI (26.10.2026) – NUR additiv: neue Collections + neue Felder, nichts gelöscht.
//   users.frame          gewählter Profilrahmen (nur gekaufte, prüft pb_hooks/wir_shop.pb.js)
//   sudoku_scores.hints  Anzahl gekaufter Tipps (💡 in der Rangliste)
//   shop_purchases       jeder Kauf (Tipp, Rahmen, Bombe) – nur lesbar für die eigene Person
//   bombs                Benachrichtigungs-Bomben (Absender/Empfänger lesen), Versand über push_queue
//   solitaire_games      Solitär-Partien (vom Server ausgegeben, Rangliste für beide)
//   chessai_games        Ergebnisse gegen Stockfish (Rangliste für beide)
// Schreiben in alle neuen Collections nur über die Hook-Routen (Regel leer = nur Superuser).
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  if (!users.fields.getByName("frame")) {
    users.fields.add(new TextField({ id: "u_frame", name: "frame", max: 30, pattern: "^[a-z0-9-]*$" }));
    app.save(users);
  }
  const ss = app.findCollectionByNameOrId("sudoku_scores");
  if (!ss.fields.getByName("hints")) {
    ss.fields.add(new NumberField({ id: "ss2_hints", name: "hints", onlyInt: true, min: 0 }));
    app.save(ss);
  }
  const has = (n) => { try { app.findCollectionByNameOrId(n); return true; } catch (_) { return false; } };
  const auto = (p) => [
    { id: p + "_created", name: "created", type: "autodate", onCreate: true, onUpdate: false },
    { id: p + "_updated", name: "updated", type: "autodate", onCreate: true, onUpdate: true },
  ];
  const own = '@request.auth.id != "" && user = @request.auth.id';
  const authed = '@request.auth.id != ""';
  const rel = (id, name) => ({ id, name, type: "relation", collectionId: users.id, maxSelect: 1, cascadeDelete: false, required: true });

  if (!has("shop_purchases")) app.save(new Collection({
    id: "pbc_wir_purchases", name: "shop_purchases", type: "base",
    listRule: own, viewRule: own, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      rel("pu_user", "user"),
      { id: "pu_kind", name: "kind", type: "text", max: 12 },     // tip | frame | bomb
      { id: "pu_item", name: "item", type: "text", max: 30 },     // z. B. sudoku, herzkranz, heart
      { id: "pu_price", name: "price", type: "number", onlyInt: true },
      { id: "pu_ref", name: "ref", type: "text", max: 60 },       // Spiel/Partie bei Tipps
      ...auto("pu"),
    ],
    indexes: ["CREATE INDEX `idx_purchases_user` ON `shop_purchases` (`user`, `kind`, `item`)"],
  }));

  if (!has("bombs")) app.save(new Collection({
    id: "pbc_wir_bombs", name: "bombs", type: "base",
    listRule: '@request.auth.id != "" && (from = @request.auth.id || to = @request.auth.id)',
    viewRule: '@request.auth.id != "" && (from = @request.auth.id || to = @request.auth.id)',
    createRule: null, updateRule: null, deleteRule: null,
    fields: [
      rel("bo_from", "from"), rel("bo_to", "to"),
      { id: "bo_kind", name: "kind", type: "text", max: 10 },     // heart | msg
      { id: "bo_text", name: "text", type: "text", max: 80 },
      { id: "bo_count", name: "count", type: "number", onlyInt: true },
      { id: "bo_send", name: "send_after", type: "number", onlyInt: true }, // ms; Nachtruhe -> 07:00
      ...auto("bo"),
    ],
  }));

  if (!has("solitaire_games")) app.save(new Collection({
    id: "pbc_wir_solitaire", name: "solitaire_games", type: "base",
    listRule: authed, viewRule: authed, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      rel("so_user", "user"),
      { id: "so_draw", name: "draw", type: "number", onlyInt: true },      // 1 oder 3
      { id: "so_seed", name: "seed", type: "number", onlyInt: true },
      { id: "so_status", name: "status", type: "text", max: 10 },          // active | won | given
      { id: "so_secs", name: "seconds", type: "number", onlyInt: true },
      { id: "so_moves", name: "moves", type: "number", onlyInt: true },
      { id: "so_points", name: "points", type: "number", onlyInt: true },
      { id: "so_hints", name: "hints", type: "number", onlyInt: true },
      ...auto("so"),
    ],
    indexes: ["CREATE INDEX `idx_solitaire_user` ON `solitaire_games` (`user`, `status`)"],
  }));

  if (!has("chessai_games")) app.save(new Collection({
    id: "pbc_wir_chessai", name: "chessai_games", type: "base",
    listRule: authed, viewRule: authed, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      rel("ca_user", "user"),
      { id: "ca_ref", name: "ref", type: "text", max: 60 },
      { id: "ca_level", name: "level", type: "number", onlyInt: true },
      { id: "ca_color", name: "color", type: "text", max: 1 },
      { id: "ca_result", name: "result", type: "text", max: 10 },          // win | loss | draw
      { id: "ca_moves", name: "moves", type: "number", onlyInt: true },
      { id: "ca_hints", name: "hints", type: "number", onlyInt: true },
      ...auto("ca"),
    ],
    indexes: ["CREATE UNIQUE INDEX `idx_chessai_ref` ON `chessai_games` (`user`, `ref`)"],
  }));
}, (app) => {
  for (const n of ["shop_purchases", "bombs", "solitaire_games", "chessai_games"]) { try { app.delete(app.findCollectionByNameOrId(n)); } catch (_) {} }
});
