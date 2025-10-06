#!/usr/bin/env bash
set -euo pipefail

DRY_RUN="${DRY_RUN:-true}"

run_or_echo() {
  local description="$1"
  local command="$2"
  if [[ "$DRY_RUN" == "false" ]]; then
    echo "▶ ${description}"
    eval "${command}"
  else
    echo "(dry-run) ${description}: ${command}"
  fi
}

run_or_echo "a11y label backfill" "npm run fix:a11y-dates"
run_or_echo "spClient json guard" "npm run fix:spclient-json-guard"

echo "▶ health checks"
npm run health
