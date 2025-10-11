#!/usr/bin/env bash
set -euo pipefail

if ! command -v rg >/dev/null 2>&1; then
  echo "[timezone-guard] ripgrep (rg) is not installed; skipping check" >&2
  exit 0
fi

PATTERN="(setHours|setUTCHours|toLocaleString)"
# Allow known safe utility folders to use low-level Date mutation APIs.
ALLOWED_SUBSTRING="/utils/"

tmpfile=$(mktemp)
trap 'rm -f "${tmpfile}"' EXIT

if ! rg -n --no-heading --color never "${PATTERN}" src >"${tmpfile}"; then
  status=$?
  # ripgrep exits with status 1 when no matches are found; treat that as success.
  if [ ${status} -ne 1 ]; then
    echo "[timezone-guard] ripgrep failed" >&2
    exit 1
  fi
fi

if [ ! -s "${tmpfile}" ]; then
  exit 0
fi

violations_output=""
while IFS= read -r hit; do
  [ -z "${hit}" ] && continue
  case "${hit}" in
    *"${ALLOWED_SUBSTRING}"*)
      continue
      ;;
    *)
      violations_output="${violations_output}  ${hit}

      ;;
  esac
done <"${tmpfile}"

if [ -z "${violations_output}" ]; then
  exit 0
fi

printf '\n🚫 Found forbidden Date API usage outside approved utils folders:\n' >&2
printf '%s' "${violations_output}" >&2
printf '\nUse timezone helpers (formatInTimeZone/fromZonedTime) instead of raw Date mutations.\n' >&2
exit 1
