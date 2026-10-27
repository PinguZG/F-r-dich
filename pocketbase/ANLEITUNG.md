# Einrichtung auf dem Pi (PocketBase 0.40.5)

Reihenfolge einhalten. Getestet mit einer lokalen PocketBase 0.40.5.

## 1. Code holen

```bash
git pull
```

PocketBase muss nicht neu gestartet werden, der `publicDir` zeigt ja auf `app/`.

## 2. `photos` anpassen (von Hand, im Admin-UI)

Collections → **photos** → ⚙️ (Edit collection):

1. **New field → Number**, Name: `order` (nicht required). Speichern.
2. Tab **API Rules → Update rule** ersetzen durch:

   ```
   @request.auth.id != "" && @request.body.author:changed = false && (author = @request.auth.id || (@request.body.caption:isset = false && @request.body.image:isset = false))
   ```

   Damit dürft ihr **beide** die Reihenfolge ändern (auch bei Fotos der anderen Person),
   aber Bild und Bildunterschrift nur bei den eigenen Fotos. Löschen bleibt nur beim eigenen Foto.

## 3. Neue Collections importieren

Settings → **Import collections** → **Load from JSON file** → `pocketbase/collections.json`
(oder den Inhalt reinkopieren).

> ⚠️ **Unbedingt den Haken „Merge with the existing collections“ setzen!**
> Ohne den Haken würde PocketBase `users` und `photos` (inkl. Fotos) **löschen**.
> Unter „Detected changes“ dürfen danach nur diese 5 stehen, **kein „Deleted“**:
> `dates`, `clay_photos`, `tabs`, `tab_entries`, `tab_locks`.

Dann **Review → Confirm and import**.

Was die Collections machen:

| Collection | Zweck |
|---|---|
| `dates` | Unsere Daten (Emoji, Titel, Datum, Geburtstag ja/nein) |
| `clay_photos` | 📁 Fotos der fertigen Clay-Figuren (geschützt wie `photos`) |
| `tabs` | eigene Reiter (Name, Emoji, `unlock_at` = geplante Freigabe) |
| `tab_entries` | Einträge in einem Reiter (Titel, optional Bild, ❤️ `selected`) |
| `tab_locks` | View: zeigt von gesperrten Reitern **nur** Autor + Freigabezeit |

Die Sperre wird von PocketBase selbst durchgesetzt (nicht nur ausgeblendet):
`tabs` und `tab_entries` (inkl. Bilder) sind für die andere Person erst ab `unlock_at <= @now` lesbar.
Vorher bekommt sie bei direktem API-Aufruf eine leere Liste bzw. 404.

## 4. Erster Start

- App öffnen → mit dem PocketBase-Account anmelden. Ihr bleibt angemeldet (bis „Abmelden“ unten im Menü).
- Beim ersten Login werden die 5 bisherigen Daten (Zusammengekommen, Erster Kuss, …) automatisch
  in `dates` übernommen.
- Die 8 alten Erinnerungs-Fotos liegen auf dem PC unter `Desktop\app\export\` → über
  „📷 Foto hinzufügen“ hochladen.
- Falls noch die alte Version angezeigt wird: App einmal schließen und neu öffnen
  (der Service Worker lädt die neue Version, Cache `wir-v2`).

## Bedienung

- **Erinnerungen:** Foto gedrückt halten, dann ziehen → neue Reihenfolge wird gespeichert.
- **Unsere Daten:** „➕ Neues Datum“ unter der Liste. Eigene Einträge haben ein ✕.
- **Clay Date:** 📁 oben rechts → fertige Figuren.
- **Neuer Reiter:** im Menü. Mit „🔒 Geplante Freigabe“ sieht die andere Person bis dahin nur
  „Neues Date geplant 🔒 Freigabe am …“, danach öffnet sich der Reiter automatisch.
  Im eigenen gesperrten Reiter kann man die Zeit ändern oder sofort freigeben.
  ❤️ markiert einen Eintrag als ausgewählt (nur einer pro Reiter).

---

# Push-Benachrichtigungen + „Wir zwei“ (Schritt 2)

## A. Neue Collections/Felder importieren

Settings → **Import collections** → `pocketbase/collections-push.json` laden.

> ⚠️ **Wieder unbedingt „Merge with the existing collections“ anhaken!**
> Ohne den Haken löscht PocketBase alle Collections, die nicht in der Datei stehen
> (`users`, `photos`, `dates`, `clay_photos` … inkl. aller Fotos!).
> Unter „Detected changes“ darf **nichts mit „Deleted“** stehen. Erwartet:
> - **Changed:** `tabs` (neu: `notified_created`, `notified_unlock` + Regeln), `tab_entries` (neu: `selected_by` + Regeln)
> - **New:** `pings`, `push_subs`, `push_prefs`, `push_state`

Vorher am besten ein Backup machen: Settings → **Backups** → „Initialize new backup“.

| Collection | Zweck | Regeln |
|---|---|---|
| `pings` | Herz, Anruf, Liebe, Support, Nachricht | anlegen nur `from` = ich und `to` = der andere; sehen nur wenn ich `from` oder `to` bin; kein Update; löschen nur eigene |
| `push_subs` | Push-Abos pro Handy (`endpoint` unique) | jeder sieht/löscht nur eigene |
| `push_prefs` | Schalter pro Person (JSON, fehlender Schalter = an) | nur eigene |
| `push_state` | „zuletzt verarbeitet“ des Push-Dienstes | nur Superuser |
| `tabs.notified_*` | merkt, welche Reiter-Benachrichtigung schon raus ist | für Clients nicht setzbar |
| `tab_entries.selected_by` | wer die ❤️-Auswahl getroffen hat | nur man selbst |

## B. Push-Dienst `wir-push` (Ordner `push/`)

- Node.js aus apt + Bibliothek `web-push`, läuft als systemd-Dienst `wir-push` (Benutzer `pingu`).
- Meldet sich mit einem eigenen Superuser `wir-push@wir.local` an.
- Zugangsdaten + VAPID-Private-Key liegen **nur** in `/etc/wir-push.env` (root, chmod 600), nie im Repo.
  Der VAPID-Public-Key steht in `app/app.js` (der ist öffentlich).
- Fragt PocketBase alle 30 s ab; Pings kommen zusätzlich sofort über Realtime.
- Schickt immer nur an die **andere** Person. Fotos (Erinnerungen/Clay) und Einträge werden gebündelt,
  wenn mehrere innerhalb ~1 Minute kommen. Gesperrte Reiter verraten nie Titel oder Inhalt:
  bei Erstellung nur „💌 Neues Date geplant – Freigabe am …“, zur Freigabezeit „🎉 Dein Date ist da!“ mit Name.
- Gegen Doppelte: Reiter über `notified_created`/`notified_unlock`, alles andere über Zeit-Cursor + „seen“-Liste in `push_state`
  (erst gemerkt, dann gesendet). Beim allerersten Start wird nichts nachgeholt.
- Abgelaufene Abos (404/410) werden aus `push_subs` gelöscht.

Einmalige Einrichtung auf dem Pi:

```bash
cd ~/F-r-dich && git pull
sudo bash ~/F-r-dich/push/setup.sh
```

Das Skript installiert `nodejs`/`npm`, die Abhängigkeiten, verschiebt die vorbereiteten Zugangsdaten
(`~/.wir-push.env.pending`) nach `/etc/wir-push.env`, richtet den Dienst ein und erlaubt `pingu`
**nur** `sudo systemctl restart|status wir-push` ohne Passwort.

Updates später: `cd ~/F-r-dich && git pull && sudo systemctl restart wir-push`

Logs: `journalctl -u wir-push -f`

`/etc/wir-push.env` enthält:

```
PB_URL=http://127.0.0.1:8090
PB_EMAIL=wir-push@wir.local
PB_PASSWORD=…
VAPID_SUBJECT=https://wir.geep-flops.ts.net
VAPID_PUBLIC_KEY=…   (muss zu app/app.js passen)
VAPID_PRIVATE_KEY=…
```

## C. Auf dem iPhone (iOS 16.4+)

Push geht auf dem iPhone **nur in der Home-Bildschirm-App**, nicht im Safari-Tab.
App öffnen → Menü → **🔔 Benachrichtigungen aktivieren** → „Erlauben“.
Unter ⚙️ **Einstellungen** kann jede*r wählen, welche Arten man bekommt (alles standardmäßig an).
Beim Abmelden wird das Abo dieses Handys gelöscht.

---

# Update 21.10.2026: Treffen-Countdown, „Öffne wenn …“, Update-Hinweis, Auto-Deploy

Getestet mit einer lokalen PocketBase 0.40.5 (Windows) und zwei Test-Accounts:
- 31 API-Sicherheitstests: Die Empfängerin bekommt Nachrichten weder per List, View, Filter, Expand noch Realtime.
- UI-Test auf iPhone-Größe
- Auto-Deploy-Skript gegen Test-Repos

## Was neu im Repo ist

| Datei | Zweck |
|---|---|
| `app/extra.js`, `app/extra.css` | Countdown, Treffen, „Öffne wenn …“, „Für dich schreiben“, Schalter, Update-Banner, „↻ App neu laden“. Baut sich selbst ins Menü ein. |
| `pocketbase/collections_v3.json` | neue Collections `meetings`, `open_when_categories`, `open_when_messages`, `notify_prefs`, `push_queue` |
| `pocketbase/pb_hooks/wir_extra.pb.js` + `wir_lib.js` | Empfänger automatisch setzen; Routen `/api/open-when/categories`, `/api/open-when/random?category=…`, `/api/wir/partner`; Cron für Treffen-Pushs; Push-Bündelung |
| `push/index.js` | **wir-push** verschickt zusätzlich alles aus `push_queue` (Schritt `doQueue`) |
| `deploy/` | Auto-Deploy: `autodeploy.sh`, `wir-deploy.service`, `wir-deploy.timer`, `sudoers-wir-deploy` |

**Nur ein Push-Dienst:** Es läuft ausschließlich **wir-push**. Der zwischenzeitlich geplante Extra-Dienst `wir-notify` ist entfallen,
weil wir-push jetzt im Repo liegt. Die Hooks legen Treffen-/Öffne-wenn-Pushs in `push_queue` ab, wir-push verschickt sie –
mit denselben VAPID-Schlüsseln und demselben Superuser aus `/etc/wir-push.env`. Gegen Doppelte: wir-push setzt `sent_at`,
**bevor** gesendet wird; Treffen-Pushs haben zusätzlich einen eindeutigen `key` pro Tag und Person.

**Ablauf der Pushs:**
- **Treffen:** an beide, am Vortag ab 18:00 („Morgen sehen wir uns 💗“) und am Tag selbst ab 08:00 („Heute sehen wir uns 💗“), jeweils nur einmal pro Tag und Person. War der Pi um 18:00 bzw. 08:00 aus, wird bis 21:59 bzw. 11:59 nachgeholt.
- **Öffne wenn:** an die Empfängerin, ohne Inhalt. Die erste neue Nachricht startet eine Minute Wartezeit. Alles, was in dieser Minute dazukommt, geht als *ein* Push raus („💌 3 neue Öffne-wenn-Nachrichten für dich“). Tippen öffnet „Öffne wenn …“.
- **Schalter:** Menü → „🔔 Benachrichtigungen: Treffen & Briefe“ (pro Person, gespeichert in `notify_prefs`).

---

## (a) Collections importieren (erledigt am 21.10.2026)

1. https://wir.geep-flops.ts.net/_/ → **Settings → Import collections**
2. **Load from JSON file** → `pocketbase/collections_v3.json`.
3. > ⚠️ **Haken „Merge with the existing collections“ setzen!**
   > Ohne den Haken würden `users`, `photos`, `push_subs` usw. **gelöscht**.
4. **Review**. Unter „Detected changes“ dürfen **nur diese 5 neuen** stehen, **nichts als „Deleted“**:
   `meetings`, `open_when_categories`, `open_when_messages`, `notify_prefs`, `push_queue`
5. **Confirm and import**.

---

## (b) Auf dem Pi: neue Version live bringen

```bash
cd /home/pingu/F-r-dich
git status                      # muss sauber sein
git pull --ff-only origin main
mkdir -p /home/pingu/pb/pb_hooks && cp -a pocketbase/pb_hooks/. /home/pingu/pb/pb_hooks/
sudo systemctl restart pocketbase
journalctl -u pocketbase -n 30 --no-pager          # keine JS-Fehler zu wir_extra.pb.js?
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8090/api/wir/partner   # erwartet: 401
sudo systemctl restart wir-push
journalctl -u wir-push -n 20 --no-pager             # "wir-push startet …", keine Fehler
```

Ab jetzt gilt: **Bei jeder neuen App-Version die Nummer `CACHE` in `app/sw.js` erhöhen.** Nur dann erkennt der
Service Worker das Update und zeigt das Banner „✨ Neue Version – tippen zum Aktualisieren“.

---

## (c) Auto-Deploy einrichten (eingerichtet am 21.10.2026)

**Was es macht:** Alle 2 Minuten `git fetch`. Nur wenn `origin/main` neuer ist: `git pull --ff-only`.
- Bei lokalen Änderungen oder wenn der Stand nicht fast-forward ist: **Abbruch mit Log-Eintrag**. Es wird nie etwas überschrieben.
- `pocketbase/pb_hooks/` geändert → nach `/home/pingu/pb/pb_hooks` kopieren und PocketBase neu starten. Es wird nur kopiert, nie etwas gelöscht.
- `pocketbase/pb_migrations/` geändert (seit 22.10.2026) → nach `/home/pingu/pb/pb_migrations` kopieren und PocketBase neu starten; PocketBase spielt neue Migrationen beim Start selbst ein. Danach prüft das Skript bis zu 30 s lang `/api/health` und meldet „FEHLER: pocketbase antwortet … nicht“, falls PocketBase nicht hochkommt.
- `push/` (wir-push) geändert → bei geänderter `package.json` `npm ci`, dann den Dienst neu starten.
- Lock gegen parallele Läufe. Die Ausgaben landen im journal (`wir-deploy`).

**Gewählte Lösung:** Der Dienst läuft als **pingu**, dazu kommt eine **eng begrenzte sudoers-Regel** nur für `systemctl restart pocketbase|wir-push`.
Begründung: Das Skript kommt selbst aus dem Repo und aktualisiert sich bei jedem Pull mit. Liefe es als root, könnte jeder, der auf GitHub pushen kann, Root-Rechte auf dem Pi bekommen. So bekommt er höchstens die Rechte von pingu (die PocketBase ohnehin hat) und darf zwei Dienste neu starten.

```bash
cd /home/pingu/F-r-dich
# 1. sudoers-Regel prüfen und installieren
sudo visudo -cf deploy/sudoers-wir-deploy         # muss "parsed OK" melden
sudo install -m 0440 -o root -g root deploy/sudoers-wir-deploy /etc/sudoers.d/wir-deploy
sudo -l -U pingu | grep systemctl                  # zeigt die erlaubten Befehle
ls -l /usr/bin/systemctl                           # Pfad muss stimmen

# 2. systemd-Dateien installieren
sudo cp deploy/wir-deploy.service deploy/wir-deploy.timer /etc/systemd/system/
sudo systemctl daemon-reload

# 3. einmal von Hand testen
sudo systemctl start wir-deploy.service
journalctl -u wir-deploy -n 30 --no-pager          # ohne neue Commits: keine Ausgabe = alles gut
systemctl status wir-deploy.service --no-pager     # "status=0/SUCCESS"

# 4. Timer aktivieren
sudo systemctl enable --now wir-deploy.timer
systemctl list-timers wir-deploy.timer             # nächster Lauf
```

**Testen:** Am PC eine kleine Änderung pushen, z. B. an der ANLEITUNG. Nach spätestens 2 Minuten:
```bash
journalctl -u wir-deploy -n 30 --no-pager    # "aktualisiert abc1234 -> def5678 …"
journalctl -u wir-deploy -f                  # live mitlesen (Strg+C)
```

**Abschalten:**
```bash
sudo systemctl disable --now wir-deploy.timer        # pausieren / aus
# ganz entfernen:
sudo rm /etc/systemd/system/wir-deploy.service /etc/systemd/system/wir-deploy.timer /etc/sudoers.d/wir-deploy
sudo systemctl daemon-reload
```

**Wenn es „ABBRUCH: lokale Änderungen“ meldet:** `cd /home/pingu/F-r-dich && git status` → Änderungen committen und pushen, oder mit `git checkout -- <datei>` verwerfen.

**Hinweise:**
- Ändern sich `.service`- oder `.timer`-Dateien, werden sie **nicht** automatisch installiert. Dann die Schritte oben wiederholen.
- Eine aus dem Repo gelöschte Hook-Datei bleibt in `/home/pingu/pb/pb_hooks` liegen und muss von Hand entfernt werden.

### Tailscale SSH als Notzugang

Damit du auch ohne SSH-Key von jedem deiner Geräte mit Tailscale auf den Pi kommst:

```bash
sudo tailscale set --ssh
tailscale status            # Pi ist online
```
Danach von einem deiner Geräte im Tailnet: `ssh pingu@<pi-name>` (Name aus `tailscale status`).

**In der Tailscale-Admin-Konsole → Access controls prüfen:**
1. Im Policy-File gibt es einen Abschnitt `"ssh"`. Der darf **nur dich selbst** als Quelle erlauben und nur den Nutzer `pingu` (nicht root), im Modus `check` (dann wird ab und zu per Browser-Login nachgefragt). Sinnvoll ist so etwas:
   ```json
   "ssh": [
     {
       "action": "check",
       "src":    ["deine-tailscale-login@…"],
       "dst":    ["autogroup:self"],
       "users":  ["pingu"]
     }
   ]
   ```
   `autogroup:self` bedeutet: nur Geräte, die **dir** gehören. Der Pi muss also mit deinem Account im Tailnet angemeldet sein (Machines → Spalte „Owner“).
2. Es darf **keine** SSH-Regel mit `"src": ["autogroup:member"]`, `"*"` oder Gruppen geben, in denen andere Personen sind, und keine mit `"action": "accept"` für fremde Quellen.
3. **Machines → Pi → Share:** Falls der Pi mit anderen geteilt ist, z. B. mit dem Account deiner Freundin: Geteilte Nutzer bekommen kein SSH, solange die Regel oben nur dich erlaubt. Trotzdem prüfen.
4. Falls Tailscale-**Funnel** für https://wir.geep-flops.ts.net läuft: Funnel gibt nur den Web-Port frei, nicht SSH. Zur Kontrolle: `tailscale funnel status`.
5. In der Konsole unter Access controls → **Preview rules** prüfen: Nur deine Geräte → Pi → pingu.

Abschalten: `sudo tailscale set --ssh=false`.

---

## (d) Testplan für beide iPhones

Vorher: Auf beiden iPhones die App schließen (aus dem App-Umschalter wischen) und neu öffnen. Steht noch die alte Version da, im Menü unten auf **„↻ App neu laden“** tippen.

**Countdown / Treffen (beide):**
1. Startseite ohne Treffen: Unter der Überschrift steht dezent „+ Nächstes Treffen eintragen“.
2. Antippen → Treffen in 4 Tagen anlegen → Startseite zeigt groß „Noch 4 Tage 💗“ und Datum/Notiz. Das andere iPhone zeigt es nach dem Öffnen auch.
3. Am anderen iPhone über den Countdown → „Unsere Treffen“ → ✎ auf morgen früh ändern → zeigt „Noch … Std. … Min. 💗“. Auf heute ändern → „Heute sehen wir uns 💗“.
4. ✕ löschen geht bei beiden.

**Öffne wenn (Daniel schreibt, sie liest):**
5. Daniel: Menü → „Für dich schreiben“ → die 4 Startkategorien sind da. Eine Kategorie aufklappen, eine Nachricht schreiben → „0 von 1 geöffnet“.
   (Die Startkategorien werden angelegt, wenn der Name oder die E-Mail deines Accounts mit „Daniel“ beginnt bzw. „daniel“ enthält, und nur solange du noch gar keine Kategorie hast.)
6. Sie: Menü → „Öffne wenn …“ → nur Kategorien **mit** Nachricht sind zu sehen, mit Punkt „Ein neuer Brief wartet“. Antippen → Brief-Animation → genau eine Nachricht als Brief → „Schließen 💗“.
7. Daniel: Zurück und wieder „Für dich schreiben“ öffnen → „1 von 1 geöffnet“.
8. Zwei weitere Nachrichten in dieselbe Kategorie → Sie öffnet zweimal und bekommt die zwei *neuen* (ungeöffnete zuerst), danach zufällig aus allen.
9. Andersherum: Sie legt unter „Für dich schreiben“ eine eigene Kategorie für Daniel an → Daniel sieht sie unter „Öffne wenn …“.
10. Sortieren (▲▼), umbenennen (✎), Nachricht bearbeiten und löschen, Kategorie löschen.

**Sicherheit (am PC, optional):** Mit ihrem Login in der Browser-Konsole von https://wir.geep-flops.ts.net
`await (await fetch('/api/collections/open_when_messages/records',{headers:{Authorization:JSON.parse(localStorage.pocketbase_auth).token}})).json()` → `totalItems: 0`.

**Pushs (Benachrichtigungen müssen auf beiden aktiviert sein):**
11. Daniel schreibt 2 Nachrichten kurz hintereinander → etwa 1 Minute später bekommt sie **einen** Push „💌 2 neue Öffne-wenn-Nachrichten für dich“.
12. Treffen für morgen eintragen → heute ab 18:00 bei beiden „Morgen sehen wir uns 💗“, morgen ab 08:00 „Heute sehen wir uns 💗“.
    Schneller testen: Treffen für *heute später* eintragen, wenn es zwischen 08:00 und 11:59 ist → innerhalb von 1 Minute kommt „Heute sehen wir uns 💗“.
13. Menü → „🔔 Benachrichtigungen: Treffen & Briefe“ → Schalter aus → Schritt 11 wiederholen → kein Push.
14. Falls nichts ankommt: `journalctl -u wir-push -n 30` (zeigt „gesendet …“ oder den Fehler). In `push_queue` im Admin-UI steht der Fehler in der Spalte `error`.

**Update-Hinweis:** Nach dem nächsten Push auf GitHub, bei dem die Nummer in `sw.js` erhöht wurde, erscheint nach dem Öffnen der App unten „✨ Neue Version – tippen zum Aktualisieren“. Tippen lädt die neue Version.

---

# Redesign 22.10.2026

Getestet mit einer lokalen PocketBase 0.40.5 und einer **Kopie der Live-Datenbank** (beide Accounts, über 50 UI-Prüfungen in Edge auf iPhone-Größe, alle vier Farbwelten) und einem lokalen Test des Push-Dienstes mit Fake-Endpunkt.

## Was neu ist und wo es liegt

| Wo | Was |
|---|---|
| **Leiste unten** | 🏡 Start · 📸 Erinnerungen · 📅 Dates · 💌 Öffne wenn · 💞 Wir zwei. Der rote Punkt an 💌 zeigt einen neuen Brief. |
| **Avatar oben links** | Einstellungen: Profilbild, Farbwelt, „Zusammen seit“, Benachrichtigungen, App neu laden, 🎁 Wieder einpacken, Abmelden |
| **Start** | Zusammen-Timer im Glow-Kreis (Tage + live Jahre/Monate/Tage/Std./Min./Sek.), beide Profilbilder, Liebe-Glas mit zwei Herzen (füllen sich bis 20, Reset um 00:00 Berlin), „💗 Liebe senden“, darunter Anruf/Support/Nachricht, darunter die Treffen-Karte |
| **Erinnerungen** | Polaroids mit Handschrift (Caveat). Oben Ordner („Alle“ + eigene, ➕ Ordner). Foto antippen → 📁 Ordner / 🗑 Löschen. Ordner löschen lässt die Fotos stehen (dann ohne Ordner). Sortieren per Gedrückthalten bleibt. |
| **Dates** | Kacheln für Treffen, Unsere Daten, Clay Date, Unsere Figuren; darunter die eigenen Reiter + „Neuer Reiter“ |
| **Öffne wenn** | Umschalter „Für mich“ / „Schreiben“. Briefe werden im Briefpapier-Sheet geschrieben (Linien, Handschrift-Überschrift, Zeichenzähler). |
| **Wir zwei** | Alle Aktionen + Verlauf; viele Liebe-Tipps erscheinen als eine Zeile („7× Liebe“) |

„Herz senden“ und „Liebe senden“ sind jetzt **ein** Knopf (Typ `love`; alte `heart`-Pings zählen mit).
Push bei Liebe: gesammelt, **höchstens alle 5 Minuten** einer pro Person: „💗 Daniel hat dir 7× Liebe geschickt“ (+ „Heute schon …×“). Nach einer Serie wartet der Dienst ~20 s, nie länger als 90 s.

## Datenbank (nur additiv, per Migration)

`pocketbase/pb_migrations/1792660000_wir_redesign.js` – wird vom Auto-Deploy kopiert und beim PocketBase-Start eingespielt. Nichts wird umbenannt oder gelöscht:
- neu `photo_folders` (name, emoji, order, author) – beide dürfen anlegen/umbenennen/löschen
- neu `photos.folder` (optional)
- neu `shared_settings` (key, value, updated_by) mit `together_since = 2026-04-10`
- neu `users.theme` (Farbwelt pro Person; zusätzlich im localStorage für den schnellen Start)
- `users.avatar` bekommt das Vorschaubild `200x200`

Der Service Worker steht auf `wir-v6` → auf den iPhones erscheint „✨ Neue Version – tippen zum Aktualisieren“.

## Sicherung vor dem Umbau

- Git-Tag **`vor-redesign`** = Commit `24dbd40` (Stand vorher), auf GitHub gepusht.
- Datenbank-Backup (konsistent über die SQLite-Backup-Funktion, Integritätsprüfung „ok“):
  `/home/pingu/backups/vor-redesign-2026-10-22/` mit `data.db`, `auxiliary.db`, `storage/` (Fotos), `pb_migrations/`, `pb_hooks/`.

---

# Zurück zur alten Version

Die alte App läuft mit der neuen Datenbank unverändert (das Schema wurde nur erweitert). **Normalerweise reicht Schritt 1.**

## 1. Code auf „vor-redesign“ zurücksetzen (am PC)

```bash
cd Documents/F-r-dich
git checkout main && git pull
git checkout vor-redesign -- app push      # App + Push-Dienst wie vorher
git commit -m "Zurück zur Version vor dem Redesign"
git push
```

Das Auto-Deploy holt den Commit innerhalb von 2 Minuten und startet `wir-push` neu. Die App-Dateien liest PocketBase direkt aus dem Repo.
Auf den iPhones erscheint das Update-Banner, weil sich `app/sw.js` geändert hat. Falls nicht: in der alten Version im Menü unten auf „↻ App neu laden“ tippen.

> Bitte **kein** `git reset --hard` + `git push --force`: Dann ist der Stand auf GitHub kein fast-forward mehr und das Auto-Deploy bricht ab („ABBRUCH: … kein fast-forward“).

Prüfen auf dem Pi:
```bash
journalctl -u wir-deploy -n 20 --no-pager     # "aktualisiert … -> …", "wir-push neu gestartet"
cd /home/pingu/F-r-dich && git log --oneline -1
```

Wieder zum Redesign: `git revert --no-edit HEAD && git push`.

## 2. Nur falls Daten kaputt sind: Datenbank-Backup zurückspielen (auf dem Pi)

⚠️ Alles, was nach dem 22.10.2026 00:47 angelegt wurde (Fotos, Pings, Briefe …), geht dabei verloren. Der aktuelle Stand wird vorher beiseitegelegt, nicht gelöscht.

```bash
sudo systemctl stop wir-deploy.timer wir-push pocketbase
cd /home/pingu/pb/pb_data
D=/home/pingu/pb/pb_data.vorher-$(date +%F-%H%M)
mkdir -p "$D" && mv data.db* auxiliary.db* storage "$D"/
cp -a /home/pingu/backups/vor-redesign-2026-10-22/{data.db,auxiliary.db,storage} .
sudo systemctl start pocketbase
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8090/api/health    # erwartet: 200
sudo systemctl start wir-push wir-deploy.timer
```

Beim Start spielt PocketBase die Redesign-Migration wieder ein (sie legt nur die neuen Collections/Felder an). Das schadet der alten App nicht.

---

# Liebe-Update 22.10.2026

Kurz getestet mit einer lokalen PocketBase 0.40.5 und einer Kopie der Live-Datenbank (PocketBase startet, Migration läuft, ein Liebe-Tipp, doppelte Herzfarbe wird abgelehnt).

## Was neu ist

| Wo | Was |
|---|---|
| **Start** | **Ein** großes Glas-Herz statt zwei. Füllstand = Liebe-Tipps von euch beiden heute / 200 (ab 200 voll, leuchtet). Die Flüssigkeit zeigt das Verhältnis in euren Herzfarben (oben deine, unten die der anderen Person, weicher Übergang, Wellen). Darunter die Tageszahlen beider. Reset um 00:00 Europe/Berlin. |
| **💗 Liebe senden** | 0,5 s Pause nach jedem Tipp (Knopf kurz gesperrt, Balken läuft ab, kurze Vibration auf Android – iPhones können im Browser nicht vibrieren). Jeder Tipp zählt sofort im Glas, auch beim anderen (Realtime). |
| **Einstellungen → 💗 Meine Herzfarbe** | 12 runde Farbknöpfe. Die Farbe der anderen Person ist ausgegraut, mit ihrem kleinen Profilbild. |
| **Einstellungen → 🔔** | Keine Schalter mehr, nur noch „Benachrichtigungen aktivieren“ (iOS-Erlaubnis). |

**Push bei Liebe: unverändert gebündelt** wie vorher (höchstens alle 5 Minuten eine: „💗 Daniel hat dir 7× Liebe geschickt“).
**Benachrichtigungen nicht mehr abschaltbar:** wir-push ignoriert `push_prefs`, die Hooks ignorieren `notify_prefs`. Beide Collections bleiben mit ihren Daten bestehen.

## Datenbank (nur additiv)

`pocketbase/pb_migrations/1792700000_wir_liebe.js`:
- neu `users.heart_color` (Text, nur Werte aus der Palette) + **Unique-Index** `idx_users_heart_color` (leere Werte ausgenommen) → zwei Personen können serverseitig nie dieselbe Farbe haben (Fehler `validation_not_unique`)
- Standardfarben beim ersten Lauf: Daniel = Rosa, Ida = Himmel (nach Anlegedatum)
- neu `pings.series` (Serien-Zähler: Tipps innerhalb von 10 s nach dem letzten = selbe Serie, setzt der Hook `pb_hooks/wir_liebe.pb.js`)

Service Worker: `wir-v7`.

## Sicherung vorher

- Git-Tag **`vor-liebe-update`** = Commit `8a2b584`, auf GitHub gepusht.
- Datenbank-Backup (SQLite-Backup-Funktion, Integritätsprüfung „ok“): `/home/pingu/backups/vor-liebe-update-2026-10-22/` mit `data.db`, `auxiliary.db`, `storage/`, `pb_migrations/`, `pb_hooks/`.

## Zurück zur Version davor

Das Schema wurde nur erweitert, die alte App läuft damit unverändert. **Normalerweise reicht Schritt 1.**

**1. Code zurück (am PC):**
```bash
cd Documents/F-r-dich
git checkout main && git pull
git checkout vor-liebe-update -- app push pocketbase/pb_hooks
git rm -q --cached pocketbase/pb_hooks/wir_liebe.pb.js; rm pocketbase/pb_hooks/wir_liebe.pb.js
git commit -m "Zurück zur Version vor dem Liebe-Update"
git push
```
Danach auf dem Pi die Hook-Datei entfernen (das Auto-Deploy löscht keine Dateien) und PocketBase neu starten:
```bash
rm /home/pingu/pb/pb_hooks/wir_liebe.pb.js
sudo systemctl restart pocketbase
```
Kein `git reset --hard` + `push --force` (sonst bricht das Auto-Deploy ab). Wieder vor: `git revert --no-edit HEAD && git push`.

**2. Nur falls Daten kaputt sind:** wie oben unter „Zurück zur alten Version → 2.“, aber mit dem Ordner
`/home/pingu/backups/vor-liebe-update-2026-10-22/`. ⚠️ Alles nach dem 22.10.2026 06:57 geht dabei verloren.

---

# Spiele-Update 22.10.2026

Getestet mit einer lokalen PocketBase 0.40.5 und einer **Kopie der Live-Datenbank**: 43 API-Tests (u. a. Rechte, Zugprüfung, Matt, Remis, en passant, Rochade, Umwandlung, Sudoku-Prüfung) und 42 UI-Prüfungen mit beiden Accounts parallel in Edge auf iPhone-Größe, alle vier Farbwelten, alle bisherigen Bereiche.

## Was neu ist und wo es liegt

| Wo | Was |
|---|---|
| **Leiste unten** | 🏡 Start · 📸 Erinnerungen · 📅 Dates · 💌 Öffne wenn · 🎲 **Spiele**. Roter Punkt an 🎲, wenn du in Schach/Tic Tac Toe am Zug bist oder ein Remis-Angebot wartet. |
| **Start → „💞 Wir zwei“** | „Wir zwei“ (Anruf, Support, Nachricht, Verlauf) ist jetzt eine Karte unten auf der Startseite. Liebe/Anruf/Support/Nachricht gibt es dort ohnehin schon. Pushs, die nach „Wir zwei“ führen, funktionieren weiter. |
| **Spiele** | Drei Glas-Karten mit Icon, Statuszeile und Spielstand-Kacheln (DU / REMIS bzw. UNENTSCHIEDEN / Partnerin) und rundem ▶-Knopf. |
| **Schach** | Ohne Zeitlimit, asynchron. Figur antippen → Zielfelder (Punkte, Schlagen = Ring) → Zielfeld antippen. Letzter Zug hell markiert, Schach rot am König, Brett aus eigener Sicht, Zugliste mit deutschen Kürzeln (Sf3), geschlagene Figuren + Materialvorteil, Remis anbieten/annehmen/ablehnen/zurückziehen, Aufgeben, Umwandlung mit Auswahl. Mehrere Partien nacheinander (immer eine aktive), Farben wechseln automatisch ab oder „Ich will Weiß/Schwarz“. Bilanz + letzte Partien. Eigene runde SVG-Figuren, Brettfarben pro Farbwelt. |
| **Sudoku** | Leicht/Mittel/Schwer (38/31/≈25 Vorgaben), jedes Rätsel neu generiert mit garantiert eindeutiger Lösung. Zahlenleiste mit Restanzahl, ✏️ Notizen, Radierer, Rückgängig, Hervorhebung (Zeile/Spalte/Block + gleiche Zahlen), Schalter „Fehler rot markieren“. Speichert automatisch (Handy sofort, Server alle paar Sekunden + beim Schließen). Punkte: 10/25/50 + Zeitbonus (bis zur Zielzeit 10/20/35 min, max. noch einmal so viel) − 2/4/6 pro Fehler, mindestens 20 %. Rangliste für beide (Punkte, gelöst pro Stufe, Bestzeiten). |
| **Tic Tac Toe** | „Gegen KI“ (Leicht, Mittel, Schwer = Minimax, unschlagbar; wer anfängt wechselt) und „Gegeneinander“ (asynchron, Anfang wechselt). Zeichen in euren Herzfarben, Gewinnlinie wird gezeichnet, Kacheln Du/Unentschieden/Gegner. |

**Pushs** (über `push_queue`, verschickt von wir-push, Tippen öffnet das Spiel):
„♟️ Du bist am Zug – Daniel spielte Sf3“, „♟️ Schach! Du bist am Zug“, „♟️ Schachmatt“, „♟️ Remis“, „🤝 Remis-Angebot“, „♟️ Du hast gewonnen 🎉 – … hat aufgegeben“, „⭕ Du bist am Zug – … hat gesetzt“, „⭕ Tic Tac Toe – … hat gewonnen“. Noch nicht verschickte Spiel-Pushs werden durch den neuesten ersetzt (keine Flut). wir-push hört jetzt zusätzlich per Realtime auf `push_queue` → Spiel-Pushs kommen sofort.

## Sicherheit (serverseitig)

Alle Züge laufen über Routen in `pocketbase/pb_hooks/wir_spiele.pb.js` (Logik in `spiele_lib.js`, Regeln über `chess.js`):
`POST /api/games/chess/new | {id}/move | {id}/resign | {id}/draw`, `POST /api/games/ttt/new | {id}/move | {id}/resign | ai`, `POST /api/games/sudoku/finish`.
- `chess_games`, `ttt_games`, `sudoku_scores`: Anlegen/Ändern/Löschen über die normale API **verboten** (Regel leer = nur Superuser). Lesen nur, wer mitspielt (Rangliste: beide).
- Zug nur in eigener Partie, nur wenn man am Zug ist, nur legale Züge (Server spielt die ganze Zugliste nach, erkennt Matt/Patt/3-fache Wiederholung/zu wenig Material/50 Züge). Doppeltipp/veralteter Stand → 409.
- Sudoku-Punkte vergibt der Server: Vorgaben müssen zur Stufe passen und erhalten bleiben, Lösung muss gültig sein.
- `sudoku_progress`: nur die eigene Person sieht/ändert ihren Stand.
- `app/lib/chess.js` (Browser) und `pocketbase/pb_hooks/chess.js` (Server) sind dieselbe Datei: chess.js 0.13.4 (BSD-2), nur `export` entfernt.

## Datenbank (nur additiv)

`pocketbase/pb_migrations/1792800000_wir_spiele.js` legt vier neue Collections an, an bestehenden ändert sich nichts: `chess_games`, `ttt_games`, `sudoku_progress` (eindeutig pro Person), `sudoku_scores`. Service Worker: `wir-v9`.

## Sicherung vorher

- Git-Tag **`vor-spiele`** = Commit `b5bbc9f`, auf GitHub gepusht.
- Datenbank-Backup (SQLite-Backup-Funktion, Integritätsprüfung „ok“): `/home/pingu/backups/vor-spiele-2026-10-22/` mit `data.db`, `auxiliary.db`, `storage/`, `pb_migrations/`, `pb_hooks/` (Stand 22.10.2026 16:52).

## Zurück auf „vor-spiele“

Das Schema wurde nur erweitert, die alte App läuft damit unverändert. **Normalerweise reicht Schritt 1.**

**1. Code zurück (am PC):**
```bash
cd Documents/F-r-dich
git checkout main && git pull
git checkout vor-spiele -- app push pocketbase/pb_hooks
git rm -q app/games.js app/games.css app/lib/chess.js pocketbase/pb_hooks/wir_spiele.pb.js pocketbase/pb_hooks/spiele_lib.js pocketbase/pb_hooks/chess.js
git commit -m "Zurück zur Version vor den Spielen"
git push
```
Das Auto-Deploy holt das innerhalb von 2 Minuten, startet PocketBase und wir-push neu. Danach auf dem Pi die Spiele-Hooks entfernen (das Auto-Deploy löscht keine Dateien) und PocketBase neu starten:
```bash
rm /home/pingu/pb/pb_hooks/wir_spiele.pb.js /home/pingu/pb/pb_hooks/spiele_lib.js /home/pingu/pb/pb_hooks/chess.js
sudo systemctl restart pocketbase
```
Die vier Spiele-Collections bleiben einfach ungenutzt stehen. Kein `git reset --hard` + `push --force` (sonst bricht das Auto-Deploy ab). Wieder vor: `git revert --no-edit HEAD && git push`.

**2. Nur falls Daten kaputt sind:** wie oben unter „Zurück zur alten Version → 2.“, aber mit dem Ordner
`/home/pingu/backups/vor-spiele-2026-10-22/`. ⚠️ Alles nach dem 22.10.2026 16:52 geht dabei verloren.

---

# Herzstadt 22.10.2026 (Immobilienspiel)

Eigenes Spiel nach den klassischen Regeln. **Kein** „Monopoly“-Name, keine Original-Straßen oder -Karten (Marke von Hasbro): eigene Straßen, eigene Texte, eigenes Design.
Getestet: Engine mit 400 Zufallspartien und knapp 2 Mio. Aktionen (nie negatives Geld, Häuserbilanz der Bank stimmt immer, abgelehnte Aktionen ändern nichts), 16 API-Tests, 18 UI-Prüfungen mit beiden Accounts parallel, alle Farbwelten; dazu der Spiele-Test von vorher erneut grün.

## Was es kann

- 40 Felder: 22 Straßen in 8 Farbgruppen, 4 Bahnhöfe, 2 Werke, Steuern, 🎁 Überraschung, 💌 Liebesbrief (je 16 Karten), Gefängnis, Kuschelpause, Ab ins Gefängnis.
- Kaufen oder **Versteigern** (beide bieten verdeckt, höheres Gebot gewinnt, Gleichstand = bleibt bei der Bank).
- Miete, doppelte Miete bei ganzer Farbgruppe, Häuser gleichmäßig bauen/verkaufen, Hotels, Bank mit 32 Häusern/12 Hotels, Hypotheken (+10 % beim Ablösen).
- Pasch = nochmal, dreimal Pasch = Gefängnis; Gefängnis: 50 € / Karte / Pasch (3 Versuche).
- Schulden: Geld durch Verkaufen/Hypotheken auftreiben, sonst aufgeben → die andere Person gewinnt.
- Handeln jederzeit: Grundstücke, Geld, Gefängnis-frei-Karten.
- Der **Server würfelt** und prüft jede Aktion (`/api/games/mono/new`, `/api/games/mono/{id}/act`), Versionsnummer gegen Doppeltipps.
- Pushs: „🏙️ Du bist am Zug“ (mit Zusammenfassung), „🔨 Versteigerung – dein Gebot“, „⚠️ Du musst zahlen“, „🤝 Tauschangebot“, Spielende.

## Dateien

`app/lib/mono.js` (= `pocketbase/pb_hooks/mono.js`, dieselbe Datei: Brett, Karten, Regeln), `app/mono-ui.js` (Oberfläche), Styles in `app/games.css`, Routen in `pb_hooks/wir_spiele.pb.js`, Laden/Speichern in `spiele_lib.js`, Migration `pb_migrations/1792850000_wir_herzstadt.js` (neue Collection `mono_games`, nur additiv). Service Worker `wir-v11`.

Hinweis: PocketBase hat ein Rate-Limit (300 Anfragen / 10 s pro Gerät) – beim Spielen kommt man da nicht hin.

## Sicherung vorher

Git-Tag **`vor-herzstadt`** = `297c693`; DB-Backup `/home/pingu/backups/vor-herzstadt-2026-10-22/` (17:50, Integritätsprüfung „ok“).

## Zurück auf „vor-herzstadt“

```bash
cd Documents/F-r-dich
git checkout main && git pull
git checkout vor-herzstadt -- app push pocketbase/pb_hooks
git rm -q app/mono-ui.js app/lib/mono.js pocketbase/pb_hooks/mono.js
git commit -m "Zurück zur Version vor Herzstadt" && git push
```
Auf dem Pi danach: `rm /home/pingu/pb/pb_hooks/mono.js && sudo systemctl restart pocketbase`. Die Collection `mono_games` bleibt ungenutzt stehen.

---

# 22.10.2026: 0,5-s-Pause beim Liebe-Herz wieder drin

Die kurz entfernte Pause nach jedem Tipp ist auf Wunsch wieder aktiv (Stand wie vorher). Service Worker `wir-v13`.

---

# 22.10.2026: Am-Zug-Hinweise + Erinnern-Knopf

- Wer in einem Spiel (Schach, Tic Tac Toe, Herzstadt) dran ist, sieht oben auf **Start** einen Hinweis „Du bist am Zug: …“ (antippen → Spiel), einen Punkt am Spiele-Tab, eine Zahl am App-Symbol (wo unterstützt) und – wenn die App gerade woanders offen ist – eine kurze Einblendung. Pushs gab es schon vorher.
- **🔔 Erinnern**: Wer auf die andere Person wartet, hat im Spiel einen Knopf „🔔 Name erinnern“. Der schickt einen Push („Erinnerung: Du bist am Zug“). Pro Spiel höchstens alle **10 Minuten** (prüft der Server, Antwort 429).
- Route `POST /api/games/nudge` `{ game: 'chess' | 'ttt' | 'mono' }` in `wir_spiele.pb.js`, Logik `nudge()` in `spiele_lib.js`. Die Pause wird über `push_queue.key = nudge:<spiel>:<partie>:<zeit>` erkannt – **keine Schemaänderung**.
- Client: `app/games.js` (Abschnitt „Wer ist dran?“), Herzstadt meldet sich per Event `wir:turn` aus `mono-ui.js`. Service Worker `wir-v14`.

Zurück: Git-Tag **`vor-erinnern`** = `87bd2a3`.
```bash
git checkout vor-erinnern -- app pocketbase/pb_hooks && git commit -m "Zurück vor Erinnern" && git push
```
Keine DB-Änderung, daher kein Backup nötig (Einträge in `push_queue` sind normale Pushs).

---

# Heart Coins + Gutschein-Shop 23.10.2026 (Etappe 1)

Getestet mit einer lokalen PocketBase 0.40.5 und einer **Kopie der Live-Datenbank**: 35 API-Tests mit beiden Accounts (u. a. 5× parallel Tagesbonus → genau eine Gutschrift, Dreifachtipp beim Verschenken → ein Gutschein und eine Abbuchung, Client kann Konto/Ledger/Gutscheine weder anlegen noch ändern noch löschen, fremdes Ledger unsichtbar, kein negativer Kontostand, Summe Ledger = Kontostand) und UI-Test mit beiden Accounts parallel (Verschenken → Push-Ziel → Einlösen → Realtime beim Schenkenden → Erfüllt ✓), alle bisherigen Bereiche geöffnet, keine Konsolenfehler.
Das Casino kommt als **Etappe 2**; im Sheet steht dort vorerst „Bald verfügbar“.

## Was neu ist und wo es liegt

| Wo | Was |
|---|---|
| **Oben neben dem Avatar** | Coin-Chip mit Kontostand. Bei Gutschrift hüpft er und zeigt „+N“. Roter Punkt, wenn ein Gutschein aufs Einlösen oder Erfüllen wartet. |
| **Chip antippen** | Bottom-Sheet „Heart Coins“: **Verlauf** (heute verdient, „So sammelst du Heart Coins“, alle Buchungen), **Shop** (🎁 Verschenken / 🎟️ Gutscheine), **Casino** (bald verfügbar). Kein neuer Reiter unten. |
| **Shop → Verschenken** | Gutschein antippen → Karte „Von Daniel für Ida“, optional ein kleiner Gruß → „Ida schenken“. Man kauft nie für sich selbst. |
| **Shop → Gutscheine** | „Für dich“: erhaltene Karten mit **Einlösen** (Push an den Schenkenden). „Von dir verschenkt“: bei eingelösten **Erfüllt ✓**. Darunter „Eingelöste Gutscheine“ (Verlauf). |

**Verdienen** (alles bucht der Server):
- Start: 500 · Tagesbonus beim ersten Öffnen am Tag (Berlin): +20
- 💗 Liebe senden: +1 pro Tipp (zum Schutz höchstens 200 pro Tag, so viel wie das volle Glas)
- 💌 Öffne-wenn-Brief ab 40 Zeichen: +25, höchstens 5 pro Tag
- 📸 Foto (Erinnerungen oder Clay): +5, höchstens 5 pro Tag
- ✓ Geschenkten Gutschein erfüllen: +15
Coins kann man **nicht** mit echtem Geld kaufen, es gibt keine Kauf-Option.

**Pushs** (Art `gift` in `push_queue`, Tippen öffnet das Gutschein-Fach): „🎁 Daniel hat dir einen Gutschein geschenkt: Massage 15 min“, „🎟️ Ida löst deinen Gutschein ein: …“, „✓ Daniel hat deinen Gutschein erfüllt: …“.

## Sortiment ändern

Admin-UI → Collections → **shop_items**: `name`, `emoji`, `description`, `price`, `active` (aus = nicht mehr im Shop), `order`. 16 Startgutscheine von 100 bis 800 (Wunsch frei). Schon verschenkte Gutscheine behalten Name/Preis (Kopie in `vouchers`).

## Sicherheit / Technik

- `pocketbase/pb_hooks/wir_coins.pb.js` (Routen + Verdienen-Hooks), Logik in `coins_lib.js`.
  Routen: `GET /api/coins/me`, `POST /api/coins/daily`, `POST /api/shop/gift {item, note, key}`, `POST /api/vouchers/{id}/redeem`, `POST /api/vouchers/{id}/fulfill`.
- Jede Buchung läuft über `book()`: **eine Transaktion** schreibt Ledger-Eintrag und Kontostand zusammen, prüft „nicht unter 0“ und hat einen **Idempotenz-Schlüssel** (`coin_ledger.key`, eindeutiger Index, für Clients versteckt). Gleicher Schlüssel nochmal → keine zweite Buchung.
- `coin_wallets`, `coin_ledger`, `vouchers`, `shop_items`: Anlegen/Ändern/Löschen über die API verboten (nur Superuser/Hooks). Lesen: Konto und Ledger nur die eigenen, Gutscheine nur wer schenkt oder beschenkt wird.
- Client: `app/coins.js`, `app/coins.css`; Chip + Sheets in `app/index.html`. `push/index.js`: `gift` → `coins:vouchers`. Service Worker `wir-v15`.

## Datenbank (nur additiv)

`pocketbase/pb_migrations/1792900000_wir_coins.js`: neue Collections `coin_wallets`, `coin_ledger`, `shop_items` (+ Startsortiment), `vouchers`. An bestehenden Collections ändert sich nichts. Konten entstehen beim ersten Aufruf (mit Startguthaben).

## Sicherung vorher

- Git-Tag **`vor-shop`** = Commit `91ca702`, auf GitHub gepusht.
- DB-Backup (SQLite-Backup-Funktion, Integritätsprüfung „ok“): `/home/pingu/backups/vor-shop-2026-10-23/` mit `data.db`, `auxiliary.db`, `storage/`, `pb_migrations/`, `pb_hooks/` (Stand 23.10.2026 06:54).

## Zurück auf „vor-shop“

Das Schema wurde nur erweitert, die alte App läuft damit unverändert. **Normalerweise reicht Schritt 1.**

**1. Code zurück (am PC):**
```bash
cd Documents/F-r-dich
git checkout main && git pull
git checkout vor-shop -- app push pocketbase/pb_hooks
git rm -q app/coins.js app/coins.css pocketbase/pb_hooks/wir_coins.pb.js pocketbase/pb_hooks/coins_lib.js
git commit -m "Zurück zur Version vor dem Shop" && git push
```
Das Auto-Deploy holt das innerhalb von 2 Minuten und startet wir-push neu. Danach auf dem Pi die Hooks entfernen (das Auto-Deploy löscht keine Dateien) und PocketBase neu starten:
```bash
rm /home/pingu/pb/pb_hooks/wir_coins.pb.js /home/pingu/pb/pb_hooks/coins_lib.js
sudo systemctl restart pocketbase
```
Die vier neuen Collections bleiben ungenutzt stehen. Kein `git reset --hard` + `push --force` (sonst bricht das Auto-Deploy ab). Wieder vor: `git revert --no-edit HEAD && git push`.

**2. Nur falls Daten kaputt sind:** wie oben unter „Zurück zur alten Version → 2.“, aber mit dem Ordner
`/home/pingu/backups/vor-shop-2026-10-23/`. ⚠️ Alles nach dem 23.10.2026 06:54 geht dabei verloren.

---

# 23.10.2026: Shop wieder raus

Auf Wunsch sind **Shop und Gutschein-Fach entfernt**. Es bleiben: Coin-Chip, Kontostand, Verdienen (Liebe, Briefe, Fotos, Tagesbonus), Sheet mit **Verlauf** und **Casino (bald verfügbar)**.
- Entfernt: Routen `/api/shop/gift`, `/api/vouchers/{id}/redeem|fulfill` (jetzt 404), Shop-Bereich und Schenken-Sheet in der App, der +15-Bonus fürs Erfüllen, Push-Art `gift` in wir-push.
- Datenbank unverändert: `shop_items` und `vouchers` bleiben leer bzw. ungenutzt stehen (live waren noch keine Gutscheine verschenkt). Service Worker `wir-v16`.
- Shop zurückholen: `git revert --no-edit <commit "Shop wieder raus"> && git push`.
- Ganz zurück auf „vor-shop“: siehe Abschnitt davor. Bei `git rm` dann nur noch die Dateien angeben, die es noch gibt.

---

# Blackjack 23.10.2026 (Casino, nur Spielgeld)

Getestet:
- **Regeln:** 19 Engine-Tests und 200.000 Zufallsrunden in Node. Die Blackjack-Quote liegt bei 4,6 %, alle Runden wurden korrekt abgerechnet.
- **API:** 25 Tests gegen eine lokale PocketBase 0.40.5 mit einer Kopie der Live-DB und beiden Accounts:
  - Dreifachtipp ergibt eine Runde.
  - Doppeltipp auf „Karte“ wird nur einmal ausgeführt.
  - Fremde Runden lassen sich nicht spielen.
  - Stapel und verdeckte Karte sind unsichtbar.
  - Bei 40 Runden mit Teilen und Verdoppeln stimmt jede Runde mit dem Ledger überein.
  - Das Tageslimit greift.
- **UI:** im Browser mit Teilen und Verdoppeln getestet, in der hellen und der dunklen Farbwelt, keine Konsolenfehler.

## Was es kann

- **Wo:** Coin-Chip → Sheet → **Casino** → Blackjack. Der Pfeil zurück führt wieder dorthin. Es gibt keinen neuen Reiter.
- **Regeln:**
  - 6 Decks, jede Runde frisch gemischt.
  - Der Dealer steht auf allen 17 und schaut bei Ass oder Zehn sofort nach Blackjack.
  - Blackjack zahlt 3:2 (aufgerundet).
  - Verdoppeln geht mit zwei Karten, auch nach dem Teilen. Ausnahme: geteilte Asse.
  - Teilen geht einmal pro Runde, bei gleichwertigen Karten (z. B. K + D). Geteilte Asse bekommen je eine Karte.
  - Keine Versicherung.
- **Einsatz:** 5–100 Coins über Chips (5/10/25/50/100). Der letzte Einsatz wird gemerkt.
- **Schutz:** Pro Berliner Tag kann man höchstens **300 Coins** verlieren. Offene Einsätze zählen schon als Verlust. Danach steht auf dem Knopf „Tageslimit erreicht – morgen wieder“. Hinweis unter dem Tisch: „Spielgeld – kein echtes Geld“.
- **Animationen:** Karten fliegen auf den Tisch, die Dealer-Karte wird umgedreht, Ergebnis-Banner, Herzchen bei Gewinn, der Coin-Chip zählt mit.

## Technik / Sicherheit

- Routen in `pocketbase/pb_hooks/wir_casino.pb.js`:
  - `GET /api/casino/bj`: aktuelle bzw. letzte Runde, Kontostand, Limits
  - `POST /api/casino/bj/start {bet, key}`
  - `POST /api/casino/bj/{id}/act {action: hit|stand|double|split, v}`
- Logik in `casino_lib.js`, die Regeln liegen rein in `blackjack.js`.
- **Zufall:** `$security.randomStringWithAlphabet` (kryptografisch sicher), Mischen ohne Verzerrung.
- **Buchungen:** Einsatz, Verdoppeln, Teilen und Gewinn laufen über `coins.book()`. Jede Buchung hat einen eindeutigen Schlüssel `bj:<runde>:bet|double:<hand>|split:<hand>|payout` und läuft in derselben Transaktion wie der Spielzug. Den Start schützt zusätzlich der Client-Schlüssel (`casino_rounds.ckey`, eindeutig). Jeder Zug prüft die Versionsnummer `v`, ein Doppeltipp gibt 409.
- **Rechte:** `casino_rounds` kann man über die API weder anlegen noch ändern noch löschen. Lesen darf nur die eigene Person. Die Felder `state` (Stapel und Karten) und `ckey` sind versteckt, nur der Server sieht sie.
- **Client:** `app/casino.js`, `app/casino.css`, Seite `s-bj` in `app/index.html`. Service Worker `wir-v17`.

## Datenbank (nur additiv)

`pocketbase/pb_migrations/1792950000_wir_casino.js` legt die neue Collection `casino_rounds` an.

## Sicherung vorher

- Git-Tag **`vor-blackjack`** = `0974681`
- DB-Backup: `/home/pingu/backups/vor-blackjack-2026-10-23/` (07:20, Integritätsprüfung „ok“)

## Zurück auf „vor-blackjack“

```bash
cd Documents/F-r-dich
git checkout main && git pull
git checkout vor-blackjack -- app pocketbase/pb_hooks
git rm -q app/casino.js app/casino.css pocketbase/pb_hooks/wir_casino.pb.js pocketbase/pb_hooks/casino_lib.js pocketbase/pb_hooks/blackjack.js
git commit -m "Zurück zur Version vor Blackjack" && git push
```
Danach auf dem Pi:
```bash
rm /home/pingu/pb/pb_hooks/wir_casino.pb.js /home/pingu/pb/pb_hooks/casino_lib.js /home/pingu/pb/pb_hooks/blackjack.js
sudo systemctl restart pocketbase
```
`casino_rounds` bleibt ungenutzt stehen. Falls Daten kaputt sind: Backup wie oben unter „Zurück zur alten Version → 2.“ mit dem Ordner `vor-blackjack-2026-10-23`.

---

# Konsole, Aktivitäts-Log, Online-Punkt 23.10.2026

Getestet mit einer lokalen PocketBase 0.40.5 (Kopie der Live-DB):
- **API:** 26 Tests mit beiden Accounts. Unter anderem: ohne Login 401, Collection direkt weder lesbar noch beschreibbar, zwei Herzschläge ergeben eine Sitzung, unbekannte Bereiche und Ansichten unter 2 s werden verworfen, höchstens 60 Ereignisse pro Herzschlag, Push „Brief geöffnet“ kommt nur einmal, Sudoku-Pushs.
- **Löschung:** Der Cron löscht einen 91 Tage alten Eintrag, alle anderen bleiben.
- **Browser:** beide Accounts parallel (Online-Punkt, Konsole, gebündelter Minuten-Herzschlag), keine Konsolenfehler.

## Was neu ist

| Wo | Was |
|---|---|
| **Einstellungen → ganz unten „⌨️ Konsole“** | Für **beide** gleich, mit denselben Daten über beide Personen. Kein Admin-Schalter. (Der Hinweis-Satz darunter wurde am 23.10.2026 auf Wunsch entfernt.) |
| **Konsole** | Kleines Terminal in der Farbwelt. Ausgabe oben (scrollbar), unten die Eingabezeile `> `. Es gibt keine Hilfe, keine Vorschläge und keine Befehlsliste. Alles andere ergibt „Unbekannter Befehl“. |
| **Startseite / Wir zwei** | Grüner Punkt (pulsierend) am Profilbild der anderen Person, solange sie online ist |
| **Push** | „💌 Ida hat deinen Brief geöffnet“ an die schreibende Person, sobald ein Öffne-wenn-Brief zum ersten Mal geöffnet wird. Tippen öffnet „Öffne wenn“. |
| **Push** | „🧩 Ida hat ein Sudoku angefangen“ (mit Stufe) und „🧩 Ida hat ein Sudoku gelöst“ (Stufe, Zeit, Punkte) an die andere Person. Noch nicht verschickte Sudoku-Pushs werden durch den neuesten ersetzt. |

## Befehle (nur hier dokumentiert)

| Befehl | Ausgabe |
|---|---|
| `/online` | pro Person: gerade online ja/nein, zuletzt online, die letzten 12 Sitzungen mit Start, Ende und Dauer |
| `/log` | Aktivitäts-Log beider Personen, neueste zuerst (60 Einträge), nach Tagen gruppiert: App geöffnet/geschlossen (mit Online-Dauer), besuchte Bereiche mit Dauer (Spiele mit 🎲), 👀 Öffne-wenn-Brief geöffnet (Kategorie), Foto angesehen, Bild im Reiter angesehen, 🎲 Sudoku angefangen/gelöst. Bei Reitern (Dates/Überraschungen) steht der Reitername dabei. |
| `/log 150` | mehr Einträge (höchstens 300) |
| `/log ida` / `/log daniel` | nur eine Person (Namensanfang reicht). Kombinierbar: `/log 100 ida` |
| `/heute` | Zusammenfassung von heute pro Person: wie oft geöffnet, Online-Zeit der abgeschlossenen Sitzungen, die 6 längsten Bereiche |
| `/clear` | Ausgabe leeren |

## Wie erfasst wird (sparsam)

- Die App sammelt Bereichswechsel (mit Dauer) und Gesehen-Ereignisse im Speicher. Sie schickt sie gebündelt per `POST /api/act/beat`: höchstens einmal pro Minute, sofort beim Schließen bzw. In-den-Hintergrund-Gehen, oder ab 20 gesammelten Ereignissen. Ohne Verbindung bleiben sie liegen und gehen beim nächsten Mal mit (höchstens 150).
- **Sitzung** = App sichtbar von–bis. Ein Herzschlag verlängert die Sitzung. War man unter 30 s weg, läuft dieselbe Sitzung weiter.
- **Online:** Die Sitzung ist nicht beendet und der letzte Herzschlag liegt unter 150 s zurück. Die Antwort auf jeden Herzschlag enthält den Online-Status beider Personen, daraus kommt der grüne Punkt. Beim Öffnen der Startseite wird er zusätzlich frisch geholt (`GET /api/act/presence`).
- **Serverseitig erfasst:** Öffne-wenn-Brief geöffnet (Hook auf `open_when_messages.opened_at`), Sudoku angefangen (neues Rätsel in `sudoku_progress`) und gelöst (`sudoku_scores`).
- **Server prüft:** nur bekannte Bereiche, Zeiten werden gekappt (höchstens 6 h zurück, nicht in der Zukunft), Text höchstens 120 Zeichen.
- **Aufbewahrung:** Cron `wir_activity_cleanup` täglich 03:33 löscht alles, was älter als **90 Tage** ist.

## Technik

- Collection `activity` (Migration `pb_migrations/1793000000_wir_activity.js`, nur additiv). Alle API-Regeln sind leer: Lesen und Schreiben geht nur über die Routen, die einen Login verlangen.
- Routen: `pb_hooks/wir_activity.pb.js` mit `POST /api/act/beat`, `GET /api/act/presence`, `GET /api/console/online`, `GET /api/console/log?limit=&user=`. Logik in `activity_lib.js`.
- Push-Arten `owread` → Öffne wenn und `sudoku` → Sudoku (`push/index.js`).
- Client: `app/activity.js`, `app/activity.css`. Service Worker `wir-v18`.

## Sicherung vorher / zurück

Git-Tag **`vor-konsole`** = `92be96a`; DB-Backup `/home/pingu/backups/vor-konsole-2026-10-23/` (11:50, Integritätsprüfung „ok“).
```bash
cd Documents/F-r-dich && git checkout main && git pull
git checkout vor-konsole -- app push pocketbase/pb_hooks
git rm -q app/activity.js app/activity.css pocketbase/pb_hooks/wir_activity.pb.js pocketbase/pb_hooks/activity_lib.js
git commit -m "Zurück vor die Konsole" && git push
# auf dem Pi:
rm /home/pingu/pb/pb_hooks/wir_activity.pb.js /home/pingu/pb/pb_hooks/activity_lib.js && sudo systemctl restart pocketbase
```
Die Collection `activity` bleibt ungenutzt stehen. Sollen die Daten ganz weg, im Admin-UI die Collection `activity` löschen.

---

# Eigene Spiele-App 26.10.2026 (https://wir.geep-flops.ts.net:8443)

Alle Spiele, Heart Coins, Shop und Casino sind aus Wir in eine eigene PWA **„Spiele“** gezogen. Eigener Origin (Port 8443) = eigenes Symbol auf dem Home-Bildschirm, eigener Service Worker (`spiele-v1`), eigenes Manifest. Backend bleibt **dieselbe PocketBase** (gleiche Accounts, gleiche Daten): Die Spiele-App ruft die API unter https://wir.geep-flops.ts.net auf (CORS: PocketBase erlaubt alle Origins, geprüft).

Getestet mit einer lokalen PocketBase 0.40.5 und einer **Kopie des Backups** (nicht der echten DB), beide Accounts parallel:
- **API:** 20 Tests: Shop (Dreifachtipp → ein Gutschein, genau eine Abbuchung, Einlösen/Erfüllen nur durch die richtige Person, +15 beim Erfüllen, nichts direkt änderbar), `push_subs.app` (nur `wir`/`spiele`, fremde Abos verboten), neue Bereiche im Aktivitäts-Log, `/shared/` über PocketBase.
- **Push-Dienst** mit Fake-Endpunkt: Schachzug → nur Spiele-Abo, Anruf-Ping → nur Wir-Abo (auch altes Abo ohne `app`), ohne Spiele-Abo → ersatzweise an Wir.
- **UI:** 45 Prüfungen in Edge auf iPhone-Größe (Login, alle Spiele, Live-Züge, Coins, Shop mit Einlösen/Erfüllen zwischen beiden, Blackjack, Konsole, Farbwelt im Profil, Push-Ziel per `#go=`), alle vier Farbwelten, keine Konsolenfehler.

## Was wo ist

| Wo | Was |
|---|---|
| **Leiste unten** | 🏠 Start · 💞 Zu zweit (Schach, Tic Tac Toe, Herzstadt; roter Punkt, wenn du dran bist) · 🧩 Denkspiele (Sudoku; Solitär + Schach gegen KI als „bald“) · 🎰 Casino (Blackjack) · 🎁 Shop (Punkt, wenn ein Gutschein aufs Einlösen/Erfüllen wartet) |
| **Start** | „Hallo …“, beide Profilbilder (grüner Punkt = online), **Wer ist dran** pro Spiel (antippen → Spiel), Heart-Coins-Karte (Kontostand, heute verdient → Verlauf), **Letzte Aktivitäten** (Züge, Ergebnisse, Sudoku, Gutscheine, eigene Coin-Buchungen) |
| **Oben** | Avatar → Einstellungen, Coin-Chip → Verlauf |
| **Einstellungen** | Farbwelt (gespeichert in `users.theme`, gilt auch in Wir), Herzfarbe, Benachrichtigungen (nur für diese App), „Wir öffnen“, App neu laden, Abmelden, ⌨️ Konsole (gleiche Befehle wie in Wir) |
| **Shop** | Der Gutschein-Shop von 23.10. ist wieder da (Verschenken + Gutschein-Fach, Erfüllen +15). Sortiment weiter in `shop_items`. |

Coins verdient man weiter in Wir (Liebe, Briefe, Fotos); der Tagesbonus kommt beim ersten Öffnen einer der beiden Apps. Gebucht wird nur auf dem Server.

## Dateien

| Wo | Was |
|---|---|
| `spiele/` | die Spiele-App: `index.html`, `app.js` (Login, Start, Push-Ziele), `games.js`, `mono-ui.js`, `coins.js`, `shop.js`, `casino.js`, CSS, `lib/chess.js`, `lib/mono.js`, `sw.js`, `manifest.json`, `icons/` |
| `shared/` | **gemeinsam für beide Apps:** `pocketbase.umd.js`, `base.css` (Farbwelten + Grundbausteine), `ui.js` (Seiten, Sheets, Herzen, Berlin-Zeit), `look.js` (Farbwelt + Herzfarbe), `push.js` (Push-Abo mit App-Kennung), `activity.js` + `activity.css` (Online-Punkt + Konsole), `update.js` (Update-Hinweis) |
| `pocketbase/pb_hooks/wir_shared.pb.js` | liefert `shared/` für Wir unter `/shared/…` aus |
| `pocketbase/pb_hooks/wir_coins.pb.js`, `coins_lib.js` | Shop-Routen wieder drin: `POST /api/shop/gift`, `/api/vouchers/{id}/redeem`, `/api/vouchers/{id}/fulfill` |
| `push/index.js` | Spiel-Pushs (`chess`, `ttt`, `mono`, `sudoku`, `gift`) gehen an Abos mit `app = "spiele"`, alles andere an `app = "wir"` (oder leer = alte Abos). Ohne Spiele-Abo ersatzweise an Wir mit `app: "spiele"` – Wir öffnet dann beim Tippen die Spiele-App. |

## Datenbank (nur additiv)

`pocketbase/pb_migrations/1793100000_wir_spiele_app.js`: neues Feld `push_subs.app` (Auswahl `wir` | `spiele`, optional). Sonst nichts – alle Spiel-, Ranglisten-, Coin- und Herzstadt-Daten bleiben, wie sie sind.

## Ausliefern auf Port 8443 (Tailscale direkt aus dem Repo)

Kein eigener Webserver: Tailscale liefert die Ordner aus dem Repo direkt aus. Ein `git pull` (Auto-Deploy) aktualisiert die App sofort; das Auto-Deploy prüft außerdem bei jedem Update, dass die Freigabe noch steht, und legt sie sonst neu an.

Einmalig (sudo, vom Nutzer – Ordner freigeben darf bei Tailscale nur root; die Freigabe bleibt gespeichert, auch nach Neustarts):
```bash
sudo tailscale set --operator=pingu      # erlaubt pingu u. a. "tailscale funnel status"
sudo tailscale funnel --bg --https=8443 /home/pingu/F-r-dich/spiele
sudo tailscale funnel --bg --https=8443 --set-path=/shared /home/pingu/F-r-dich/shared
```
```bash
tailscale funnel status        # zeigt :443 (Wir) und :8443 (Spiele, / und /shared)
```
Abschalten: `sudo tailscale funnel --https=8443 off`.

## Auf dem iPhone

https://wir.geep-flops.ts.net:8443 in Safari öffnen → Teilen → **Zum Home-Bildschirm** → App öffnen → mit dem Wir-Konto anmelden → Avatar → 🔔 **Benachrichtigungen aktivieren**. Ohne das kommen Spiel-Pushs weiter über Wir an (Tippen öffnet dann die Spiele-Seite in Safari).

## Sicherung vorher

- Git-Tag **`vor-spiele-app`** = Commit `d59ceac`, auf GitHub gepusht.
- DB-Backup (SQLite-Backup-Funktion, Integritätsprüfung „ok“): `/home/pingu/backups/vor-spiele-app-2026-10-26/` mit `data.db`, `auxiliary.db`, `storage/`, `pb_migrations/`, `pb_hooks/` (Stand 26.10.2026 19:54).

## Zurück auf „vor-spiele-app“

Das Schema wurde nur erweitert, die alte Wir-App läuft damit unverändert. **Normalerweise reicht Schritt 1.**

**1. Code zurück (am PC):**
```bash
cd Documents/F-r-dich
git checkout main && git pull
git checkout vor-spiele-app -- app push pocketbase/pb_hooks deploy
git rm -rq spiele shared pocketbase/pb_hooks/wir_shared.pb.js
git commit -m "Zurück zur Version vor der Spiele-App" && git push
```
Auf dem Pi danach (das Auto-Deploy löscht keine Hook-Dateien):
```bash
rm /home/pingu/pb/pb_hooks/wir_shared.pb.js && sudo systemctl restart pocketbase
sudo tailscale funnel --https=8443 off
```
Wir hat dann wieder Spiele, Coins und Casino (Stand 23.10., ohne Shop). Das Feld `push_subs.app` bleibt ungenutzt stehen. Kein `git reset --hard` + `push --force` (sonst bricht das Auto-Deploy ab). Wieder vor: `git revert --no-edit HEAD && git push`.

**2. Nur falls Daten kaputt sind:** wie oben unter „Zurück zur alten Version → 2.“, aber mit dem Ordner
`/home/pingu/backups/vor-spiele-app-2026-10-26/`. ⚠️ Alles nach dem 26.10.2026 19:54 geht dabei verloren.

## Wir nach dem Umzug (Service Worker `wir-v20`)

Erst nachdem die Spiele-App live lief, wurden aus Wir **Spiele, Coins-Chip, Coin-Sheet und Casino entfernt** (`app/games.*`, `mono-ui.js`, `coins.*`, `casino.*`, `activity.*`, `app/lib/` – liegen jetzt in `spiele/` bzw. `shared/`).
Getestet lokal mit beiden Accounts: 30 UI-Prüfungen (alle Bereiche, Liebe live, Lightbox, Sheets, Einstellungen, Farbwelten, Konsole, Online-Punkt, alte Push-Ziele), keine Konsolenfehler.

| Wo | Was |
|---|---|
| **Leiste unten** | 🏡 Start · 📸 Erinnerungen · 📅 Dates · 💌 Öffne wenn · 💞 **Wir zwei** (wieder als Reiter, statt 🎲 Spiele) |
| **Start** | Kachel **„🎲 Spiele öffnen“** unten (öffnet https://wir.geep-flops.ts.net:8443). Steht „Du bist am Zug: Schach · Tic Tac Toe“ drin und leuchtet, wenn du dran bist. |
| **Einstellungen** | unverändert; Farbwelt, Herzfarbe, Push und Konsole kommen jetzt aus `shared/` (dieselben Dateien wie in der Spiele-App) |
| **Coins** | werden weiter in Wir verdient (Liebe, Briefe, Fotos, Tagesbonus beim Öffnen) – angezeigt nur noch in der Spiele-App |
| **Alte Pushs** | Tippen auf eine alte Spiel-Benachrichtigung öffnet Wir auf Start. Spiel-Pushs ohne Spiele-Abo öffnen die Spiele-App. |

Wir lädt `/shared/…` über die Route in `pb_hooks/wir_shared.pb.js`; `app/style.css` enthält nur noch Wir-eigene Styles, die Grundlage steht in `shared/base.css`.

**Nur Wir zurück auf den Stand mit Spielen (Spiele-App bleibt):**
```bash
git checkout vor-spiele-app -- app && git commit -m "Wir wieder mit Spielen" && git push
```
(Wir braucht dafür keine `shared/`-Dateien.) Ganz zurück: siehe „Zurück auf vor-spiele-app“ oben.

---

# Sync-Knopf + Schütteln 26.10.2026 (Wir `wir-v21`, Spiele `spiele-v2`)

Gilt für beide gleich und in **beiden Apps**. Getestet mit einer lokalen PocketBase 0.40.5 und einer Kopie des Backups:
- **API, 21 Tests:** Rechte, Sync nach ≥ 1 s gemeinsamem Halten genau einmal, erst nach Loslassen wieder, 0,5 s reicht nicht, Halten ohne Heartbeat nach 3 s veraltet, Push „hält den Sync-Knopf“ nur wenn die andere Person offline ist und höchstens alle 10 Minuten, AHHHH-Push höchstens alle 30 s, Log-Einträge, `live_state` bleibt bei 2 Datensätzen.
- **UI, 23 Prüfungen:** Daniel in Wir, Ida gleichzeitig in der Spiele-App und in Wir (eins davon mit „Bewegung reduzieren“). Halten wird live angezeigt, „You are in sync“ erscheint bei allen, Schütteln während Ida Schach spielt: Die App wackelt, das Brett bleibt bedienbar, der Spielstand bleibt unverändert. Mit reduzierter Bewegung wackelt nichts. Keine Konsolenfehler.

## Was es kann

| Wo | Was |
|---|---|
| **Start (Wir und Spiele)** | Runder **Sync-Knopf** mit pochendem Herz in deiner Herzfarbe, „Gedrückt halten“. Beim Halten leuchtet ein Ring in deiner Farbe, hält die andere Person gerade, siehst du einen zweiten Ring in ihrer Farbe („Ida hält gerade – halt mit! 💞“). |
| **Sync** | Halten beide gleichzeitig mindestens 1 s: bei beiden groß **„You are in sync“** + Herzen in beiden Herzfarben über den ganzen Bildschirm (~4 s). Danach erst wieder, wenn ihr beide losgelassen habt. |
| **Push** | Fängt jemand an zu halten, während die andere Person die App nicht offen hat: „💞 Daniel hält den Sync-Knopf“ (höchstens alle 10 Minuten pro Person). |
| **Schütteln** | Kräftiges Schütteln (mehrere starke Ausschläge in < 1 s, Gehen reicht nicht) in jeder Ansicht, auch in Spielen. Bei der anderen Person regnen ~3 s lang Herzen in deiner Farbe und die ganze App wackelt (nur wenn ihre App offen ist). Dazu ein Push **„AHHHH“ – „Daniel schüttelt das Handy 💥“** (höchstens alle 30 s, Tippen öffnet Wir). Du selbst siehst einen kleinen Herz-Puff als Bestätigung. |
| **Einstellungen → 💥 Schütteln** | Schalter „Schütteln erkennen“. Auf dem iPhone fragt Safari dabei einmal nach dem Bewegungssensor. Ist er aus, fragt die App beim ersten Antippen des Sync-Knopfs einmal freundlich nach. Der Zustand wird pro Gerät gemerkt. |
| **Konsole `/log`** | „💞 In sync 💞 mit Ida“ und „💥 hat geschüttelt 💥“ |

iPhones können im Browser nicht vibrieren, deshalb wackelt nur die Oberfläche. Mit „Bewegung reduzieren“ (iOS-Einstellung) gibt es weniger Herzen und kein Wackeln.

## Technik / Sicherheit

- **Server:** `pb_hooks/wir_sync.pb.js` (Routen), Logik in `sync_lib.js`:
  - `POST /api/sync/hold {down}`: Heartbeat alle 0,5 s beim Halten. Der Server entscheidet den Sync in einer Transaktion und setzt bei beiden `sync_at`.
  - `POST /api/shake`: Lebenszeichen höchstens 1×/s.
  - Pushs über `push_queue` (Arten `sync`, `shake` → Wir, Start).
  - Log über `activity` (Art `fx`).
- **Datenbank (nur additiv):** `pb_migrations/1793200000_wir_sync_shake.js` legt `live_state` an.
  - Genau **ein Datensatz pro Person** (eindeutiger Index), der immer überschrieben wird. Es häuft sich nichts an, ein Cron ist nicht nötig.
  - Lesen dürfen nur Eingeloggte (für Realtime). Anlegen, Ändern und Löschen geht nur über die Routen.
  - Die Push-Pausen stehen in versteckten Feldern.
- **Client:** `shared/fx.js` + `shared/fx.css` (ein Modul für beide Apps):
  - Herz-Regen per Canvas, höchstens 70 Herzen, läuft nur, solange etwas zu sehen ist.
  - Wackeln über die Klasse `fx-wobble` auf `<html>`, die Animation läuft auf dem `body`.
  - Das Overlay hat `pointer-events: none`.
  - Der Bewegungssensor läuft nur bei sichtbarer App und eingeschaltetem Schütteln.
  - Der Sync-Knopf erscheint in `#syncSlot`, der Schalter ist `#shakeSwitch`.
- **Testen lokal:** In der Browser-Konsole `WIR_FX.simulateShake()`. Das gibt es nur außerhalb von `*.ts.net`, live nicht.

## Sicherung vorher

Git-Tag **`vor-sync-schuetteln`** = `86fc393`; DB-Backup `/home/pingu/backups/vor-sync-schuetteln-2026-10-26/` (20:54, Integritätsprüfung „ok“).

## Zurück auf „vor-sync-schuetteln“

```bash
cd Documents/F-r-dich && git checkout main && git pull
git checkout vor-sync-schuetteln -- app spiele shared push pocketbase/pb_hooks
git rm -q shared/fx.js shared/fx.css pocketbase/pb_hooks/wir_sync.pb.js pocketbase/pb_hooks/sync_lib.js
git commit -m "Zurück vor Sync-Knopf und Schütteln" && git push
# auf dem Pi (das Auto-Deploy löscht keine Hook-Dateien):
rm /home/pingu/pb/pb_hooks/wir_sync.pb.js /home/pingu/pb/pb_hooks/sync_lib.js && sudo systemctl restart pocketbase
```
`live_state` bleibt ungenutzt stehen (oder im Admin-UI löschen, enthält nur Kurzzeit-Daten). Nur falls Daten kaputt sind: Backup wie unter „Zurück zur alten Version → 2.“ mit dem Ordner `vor-sync-schuetteln-2026-10-26`.

---

# Spiele zurück in Wir 26.10.2026 (Etappe 1, Wir `wir-v22`)

Die separate Spiele-App (:8443) ist wieder in Wir aufgegangen. Vorwärts umgebaut, Sync-Knopf und Schütteln bleiben. Alle Daten sind unverändert.

| Wo | Was |
|---|---|
| **Leiste unten** | 🏡 Start · 📸 Erinnerungen · 📅 Dates · 💌 Öffne wenn · 🎲 **Spiele** (wie vor der Trennung). „Wir zwei“ ist wieder eine Karte auf Start, darüber der Hinweis „Du bist am Zug: …“. |
| **Kopf** | links Avatar (→ Einstellungen) und daneben das kleine **Sync-Herz**. Es pulst sanft, beim Halten wächst ein Ring in deiner Farbe, hält die andere Person, leuchtet der Rand in ihrer Farbe (+ kurzer Hinweis oben). Rechts im Spielebereich die **Coins** (Tippen → Verlauf + Shop). |
| **Spiele** | Übersicht in drei Gruppen: **Zu zweit** (Schach, Tic Tac Toe, Herzstadt, Herzspur*, Poker*), **Denkspiele** (Sudoku, Solitär*, Schach gegen KI*), **Casino** (Blackjack, Poker gegen KI*). Große Karten mit Badge „Du bist dran“ / „Läuft“ (* = kommt in den nächsten Etappen). |
| **In jedem Spiel** | gleicher Kopf: ← Zurück · Titel · ⋯ Menü (Remis/Aufgeben/Bilanz, Regeln, Handeln, Neues Rätsel, Fehler markieren …) |
| **Pushs** | Alle Spiel-Pushs gehen wieder an Wir. Abos mit `app = "spiele"` bleiben in der DB, werden aber nicht mehr bedient. |
| **Alte Spiele-App** | `spiele/` ist nur noch eine Weiterleitungsseite, ihr Service Worker entfernt sich selbst. Port 8443 wird danach abgeschaltet. |

Der alte Gutschein-Shop ist raus (live gab es keine Gutscheine, die Collections bleiben). Der neue Shop kommt in Etappe 2.

**Zurück (am PC):**
```bash
git checkout vor-spiele-zurueck -- app spiele shared push && git commit -m "Zurück vor Spiele-Rückumzug" && git push
```
Backup: `/home/pingu/backups/vor-spiele-zurueck-2026-10-26/` (21:23, „ok“).

# Etappe 2 (Wir `wir-v23`): neuer Shop, Schach gegen KI, Solitär, Tipps

Getestet lokal mit einer Kopie des Backups: 21 API-Prüfungen (Rechte, Doppelkäufe, Bomben-Limit, Nachtruhe, Prüfung der Ergebnisse) und ein Browser-Test (Shop, Rahmen, Solitär, Stockfish-Zug + Tipp, Aufgeben).

## Shop (Coins oben rechts im Spielebereich → „Shop“)

**Alle Preise und Regeln stehen an EINER Stelle: `pocketbase/pb_hooks/shop_lib.js` (`PRICES`, `GAME_EARN`).** Gekauft wird nur auf dem Server: Login und Guthaben werden geprüft, die Coins atomar über `coin_ledger` abgezogen und der Kauf in `shop_purchases` gespeichert. Vor jedem Kauf erscheint eine Bestätigung mit Preis und Guthaben.

| Was | Preis | Regel |
|---|---|---|
| 💡 Tipp Solitär | 5 | nächster sinnvoller Zug oder „kein Zug möglich“ |
| 💡 Tipp Sudoku | 10 | Server deckt ein sinnvolles Feld auf (zuerst ein falsches, sonst das mit den wenigsten Möglichkeiten) |
| 💡 Tipp Schach gegen KI | 15 | bester Zug wird markiert (Stockfish volle Stärke). Im Duell gegeneinander gibt es keine Tipps. |
| 🖼️ Profilrahmen einfach | 150 | Rosa Doppelring, Goldrand, Perlenkette |
| 🖼️ Profilrahmen besonders | 300 | Herzkranz, Blumenkranz, Mondnacht-Sterne |
| 🖼️ Profilrahmen animiert | 600 | Pulsierendes Herz, Glitzer, Zuckerwatte-Wirbel |
| 💣 Herz-Bombe | 80 | 30 Pushs „❤️“ im Abstand von 1,5 s |
| 💣 Nachrichten-Bombe | 150 | 10 Pushs mit eigenem Text (max. 60 Zeichen, Steuerzeichen raus) |

- Ergebnisse mit Tipp tragen in der Rangliste ein 💡. Die Tipps zählt der Server aus `shop_purchases`.
- Profilrahmen: einmal kaufen, für immer behalten. Auswählen oder abnehmen geht in den Einstellungen (🖼️ Profilrahmen). Der Rahmen erscheint überall am Profilbild, auch bei der anderen Person, und der Online-Punkt liegt darüber. Direkt über die users-API lässt er sich nicht setzen (Hook in `wir_shop.pb.js`).
- Bomben: höchstens 3 pro Person und Tag. In der Nachtruhe (23–7 Uhr Berlin) wird die Bombe angenommen und um 7:00 verschickt, der Käufer sieht das vorher. Beim Empfänger erscheint „💣 Daniel hat eine Herz-Bombe gezündet“ mit Herzen, dazu ein Eintrag im `/log`. wir-push verschickt jede Bombe einzeln (eigener tag, kein Topic) und plant künftige Pushs punktgenau ein.
- Der alte Gutschein-Shop ist ersetzt. `shop_items` und `vouchers` bleiben unverändert in der DB.

**Coins fürs Spielen** (zusätzlich, bestehende EARN-Regeln unverändert, höchstens 15 Spiel-Gutschriften pro Tag): Sudoku gelöst 5/10/20 (Leicht/Mittel/Schwer), Solitär 10 (1 Karte) bzw. 20 (3 Karten), Sieg gegen die KI 3/6/10/15/25 (Anfänger … Meister), Herzspur-Sieg 5 (Etappe 4).

## Schach gegen KI

- **Stockfish 10** (stockfish.js 10.0.2, WebAssembly, 62 KB + 367 KB) in `app/lib/stockfish/`. **Lizenz: GNU GPL v3** (`app/lib/stockfish/COPYING-GPL3.txt`), unverändert aus dem npm-Paket.
- Läuft als Web Worker und wird erst beim ersten Öffnen geladen. Der Service Worker cacht ihn danach.
- 5 Stufen (Anfänger, Leicht, Mittel, Stark, Meister), Farbe Weiß/Schwarz/Zufall. Die Partie bleibt beim Schließen erhalten (localStorage).
- Das Ergebnis prüft der Server: `/api/games/chessai/result` spielt die Zugliste nach, erkennt Matt/Remis und vergibt Coins nur einmal pro Partie. Bilanz beider im Menü ⋯.

## Solitär (Klondike)

- 1 oder 3 Karten ziehen. Ziehen & Ablegen oder Antippen (legt automatisch ab), Rückgängig, Zeit, Züge, „⚡ Ablegen“, sobald alles offen liegt.
- Die Partie (Seed fürs Mischen) gibt der Server aus. Gespielt wird im Browser, der Stand bleibt im localStorage.
- Ein Gewinn wird erst nach mindestens 40 s angenommen. Punkte: 40 bzw. 80 + Zeitbonus unter 15 min, −5 pro Tipp.
- Rangliste für beide, Log-Eintrag und Push „🃏 … hat ein Solitär gelöst“.

## Datenbank (nur additiv)

`pb_migrations/1793300000_wir_shop_neu.js`: `users.frame`, `sudoku_scores.hints`, neue Collections `shop_purchases`, `bombs`, `solitaire_games`, `chessai_games` (für Clients nur lesbar).

**Zurück vor Etappe 2:** `git checkout ebb35b1~2 -- app push pocketbase/pb_hooks && git commit -m "Zurück vor Etappe 2" && git push`. Danach auf dem Pi die neuen Hooks entfernen: `rm /home/pingu/pb/pb_hooks/{wir_shop.pb.js,shop_lib.js,solo_lib.js} && sudo systemctl restart pocketbase`.

# Etappe 3 (Wir `wir-v24`): Poker (Texas Hold’em, nur Spielgeld)

Getestet: Engine mit 4.077 Zufallshänden (2–4 Spieler, zufällige und KI-Aktionen). Die Chips bleiben immer gleich, nichts wird negativ, die Handbewertung stimmt inklusive Kicker. Dazu 14 API-Prüfungen gegen eine Kopie des Backups (verdeckte Karten unsichtbar, nur eigene Karten, Versionsprüfung, Buy-in und Auszahlung stimmen) und ein Browser-Test.

| Wo | Was |
|---|---|
| **Spiele → Zu zweit → Poker** | Heads-up gegen die andere Person, asynchron. Einladen → Push „♠️ Daniel lädt dich zum Poker ein“ → Platz nehmen. Danach „♠️ Poker: Du bist dran“ (zählt beim Spiele-Punkt und bei „Du bist am Zug“ mit). |
| **Spiele → Casino → Poker** | solo gegen 1–3 KI: Mimi 🐱 (vorsichtig), Bruno 🐻 (Draufgänger), Foxi 🦊 (Fuchs, blufft öfter). Die KI schätzt ihre Gewinnchance per Monte-Carlo und entscheidet nach Pot-Odds und Stil. |
| **Tisch** | Gegner oben (Chips, Einsatz, verdeckte Karten), Filz mit Board und Pot, eigene Karten unten. Passen / Schieben / Mitgehen, Erhöhen mit Schieberegler und ½ Pot / Pot / All-in. Nach jeder Hand zeigt ein Banner die Gewinnerhand („Ida gewinnt 120 mit Zwei Paaren“). Menü ⋯: Aufstehen & auszahlen, Regeln. |
| **Coins** | Platz nehmen kostet 50–200 Coins (= Chips), Blinds 5/10. Beim Aufstehen oder Spielende werden die Chips 1:1 zurückgetauscht. Ein- und Auszahlung laufen über `coin_ledger` (Grund `poker`) und zählen zum **Casino-Tageslimit** (300 Coins Verlust pro Tag, gemeinsam mit Blackjack). |

**Sicherheit:**
- Mischen (sicherer Zufall), Austeilen, Setzrunden, Side-Pots, Bewertung und Auszahlung macht nur der Server: `pb_hooks/poker.js` (Regeln) und `poker_lib.js` (Tische/Coins), Routen in `wir_poker.pb.js`.
- `poker_tables.state` (Stapel und alle Karten) ist versteckt. Gegnerkarten stehen erst beim Showdown in `pub`, die eigenen Karten gibt es nur über `GET /api/poker/{id}`.
- Jede Aktion prüft die Versionsnummer, ein Doppeltipp gibt 409.

**Datenbank (nur additiv):** `pb_migrations/1793400000_wir_poker.js` legt `poker_tables` an.

**Zurück vor Etappe 3:** im Repo `app/poker.js` und die Poker-Karten entfernen, oder die Commits von Etappe 3 per `git revert` zurücknehmen. Auf dem Pi danach: `rm /home/pingu/pb/pb_hooks/{wir_poker.pb.js,poker_lib.js,poker.js} && sudo systemctl restart pocketbase`.

# Etappe 4 (Wir `wir-v25`): Herzspur (Lichtrennen zu zweit, live)

Getestet mit zwei Browserfenstern (Daniel + Ida) gegen eine Kopie des Backups: Einladung, Mitfahren, Countdown, Live-Frames beim Gast, Runde entschieden mit gleichem Stand auf beiden Geräten, Abbruch.

| Wo | Was |
|---|---|
| **Spiele → Zu zweit → Herzspur** | „🏁 Herausfordern“ → Push „🏁 Daniel will Herzspur spielen“ → „💗 Mitfahren“. Beide brauchen die App offen. |
| **Spiel** | Raster 24×34. Jede Person fährt eine Spur in ihrer Herzfarbe. Lenken per Wischen auf dem Feld oder mit den Pfeiltasten (auch Tastatur-Pfeile), umdrehen geht nicht. Wand oder Spur = Runde verloren, Herz-Explosion beim Crash. Fahren beide gleichzeitig gegen etwas, ist die Runde unentschieden. |
| **Match** | Best of 5: wer zuerst 3 Runden hat. Der Sieg bringt Heart Coins (Grund `game`, nur einmal pro Match über den Ledger-Schlüssel). Statistik Siege/Niederlagen auf der Lobby-Karte und in der Übersicht, Log-Einträge für beide. |
| **Abbruch** | App schließen, in den Hintergrund oder auf eine andere Seite wechseln beendet das Match sauber. Kommt 6 s lang nichts von der anderen Seite, wird ebenfalls abgebrochen („Verbindung weg“). |

**Technik:**
- Das Gerät der einladenden Person (Host, `p1`) rechnet mit festen **10 Ticks/s** und schickt nach jedem Tick die Köpfe. Das andere Gerät schickt nur Richtungswechsel. Synchroner Start mit 3-s-Countdown vom Host.
- Nachrichten laufen über `POST /api/trail/{id}/msg`. PocketBase reicht sie als **Realtime-Nachricht** (Topic `trail/<id>`) nur an die andere Person des Matches weiter. Nichts davon wird in der Datenbank gespeichert, ein eigener WebSocket-Dienst ist nicht nötig.
- Spielstand, Gewinner und Coins nur über `/api/trail/{id}/result` (nur der Host). Routen in `pb_hooks/wir_herzspur.pb.js` + `trail_lib.js`.
- **Datenbank (nur additiv):** `pb_migrations/1793500000_wir_herzspur.js` legt `trail_matches` an.

**Zurück vor Etappe 4:** die Commits von Etappe 4 per `git revert` zurücknehmen. Auf dem Pi danach: `rm /home/pingu/pb/pb_hooks/{wir_herzspur.pb.js,trail_lib.js} && sudo systemctl restart pocketbase`.

# Port 8443 entfernt (separate Spiele-App abgeschaltet)

Alles läuft wieder in Wir. Der Ordner `spiele/` ist aus dem Repo gelöscht, das Auto-Deploy prüft :8443 nicht mehr. `shared/` bleibt (Wir lädt daraus über `/shared/…`).
Freigabe auf dem Pi beenden (einmalig, sudo):
```bash
sudo tailscale funnel --https=8443 off
tailscale funnel status        # nur noch https://wir.geep-flops.ts.net (443 -> 8090)
```
Alte Push-Abos mit `app = "spiele"` bleiben in `push_subs`, werden aber nicht mehr bedient. Auf den iPhones das Spiele-Symbol vom Home-Bildschirm löschen.

**Zurück zur separaten Spiele-App:** siehe oben „Eigene Spiele-App 26.10.2026“ (Tag `vor-spiele-zurueck`).

---

# Fixes 26.10.2026 (Wir `wir-v26`)

- **Blackjack hing:** Seit dem Rückumzug fehlte im Blackjack-Kopf das Guthaben-Element (`#bjBal`), `casino.js` stürzte beim Zeichnen ab, und Austeilen/Aktionen reagierten nicht. Behoben (das Guthaben steht oben rechts im Kopf).
  - Die Migration `1793600000_wir_bj_reset.js` beendet einmalig alle nicht abgeschlossenen Runden. Offene Einsätze erstattet sie mit eigenem Ledger-Eintrag „🃏 Blackjack: Runde abgebrochen – Einsatz erstattet“ (Schlüssel `bj:<runde>:refund`). Gelöscht wird nichts.
  - Live gab es beim Backup keine offene Runde.
- **Profilrahmen:** 6 von 9 Rahmen hatten kein sichtbares Design, weil eine allgemeine Regel spezifischer war und ihren Hintergrund überschrieb. Behoben (`:where()` in `frames.css`). Alle Rahmen sind in jeder Farbwelt geprüft, die Shop-Vorschau ist die echte Darstellung. Gekaufte Rahmen bleiben gekauft.
- **Bomben:** kein Tageslimit und keine Nachtruhe mehr. Sie gehen sofort raus, so oft man will (nur der Preis begrenzt). Texte im Shop angepasst.
- **Sync-Herz:** größer (48 px), gefüllt in der eigenen Herzfarbe mit weißem Herz und weißem Rand, sanftes Leuchten. Beim ersten Mal erscheint der Hinweis „Gedrückt halten – gemeinsam in sync 💞“. Die Logik ist unverändert.
- **Öffne wenn:** Alle Kategorien sind immer sichtbar, auch leere („Noch kein Brief – bald 💭“). Die Liste erscheint sofort aus dem Zwischenspeicher und lädt dann frisch.
- **Formatierung:** alle 21 Bildschirme automatisch auf SE (375), Standard (390) und Pro Max (430) geprüft.
  - Die „Du bist am Zug“-Einblendung liegt nicht mehr über dem Kopf.
  - Titel und Tab-Beschriftungen werden nicht mehr abgeschnitten, kein seitliches Überlaufen in der Spiele-Übersicht.
  - Bottom-Sheets bleiben über der Bildschirmtastatur (`--kb` aus `visualViewport`), Eingabefelder scrollen beim Antippen in die Mitte.

**Zurück:** `git checkout vor-fixes -- app shared pocketbase/pb_hooks && git commit -m "Zurück vor Fixes" && git push` (Backup `/home/pingu/backups/vor-fixes-2026-10-26`).

# Dates neu 26.10.2026 (Wir `wir-v27`)

| Wo | Was |
|---|---|
| **Dates (Reiter unten)** | Umschalter **Geplant** (nächstes zuerst, „in 3 Tagen“/„Morgen“/„Heute“) · **Vergangen** (neuestes zuerst) · **Zeitstrahl** (eure Geschichte von neu nach alt mit Monatsmarken, „Heute 💗“-Marke und Bildstreifen). „➕ Date planen“ öffnet das Formular: Art (Date, Treffen, Essen, Film, Ausflug, Reise, Clay Date, Sonstiges), Emoji, Titel, Zeitpunkt, Ort, Notiz. |
| **Ein Date** | Antippen → Detail mit Art, Zeit, Ort, Notiz. Bilder: direkt hochladen oder Fotos aus Erinnerungen verknüpfen („🔗 Aus Erinnerungen“, in Erinnerungen bleiben sie). Im Großbild: Verknüpfung lösen bzw. Bild löschen. ✎ = bearbeiten/löschen. |
| **Automatisch vergangen** | 3 Std. nach Beginn rutscht ein Date zu „Vergangen“. Hat es noch keine Bilder, steht „📷 Bilder hinzufügen?“ an der Karte und im Detail. |
| **Clay Date** | ist jetzt ein normales Date (Art „clay“). Im Detail gibt es die Unterbereiche Ideen und Unsere Figuren (dieselben Seiten und Daten wie vorher). |
| **Mehr** | Unsere Daten (Jahrestage), Clay-Ideen. Darunter wie gehabt die Listen & Überraschungen (Reiter). |
| **Start** | Der Countdown zeigt das nächste Date (Titel, Ort). „+ Nächstes Date planen“ öffnet das Formular. Die Pushs „Morgen/Heute sehen wir uns 💗“ kommen jetzt für alle Dates. |

**Datenbank (nur additiv):** `pb_migrations/1793700000_wir_dates.js` legt `date_events` an (Bilder geschützt wie bei Erinnerungen) und kopiert jedes Treffen als Date der Art „treffen“ (`legacy = meeting:<id>`, nie doppelt) sowie das Clay Date (`legacy = clay`). `meetings`, `clay_photos`, `dates`, `tabs` bleiben unverändert stehen. Der Treffen-Cron (`wir_lib.js` → `meetingTick`) liest jetzt `date_events`.

**Zurück:** `git checkout vor-dates -- app pocketbase/pb_hooks && git commit -m "Zurück vor Dates" && git push` (Backup `/home/pingu/backups/vor-dates-2026-10-26`). `date_events` bleibt dann ungenutzt stehen, die alten Treffen sind unverändert.

# Einkaufsliste 26.10.2026 (Wir `wir-v28`)

| Wo | Was |
|---|---|
| **Start → 🛒 Einkaufsliste** | Kachel über „Wir zwei“ (zeigt, wie viele Sachen drauf sind). Kein neuer Reiter unten. |
| **Liste** | Oben die Listen als Chips (Standard „🛒 Einkauf“, „➕ Liste“ für weitere, z. B. Drogerie; umbenennen/löschen). Darunter alles, was drauf ist, als bunte Kacheln nach Kategorien. **Antippen = gekauft** (wandert zu „Zuletzt verwendet“), **gedrückt halten = Angabe** (2x, bio, 500 g). |
| **Hinzufügen** | Suche mit Vorschlägen beim Tippen (Enter nimmt den ersten). Katalog mit ~200 gängigen deutschen Artikeln in 12 Kategorien (Obst & Gemüse, Kühlregal, Fleisch & Fisch, Brot, Vorrat, Gewürze & Backen, Süßes, Getränke, Tiefkühl, Haushalt, Drogerie, Sonstiges). Findet die Suche nichts: „➕ <Text>“ legt einen eigenen Artikel an (bleibt im Katalog). „Zuletzt verwendet“: ein Tipp, und er ist wieder drauf. |
| **Live** | Änderungen erscheinen sofort bei beiden (Realtime). |
| **Push** | „🛒 Ida hat 3 Sachen auf die Einkaufsliste gesetzt“ mit den Artikeln. Gesammelt (erste Minute) und höchstens alle 10 Minuten (`pb_hooks/grocery_lib.js`). Tippen öffnet die Liste. |

**Datenbank (nur additiv):** `pb_migrations/1793800000_wir_einkauf.js` legt `grocery_lists` (mit „Einkauf“), `grocery_entries` und `grocery_custom` an. Beide dürfen lesen und schreiben, angelegt wird nur mit sich selbst als Autor.

**Zurück:** `git checkout vor-einkauf -- app pocketbase/pb_hooks push && git rm -q app/grocery.js pocketbase/pb_hooks/wir_einkauf.pb.js pocketbase/pb_hooks/grocery_lib.js && git commit -m "Zurück vor Einkauf" && git push`, danach auf dem Pi `rm /home/pingu/pb/pb_hooks/{wir_einkauf.pb.js,grocery_lib.js} && sudo systemctl restart pocketbase`.

# Stimmung, Support & Chat 26.10.2026 (Wir `wir-v29`)

| Wo | Was |
|---|---|
| **Start → „Wie geht’s euch?“** | Stimmung beider (Emoji, %, „vor 2 Std.“). Antippen öffnet den **Drehregler** (0–100 %, mit dem Finger im Kreis drehen; Farbe und Emoji wandern mit) plus Verlauf der letzten 14 Tage für beide. |
| **Stimmungs-Push** | Fällt die eigene Stimmung unter 50 %, bekommt die andere Person **einmal** „💗 Daniel geht es gerade nicht so gut“. Erneut erst, wenn zwischendurch ≥ 50 % gespeichert wurde. Entscheidet der Server (`mood_flags`, `pb_hooks/chat_lib.js`). |
| **🫂 Ich brauche dich** | Auf der Karte (und „Support“ auf Start und in „Wir zwei“): Art wählen (Anruf, Ablenkung, einfach da sein, reden) + kurze Nachricht → sofort Push. Bei der anderen Person bleibt die Anfrage oben sichtbar, bis sie antwortet („Bin da 💗“, „Ruf dich gleich an 📞“, „Bin gleich für dich da ⏳“). Die Antwort kommt per Push zurück. ✕ blendet aus. |
| **💬 Chat** | Knopf oben rechts mit Ungelesen-Zahl (auch „Chat“ auf Start). Text, Emojis, 📷 Bilder, Enter sendet (Shift+Enter = neue Zeile). **Gedrückt halten** auf einer Nachricht: Reaktion, Antworten, Kopieren, Löschen (eigene). **Doppeltipp** = ❤️. ✓ gesendet, ✓✓ gelesen, „Ida schreibt …“. |
| **Chat-Push** | Nur wenn die Nachricht 15 s lang nicht gelesen wurde. Mehrere Nachrichten werden zu einem Push gebündelt („💬 Ida (3 Nachrichten)“). |

**Sicherheit:** Chat und Anfragen lesen nur Absender und Empfänger. Den Empfänger, „gelesen“ und Reaktionen setzt nur der Server. Anfragen und Antworten laufen nur über `/api/support…`.

**Datenbank (nur additiv):** `pb_migrations/1793900000_wir_chat.js` legt `moods`, `mood_flags`, `support_requests` und `chat_messages` an.

**Zurück:** `git checkout vor-chat -- app pocketbase/pb_hooks push shared && git rm -q app/care.js app/chat.js pocketbase/pb_hooks/wir_chat.pb.js pocketbase/pb_hooks/chat_lib.js && git commit -m "Zurück vor Chat" && git push`, danach auf dem Pi `rm /home/pingu/pb/pb_hooks/{wir_chat.pb.js,chat_lib.js} && sudo systemctl restart pocketbase`. DB-Sicherung: `/home/pingu/backups/vor-chat-2026-10-26 23:25`.

# Snake 26.10.2026 (Wir `wir-v30`)

| Wo | Was |
|---|---|
| **Spiele → 🧩 Solo & Denkspiele → 🐍 Snake** | Herzen 💗 sammeln, nicht an die Wand oder in sich selbst fahren. Startet bei der ersten Eingabe. Alle 5 Herzen ein Level und schneller. Punkte: 10 × Level pro Herz. |
| **Steuerung** | Wischen auf dem Feld, Pfeiltasten darunter (⋯-Menü: „Pfeiltasten anzeigen“ an/aus), am PC Pfeile/WASD, Leertaste/Enter = Pause/Weiter. |
| **Pause** | Verlassen des Spiels oder der App pausiert und speichert die Runde (auch nach Neuladen). Im Hub steht dann „Pausiert“. |
| **Coins** | Pro Runde ab 100 Punkten 3, ab 250 6, ab 500 10, ab 1000 15. Vergibt nur der Server, genau einmal pro Runde (Schlüssel `game:snake:<id>`), zählt zum Tageslimit der Spiele-Coins. Unplausible Ergebnisse (mehr als ~2 Herzen pro Sekunde) lehnt er ab. |
| **Rangliste** | Rekord, Runden, bestes Level und gesammelte Herzen für beide. Bei einem neuen Rekord bekommt die andere Person einen Push. |

**Datenbank (nur additiv):** `pb_migrations/1794000000_wir_snake.js` legt `snake_games` an (lesen beide, schreiben nur der Server).

**Zurück:** `git checkout vor-snake -- app pocketbase/pb_hooks push shared && git rm -q app/snake.js pocketbase/pb_hooks/wir_snake.pb.js pocketbase/pb_hooks/snake_lib.js && git commit -m "Zurück vor Snake" && git push`, danach auf dem Pi `rm /home/pingu/pb/pb_hooks/{wir_snake.pb.js,snake_lib.js} && sudo systemctl restart pocketbase`. DB-Sicherung: `/home/pingu/backups/vor-snake-2026-10-26 23:33`.

# Tablet & PC 26.10.2026 (Wir `wir-v31`)

Alles in `app/layout.css` (wird zuletzt geladen). Auf dem Handy ändert sich nichts.

| Breite | Was |
|---|---|
| **Handy (< 768 px)** | wie bisher, Leiste unten |
| **Tablet (ab 768 px)** | Seitenleiste links statt Leiste unten. Inhalte bis 640 px breit. Spiele-Übersicht 3 Spalten, Erinnerungen 3 Spalten. Einkaufsliste nebeneinander: links Liste + Zuletzt verwendet, rechts Suche + Katalog. |
| **PC (ab 1100 px)** | breite Seitenleiste mit Beschriftung. Start in Spalten (bis 3). Spiele zentriert auf max. 560 px. **💬 oben rechts dockt den Chat rechts als Seitenpanel an** (bleibt beim Seitenwechsel offen, ✕ schließt, Zustand wird gemerkt). Tastatur: Enter sendet im Chat, Pfeile/WASD in Snake und Herzspur, Leertaste pausiert Snake. |

Login und Push funktionieren im normalen Browser wie in der App (Push, wo der Browser ihn unterstützt: Chrome/Edge/Firefox, Safari ab macOS 13 / iPadOS 16.4 als Home-Bildschirm-App).

**Zurück:** `git checkout vor-layout -- app && git rm -q app/layout.css && git commit -m "Zurück vor Layout" && git push` (keine DB-Änderung).

# Redesign A1 · Karten 27.10.2026 (Etappe 1, Wir `wir-v32`)

| Wo | Was |
|---|---|
| **Look** | helle Glas-Karten, weiche Farbwolken statt Herzchen, große Rundungen, Verläufe in den Akzentfarben. Alles in `app/a1.css` (zuletzt geladen) + `app/a1.js` (Verdrahtung: „+“ in Erinnerungen, Shop-Kachel). |
| **Leiste unten** | Start · Erinnerungen · Dates · Spiele · **Wir zwei** (Strich-Symbole, aktiver Reiter im Akzent-Verlauf). Öffne wenn liegt jetzt in „Wir zwei“ (alte Links/Pushs auf `s-openwhen` landen dort). |
| **Start** | „Zusammen seit … · X Tage“ (ohne Sekunden), nächstes Treffen + Stimmung der anderen Person, Liebe-Glas (Funktion unverändert), Kacheln Öffne wenn / Einkauf / Support / Shop / Anruf / Chat |
| **Wir zwei** | Ich brauche dich, Stimmung als Ringe (Tippen = Drehregler), Öffne-wenn-Raster, Schicken, Verlauf |
| **Farbwelten** | neu **Pfirsich** und **Lavendel** (`shared/base.css`, `shared/look.js`, Spielbretter in `app/games.css`). Rosé, Glühwein, Mondnacht, Zuckerwatte unverändert. |
| **Sync-Knopf** | 48 px, Trefferfläche 56 px, kein Dauerleuchten, sanfter Puls; Ring wächst beim Halten, zweiter Ring in der Herzfarbe der anderen Person. Kein Kontextmenü, kein Scrollen beim Halten. Logik unverändert. |
| **Texte** | Hilfs- und Erklärzeilen entfernt. |

Keine DB-Änderung in dieser Etappe.

**Sicherung:** Git-Tag `vor-redesign-a1` (= `5df6433`), DB + Fotos + Hooks + **komplette alte Oberfläche** (`oberflaeche/app`, `oberflaeche/shared`) unter `/home/pingu/backups/vor-redesign-a1-2026-10-27/` (Integrität „ok“).

## Zurück zur alten Oberfläche (Daten bleiben)

Am PC (2 Befehle):
```bash
cd Documents/F-r-dich && git checkout main && git pull
git checkout vor-redesign-a1 -- app shared && git commit -m "Alte Oberfläche (vor A1)" && git push
```
Nach ≤ 2 Min. ist sie live (Update-Banner). Alle Daten bleiben, auch spätere (Dates-Felder, Zeichnungen bleiben einfach ungenutzt in der DB). Wer Pfirsich/Lavendel gewählt hatte, sieht in der alten Oberfläche Rosé. Wieder zu A1: `git revert --no-edit HEAD && git push`.

# Dates vollständig anpassbar 27.10.2026 (Etappe 2, Wir `wir-v33`)

Getestet lokal mit Kopie der Live-DB in zwei Fenstern (Daniel + Ida, 15 Prüfungen: eigene Art, ohne Uhrzeit, Bilder hochladen, Titelbild, Reihenfolge, Geplant/Vergangen folgt dem Datum, Clay Date bearbeitbar, Löschen – alles live beim anderen).

| Wo | Was |
|---|---|
| **Date → ✎** (oder „+“ in Dates) | Bottom-Sheet: Art (8 feste + eigene, „＋ Eigene“ legt eine an, ✕ entfernt sie), Emoji, Name, Datum, Uhrzeit (Schalter „Ohne Uhrzeit“), Ort, Notiz. Bei bestehenden Dates: Bilder-Leiste mit ‹ › (Reihenfolge), ★ (Titelbild), ✕ (lösen/löschen), „📷 Hochladen“, „🔗 Erinnerungen“. „🗑 Date löschen“ mit Bestätigung. Gilt für alle Dates inkl. Clay Date und übernommene Treffen. |
| **Detail** | Titelbild oben, Bilder in gespeicherter Reihenfolge; Großbild: „★ Titelbild“, „Lösen/Löschen“ |
| **Übersicht/Zeitstrahl** | Titelbild als Symbol bzw. Karte. Ohne Uhrzeit: nur Tag, vergangen ab dem Folgetag. |

**Datenbank (nur additiv):** `pb_migrations/1794100000_wir_dates_edit.js`: `date_events.all_day`, `kind_label`, `kind_emoji`, `cover`, `img_order`, neue Collection `date_kinds` (beide lesen/schreiben, Anlegen nur mit sich als Autor). Eigene Arten speichern `kind = "sonstiges"` → alte Oberfläche zeigt sie als „Sonstiges“.

**Sicherung:** Tag `vor-dates-anpassbar` (= `c7772d1`), DB-Backup `/home/pingu/backups/vor-dates-anpassbar-2026-10-27/` (08:44, „ok“).
**Zurück:** `git checkout vor-dates-anpassbar -- app && git commit -m "Zurück vor Dates-Bearbeiten" && git push` (neue Felder bleiben ungenutzt stehen).

# Zusammen zeichnen 27.10.2026 (Etappe 3, Wir `wir-v34`)

Getestet lokal mit Kopie der Live-DB: Daniel (PC, Maus) + Ida (Handy, Touch) gleichzeitig, 28 Prüfungen – Live-Strich + Cursor beim anderen, alle Werkzeuge, Rückgängig/Wiederholen pro Person, Füllen, Quick-Shape, Ebenen live, Pipette, Sperre (auch serverseitig 423), direkte API-Schreibzugriffe verboten (403), Umbenennen, In Erinnerungen, Vorschaubild, Löschen bei beiden.

| Wo | Was |
|---|---|
| **Start → 🎨 Zeichnen**, **Wir zwei → 🎨 Zeichnen** | Galerie eurer Bilder (Vorschau, wer zuletzt, wann) + „＋ Neues Bild“. Alte Bilder öffnen und weitermalen. |
| **Zeichenfläche** | Vollbild. Oben: ‹ Galerie · Name · ↶ ↷ · Werkzeug · Ebenen · Farbe · ⋯. Links: Größe und Deckkraft. |
| **Werkzeuge** | Stift, Bleistift (körnig), Marker, Airbrush, Radierer, Füllen. Apple Pencil: Druck (`PointerEvent.pressure`), Handballen wird ignoriert. Linien werden geglättet. |
| **Gesten** | Am Strichende halten = gerade Linie (bzw. Ellipse, wenn der Strich fast geschlossen ist), danach ziehen verschiebt das Ende. Lange halten ohne Bewegung = Pipette. 2 Finger: zoomen/verschieben/drehen, 2 Finger tippen = rückgängig, 3 Finger tippen = wiederholen, 2× mit 2 Fingern tippen = einpassen. PC: Mausrad/Trackpad zoomt (Strg/Pinch), mittlere Maustaste verschiebt, Strg+Z / Strg+Y, „0“ = einpassen. |
| **Farbe** | Feld + Farbton-Regler + Hex, gespeicherte Palette (＋ speichert, lange halten entfernt), zuletzt genutzt. |
| **Ebenen** | bis 12: hinzufügen, löschen, ein/aus, Reihenfolge, Deckkraft – gilt für beide. |
| **⋯** | Umbenennen, Ganzes Bild, **Ansicht sperren** (nur bei dir: kein Zoomen/Verschieben), **Bild sperren** (für beide sichtbar, niemand kann zeichnen), Als PNG, In Erinnerungen, Löschen (mit Bestätigung). |
| **Push** | „🎨 Daniel hat ein neues Bild angefangen“ bzw. „… zeichnet an „Bild 3““, wenn nach ≥ 20 Min. Pause wieder gezeichnet wird. Gebündelt, höchstens alle 15 Min. pro Person (`pb_hooks/zeichnen_lib.js`). |

**Technik / Sicherheit:** Jeder Strich ist ein Datensatz in `drawing_strokes` (Punkte x, y, Druck; Werkzeug, Farbe, Größe, Deckkraft, fester Zufallswert). Geschrieben wird nur über `/api/draw/…` (`pb_hooks/wir_zeichnen.pb.js`): Sperre, Ebene und Größe werden geprüft, die Reihenfolge (`seq`) vergibt der Server in einer Transaktion. Rückgängig setzt `undone`, nichts wird gelöscht. Live-Punkte und Cursor laufen über `/api/draw/{id}/live` als Realtime-Nachricht nur an die andere Person (nicht gespeichert). Lesen dürfen nur eure zwei Konten.

**Datenbank (nur additiv):** `pb_migrations/1794200000_wir_zeichnen.js` legt `drawings` und `drawing_strokes` an.

**Sicherung:** Tag `vor-zeichnen` (= `ca79b95`), DB-Backup `/home/pingu/backups/vor-zeichnen-2026-10-27/` (09:27, „ok“).
**Zurück:** `git checkout vor-zeichnen -- app push pocketbase/pb_hooks/activity_lib.js shared && git rm -q app/draw.js app/draw.css pocketbase/pb_hooks/wir_zeichnen.pb.js pocketbase/pb_hooks/zeichnen_lib.js && git commit -m "Zurück vor Zeichnen" && git push`, danach auf dem Pi `rm /home/pingu/pb/pb_hooks/{wir_zeichnen.pb.js,zeichnen_lib.js} && sudo systemctl restart pocketbase`. Die Bilder bleiben in der DB.
