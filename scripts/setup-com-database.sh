#!/usr/bin/env bash
set -uo pipefail

CPANEL_USER="${COM_CPANEL_USER:-pmsa}"
PROJECT_PATH="${COM_PROJECT_PATH:-/mnt/home-storage/home/pmsa/apps/com}"
API_DIR="$PROJECT_PATH/com-api"
DB_NAME="${COM_DB_DATABASE:-pmsa_com}"
DB_USER="${COM_DB_USERNAME:-pmsa_com_user}"
DB_HOST="${COM_DB_HOST:-127.0.0.1}"
DB_PORT="${COM_DB_PORT:-3306}"
ENV_FILE="$API_DIR/.env"

log() {
  printf '\n[COM database] %s\n' "$1"
}

set_env_value() {
  local key="$1"
  local value="$2"
  mkdir -p "$(dirname "$ENV_FILE")"
  touch "$ENV_FILE"
  local escaped
  escaped=$(printf '%s' "$value" | sed 's/[&/]/\\&/g')
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i "s/^${key}=.*/${key}=${escaped}/" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

get_env_value() {
  local key="$1"
  if [ -f "$ENV_FILE" ]; then
    grep -E "^${key}=" "$ENV_FILE" | tail -1 | cut -d= -f2-
  fi
}

escape_sql() {
  printf "%s" "$1" | sed "s/'/''/g"
}

find_mysql() {
  if command -v mysql >/dev/null 2>&1; then
    command -v mysql
    return 0
  fi
  for candidate in /usr/bin/mysql /usr/local/bin/mysql; do
    if [ -x "$candidate" ]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

make_safe_password() {
  tr -dc 'A-Za-z0-9' </dev/urandom | head -c 28
}

is_safe_password() {
  printf '%s' "$1" | grep -Eq '^[A-Za-z0-9]{16,}$'
}

if [ ! -d "$API_DIR" ]; then
  log "API directory not found yet: $API_DIR"
  exit 0
fi

if [ ! -f "$ENV_FILE" ] && [ -f "$API_DIR/.env.example" ]; then
  cp "$API_DIR/.env.example" "$ENV_FILE"
fi

EXISTING_PASSWORD="$(get_env_value DB_PASSWORD || true)"
if [ -n "${COM_DB_PASSWORD:-}" ] && is_safe_password "$COM_DB_PASSWORD"; then
  DB_PASSWORD="$COM_DB_PASSWORD"
elif [ -n "$EXISTING_PASSWORD" ] && is_safe_password "$EXISTING_PASSWORD"; then
  DB_PASSWORD="$EXISTING_PASSWORD"
else
  DB_PASSWORD="$(make_safe_password)"
fi

log "Database: $DB_NAME"
log "User: $DB_USER"

if command -v uapi >/dev/null 2>&1; then
  log "Trying cPanel UAPI database creation"
  uapi --user="$CPANEL_USER" Mysql create_database name="${DB_NAME#${CPANEL_USER}_}" >/tmp/com-uapi-db.log 2>&1 || true
  uapi --user="$CPANEL_USER" Mysql create_user name="${DB_USER#${CPANEL_USER}_}" password="$DB_PASSWORD" >/tmp/com-uapi-user.log 2>&1 || true
  uapi --user="$CPANEL_USER" Mysql set_privileges_on_database user="$DB_USER" database="$DB_NAME" privileges="ALL PRIVILEGES" >/tmp/com-uapi-priv.log 2>&1 || true
fi

MYSQL_BIN="$(find_mysql 2>/dev/null || true)"
if [ -n "$MYSQL_BIN" ]; then
  log "Ensuring database and user through MySQL root access"
  DB_NAME_SQL="$(escape_sql "$DB_NAME")"
  DB_USER_SQL="$(escape_sql "$DB_USER")"
  DB_PASSWORD_SQL="$(escape_sql "$DB_PASSWORD")"

  "$MYSQL_BIN" -uroot <<SQL >/tmp/com-mysql-setup.log 2>&1 || true
CREATE DATABASE IF NOT EXISTS \`$DB_NAME_SQL\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
DROP USER IF EXISTS '$DB_USER_SQL'@'localhost';
DROP USER IF EXISTS '$DB_USER_SQL'@'127.0.0.1';
DROP USER IF EXISTS '$DB_USER_SQL'@'%';
CREATE USER '$DB_USER_SQL'@'localhost' IDENTIFIED BY '$DB_PASSWORD_SQL';
CREATE USER '$DB_USER_SQL'@'127.0.0.1' IDENTIFIED BY '$DB_PASSWORD_SQL';
CREATE USER '$DB_USER_SQL'@'%' IDENTIFIED BY '$DB_PASSWORD_SQL';
GRANT ALL PRIVILEGES ON \`$DB_NAME_SQL\`.* TO '$DB_USER_SQL'@'localhost';
GRANT ALL PRIVILEGES ON \`$DB_NAME_SQL\`.* TO '$DB_USER_SQL'@'127.0.0.1';
GRANT ALL PRIVILEGES ON \`$DB_NAME_SQL\`.* TO '$DB_USER_SQL'@'%';
FLUSH PRIVILEGES;
SQL
else
  log "mysql client not found; UAPI may still have created the DB"
fi

set_env_value DB_CONNECTION mysql
set_env_value DB_HOST "$DB_HOST"
set_env_value DB_PORT "$DB_PORT"
set_env_value DB_DATABASE "$DB_NAME"
set_env_value DB_USERNAME "$DB_USER"
set_env_value DB_PASSWORD "$DB_PASSWORD"

chown "$CPANEL_USER:$CPANEL_USER" "$ENV_FILE" 2>/dev/null || true
chmod 600 "$ENV_FILE" 2>/dev/null || true

log "Testing database connection"
if [ -n "$MYSQL_BIN" ]; then
  "$MYSQL_BIN" -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "SELECT 1 AS ok;" >/tmp/com-mysql-test.log 2>&1
  if [ $? -eq 0 ]; then
    log "Database connection OK"
  else
    log "Database connection test failed; showing last setup logs"
    tail -80 /tmp/com-uapi-db.log 2>/dev/null || true
    tail -80 /tmp/com-uapi-user.log 2>/dev/null || true
    tail -80 /tmp/com-uapi-priv.log 2>/dev/null || true
    tail -80 /tmp/com-mysql-setup.log 2>/dev/null || true
    tail -80 /tmp/com-mysql-test.log 2>/dev/null || true
  fi
fi

log "Done"
exit 0
