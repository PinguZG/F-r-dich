/// <reference path="../pb_data/types.d.ts" />
// Lernseite NEW (27.11.2026) – NUR additiv: lnew_faecher (Fach + Pixel-Tier + XP + Prüfungstermin) und lnew_items (Aufgaben/Karteikarten je Fach).
// Gehört Ida (Feld user = Idas Konto). Zugriff: nur angemeldete Nutzer dieser Zwei-Personen-App; Daniel darf für Ida Inhalte anlegen.
// Serverseitig: user/fach werden geprüft, Texte sind längenbegrenzt, Tier-Namen kommen vom Client nur als kurzer Schlüssel.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const rule = '@request.auth.id != ""';
  const mk = (id, name, fields, indexes) => {
    try { app.findCollectionByNameOrId(name); return; } catch (_) {}
    app.save(new Collection({
      id, name, type: "base",
      listRule: rule, viewRule: rule, createRule: rule, updateRule: rule, deleteRule: rule,
      fields: [{ id: id.slice(-6) + "_u", name: "user", type: "relation", collectionId: users.id, maxSelect: 1, required: true, cascadeDelete: true }]
        .concat(fields, [{ id: id.slice(-6) + "_c", name: "created", type: "autodate", onCreate: true }]),
      indexes,
    }));
  };
  const t = (n, p, extra) => Object.assign({ id: p + "_" + n, name: n, type: "text" }, extra || {});
  const num = (n, p) => ({ id: p + "_" + n, name: n, type: "number", onlyInt: true });
  const bool = (n, p) => ({ id: p + "_" + n, name: n, type: "bool" });

  mk("pbc_lnew_faecher", "lnew_faecher",
    [t("key", "lf", { required: true, max: 20 }), t("name", "lf", { required: true, max: 60 }), t("tier", "lf", { max: 20 }),
      t("exam", "lf", { max: 10 }), t("examName", "lf", { max: 80 }), num("xp", "lf"), bool("hidden", "lf")],
    ["CREATE UNIQUE INDEX idx_lnew_faecher_uk ON lnew_faecher (user, key)"]);
  mk("pbc_lnew_items", "lnew_items",
    [t("fach", "li", { required: true, max: 20 }), t("typ", "li", { required: true, max: 10 }), t("title", "li", { required: true, max: 300 }),
      t("back", "li", { max: 1000 }), t("date", "li", { max: 10 }), bool("done", "li"), t("doneAt", "li", { max: 30 }),
      num("box", "li"), t("due", "li", { max: 10 }), t("by", "li", { max: 30 })],
    ["CREATE INDEX idx_lnew_items_uf ON lnew_items (user, fach)"]);
}, (app) => {
  for (const n of ["lnew_items", "lnew_faecher"]) { try { app.delete(app.findCollectionByNameOrId(n)); } catch (_) {} }
});
