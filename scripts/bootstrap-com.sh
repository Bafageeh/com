#!/usr/bin/env bash
set -euo pipefail

PROJECT_PATH="${COM_PROJECT_PATH:-/mnt/home-storage/home/pmsa/apps/com}"
APP_USER="${COM_APP_USER:-pmsa}"
API_DIR="$PROJECT_PATH/com-api"
MOBILE_DIR="$PROJECT_PATH/com-mobile"
API_URL="${EXPO_PUBLIC_API_BASE_URL:-https://com.pm.sa/api/v1}"

log() {
  printf '\n[COM bootstrap] %s\n' "$1"
}

find_bin() {
  local name="$1"
  shift

  if command -v "$name" >/dev/null 2>&1; then
    command -v "$name"
    return 0
  fi

  local candidate
  for candidate in "$@"; do
    if [ -x "$candidate" ]; then
      echo "$candidate"
      return 0
    fi
  done

  return 1
}

COMPOSER_BIN="${COMPOSER_BIN:-}"
if [ -z "$COMPOSER_BIN" ]; then
  COMPOSER_BIN="$(find_bin composer /usr/local/bin/composer /opt/cpanel/composer/bin/composer /usr/bin/composer 2>/dev/null || true)"
fi

PHP_BIN="${PHP_BIN:-}"
if [ -z "$PHP_BIN" ]; then
  PHP_BIN="$(find_bin php /usr/local/bin/php /usr/bin/php /opt/cpanel/ea-php83/root/usr/bin/php /opt/cpanel/ea-php82/root/usr/bin/php /opt/cpanel/ea-php81/root/usr/bin/php 2>/dev/null || true)"
fi

NPM_BIN="${NPM_BIN:-}"
if [ -z "$NPM_BIN" ]; then
  NPM_BIN="$(find_bin npm /usr/local/bin/npm /usr/bin/npm 2>/dev/null || true)"
fi

NPX_BIN="${NPX_BIN:-}"
if [ -z "$NPX_BIN" ]; then
  NPX_BIN="$(find_bin npx /usr/local/bin/npx /usr/bin/npx 2>/dev/null || true)"
fi

if [ -z "$COMPOSER_BIN" ]; then
  echo "Composer was not found. Install Composer or set COMPOSER_BIN to its full path."
  exit 127
fi

if [ -z "$PHP_BIN" ]; then
  echo "PHP was not found. Install PHP or set PHP_BIN to its full path."
  exit 127
fi

log "Composer: $COMPOSER_BIN"
log "PHP: $PHP_BIN"
log "npm: ${NPM_BIN:-not found}"
log "npx: ${NPX_BIN:-not found}"

run_as_app_user() {
  sudo -u "$APP_USER" bash -lc "$1"
}

log "Using project path: $PROJECT_PATH"
mkdir -p "$PROJECT_PATH"
cd "$PROJECT_PATH"

git config --global --add safe.directory "$PROJECT_PATH" || true

if [ -d .git ]; then
  log "Syncing repository"
  git fetch origin main
  git reset --hard origin/main
else
  log "No git repository found at project path"
  exit 1
fi

mkdir -p /home/$APP_USER/apps/.cache /home/$APP_USER/apps/.tmp
chown -R "$APP_USER:$APP_USER" /home/$APP_USER/apps/.cache /home/$APP_USER/apps/.tmp || true

if [ ! -d "$API_DIR" ]; then
  log "Creating Laravel API in com-api"
  chown -R "$APP_USER:$APP_USER" "$PROJECT_PATH"
  run_as_app_user "cd /home/$APP_USER/apps/com && '$PHP_BIN' '$COMPOSER_BIN' create-project laravel/laravel com-api"
else
  log "Laravel API already exists; skipping create-project"
fi

if [ -d "$API_DIR" ]; then
  log "Preparing Laravel API"
  cd "$API_DIR"

  if [ ! -f .env ] && [ -f .env.example ]; then
    cp .env.example .env
  fi

  if [ -f .env ]; then
    grep -q '^APP_NAME=' .env && sed -i 's/^APP_NAME=.*/APP_NAME=COM/' .env || echo 'APP_NAME=COM' >> .env
    grep -q '^APP_URL=' .env && sed -i 's#^APP_URL=.*#APP_URL=https://com.pm.sa#' .env || echo 'APP_URL=https://com.pm.sa' >> .env
  fi

  "$PHP_BIN" "$COMPOSER_BIN" install --prefer-dist --no-interaction --optimize-autoloader
  "$PHP_BIN" artisan key:generate --force || true
  "$PHP_BIN" artisan storage:link || true

  mkdir -p routes
  if [ -f routes/api.php ]; then
    cat > routes/api.php <<'PHP'
<?php

use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::get('/health', function () {
        return response()->json([
            'ok' => true,
            'app' => 'COM API',
            'version' => 'v1',
        ]);
    });
});
PHP
  fi

  "$PHP_BIN" artisan optimize:clear || true
fi

cd "$PROJECT_PATH"

if [ ! -d "$MOBILE_DIR" ]; then
  if [ -z "$NPX_BIN" ]; then
    log "npx was not found; skipping Expo app creation for now"
  else
    log "Creating Expo mobile app in com-mobile"
    chown -R "$APP_USER:$APP_USER" "$PROJECT_PATH"
    run_as_app_user "cd /home/$APP_USER/apps/com && EXPO_NO_TELEMETRY=1 XDG_CACHE_HOME=/home/$APP_USER/apps/.cache TMPDIR=/home/$APP_USER/apps/.tmp TMP=/home/$APP_USER/apps/.tmp TEMP=/home/$APP_USER/apps/.tmp '$NPX_BIN' create-expo-app com-mobile --yes"
  fi
else
  log "Expo mobile app already exists; skipping create-expo-app"
fi

if [ -d "$MOBILE_DIR" ]; then
  log "Preparing Expo mobile environment"
  cd "$MOBILE_DIR"
  cat > .env.example <<EOF
EXPO_PUBLIC_API_BASE_URL=$API_URL
EOF
  if [ ! -f .env ]; then
    cp .env.example .env
  fi

  if [ -n "$NPM_BIN" ]; then
    if [ -f package-lock.json ]; then
      "$NPM_BIN" ci || "$NPM_BIN" install
    else
      "$NPM_BIN" install
    fi
  else
    log "npm was not found; skipping mobile dependency install"
  fi
fi

cd "$PROJECT_PATH"

log "Applying ownership"
chown -R "$APP_USER:$APP_USER" "$PROJECT_PATH" || true

log "Committing generated project files if any"
git add .
if git diff --cached --quiet; then
  log "No new files to commit"
else
  git -c user.name='COM Bootstrap' -c user.email='actions@github.com' commit -m 'Bootstrap Laravel API and Expo mobile app'
  git push origin main
fi

log "Bootstrap completed"
