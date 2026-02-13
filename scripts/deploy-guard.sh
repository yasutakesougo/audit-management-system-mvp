#!/bin/bash
set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Check 1: Working tree must be clean
if [[ -n "$(git status --porcelain)" ]]; then
  echo -e "${RED}❌ Error: working tree is dirty. Commit or stash before deploy.${NC}"
  echo ""
  git status --short
  exit 1
fi

# Fetch latest from origin
git fetch origin main >/dev/null 2>&1 || true

# Check 2: Must be on main branch
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo -e "${RED}❌ Error: not on main branch (current: $CURRENT_BRANCH).${NC}"
  echo "Please checkout main before deploy."
  exit 1
fi

# Check 3: HEAD must match origin/main
LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse origin/main)"

if [[ "$LOCAL" != "$REMOTE" ]]; then
  echo -e "${RED}❌ Error: HEAD ($LOCAL) is not synced with origin/main ($REMOTE).${NC}"
  echo "Please merge to main and pull origin/main before deploy."
  exit 1
fi

echo -e "${GREEN}✅ deploy-guard: OK${NC}"
echo "   - Working tree clean"
echo "   - On main branch"
echo "   - HEAD matches origin/main ($LOCAL)"
