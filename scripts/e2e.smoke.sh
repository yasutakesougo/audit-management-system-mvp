// scripts/e2e.smoke.sh
# E2E smoke test runner: reuses existing server if present, otherwise starts a new one
set -e
export E2E_BASE_URL="http://localhost:3000"
export E2E_SERVER_CMD="npm run dev"
export E2E_SERVER_PORT=3000
npx playwright test tests/e2e/schedule.week.smoke.spec.ts --project=chromium --reporter=line
