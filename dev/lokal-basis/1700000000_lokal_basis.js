/// <reference path="../pb_data/types.d.ts" />
// NUR für die lokale Vorschau (dev/lokal.js), NIE auf dem VPS (liegt bewusst nicht in pocketbase/pb_migrations).
// Baut das Ur-Schema nach, das auf dem Server früher von Hand bzw. per JSON-Import entstand:
//   photos (von Hand angelegt) + pocketbase/collections.json, collections-push.json, collections_v3.json (Merge).
// Danach laufen die echten Migrationen aus pocketbase/pb_migrations/ unverändert darüber.
migrate((app) => {
  const has = (n) => { try { return app.findCollectionByNameOrId(n); } catch (_) { return null; } };
  const users = app.findCollectionByNameOrId("users");

  if (!has("photos")) {
    app.save(new Collection({
      name: "photos",
      type: "base",
      listRule: "@request.auth.id != \"\"",
      viewRule: "@request.auth.id != \"\"",
      createRule: "@request.auth.id != \"\" && @request.body.author = @request.auth.id",
      updateRule: "@request.auth.id != \"\" && @request.body.author:changed = false && (author = @request.auth.id || (@request.body.caption:isset = false && @request.body.image:isset = false))",
      deleteRule: "@request.auth.id != \"\" && author = @request.auth.id",
      fields: [
        { name: "image", type: "file", required: true, maxSelect: 1, maxSize: 20971520, mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/gif"], thumbs: ["400x0", "800x0"], protected: true },
        { name: "caption", type: "text", max: 500 },
        { name: "author", type: "relation", collectionId: users.id, maxSelect: 1, cascadeDelete: false },
        { name: "order", type: "number" },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
    }));
  }

  const dir = $os.getenv("WIR_REPO_DIR");
  for (const f of ["collections.json", "collections-push.json", "collections_v3.json"]) {
    const raw = toString($os.readFile(dir + "/pocketbase/" + f));
    app.importCollectionsByMarshaledJSON(raw, false);   // false = Merge, nichts löschen
  }
}, (app) => { /* lokal: kein Zurück nötig */ });
