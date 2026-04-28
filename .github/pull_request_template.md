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
- [ ] Manual field verification completed: [docs/checklists/field-verification-30min.md](docs/checklists/field-verification-30min.md)

### 30-Min Field Verification Gate（UI/導線変更があるPRで必須）
- [ ] 実行順を `viewer -> reception -> admin` で実施した
- [ ] 判定基準を適用した（`A/B/C Fail = 即修正`, `D/E Fail = 軽微なら次PR可`）
- [ ] 最終Gateを満たした（`viewerが迷わない` / `adminが困らない` / `回帰なし`）

---

## 🔒 Security Check（プロジェクト固有ルール確認 / 全PR必須）

> 違反は原則マージブロック。静的解析で捕捉できない設計判断をレビュー入口で止めるためのゲート。

### データアクセス層
- [ ] **Repository経由**: UI / Hook から Repository Factory を直呼びしていない（`useXXXRepository()` 経由）
- [ ] **通信経路限定**: `spFetch` / `graphFetch` / `resilientFetch` 以外の生 `fetch()` を新規追加していない
- [ ] **SharePoint直参照なし**: Repository層から `@/lib/sp/*`（helpers除く）を直接 import していない

### スキーマ / SSOT
- [ ] **`fields/*.ts` 準拠**: 新規参照するフィールドは `src/sharepoint/fields/*.ts` に定義済み
- [ ] **OData手組みなし**: `eq` / `ne` / `substringof(` 等のフィルタ文字列を手動組立していない（`builders.ts` 使用）
- [ ] **drift fail-open**: 欠損フィールドで処理停止させず、観測（telemetry / log）に逃がしている

### UI / 状態管理
- [ ] **`window.confirm` 不使用**: 確認ダイアログは `useConfirmDialog` + `ConfirmDialog` を使用
- [ ] **Zustand selector 安定性**: selector で新規 object / array リテラルを返していない（個別購読 or memo）
- [ ] **pure / IO 分離**: ビジネスロジックから副作用（fetch / storage / telemetry）を分離

### 認証 / 認可 / セキュリティ
- [ ] **認可チェック**: データアクセスに対象リソースの権限確認がある（ID指定のみで他人データ取得不可）
- [ ] **サーバー側検証**: バリデーションをクライアント側のみに依存していない
- [ ] **シークレット直書きなし**: APIキー / トークン / 接続文字列を直書きしていない（env / Secrets のみ）
- [ ] **エラー露出なし**: ユーザー向け文言と内部ログが分離、スタックトレース / 内部ID / SQL を露出していない
- [ ] **入力検証**: 外部入力を無検証で DOM / query / storage に流していない（XSS / Injection対策）

### 該当なし宣言（該当チェックのスキップ理由）
<!-- 例: "UI変更なしのため Zustand / confirm 項目は N/A" / "認可は親Page側で実施済み" -->
- N/A 項目と理由:

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

## 🎨 Design Review (Principles)

> 💡 判断補助 OS としての設計思想（[Principles](docs/product/principles.md)）に沿っているか

- [ ] **現場で自然に使われるか**: 業務導線（Today/Daily等）を壊さず、即座に次アクションが取れるか
- [ ] **判断の質を上げるか**: 単なる情報提示ではなく、根拠（参考記録・比較）を添えた提案であるか
- [ ] **組織知として残るか**: 誰がなぜその判断をしたかの履歴が残り、監査・教育に利用できるか
- [ ] 重要/大規模変更時は **[詳細チェックリスト](docs/product/design-review-checklist.md)** を実施・転記した

---

## ✅ Pre-Merge Checklist

### All PRs
- [ ] Self-review: コード品質、型安全性、エラーハンドリング確認
- [ ] テスト: ローカル `npm run preflight` が通過
- [ ] ドキュメント: 必要に応じて README / docs を更新
- [ ] 既存の a11y/usability gate に影響がないことを確認した

### UI Changes
- [ ] **a11y/usability checklist**: [docs/checklists/a11y-usability-rollout-checklist.md](docs/checklists/a11y-usability-rollout-checklist.md) を適用済み
- [ ] **UI語彙チェック**: UI表示語が統一語彙（`個別支援計画` / `支援計画シート` / `支援手順の実施` / `日々の記録` / `見直し・PDCA`）に準拠している
- [ ] **旧語混入チェック**: 新規・変更UIに旧語（`ISP` / `SPS` / `ケース記録` / `日次記録`）が含まれていない（識別子・技術コメントを除く）
- [ ] **状態管理**: UIコンポーネントは状態を持ちすぎていない（hooksに逃がした）
- [ ] **副作用の分離**: API/Storage/Telemetryがコンポーネントに漏れていない（adapter/clientへ）
- [ ] **状態駆動**: 分岐は操作ではなく状態で表現されている
- [ ] **エラー処理**: エラーが分類され、ユーザーへの救済導線がある
- [ ] **レイアウト規約**: 新規ルートは `viewportMode`（`fixed` / `adaptive`）を明示し、[docs/layout/viewport-mode.md](docs/layout/viewport-mode.md) に従っている
- [ ] (詳細: [docs/ui-architecture.md](docs/ui-architecture.md))

### Navigation & UX Changes
- [ ] **Navigation OS Contract Compliance**:
  - [ ] [docs/navigation.md](docs/navigation.md) の **7-Group IA** 及び **5-Layer Filter** に準拠しているか
  - [ ] 表示ロジックの変更が `buildVisibleNavItems` (pure helper) に集約されているか
- [ ] **通常モード整理**: `group` や並び順が業務目的に沿っているか（権限ロックアウト防止含む）
- [ ] **キオスクモード退行防止 (E2E Test Alignment)**:
  - [ ] E2E: `kiosk mode: 1-tap navigation to schedule and back to today` が保護されているか
  - [ ] E2E: `kiosk mode: FAB fallback menu can navigate back to normal mode` が保護されているか

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
