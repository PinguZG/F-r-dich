/// <reference path="../pb_data/types.d.ts" />
// Einkaufsliste (26.10.2026) – NUR additiv: drei neue Collections, Standardliste „Einkauf“.
//   grocery_lists    Listen (Einkauf, Drogerie …) – beide dürfen anlegen/umbenennen/löschen
//   grocery_entries  Artikel auf einer Liste (done = gekauft/abgehakt -> „Zuletzt verwendet“)
//   grocery_custom   eigene Artikel (ergänzen den Katalog in der App)
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const has = (n) => { try { app.findCollectionByNameOrId(n); return true; } catch (_) { return false; } };
  const authed = '@request.auth.id != ""';
  const mine = '@request.auth.id != "" && @request.body.author = @request.auth.id';
  const keep = '@request.auth.id != "" && @request.body.author:changed = false';
  const auto = (p) => [
    { id: p + "_created", name: "created", type: "autodate", onCreate: true, onUpdate: false },
    { id: p + "_updated", name: "updated", type: "autodate", onCreate: true, onUpdate: true },
  ];
  const author = (p) => ({ id: p + "_author", name: "author", type: "relation", collectionId: users.id, maxSelect: 1, required: true });
  if (!has("grocery_lists")) {
    app.save(new Collection({
      id: "pbc_wir_glists", name: "grocery_lists", type: "base",
      listRule: authed, viewRule: authed, createRule: mine, updateRule: keep, deleteRule: authed,
      fields: [
        { id: "gl_name", name: "name", type: "text", required: true, max: 40 },
        { id: "gl_emoji", name: "emoji", type: "text", max: 16 },
        { id: "gl_order", name: "order", type: "number" },
        author("gl"), ...auto("gl"),
      ],
    }));
    const first = app.findRecordsByFilter("users", "id != ''", "created", 1, 0)[0];
    if (first) {
      const l = new Record(app.findCollectionByNameOrId("grocery_lists"));
      l.set("name", "Einkauf"); l.set("emoji", "🛒"); l.set("order", 0); l.set("author", first.id);
      app.save(l);
    }
  }
  if (!has("grocery_entries")) {
    const lists = app.findCollectionByNameOrId("grocery_lists");
    app.save(new Collection({
      id: "pbc_wir_gentries", name: "grocery_entries", type: "base",
      listRule: authed, viewRule: authed, createRule: mine, updateRule: keep, deleteRule: authed,
      fields: [
        { id: "ge_list", name: "list", type: "relation", collectionId: lists.id, maxSelect: 1, required: true, cascadeDelete: true },
        { id: "ge_name", name: "name", type: "text", required: true, max: 60 },
        { id: "ge_emoji", name: "emoji", type: "text", max: 16 },
        { id: "ge_cat", name: "cat", type: "text", max: 20 },
        { id: "ge_spec", name: "spec", type: "text", max: 40 },       // z. B. „2x“, „bio“, „500 g“
        { id: "ge_done", name: "done", type: "bool" },
        author("ge"), ...auto("ge"),
      ],
      indexes: ["CREATE INDEX `idx_grocery_list` ON `grocery_entries` (`list`, `done`)"],
    }));
  }
  if (!has("grocery_custom")) {
    app.save(new Collection({
      id: "pbc_wir_gcustom", name: "grocery_custom", type: "base",
      listRule: authed, viewRule: authed, createRule: mine, updateRule: keep, deleteRule: authed,
      fields: [
        { id: "gc_name", name: "name", type: "text", required: true, max: 60 },
        { id: "gc_emoji", name: "emoji", type: "text", max: 16 },
        { id: "gc_cat", name: "cat", type: "text", max: 20 },
        author("gc"), ...auto("gc"),
      ],
    }));
  }
}, (app) => {
  for (const n of ["grocery_entries", "grocery_custom", "grocery_lists"]) { try { app.delete(app.findCollectionByNameOrId(n)); } catch (_) {} }
});
