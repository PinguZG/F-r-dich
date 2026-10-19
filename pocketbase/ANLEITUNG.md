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
