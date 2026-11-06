/// <reference path="../pb_data/types.d.ts" />
// Automatische PocketBase-Backups (06.11.2026): täglich 03:00, die letzten 7 behalten (liegen in pb_data/backups).
// Nur setzen, wenn noch kein Zeitplan eingestellt ist – eine Einstellung im Admin-UI wird nie überschrieben.
// Der System-Status in Zuhause (home/extras.js) wird rot, wenn das letzte Backup älter als 4 Tage ist.
migrate((app) => {
  const s = app.settings();
  if (s.backups.cron) return;
  s.backups.cron = "0 3 * * *";
  s.backups.cronMaxKeep = 7;
  app.save(s);
}, (app) => {
  const s = app.settings();
  if (s.backups.cron !== "0 3 * * *") return;
  s.backups.cron = "";
  app.save(s);
});
