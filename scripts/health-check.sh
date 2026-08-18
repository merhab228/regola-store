#!/usr/bin/env bash
set -euo pipefail

# Simple health check for Regola app.
# Usage: ./scripts/health-check.sh [URL]
URL="${1:-http://127.0.0.1:4000/api/health}"

echo "Checking $URL ..."
resp=$(curl -fsS --max-time 5 "$URL" 2>/dev/null || true)
if [ -z "$resp" ]; then
  echo "No response from $URL"
  exit 2
fi
echo "$resp" | grep -q '"ok"\s*:\s*true' && { echo "OK"; exit 0; }
echo "Unexpected response: $resp"
exit 3
