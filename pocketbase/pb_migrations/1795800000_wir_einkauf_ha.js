/// <reference path="../pb_data/types.d.ts" />
// Einkaufsliste <-> Home Assistant (19.11.2026) – NUR additiv: Feld grocery_entries.ha_uid (Text).
// Setzt nur wir-home (home/einkauf.js): uid des passenden Eintrags in der HA-To-do-Liste (todo.einkaufsliste).
migrate((app) => {
  const c = app.findCollectionByNameOrId("grocery_entries");
  if (c.fields.getByName("ha_uid")) return;
  c.fields.add(new TextField({ id: "ge_ha_uid", name: "ha_uid", max: 80 }));
  app.save(c);
}, (app) => {
  const c = app.findCollectionByNameOrId("grocery_entries");
  if (!c.fields.getByName("ha_uid")) return;
  c.fields.removeByName("ha_uid");
  app.save(c);
});
