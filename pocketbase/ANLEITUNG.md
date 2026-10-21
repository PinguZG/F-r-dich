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
