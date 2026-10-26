#!/usr/bin/env bash
# Auto-Deploy für den Pi: holt neue Commits von origin/main und startet nur das neu, was sich geändert hat.
# Läuft als Nutzer pingu über wir-deploy.timer (alle 2 Minuten). Ausgaben landen im journal:
#   journalctl -u wir-deploy -n 50
# Überschreibt nie etwas: bei lokalen Änderungen oder nicht-fast-forward wird abgebrochen.
#
# Neustarts über sudo – erlaubt nur durch /etc/sudoers.d/wir-deploy (siehe pocketbase/ANLEITUNG.md).

# alles steckt in main(): bash liest so das ganze Skript ein, bevor git pull es evtl. selbst ersetzt
main() {
  set -uo pipefail

  local REPO="${REPO:-/home/pingu/F-r-dich}"
  local BRANCH="${BRANCH:-main}"
  local PB_HOOKS="${PB_HOOKS:-/home/pingu/pb/pb_hooks}"
  local PB_MIGRATIONS="${PB_MIGRATIONS:-/home/pingu/pb/pb_migrations}"
  local LOCK="${LOCK:-/tmp/wir-deploy.lock}"
  local SYSTEMCTL="${SYSTEMCTL:-sudo -n /usr/bin/systemctl}"
  # Ordner im Repo -> systemd-Dienst
  local NODE_APPS="${NODE_APPS:-push:wir-push}"

  log() { echo "$*"; }

  exec 9>"$LOCK" || { log "Lock-Datei $LOCK nicht schreibbar"; return 1; }
  if ! flock -n 9; then log "läuft bereits – übersprungen"; return 0; fi

  cd "$REPO" || { log "FEHLER: $REPO fehlt"; return 1; }

  local cur
  cur="$(git symbolic-ref --short -q HEAD || echo '?')"
  if [ "$cur" != "$BRANCH" ]; then log "ABBRUCH: ausgecheckt ist '$cur', nicht '$BRANCH'"; return 1; fi

  if ! git fetch --quiet origin "$BRANCH"; then log "FEHLER: git fetch fehlgeschlagen"; return 1; fi

  local old new
  old="$(git rev-parse HEAD)"
  new="$(git rev-parse "origin/$BRANCH")"
  [ "$old" = "$new" ] && return 0   # nichts Neues -> still

  if git merge-base --is-ancestor "$new" "$old"; then return 0; fi   # lokal sogar weiter als origin
  if ! git merge-base --is-ancestor "$old" "$new"; then
    log "ABBRUCH: origin/$BRANCH ist kein fast-forward von ${old:0:7} – bitte von Hand lösen"
    return 1
  fi
  if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    log "ABBRUCH: lokale Änderungen im Repo – bitte von Hand committen oder verwerfen:"
    git status --short --untracked-files=no | head -20
    return 1
  fi

  local changed
  changed="$(git diff --name-only "$old" "$new")"
  if ! git pull --ff-only --quiet origin "$BRANCH"; then log "FEHLER: git pull --ff-only fehlgeschlagen"; return 1; fi
  log "aktualisiert ${old:0:7} -> ${new:0:7} ($(echo "$changed" | wc -l) Datei(en))"

  local rc=0 restart_pb=0

  # pb_hooks -> PocketBase (nur kopieren, nie etwas in pb_hooks löschen)
  if echo "$changed" | grep -q '^pocketbase/pb_hooks/'; then
    if cp -a "$REPO/pocketbase/pb_hooks/." "$PB_HOOKS/"; then
      log "pb_hooks nach $PB_HOOKS kopiert"; restart_pb=1
    else
      log "FEHLER: pb_hooks kopieren"; rc=1
    fi
  fi

  # pb_migrations -> PocketBase (nur kopieren); PocketBase spielt neue Migrationen beim Start selbst ein
  if echo "$changed" | grep -q '^pocketbase/pb_migrations/'; then
    if mkdir -p "$PB_MIGRATIONS" && cp -a "$REPO/pocketbase/pb_migrations/." "$PB_MIGRATIONS/"; then
      log "pb_migrations nach $PB_MIGRATIONS kopiert"; restart_pb=1
    else
      log "FEHLER: pb_migrations kopieren"; rc=1
    fi
  fi

  if [ "$restart_pb" = 1 ]; then
    if $SYSTEMCTL restart pocketbase; then
      # läuft PocketBase wieder? (scheitert z. B. eine Migration, beendet es sich sofort)
      local i up=0
      for i in $(seq 1 30); do
        if curl -fs --max-time 3 -o /dev/null "${PB_HEALTH:-http://127.0.0.1:8090/api/health}"; then up=1; break; fi
        sleep 1
      done
      if [ "$up" = 1 ]; then log "pocketbase neu gestartet"
      else log "FEHLER: pocketbase antwortet nach dem Neustart nicht – journalctl -u pocketbase -n 50"; rc=1; fi
    else
      log "FEHLER: Neustart pocketbase"; rc=1
    fi
  fi

  # Node-Dienste
  local pair dir svc
  for pair in $NODE_APPS; do
    dir="${pair%%:*}"; svc="${pair##*:}"
    echo "$changed" | grep -q "^$dir/" || continue
    [ -f "$REPO/$dir/package.json" ] || continue
    if echo "$changed" | grep -qE "^$dir/package(-lock)?\.json$" || [ ! -d "$REPO/$dir/node_modules" ]; then
      if (cd "$REPO/$dir" && npm ci --omit=dev --no-audit --no-fund --loglevel=error); then log "$dir: npm ci ok"
      else log "FEHLER: npm ci in $dir"; rc=1; continue; fi
    fi
    if $SYSTEMCTL restart "$svc"; then log "$svc neu gestartet"; else log "FEHLER: Neustart $svc"; rc=1; fi
  done

  # Spiele-App (:8443): Tailscale liefert spiele/ und shared/ direkt aus dem Repo aus -> der Pull reicht.
  # Hier nur prüfen, dass die Freigabe noch steht (Ordner freigeben darf nur root, siehe ANLEITUNG.md).
  if echo "$changed" | grep -qE '^(spiele|shared)/'; then
    log "Spiele-App aktualisiert (spiele/, shared/)"
  fi
  if command -v tailscale >/dev/null 2>&1 && [ -d "$REPO/spiele" ]; then
    local ts; ts="$(tailscale funnel status 2>/dev/null || true)"   # erst einlesen: grep -q + pipefail gäbe sonst SIGPIPE-Fehler
    if ! grep -q ':8443' <<<"$ts"; then
      log "FEHLER: Spiele-Freigabe :8443 fehlt – sudo tailscale funnel --bg --https=8443 $REPO/spiele (ANLEITUNG.md)"; rc=1
    fi
  fi

  if echo "$changed" | grep -qE '^deploy/.*\.(service|timer)$|^push/.*\.service$'; then
    log "Hinweis: systemd-Dateien haben sich geändert – bei Bedarf von Hand neu installieren (ANLEITUNG.md)"
  fi
  return $rc
}

main "$@"
exit $?
