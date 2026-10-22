/// <reference path="../pb_data/types.d.ts" />
// Liebe-Update (22.10.2026) – NUR additiv: zwei neue Felder + ein Index, nichts umbenannt oder gelöscht.
// Die App-Versionen "vor-liebe-update" und "vor-redesign" laufen mit diesem Schema unverändert weiter.
//   users.heart_color        Herzfarbe pro Person (eine Farbe kann nur EINE Person haben -> Unique-Index)
//   pings.series             Serien-Zähler für Liebe-Tipps (setzt der Hook wir_liebe.pb.js)
// Jeder Schritt prüft, ob es ihn schon gibt -> ein zweiter Lauf schadet nicht.
const HEART_COLORS = ["rosa", "kirsche", "koralle", "pfirsich", "sonne", "mint", "tuerkis", "himmel", "ozean", "lavendel", "flieder", "beere"];
const HEART_INDEX = "CREATE UNIQUE INDEX `idx_users_heart_color` ON `users` (`heart_color`) WHERE `heart_color` != ''";

migrate((app) => {
  // ---------- users.heart_color ----------
  const users = app.findCollectionByNameOrId("users");
  let changed = false;
  if (!users.fields.getByName("heart_color")) {
    users.fields.add(new Field({
      id: "text_user_heart_color",
      name: "heart_color",
      type: "text",
      max: 20,
      required: false,
      pattern: "^(" + HEART_COLORS.join("|") + ")$",
    }));
    changed = true;
  }
  if (!(users.indexes || []).some(i => i.includes("idx_users_heart_color"))) {
    users.indexes = [...(users.indexes || []), HEART_INDEX];
    changed = true;
  }
  if (changed) app.save(users);

  // Standard: zwei unterschiedliche Farben (nach Anlegedatum), solange noch niemand gewählt hat
  const all = app.findRecordsByFilter("users", "id != ''", "created", 10, 0);
  const taken = new Set(all.map(u => u.getString("heart_color")).filter(Boolean));
  for (const u of all) {
    if (u.getString("heart_color")) continue;
    const c = ["rosa", "himmel", ...HEART_COLORS].find(x => !taken.has(x));
    taken.add(c);
    u.set("heart_color", c);
    app.saveNoValidate(u);
  }

  // ---------- pings.series ----------
  const pings = app.findCollectionByNameOrId("pings");
  if (!pings.fields.getByName("series")) {
    pings.fields.add(new Field({ id: "number_ping_series", name: "series", type: "number", required: false, onlyInt: true, min: 0 }));
    app.save(pings);
  }
}, (app) => {
  // zurück: nur das Neue entfernen
  const users = app.findCollectionByNameOrId("users");
  users.indexes = (users.indexes || []).filter(i => !i.includes("idx_users_heart_color"));
  const hc = users.fields.getByName("heart_color");
  if (hc) users.fields.removeById(hc.id);
  app.save(users);

  const pings = app.findCollectionByNameOrId("pings");
  const s = pings.fields.getByName("series");
  if (s) { pings.fields.removeById(s.id); app.save(pings); }
});
