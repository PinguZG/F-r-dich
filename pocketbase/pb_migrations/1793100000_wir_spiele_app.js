/// <reference path="../pb_data/types.d.ts" />
// Eigene Spiele-App (26.10.2026) – NUR additiv: ein neues Feld, nichts umbenannt oder gelöscht.
//   push_subs.app   zu welcher App ein Push-Abo gehört: "wir" (Wir-App) oder "spiele" (Spiele-App unter :8443).
//                   Leer = alte Abos von vor der Trennung = Wir. wir-push schickt Spiel-Pushs an "spiele",
//                   alles andere an "wir".
// users.theme (Farbwelt) gibt es schon seit dem Redesign – beide Apps lesen und schreiben dasselbe Feld.
migrate((app) => {
  const subs = app.findCollectionByNameOrId("push_subs");
  if (subs.fields.getByName("app")) return;
  subs.fields.add(new SelectField({
    id: "psubs_app",
    name: "app",
    values: ["wir", "spiele"],
    maxSelect: 1,
    required: false,
  }));
  app.save(subs);
}, (app) => {
  const subs = app.findCollectionByNameOrId("push_subs");
  if (!subs.fields.getByName("app")) return;
  subs.fields.removeById("psubs_app");
  app.save(subs);
});
