/// <reference path="../pb_data/types.d.ts" />
// Dates neu (26.10.2026) – NUR additiv: neue Collection date_events, bestehende Daten werden KOPIERT, nicht gelöscht.
//   date_events  ein Date = Titel, Art (kind), Zeitpunkt, Ort, Notiz, verknüpfte Erinnerungs-Fotos (photos) + eigene Bilder.
//                Geplant/Vergangen ergibt sich aus "when". Beide dürfen anlegen/ändern/löschen (wie vorher Treffen).
//   Übernahme:   jedes Treffen (meetings) -> Date der Art "treffen" (legacy = Treffen-ID, nie doppelt);
//                Clay Date -> ein Date der Art "clay" (die Figuren bleiben in clay_photos und werden dort angezeigt).
//   meetings, clay_photos, dates (Jahrestage) und tabs bleiben unverändert stehen.
migrate((app) => {
  let col;
  try { col = app.findCollectionByNameOrId("date_events"); } catch (_) { col = null; }
  if (!col) {
    const users = app.findCollectionByNameOrId("users");
    const photos = app.findCollectionByNameOrId("photos");
    const authed = '@request.auth.id != ""';
    col = new Collection({
      id: "pbc_wir_dateevents", name: "date_events", type: "base",
      listRule: authed, viewRule: authed,
      createRule: '@request.auth.id != "" && @request.body.author = @request.auth.id',
      updateRule: '@request.auth.id != "" && @request.body.author:changed = false',
      deleteRule: authed,
      fields: [
        { id: "de_title", name: "title", type: "text", required: true, max: 100 },
        { id: "de_emoji", name: "emoji", type: "text", max: 16 },
        { id: "de_kind", name: "kind", type: "select", maxSelect: 1, values: ["date", "treffen", "clay", "essen", "film", "ausflug", "reise", "sonstiges"] },
        { id: "de_when", name: "when", type: "date", required: true },
        { id: "de_place", name: "place", type: "text", max: 120 },
        { id: "de_note", name: "note", type: "text", max: 1000 },
        { id: "de_author", name: "author", type: "relation", collectionId: users.id, maxSelect: 1, required: true },
        { id: "de_photos", name: "photos", type: "relation", collectionId: photos.id, maxSelect: 60, cascadeDelete: false },
        { id: "de_images", name: "images", type: "file", maxSelect: 40, maxSize: 15728640, mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/heic"], thumbs: ["600x0", "200x200"], protected: true },
        { id: "de_legacy", name: "legacy", type: "text", max: 40 },
        { id: "de_created", name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { id: "de_updated", name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE INDEX `idx_date_events_when` ON `date_events` (`when`)"],
    });
    app.save(col);
  }
  const exists = (legacy) => { try { app.findFirstRecordByFilter("date_events", "legacy = {:l}", { l: legacy }); return true; } catch (_) { return false; } };
  // Treffen übernehmen
  for (const m of app.findRecordsByFilter("meetings", "id != ''", "when", 1000, 0)) {
    if (exists("meeting:" + m.id)) continue;
    const r = new Record(col);
    r.set("title", "Treffen"); r.set("emoji", "💗"); r.set("kind", "treffen");
    r.set("when", m.getString("when")); r.set("note", m.getString("note"));
    r.set("author", m.getString("author")); r.set("legacy", "meeting:" + m.id);
    app.save(r);
  }
  // Clay Date als normales Date
  if (!exists("clay")) {
    const first = app.findRecordsByFilter("clay_photos", "id != ''", "created", 1, 0);
    const anyUser = app.findRecordsByFilter("users", "id != ''", "created", 1, 0)[0];
    if (anyUser) {
      const r = new Record(col);
      r.set("title", "Clay Date"); r.set("emoji", "🧸"); r.set("kind", "clay");
      r.set("when", first.length ? first[0].getString("created") : new DateTime().string());
      r.set("note", "Figuren aus Ton gebaut 🧸");
      r.set("author", first.length ? first[0].getString("author") : anyUser.id); r.set("legacy", "clay");
      app.save(r);
    }
  }
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("date_events")); } catch (_) {}
});
