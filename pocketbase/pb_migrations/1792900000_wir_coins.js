/// <reference path="../pb_data/types.d.ts" />
// Heart Coins + Gutschein-Shop (23.10.2026) – NUR additiv: vier neue Collections, nichts an bestehenden geändert.
// Die App-Version "vor-shop" läuft mit diesem Schema unverändert weiter.
//   coin_wallets   Kontostand pro Person (Cache, wird nur zusammen mit coin_ledger geändert)
//   coin_ledger    jede Buchung (+/-), key = Idempotenz-Schlüssel (eindeutig)
//   shop_items     Gutschein-Sortiment (im Admin-UI pflegbar: Name, Emoji, Beschreibung, Preis, aktiv, Reihenfolge)
//   vouchers       verschenkte Gutscheine (gifted -> redeemed -> fulfilled)
// Schreiben über die normale API ist überall verboten (Regel leer = nur Superuser), alles läuft über pb_hooks/wir_coins.pb.js.
// Jeder Schritt prüft, ob es ihn schon gibt -> ein zweiter Lauf schadet nicht.
migrate((app) => {
  const has = (name) => { try { return app.findCollectionByNameOrId(name); } catch (_) { return null; } };
  const users = app.findCollectionByNameOrId("users");
  const rel = (id, name, required, collectionId) => ({ id, name, type: "relation", collectionId: collectionId || users.id, maxSelect: 1, cascadeDelete: false, required: !!required });
  const dates = (p) => [
    { id: p + "_created", name: "created", type: "autodate", onCreate: true, onUpdate: false },
    { id: p + "_updated", name: "updated", type: "autodate", onCreate: true, onUpdate: true },
  ];
  const own = "@request.auth.id != \"\" && user = @request.auth.id";
  const authed = "@request.auth.id != \"\"";

  // ---------- coin_wallets ----------
  if (!has("coin_wallets")) {
    app.save(new Collection({
      id: "pbc_wir_wallet", name: "coin_wallets", type: "base",
      listRule: own, viewRule: own, createRule: null, updateRule: null, deleteRule: null,
      fields: [
        rel("cw_user", "user", true),
        { id: "cw_balance", name: "balance", type: "number", onlyInt: true, min: 0 },
        ...dates("cw"),
      ],
      indexes: ["CREATE UNIQUE INDEX `idx_coin_wallet_user` ON `coin_wallets` (`user`)"],
    }));
  }

  // ---------- coin_ledger ----------
  if (!has("coin_ledger")) {
    app.save(new Collection({
      id: "pbc_wir_ledger", name: "coin_ledger", type: "base",
      listRule: own, viewRule: own, createRule: null, updateRule: null, deleteRule: null,
      fields: [
        rel("cl_user", "user", true),
        { id: "cl_amount", name: "amount", type: "number", onlyInt: true },
        { id: "cl_reason", name: "reason", type: "text", max: 30 },        // start | daily | love | openwhen | photo | gift | fulfill
        { id: "cl_label", name: "label", type: "text", max: 140 },         // Text für den Verlauf
        { id: "cl_ref", name: "ref", type: "text", max: 60 },              // z. B. Gutschein-/Runden-/Ping-ID
        { id: "cl_key", name: "key", type: "text", max: 120, hidden: true }, // Idempotenz-Schlüssel
        { id: "cl_after", name: "balance_after", type: "number", onlyInt: true },
        ...dates("cl"),
      ],
      indexes: [
        "CREATE UNIQUE INDEX `idx_coin_ledger_key` ON `coin_ledger` (`key`)",
        "CREATE INDEX `idx_coin_ledger_user` ON `coin_ledger` (`user`, `reason`, `created`)",
      ],
    }));
  }

  // ---------- shop_items ----------
  let items = has("shop_items");
  if (!items) {
    items = new Collection({
      id: "pbc_wir_shop", name: "shop_items", type: "base",
      listRule: authed, viewRule: authed, createRule: null, updateRule: null, deleteRule: null,
      fields: [
        { id: "si_name", name: "name", type: "text", required: true, max: 80 },
        { id: "si_emoji", name: "emoji", type: "text", max: 16 },
        { id: "si_desc", name: "description", type: "text", max: 300 },
        { id: "si_price", name: "price", type: "number", onlyInt: true, min: 1, required: true },
        { id: "si_active", name: "active", type: "bool" },
        { id: "si_order", name: "order", type: "number" },
        ...dates("si"),
      ],
    });
    app.save(items);
    const seed = [
      ["🍫", "Lieblingssnack-Überraschung", "Ich besorge heimlich deinen Lieblingssnack und überrasche dich damit.", 100],
      ["💬", "10 Komplimente am Stück", "Zehn ehrliche Komplimente, eins nach dem anderen – ganz ohne Grund.", 100],
      ["🎵", "Ein Lied, das ich dir widme", "Ich suche ein Lied für dich aus und erzähle dir, warum es uns beschreibt.", 120],
      ["💌", "Ein handgeschriebener Brief", "Ein echter Brief auf Papier, mit ganz viel Liebe geschrieben.", 150],
      ["🤗", "Kuscheln auf Abruf", "Wann immer du willst: 20 Minuten Kuscheln, sofort und ohne Ausreden.", 150],
      ["🚶", "Spaziergang & Händchenhalten", "Ein Spaziergang, nur wir zwei, Hand in Hand – die Handys bleiben aus.", 180],
      ["💆", "Massage 15 min", "15 Minuten Massage, du sagst, wo.", 200],
      ["🎬", "Filmabend – du wählst den Film", "Du suchst den Film aus, ich mache Snacks und Decke – kein Meckern über die Wahl.", 220],
      ["🧹", "Ich übernehme eine lästige Aufgabe", "Eine Aufgabe, auf die du keine Lust hast, erledige ich für dich.", 250],
      ["🥐", "Frühstück ans Bett", "Ein gemütliches Frühstück, serviert direkt ans Bett.", 300],
      ["💆‍♀️", "Massage 30 min", "30 Minuten Massage, mit allem Drum und Dran.", 350],
      ["🍝", "Ich koche dein Lieblingsessen", "Ich koche dein Lieblingsessen – und räume danach auch auf.", 400],
      ["🛁", "Wellness-Abend zu Hause", "Kerzen, Musik, Gesichtsmaske, Tee – ein Abend nur zum Entspannen.", 450],
      ["🗺️", "Ich plane unser nächstes Date", "Ich plane unser nächstes Date von A bis Z – du musst nur mitkommen.", 500],
      ["☀️", "Ein ganzer Tag nur für dich", "Ein ganzer Tag, an dem du bestimmst, was wir machen.", 650],
      ["🌟", "Wunsch frei", "Ein Wunsch, ganz egal welcher (im Rahmen des Möglichen 😉).", 800],
    ];
    seed.forEach(([emoji, name, description, price], i) => {
      const r = new Record(items);
      r.set("emoji", emoji); r.set("name", name); r.set("description", description);
      r.set("price", price); r.set("active", true); r.set("order", i + 1);
      app.save(r);
    });
  }

  // ---------- vouchers ----------
  if (!has("vouchers")) {
    const mine = "@request.auth.id != \"\" && (from = @request.auth.id || to = @request.auth.id)";
    app.save(new Collection({
      id: "pbc_wir_voucher", name: "vouchers", type: "base",
      listRule: mine, viewRule: mine, createRule: null, updateRule: null, deleteRule: null,
      fields: [
        rel("vo_item", "item", false, items.id),
        rel("vo_from", "from", true),
        rel("vo_to", "to", true),
        { id: "vo_name", name: "name", type: "text", max: 80 },          // Kopie aus shop_items (bleibt, falls das Sortiment geändert wird)
        { id: "vo_emoji", name: "emoji", type: "text", max: 16 },
        { id: "vo_desc", name: "description", type: "text", max: 300 },
        { id: "vo_price", name: "price", type: "number", onlyInt: true },
        { id: "vo_note", name: "note", type: "text", max: 200 },         // kleiner Gruß beim Verschenken
        { id: "vo_status", name: "status", type: "text", max: 12 },      // gifted | redeemed | fulfilled
        { id: "vo_redeemed", name: "redeemed_at", type: "date" },
        { id: "vo_fulfilled", name: "fulfilled_at", type: "date" },
        ...dates("vo"),
      ],
      indexes: ["CREATE INDEX `idx_vouchers_to` ON `vouchers` (`to`, `status`)"],
    }));
  }

}, (app) => {
  // zurück: nur das Neue entfernen
  for (const name of ["vouchers", "shop_items", "coin_ledger", "coin_wallets"]) {
    try { app.delete(app.findCollectionByNameOrId(name)); } catch (_) {}
  }
});
