#!/usr/bin/env bash
# E2E local run: TTY-safe pattern for local Schedule smoke tests
# Usage: bash scripts/e2e-local-run.sh [--headed]
set -euo pipefail

HEADED="${1:-}"

echo "▶ Cleaning port 5173..."
lsof -ti :5173 | xargs -r kill -9 || true
sleep 1

echo "▶ Starting dev server (nohup + TTY-free)..."
nohup npm run dev:5173 </dev/null > /tmp/vite-5173.log 2>&1 &
DEV_PID=$!
echo "  Dev server PID: $DEV_PID"

echo "▶ Waiting for http://127.0.0.1:5173/ to be ready..."
npx wait-on http://127.0.0.1:5173/ --timeout 60000 || {
  echo "❌ Dev server failed to start. Logs:"
  tail -20 /tmp/vite-5173.log
  exit 1
}

echo "▶ Connectivity check..."
curl -I http://127.0.0.1:5173/ 2>&1 | head -3

echo "▶ Running Schedule ARIA smoke tests..."
PLAYWRIGHT_OPTIONS=""
if [ -n "$HEADED" ]; then
  PLAYWRIGHT_OPTIONS="--headed"
fi

BASE_URL=http://127.0.0.1:5173 npx playwright test tests/e2e/schedule-month.aria.smoke.spec.ts $PLAYWRIGHT_OPTIONS --project=chromium --reporter=line

echo "▶ Cleanup..."
lsof -ti :5173 | xargs -r kill -9 || true

echo "✅ E2E smoke OK"
