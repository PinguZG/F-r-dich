/// <reference path="../pb_data/types.d.ts" />
// Casino (23.10.2026) – NUR additiv: eine neue Collection, nichts an bestehenden geändert.
//   casino_rounds   eine Runde Blackjack (später auch andere Spiele). Karten/Stapel stehen im versteckten Feld "state",
//                   das nur der Server sieht. Aktionen nur über /api/casino/... (pb_hooks/wir_casino.pb.js)
migrate((app) => {
  try { app.findCollectionByNameOrId("casino_rounds"); return; } catch (_) { /* noch nicht da */ }
  const users = app.findCollectionByNameOrId("users");
  const own = "@request.auth.id != \"\" && user = @request.auth.id";
  app.save(new Collection({
    id: "pbc_wir_casino",
    name: "casino_rounds",
    type: "base",
    listRule: own,
    viewRule: own,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { id: "cr_user", name: "user", type: "relation", collectionId: users.id, maxSelect: 1, cascadeDelete: false, required: true },
      { id: "cr_game", name: "game", type: "text", max: 12 },                  // blackjack
      { id: "cr_status", name: "status", type: "text", max: 12 },              // active | done
      { id: "cr_bet", name: "bet", type: "number", onlyInt: true },            // gesamter Einsatz (inkl. Verdoppeln/Teilen)
      { id: "cr_payout", name: "payout", type: "number", onlyInt: true },      // Auszahlung (inkl. Einsatz)
      { id: "cr_result", name: "result", type: "text", max: 140 },
      { id: "cr_ckey", name: "ckey", type: "text", max: 80, hidden: true },     // Idempotenz-Schlüssel vom Client
      { id: "cr_state", name: "state", type: "json", maxSize: 200000, hidden: true },
      { id: "cr_created", name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { id: "cr_updated", name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_casino_ckey` ON `casino_rounds` (`ckey`) WHERE `ckey` != ''",
      "CREATE INDEX `idx_casino_user` ON `casino_rounds` (`user`, `game`, `status`)",
    ],
  }));
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("casino_rounds")); } catch (_) {}
});
