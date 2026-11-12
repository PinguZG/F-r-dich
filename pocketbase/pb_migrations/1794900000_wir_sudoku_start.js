/// <reference path="../pb_data/types.d.ts" />
// Sudoku-Startzeit (12.11.2026) – NUR additiv: Feld sudoku_progress.started (ms).
// Setzt ausschließlich der Hook in wir_spiele.pb.js (beim Anlegen und bei neuem Rätsel); Client-Werte werden überschrieben.
// Damit prüft /api/games/sudoku/finish die echte Dauer (Coins nur bei realistischer Lösezeit).
migrate((app) => {
  const c = app.findCollectionByNameOrId("sudoku_progress");
  if (c.fields.getByName("started")) return;
  c.fields.add(new NumberField({ id: "sp_started", name: "started" }));
  app.save(c);
}, (app) => {
  const c = app.findCollectionByNameOrId("sudoku_progress");
  if (!c.fields.getByName("started")) return;
  c.fields.removeByName("started");
  app.save(c);
});
