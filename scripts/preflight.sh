#!/usr/bin/env bash
set -euo pipefail

echo "▶ TESTIDS guard"
npm run guard:testids --silent

echo "▶ TypeScript cache cleanup"
rm -rf node_modules/.cache 2>/dev/null || true
rm -rf .turbo .vite dist build 2>/dev/null || true
find . -maxdepth 5 -name "*.tsbuildinfo" -print -delete 2>/dev/null || true

echo "▶ Typecheck"
npm run typecheck

echo "▶ Lint"
npm run lint

echo "▶ Unit"
npm test -- --run

echo "▶ Schedule unit suite"
npx vitest run tests/unit/schedule --reporter=basic

echo "▶ Build"
npm run build

echo "✅ Preflight OK"
