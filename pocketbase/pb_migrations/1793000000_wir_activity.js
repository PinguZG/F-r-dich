/// <reference path="../pb_data/types.d.ts" />
// Aktivitäts-Log + Online-Status (23.10.2026) – NUR additiv: eine neue Collection, nichts an bestehenden geändert.
//   activity   Sitzungen (App offen von–bis), besuchte Bereiche mit Dauer, Gesehen-Ereignisse, Spiel-Ereignisse.
//              Schreiben/Lesen nur über /api/act/... und /api/console/... (pb_hooks/wir_activity.pb.js),
//              die normale API ist komplett gesperrt. Einträge älter als 90 Tage löscht ein Cron.
migrate((app) => {
  try { app.findCollectionByNameOrId("activity"); return; } catch (_) { /* noch nicht da */ }
  const users = app.findCollectionByNameOrId("users");
  app.save(new Collection({
    id: "pbc_wir_activity",
    name: "activity",
    type: "base",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { id: "ac_user", name: "user", type: "relation", collectionId: users.id, maxSelect: 1, cascadeDelete: false, required: true },
      { id: "ac_kind", name: "kind", type: "text", max: 12 },       // session | view | seen | game
      { id: "ac_area", name: "area", type: "text", max: 30 },       // z. B. s-chess, photo, tab, openwhen, sudoku
      { id: "ac_detail", name: "detail", type: "text", max: 120 },
      { id: "ac_started", name: "started", type: "date" },
      { id: "ac_ended", name: "ended", type: "date" },
      { id: "ac_secs", name: "secs", type: "number", onlyInt: true, min: 0 },
      { id: "ac_closed", name: "closed", type: "bool" },            // Sitzung sauber beendet (App geschlossen)
      { id: "ac_created", name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { id: "ac_updated", name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE INDEX `idx_activity_user` ON `activity` (`user`, `kind`, `started`)",
      "CREATE INDEX `idx_activity_started` ON `activity` (`started`)",
    ],
  }));
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("activity")); } catch (_) {}
});
