/// <reference path="../pb_data/types.d.ts" />
// Redesign (22.10.2026) – NUR additiv: neue Collections und Felder, nichts umbenannt oder gelöscht.
// Die alte App-Version (Tag "vor-redesign") läuft mit diesem Schema unverändert weiter.
//   photo_folders            Ordner für Erinnerungen
//   photos.folder            optionaler Ordner eines Fotos
//   shared_settings          gemeinsame Werte, z. B. "together_since"
//   users.theme              Farbwelt pro Person
//   users.avatar             bekommt ein 200x200-Vorschaubild
// Jeder Schritt prüft, ob es ihn schon gibt -> ein zweiter Lauf schadet nicht und PocketBase startet trotzdem.
migrate((app) => {
  const has = (name) => { try { return app.findCollectionByNameOrId(name); } catch (_) { return null; } };
  const users = app.findCollectionByNameOrId("users");

  // ---------- photo_folders ----------
  if (!has("photo_folders")) {
    app.save(new Collection({
      id: "pbc_wir_pfolders",
      name: "photo_folders",
      type: "base",
      listRule: "@request.auth.id != \"\"",
      viewRule: "@request.auth.id != \"\"",
      createRule: "@request.auth.id != \"\" && @request.body.author = @request.auth.id",
      updateRule: "@request.auth.id != \"\" && @request.body.author:changed = false",
      deleteRule: "@request.auth.id != \"\"",
      fields: [
        { id: "pf_name", name: "name", type: "text", required: true, max: 60 },
        { id: "pf_emoji", name: "emoji", type: "text", max: 16 },
        { id: "pf_order", name: "order", type: "number" },
        { id: "pf_author", name: "author", type: "relation", collectionId: users.id, maxSelect: 1, cascadeDelete: false },
        { id: "pf_created", name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { id: "pf_updated", name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
    }));
  }

  // ---------- photos.folder ----------
  const photos = app.findCollectionByNameOrId("photos");
  if (!photos.fields.getByName("folder")) {
    photos.fields.add(new Field({
      id: "relation_photo_folder",
      name: "folder",
      type: "relation",
      collectionId: app.findCollectionByNameOrId("photo_folders").id,
      maxSelect: 1,
      cascadeDelete: false,
      required: false,
    }));
    app.save(photos);
  }

  // ---------- shared_settings ----------
  if (!has("shared_settings")) {
    const col = new Collection({
      id: "pbc_wir_shared",
      name: "shared_settings",
      type: "base",
      listRule: "@request.auth.id != \"\"",
      viewRule: "@request.auth.id != \"\"",
      createRule: "@request.auth.id != \"\" && @request.body.key != \"\"",
      updateRule: "@request.auth.id != \"\" && @request.body.key:changed = false",
      deleteRule: null,
      fields: [
        { id: "ss_key", name: "key", type: "text", required: true, max: 60 },
        { id: "ss_value", name: "value", type: "text", max: 2000 },
        { id: "ss_by", name: "updated_by", type: "relation", collectionId: users.id, maxSelect: 1, cascadeDelete: false },
        { id: "ss_created", name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { id: "ss_updated", name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE UNIQUE INDEX `idx_shared_key` ON `shared_settings` (`key`)"],
    });
    app.save(col);
    const r = new Record(col);
    r.set("key", "together_since");
    r.set("value", "2026-04-10");
    app.save(r);
  }

  // ---------- users.theme + Avatar-Vorschaubild ----------
  let changed = false;
  if (!users.fields.getByName("theme")) {
    users.fields.add(new Field({ id: "text_user_theme", name: "theme", type: "text", max: 20, required: false }));
    changed = true;
  }
  const avatar = users.fields.getByName("avatar");
  if (avatar && !(avatar.thumbs || []).includes("200x200")) {
    avatar.thumbs = [...(avatar.thumbs || []), "200x200"];
    changed = true;
  }
  if (changed) app.save(users);
}, (app) => {
  // zurück: nur das Neue entfernen (die alte App braucht es nicht)
  const users = app.findCollectionByNameOrId("users");
  const theme = users.fields.getByName("theme");
  if (theme) { users.fields.removeById(theme.id); app.save(users); }

  const photos = app.findCollectionByNameOrId("photos");
  const folder = photos.fields.getByName("folder");
  if (folder) { photos.fields.removeById(folder.id); app.save(photos); }

  for (const name of ["photo_folders", "shared_settings"]) {
    try { app.delete(app.findCollectionByNameOrId(name)); } catch (_) {}
  }
});
