#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-unit}"  # unit | e2e

echo "▶ TESTIDS guard"
npm run guard:testids --silent

echo "▶ Typecheck"
npm run typecheck

echo "▶ Lint"
npm run lint

if [ "$MODE" = "unit" ]; then
  echo "▶ Unit (fast mode)"
  npm test -- --run
  echo "✅ Preflight (unit) OK"
elif [ "$MODE" = "e2e" ]; then
  echo "▶ Unit"
  npm test -- --run
  
  echo "▶ Schedule unit suite"
  npx vitest run tests/unit/schedule --reporter=verbose
  
  echo "▶ Build"
  npm run build
  
  echo "▶ E2E Schedules smoke"
  bash scripts/e2e-local-run.sh
  
  echo "✅ Preflight (full + e2e) OK"
else
  echo "❌ Usage: npm run preflight [unit|e2e]"
  exit 1
fi
