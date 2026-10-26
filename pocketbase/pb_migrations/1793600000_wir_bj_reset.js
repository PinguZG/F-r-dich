/// <reference path="../pb_data/types.d.ts" />
// Blackjack zurücksetzen (26.10.2026): Nach dem Rückumzug ist das Blackjack-Fenster beim Zeichnen abgestürzt
// (fehlendes Guthaben-Element im neuen Kopf) – Runden konnten hängen bleiben. Diese Migration beendet alle nicht
// abgeschlossenen Runden beider Personen und erstattet den offenen Einsatz über coin_ledger
// (eigener Eintrag „Blackjack: Runde abgebrochen – Einsatz erstattet“, Schlüssel bj:<runde>:refund). Nichts wird gelöscht.
migrate((app) => {
  const open = app.findRecordsByFilter('casino_rounds', "status != 'done'", '', 500, 0);
  for (const r of open) {
    const rows = app.findRecordsByFilter('coin_ledger', "ref = {:r} && reason = 'bj'", '', 100, 0, { r: r.id });
    const net = rows.reduce((a, x) => a + x.getInt('amount'), 0);   // Einsätze negativ, Auszahlungen positiv
    const key = 'bj:' + r.id + ':refund';
    let done = false;
    try { app.findFirstRecordByFilter('coin_ledger', 'key = {:k}', { k: key }); done = true; } catch (_) { /* noch nicht */ }
    if (net < 0 && !done) {
      const uid = r.getString('user');
      const w = app.findFirstRecordByFilter('coin_wallets', 'user = {:u}', { u: uid });
      const after = w.getInt('balance') - net;
      w.set('balance', after);
      app.save(w);
      const l = new Record(app.findCollectionByNameOrId('coin_ledger'));
      l.set('user', uid); l.set('amount', -net); l.set('reason', 'bj');
      l.set('label', '🃏 Blackjack: Runde abgebrochen – Einsatz erstattet'); l.set('ref', r.id); l.set('key', key); l.set('balance_after', after);
      app.save(l);
    }
    r.set('status', 'done');
    r.set('result', net < 0 ? 'Abgebrochen – Einsatz erstattet' : 'Abgebrochen');
    app.save(r);
  }
}, () => { /* Erstattungen bleiben bestehen */ });
