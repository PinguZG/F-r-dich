# Zuhause als eigenständige Seite für Home Assistant (vorbereitet, noch nicht fertig)

Ziel: Der Bereich **Zuhause** läuft später zusätzlich als eigene Seite direkt auf Home Assistant
(`/config/www/zuhause/` → im Browser `http://<ha>:8123/local/zuhause/index.html`), z. B. für ein Wandtablet.
Diese Seite spricht **direkt per WebSocket** mit Home Assistant und nutzt den **normalen HA-Login**.
Sie braucht dann weder den VPS noch Internet.

## Was schon vorbereitet ist

| Teil | Stand |
|---|---|
| `app/zuhause-data.js` | Datenschicht mit festem Interface (`start`, `stop`, `refresh`, `call`, `state`). Transport `wir` ist fertig. Weitere Transports meldet man mit `ZuhauseData.register('ha-direct', factory)` an. |
| `home/export/ha-direct.js` | **Platzhalter** für den Transport `ha-direct` mit beschriebenem Interface (wirft noch einen Fehler). |
| `home/export/build.js` | Baut den Ordner `home/export/dist/zuhause/` aus `app/zuhause*.{js,css}`, `shared/base.css` und `home/config.jsonc`. |
| `home/config.jsonc` | Dieselbe Konfiguration (Lampen, Szenen, Routinen …) wird in die Seite eingebettet. |

## Was noch fehlt (wenn es so weit ist)

1. **`ha-direct.js` ausbauen** (gleiches Interface wie `wir`):
   - Login: HA-Tokens aus `localStorage.hassTokens` lesen (gleiche Herkunft wie HA, also schon eingeloggt)
     oder den OAuth-Ablauf `/auth/authorize` → `/auth/token` nutzen (z. B. mit `home-assistant-js-websocket`).
   - `get_states` + `subscribe_events state_changed` → `state.entities` (gleiches Format wie `home_state`:
     `{ state, a: attributes, changed }`), nur für entity_ids aus der Konfiguration.
   - `call()` → `call_service`; die Freigabeliste macht hier HA selbst (der HA-Nutzer bestimmt die Rechte).
     Zusätzlich dieselbe Prüfung wie in `home/config.js` (`check()`) im Browser, damit nur Konfiguriertes geht.
   - `state.meta` = `{ mode: 'live', connected, beat: Date.now() }`, `state.klima` aus `history/history_during_period`,
     `state.wetter` aus einer HA-Wetter-Entität (statt Open-Meteo, damit es ohne Internet geht).
2. **Kleine Hüllen** in der Export-Seite, die `zuhause.js` heute aus der App bekommt:
   `window.UI.shake`, `window.WIR_PB.authStore.isValid` (immer wahr), Ereignis `wir:show` mit `s-zuhause`,
   `#dayCount` und `window.WIR_COUNTDOWN` (dürfen fehlen – dann zeigt der Kopf nur „Wir zwei“).
3. In `zuhause.js` den Transport per Parameter wählen: `ZuhauseData.create(window.ZH_TRANSPORT || 'wir')`.
4. `node home/export/build.js` → Ordner `dist/zuhause/` nach `/config/www/zuhause/` kopieren
   (z. B. mit dem Add-on „Samba share“ oder „File editor“).

## Bauen (Gerüst)

```bash
node home/export/build.js        # schreibt home/export/dist/zuhause/ (nicht im Repo)
```
