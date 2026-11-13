/// <reference path="../pb_data/types.d.ts" />
// Draw Pro (13.11.2026) – NUR additiv: drawings.solo (bool). „Allein zeichnen“: solo-Bilder sieht nur der Autor,
// bis er sie per /api/draw/{id}/meta {solo:false} an die andere Person schickt. Lese-Regeln entsprechend enger.
migrate((app) => {
  const c = app.findCollectionByNameOrId("drawings");
  if (!c.fields.getByName("solo")) c.fields.add(new BoolField({ id: "dr_solo", name: "solo" }));
  const rule = '@request.auth.id != "" && (solo = false || author = @request.auth.id)';
  c.listRule = rule; c.viewRule = rule;
  app.save(c);
  const st = app.findCollectionByNameOrId("drawing_strokes");
  const sr = '@request.auth.id != "" && (drawing.solo = false || drawing.author = @request.auth.id)';
  st.listRule = sr; st.viewRule = sr;
  app.save(st);
}, (app) => {
  const st = app.findCollectionByNameOrId("drawing_strokes");
  st.listRule = '@request.auth.id != ""'; st.viewRule = '@request.auth.id != ""';
  app.save(st);
  const c = app.findCollectionByNameOrId("drawings");
  c.listRule = '@request.auth.id != ""'; c.viewRule = '@request.auth.id != ""';
  if (c.fields.getByName("solo")) c.fields.removeByName("solo");
  app.save(c);
});
