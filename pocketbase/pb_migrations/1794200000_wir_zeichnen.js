/// <reference path="../pb_data/types.d.ts" />
// Zusammen zeichnen (27.10.2026) – NUR additiv, zwei neue Collections:
//   drawings         ein Bild: Titel, Größe, Ebenen (JSON), Sperre, Vorschaubild, wer zuletzt gezeichnet hat
//   drawing_strokes  jeder Strich/jede Füllung einzeln (fortlaufende Nummer seq), rückgängig = undone
// Lesen dürfen nur Eingeloggte (das seid nur ihr zwei, für Realtime). Schreiben NUR über die Routen in
// pb_hooks/wir_zeichnen.pb.js (prüfen Sperre, Größe, Autor). Löschen eines Bildes löscht seine Striche mit.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const authed = '@request.auth.id != ""';
  let d;
  try { d = app.findCollectionByNameOrId("drawings"); } catch (_) { d = null; }
  if (!d) {
    d = new Collection({
      id: "pbc_wir_drawings", name: "drawings", type: "base",
      listRule: authed, viewRule: authed, createRule: null, updateRule: null, deleteRule: authed,
      fields: [
        { id: "dr_title", name: "title", type: "text", max: 80 },
        { id: "dr_author", name: "author", type: "relation", collectionId: users.id, maxSelect: 1, required: true },
        { id: "dr_w", name: "w", type: "number", onlyInt: true },
        { id: "dr_h", name: "h", type: "number", onlyInt: true },
        { id: "dr_layers", name: "layers", type: "json", maxSize: 20000 },
        { id: "dr_locked", name: "locked", type: "bool" },
        { id: "dr_lockedby", name: "locked_by", type: "relation", collectionId: users.id, maxSelect: 1 },
        { id: "dr_thumb", name: "thumb", type: "file", maxSelect: 1, maxSize: 5242880, mimeTypes: ["image/png", "image/jpeg", "image/webp"], protected: true },
        { id: "dr_lastby", name: "last_by", type: "relation", collectionId: users.id, maxSelect: 1 },
        { id: "dr_lastat", name: "last_at", type: "date" },
        { id: "dr_seq", name: "seq", type: "number", onlyInt: true },
        { id: "dr_push", name: "push_at", type: "date", hidden: true },
        { id: "dr_created", name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { id: "dr_updated", name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE INDEX `idx_drawings_updated` ON `drawings` (`updated`)"],
    });
    app.save(d);
  }
  let s;
  try { s = app.findCollectionByNameOrId("drawing_strokes"); } catch (_) { s = null; }
  if (!s) {
    s = new Collection({
      id: "pbc_wir_drawstrokes", name: "drawing_strokes", type: "base",
      listRule: authed, viewRule: authed, createRule: null, updateRule: null, deleteRule: null,
      fields: [
        { id: "ds_drawing", name: "drawing", type: "relation", collectionId: d.id, maxSelect: 1, required: true, cascadeDelete: true },
        { id: "ds_author", name: "author", type: "relation", collectionId: users.id, maxSelect: 1, required: true },
        { id: "ds_seq", name: "seq", type: "number", onlyInt: true },
        { id: "ds_layer", name: "layer", type: "text", max: 20 },
        { id: "ds_data", name: "data", type: "json", maxSize: 300000 },
        { id: "ds_undone", name: "undone", type: "bool" },
        { id: "ds_undoneat", name: "undone_at", type: "number" },
        { id: "ds_dead", name: "dead", type: "bool" },
        { id: "ds_cid", name: "cid", type: "text", max: 40 },
        { id: "ds_created", name: "created", type: "autodate", onCreate: true, onUpdate: false },
      ],
      indexes: ["CREATE INDEX `idx_strokes_drawing_seq` ON `drawing_strokes` (`drawing`, `seq`)"],
    });
    app.save(s);
  }
}, (app) => {
  for (const n of ["drawing_strokes", "drawings"]) { try { app.delete(app.findCollectionByNameOrId(n)); } catch (_) {} }
});
