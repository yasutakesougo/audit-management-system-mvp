#!/bin/bash
set -e

echo "🎯 Sprint 1 統合確認スクリプト"
echo "======================================"
echo ""

echo "📊 Phase-1 マージ済みPR:"
gh pr list --state merged --search "is:pr is:merged label:Phase-1 sort:updated-desc" --limit 10 --json number,title,mergedAt --jq '.[] | "  ✅ PR #\(.number): \(.title) (merged: \(.mergedAt | fromdateiso8601 | strftime("%Y-%m-%d %H:%M")))"'
echo ""

echo "📋 Phase-1 Issues:"
gh issue list --label "Phase-1" --json number,title,state --jq '.[] | "  \(if .state == "CLOSED" then "✅" else "🔄" end) #\(.number): \(.title) (\(.state))"'
echo ""

echo "🔄 Open PRs with auto-merge:"
gh pr list --json number,title,state,mergeStateStatus,autoMergeRequest --jq '.[] | select(.state=="OPEN" and .autoMergeRequest != null) | "  🔄 PR #\(.number): \(.title) (status: \(.mergeStateStatus))"'
echo ""

echo "🧪 Running unit tests..."
npm test -- --run --reporter=verbose 2>&1 | tail -20
echo ""

echo "✅ Typecheck..."
npm run typecheck 2>&1 | grep -E "(error|Error|✓|success)" | head -5 || echo "  ✓ No type errors"
echo ""

echo "✅ Lint..."
npm run lint 2>&1 | grep -E "(error|Error|✓|success|problem)" | head -5 || echo "  ✓ No lint errors"
echo ""

echo "======================================"
echo "🎉 Sprint 1 統合確認完了！"
echo "======================================"
