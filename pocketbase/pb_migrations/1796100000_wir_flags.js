/// <reference path="../pb_data/types.d.ts" />
// Fernschalter (28.11.2026) – NUR additiv: Collection app_flags (key, on). Erster Schalter: key „kuss“ (Pop-up „Küss mich“ auf Idas Seite).
// Lesen: alle Angemeldeten. Schreiben (anlegen/ändern): ausschließlich Daniel (einmalig per Name/E-Mail gesucht wie in lernen/blume; genau ein Treffer -> ID-Regel,
// sonst Rückfall auf E-Mail beginnt mit „daniel“). Löschen: niemand. Ida kann den Schalter also serverseitig nicht ändern.
migrate((app) => {
  try { app.findCollectionByNameOrId("app_flags"); return; } catch (_) {}
  let who = '@request.auth.email ~ "daniel%"';
  try {
    const hits = app.findRecordsByFilter("users", "name ~ 'daniel' || email ~ 'daniel%'", "created", 5, 0);
    if (hits.length === 1) who = '@request.auth.id = "' + hits[0].id + '"';
    console.log("[flags] Daniel-Treffer: " + hits.length);
  } catch (e) { console.log("[flags] Suche fehlgeschlagen, E-Mail-Regel aktiv"); }
  app.save(new Collection({
    id: "pbc_app_flags", name: "app_flags", type: "base",
    listRule: '@request.auth.id != ""', viewRule: '@request.auth.id != ""',
    createRule: who, updateRule: who, deleteRule: null,
    fields: [
      { id: "af_key", name: "key", type: "text", required: true, max: 40 },
      { id: "af_on", name: "on", type: "bool" },
      { id: "af_c", name: "created", type: "autodate", onCreate: true },
      { id: "af_u", name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_app_flags_key ON app_flags (key)"],
  }));
}, (app) => { try { app.delete(app.findCollectionByNameOrId("app_flags")); } catch (_) {} });
