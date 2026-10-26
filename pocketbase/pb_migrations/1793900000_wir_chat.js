/// <reference path="../pb_data/types.d.ts" />
// Stimmung, Support-Anfragen, Chat (26.10.2026) – NUR additiv: neue Collections.
//   moods             Stimmungswerte 0–100 (Verlauf); anlegen nur für sich selbst, lesen beide
//   mood_flags        merkt serverseitig, ob „geht gerade nicht so gut“ schon gemeldet wurde (für Clients gesperrt)
//   support_requests  „Ich brauche dich“ + Antwort; nur über /api/support… (lesen: Absender + Empfänger)
//   chat_messages     Chat: Text, Bild, Antwort auf, Reaktionen, gelesen; lesen nur die beiden,
//                     anlegen nur als Absender (Empfänger setzt der Server), Ändern nur über /api/chat/…
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const has = (n) => { try { app.findCollectionByNameOrId(n); return true; } catch (_) { return false; } };
  const auto = (p) => [
    { id: p + "_created", name: "created", type: "autodate", onCreate: true, onUpdate: false },
    { id: p + "_updated", name: "updated", type: "autodate", onCreate: true, onUpdate: true },
  ];
  const rel = (id, name, req = true) => ({ id, name, type: "relation", collectionId: users.id, maxSelect: 1, required: req });
  const authed = '@request.auth.id != ""';
  const both = '@request.auth.id != "" && (from = @request.auth.id || to = @request.auth.id)';

  if (!has("moods")) app.save(new Collection({
    id: "pbc_wir_moods", name: "moods", type: "base",
    listRule: authed, viewRule: authed, createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id', updateRule: null, deleteRule: null,
    fields: [rel("mo_user", "user"), { id: "mo_value", name: "value", type: "number", onlyInt: true, min: 0, max: 100, required: false }, ...auto("mo")],
    indexes: ["CREATE INDEX `idx_moods_user` ON `moods` (`user`, `created`)"],
  }));
  if (!has("mood_flags")) app.save(new Collection({
    id: "pbc_wir_moodflags", name: "mood_flags", type: "base",
    listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
    fields: [rel("mf_user", "user"), { id: "mf_low", name: "low", type: "bool" }, ...auto("mf")],
    indexes: ["CREATE UNIQUE INDEX `idx_mood_flags_user` ON `mood_flags` (`user`)"],
  }));
  if (!has("support_requests")) app.save(new Collection({
    id: "pbc_wir_support", name: "support_requests", type: "base",
    listRule: both, viewRule: both, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      rel("sr_from", "from"), rel("sr_to", "to"),
      { id: "sr_kind", name: "kind", type: "text", max: 20 },        // anruf | ablenkung | da | reden
      { id: "sr_msg", name: "message", type: "text", max: 200 },
      { id: "sr_status", name: "status", type: "text", max: 10 },    // open | answered | closed
      { id: "sr_answer", name: "answer", type: "text", max: 20 },    // da | anruf | gleich
      { id: "sr_answered", name: "answered_at", type: "date" },
      ...auto("sr"),
    ],
  }));
  if (!has("chat_messages")) {
    const col = new Collection({
      id: "pbc_wir_chat", name: "chat_messages", type: "base",
      listRule: both, viewRule: both,
      createRule: '@request.auth.id != "" && @request.body.from = @request.auth.id',
      updateRule: null, deleteRule: '@request.auth.id != "" && from = @request.auth.id',
      fields: [
        rel("cm_from", "from"), rel("cm_to", "to", false),
        { id: "cm_text", name: "text", type: "text", max: 2000 },
        { id: "cm_image", name: "image", type: "file", maxSelect: 1, maxSize: 15728640, mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"], thumbs: ["400x0"], protected: true },
        { id: "cm_reactions", name: "reactions", type: "json", maxSize: 2000 },
        { id: "cm_read", name: "read_at", type: "date" },
        ...auto("cm"),
      ],
      indexes: ["CREATE INDEX `idx_chat_created` ON `chat_messages` (`created`)", "CREATE INDEX `idx_chat_to_read` ON `chat_messages` (`to`, `read_at`)"],
    });
    app.save(col);
    // Antwort auf eine Nachricht (Selbstbezug erst nach dem Anlegen möglich)
    const c = app.findCollectionByNameOrId("chat_messages");
    c.fields.add(new RelationField({ id: "cm_reply", name: "reply_to", collectionId: c.id, maxSelect: 1, cascadeDelete: false }));
    app.save(c);
  }
}, (app) => {
  for (const n of ["chat_messages", "support_requests", "mood_flags", "moods"]) { try { app.delete(app.findCollectionByNameOrId(n)); } catch (_) {} }
});
