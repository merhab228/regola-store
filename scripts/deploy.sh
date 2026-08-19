#!/usr/bin/env bash
set -euo pipefail

# Usage: run on VPS from /opt/regola as a user with docker permissions
# Creates a DB backup, pulls changes, builds image and restarts container.
# Optional: pass environment variables to auto-fill .env:
#   NODE_ENV=production JWT_SECRET=xxx ADMIN_ACCESS_KEY=yyy bash deploy.sh

REPO_DIR="/opt/regola"
DATA_DIR="/opt/regola-data"
BACKUP_DIR="/opt/regola-backups"
IMAGE_NAME="regola-store:latest"
CONTAINER_NAME="regola"

# Auto-initialize .env from template if missing
if [ ! -f "$REPO_DIR/.env" ]; then
  echo "[Deploy] .env not found. Creating from template..."
  cp "$REPO_DIR/.env.example" "$REPO_DIR/.env"
  echo "[Deploy] .env created. Fill production values or set env vars: NODE_ENV, JWT_SECRET, ADMIN_ACCESS_KEY, etc."
fi

# Auto-fill .env from environment variables if set
if [ -n "${NODE_ENV:-}" ]; then
  sed -i "s|^NODE_ENV=.*|NODE_ENV=$NODE_ENV|" "$REPO_DIR/.env" || true
fi
if [ -n "${JWT_SECRET:-}" ]; then
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" "$REPO_DIR/.env" || true
fi
if [ -n "${ADMIN_ACCESS_KEY:-}" ]; then
  sed -i "s|^ADMIN_ACCESS_KEY=.*|ADMIN_ACCESS_KEY=$ADMIN_ACCESS_KEY|" "$REPO_DIR/.env" || true
fi

mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +"%F-%H%M%S")
if [ -f "$DATA_DIR/regola.db" ]; then
  cp "$DATA_DIR/regola.db" "$BACKUP_DIR/regola-$TIMESTAMP.db"
  echo "DB backed up to $BACKUP_DIR/regola-$TIMESTAMP.db"
else
  echo "No DB found at $DATA_DIR/regola.db — skipping backup"
fi

cd "$REPO_DIR"
# make sure working tree is clean
git fetch origin --quiet
git reset --hard origin/main

docker build -t $IMAGE_NAME .

docker rm -f $CONTAINER_NAME || true
# start new container
docker run -d \
  --name $CONTAINER_NAME \
  --restart unless-stopped \
  --env-file .env \
  -e DB_PATH=/app/data/regola.db \
  -p 127.0.0.1:4000:4000 \
  -v $DATA_DIR:/app/data \
  $IMAGE_NAME

# health check
if curl -fsS http://127.0.0.1:4000/api/health >/dev/null; then
  echo "Deployment succeeded and service is healthy"
else
  echo "Warning: health check failed"
  exit 2
fi
