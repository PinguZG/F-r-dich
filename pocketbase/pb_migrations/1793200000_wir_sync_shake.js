/// <reference path="../pb_data/types.d.ts" />
// Sync-Knopf + Schütteln (26.10.2026) – NUR additiv: eine neue Collection, nichts an bestehenden geändert.
//   live_state   genau EIN Datensatz pro Person, wird immer überschrieben (nichts häuft sich an):
//                Halten (holding, hold_since, hold_until = Heartbeat + 3 s), synced (nach Sync erst nach Loslassen wieder),
//                sync_at (Zeitpunkt des letzten Syncs, bei beiden gleich), Schütteln (shake_until, shake_seq).
//                Lesen: beide Eingeloggten (Realtime). Schreiben: nur die Hook-Routen /api/sync/hold und /api/shake.
//                Push-Pausen (hold_push_at, shake_push_at) sind versteckt.
migrate((app) => {
  try { app.findCollectionByNameOrId("live_state"); return; } catch (_) { /* noch nicht da */ }
  const users = app.findCollectionByNameOrId("users");
  app.save(new Collection({
    id: "pbc_wir_livestate",
    name: "live_state",
    type: "base",
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { id: "ls_user", name: "user", type: "relation", collectionId: users.id, maxSelect: 1, cascadeDelete: true, required: true },
      { id: "ls_holding", name: "holding", type: "bool" },
      { id: "ls_hold_since", name: "hold_since", type: "number", onlyInt: true },   // ms seit 1970
      { id: "ls_hold_until", name: "hold_until", type: "number", onlyInt: true },   // ms; danach gilt das Halten als veraltet
      { id: "ls_synced", name: "synced", type: "bool" },
      { id: "ls_sync_at", name: "sync_at", type: "number", onlyInt: true },
      { id: "ls_shake_until", name: "shake_until", type: "number", onlyInt: true },
      { id: "ls_shake_seq", name: "shake_seq", type: "number", onlyInt: true },
      { id: "ls_hold_push", name: "hold_push_at", type: "number", onlyInt: true, hidden: true },
      { id: "ls_shake_push", name: "shake_push_at", type: "number", onlyInt: true, hidden: true },
      { id: "ls_created", name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { id: "ls_updated", name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX `idx_live_state_user` ON `live_state` (`user`)"],
  }));
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("live_state")); } catch (_) {}
});
