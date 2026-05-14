# feat(planning-sheet): cite ABC evidence draft into evaluation fields

## 概要
PR3「Dedicated ABC 記録のドラフト評価文を L2 支援計画シート §9 評価欄へ安全に引用する機能」の実実装です。

## 主な実装内容

### 1. 証跡リンク永続化スキーマの追加と後方互換性の確保
- [ispPlanningSheetSchema.ts](file:///Users/yasutakesougo/audit-management-system-mvp/src/domain/isp/schema/ispPlanningSheetSchema.ts) に証跡メタデータを記録するための `monitoringEvidenceLinkSchema` を定義しました。
- `planningDesignSchema` へ `monitoringEvidenceLinks` プロパティを `.optional().default([])` として追加し、**物理列の追加を一切行わずに既存の `PlanningJson` 内に構造化配列として埋め込んで保存する設計**を実装しました。
- `monitoringEvidenceLinks` が存在しない既存の SharePoint レコードをパース・デシリアライズした際にも、エラーを吐かずに `[]` (空配列) として安全に補完・パースされるよう [mapper.ts](file:///Users/yasutakesougo/audit-management-system-mvp/src/data/isp/mapper.ts) および Zod スキーマレベルでのデシリアライズ時後方互換性を徹底。
- [schema.spec.ts](file:///Users/yasutakesougo/audit-management-system-mvp/src/domain/isp/__tests__/schema.spec.ts) に後方互換性を厳密に検証する自動テストケースを2件（欠落時のデフォルト初期化、および正しい構造の受理）追加しました。

### 2. §9 評価欄への安全な UI 追記・重複防止ロジック
- [FormSections.tsx](file:///Users/yasutakesougo/audit-management-system-mvp/src/features/planning-sheet/components/new-form/FormSections.tsx) の §9 欄直下に `AbcEvidenceListPanel` を配置。
- 「評価欄へ引用」ボタンが押されたときのみ、既存テキストを上書き破壊せずに末尾へ安全に追記（二重改行 `\n\n` 区切りでアペンド）するロジックを実装。
- 同一の `recordIds` (Dedicated ABC 記録) がすでに引用証跡リストに登録されている場合、UI上で「引用済み」と判定（`isCited`）して追加の引用ボタンを無効化する重複防止機能を実装。

### 3. 型安全性・テストの整備
- `usePlanningSheetForm` フォーム初期値やフィクスチャデータへの `monitoringEvidenceLinks` 補完など、周辺パラメータの型不整合を完全に解消。
- `npm run typecheck` および `npm run lint` を実行し、**Exit code: 0（警告・エラーなしの完全グリーン）** を実測確認済み。
- `planning-sheet` および `monitoring` 関連の単体テスト（合計539件）がすべて完全に合格（Pass）することを確認済み。

---

## 最重要ガードレール遵守状況

| ガードレール要件 | 遵守ステータス | 実装の根拠 / 隔離方針 |
| :--- | :---: | :--- |
| **職員操作による引用のみ** | 🟢 遵守 | 自動確定や自動保存は一切行いません。職員がUIから意図的に引用ボタンをクリックしたときのみ、画面のフォーム state が更新されます。 |
| **既存テキストの破壊防止** | 🟢 遵守 | 既存テキストが存在する場合、その末尾にアペンド（追記）します（上書きしません）。 |
| **重複引用の防止** | 🟢 遵守 | 同一 `recordIds` の有無を `monitoringEvidenceLinks.some` で判定し、すでに引用されている場合はボタンを無効化します。 |
| **永続化設計の順守** | 🟢 遵守 | SharePoint 物理列の新規追加は一切ありません。既存の保存フローを通じて `PlanningJson.monitoringEvidenceLinks` として保存されます。 |
| **DailyActivityRecords 統合なし** | 🟢 遵守 | DailyActivityRecords への参照・同期・統合は行っていません。 |
| **L1 個別支援計画への直接反映なし**| 🟢 遵守 | L1 個別支援計画への書き込みや影響は一切ありません。 |
