#!/usr/bin/env bash
# ==============================================================================
#  Kindred — Zero-downtime update script (run on the droplet)
#  Usage: sudo -u kindred bash scripts/update.sh
# ==============================================================================
set -euo pipefail

DEPLOY_DIR="/var/www/kindred"
APP_NAME="kindred"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
step() { echo -e "\n${YELLOW}▶ $1${NC}"; }
ok()   { echo -e "${GREEN}✔ $1${NC}"; }

cd ${DEPLOY_DIR}

step "Pulling latest code"
git pull origin main
ok "Code updated"

step "Installing dependencies"
npm ci --production=false
ok "Dependencies installed"

step "Running migrations"
npx tsx scripts/migrate.ts
ok "Migrations complete"

step "Building"
npm run build
ok "Build complete"

step "Reloading PM2 (zero-downtime)"
pm2 reload ${APP_NAME}
ok "PM2 reloaded"

echo ""
echo -e "${GREEN}✔ Update complete${NC}"
pm2 status ${APP_NAME}
