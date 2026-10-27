/// <reference path="../pb_data/types.d.ts" />
// Dates vollständig anpassbar (27.10.2026) – NUR additiv, nichts wird umbenannt oder gelöscht:
//   date_events.all_day     Uhrzeit optional (true = nur Tag, gespeichert wird 12:00 Uhr)
//   date_events.kind_label  eigene Art (z. B. „Picknick“); kind bleibt dann „sonstiges“ -> alte Oberfläche zeigt es weiter
//   date_events.kind_emoji  Emoji der eigenen Art
//   date_events.cover       Titelbild: "p:<photo-id>" (aus Erinnerungen) oder "f:<dateiname>" (eigenes Bild)
//   date_events.img_order   Reihenfolge der Bilder als Liste solcher Schlüssel
//   date_kinds              eigene Arten (Name, Emoji) – für beide sichtbar
migrate((app) => {
  const col = app.findCollectionByNameOrId("date_events");
  const add = (f) => { if (!col.fields.getByName(f.name)) col.fields.add(new Field(f)); };
  add({ id: "de_allday", name: "all_day", type: "bool" });
  add({ id: "de_kindlabel", name: "kind_label", type: "text", max: 40 });
  add({ id: "de_kindemoji", name: "kind_emoji", type: "text", max: 16 });
  add({ id: "de_cover", name: "cover", type: "text", max: 200 });
  add({ id: "de_imgorder", name: "img_order", type: "json", maxSize: 20000 });
  app.save(col);

  let kinds;
  try { kinds = app.findCollectionByNameOrId("date_kinds"); } catch (_) { kinds = null; }
  if (!kinds) {
    const users = app.findCollectionByNameOrId("users");
    const authed = '@request.auth.id != ""';
    kinds = new Collection({
      id: "pbc_wir_datekinds", name: "date_kinds", type: "base",
      listRule: authed, viewRule: authed,
      createRule: '@request.auth.id != "" && @request.body.author = @request.auth.id',
      updateRule: '@request.auth.id != "" && @request.body.author:changed = false',
      deleteRule: authed,
      fields: [
        { id: "dk_name", name: "name", type: "text", required: true, max: 40 },
        { id: "dk_emoji", name: "emoji", type: "text", max: 16 },
        { id: "dk_author", name: "author", type: "relation", collectionId: users.id, maxSelect: 1, required: true },
        { id: "dk_created", name: "created", type: "autodate", onCreate: true, onUpdate: false },
      ],
    });
    app.save(kinds);
  }
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("date_kinds")); } catch (_) {}
  const col = app.findCollectionByNameOrId("date_events");
  for (const n of ["all_day", "kind_label", "kind_emoji", "cover", "img_order"]) {
    const f = col.fields.getByName(n);
    if (f) col.fields.removeById(f.id);
  }
  app.save(col);
});
