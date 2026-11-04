/// <reference path="../pb_data/types.d.ts" />
// Zuhause (Aurora, 04.11.2026) – NUR additiv, zwei neue Collections:
//   home_todos     To-dos in den Listen Gemeinsam/Einkauf/Haushalt, Zuordnung d (Daniel) / i (Ida) / g (wir), abhaken
//   home_settings  gemeinsame Einstellungen als JSON pro Schlüssel, z. B. "wecker" (Serien, Tage, Vorlauf, Ton, Morgen aussetzen)
// Nur eure zwei Konten (Collection users) dürfen lesen und schreiben (auch Realtime). home_settings kann man nicht löschen.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const rule = '@request.auth.id != "" && @request.auth.collectionName = "users"';
  let t;
  try { t = app.findCollectionByNameOrId("home_todos"); } catch (_) { t = null; }
  if (!t) {
    t = new Collection({
      id: "pbc_wir_hometodos", name: "home_todos", type: "base",
      listRule: rule, viewRule: rule, createRule: rule, updateRule: rule, deleteRule: rule,
      fields: [
        { id: "ht_list", name: "list", type: "select", values: ["gemeinsam", "einkauf", "haushalt"], maxSelect: 1, required: true },
        { id: "ht_text", name: "text", type: "text", max: 120, required: true },
        { id: "ht_note", name: "note", type: "text", max: 60 },
        { id: "ht_who", name: "who", type: "select", values: ["d", "i", "g"], maxSelect: 1 },
        { id: "ht_done", name: "done", type: "bool" },
        { id: "ht_by", name: "created_by", type: "relation", collectionId: users.id, maxSelect: 1 },
        { id: "ht_created", name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { id: "ht_updated", name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE INDEX `idx_home_todos_list` ON `home_todos` (`list`, `created`)"],
    });
    app.save(t);
  }
  let s;
  try { s = app.findCollectionByNameOrId("home_settings"); } catch (_) { s = null; }
  if (!s) {
    s = new Collection({
      id: "pbc_wir_homesettings", name: "home_settings", type: "base",
      listRule: rule, viewRule: rule, createRule: rule, updateRule: rule, deleteRule: null,
      fields: [
        { id: "hset_key", name: "key", type: "text", max: 40, required: true },
        { id: "hset_data", name: "data", type: "json", maxSize: 50000 },
        { id: "hset_updated", name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE UNIQUE INDEX `idx_home_settings_key` ON `home_settings` (`key`)"],
    });
    app.save(s);
  }
}, (app) => {
  for (const n of ["home_todos", "home_settings"]) { try { app.delete(app.findCollectionByNameOrId(n)); } catch (_) {} }
});
