#!/bin/bash
# snapshot-fix.sh
# Phase 3 Snapshot テスト修正スクリプト
# Usage: ./snapshot-fix.sh

set -e

echo "🔄 Phase 3 Snapshot テスト修正スクリプト"
echo "========================================="
echo ""

# Step 1: Main を同期（オプション）
read -p "main ブランチから同期しますか？ (y/n) " -n 1 -r SYNC_MAIN
echo
if [[ $SYNC_MAIN =~ ^[Yy]$ ]]; then
  echo "📥 main を同期中..."
  git checkout main
  git pull origin main --ff-only
  echo "✅ Main 同期完了"
  echo ""
fi

# Step 2: Phase 3 ブランチを確認
CURRENT_BRANCH=$(git branch --show-current)
if [[ $CURRENT_BRANCH != *"phase3"* ]] && [[ $CURRENT_BRANCH != *"fix"* ]]; then
  echo "⚠️  現在のブランチ: $CURRENT_BRANCH"
  read -p "feat/phase3-density-context-integration に切り替えますか？ (y/n) " -n 1 -r SWITCH_BRANCH
  echo
  if [[ $SWITCH_BRANCH =~ ^[Yy]$ ]]; then
    git checkout feat/phase3-density-context-integration
  else
    echo "❌ キャンセルしました"
    exit 1
  fi
fi

echo "📍 現在のブランチ: $(git branch --show-current)"
echo ""

# Step 3: Snapshot 更新
echo "📸 Snapshot テストを更新中..."
echo ""

# すべてのテストを更新
npm run test:unit -- --updateSnapshot

echo ""
echo "✅ Snapshot 更新完了"
echo ""

# Step 4: 変更内容を確認
echo "📊 変更内容を確認中..."
CHANGED_FILES=$(git diff --name-only)
SNAPSHOT_CHANGES=$(git diff tests/unit/__snapshots__/ --stat 2>/dev/null | tail -1 || echo "0 files changed")

echo ""
echo "変更ファイル:"
echo "$CHANGED_FILES"
echo ""
echo "Snapshot 変更: $SNAPSHOT_CHANGES"
echo ""

# Step 5: コミット＆プッシュ
read -p "変更をコミット & プッシュしますか？ (y/n) " -n 1 -r COMMIT_PUSH
echo
if [[ $COMMIT_PUSH =~ ^[Yy]$ ]]; then
  echo "💾 コミット中..."
  git add tests/
  git commit -m "fix(tests): update snapshots for Phase 3 provider structure"
  
  echo "📤 プッシュ中..."
  git push origin $(git branch --show-current)
  
  echo ""
  echo "✅ コミット & プッシュ完了"
  echo ""
  echo "📋 次のステップ:"
  echo "1. GitHub で CI 進行状況を確認"
  echo "2. Snapshot test が成功するまで待機"
  echo "3. Auto-merge でマージ"
else
  echo "ℹ️  コミットをスキップしました"
  echo "手動で以下を実行してください:"
  echo ""
  echo "  git add tests/"
  echo "  git commit -m 'fix(tests): update snapshots for Phase 3 provider structure'"
  echo "  git push origin $(git branch --show-current)"
fi

echo ""
echo "✨ Snapshot 修正スクリプト完了"
