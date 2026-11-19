/// <reference path="../pb_data/types.d.ts" />
// Lernen: Notizen (Zeichnungen/Text) auf den Original-Prüfungsblättern (19.11.2026) – NUR additiv: Collection lern_notizen.
// Pro Datei (fileId = ID aus lern_dateien) ein Datensatz je Nutzer, Inhalt als JSON. Zugriff nur Daniel + nur eigene Datensätze (wie die anderen lern_*).
migrate((app) => {
  try { app.findCollectionByNameOrId("lern_notizen"); return; } catch (_) {}
  const users = app.findCollectionByNameOrId("users");
  let who = '@request.auth.email ~ "daniel%"';
  try {
    const hits = app.findRecordsByFilter("users", "name ~ 'daniel' || email ~ 'daniel%'", "created", 5, 0);
    if (hits.length === 1) who = '@request.auth.id = "' + hits[0].id + '"';
  } catch (e) {}
  const own = who + " && user = @request.auth.id";
  try {
  app.save(new Collection({
    id: "pbc_lern_notizen", name: "lern_notizen", type: "base",
    listRule: own, viewRule: own, deleteRule: own,
    createRule: who + " && @request.body.user = @request.auth.id",
    updateRule: own + " && (@request.body.user:isset = false || @request.body.user = @request.auth.id)",
    fields: [
      { id: "ln_n_u", name: "user", type: "relation", collectionId: users.id, maxSelect: 1, required: true, cascadeDelete: true },
      { id: "ln_n_f", name: "fileId", type: "text", required: true, max: 40 },
      { id: "ln_n_d", name: "data", type: "json", maxSize: 5000000 },
      { id: "ln_n_c", name: "created", type: "autodate", onCreate: true },
      { id: "ln_n_up", name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_lern_notizen_uf ON lern_notizen (user, fileId)"],
  }));
  } catch (e) { console.log("[lern_notizen] Anlegen fehlgeschlagen (App läuft weiter, Notizen dann nur lokal): " + e); }
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("lern_notizen")); } catch (_) {}
});
