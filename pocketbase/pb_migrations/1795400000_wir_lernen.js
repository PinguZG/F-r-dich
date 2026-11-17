/// <reference path="../pb_data/types.d.ts" />
// Lernen (17.11.2026) – NUR additiv: sechs lern_*-Collections für Daniels AP2-Lernmappen (Fortschritt, To-dos, Dateien).
// Zugriff: ausschließlich Daniel (Datensätze zusätzlich nur die eigenen). Alle fünf Regeln serverseitig, kein Hook nötig.
// Daniel wird beim Anlegen einmalig gesucht (Name enthält „daniel“ oder E-Mail beginnt mit „daniel“, wie in blume.js);
// genau ein Treffer -> Regeln gelten für diese ID. Sonst Rückfall: E-Mail beginnt mit „daniel“ (E-Mail lässt sich nur per Bestätigung ändern).
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  let who = '@request.auth.email ~ "daniel%"';
  try {
    const hits = app.findRecordsByFilter("users", "name ~ 'daniel' || email ~ 'daniel%'", "created", 5, 0);
    if (hits.length === 1) who = '@request.auth.id = "' + hits[0].id + '"';
    console.log("[lernen] Daniel-Treffer: " + hits.length);
  } catch (e) { console.log("[lernen] Suche fehlgeschlagen, E-Mail-Regel aktiv"); }
  const own = who + " && user = @request.auth.id";
  const mk = (id, name, fields, indexes) => {
    try { app.findCollectionByNameOrId(name); return; } catch (_) {}
    app.save(new Collection({
      id, name, type: "base",
      listRule: own, viewRule: own, deleteRule: own,
      createRule: who + " && @request.body.user = @request.auth.id",
      updateRule: own + " && (@request.body.user:isset = false || @request.body.user = @request.auth.id)",
      fields: [{ id: id.slice(-6) + "_u", name: "user", type: "relation", collectionId: users.id, maxSelect: 1, required: true, cascadeDelete: true }].concat(fields, [{ id: id.slice(-6) + "_c", name: "created", type: "autodate", onCreate: true }]),
      indexes,
    }));
  };
  const t = (n, p, extra) => Object.assign({ id: p + "_" + n, name: n, type: "text" }, extra || {});
  const num = (n, p) => ({ id: p + "_" + n, name: n, type: "number", onlyInt: true });
  const bool = (n, p) => ({ id: p + "_" + n, name: n, type: "bool" });

  mk("pbc_lern_karten", "lern_karten", [t("cardId", "lk", { required: true, max: 120 }), num("box", "lk"), t("due", "lk", { max: 10 })],
    ["CREATE UNIQUE INDEX idx_lern_karten_uc ON lern_karten (user, cardId)"]);
  mk("pbc_lern_todos", "lern_todos", [t("planId", "lt", { max: 40 }), t("title", "lt", { required: true, max: 300 }), t("date", "lt", { max: 10 }), t("area", "lt", { max: 10 }),
    bool("done", "lt"), t("doneAt", "lt", { max: 30 }), bool("custom", "lt")],
    ["CREATE UNIQUE INDEX idx_lern_todos_up ON lern_todos (user, planId) WHERE planId != ''"]);
  mk("pbc_lern_gens", "lern_gens", [t("genId", "lg", { required: true, max: 60 }), num("right", "lg"), num("total", "lg")],
    ["CREATE UNIQUE INDEX idx_lern_gens_ug ON lern_gens (user, genId)"]);
  mk("pbc_lern_proben", "lern_proben", [t("area", "lp", { max: 10 }), num("score", "lp"), num("total", "lp"), t("date", "lp", { max: 30 })], []);
  mk("pbc_lern_stoff", "lern_stoff", [t("sectionId", "ls", { required: true, max: 60 }), bool("gelesen", "ls")],
    ["CREATE UNIQUE INDEX idx_lern_stoff_us ON lern_stoff (user, sectionId)"]);
  mk("pbc_lern_dateien", "lern_dateien", [t("titel", "ld", { required: true, max: 200 }), t("bereich", "ld", { max: 10 }),
    { id: "ld_datei", name: "datei", type: "file", maxSelect: 1, maxSize: 31457280, protected: true, thumbs: ["100x100"], required: true,
      mimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/gif", "text/plain", "text/csv",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"] }], []);
}, (app) => {
  for (const n of ["lern_dateien", "lern_stoff", "lern_proben", "lern_gens", "lern_todos", "lern_karten"]) {
    try { app.delete(app.findCollectionByNameOrId(n)); } catch (_) {}
  }
});
