/// <reference path="../pb_data/types.d.ts" />
// Claude-Cockpit (07.11.2026) – NUR additiv, eine neue Collection:
//   cockpit  genau ein Datensatz (id "cockpitstatus00"): was Claude Code gerade tut (Okti, Helfer-Team, Limits),
//            gesendet vom Cockpit-Mod auf Daniels PC über pb_hooks/wir_cockpit.pb.js.
// Lesen dürfen beide angemeldeten Personen (Zuhause → Claude, Realtime). Schreiben nur der Hook (keine Regel = nur Superuser).
migrate((app) => {
  let c;
  try { c = app.findCollectionByNameOrId("cockpit"); } catch (_) { c = null; }
  if (c) return;
  const user = '@request.auth.collectionName = "users"';
  c = new Collection({
    id: "pbc_wir_cockpit", name: "cockpit", type: "base",
    listRule: user, viewRule: user,
    createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { id: "ck_data", name: "data", type: "json", maxSize: 60000 },
      { id: "ck_sent", name: "sent_at", type: "number" },
      { id: "ck_updated", name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
  });
  app.save(c);
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("cockpit")); } catch (_) {}
});
