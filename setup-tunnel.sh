#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  KRONOS ONLINE — Cloudflare Tunnel Setup
#  Gibt dir eine echte HTTPS-URL die auf iPhone Safari funktioniert
#  Ausführen: bash setup-tunnel.sh
# ═══════════════════════════════════════════════════════════════

GREEN='\033[0;32m' CYAN='\033[0;36m' NC='\033[0m'

echo -e "${CYAN}⚔  Kronos Online — Cloudflare Tunnel Setup${NC}"
echo "═══════════════════════════════════════════"

# 1. Node.js installieren falls nicht vorhanden
if ! command -v node &>/dev/null; then
  echo "[1/5] Node.js installieren..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - -qq
  apt-get install -y nodejs -qq
else
  echo "[1/5] Node.js bereits installiert: $(node --version)"
fi

# 2. Git + Repo klonen
echo "[2/5] Kronos Online herunterladen..."
apt-get install -y git -qq
if [ -d "/opt/kronos" ]; then
  cd /opt/kronos && git pull --quiet
else
  git clone https://github.com/thomastiessen/kronos-online /opt/kronos --quiet
fi
cd /opt/kronos && npm install --quiet

# 3. Cloudflare Tunnel installieren
echo "[3/5] Cloudflare Tunnel installieren..."
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | gpg --dearmor -o /usr/share/keyrings/cloudflare-main.gpg
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | tee /etc/apt/sources.list.d/cloudflared.list
apt-get update -qq && apt-get install -y cloudflared -qq

# 4. Server als systemd Service einrichten (HTTP, kein SSL nötig — Cloudflare macht HTTPS)
echo "[4/5] Server-Service einrichten..."
cat > /etc/systemd/system/kronos.service << 'EOF'
[Unit]
Description=Kronos Online Game Server
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/kronos
ExecStart=/usr/bin/node /opt/kronos/server.js
Restart=always
RestartSec=5
Environment=PORT=11000

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable kronos
systemctl restart kronos

# 5. Cloudflare Tunnel starten (Quick Tunnel — kein Account nötig!)
echo "[5/5] Cloudflare Tunnel starten..."
echo ""
echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Dein Spiel ist erreichbar unter:${NC}"
echo ""
cloudflared tunnel --url http://localhost:11000
