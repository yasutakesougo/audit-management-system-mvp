#!/usr/bin/env bash
set -euo pipefail

echo "▶ Typecheck"
npm run typecheck

echo "▶ Lint"
npm run lint

echo "▶ Unit"
npm test -- --run

echo "▶ Build"
npm run build

echo "✅ Preflight OK"
