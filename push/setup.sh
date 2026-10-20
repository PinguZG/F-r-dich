#!/bin/bash
# Einmalige Einrichtung des Push-Dienstes auf dem Pi.
# Ausführen als:  sudo bash ~/F-r-dich/push/setup.sh
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Bitte mit sudo ausführen"; exit 1; }

USER_NAME=pingu
HOME_DIR=/home/$USER_NAME
DIR=$HOME_DIR/F-r-dich/push
PENDING=$HOME_DIR/.wir-push.env.pending
ENV=/etc/wir-push.env

echo "== 1/5 Node.js + npm aus apt"
apt-get update -qq
apt-get install -y -qq nodejs npm >/dev/null
node -v

echo "== 2/5 Abhängigkeiten (web-push)"
sudo -u $USER_NAME bash -c "cd '$DIR' && npm ci --omit=dev --no-audit --no-fund"

echo "== 3/5 Zugangsdaten nach $ENV"
if [ -f "$PENDING" ]; then
  install -m 600 -o root -g root "$PENDING" "$ENV"
  shred -u "$PENDING" 2>/dev/null || rm -f "$PENDING"
fi
[ -f "$ENV" ] || { echo "FEHLER: $ENV fehlt (und keine $PENDING gefunden)"; exit 1; }
chown root:root "$ENV"; chmod 600 "$ENV"
for k in PB_URL PB_EMAIL PB_PASSWORD VAPID_SUBJECT VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY; do
  grep -q "^$k=" "$ENV" || { echo "FEHLER: $k fehlt in $ENV"; exit 1; }
done

echo "== 4/5 systemd-Dienst wir-push"
install -m 644 "$DIR/wir-push.service" /etc/systemd/system/wir-push.service
# erlaubt pingu, NUR diesen Dienst ohne Passwort neu zu starten (für Updates per git pull)
cat > /etc/sudoers.d/020_wir-push <<SUDO
$USER_NAME ALL=(root) NOPASSWD: /usr/bin/systemctl restart wir-push, /usr/bin/systemctl restart wir-push.service, /usr/bin/systemctl status wir-push, /usr/bin/systemctl status wir-push.service
SUDO
chmod 440 /etc/sudoers.d/020_wir-push
visudo -cf /etc/sudoers.d/020_wir-push >/dev/null
systemctl daemon-reload
systemctl enable --now wir-push
systemctl restart wir-push

echo "== 5/5 Status"
sleep 3
systemctl --no-pager --lines=8 status wir-push || true
echo
echo "Fertig ✓  Logs:  journalctl -u wir-push -f"
