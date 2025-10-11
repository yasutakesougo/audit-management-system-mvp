#!/usr/bin/env bash
set -euo pipefail

# --- usage / args -------------------------------------------------------------
usage() {
  cat <<'EOF'
Usage:
  .github/scripts/release.sh <tag> [--title "Title"] [--notes-file path] [--draft] [--prerelease] [--dry-run]

Examples:
  .github/scripts/release.sh v0.9.0
  .github/scripts/release.sh v0.9.1 --title "v0.9.1 – 2025-11-05" --draft
  .github/scripts/release.sh v1.0.0 --notes-file release-notes.md

Notes:
- <tag> should match a "## [x.y.z] – YYYY-MM-DD" section in CHANGELOG.md (the "Keep a Changelog" format).
- If --notes-file is omitted, notes are auto-extracted from CHANGELOG.md.
- Requires: git, gh (GitHub CLI), awk.
EOF
}

TAG="${1:-}"
shift || true || true

TITLE=""
NOTES_FILE=""
DRAFT="false"
PRERELEASE="false"
DRY_RUN="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --title)       TITLE="${2:-}"; shift 2 ;;
    --notes-file)  NOTES_FILE="${2:-}"; shift 2 ;;
    --draft)       DRAFT="true"; shift ;;
    --prerelease)  PRERELEASE="true"; shift ;;
    --dry-run)     DRY_RUN="true"; shift ;;
    -h|--help)     usage; exit 0 ;;
    *) echo "Unknown arg: $1"; usage; exit 1 ;;
  esac
done

if [[ -z "$TAG" ]]; then
  echo "Error: <tag> is required"; usage; exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "Error: GitHub CLI 'gh' is required. See https://cli.github.com/"; exit 1
fi

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "Error: GITHUB_TOKEN env var is required for 'gh release create'"; exit 1
fi

# --- sanity checks ------------------------------------------------------------
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Error: working tree not clean. Commit or stash changes first."; exit 1
fi

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Error: tag '$TAG' already exists locally."; exit 1
fi

if git ls-remote --exit-code --tags origin "refs/tags/$TAG" >/dev/null 2>&1; then
  echo "Error: tag '$TAG' already exists on remote."; exit 1
fi

# --- derive title if missing --------------------------------------------------
if [[ -z "$TITLE" ]]; then
  TODAY="$(date +%F)"
  TITLE="${TAG} – ${TODAY}"
fi

# --- obtain notes -------------------------------------------------------------
WORK_NOTES_FILE="${NOTES_FILE:-".release-notes-${TAG}.md"}"

if [[ -n "$NOTES_FILE" ]]; then
  if [[ ! -f "$NOTES_FILE" ]]; then
    echo "Error: --notes-file '$NOTES_FILE' not found"; exit 1
  fi
else
  if [[ ! -f "CHANGELOG.md" ]]; then
    echo "Error: CHANGELOG.md not found and no --notes-file provided"; exit 1
  fi

  VERSION="${TAG#v}"
  awk -v ver="$VERSION" '
    BEGIN { capture=0 }
    $0 ~ "^## \[" ver "\] " { capture=1; print; next }
    capture && $0 ~ "^## \[" { capture=0 }
    capture { print }
  ' CHANGELOG.md > "$WORK_NOTES_FILE"

  if [[ ! -s "$WORK_NOTES_FILE" ]]; then
    echo "Warning: could not extract section for $VERSION from CHANGELOG.md; using full file"
    cp CHANGELOG.md "$WORK_NOTES_FILE"
  fi
fi

echo "==> Prepared notes in $WORK_NOTES_FILE"
echo "==> Title: $TITLE"
echo "==> Tag:   $TAG"

# --- dry run preview ----------------------------------------------------------
if [[ "$DRY_RUN" == "true" ]]; then
  echo "[DRY RUN] Would run:"
  echo "  git tag -a \"$TAG\" -m \"$TITLE\""
  echo "  git push origin \"$TAG\""
  echo -n "  gh release create \"$TAG\" --title \"$TITLE\" --notes-file \"$WORK_NOTES_FILE\""
  [[ $DRAFT == true ]] && echo -n " --draft"
  [[ $PRERELEASE == true ]] && echo -n " --prerelease"
  echo
  exit 0
fi

# --- create annotated tag & push ---------------------------------------------
git tag -a "$TAG" -m "$TITLE"
git push origin "$TAG"

# --- create GitHub release ----------------------------------------------------
GH_ARGS=( "$TAG" --title "$TITLE" --notes-file "$WORK_NOTES_FILE" )
[[ "$DRAFT" == "true" ]] && GH_ARGS+=( --draft )
[[ "$PRERELEASE" == "true" ]] && GH_ARGS+=( --prerelease )

gh release create "${GH_ARGS[@]}"

echo "✅ Release created: $TAG"
echo "   Notes: $WORK_NOTES_FILE"
