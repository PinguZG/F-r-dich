// Herzstadt – unser Immobilienspiel für zwei (eigene Straßen, eigene Karten, klassische Regeln).
// Dieselbe Datei läuft im Browser (globales Mono, nur Brett + Anzeige-Hilfen) und in pb_hooks (require, ganze Spiellogik).
// Der Server würfelt und entscheidet alles; der Browser zeigt nur an.
var Mono = (function () {
  var START_CASH = 1500, GO_SALARY = 200, JAIL_POS = 10, JAIL_FINE = 50, HOUSES = 32, HOTELS = 12;

  // Farben der Straßengruppen
  var GROUPS = [
    { name: 'Braun', color: '#b07a52' }, { name: 'Hellblau', color: '#8fd3f4' }, { name: 'Pink', color: '#e86aa8' },
    { name: 'Orange', color: '#f6a04d' }, { name: 'Rot', color: '#e5484d' }, { name: 'Gelb', color: '#f3d046' },
    { name: 'Grün', color: '#46b072' }, { name: 'Dunkelblau', color: '#4659d6' },
  ];
  function st(n, e, g, p, h, r) { return { t: 'street', n: n, e: e, g: g, p: p, h: h, r: r }; }
  var BOARD = [
    { t: 'go', n: 'Los', e: '💗' },
    st('Gartenweg', '🌷', 0, 60, 50, [2, 10, 30, 90, 160, 250]),
    { t: 'chest', n: 'Liebesbrief', e: '💌' },
    st('Kirschallee', '🍒', 0, 60, 50, [4, 20, 60, 180, 320, 450]),
    { t: 'tax', n: 'Shopping-Steuer', e: '🛍️', amt: 200 },
    { t: 'station', n: 'Hauptbahnhof', e: '🚉', p: 200 },
    st('Eisdiele', '🍦', 1, 100, 50, [6, 30, 90, 270, 400, 550]),
    { t: 'chance', n: 'Überraschung', e: '🎁' },
    st('Bäckerei', '🥐', 1, 100, 50, [6, 30, 90, 270, 400, 550]),
    st('Blumenladen', '💐', 1, 120, 50, [8, 40, 100, 300, 450, 600]),
    { t: 'jail', n: 'Gefängnis', e: '🔒' },
    st('Kinoplatz', '🎬', 2, 140, 100, [10, 50, 150, 450, 625, 750]),
    { t: 'util', n: 'Stadtwerke', e: '⚡', p: 150 },
    st('Bowlingbahn', '🎳', 2, 140, 100, [10, 50, 150, 450, 625, 750]),
    st('Café Herz', '☕', 2, 160, 100, [12, 60, 180, 500, 700, 900]),
    { t: 'station', n: 'Busbahnhof', e: '🚌', p: 200 },
    st('Rosenstraße', '🌹', 3, 180, 100, [14, 70, 200, 550, 750, 950]),
    { t: 'chest', n: 'Liebesbrief', e: '💌' },
    st('Sonnenweg', '🌻', 3, 180, 100, [14, 70, 200, 550, 750, 950]),
    st('Pizzeria', '🍕', 3, 200, 100, [16, 80, 220, 600, 800, 1000]),
    { t: 'parking', n: 'Kuschelpause', e: '🛋️' },
    st('Strandpromenade', '🏖️', 4, 220, 150, [18, 90, 250, 700, 875, 1050]),
    { t: 'chance', n: 'Überraschung', e: '🎁' },
    st('Hafen', '⚓', 4, 220, 150, [18, 90, 250, 700, 875, 1050]),
    st('Riesenrad', '🎡', 4, 240, 150, [20, 100, 300, 750, 925, 1100]),
    { t: 'station', n: 'Fähre', e: '⛴️', p: 200 },
    st('Museumsufer', '🏛️', 5, 260, 150, [22, 110, 330, 800, 975, 1150]),
    st('Theaterplatz', '🎭', 5, 260, 150, [22, 110, 330, 800, 975, 1150]),
    { t: 'util', n: 'Wasserwerk', e: '💧', p: 150 },
    st('Botanischer Garten', '🌿', 5, 280, 150, [24, 120, 360, 850, 1025, 1200]),
    { t: 'gojail', n: 'Ab ins Gefängnis', e: '👮' },
    st('Schlosspark', '🏰', 6, 300, 200, [26, 130, 390, 900, 1100, 1275]),
    st('Seeufer', '🦢', 6, 300, 200, [26, 130, 390, 900, 1100, 1275]),
    { t: 'chest', n: 'Liebesbrief', e: '💌' },
    st('Sternwarte', '🔭', 6, 320, 200, [28, 150, 450, 1000, 1200, 1400]),
    { t: 'station', n: 'Flughafen', e: '✈️', p: 200 },
    { t: 'chance', n: 'Überraschung', e: '🎁' },
    st('Herzallee', '💞', 7, 350, 200, [35, 175, 500, 1100, 1300, 1500]),
    { t: 'tax', n: 'Luxussteuer', e: '💎', amt: 100 },
    st('Traumvilla', '🏡', 7, 400, 200, [50, 200, 600, 1400, 1700, 2000]),
  ];
  var STATION_RENT = [0, 25, 50, 100, 200];

  // Karten: k = Art, Text in der Du-Form
  var CHANCE = [
    { k: 'goto', to: 0, x: 'Rücke vor bis Los und kassiere 200 €.' },
    { k: 'goto', to: 24, x: 'Ab aufs Riesenrad! Rücke vor bis zum Riesenrad. Kommst du über Los, kassiere 200 €.' },
    { k: 'goto', to: 11, x: 'Kinoabend! Rücke vor bis zum Kinoplatz. Kommst du über Los, kassiere 200 €.' },
    { k: 'near', w: 'station', x: 'Rücke vor zum nächsten Bahnhof. Gehört er schon jemandem, zahlst du die doppelte Miete.' },
    { k: 'near', w: 'station', x: 'Spontaner Ausflug: Rücke vor zum nächsten Bahnhof. Gehört er jemandem, zahlst du die doppelte Miete.' },
    { k: 'near', w: 'util', x: 'Rücke vor zum nächsten Werk. Gehört es jemandem, zahlst du das Zehnfache deines Wurfs.' },
    { k: 'money', n: 50, x: 'Deine Sparbüchse ist voll – du bekommst 50 €.' },
    { k: 'free', x: 'Du kommst aus dem Gefängnis frei. Behalte diese Karte, bis du sie brauchst.' },
    { k: 'back', n: 3, x: 'Hoppla, vergessen! Gehe 3 Felder zurück.' },
    { k: 'jail', x: 'Zu laut gekuschelt – gehe direkt ins Gefängnis. Gehe nicht über Los.' },
    { k: 'repair', h: 25, H: 100, x: 'Frühjahrsputz: Zahle 25 € pro Haus und 100 € pro Hotel.' },
    { k: 'money', n: -15, x: 'Falsch geparkt beim Date – zahle 15 €.' },
    { k: 'goto', to: 5, x: 'Fahrt zum Hauptbahnhof. Kommst du über Los, kassiere 200 €.' },
    { k: 'goto', to: 39, x: 'Besichtigung der Traumvilla! Rücke vor bis zur Traumvilla.' },
    { k: 'each', n: -50, x: 'Du lädst zum Essen ein – zahle der anderen Person 50 €.' },
    { k: 'money', n: 150, x: 'Dein Bausparvertrag ist fällig – du bekommst 150 €.' },
  ];
  var CHEST = [
    { k: 'goto', to: 0, x: 'Rücke vor bis Los und kassiere 200 €.' },
    { k: 'money', n: 200, x: 'Die Bank hat sich verrechnet – zu deinen Gunsten! Du bekommst 200 €.' },
    { k: 'money', n: -50, x: 'Arztbesuch – zahle 50 €.' },
    { k: 'money', n: 50, x: 'Du verkaufst alte Sachen auf dem Flohmarkt und bekommst 50 €.' },
    { k: 'free', x: 'Du kommst aus dem Gefängnis frei. Behalte diese Karte, bis du sie brauchst.' },
    { k: 'jail', x: 'Gehe direkt ins Gefängnis. Gehe nicht über Los.' },
    { k: 'money', n: 100, x: 'Urlaubsgeld! Du bekommst 100 €.' },
    { k: 'money', n: 20, x: 'Steuerrückzahlung – du bekommst 20 €.' },
    { k: 'each', n: 10, x: 'Du hast Geburtstag! Die andere Person schenkt dir 10 €.' },
    { k: 'money', n: 100, x: 'Deine Lebensversicherung wird fällig – du bekommst 100 €.' },
    { k: 'money', n: -100, x: 'Krankenhausrechnung – zahle 100 €.' },
    { k: 'money', n: -50, x: 'Kursgebühr für den Tanzkurs – zahle 50 €.' },
    { k: 'money', n: 25, x: 'Du hilfst beim Umzug und bekommst 25 €.' },
    { k: 'repair', h: 40, H: 115, x: 'Straßenausbau: Zahle 40 € pro Haus und 115 € pro Hotel.' },
    { k: 'money', n: 10, x: 'Zweiter Platz beim Schönheitswettbewerb – du bekommst 10 €.' },
    { k: 'money', n: 100, x: 'Du erbst 100 €.' },
  ];
  var DECKS = { c: CHANCE, s: CHEST };

  // ---------------- Hilfen (auch für die Anzeige) ----------------
  var isProp = function (i) { var t = BOARD[i] && BOARD[i].t; return t === 'street' || t === 'station' || t === 'util'; };
  function groupFields(g) { var out = []; for (var i = 0; i < 40; i++) if (BOARD[i].t === 'street' && BOARD[i].g === g) out.push(i); return out; }
  function ownsGroup(s, p, g) { return groupFields(g).every(function (i) { return s.own[i] === p; }); }
  function count(s, p, t) { var n = 0; for (var i = 0; i < 40; i++) if (BOARD[i].t === t && s.own[i] === p) n++; return n; }
  function houses(s, i) { return s.hs[i] || 0; }
  function groupHasHouses(s, i) { var f = BOARD[i]; return f.t === 'street' && groupFields(f.g).some(function (j) { return houses(s, j) > 0; }); }
  function mortgageValue(i) { return BOARD[i].p / 2; }
  function unmortgageCost(i) { return Math.ceil(BOARD[i].p / 2 * 1.1); }

  // Miete für Feld i (diceSum für Werke; opt.double: doppelte Bahnhofsmiete; opt.util10: zehnfach)
  function rentOf(s, i, diceSum, opt) {
    opt = opt || {};
    var f = BOARD[i], owner = s.own[i];
    if (owner == null || s.mort[i]) return 0;
    if (f.t === 'street') {
      var h = houses(s, i);
      if (h) return f.r[h];
      return f.r[0] * (ownsGroup(s, owner, f.g) ? 2 : 1);
    }
    if (f.t === 'station') return STATION_RENT[count(s, owner, 'station')] * (opt.double ? 2 : 1);
    if (f.t === 'util') return (opt.util10 || count(s, owner, 'util') === 2 ? 10 : 4) * (diceSum || 0);
    return 0;
  }

  // Vermögen (Geld + Grundstückswert + Häuser) – für die Anzeige
  function worth(s, p) {
    var w = s.players[p].cash;
    for (var i = 0; i < 40; i++) if (s.own[i] === p) {
      w += s.mort[i] ? BOARD[i].p / 2 : BOARD[i].p;
      if (BOARD[i].t === 'street') w += houses(s, i) * BOARD[i].h;
    }
    return w;
  }
  // so viel Geld könnte p noch auftreiben (Häuser verkaufen + Hypotheken)
  function raisable(s, p) {
    var w = s.players[p].cash;
    for (var i = 0; i < 40; i++) if (s.own[i] === p) {
      if (BOARD[i].t === 'street') w += houses(s, i) * BOARD[i].h / 2;
      if (!s.mort[i]) w += BOARD[i].p / 2;
    }
    return w;
  }
  // wer muss gerade etwas tun? (Liste von Spieler-Indizes)
  function waiting(s) {
    if (s.winner != null) return [];
    if (s.phase === 'auction') return [0, 1].filter(function (p) { return s.pend.bids[p] == null; });
    if (s.phase === 'debt') return [s.pend.who];
    return [s.turn];
  }

  // ---------------- Spiellogik (nur auf dem Server) ----------------
  function Err(msg, status) { var e = new Error(msg); e.status = status || 400; return e; }

  function newState(rnd) {
    var mk = function () { return { cash: START_CASH, pos: 0, jail: 0, cards: [] }; };
    return {
      v: 0, players: [mk(), mk()], turn: 0, phase: 'roll', dice: null, dbl: 0, again: false,
      own: {}, hs: {}, mort: {}, pend: null, trade: null, card: null, winner: null,
      decks: { c: shuffle(16, rnd), s: shuffle(16, rnd) }, ptr: { c: 0, s: 0 },
      bank: { h: HOUSES, H: HOTELS }, log: [],
    };
  }
  function shuffle(n, rnd) {
    var a = []; for (var i = 0; i < n; i++) a.push(i);
    for (var j = n - 1; j > 0; j--) { var k = Math.floor(rnd() * (j + 1)); var t = a[j]; a[j] = a[k]; a[k] = t; }
    return a;
  }

  function act(s, me, a, ctx) {
    // ctx: { rnd, names: [name0, name1] }
    var N = function (p) { return ctx.names[p] || 'Spieler ' + (p + 1); };
    var log = function (m) { s.log.push({ t: Date.now(), m: m }); if (s.log.length > 80) s.log.splice(0, s.log.length - 80); };
    var P = s.players;
    var other = 1 - me;
    var need = function (c, msg) { if (!c) throw Err(msg); };
    var myTurn = function () { need(s.turn === me, 'Du bist gerade nicht dran.'); };
    var cash = function (p, n) { P[p].cash += n; };

    if (s.winner != null) throw Err('Das Spiel ist schon vorbei.', 409);

    // ---- Bewegung + Felder ----
    function goJail(p) {
      P[p].pos = JAIL_POS; P[p].jail = 1; s.dbl = 0; s.again = false;
      log('🔒 ' + N(p) + ' muss ins Gefängnis.');
    }
    function moveTo(p, to, viaGo) {
      if (viaGo && to <= P[p].pos) { cash(p, GO_SALARY); log('💗 ' + N(p) + ' kommt über Los: +' + GO_SALARY + ' €'); }
      P[p].pos = to;
    }
    function after() {
      s.pend = null;
      s.phase = s.again && !P[s.turn].jail ? 'roll' : 'end';
    }
    // zahlen; reicht das Geld nicht, beginnt die Schuldenphase und es geht nach dem Bezahlen mit next weiter
    function charge(from, to, amt, next, why) {
      if (amt <= 0) return true;
      if (P[from].cash >= amt) {
        cash(from, -amt); if (to >= 0) cash(to, amt);
        return true;
      }
      s.phase = 'debt';
      s.pend = { who: from, to: to, amt: amt, next: next, why: why || '' };
      log('⚠️ ' + N(from) + ' fehlen ' + (amt - P[from].cash) + ' € – erst Geld auftreiben (Häuser verkaufen, Hypothek) oder aufgeben.');
      return false;
    }
    function land(p, opt) {
      opt = opt || {};
      var i = P[p].pos, f = BOARD[i];
      if (isProp(i)) {
        var owner = s.own[i];
        if (owner == null) { s.phase = 'buy'; s.pend = { f: i }; return; }
        if (owner === p) { log(N(p) + ' landet auf eigenem Feld ' + f.n + '.'); return after(); }
        if (s.mort[i]) { log(N(p) + ' landet auf ' + f.n + ' (Hypothek – keine Miete).'); return after(); }
        var sum = s.dice ? s.dice[0] + s.dice[1] : 0;
        var rent = rentOf(s, i, sum, opt);
        log('🏠 ' + N(p) + ' zahlt ' + rent + ' € Miete an ' + N(owner) + ' (' + f.n + ').');
        if (charge(p, owner, rent, { k: 'after' }, 'Miete ' + f.n)) after();
        return;
      }
      if (f.t === 'tax') {
        log('💸 ' + N(p) + ' zahlt ' + f.amt + ' € ' + f.n + '.');
        if (charge(p, -1, f.amt, { k: 'after' }, f.n)) after();
        return;
      }
      if (f.t === 'chance' || f.t === 'chest') return draw(p, f.t === 'chance' ? 'c' : 's');
      if (f.t === 'gojail') { goJail(p); return after(); }
      if (f.t === 'jail') log(N(p) + ' ist nur zu Besuch im Gefängnis.');
      if (f.t === 'parking') log('🛋️ ' + N(p) + ' macht Kuschelpause.');
      after();
    }
    function draw(p, d) {
      var deck = DECKS[d], order = s.decks[d], card = null, idx = -1;
      for (var tries = 0; tries < 16; tries++) {
        idx = order[s.ptr[d] % 16]; s.ptr[d] = (s.ptr[d] + 1) % 16;
        card = deck[idx];
        // Gefängnis-frei-Karte, die gerade jemand hat, überspringen
        var held = P[0].cards.concat(P[1].cards).indexOf(d) >= 0;
        if (!(card.k === 'free' && held)) break;
      }
      s.card = { d: d, i: idx, by: p, t: Date.now() };
      log((d === 'c' ? '🎁 Überraschung' : '💌 Liebesbrief') + ' für ' + N(p) + ': ' + card.x);
      var pos = P[p].pos;
      switch (card.k) {
        case 'goto': moveTo(p, card.to, true); return land(p);
        case 'near': {
          var j = pos;
          do { j = (j + 1) % 40; } while (BOARD[j].t !== card.w);
          moveTo(p, j, true);
          return land(p, card.w === 'station' ? { double: true } : { util10: true });
        }
        case 'back': P[p].pos = (pos + 37) % 40; return land(p);
        case 'jail': goJail(p); return after();
        case 'free': P[p].cards.push(d); return after();
        case 'money':
          if (card.n > 0) { cash(p, card.n); return after(); }
          if (charge(p, -1, -card.n, { k: 'after' }, 'Karte')) after();
          return;
        case 'each':
          if (card.n > 0) { if (charge(1 - p, p, card.n, { k: 'after' }, 'Geschenk')) after(); return; }
          if (charge(p, 1 - p, -card.n, { k: 'after' }, 'Karte')) after();
          return;
        case 'repair': {
          var h = 0, H = 0;
          for (var k = 0; k < 40; k++) if (s.own[k] === p) { var x = houses(s, k); if (x === 5) H++; else h += x; }
          var amt = h * card.h + H * card.H;
          log(N(p) + ' hat ' + h + ' Häuser und ' + H + ' Hotels: ' + amt + ' €.');
          if (charge(p, -1, amt, { k: 'after' }, 'Renovierung')) after();
          return;
        }
      }
      after();
    }
    function moveLand(p, steps) {
      var to = (P[p].pos + steps) % 40;
      moveTo(p, to, true);
      land(p);
    }
    function cont(next) {
      if (next.k === 'jailmove') return moveLand(s.turn, next.n);
      after();
    }
    function rolls() { return [1 + Math.floor(ctx.rnd() * 6), 1 + Math.floor(ctx.rnd() * 6)]; }

    // Häuser/Hotels/Hypotheken: erlaubt, solange keine Versteigerung läuft
    function propCheck(i) {
      need(isProp(i), 'Kein Grundstück.');
      need(s.own[i] === me, 'Das gehört dir nicht.');
      need(s.phase !== 'auction', 'Erst die Versteigerung beenden.');
    }

    switch (a.type) {
      case 'roll': {
        myTurn(); need(s.phase === 'roll', 'Gerade wird nicht gewürfelt.');
        var d = rolls(), sum = d[0] + d[1], dbl = d[0] === d[1];
        s.dice = d; s.card = null;
        var p = P[me];
        if (p.jail) {
          if (dbl) {
            p.jail = 0; s.again = false;
            log('🎲 ' + N(me) + ' würfelt ' + d[0] + '+' + d[1] + ' – Pasch, raus aus dem Gefängnis!');
            return moveLand(me, sum);
          }
          p.jail++;
          if (p.jail > 3) {
            p.jail = 0; s.again = false;
            log('🎲 ' + N(me) + ' würfelt ' + d[0] + '+' + d[1] + ' – dritter Versuch ohne Pasch, zahlt ' + JAIL_FINE + ' € und zieht.');
            if (charge(me, -1, JAIL_FINE, { k: 'jailmove', n: sum }, 'Gefängnis')) moveLand(me, sum);
            return;
          }
          log('🎲 ' + N(me) + ' würfelt ' + d[0] + '+' + d[1] + ' – kein Pasch, bleibt im Gefängnis (Versuch ' + (p.jail - 1) + '/3).');
          s.phase = 'end';
          return;
        }
        if (dbl) {
          s.dbl++;
          if (s.dbl >= 3) { log('🎲 ' + N(me) + ' würfelt den dritten Pasch hintereinander!'); goJail(me); return after(); }
        } else s.dbl = 0;
        s.again = dbl;
        log('🎲 ' + N(me) + ' würfelt ' + d[0] + '+' + d[1] + (dbl ? ' (Pasch!)' : '') + '.');
        return moveLand(me, sum);
      }
      case 'jailpay':
        myTurn(); need(s.phase === 'roll' && P[me].jail, 'Du bist nicht im Gefängnis.');
        need(P[me].cash >= JAIL_FINE, 'Nicht genug Geld.');
        cash(me, -JAIL_FINE); P[me].jail = 0;
        log('🔓 ' + N(me) + ' zahlt ' + JAIL_FINE + ' € und ist frei.');
        return;
      case 'jailcard':
        myTurn(); need(s.phase === 'roll' && P[me].jail, 'Du bist nicht im Gefängnis.');
        need(P[me].cards.length, 'Du hast keine Gefängnis-frei-Karte.');
        P[me].cards.shift(); P[me].jail = 0;
        log('🔓 ' + N(me) + ' nutzt die Gefängnis-frei-Karte.');
        return;
      case 'buy': {
        myTurn(); need(s.phase === 'buy', 'Gerade gibt es nichts zu kaufen.');
        var f = s.pend.f;
        need(P[me].cash >= BOARD[f].p, 'Nicht genug Geld – du kannst es versteigern.');
        cash(me, -BOARD[f].p); s.own[f] = me;
        log('✨ ' + N(me) + ' kauft ' + BOARD[f].n + ' für ' + BOARD[f].p + ' €.');
        return after();
      }
      case 'decline':
        myTurn(); need(s.phase === 'buy', 'Gerade gibt es nichts zu kaufen.');
        s.phase = 'auction'; s.pend = { f: s.pend.f, bids: {} };
        log('🔨 ' + BOARD[s.pend.f].n + ' wird versteigert – beide bieten verdeckt.');
        return;
      case 'bid': {
        need(s.phase === 'auction', 'Es läuft keine Versteigerung.');
        need(s.pend.bids[me] == null, 'Du hast schon geboten.');
        var amt = Math.floor(Number(a.amount) || 0);
        need(amt >= 0 && amt <= P[me].cash, 'Gebot muss zwischen 0 und deinem Geld liegen.');
        s.pend.bids[me] = amt;
        if (s.pend.bids[other] == null) { log('🔨 ' + N(me) + ' hat geboten.'); return; }
        var b0 = s.pend.bids[0], b1 = s.pend.bids[1], fld = s.pend.f;
        log('🔨 Gebote: ' + N(0) + ' ' + b0 + ' €, ' + N(1) + ' ' + b1 + ' €.');
        if (b0 === b1 || Math.max(b0, b1) <= 0) log('Niemand ersteigert ' + BOARD[fld].n + ' – es bleibt bei der Bank.');
        else {
          var w = b0 > b1 ? 0 : 1;
          cash(w, -Math.max(b0, b1)); s.own[fld] = w;
          log('🎉 ' + N(w) + ' ersteigert ' + BOARD[fld].n + ' für ' + Math.max(b0, b1) + ' €.');
        }
        return after();
      }
      case 'end':
        myTurn(); need(s.phase === 'end', 'Erst würfeln bzw. das Feld abschließen.');
        s.turn = other; s.phase = 'roll'; s.dbl = 0; s.again = false; s.card = null;
        return;
      case 'pay': {
        need(s.phase === 'debt' && s.pend.who === me, 'Du hast keine offenen Schulden.');
        var pd = s.pend;
        need(P[me].cash >= pd.amt, 'Noch nicht genug Geld (' + P[me].cash + ' von ' + pd.amt + ' €).');
        cash(me, -pd.amt); if (pd.to >= 0) cash(pd.to, pd.amt);
        log('✅ ' + N(me) + ' zahlt ' + pd.amt + ' €' + (pd.to >= 0 ? ' an ' + N(pd.to) : '') + '.');
        s.pend = null;
        return cont(pd.next);
      }
      case 'build': {
        var i = Math.floor(a.field); propCheck(i);
        var fb = BOARD[i];
        need(fb.t === 'street', 'Hier kann man nicht bauen.');
        need(ownsGroup(s, me, fb.g), 'Dir gehört noch nicht die ganze Farbgruppe.');
        var gf = groupFields(fb.g);
        need(gf.every(function (j) { return !s.mort[j]; }), 'In der Gruppe ist noch eine Hypothek.');
        var hn = houses(s, i);
        need(hn < 5, 'Hier steht schon ein Hotel.');
        need(gf.every(function (j) { return houses(s, j) >= hn; }), 'Gleichmäßig bauen: erst auf den anderen Straßen der Gruppe.');
        need(P[me].cash >= fb.h, 'Nicht genug Geld.');
        if (hn === 4) { need(s.bank.H > 0, 'Die Bank hat keine Hotels mehr.'); s.bank.H--; s.bank.h += 4; }
        else { need(s.bank.h > 0, 'Die Bank hat keine Häuser mehr.'); s.bank.h--; }
        cash(me, -fb.h); s.hs[i] = hn + 1;
        log('🏗️ ' + N(me) + ' baut ' + (hn === 4 ? 'ein Hotel' : 'ein Haus') + ' auf ' + fb.n + '.');
        return;
      }
      case 'sell': {
        var si = Math.floor(a.field); propCheck(si);
        var fs = BOARD[si], sn = houses(s, si);
        need(sn > 0, 'Hier steht nichts.');
        need(groupFields(fs.g).every(function (j) { return houses(s, j) <= sn; }), 'Gleichmäßig verkaufen: erst die anderen Straßen der Gruppe.');
        if (sn === 5) { need(s.bank.h >= 4, 'Die Bank hat nicht genug Häuser, um das Hotel zu tauschen.'); s.bank.h -= 4; s.bank.H++; }
        else s.bank.h++;
        s.hs[si] = sn - 1; cash(me, fs.h / 2);
        log('🔻 ' + N(me) + ' verkauft ' + (sn === 5 ? 'ein Hotel' : 'ein Haus') + ' auf ' + fs.n + ' (+' + fs.h / 2 + ' €).');
        return;
      }
      case 'mortgage': {
        var mi = Math.floor(a.field); propCheck(mi);
        need(!s.mort[mi], 'Schon mit Hypothek belastet.');
        need(!groupHasHouses(s, mi), 'Erst alle Häuser der Farbgruppe verkaufen.');
        s.mort[mi] = true; cash(me, mortgageValue(mi));
        log('🏦 ' + N(me) + ' nimmt eine Hypothek auf ' + BOARD[mi].n + ' auf (+' + mortgageValue(mi) + ' €).');
        return;
      }
      case 'unmortgage': {
        var ui = Math.floor(a.field); propCheck(ui);
        need(s.mort[ui], 'Keine Hypothek.');
        need(P[me].cash >= unmortgageCost(ui), 'Nicht genug Geld.');
        cash(me, -unmortgageCost(ui)); delete s.mort[ui];
        log('🏦 ' + N(me) + ' löst die Hypothek auf ' + BOARD[ui].n + ' ab (−' + unmortgageCost(ui) + ' €).');
        return;
      }
      case 'bankrupt':
        s.winner = other; s.phase = 'over'; s.pend = null; s.trade = null;
        log('🏳️ ' + N(me) + ' gibt auf – ' + N(other) + ' gewinnt Herzstadt! 🎉');
        return;
      case 'trade': {
        need(!s.trade, 'Es gibt schon ein Angebot.');
        need(s.phase !== 'auction', 'Erst die Versteigerung beenden.');
        var t = cleanTrade(a);
        checkTrade(s, me, t);
        need(t.give.cash || t.get.cash || t.give.f.length || t.get.f.length || t.give.cards || t.get.cards, 'Leeres Angebot.');
        s.trade = { from: me, give: t.give, get: t.get, t: Date.now() };
        log('🤝 ' + N(me) + ' macht ein Tauschangebot.');
        return;
      }
      case 'trade_cancel':
        need(s.trade && s.trade.from === me, 'Kein eigenes Angebot.');
        s.trade = null; log('🤝 ' + N(me) + ' zieht das Angebot zurück.');
        return;
      case 'trade_decline':
        need(s.trade && s.trade.from === other, 'Kein Angebot.');
        s.trade = null; log('🤝 ' + N(me) + ' lehnt das Angebot ab.');
        return;
      case 'trade_accept': {
        need(s.trade && s.trade.from === other, 'Kein Angebot.');
        need(s.phase !== 'auction', 'Erst die Versteigerung beenden.');
        var tr = s.trade;
        checkTrade(s, other, tr);
        var from = other, to = me;
        cash(from, -tr.give.cash + tr.get.cash); cash(to, tr.give.cash - tr.get.cash);
        tr.give.f.forEach(function (x) { s.own[x] = to; });
        tr.get.f.forEach(function (x) { s.own[x] = from; });
        for (var c1 = 0; c1 < tr.give.cards; c1++) P[to].cards.push(P[from].cards.shift());
        for (var c2 = 0; c2 < tr.get.cards; c2++) P[from].cards.push(P[to].cards.shift());
        s.trade = null;
        log('🤝 Tausch: ' + N(from) + ' gibt ' + tradeText(tr.give) + ', ' + N(to) + ' gibt ' + tradeText(tr.get) + '.');
        return;
      }
    }
    throw Err('Unbekannte Aktion');
  }

  function cleanTrade(a) {
    var side = function (x) {
      x = x || {};
      var f = Array.isArray(x.f) ? x.f.map(function (n) { return Math.floor(n); }) : [];
      return { cash: Math.max(0, Math.floor(Number(x.cash) || 0)), f: f.filter(function (n, k) { return f.indexOf(n) === k; }), cards: Math.max(0, Math.floor(Number(x.cards) || 0)) };
    };
    return { give: side(a.give), get: side(a.get) };
  }
  function checkTrade(s, from, t) {
    var to = 1 - from, P = s.players;
    var ok = function (c, m) { if (!c) throw Err(m, 409); };
    ok(P[from].cash >= t.give.cash, 'Nicht genug Geld für das Angebot.');
    ok(P[to].cash >= t.get.cash, 'Die andere Person hat nicht so viel Geld.');
    ok(P[from].cards.length >= t.give.cards && P[to].cards.length >= t.get.cards, 'Gefängnis-frei-Karten passen nicht.');
    t.give.f.forEach(function (i) { ok(isProp(i) && s.own[i] === from, 'Ein Grundstück gehört nicht mehr dir.'); ok(!groupHasHouses(s, i), 'Grundstücke mit Häusern in der Gruppe kann man nicht tauschen.'); });
    t.get.f.forEach(function (i) { ok(isProp(i) && s.own[i] === to, 'Ein Grundstück gehört nicht mehr der anderen Person.'); ok(!groupHasHouses(s, i), 'Grundstücke mit Häusern in der Gruppe kann man nicht tauschen.'); });
  }
  function tradeText(x) {
    var parts = x.f.map(function (i) { return BOARD[i].n; });
    if (x.cash) parts.push(x.cash + ' €');
    if (x.cards) parts.push(x.cards + '× Gefängnis-frei');
    return parts.length ? parts.join(', ') : 'nichts';
  }

  return {
    BOARD: BOARD, GROUPS: GROUPS, DECKS: DECKS, STATION_RENT: STATION_RENT, START_CASH: START_CASH,
    isProp: isProp, groupFields: groupFields, ownsGroup: ownsGroup, houses: houses, rentOf: rentOf, worth: worth, raisable: raisable,
    waiting: waiting, mortgageValue: mortgageValue, unmortgageCost: unmortgageCost, groupHasHouses: groupHasHouses, tradeText: tradeText,
    newState: newState, act: act,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Mono;
