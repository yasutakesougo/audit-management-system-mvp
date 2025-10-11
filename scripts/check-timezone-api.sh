#!/usr/bin/env bash
set -euo pipefail

if ! command -v rg >/dev/null 2>&1; then
  echo "[tz-guard] ripgrep (rg) is not installed." >&2
  if [ "${RG_REQUIRED:-0}" = "1" ]; then
    echo "[tz-guard] CI requires rg. Failing." >&2
    exit 1
  fi
  echo "[tz-guard] Skipping (local dev)." >&2
  exit 0
fi

PATTERN="(setHours|setUTCHours|toLocaleString)"
ALLOWED_PATHS=("/utils/" "src/features/schedule/" "src/features/schedules/")
ALLOW_TAG="SCHEDULES-TZ-ALLOW"

violations=()

while IFS= read -r hit; do
  [ -z "${hit}" ] && continue

  case "${hit}" in
    *:"" ) continue ;;
  esac

  file="${hit%%:*}"
  rest="${hit#*:}"
  line="${rest%%:*}"

  for allowed in "${ALLOWED_PATHS[@]}"; do
    if [[ "${file}" == *"${allowed}"* ]]; then
      continue 2
    fi
  done

  # Allow tagged exceptions within the previous 3 lines (inclusive).
  if [ -f "${file}" ]; then
    start_line=$((line - 3))
    [ ${start_line} -lt 1 ] && start_line=1
    if sed -n "${start_line},${line}p" "${file}" | rg -q "${ALLOW_TAG}"; then
      continue
    fi
  fi

  violations+=("${hit}")
done < <(rg -n --no-heading --color never "${PATTERN}" src || true)

if [ ${#violations[@]} -eq 0 ]; then
  exit 0
fi

echo "\n🚫 Found forbidden Date API usage outside approved utils folders:" >&2
for violation in "${violations[@]}"; do
  echo "  ${violation}" >&2
done

echo "\nUse timezone helpers (formatInTimeZone/fromZonedTime) instead of raw Date mutations." >&2
exit 1
