## Summary
<!-- 何を変えたか（1-3行） -->

## Why
<!-- なぜ必要か / どんな痛みを解決するか -->

## Changes
- [ ] 

## Verification
- [ ] Required checks are green
- [ ] (If relevant) Smoke E2E passed
- [ ] (If relevant) Artifacts confirmed (trace/screenshot/log)

---

## ✅ Pre-Merge Checklist

### All PRs
- [ ] Self-review: コード品質、型安全性、エラーハンドリング確認
- [ ] テスト: ローカル `npm run preflight` が通過
- [ ] ドキュメント: 必要に応じて README / docs を更新

### UI Changes
- [ ] **状態管理**: UIコンポーネントは状態を持ちすぎていない（hooksに逃がした）
- [ ] **副作用の分離**: API/Storage/Telemetryがコンポーネントに漏れていない（adapter/clientへ）
- [ ] **状態駆動**: 分岐は操作ではなく状態で表現されている
- [ ] **エラー処理**: エラーが分類され、ユーザーへの救済導線がある
- [ ] **レイアウト規約**: 新規ルートは `viewportMode`（`fixed` / `adaptive`）を明示し、[docs/layout/viewport-mode.md](docs/layout/viewport-mode.md) に従っている
- [ ] (詳細: [docs/ui-architecture.md](docs/ui-architecture.md))

### CI/Infra Changes
- [ ] Rollback Plan: 失敗時の戻し方を記述済み
- [ ] Required checks green
- [ ] Runbook 更新（必要な場合）

---

## Rollback Plan
<!-- "戻し方" を必ず書く。特にCI系は簡単に戻せるのが強み -->
- [ ] Revert this PR
- [ ] (If applicable) Remove workflow gate / step

## Notes
<!-- 運用影響、既知のリスク、フォローアップ -->

---

## 関連Issue/PR
<!-- 関連するIssueやPRがあればリンク -->

