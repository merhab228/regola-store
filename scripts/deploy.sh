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

PREVIOUS_CONTAINER=""
DEPLOYMENT_ERROR=""
if docker container inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
  PREVIOUS_CONTAINER="${CONTAINER_NAME}-before-$(date +%Y%m%d%H%M%S)"
  docker stop "$CONTAINER_NAME"
  docker rename "$CONTAINER_NAME" "$PREVIOUS_CONTAINER"
  echo "[Deploy] Previous container retained as $PREVIOUS_CONTAINER for rollback."
fi

# A Docker image is immutable: start a new container from the built image while
# preserving the previous one and the bind-mounted data for rollback.
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
    COMMERCE_CONFIG=$(curl -fsS http://127.0.0.1:4000/api/commerce/config)
    if ! printf '%s' "$COMMERCE_CONFIG" | grep -q '"tbankEnabled":true'; then
      echo "[Deploy] Application is healthy, but T-Bank payments are disabled." >&2
      echo "[Deploy] Check TBANK_MODE, TBANK_TERMINAL_KEY, TBANK_PASSWORD, TBANK_TAXATION, TBANK_ITEM_TAX and TBANK_DELIVERY_TAX in $REPO_DIR/.env." >&2
      DEPLOYMENT_ERROR="T-Bank payments are disabled"
      break
    fi
    if ! printf '%s' "$COMMERCE_CONFIG" | grep -q '"tbankLive":true'; then
      echo "[Deploy] T-Bank is configured in test mode, not production." >&2
      echo "[Deploy] Check TBANK_MODE and that the terminal key is a production key in $REPO_DIR/.env." >&2
      DEPLOYMENT_ERROR="T-Bank is not in production mode"
      break
    fi
    if ! docker exec "$CONTAINER_NAME" node -e "fetch('https://mddc.tbank.ru/', { signal: AbortSignal.timeout(8000) }).then(() => process.exit(0)).catch((error) => { console.error(error.cause?.code || error.code || error.name); process.exit(1); })"; then
      echo "[Deploy] T-Bank TLS check failed inside the new container." >&2
      DEPLOYMENT_ERROR="T-Bank TLS check failed"
      break
    fi
    echo "Deployment succeeded; T-Bank production payments are enabled"
    if command -v systemctl >/dev/null 2>&1; then
      bash scripts/install_backup_timer.sh
    fi
    exit 0
  fi
  sleep 2
done

if [ -n "$PREVIOUS_CONTAINER" ]; then
  echo "[Deploy] Restoring $PREVIOUS_CONTAINER after failed health check." >&2
  docker rm -f "$CONTAINER_NAME" || true
  docker rename "$PREVIOUS_CONTAINER" "$CONTAINER_NAME"
  docker start "$CONTAINER_NAME" || true
fi
if [ -n "$DEPLOYMENT_ERROR" ]; then
  echo "[Deploy] Deployment rejected: $DEPLOYMENT_ERROR." >&2
  exit 3
fi
echo "[Deploy] Health check failed after 30 seconds" >&2
exit 2
