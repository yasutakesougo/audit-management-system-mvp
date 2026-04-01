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

# Check 4: Structural Clean (lint)
echo -ne "...Checking structural integrity (npm run lint)... "
if npm run lint >/dev/null 2>&1; then
  echo -e "${GREEN}PASSED${NC}"
else
  echo -e "${RED}FAILED${NC}"
  echo "❌ Error: Repository DI consistency is broken. Fix lint errors before deploy."
  exit 1
fi

# Check 5: Contract Consistency (typecheck)
echo -ne "...Checking type safety (npm run typecheck)... "
if npm run typecheck >/dev/null 2>&1; then
  echo -e "${GREEN}PASSED${NC}"
else
  echo -e "${RED}FAILED${NC}"
  echo "❌ Error: Type safety contracts are broken. Fix TS errors before deploy."
  exit 1
fi

# Check 6: Regression Safety (test)
# Using 'test:ci:required' for a balanced speed/coverage check
echo -ne "...Checking core regressions (npm run test:ci:required)... "
if npm run test:ci:required >/dev/null 2>&1; then
  echo -e "${GREEN}PASSED${NC}"
else
  echo -e "${RED}FAILED${NC}"
  echo "❌ Error: Core regression tests failed. Fix tests before deploy."
  exit 1
fi

echo ""
echo -e "${GREEN}🏆 Deployment Ready: Go Signals Finalized${NC}"
echo "   - [Structural Clean]   : PASSED"
echo "   - [Contract Consistent]: PASSED"
echo "   - [Regression Safe]    : PASSED"
echo "   - [Sync Status]        : synced with origin/main ($LOCAL)"
echo ""


