#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${COM_DOMAIN:-com.pm.sa}"
CPANEL_USER="${COM_CPANEL_USER:-pmsa}"
PROJECT_PATH="${COM_PROJECT_PATH:-/mnt/home-storage/home/pmsa/apps/com}"
LARAVEL_PUBLIC="$PROJECT_PATH/com-api/public"
FALLBACK_PUBLIC="$PROJECT_PATH/public"

log() {
  printf '\n[COM domain] %s\n' "$1"
}

find_docroot() {
  local userdata_file="/var/cpanel/userdata/$CPANEL_USER/$DOMAIN"
  local ssl_userdata_file="/var/cpanel/userdata/$CPANEL_USER/${DOMAIN}_SSL"

  if [ -f "$userdata_file" ]; then
    awk -F': ' '/documentroot:/ {print $2; exit}' "$userdata_file"
    return 0
  fi

  if [ -f "$ssl_userdata_file" ]; then
    awk -F': ' '/documentroot:/ {print $2; exit}' "$ssl_userdata_file"
    return 0
  fi

  for candidate in \
    "/home/$CPANEL_USER/public_html/$DOMAIN" \
    "/home/$CPANEL_USER/public_html/com" \
    "/home/$CPANEL_USER/public_html/apps/com"; do
    if [ -d "$candidate" ]; then
      echo "$candidate"
      return 0
    fi
  done

  echo "/home/$CPANEL_USER/public_html/$DOMAIN"
}

DOCROOT="$(find_docroot)"

if [ -z "$DOCROOT" ]; then
  echo "Could not detect document root for $DOMAIN"
  exit 1
fi

log "Domain: $DOMAIN"
log "Document root: $DOCROOT"
log "Project path: $PROJECT_PATH"

mkdir -p "$PROJECT_PATH"

if [ -d "$LARAVEL_PUBLIC" ] && [ -f "$LARAVEL_PUBLIC/index.php" ]; then
  TARGET="$LARAVEL_PUBLIC"
  log "Laravel public directory found: $TARGET"
else
  TARGET="$FALLBACK_PUBLIC"
  log "Laravel public directory not found yet; using fallback public directory: $TARGET"
  mkdir -p "$TARGET"
  cat > "$TARGET/index.html" <<'HTML'
<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>COM</title>
  <style>
    body{font-family:Arial,Tahoma,sans-serif;background:#f8fafc;color:#0f172a;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center}
    .card{background:#fff;border:1px solid #e2e8f0;border-radius:22px;box-shadow:0 20px 50px rgba(15,23,42,.08);padding:34px;max-width:520px;margin:18px}
    h1{margin:0 0 12px;font-size:34px}
    p{margin:0;color:#475569;font-size:17px;line-height:1.8}
    code{direction:ltr;display:inline-block;background:#f1f5f9;border-radius:10px;padding:4px 8px;margin-top:12px}
  </style>
</head>
<body>
  <main class="card">
    <h1>COM</h1>
    <p>تم تجهيز الدومين بنجاح. سيتم ربطه تلقائيًا بتطبيق Laravel بعد اكتمال إنشاء <code>com-api/public</code>.</p>
  </main>
</body>
</html>
HTML
fi

cat > "$TARGET/.htaccess" <<'HTACCESS'
Options -Indexes
DirectoryIndex index.php index.html

<IfModule mod_rewrite.c>
    RewriteEngine On
</IfModule>
HTACCESS

mkdir -p "$(dirname "$DOCROOT")"

if [ -L "$DOCROOT" ]; then
  CURRENT_TARGET="$(readlink "$DOCROOT")"
  if [ "$CURRENT_TARGET" != "$TARGET" ]; then
    log "Updating existing symlink from $CURRENT_TARGET to $TARGET"
    rm -f "$DOCROOT"
    ln -s "$TARGET" "$DOCROOT"
  else
    log "Document root symlink already correct"
  fi
elif [ -d "$DOCROOT" ]; then
  if [ "$(realpath -m "$DOCROOT")" != "$(realpath -m "$TARGET")" ]; then
    BACKUP="${DOCROOT}.backup.$(date +%Y%m%d%H%M%S)"
    log "Backing up existing document root to $BACKUP"
    mv "$DOCROOT" "$BACKUP"
    ln -s "$TARGET" "$DOCROOT"
  fi
else
  log "Creating document root symlink"
  ln -s "$TARGET" "$DOCROOT"
fi

chown -R "$CPANEL_USER:$CPANEL_USER" "$PROJECT_PATH" || true
chown -h "$CPANEL_USER:$CPANEL_USER" "$DOCROOT" || true

log "Rebuilding Apache userdata if available"
/scripts/rebuildhttpdconf || true
/scripts/restartsrv_httpd || true

log "Running AutoSSL"
if [ -x /usr/local/cpanel/bin/autossl_check ]; then
  /usr/local/cpanel/bin/autossl_check --user "$CPANEL_USER" || true
else
  echo "AutoSSL command not found"
fi

log "HTTPS check"
curl -k -I --max-time 20 "https://$DOMAIN" || true

log "Done"
