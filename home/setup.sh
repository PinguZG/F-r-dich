#!/bin/bash
# Einmalige Einrichtung des Zuhause-Dienstes wir-home auf dem VPS.
# Ausführen als:  sudo bash ~/F-r-dich/home/setup.sh
# Legt /etc/wir-home.env mit Platzhaltern an (bestehende Werte bleiben), übernimmt die PocketBase-Zugangsdaten
# aus /etc/wir-push.env (ohne sie anzuzeigen), installiert den systemd-Dienst und erweitert die sudoers-Regel
# für das Auto-Deploy um "systemctl restart wir-home".
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Bitte mit sudo ausführen"; exit 1; }

USER_NAME=pingu
DIR=/home/$USER_NAME/F-r-dich/home
ENV=/etc/wir-home.env
PUSH_ENV=/etc/wir-push.env

echo "== 1/4 Abhängigkeiten (ws)"
sudo -u $USER_NAME bash -c "cd '$DIR' && npm ci --omit=dev --no-audit --no-fund --loglevel=error"

echo "== 2/4 $ENV"
if [ ! -f "$ENV" ]; then
  umask 077
  cat > "$ENV" <<CONF
# Zuhause (wir-home). NIE ins Repo, NIE ausgeben. Nach Änderungen: sudo systemctl restart wir-home
# Solange HA_URL oder HA_TOKEN leer sind, läuft der TESTMODUS (Home Assistant wird simuliert).
# Adresse im Tailnet, z. B. http://homeassistant:8123 (Tailscale-Name des Raspberry Pi)
HA_URL=
# Langlebiges Zugriffstoken aus Home Assistant (Profil -> Sicherheit -> Langlebige Zugriffstoken)
HA_TOKEN=
HOME_PORT=8091
CONF
fi
for k in PB_URL PB_EMAIL PB_PASSWORD; do
  if ! grep -q "^$k=" "$ENV"; then grep "^$k=" "$PUSH_ENV" >> "$ENV"; fi
done
chown root:root "$ENV"; chmod 600 "$ENV"
for k in PB_URL PB_EMAIL PB_PASSWORD HA_URL HA_TOKEN; do
  grep -q "^$k=" "$ENV" || { echo "FEHLER: $k fehlt in $ENV"; exit 1; }
done

echo "== 3/4 systemd-Dienst + sudoers"
install -m 644 "$DIR/wir-home.service" /etc/systemd/system/wir-home.service
install -m 440 -o root -g root /home/$USER_NAME/F-r-dich/deploy/sudoers-wir-deploy /tmp/wir-deploy.sudoers.new
visudo -cf /tmp/wir-deploy.sudoers.new >/dev/null
mv /tmp/wir-deploy.sudoers.new /etc/sudoers.d/wir-deploy
systemctl daemon-reload
systemctl enable --now wir-home
systemctl restart wir-home

echo "== 4/4 Status"
sleep 3
systemctl --no-pager --lines=8 status wir-home || true
echo
echo "Fertig ✓  Logs:  journalctl -u wir-home -f"
