#!/usr/bin/env bash
set -euo pipefail

URL="${1:-http://localhost:3000/healthz}"
TRIES="${2:-30}"
SLEEP_SEC="${3:-2}"

echo "Waiting for healthz: ${URL} (tries=${TRIES}, sleep=${SLEEP_SEC}s)"
for i in $(seq 1 "$TRIES"); do
  code=$(curl -sk -o /dev/null -w "%{http_code}" "$URL" || true)
  if [ "$code" = "200" ]; then
    echo "healthz OK (${URL})"
    exit 0
  fi
  echo "  - not ready yet (attempt ${i}/${TRIES}, last=${code})"
  sleep "$SLEEP_SEC"
done

echo "ERROR: healthz TIMEOUT (${URL})"
exit 1
