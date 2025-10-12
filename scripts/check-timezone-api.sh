#!/bin/sh
# POSIX-safe timezone API guard

set -eu

RG="${RG:-rg}"

if ! command -v "$RG" >/dev/null 2>&1; then
  if [ "${RG_REQUIRED:-0}" = "1" ]; then
    echo "[guard:tz] ripgrep (rg) not found and RG_REQUIRED=1. Failing." >&2
    exit 1
  fi
  echo "[guard:tz] ripgrep (rg) not found. Skipping check (set RG_REQUIRED=1 to enforce)." >&2
  exit 0
fi

tmp="$(mktemp)"
violations_tmp="$(mktemp)"
files_tmp="$(mktemp)"
allow_tmp=""
matches_tmp=""

cleanup() {
  rm -f "$tmp" "$violations_tmp" "$files_tmp"
  if [ -n "$allow_tmp" ]; then
    rm -f "$allow_tmp"
  fi
  if [ -n "$matches_tmp" ]; then
    rm -f "$matches_tmp"
  fi
}

trap cleanup EXIT INT TERM

set +e
"$RG" --no-heading --color=never -n '(toLocaleString|setHours|setUTCHours)' src >"$tmp" 2>/dev/null
status=$?
set -e

if [ "$status" -gt 1 ]; then
  echo "[guard:tz] ripgrep failed" >&2
  exit 1
fi

if [ ! -s "$tmp" ]; then
  echo "[guard:tz] OK"
  exit 0
fi

cut -d: -f1 "$tmp" | sort -u >"$files_tmp"

found=0

while IFS= read -r file; do
  [ -f "$file" ] || continue

  matches_tmp="$(mktemp)"
  grep -F "^$file:" "$tmp" >"$matches_tmp" 2>/dev/null || true

  if [ ! -s "$matches_tmp" ]; then
    rm -f "$matches_tmp"
    matches_tmp=""
    continue
  fi

  allow_tmp="$(mktemp)"
  set +e
  "$RG" -n 'SCHEDULES-TZ-ALLOW' "$file" | cut -d: -f2 >"$allow_tmp" 2>/dev/null
  allow_status=$?
  set -e

  if [ "$allow_status" -gt 1 ]; then
    echo "[guard:tz] ripgrep failed while scanning allows" >&2
    exit 1
  fi

  while IFS= read -r hit; do
    case "$hit" in
      *"/utils/"*)
        continue
        ;;
    esac

    hit_line=$(echo "$hit" | cut -d: -f2)
    case "$hit_line" in
      ''|*[!0-9]*)
        hit_line=""
        ;;
    esac

    allowed=0

    if [ -n "$hit_line" ] && [ -s "$allow_tmp" ]; then
      while IFS= read -r allow_ln; do
        case "$allow_ln" in
          ''|*[!0-9]*)
            continue
            ;;
        esac
        diff=$((hit_line - allow_ln))
        if [ "$diff" -ge 0 ] && [ "$diff" -le 3 ]; then
          allowed=1
          break
        fi
      done <"$allow_tmp"
    fi

    if [ "$allowed" -eq 1 ]; then
      continue
    fi

    echo "$hit" >>"$violations_tmp"
    found=1
  done <"$matches_tmp"

  rm -f "$matches_tmp"
  matches_tmp=""
  rm -f "$allow_tmp"
  allow_tmp=""
done <"$files_tmp"

if [ "$found" -eq 1 ]; then
  echo "[guard:tz] Found risky Date API usage outside approved utils (or without allow tag):" >&2
  cat "$violations_tmp" >&2
  echo >&2
  echo "To allow intentionally, add a tag within 3 lines above the call:" >&2
  echo "  // SCHEDULES-TZ-ALLOW: reason=…" >&2
  exit 1
fi

echo "[guard:tz] OK"
exit 0
