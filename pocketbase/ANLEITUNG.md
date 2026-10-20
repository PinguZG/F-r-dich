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
