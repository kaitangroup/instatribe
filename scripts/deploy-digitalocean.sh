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
APP_NAME="instatribe"
DOMAIN="instatribe.net"                        # e.g. kindred.example.com
REPO_URL="https://github.com/kaitangroup/instatribe.git"
DEPLOY_DIR="/var/www/instatribe"
APP_USER="kindred"

DB_NAME="kindred_db"
DB_USER="kindred_user"
DB_PASS="$(openssl rand -hex 24)"              # auto-generated; also written to .env

NODE_VERSION="20"
PORT="4003"
# ──────────────────────────────────────────────────────────────────────────────

YELLOW='\033[1;33m'; GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'
step() { echo -e "\n${YELLOW}▶ $1${NC}"; }
ok()   { echo -e "${GREEN}✔ $1${NC}"; }
err()  { echo -e "${RED}✖ $1${NC}"; exit 1; }

# Must be root
[[ $EUID -ne 0 ]] && err "Run this script as root (sudo su - or sudo bash)"




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
