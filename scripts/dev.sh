#!/bin/sh
set -e
cd "$(dirname "$0")/.."
npm run server &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null' EXIT INT TERM
npm run dev
