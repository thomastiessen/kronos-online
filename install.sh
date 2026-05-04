#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  KRONOS ONLINE — Komplettes Setup in einem Schritt
#  Diesen Befehl in PuTTY einfügen:
#  bash <(curl -s https://raw.githubusercontent.com/thomastiessen/kronos-online/main/install.sh)
# ═══════════════════════════════════════════════════════════════
set -e
GREEN='\033[0;32m' CYAN='\033[0;36m' RED='\033[0;31m' NC='\033[0m'
log() { echo -e "${GREEN}[✓]${NC} $1"; }
err() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

DOMAIN="local.localhoast.de"
APP_DIR="/opt/kronos"
PORT_HTTPS=11000
PORT_HTTP=80

echo -e "${CYAN}"
echo "  ⚔  KRONOS ONLINE — Komplettes Setup"
echo "  ════════════════════════════════════"
echo -e "${NC}"

# 1. System
log "System aktualisieren..."
apt-get update -qq && apt-get install -y git curl certbot -qq

# 2. Node.js 22
if ! command -v node &>/dev/null || [[ $(node --version | cut -d. -f1 | tr -d 'v') -lt 20 ]]; then
  log "Node.js 22 installieren..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - -qq
  apt-get install -y nodejs -qq
fi
log "Node.js: $(node --version)"

# 3. Repo klonen oder updaten
if [ -d "$APP_DIR/.git" ]; then
  log "Kronos updaten..."
  cd $APP_DIR && git pull --quiet
else
  log "Kronos klonen..."
  git clone https://github.com/thomastiessen/kronos-online $APP_DIR --quiet
fi

cd $APP_DIR
npm install --quiet
log "npm Pakete installiert"

# 4. Firewall
log "Firewall einrichten..."
ufw allow $PORT_HTTP/tcp  -qq 2>/dev/null || true
ufw allow $PORT_HTTPS/tcp -qq 2>/dev/null || true
ufw allow 22/tcp          -qq 2>/dev/null || true
ufw --force enable        -qq 2>/dev/null || true

# 5. Let's Encrypt
log "Let's Encrypt Zertifikat anfordern für $DOMAIN..."
certbot certonly \
  --standalone \
  --non-interactive \
  --agree-tos \
  --register-unsafely-without-email \
  -d $DOMAIN \
  --http-01-port 80 2>/dev/null

# Zertifikat verlinken
ln -sf /etc/letsencrypt/live/$DOMAIN/privkey.pem   $APP_DIR/key.pem
ln -sf /etc/letsencrypt/live/$DOMAIN/fullchain.pem $APP_DIR/cert.pem
log "Zertifikat installiert"

# Auto-Renewal
echo "0 3 * * * root certbot renew --quiet --deploy-hook 'systemctl restart kronos'" > /etc/cron.d/certbot-renew
log "Auto-Renewal eingerichtet"

# 6. systemd Service
log "Service einrichten..."
cat > /etc/systemd/system/kronos.service << EOF
[Unit]
Description=Kronos Online Game Server
After=network.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node $APP_DIR/server.js
Restart=always
RestartSec=5
Environment=HTTPS_PORT=$PORT_HTTPS
Environment=HTTP_PORT=$PORT_HTTP

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable kronos
systemctl restart kronos
log "Server gestartet"

# 7. Auto-Pull via Cron (alle 30 Sek)
chmod +x $APP_DIR/auto-pull.sh
echo "* * * * * root $APP_DIR/auto-pull.sh >> /var/log/kronos.log 2>&1" >  /etc/cron.d/kronos-pull
echo "* * * * * root sleep 30 && $APP_DIR/auto-pull.sh >> /var/log/kronos.log 2>&1" >> /etc/cron.d/kronos-pull
log "Auto-Pull eingerichtet (alle 30 Sek)"

# Status prüfen
sleep 2
systemctl is-active --quiet kronos && log "Server läuft!" || err "Server konnte nicht starten — 'journalctl -u kronos' prüfen"

echo ""
echo -e "${GREEN}  ════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✓ Alles eingerichtet!${NC}"
echo ""
echo -e "  HTTP:  ${CYAN}http://$DOMAIN${NC}"
echo -e "  HTTPS: ${CYAN}https://$DOMAIN:$PORT_HTTPS${NC}"
echo ""
echo -e "  ✓ iPhone Safari: funktioniert ohne Warnung"
echo -e "  ✓ Auto-Update:   jede Änderung in 30 Sek live"
echo -e "${GREEN}  ════════════════════════════════════════════${NC}"
echo ""
