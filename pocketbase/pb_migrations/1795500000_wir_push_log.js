/// <reference path="../pb_data/types.d.ts" />
// Benachrichtigungs-Log (17.11.2026) – NUR additiv: Collection push_log (wer hat welche Push-Nachricht bekommen).
// Schreiben nur der Dienst wir-push (Superuser), Lesen nur über /api/console/push (pb_hooks/wir_pushlog.pb.js). Cron löscht nach 90 Tagen.
migrate((app) => {
  try { app.findCollectionByNameOrId("push_log"); return; } catch (_) {}
  const users = app.findCollectionByNameOrId("users");
  app.save(new Collection({
    id: "pbc_wir_pushlog", name: "push_log", type: "base",
    listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { id: "pl2_user", name: "user", type: "relation", collectionId: users.id, maxSelect: 1, required: true, cascadeDelete: true },
      { id: "pl2_cat", name: "category", type: "text", max: 30 },
      { id: "pl2_title", name: "title", type: "text", max: 200 },
      { id: "pl2_body", name: "body", type: "text", max: 500 },
      { id: "pl2_sent", name: "sent", type: "number", onlyInt: true, min: 0 },   // an so viele Geräte zugestellt
      { id: "pl2_err", name: "error", type: "text", max: 300 },
      { id: "pl2_created", name: "created", type: "autodate", onCreate: true },
    ],
  }));
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("push_log")); } catch (_) {}
});
