/// <reference path="../pb_data/types.d.ts" />
// Poker (26.10.2026) – NUR additiv: neue Collection poker_tables.
//   Ein Tisch pro Partie: Heads-up zu zweit (p1 + p2) oder solo gegen 1–3 KI (p1, p2 leer).
//   pub   öffentlicher Stand (Board, Einsätze, Pot, wer dran ist) – löst Realtime aus, enthält KEINE verdeckten Karten
//   state kompletter Stand inkl. Kartenstapel und Hole-Cards – versteckt, nur der Server liest ihn
//   Lesen nur die Mitspielenden, Schreiben nur über /api/poker/… (pb_hooks/wir_poker.pb.js).
migrate((app) => {
  try { app.findCollectionByNameOrId("poker_tables"); return; } catch (_) { /* neu */ }
  const users = app.findCollectionByNameOrId("users");
  const mine = '@request.auth.id != "" && (p1 = @request.auth.id || p2 = @request.auth.id)';
  app.save(new Collection({
    id: "pbc_wir_poker", name: "poker_tables", type: "base",
    listRule: mine, viewRule: mine, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { id: "pk_mode", name: "mode", type: "text", max: 5 },          // duo | ai
      { id: "pk_p1", name: "p1", type: "relation", collectionId: users.id, maxSelect: 1, required: true },
      { id: "pk_p2", name: "p2", type: "relation", collectionId: users.id, maxSelect: 1 },
      { id: "pk_status", name: "status", type: "text", max: 10 },     // waiting | playing | done
      { id: "pk_buyin", name: "buyin", type: "number", onlyInt: true },
      { id: "pk_v", name: "v", type: "number", onlyInt: true },
      { id: "pk_pub", name: "pub", type: "json", maxSize: 20000 },
      { id: "pk_state", name: "state", type: "json", maxSize: 60000, hidden: true },
      { id: "pk_created", name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { id: "pk_updated", name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE INDEX `idx_poker_p1` ON `poker_tables` (`p1`, `status`)"],
  }));
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("poker_tables")); } catch (_) {}
});
