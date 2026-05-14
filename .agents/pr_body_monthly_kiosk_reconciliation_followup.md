# PR本文ドラフト

**PRタイトル候補**: `fix(monthly-records): reconcile kiosk status priority after #1881`

---

## 概要
PR #1881 のマージ後に残存していた月次KPI、エビデンス集計、および90日モニタリング統計の間のステータス判定とカウンタ不整合を完全に解消するための follow-up PR です。

Closes #1880
(Follow-up to #1881)

## 変更内容

### 追加
- **ステータス整合化ヘルパーの創設** (`src/features/daily/domain/executionRecordReconciliation.ts`)
  - キオスク実施エビデンス（ExecutionRecord）から、指定された優先度ルール（完了 ➔ トリガー ➔ スキップ ➔ 進行中 ➔ 空）に基づき、排他的な整合化ステータス `ReconciledStatus` を導出するピュア関数 `reconcileRecordStatus` および重複属性用の `hasRecordMemo` を新設しました。
- **SSOT整合性保証テストの追加** (`src/features/records/monthly/kioskEvidence.test.ts`)
  - 同一のキオスク実施記録から「月次KPI」「月次エビデンスカウンタ」「90日モニタリング集計」を算出したとき、完了・トリガー・スキップ・メモ件数が **1件のズレもなく完全に一致すること** を保証する強力な結合テストケースを追加しました。

### 変更
- **90日モニタリング会議統計漏れバグの修正** (`src/features/monitoring/domain/monitoringKioskAnalytics.ts`)
  - 従来 `unrecorded` 状態のレコードが一律スキップされていたため、「未完了だが現場スタッフがメモを記入していた進行中レコード」が会議統計から漏れる不具合がありました。今回、共通ヘルパーに則り「本当に空のレコードのみスキップ」するよう修正しました。
- **計算式の安全化・簡略化（二重計上の排除）** (`src/features/records/monthly/aggregate.ts`)
  - `inProgressRows`（進行中）を「完了でも空でもないすべての行（トリガー、スキップ、メモあり未完了を含む）」に再定義し、`emptyRows`（未記入）の計算式を `max(0, plannedRows - completedRows - inProgressRows)` へと安全化しました。
- **キオスク集計変換処理の共通化** (`src/features/records/monthly/kioskEvidence.ts`)
  - 以前は局所的に重複実装されていた `hasMemo`, `isEmptyKioskEvidence` 等を撤廃し、新設した `executionRecordReconciliation.ts` の共通ロジックに一本化しました。
- **UI Tooltip による透明性向上** (`src/features/records/monthly/UserKpiCards.tsx`)
  - MUI の `Tooltip` と `HelpOutlineIcon` を新規配置し、完了・進行中・未記入・特記事項・インシデントの定義および計算ロジック（予定行数からの控除など）が現場で一目で分かるようにしました。

---

## 変更ファイル一覧
| ファイル | 変更種別 | 変更内容 |
|---------|---------|---------|
| `src/features/daily/domain/executionRecordReconciliation.ts` | **追加** | 共通の整合化ステータス判定ヘルパー |
| `src/features/records/monthly/aggregate.ts` | **変更** | `inProgressRows` & `emptyRows` 計算式の安全化 |
| `src/features/records/monthly/kioskEvidence.ts` | **変更** | 共通ヘルパーの適用、集計カウンタの整合化 |
| `src/features/monitoring/domain/monitoringKioskAnalytics.ts` | **変更** | 未完了メモありレコードのモニタリング集計漏れバグの修正 |
| `src/features/records/monthly/UserKpiCards.tsx` | **変更** | MUI Tooltip + HelpOutlineIcon による集計定義の可視化 |
| `src/features/records/monthly/kioskEvidence.test.ts` | **変更** | 既存アサーションの修正 ＋ SSOT完全一致テストの増強 |
| `src/features/records/monthly/kioskMonthlyAggregationUseCase.test.ts` | **変更** | 新仕様アライメントに合わせた期待値の修正 |

---

## テスト
- [x] 既存テスト通過 (`npx vitest run` -> 331テスト全件グリーン)
- [x] 型チェック通過 (`npm run typecheck` -> エラーなし)
- [x] 新規テスト追加 (月次・エビデンス・モニタリングのSSOT不整合防止テストを追加)

## セルフレビュー
- [x] `console.log` 残していない
- [x] `any` 使っていない
- [x] 責務分離を守っている
- [x] 600行ルール違反なし

## 影響範囲
- 月次のキオスクエビデンスアライメント集計、および90日モニタリング会議統計。
- データの物理保存スキーマや PDF/Word、請求への影響 is ありません（計算式の純粋な整合化とUI表示の改善のみ）。
