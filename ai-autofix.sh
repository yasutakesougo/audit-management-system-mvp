set -euo pipefail
echo "▶ Fix: a11y dates + SP JSON guard (idempotent)"
npm run -s fix:a11y-dates || true
npm run -s fix:spclient-json-guard || true

echo "▶ Health (typecheck → lint:dev → tests)"
npm run -s health || true

echo "------"
echo "📦 git status (確認してから commit 推奨)"
git -c color.ui=always status -sb
