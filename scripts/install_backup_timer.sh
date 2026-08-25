#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this script as root." >&2
  exit 1
fi

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
install -m 0644 "$REPO_DIR/deploy/systemd/regola-db-backup.service" /etc/systemd/system/regola-db-backup.service
install -m 0644 "$REPO_DIR/deploy/systemd/regola-db-backup.timer" /etc/systemd/system/regola-db-backup.timer
systemctl daemon-reload
systemctl enable --now regola-db-backup.timer
systemctl start regola-db-backup.service
systemctl status regola-db-backup.timer --no-pager
