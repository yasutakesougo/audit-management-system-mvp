#!/usr/bin/env bash
set -euo pipefail

enable_graph="${1:-0}"   # 1 to enable Graph adapter, 0 for demo
tz="${2:-Asia/Tokyo}"

cat > .env.local <<EOV
VITE_FEATURE_SCHEDULES=1
VITE_FEATURE_SCHEDULES_GRAPH=${enable_graph}
VITE_SCHEDULES_TZ=${tz}
EOV

echo "[toggle-schedules] Wrote .env.local:"
cat .env.local
