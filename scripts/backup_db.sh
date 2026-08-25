#!/usr/bin/env bash
set -euo pipefail

# Creates a consistent SQLite snapshot through SQLite's backup API.
# Unlike copying regola.db, this includes all committed data still held in WAL.
DATA_DIR="${DATA_DIR:-/opt/regola-data}"
BACKUP_DIR="${BACKUP_DIR:-/opt/regola-backups}"
IMAGE_NAME="${IMAGE_NAME:-regola-store:latest}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-31}"

if [ ! -s "$DATA_DIR/regola.db" ]; then
  echo "[Backup] Refusing: database is missing or empty at $DATA_DIR/regola.db" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
docker image inspect "$IMAGE_NAME" >/dev/null
docker run --rm \
  -e DB_PATH=/data/regola.db \
  -e BACKUP_DIR=/backups \
  -e BACKUP_PREFIX=regola \
  -e BACKUP_RETENTION_DAYS="$RETENTION_DAYS" \
  -v "$DATA_DIR:/data:ro" \
  -v "$BACKUP_DIR:/backups" \
  "$IMAGE_NAME" node scripts/backup-db.mjs
