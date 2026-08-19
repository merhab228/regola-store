#!/usr/bin/env bash
set -euo pipefail

# VPS initial setup for Regola auto-deploy
# Usage (run as root):
#   DEPLOY_PUBKEY="ssh-ed25519 AAAA..." bash scripts/setup_vps.sh
# Or run interactively and paste the public key when prompted.

REPO_URL="https://github.com/merhab228/regola-store"
DEPLOY_USER="deploy"
REPO_DIR="/opt/regola"
DATA_DIR="/opt/regola-data"
BACKUP_DIR="/opt/regola-backups"

echo ">>> 1/8 Installing system packages (git, docker, nginx, certbot)"
apt update
apt install -y git docker.io nginx certbot python3-certbot-nginx
systemctl enable --now docker nginx

echo ">>> 2/8 Create deploy user (if missing)"
if id -u "$DEPLOY_USER" >/dev/null 2>&1; then
  echo "User $DEPLOY_USER exists"
else
  adduser --disabled-password --gecos "Deploy user" "$DEPLOY_USER"
  echo "Created user $DEPLOY_USER"
fi

echo ">>> 3/8 Add $DEPLOY_USER to docker group"
usermod -aG docker "$DEPLOY_USER" || true

echo ">>> 4/8 Create directories and set ownership"
mkdir -p "$REPO_DIR" "$DATA_DIR" "$BACKUP_DIR"
chown -R "$DEPLOY_USER":"$DEPLOY_USER" "$REPO_DIR" "$DATA_DIR" "$BACKUP_DIR"

echo ">>> 5/8 Install authorized SSH key for $DEPLOY_USER"
SSH_DIR="/home/$DEPLOY_USER/.ssh"
mkdir -p "$SSH_DIR"
chmod 700 "$SSH_DIR"
if [ -n "${DEPLOY_PUBKEY:-}" ]; then
  echo "$DEPLOY_PUBKEY" >> "$SSH_DIR/authorized_keys"
  echo "Added public key from DEPLOY_PUBKEY"
else
  echo "No DEPLOY_PUBKEY env var set. Please paste the public key now, then press Ctrl-D:"
  cat >> "$SSH_DIR/authorized_keys"
fi
chmod 600 "$SSH_DIR/authorized_keys"
chown -R "$DEPLOY_USER":"$DEPLOY_USER" "$SSH_DIR"

echo ">>> 6/8 Clone repository if missing"
if [ ! -d "$REPO_DIR/.git" ]; then
  sudo -u "$DEPLOY_USER" git clone --depth 1 "$REPO_URL" "$REPO_DIR"
  echo "Repository cloned to $REPO_DIR"
else
  echo "Repository already exists in $REPO_DIR"
fi

echo ">>> 7/8 Initialize .env from template"
if [ ! -f "$REPO_DIR/.env" ]; then
  sudo -u "$DEPLOY_USER" cp "$REPO_DIR/.env.example" "$REPO_DIR/.env"
  echo "Created $REPO_DIR/.env from template"
  echo "⚠️  IMPORTANT: Edit $REPO_DIR/.env and fill production secrets:"
  echo "   NODE_ENV, JWT_SECRET, ADMIN_ACCESS_KEY, ADMIN_LOGIN, ADMIN_PASSWORD, PUBLIC_BASE_URL"
  echo "   For payment/delivery: TBANK_* and CDEK_* credentials"
else
  echo ".env already exists at $REPO_DIR/.env"
fi

echo ">>> 8/8 Ensure deploy scripts are executable"
chown -R "$DEPLOY_USER":"$DEPLOY_USER" "$REPO_DIR"
chmod +x "$REPO_DIR/scripts"/*.sh || true

echo ">>> 9/9 Systemd unit (optional): installing deploy/regola.service"
if [ -f "$REPO_DIR/deploy/regola.service" ]; then
  cp "$REPO_DIR/deploy/regola.service" /etc/systemd/system/regola.service
  systemctl daemon-reload
  systemctl enable regola.service || true
  echo "Installed systemd unit at /etc/systemd/system/regola.service"
else
  echo "No deploy/regola.service found in repo — skipping unit install"
fi

echo "Setup complete. Next steps:"
echo " 1. Edit .env with production secrets:"
echo "    nano /opt/regola/.env"
echo " 2. Run deploy (will auto-create container):"
echo "    cd /opt/regola && sudo -u deploy bash scripts/deploy.sh"
echo " 3. Or use systemd:"
echo "    sudo systemctl start regola.service"
echo " 4. Verify health:"
echo "    curl http://127.0.0.1:4000/api/health"
echo ""
echo "For auto-deploy on push: add GitHub Secrets (VPS_HOST, VPS_USER, VPS_SSH_KEY, VPS_SSH_PORT)"

exit 0
