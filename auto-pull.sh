#!/bin/bash
# Kronos Auto-Pull — läuft alle 30 Sekunden
REPO_URL="https://github.com/thomastiessen/kronos-online"
APP_DIR="/opt/kronos"

cd $APP_DIR
BEFORE=$(git rev-parse HEAD 2>/dev/null)
git pull origin main --quiet 2>/dev/null
AFTER=$(git rev-parse HEAD 2>/dev/null)

if [ "$BEFORE" != "$AFTER" ]; then
  echo "[$(date '+%H:%M:%S')] Neue Version gefunden — starte Server neu..."
  npm install --quiet 2>/dev/null
  systemctl restart kronos
  echo "[$(date '+%H:%M:%S')] Server neu gestartet!"
fi
