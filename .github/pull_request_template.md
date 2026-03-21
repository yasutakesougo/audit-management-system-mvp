## Summary
<!-- 何を変えたか（1-3行） -->

## Why
<!-- なぜ必要か / どんな痛みを解決するか -->

## Changes
- [ ]

## Touchpoints
- [ ] Yes（該当する touchpoints を更新した）
- [ ] No（画面仕様変更なし / 更新不要）
- Updated files: <!-- 例: docs/runbooks/today-ops-touchpoints.md -->

## Verification
- [ ] Required checks are green
- [ ] (If relevant) Smoke E2E passed
- [ ] (If relevant) Artifacts confirmed (trace/screenshot/log)

---

## 🧭 AI Skills（[Protocol](docs/ai-skills-protocol.md)）

<!-- 使ったスキル名を 2-3 個まで列挙。未使用なら N/A -->

- Skills: <!-- 例: @react-best-practices, @testing-patterns -->
- Scope: <!-- 例: src/features/schedules -->

### Evidence Pack（`hardening-*` ラベル時は必須）

- [ ] Unit: `npm test <scope>` PASS
- [ ] E2E: 該当 smoke PASS（N/A 可）
- [ ] Observability: ログ/イベント追加 or 紐付け
- [ ] ADR/Doc: 変更記録リンク → <!-- docs/xxx.md -->

### Hardening Exit Criteria（`hardening-*` ラベル時のみ）

- [ ] 新規 Observability イベントが追加されている
- [ ] 再発防止テストが追加されている
- [ ] ADR or Runbook が更新されている

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

### Navigation Changes
- [ ] **所属グループ**: `group` が業務目的に合致して指定されているか（`daily` `assessment` `record` `ops` `admin`）
- [ ] **並び順**: 対象グループ内で「現場での使用順・頻度順」に配置されているか（末尾にただ追加していないか）
- [ ] **権限・表示**: `navAudience` や `ALWAYS_VISIBLE_GROUPS` の意図（ロックアウト防止等）を守れているか
- [ ] (詳細なレビュー観点: [nav-review-checklist.md](.gemini/antigravity/brain/b9eabdec-d770-4d06-9271-4f866e1c1821/artifacts/nav-review-checklist.md) 参照)

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
