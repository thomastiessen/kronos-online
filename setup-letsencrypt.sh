#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  KRONOS ONLINE — Let's Encrypt Setup
#  Vertrauenswürdiges HTTPS für iPhone Safari
#  Ausführen: bash setup-letsencrypt.sh
# ═══════════════════════════════════════════════════════════════

DOMAIN="local.localhoast.de"
PORT=11000
APP_DIR="/opt/kronos"

GREEN='\033[0;32m' CYAN='\033[0;36m' RED='\033[0;31m' NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

echo -e "${CYAN}⚔  Kronos Online — Let's Encrypt Setup${NC}"
echo "════════════════════════════════════════"

# 1. Certbot installieren
log "Certbot installieren..."
apt-get update -qq
apt-get install -y certbot -qq

# 2. Port 80 kurz freigeben für Let's Encrypt Challenge
log "Firewall für Port 80 öffnen (nur für Zertifikat)..."
ufw allow 80/tcp -qq 2>/dev/null || true

# 3. Zertifikat holen (standalone — kein Webserver nötig)
log "Zertifikat für $DOMAIN anfordern..."
certbot certonly \
  --standalone \
  --non-interactive \
  --agree-tos \
  --email admin@${DOMAIN} \
  -d ${DOMAIN} \
  --http-01-port 80

if [ $? -ne 0 ]; then
  err "Zertifikat fehlgeschlagen! Prüfe ob Port 80 von außen erreichbar ist."
fi

log "Zertifikat erfolgreich erstellt!"

# 4. Zertifikat in App-Verzeichnis verlinken
ln -sf /etc/letsencrypt/live/${DOMAIN}/privkey.pem   ${APP_DIR}/key.pem
ln -sf /etc/letsencrypt/live/${DOMAIN}/fullchain.pem ${APP_DIR}/cert.pem
chown -h www-data:www-data ${APP_DIR}/key.pem ${APP_DIR}/cert.pem

log "Zertifikat verlinkt"

# 5. Auto-Renewal einrichten (alle 60 Tage automatisch erneuern)
log "Auto-Renewal einrichten..."
cat > /etc/cron.d/certbot-renew << 'EOF'
0 3 * * * root certbot renew --quiet --deploy-hook "systemctl restart kronos"
EOF

# 6. Port 80 wieder schließen
ufw delete allow 80/tcp -qq 2>/dev/null || true
log "Port 80 wieder geschlossen"

# 7. Server neu starten mit SSL
log "Server neu starten..."
systemctl restart kronos

echo ""
echo -e "${GREEN}════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✓ Let's Encrypt Zertifikat aktiv!${NC}"
echo -e "${CYAN}  https://${DOMAIN}:${PORT}${NC}"
echo -e "${GREEN}  ✓ Funktioniert auf iPhone Safari!${NC}"
echo -e "${GREEN}  ✓ Automatische Erneuerung eingerichtet${NC}"
echo -e "${GREEN}════════════════════════════════════════════════${NC}"
