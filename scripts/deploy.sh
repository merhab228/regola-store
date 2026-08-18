#!/usr/bin/env bash
set -euo pipefail

# Usage: run on VPS from /opt/regola as a user with docker permissions
# Creates a DB backup, pulls changes, builds image and restarts container.

REPO_DIR="/opt/regola"
DATA_DIR="/opt/regola-data"
BACKUP_DIR="/opt/regola-backups"
IMAGE_NAME="regola-store:latest"
CONTAINER_NAME="regola"

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
