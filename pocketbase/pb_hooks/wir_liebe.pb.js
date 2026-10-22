/// <reference path="../pb_data/types.d.ts" />
// Liebe senden: jeder Tipp bekommt eine Seriennummer (pings.series).
// Tipps innerhalb von 10 s nach dem letzten gehören zur selben Serie (1, 2, 3 …), danach beginnt sie wieder bei 1.
// Die Push-Benachrichtigung bündelt weiterhin wir-push (doLove, höchstens alle 5 Minuten eine).
// Gehört nach /home/pingu/pb/pb_hooks/ (zusammen mit wir_lib.js).

onRecordCreateRequest((e) => {
  const t = e.record.getString('type');
  if (t === 'love' || t === 'heart') {
    let n = 1;
    try {
      const [last] = e.app.findRecordsByFilter('pings', "from = {:f} && (type = 'love' || type = 'heart')", '-created', 1, 0,
        { f: e.record.getString('from') });
      const lib = require(`${__hooks}/wir_lib.js`);
      if (last && Date.now() - lib.fromPb(last.getString('created')) <= 10000) n = Math.max(1, last.getInt('series')) + 1;
    } catch (_) { /* erster Tipp */ }
    e.record.set('series', n);
  } else {
    e.record.set('series', 0);
  }
  e.next();
}, 'pings');
