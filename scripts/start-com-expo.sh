#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${COM_MOBILE_DIR:-/home/pmsa/apps/com/com-mobile}"
PORT="${COM_EXPO_PORT:-8081}"
HOSTNAME="${COM_EXPO_HOSTNAME:-com.pm.sa}"
LOG_FILE="${COM_EXPO_LOG:-/home/pmsa/apps/com-expo.log}"
APP_USER="${COM_APP_USER:-pmsa}"

if [ ! -d "$APP_DIR" ]; then
  APP_DIR="/mnt/home-storage/home/pmsa/apps/com/com-mobile"
fi

if [ ! -d "$APP_DIR" ]; then
  echo "COM mobile directory not found"
  exit 1
fi

mkdir -p /home/pmsa/apps/.cache /home/pmsa/apps/.tmp
chown -R pmsa:pmsa /home/pmsa/apps/.cache /home/pmsa/apps/.tmp || true
chown -R pmsa:pmsa "$APP_DIR" || true

lsof -ti:"$PORT" | xargs -r kill -9 || true
pkill -f "expo.*$PORT" 2>/dev/null || true
pkill -f "metro.*$PORT" 2>/dev/null || true

cd "$APP_DIR"

if [ ! -d node_modules ]; then
  sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && npm install"
fi

sudo -u "$APP_USER" bash -lc "
cd '$APP_DIR' && \
BROWSER=none \
EXPO_NO_TELEMETRY=1 \
REACT_NATIVE_PACKAGER_HOSTNAME='$HOSTNAME' \
XDG_CACHE_HOME=/home/pmsa/apps/.cache \
TMPDIR=/home/pmsa/apps/.tmp \
TMP=/home/pmsa/apps/.tmp \
TEMP=/home/pmsa/apps/.tmp \
nohup npx expo start --clear --go --host lan --port '$PORT' > '$LOG_FILE' 2>&1 &
"

sleep 4

echo "Expo started on port $PORT"
echo "Log: $LOG_FILE"
tail -80 "$LOG_FILE" || true
