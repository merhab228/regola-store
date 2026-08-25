#!/usr/bin/env bash
set -euo pipefail

# Usage: run on VPS from /opt/regola as a user with docker permissions
# Creates a verified SQLite backup, pulls changes, builds image and restarts container.
# Optional: pass environment variables to auto-fill .env:
#   NODE_ENV=production JWT_SECRET=xxx ADMIN_ACCESS_KEY=yyy bash deploy.sh

REPO_DIR="/opt/regola"
DATA_DIR="/opt/regola-data"
IMAGE_NAME="regola-store:latest"
CONTAINER_NAME="regola"

if docker container inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
  CURRENT_DATA_MOUNT=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/app/data"}}{{.Type}}:{{.Source}}{{end}}{{end}}' "$CONTAINER_NAME")
  if [ "$CURRENT_DATA_MOUNT" != "" ] && [ "$CURRENT_DATA_MOUNT" != "bind:$DATA_DIR" ]; then
    echo "[Deploy] Refusing: current container uses $CURRENT_DATA_MOUNT, not bind:$DATA_DIR." >&2
    echo "[Deploy] Migrate and verify that data before replacing the container." >&2
    exit 1
  fi
fi

if [ ! -s "$DATA_DIR/regola.db" ] && [ "${ALLOW_EMPTY_DB:-}" != "1" ]; then
  echo "[Deploy] Refusing: no database at $DATA_DIR/regola.db." >&2
  echo "[Deploy] For the very first deployment only, use ALLOW_EMPTY_DB=1." >&2
  exit 1
fi

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

cd "$REPO_DIR"
# make sure working tree is clean
git fetch origin --quiet
git reset --hard origin/main

docker build -t $IMAGE_NAME .

if [ -s "$DATA_DIR/regola.db" ]; then
  bash scripts/backup_db.sh
fi

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

# Health check: app startup can take a few seconds on a cold container.
for attempt in $(seq 1 15); do
  if curl -fsS http://127.0.0.1:4000/api/health >/dev/null; then
    echo "Deployment succeeded and service is healthy"
    if command -v systemctl >/dev/null 2>&1; then
      bash scripts/install_backup_timer.sh
    fi
    exit 0
  fi
  sleep 2
done

echo "[Deploy] Health check failed after 30 seconds" >&2
exit 2
