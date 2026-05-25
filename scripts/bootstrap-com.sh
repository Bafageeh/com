#!/usr/bin/env bash
set -uo pipefail

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

run_as_app_user() {
  sudo -u "$APP_USER" bash -lc "$1"
}

log "Using project path: $PROJECT_PATH"
mkdir -p "$PROJECT_PATH"
cd "$PROJECT_PATH" || exit 1

git config --global --add safe.directory "$PROJECT_PATH" || true

if [ -d .git ]; then
  log "Syncing repository"
  git fetch origin main || true
  git reset --hard origin/main || true
else
  log "No git repository found at project path"
  exit 1
fi

mkdir -p /home/$APP_USER/apps/.cache /home/$APP_USER/apps/.tmp
chown -R "$APP_USER:$APP_USER" /home/$APP_USER/apps/.cache /home/$APP_USER/apps/.tmp || true

if [ ! -d "$API_DIR" ]; then
  log "Creating Laravel API in com-api"
  chown -R "$APP_USER:$APP_USER" "$PROJECT_PATH" || true
  run_as_app_user "cd /home/$APP_USER/apps/com && '$PHP_BIN' '$COMPOSER_BIN' create-project laravel/laravel com-api" || {
    log "Laravel create-project failed"
    exit 1
  }
else
  log "Laravel API already exists; skipping create-project"
fi

if [ -d "$API_DIR" ]; then
  log "Preparing Laravel API"
  cd "$API_DIR" || exit 1

  if [ ! -f .env ] && [ -f .env.example ]; then
    cp .env.example .env
  fi

  if [ -f .env ]; then
    grep -q '^APP_NAME=' .env && sed -i 's/^APP_NAME=.*/APP_NAME=COM/' .env || echo 'APP_NAME=COM' >> .env
    grep -q '^APP_URL=' .env && sed -i 's#^APP_URL=.*#APP_URL=https://com.pm.sa#' .env || echo 'APP_URL=https://com.pm.sa' >> .env
  fi

  "$PHP_BIN" "$COMPOSER_BIN" install --prefer-dist --no-interaction --optimize-autoloader || true
  "$PHP_BIN" artisan key:generate --force || true
  "$PHP_BIN" artisan storage:link || true

  mkdir -p routes
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

  "$PHP_BIN" artisan optimize:clear || true
fi

cd "$PROJECT_PATH" || exit 1

if [ ! -f "$MOBILE_DIR/package.json" ]; then
  log "Creating minimal Expo mobile starter in com-mobile"
  mkdir -p "$MOBILE_DIR"
  cat > "$MOBILE_DIR/package.json" <<'JSON'
{
  "name": "com-mobile",
  "version": "1.0.0",
  "private": true,
  "main": "node_modules/expo/AppEntry.js",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web"
  },
  "dependencies": {
    "@expo/metro-runtime": "~5.0.4",
    "expo": "~53.0.0",
    "expo-status-bar": "~2.2.3",
    "react": "19.0.0",
    "react-native": "0.79.5",
    "react-native-web": "^0.20.0"
  },
  "devDependencies": {}
}
JSON
  cat > "$MOBILE_DIR/app.json" <<'JSON'
{
  "expo": {
    "name": "COM",
    "slug": "com-mobile",
    "version": "1.0.0",
    "orientation": "portrait",
    "userInterfaceStyle": "automatic",
    "assetBundlePatterns": [
      "**/*"
    ],
    "ios": {
      "supportsTablet": true
    },
    "android": {
      "adaptiveIcon": {
        "backgroundColor": "#ffffff"
      }
    },
    "web": {
      "bundler": "metro"
    }
  }
}
JSON
  cat > "$MOBILE_DIR/App.js" <<'JS'
import React, { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://com.pm.sa/api/v1';

export default function App() {
  const [status, setStatus] = useState('جاري فحص الاتصال...');

  useEffect(() => {
    fetch(`${API_BASE_URL}/health`)
      .then((response) => response.json())
      .then((json) => setStatus(json?.ok ? 'تم الاتصال بالـ API بنجاح' : 'استجابة غير متوقعة من الـ API'))
      .catch(() => setStatus('تعذر الاتصال بالـ API'));
  }, []);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="auto" />
      <View style={styles.card}>
        <Text style={styles.title}>COM</Text>
        <Text style={styles.subtitle}>{status}</Text>
        <Text style={styles.url}>{API_BASE_URL}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 28,
    backgroundColor: '#ffffff',
    padding: 28,
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
  title: {
    fontSize: 42,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 18,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 12,
  },
  url: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
});
JS
fi

log "Preparing Expo mobile environment"
cd "$MOBILE_DIR" || exit 1
cat > .env.example <<EOF
EXPO_PUBLIC_API_BASE_URL=$API_URL
EOF
if [ ! -f .env ]; then
  cp .env.example .env
fi

if [ -n "$NPM_BIN" ]; then
  "$NPM_BIN" install || log "npm install failed; continuing because starter files are ready"
else
  log "npm was not found; skipping mobile dependency install"
fi

cd "$PROJECT_PATH" || exit 1

log "Applying ownership"
chown -R "$APP_USER:$APP_USER" "$PROJECT_PATH" || true

log "Committing generated project files if any"
git add . || true
if git diff --cached --quiet; then
  log "No new files to commit"
else
  git -c user.name='COM Bootstrap' -c user.email='actions@github.com' commit -m 'Bootstrap Laravel API and Expo mobile app' || true
  git push origin main || log "Git push skipped or failed; deployment can continue"
fi

log "Bootstrap completed"
exit 0
