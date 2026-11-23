#!/usr/bin/env bash
# ==============================================================================
# Tridhata Agro ERP - VPS Production Deployment Script
# Target: Ubuntu 22.04 / 24.04 LTS VPS (idcloudhost)
# ==============================================================================

set -euo pipefail

echo "=========================================================="
echo " Starting Tridhata Agro ERP Deployment: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================================="

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${APP_DIR}"

echo "[1/7] Fetching latest changes from Git..."
git pull origin main || git pull origin master

echo "[2/7] Installing Composer production dependencies..."
composer install --no-dev --optimize-autoloader --no-interaction --prefer-dist

echo "[3/7] Running database migrations..."
php artisan migrate --force

echo "[4/7] Caching configurations, routes, views, and icons..."
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan icons:cache

echo "[5/7] Verifying storage symlink..."
php artisan storage:link || true

echo "[6/7] Restarting queue worker processes..."
if command -v supervisorctl &> /dev/null; then
    supervisorctl restart tridhata-worker:* || sudo supervisorctl restart tridhata-worker:*
    echo "Supervisor queue workers restarted."
else
    echo "Notice: supervisorctl not found. Please restart tridhata-worker manually."
fi

echo "[7/7] Deployment complete!"
echo "=========================================================="
echo " Tridhata Agro ERP successfully deployed: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================================="

