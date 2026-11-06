#!/usr/bin/env bash
# Wartet nach einem Push auf das Auto-Deploy (Timer alle 2 Min.) und prüft die ausgelieferte sw.js-Version.
# Aufruf: bash scripts/wait-deploy.sh wir-v48   -> Exit 0 = live, 1 = nicht live
# Läuft unter Linux und Git Bash (Windows); braucht nur curl, grep, sed.
set -u

WANT="${1:-}"
URL="${WIR_URL:-https://wir.geep-flops.ts.net}"
if [ -z "$WANT" ]; then echo "Aufruf: $0 <cache-version, z. B. wir-v48>"; exit 1; fi

check() {
  GOT="$(curl -s -m 20 "$URL/sw.js?t=$(date +%s)" | sed -n "s/.*const CACHE = '\([^']*\)'.*/\1/p" | head -1)"
  CODE="$(curl -s -m 20 -o /dev/null -w '%{http_code}' "$URL/")"
  [ "$GOT" = "$WANT" ]
}

sleep 150
if ! check; then
  sleep 90
  check
fi

if [ "$GOT" = "$WANT" ]; then echo "Deploy ok"; RC=0; else echo "Deploy NICHT ok (erwartet $WANT)"; RC=1; fi
echo "sw.js: ${GOT:-keine Antwort}"
echo "HTTP $URL/: $CODE"
exit $RC
