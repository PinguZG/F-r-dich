/// <reference path="../pb_data/types.d.ts" />
// Stimmungskatze (27.11.2026) – NUR additiv: moods bekommt das Feld katze (-1 = automatisch nach Stimmung, 0–11 = gewählte Pixel-Katze),
// damit die andere Person deine gewählte Katze sieht. Bestehende Einträge bleiben unverändert (leer = automatisch).
migrate((app) => {
  const c = app.findCollectionByNameOrId("moods");
  if (c.fields.getByName("katze")) return;
  c.fields.add(new NumberField({ id: "mo_katze", name: "katze", onlyInt: true, min: -1, max: 11 }));
  app.save(c);
}, (app) => {
  try { const c = app.findCollectionByNameOrId("moods"); c.fields.removeByName("katze"); app.save(c); } catch (_) {}
});
