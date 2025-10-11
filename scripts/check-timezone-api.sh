#!/usr/bin/env bash
set -euo pipefail

if ! command -v rg >/dev/null 2>&1; then
  echo "[timezone-guard] ripgrep (rg) is not installed; skipping check" >&2
  exit 0
fi

PATTERN="(setHours|setUTCHours|toLocaleString)"
# Allow known safe utility folders to use low-level Date mutation APIs.
ALLOWED_SUBSTRING="/utils/"

mapfile -t matches < <(rg -n --no-heading --color never "${PATTERN}" src || true)

if [ ${#matches[@]} -eq 0 ]; then
  exit 0
fi

violations=()
for hit in "${matches[@]}"; do
  if [[ "${hit}" != *"${ALLOWED_SUBSTRING}"* ]]; then
    violations+=("${hit}")
  fi
done

if [ ${#violations[@]} -eq 0 ]; then
  exit 0
fi

echo "\n🚫 Found forbidden Date API usage outside approved utils folders:" >&2
for violation in "${violations[@]}"; do
  echo "  ${violation}" >&2
done

echo "\nUse timezone helpers (formatInTimeZone/fromZonedTime) instead of raw Date mutations." >&2
exit 1
