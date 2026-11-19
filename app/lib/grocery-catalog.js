// Einkaufs-Katalog: Kategorien + ~200 gängige Artikel. Gemeinsam genutzt von der App (app/grocery.js, als window.WIR_GROCERY)
// und von wir-home (home/einkauf.js, per require) – Artikel aus Home Assistant bekommen so dasselbe Emoji und dieselbe Kategorie.
(function (root) {
  const CATS = [
    ['obst', 'Obst & Gemüse', '🥦'], ['kuehl', 'Kühlregal', '🧀'], ['fleisch', 'Fleisch & Fisch', '🥩'], ['brot', 'Brot & Backwaren', '🥖'],
    ['vorrat', 'Vorrat & Konserven', '🥫'], ['gewuerz', 'Gewürze & Backen', '🧂'], ['suess', 'Süßes & Snacks', '🍫'], ['getraenke', 'Getränke', '🥤'],
    ['tk', 'Tiefkühl', '🧊'], ['haushalt', 'Haushalt', '🧽'], ['drogerie', 'Drogerie', '🧴'], ['sonst', 'Sonstiges', '📦'],
  ];
  const C = (cat, s) => s.split('|').map(x => { const [e, n] = x.split(' ', 2).length === 2 ? [x.split(' ')[0], x.slice(x.indexOf(' ') + 1)] : ['🛒', x]; return { cat, emoji: e, name: n }; });
  const CATALOG = [
    ...C('obst', '🍎 Äpfel|🍌 Bananen|🍐 Birnen|🍇 Trauben|🍓 Erdbeeren|🫐 Heidelbeeren|🍊 Orangen|🍋 Zitronen|🥝 Kiwi|🍉 Wassermelone|🥭 Mango|🍍 Ananas|🥑 Avocado|🍅 Tomaten|🥒 Gurke|🥕 Karotten|🥔 Kartoffeln|🧅 Zwiebeln|🧄 Knoblauch|🫑 Paprika|🥦 Brokkoli|🥬 Salat|🥬 Spinat|🍄 Champignons|🌽 Mais|🥒 Zucchini|🍆 Aubergine|🌿 Basilikum|🌿 Petersilie|🫚 Ingwer|🥬 Rucola|🍠 Süßkartoffeln|🫛 Erbsen|🥬 Lauch|🥗 Blumenkohl'),
    ...C('kuehl', '🥛 Milch|🧈 Butter|🧀 Käse|🧀 Gouda|🧀 Mozzarella|🧀 Feta|🧀 Parmesan|🥚 Eier|🥣 Joghurt|🥣 Quark|🥛 Sahne|🥛 Schmand|🧀 Frischkäse|🥛 Hafermilch|🍮 Pudding|🥟 Tortellini|🧈 Margarine|🌭 Würstchen|🥓 Speck|🍕 Pizzateig'),
    ...C('fleisch', '🍗 Hähnchen|🥩 Hackfleisch|🥩 Steak|🍖 Schnitzel|🐟 Lachs|🍤 Garnelen|🐟 Thunfisch|🥓 Schinken|🍖 Salami|🦃 Putenbrust'),
    ...C('brot', '🍞 Brot|🥖 Baguette|🥐 Croissants|🥯 Brötchen|🍞 Toast|🥨 Brezeln|🫓 Wraps|🍰 Kuchen|🫓 Knäckebrot'),
    ...C('vorrat', '🍝 Nudeln|🍚 Reis|🥫 Tomatensoße|🥫 Passierte Tomaten|🥫 Kidneybohnen|🥫 Kichererbsen|🥫 Mais (Dose)|🫒 Oliven|🥣 Müsli|🥣 Haferflocken|🍯 Honig|🍓 Marmelade|🥜 Erdnussbutter|🍫 Nutella|☕ Kaffee|🍵 Tee|🫙 Linsen|🥫 Suppe|🍜 Ramen|🫒 Olivenöl|🌻 Sonnenblumenöl|🍶 Essig|🍶 Sojasoße|🥫 Ketchup|🥫 Mayo|🥫 Senf'),
    ...C('gewuerz', '🧂 Salz|🌶️ Pfeffer|🌶️ Paprikapulver|🌿 Oregano|🧂 Zucker|🌾 Mehl|🧁 Backpulver|🍫 Kakao|🌰 Nüsse|🍦 Vanillezucker|🥥 Kokosmilch|🧂 Brühe'),
    ...C('suess', '🍫 Schokolade|🍪 Kekse|🍬 Gummibärchen|🍿 Popcorn|🥨 Chips|🥜 Erdnüsse|🍦 Eis|🍩 Donuts|🍫 Riegel|🍭 Bonbons'),
    ...C('getraenke', '💧 Wasser|💧 Sprudel|🧃 Apfelsaft|🧃 Orangensaft|🥤 Cola|🥤 Limo|🍺 Bier|🍷 Wein|🍾 Sekt|🧋 Eistee|☕ Kaffeebohnen|🥤 Energy Drink'),
    ...C('tk', '🍕 Pizza|🍟 Pommes|🥦 TK-Gemüse|🍨 Eiscreme|🫐 TK-Beeren|🐟 Fischstäbchen|🥟 Maultaschen|🍤 TK-Garnelen'),
    ...C('haushalt', '🧻 Toilettenpapier|🧻 Küchenrolle|🧽 Schwämme|🧴 Spülmittel|🫧 Spülmaschinentabs|🧺 Waschmittel|🧺 Weichspüler|🗑️ Müllbeutel|🧹 Putzmittel|💡 Glühbirne|🔋 Batterien|🕯️ Kerzen|🍱 Frischhaltefolie|🧻 Taschentücher|🧯 Alufolie|🧺 Backpapier'),
    ...C('drogerie', '🪥 Zahnpasta|🪥 Zahnbürste|🧴 Shampoo|🧴 Duschgel|🧼 Seife|🧴 Bodylotion|🧴 Deo|🧴 Sonnencreme|🪒 Rasierer|🩹 Pflaster|💊 Schmerztabletten|🧴 Handcreme|💄 Lippenpflege|🧻 Wattepads|🩲 Binden|🧴 Haarspülung|🧴 Gesichtscreme'),
  ];
  // Vergleich ohne Groß/Klein und ohne Akzente („äpfel“ = „Äpfel“)
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim();
  const find = name => { const k = norm(name); return CATALOG.find(i => norm(i.name) === k) || null; };

  const api = { CATS, CATALOG, norm, find };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WIR_GROCERY = api;
})(typeof window !== 'undefined' ? window : this);
