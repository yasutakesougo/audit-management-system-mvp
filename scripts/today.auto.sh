#!/usr/bin/env zsh
set -euo pipefail

# ==== 0) 画面表示 ====
echo "▶ Audit MVP — 今日の自動ドライバを起動します"

# ==== 1) 環境下ごしらえ ====
export PATH="/opt/homebrew/opt/node@20/bin:/opt/homebrew/bin:$PATH"
typeset -U PATH path
hash -r

echo "== Node/npm"
node -v && which node
npm -v && which npm

# プロジェクト依存（CI 相当の最小）
if [ -f package-lock.json ] || [ -f npm-shrinkwrap.json ]; then
  echo "== npm ci"; npm ci --prefer-offline || npm ci
else
  echo "== npm install"; npm install
fi

# ==== 2) VS Code 連携（既存の tasks.json を活用）====
# 2-1) Vite + Vitest watch を並列起動（既にあなたが作った複合タスク相当）
#      → 5173 を占有していたら上書きせず流す
LOGDIR="${PWD}/logs"
mkdir -p "$LOGDIR"
VITE_LOG="$LOGDIR/vite.out.log"
VITEST_LOG="$LOGDIR/vitest.watch.log"

if lsof -i :5173 >/dev/null 2>&1; then
  echo "== Vite: 既に誰かが 5173 を使用中（再起動しません）"
else
  echo "== Vite 起動"
  (nohup npx vite --host --port 5173 >"$VITE_LOG" 2>&1 & echo $! > .vite.pid)
fi

# Vitest watch は常駐（存在すれば再起動しない）
if [ -f .vitest.pid ] && ps -p $(cat .vitest.pid) >/dev/null 2>&1; then
  echo "== Vitest: 既に watch 実行中"
else
  echo "== Vitest watch 起動"
  (nohup npx vitest --watch >"$VITEST_LOG" 2>&1 & echo $! > .vitest.pid)
fi

# ==== 3) 重点テスト（週表示完結の最短ルート）====
echo "== 重点テスト（WeekPage + ensureList）"
npx vitest run \
  src/features/schedule/__tests__/WeekPage.smoke.test.tsx \
  tests/unit/spClient.ensureList.spec.ts \
  || true

# ==== 4) 型 & Lint（情報収集。失敗しても続行）====
echo "== tsc --noEmit（型チェック：失敗しても続行）"
npx tsc --noEmit || true

echo "== eslint（警告は許容・失敗しても続行）"
npx eslint --ext .ts,.tsx src || true

# ==== 5) ヘルスチェック & ブラウザオープン ====
sleep 2
if curl -fsS "http://localhost:5173/" >/dev/null 2>&1; then
  echo "== Vite OK → 週表示を開きます"
  (open "http://localhost:5173/schedules/week" || true)
else
  echo "== Vite NG: $VITE_LOG を確認してください"
fi

# ==== 6) 進行ガイド ====
cat <<GUIDE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 自動起動済み
- Vite        : LOG → $VITE_LOG
- Vitest watch: LOG → $VITEST_LOG

🧪 ふだんの操作（VS Code から）
- ⌘⇧D : Dev: web + tests（並列）
- ⌘⇧W : Test (vitest watch)
- ⌘⇧T : Test (all once)
- ⌘⇧Y : Typecheck
- ⌘⇧L : Lint

🛑 停止したい時
  kill $(cat .vitest.pid 2>/dev/null) 2>/dev/null || true
  kill $(cat .vite.pid 2>/dev/null) 2>/dev/null || true
  rm -f .vitest.pid .vite.pid

🔎 ログ追従
  tail -f "$VITE_LOG" "$VITEST_LOG"

💡 1日の流れ（推奨）
  1) 週表示の Create/Edit 完走
  2) mapper の statusLabel 統一（旧 statusDictionary 参照を削減）
  3) validation.ts を Zod 実装へ差し替え
  4) 必要最小の a11y テストを緑化（jest-axe matcher 拡張済）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GUIDE

