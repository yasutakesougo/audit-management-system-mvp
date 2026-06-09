# AI Review Handoff Boundary (receive-only)

## 目的

`ai-derived-artifact-core` から渡される `apply-approved` 出力を `audit-management-system-mvp` が
**受け取る前提で検証**できる最小境界を定義する。

- ここでは「実適用」は行わない。
- SharePoint 書き込み、レコード更新、`write` 系 API 呼び出しは **未実装**。
- 受け取り側の責務は: **JSON 受領の妥当性検証 + 受け取り対象の可視化**。

## 受け取り契約（固定）

対象ファイル: `apply-approved` write/plan の受け取り JSON。

### 必須フィールド

- `schemaVersion`: `nvidia-nim-apply-approved-dry-run/1.0`
- `generatedAt`: string（発行日時）
- `inputPath`: string（元入力 path）
- `summary.total`: number (integer >= 0)
- `summary.approved`: number (integer >= 0)
- `summary.failed`: number (integer >= 0)
- `items[]`: 承認対象候補配列
- `warnings[]`: warning 配列（空配列可）

### `items[]` 必須キー

- `artifactId`
- `path`
- `suggestedTitle`
- `labels` (string[])
- `reason`

### `warnings[]` 形式（提案）

- `type`
- `line`（非負整数）
- `message`
- `raw`（任意）

## 実装境界

- `src/domain/nvidiaNim/applyApprovedReceive.ts`
  - `validateApplyApprovedPlan(raw)`
  - `parseApplyApprovedPlanJson(text)`
  - `schemaVersion` と payload 形状を厳格検証
- `tests/unit/domain/nvidiaNim.applyApprovedReceive.spec.ts`
  - valid/invalid fixture を使った受け取り検証のみ
  - JSON 破損/スキーマ差分時は `success: false`

## 受け取り前提の運用ルール

1. まず `apply-approved` 出力を fixture として保管
2. 上記バリデータで `schemaVersion` + `items` + `summary` を検証
3. 失敗時は `audit-management-system-mvp` 側で適用を開始しない
4. テスト付きで境界を固定し、実適用フェーズは別 PR で管理

## 未実装項目（今回対象外）

- SharePoint への反映
- Records への書き込み
- `--write` 実行や dry-run から先の自動適用

