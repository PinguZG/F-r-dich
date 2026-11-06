# Wir – private Paar-App (PWA) für Daniel und Partnerin

Fotos, Dates, Briefe, Liebe-Pings, Chat, Spiele (nur Spielgeld) und „Zuhause“ (Smart Home über Home Assistant).
Frontend: plain JS/CSS (kein Build). Backend: PocketBase 0.40.5 + JS-Hooks, dazu zwei Node-Dienste.

## Repo-Struktur
- `index.html` (Root) = alte Seite, nicht mehr die App. **Die App liegt in `app/`** (PocketBase liefert `app/` direkt aus dem Repo aus: `--publicDir=/home/pingu/F-r-dich/app`).
- `app/`: `index.html` (alle Screens), `app.js` (Kern, Pings, Push-Public-Key), `style.css`/`layout.css`/`a1.css`, `sw.js` (Cache-Version), Bereiche je Datei (`chat.js`, `games.js`, `poker.js`, `zuhause*.js/.css` …).
- `shared/`: `base.css` (Farbwelten-Variablen, Glas, Schriften), `ui.js`, `push.js`, `update.js`, `activity.js`, `pocketbase.umd.js`.
- `pocketbase/pb_hooks/`: Server-Logik (`wir_*.pb.js` = Routen/Hooks, `*_lib.js` = Hilfen). `pb_migrations/`: Schema. `ANLEITUNG.md`: Doku + Rücksetz-Wege je Update.
- `push/`: Dienst `wir-push` (Web-Push). `home/`: Dienst `wir-home` (Brücke zu Home Assistant; Freigabeliste `home/config.jsonc`, Extras in `home/extras.js`).
- `ha/packages/`: HA-Pakete. `deploy/`: Auto-Deploy (`autodeploy.sh`, systemd-Timer, sudoers). `docs/zuhause/`: Entwürfe.

## Server (seit 04.11.2026 VPS, nicht mehr der Pi)
- Live: https://wir.geep-flops.ts.net (Tailscale Funnel 443 → 127.0.0.1:8090). SSH: `ssh pingu@wir` (VPS, Debian 13, x86_64). `wir-pi` = Rückfallebene, Dienste aus.
- Pfade: `/home/pingu/pb` (PocketBase, `pb_data`, `pb_hooks`, `pb_migrations`), `/home/pingu/F-r-dich` (Repo), `/home/pingu/backups`.
- Dienste: `pocketbase`, `wir-push`, `wir-home`, `wir-deploy.timer` (alle 2 Min.). Logs: `journalctl -u <dienst> -n 50 --no-pager`.
- Auto-Deploy: `git pull --ff-only` von origin/main, kopiert `pb_hooks`/`pb_migrations` nach `/home/pingu/pb`, startet nur Geänderte neu. Bricht ab bei lokalen Änderungen oder nicht-fast-forward → **nie force-pushen**.
- sudo nur über Daniel (fragen). Secrets nur in `/etc/wir-push.env`, `/etc/wir-home.env` (root, 600).

## Workflow für jede Änderung
1. Git-Tag `vor-<thema>` auf den aktuellen Stand setzen und pushen.
2. DB-Backup nach `/home/pingu/backups/vor-<thema>-<YYYY-MM-DD>/`: `data.db`, `auxiliary.db` per `sqlite3 … ".backup …"` (konsistent), `PRAGMA integrity_check` = ok, dazu `storage/`, `pb_migrations/`, `pb_hooks/`.
3. Schema nur additiv per neuer Datei in `pocketbase/pb_migrations/` (nichts umbenennen/löschen).
4. Sicherheit serverseitig (Hooks/Regeln prüfen Nutzer, Werte, Rechte) – nie dem Client vertrauen.
5. Keine Secrets ins Repo (öffentlich!). VAPID-Keys nie neu erzeugen (Public-Key in `app/app.js` muss zu `/etc/wir-push.env` passen).
6. Bei App-Änderungen `const CACHE = 'wir-vNN'` in `app/sw.js` hochzählen (sonst kein Update-Hinweis auf den iPhones).
7. Abschnitt in `pocketbase/ANLEITUNG.md`: was neu, Datenbank, Sicherung, **Rücksetz-Weg** (`git checkout vor-<thema> -- …`, kein reset/force).
8. Committen, pushen, einmal `deploy-check` nutzen, live prüfen (Logs, Endpunkt).
- JS-Syntax vor dem Push prüfen: `node --check <datei>` (Hooks/Node-Dienste).

## Design-Regeln
- Glas-Karten (`--card`, `--card-line`, Blur), runde Formen.
- Farben nur über CSS-Variablen je Farbwelt (`html[data-theme="…"]` in `shared/base.css`); jede Farbwelt muss passen.
- Schriften: Quicksand (Text), Caveat (Handschrift).
- Mobile first (iPhone-PWA), Safe Areas (`env(safe-area-inset-*)`), Tablet/PC als Zusatz.
- Keine neuen Reiter in der unteren Leiste (Start · Erinnerungen · Zuhause · Spiele · Wir zwei) – Neues in bestehende Bereiche.

## Lokale Vorschau
- `node dev/lokal.js` bzw. Vorschau `wir-lokal` (.claude/launch.json) → http://127.0.0.1:8090, leere Test-DB, Test-Zugänge in `lokal/zugang.env` (nie ausgeben). UI-Änderungen erst dort im Browser-Bereich prüfen (Handy-Größe), dann pushen. Details: ANLEITUNG „Lokale Vorschau“.

## Effizienz
- Erst gezielt suchen (Grep/Glob), dann nur den nötigen Ausschnitt lesen. Große Dateien (`app.js`, `index.html`, `zuhause.js`, `ANLEITUNG.md` ~1650 Z.) nie ganz lesen.
- Breite Suchen über mehrere Dateien/Namensmuster: Agent `finder`.
- Nach dem Push genau einmal Agent `deploy-check` (mit der neuen `wir-vNN`), kein Polling.
- Keine Subagents für kleine Aufgaben.
- Antworten kurz, auf Deutsch.

## Zugangsdaten
Stehen nirgends im Repo oder hier. Nie danach fragen, nie ablegen, nie ausgeben.
