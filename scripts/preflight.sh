#!/usr/bin/env bash
set -euo pipefail

echo "▶ TESTIDS guard"
npm run guard:testids --silent

echo "▶ Typecheck"
npm run typecheck

echo "▶ Lint"
npm run lint

echo "▶ Unit"
npm test -- --run

echo "▶ Schedule unit suite"
npx vitest run tests/unit/schedule --reporter=verbose

echo "▶ Build"
npm run build

echo "✅ Preflight OK"
