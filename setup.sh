#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  KRONOS ONLINE — Server Setup für Ubuntu 22/24/26
#  Ausführen mit: bash setup.sh
#  Danach läuft das Spiel auf https://DEINE-IP:11000
# ═══════════════════════════════════════════════════════════════

set -e  # Abbruch bei Fehler
GREEN='\033[0;32m' YELLOW='\033[1;33m' RED='\033[0;31m' NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

PORT=11000
APP_DIR="/opt/kronos"
SERVICE="kronos"

echo ""
echo "⚔  KRONOS ONLINE — Server Setup"
echo "════════════════════════════════"
echo ""

# ── 1. System updaten ────────────────────────────────────────
log "System aktualisieren..."
apt-get update -qq && apt-get upgrade -y -qq

# ── 2. Node.js 22 installieren ───────────────────────────────
if ! command -v node &>/dev/null; then
  log "Node.js 22 installieren..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - -qq
  apt-get install -y -qq nodejs
else
  log "Node.js bereits installiert: $(node --version)"
fi

# ── 3. Firewall ──────────────────────────────────────────────
log "Firewall konfigurieren (Port $PORT)..."
if command -v ufw &>/dev/null; then
  ufw allow $PORT/tcp -qq 2>/dev/null || true
  ufw allow 22/tcp    -qq 2>/dev/null || true
  ufw --force enable  -qq 2>/dev/null || true
fi

# ── 4. App-Verzeichnis anlegen ───────────────────────────────
log "App-Verzeichnis: $APP_DIR"
mkdir -p "$APP_DIR/public"

# ── 5. SSL-Zertifikat generieren ─────────────────────────────
if [ ! -f "$APP_DIR/cert.pem" ]; then
  log "SSL-Zertifikat generieren (selbstsigniert, 1 Jahr)..."
  SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
  openssl req -x509 -newkey rsa:2048 \
    -keyout "$APP_DIR/key.pem" \
    -out    "$APP_DIR/cert.pem" \
    -days   365 -nodes \
    -subj   "/C=DE/ST=NRW/O=KronosOnline/CN=${SERVER_IP}" \
    -addext "subjectAltName=IP:${SERVER_IP}" \
    2>/dev/null
  chmod 600 "$APP_DIR/key.pem"
  log "Zertifikat für IP $SERVER_IP erstellt"
else
  warn "SSL-Zertifikat existiert bereits, wird übersprungen"
fi

# ── 6. package.json schreiben ────────────────────────────────
cat > "$APP_DIR/package.json" << 'EOF'
{
  "name": "kronos-online",
  "version": "3.0.0",
  "description": "Kronos Online MMORPG Server",
  "main": "server.js",
  "scripts": {
    "start": "node server.js --ssl",
    "dev":   "node server.js"
  }
}
EOF

# ── 7. npm install ───────────────────────────────────────────
log "npm-Pakete installieren..."
cd "$APP_DIR"
npm install express socket.io --save --quiet

# ── 8. systemd Service anlegen ───────────────────────────────
log "systemd Service '$SERVICE' einrichten..."
cat > "/etc/systemd/system/${SERVICE}.service" << EOF
[Unit]
Description=Kronos Online Game Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=${APP_DIR}
ExecStart=/usr/bin/node ${APP_DIR}/server.js --ssl
Restart=always
RestartSec=5
Environment=NODE_ENV=production PORT=${PORT}
StandardOutput=journal
StandardError=journal
SyslogIdentifier=kronos

[Install]
WantedBy=multi-user.target
EOF

# Berechtigungen für www-data setzen
chown -R www-data:www-data "$APP_DIR"
chmod -R 755 "$APP_DIR"
chmod 600 "$APP_DIR/key.pem"

systemctl daemon-reload
systemctl enable "$SERVICE"

# ── 9. Fertig ────────────────────────────────────────────────
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo "════════════════════════════════════════════════════"
echo -e "${GREEN}  Setup abgeschlossen!${NC}"
echo "════════════════════════════════════════════════════"
echo ""
echo "  NÄCHSTE SCHRITTE:"
echo ""
echo "  1. server.js und public/index.html nach $APP_DIR kopieren:"
echo "     scp server.js        user@${SERVER_IP}:${APP_DIR}/"
echo "     scp public/index.html user@${SERVER_IP}:${APP_DIR}/public/"
echo ""
echo "  2. Server starten:"
echo "     systemctl start $SERVICE"
echo ""
echo "  3. Im Browser öffnen:"
echo "     https://${SERVER_IP}:${PORT}"
echo ""
echo "  NÜTZLICHE BEFEHLE:"
echo "     systemctl status $SERVICE     # Status"
echo "     journalctl -u $SERVICE -f     # Live-Logs"
echo "     systemctl restart $SERVICE    # Neustart"
echo "     systemctl stop $SERVICE       # Stoppen"
echo ""
