#!/usr/bin/env bash
# ==============================================================================
#  Kindred — DigitalOcean Droplet Deployment Script
#  Ubuntu 22.04 LTS  |  Node 20  |  PostgreSQL 15  |  Nginx  |  PM2
# ==============================================================================
#
#  USAGE (run as root on a fresh Ubuntu 22.04 droplet):
#    chmod +x deploy-digitalocean.sh
#    ./deploy-digitalocean.sh
#
#  PREREQUISITES (fill these before running):
#    1. A DigitalOcean Droplet with Ubuntu 22.04 (min 1 GB RAM, 1 vCPU)
#    2. A domain/subdomain pointing to your droplet IP
#    3. This script uploaded to the droplet (scp or paste)
#
#  WHAT THIS SCRIPT DOES:
#    - Installs Node 20, PostgreSQL 15, Nginx, Certbot, PM2
#    - Creates a dedicated `kindred` system user
#    - Clones (or pulls) your repo from GitHub
#    - Creates the PostgreSQL database & user
#    - Runs database migrations
#    - Builds the app
#    - Configures Nginx as a reverse proxy
#    - Obtains a Let's Encrypt SSL certificate (optional)
#    - Starts the app with PM2 and enables autostart
# ==============================================================================

set -euo pipefail

# ──────────────────────────────────────────────────────────────────────────────
#  CONFIGURATION — EDIT THESE VALUES
# ──────────────────────────────────────────────────────────────────────────────
APP_NAME="kindred"
DOMAIN="yourdomain.com"                        # e.g. kindred.example.com
REPO_URL="https://github.com/YOUR_USERNAME/kindred.git"
DEPLOY_DIR="/var/www/kindred"
APP_USER="kindred"

DB_NAME="kindred_db"
DB_USER="kindred_user"
DB_PASS="$(openssl rand -hex 24)"              # auto-generated; also written to .env

NODE_VERSION="20"
PORT="5000"
# ──────────────────────────────────────────────────────────────────────────────

YELLOW='\033[1;33m'; GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'
step() { echo -e "\n${YELLOW}▶ $1${NC}"; }
ok()   { echo -e "${GREEN}✔ $1${NC}"; }
err()  { echo -e "${RED}✖ $1${NC}"; exit 1; }

# Must be root
[[ $EUID -ne 0 ]] && err "Run this script as root (sudo su - or sudo bash)"

# ─── 1. System update ──────────────────────────────────────────────────────────
step "Updating system packages"
apt-get update -qq && apt-get upgrade -y -qq
apt-get install -y -qq curl git ufw software-properties-common
ok "System packages updated"

# ─── 2. Firewall ───────────────────────────────────────────────────────────────
step "Configuring UFW firewall"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
ok "Firewall configured"

# ─── 3. Node.js via NodeSource ─────────────────────────────────────────────────
step "Installing Node.js ${NODE_VERSION}"
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt-get install -y nodejs
fi
node -v && npm -v
ok "Node.js $(node -v) installed"

# ─── 4. PM2 ────────────────────────────────────────────────────────────────────
step "Installing PM2"
npm install -g pm2 --quiet
pm2 startup systemd -u ${APP_USER} --hp /home/${APP_USER} || true
ok "PM2 installed"

# ─── 5. PostgreSQL ─────────────────────────────────────────────────────────────
step "Installing PostgreSQL 15"
if ! command -v psql &>/dev/null; then
  sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg
  apt-get update -qq
  apt-get install -y -qq postgresql-15
fi
systemctl enable --now postgresql
ok "PostgreSQL $(psql -V | cut -d' ' -f3) installed"

# ─── 6. Create DB & user ────────────────────────────────────────────────────────
step "Creating database: ${DB_NAME}"
sudo -u postgres psql -tc "SELECT 1 FROM pg_user WHERE usename='${DB_USER}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
ok "Database ${DB_NAME} ready"

# ─── 7. Nginx ──────────────────────────────────────────────────────────────────
step "Installing Nginx"
apt-get install -y -qq nginx
systemctl enable --now nginx
ok "Nginx installed"

# ─── 8. App user & directory ───────────────────────────────────────────────────
step "Creating app user: ${APP_USER}"
id -u ${APP_USER} &>/dev/null || useradd -m -s /bin/bash ${APP_USER}
mkdir -p ${DEPLOY_DIR}
chown -R ${APP_USER}:${APP_USER} ${DEPLOY_DIR}
ok "App user ready"

# ─── 9. Clone / pull repository ────────────────────────────────────────────────
step "Deploying application code"
if [ -d "${DEPLOY_DIR}/.git" ]; then
  sudo -u ${APP_USER} git -C ${DEPLOY_DIR} pull
else
  sudo -u ${APP_USER} git clone ${REPO_URL} ${DEPLOY_DIR}
fi
ok "Code deployed to ${DEPLOY_DIR}"

# ─── 10. Generate SESSION_SECRET ────────────────────────────────────────────────
SESSION_SECRET="$(openssl rand -hex 64)"

# ─── 11. Write .env ─────────────────────────────────────────────────────────────
step "Writing .env"
cat > ${DEPLOY_DIR}/.env <<EOF
NODE_ENV=production
PORT=${PORT}
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}
SESSION_SECRET=${SESSION_SECRET}
ALLOWED_ORIGINS=https://${DOMAIN}
RATE_LIMIT_MAX=300
EOF
chmod 600 ${DEPLOY_DIR}/.env
chown ${APP_USER}:${APP_USER} ${DEPLOY_DIR}/.env
ok ".env written (credentials stored safely)"

# Save DB password for admin reference
echo -e "\n${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN} Database password (save this!): ${DB_PASS}${NC}"
echo -e "${GREEN}═══════════════════════════════════════════${NC}\n"

# ─── 12. Install dependencies & build ──────────────────────────────────────────
step "Installing npm dependencies"
cd ${DEPLOY_DIR}
sudo -u ${APP_USER} npm ci --production=false 2>&1
ok "Dependencies installed"

step "Running database migrations"
sudo -u ${APP_USER} bash -c "cd ${DEPLOY_DIR} && npx tsx scripts/migrate.ts"
ok "Database migrations complete"

step "Building application"
sudo -u ${APP_USER} npm run build 2>&1
ok "Application built"

# ─── 13. PM2 process ───────────────────────────────────────────────────────────
step "Starting app with PM2"
PM2_ENV="${DEPLOY_DIR}/.env"
sudo -u ${APP_USER} pm2 delete ${APP_NAME} 2>/dev/null || true
sudo -u ${APP_USER} bash -c "cd ${DEPLOY_DIR} && pm2 start dist/index.cjs \
  --name ${APP_NAME} \
  --env-file .env \
  --max-memory-restart 512M \
  --restart-delay 3000 \
  --log /var/log/${APP_NAME}/app.log \
  --error /var/log/${APP_NAME}/error.log"
sudo -u ${APP_USER} pm2 save
mkdir -p /var/log/${APP_NAME}
chown -R ${APP_USER}:${APP_USER} /var/log/${APP_NAME}
ok "App running under PM2"

# ─── 14. Nginx config ──────────────────────────────────────────────────────────
step "Configuring Nginx reverse proxy"
cat > /etc/nginx/sites-available/${APP_NAME} <<NGINX
# Kindred — Nginx config (HTTP; SSL added by certbot below)
upstream kindred_app {
  server 127.0.0.1:${PORT};
  keepalive 8;
}

server {
  listen 80;
  listen [::]:80;
  server_name ${DOMAIN};

  # Logging
  access_log /var/log/nginx/${APP_NAME}.access.log;
  error_log  /var/log/nginx/${APP_NAME}.error.log;

  # Security headers
  add_header X-Frame-Options       "SAMEORIGIN"  always;
  add_header X-XSS-Protection      "1; mode=block" always;
  add_header X-Content-Type-Options "nosniff"    always;
  add_header Referrer-Policy       "strict-origin-when-cross-origin" always;

  # Static assets — served directly by Nginx with long cache
  location /assets/ {
    root ${DEPLOY_DIR}/dist/public;
    expires 1y;
    add_header Cache-Control "public, immutable";
    access_log off;
  }

  # Everything else → Node
  location / {
    proxy_pass         http://kindred_app;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade     \$http_upgrade;
    proxy_set_header   Connection  "upgrade";
    proxy_set_header   Host        \$host;
    proxy_set_header   X-Real-IP   \$remote_addr;
    proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto \$scheme;
    proxy_cache_bypass \$http_upgrade;
    proxy_read_timeout 90s;
    proxy_connect_timeout 10s;
    client_max_body_size 2m;
  }
}
NGINX

ln -sf /etc/nginx/sites-available/${APP_NAME} /etc/nginx/sites-enabled/${APP_NAME}
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
ok "Nginx configured"

# ─── 15. SSL with Let's Encrypt (optional — comment out if no domain yet) ──────
step "Installing Certbot & obtaining SSL certificate"
if command -v certbot &>/dev/null; then
  ok "Certbot already installed"
else
  apt-get install -y -qq certbot python3-certbot-nginx
fi

# Only run certbot if domain resolves to this server
DROPLET_IP=$(curl -s http://169.254.169.254/metadata/v1/interfaces/public/0/ipv4/address 2>/dev/null || hostname -I | awk '{print $1}')
DOMAIN_IP=$(dig +short ${DOMAIN} 2>/dev/null | tail -1)

if [ "${DOMAIN_IP}" = "${DROPLET_IP}" ]; then
  certbot --nginx -d ${DOMAIN} --non-interactive --agree-tos -m admin@${DOMAIN} --redirect
  ok "SSL certificate obtained for ${DOMAIN}"
else
  echo -e "${YELLOW}  Skipping certbot — ${DOMAIN} doesn't resolve to ${DROPLET_IP} yet.${NC}"
  echo -e "${YELLOW}  Once DNS propagates run: certbot --nginx -d ${DOMAIN} --redirect${NC}"
fi

# ─── 16. Auto-renew cron ────────────────────────────────────────────────────────
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && systemctl reload nginx") | sort -u | crontab -

# ─── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           Kindred deployed successfully!               ║${NC}"
echo -e "${GREEN}╠═══════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  App:      http(s)://${DOMAIN}${NC}"
echo -e "${GREEN}║  Admin:    http(s)://${DOMAIN}/#/admin${NC}"
echo -e "${GREEN}║  PM2:      sudo -u ${APP_USER} pm2 status${NC}"
echo -e "${GREEN}║  Logs:     sudo -u ${APP_USER} pm2 logs ${APP_NAME}${NC}"
echo -e "${GREEN}║  Restart:  sudo -u ${APP_USER} pm2 restart ${APP_NAME}${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
