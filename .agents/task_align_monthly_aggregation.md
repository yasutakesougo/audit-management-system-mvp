# AI作業指示書: feat(monthly-records): align monthly aggregation with kiosk execution evidence

## 🎯 タスク概要
月次記録 (`MonthlySummary` / `MonthlyKpi`) とキオスク90日集計 (`KioskMonitoringSummary`) において、`completed` / `triggered` / `skipped` / `memo` / `empty` の用語定義およびカウント方法を一本化（align）します。
共通の純粋関数（pure helper）となる整合ヘルパーモジュールを新規作成して双方の集計ロジックを統合し、二重計上などの数値矛盾を完全に排除します。
また、月次画面（MUI Tooltip）で、各KPIがどのようなキオスク実施証跡（Evidence）に基づき集計されているかの根拠がひと目で理解できるように UI を拡張します。

---

## 📋 前提条件
- **ブランチ**: `feat/monthly-kiosk-align`
- **ベース**: `main`
- **依存Issue**: #1880

---

## 🔒 制約
- **破壊的変更の禁止**: 既存の `MonthlyKpi` などのデータ構造、SharePoint 保存用のスキーマ定義、および `aggregateMonthlyKpi` の基本インターフェースは崩さず、オプションや拡張で担保してください。
- **型安全性の維持**: `any` の使用は厳禁です。完全に型付けを行ってください。
- **スコープの限定**: 保存スキーマの大幅な変更、PDF/Word等の帳票出力、請求確定ロジックの変更、Power Automate 連携などの機能は含めないでください（純粋な集計・計算ロジックの整合と UI 表示のみ）。

---

## 🛡️ 追加ガードレール
- **ReconciledStatus は排他ステータス**として扱います。
- **`memoRows` / `specialNotes` は排他ステータスではなく「重複属性」**として扱います（したがって、`emptyRows` の算出において `memoRows` を直接控除してはなりません）。
- `skippedRows` と `triggeredRows` を `inProgressRows` に含める場合、`emptyRows` の計算においてこれらが二重に控除されないように厳密な数式定義を用いてください。
- `MonthlyKpi` の新規フィールドを追加する場合は **optional のみ**とし、保存済み月次データとの後方互換を完全に維持してください。
- UI Tooltip の説明文は、実際に実装された計算ロジックと完全に一致させてください。

---

## 🚀 実装ステップ

### ステップ1: 実施記録整合ヘルパー (`reconcileRecordStatus`) の新規作成
**ファイル**: `src/features/daily/domain/executionRecordReconciliation.ts` （新規作成）

**選定理由**: 
`ExecutionRecord` は `src/features/daily/domain/executionRecordTypes.ts` に定義されており、`monitoring` (モニタリング) と `monthly` (月次) の双方から使われるため、循環参照を防ぐために共通ドメイン配下に配置するのが最もクリーンで安全な設計です。

**内容**:
キオスク実施記録 `ExecutionRecord` のフィールド状態から、排他的なステータス分類を安全に決定する pure helper 関数を一元化します。

```typescript
import type { ExecutionRecord } from './executionRecordTypes';

/**
 * 整合化された排他的な集計ステータス
 * - completed: 完了（予定通り完了）
 * - triggered: 行動発生（BIP発動または明示的トリガー）
 * - skipped: スキップ（実施なし）
 * - in-progress: 進行中（未完了だが、メモや一時記録あり）
 * - empty: 未記入（記録が一切なし）
 */
export type ReconciledStatus = 'completed' | 'triggered' | 'skipped' | 'in-progress' | 'empty';

/**
 * 1件の ExecutionRecord から、排他ルールに基づいて整合化されたステータスを導出する。
 *
 * 【排他優先度】
 * 1. record.status === 'completed' -> 'completed'
 * 2. record.status === 'triggered' || (record.triggeredBipIds ?? []).length > 0 -> 'triggered'
 * 3. record.status === 'skipped' -> 'skipped'
 * 4. record.memo が空文字列以外 -> 'in-progress'
 * 5. それ以外 (status === 'unrecorded' でメモ等なし) -> 'empty'
 */
export function reconcileRecordStatus(record: ExecutionRecord): ReconciledStatus {
  const status = record.status;
  const hasMemo = typeof record.memo === 'string' && record.memo.trim().length > 0;
  const hasBips = Array.isArray(record.triggeredBipIds) && record.triggeredBipIds.length > 0;

  if (status === 'completed') return 'completed';
  if (status === 'triggered' || hasBips) return 'triggered';
  if (status === 'skipped') return 'skipped';
  if (hasMemo) return 'in-progress';
  return 'empty';
}

/**
 * レコードに有効なメモが記入されているか判定する（重複属性）
 */
export function hasRecordMemo(record: ExecutionRecord): boolean {
  return typeof record.memo === 'string' && record.memo.trim().length > 0;
}
```

**完了条件**: 
- `executionRecordReconciliation.ts` が新規作成されている。
- `reconcileRecordStatus` および `hasRecordMemo` がテスト可能な形で適切に export されている。

---

### ステップ2: 月次キオスク証跡連携層 (`kioskEvidence.ts`) のリファクタリング
**ファイル**: `src/features/records/monthly/kioskEvidence.ts`

**内容**:
`toMonthlyDailyRecordFromKioskEvidence` および `summarizeKioskMonthlyEvidence` 内の判定・カウンタ集計ロジックを、ステップ1で作成した `reconcileRecordStatus` ヘルパーを利用するように置き換えます。

1. **`toMonthlyDailyRecordFromKioskEvidence` の変更**:
   - `reconcileRecordStatus(record)` から得られた `ReconciledStatus` を使って、返却する `DailyRecord` オブジェクトの boolean フラグを設定します：
     - `completed: reconciled === 'completed'`
     - `isSkipped: reconciled === 'skipped'`
     - `isTriggered: reconciled === 'triggered'`
     - `isEmpty: reconciled === 'empty'`
     - `hasMemo: hasRecordMemo(record)`
     - `hasSpecialNotes: hasRecordMemo(record)`
     - `hasIncidents`: `reconciled === 'triggered'`

2. **`summarizeKioskMonthlyEvidence` の変更**:
   - `KioskMonthlyEvidenceStats` 内の各カウンタを `reconcileRecordStatus` および `hasRecordMemo` の判定結果に基づいて厳格に集計するようにし、二重計上を完全に防ぎます。

**完了条件**:
- 既存の `kioskEvidence.ts` 内のローカルヘルパーがステップ1のヘルパーに安全に置換され、重複ロジックが排除されている。
- ファイル全体で型エラーがない。

---

### ステップ3: モニタリングキオスク集計 (`monitoringKioskAnalytics.ts`) のリファクタリング
**ファイル**: `src/features/monitoring/domain/monitoringKioskAnalytics.ts`

**内容**:
- `aggregateKioskRecords` 内で、これまで `status === 'unrecorded'` のレコードを一律でスキップ（`continue`）していたため、**「未記録だが、メモが記入されている（= in-progress）」**レコードがモニタリング統計から漏れてしまう不整合を解消します。
- レコードのループ処理において、`reconcileRecordStatus(record)` の結果が `'empty'` の場合のみ `continue`（集計対象外）とし、それ以外（`'in-progress'` など）は適切に `memoCount++` などの処理を行います。
- `completedCount`, `triggeredCount`, `skippedCount` などの集計を、ステップ1で定義した `reconcileRecordStatus` に基づく排他的な分類に完全に揃えます。

**完了条件**:
- `aggregateKioskRecords` 内で `reconcileRecordStatus` が正しく活用され、`unrecorded` だけどメモがあるレコードが適切に `memoCount` 等に反映される。
- 型エラーがない。

---

### ステップ4: テストの整備・不整合の解消
**ファイル**:
- `src/features/records/monthly/__tests__/kioskEvidence.test.ts`
- `src/features/monitoring/domain/__tests__/monitoringKioskAnalytics.spec.ts`

**内容**:
1. **新規の一致性検証テストの追加**:
   - 同一の `ExecutionRecord[]` から月次サマリー (`aggregateMonthlySummaryFromKioskEvidence` 経由) と、モニタリングキオスク集計 (`aggregateKioskRecords` 経由) を実行した際、得られる各件数（完了数、トリガー数、スキップ数、メモ数など）が **1件のズレもなく完全に一致すること（整合性SSOT）** を検証するアサーションテストを追加します。
2. **エッジケースの追加**:
   - 未記録だがメモがあるレコード (`status: 'unrecorded', memo: '本人拒否気味'`)。
   - トリガーだがメモもあるレコード (`status: 'triggered', memo: 'BIP対応実施'`)。
   - これらが排他ステータスと重複属性として混乱なく、かつ二重計上されずに集計できているかをアサートします。

**実行コマンド**:
```bash
npx tsc --noEmit
npx vitest run src/features/records/monthly
npx vitest run src/features/monitoring/domain/__tests__/monitoringKioskAnalytics.spec.ts
```

**完了条件**: 
- すべての型チェック、および新規/既存テストが 100% グリーン（PASS）であること。

---

### ステップ5: UI tooltip の追加による集計根拠の可視化
**ファイル**:
- `src/features/records/monthly/UserKpiCards.tsx`
- `src/features/records/monthly/MonthlySummaryTable.tsx`

**内容**:
1. **`UserKpiCards.tsx` への tooltip 追加**:
   - `import Tooltip from '@mui/material/Tooltip';` を導入。
   - 「作業進捗」カードの各表示項目「完了」「進行中」「未記入」に対して、集計基準・キオスク実施証跡との紐づきを示す Tooltip を追加します。
     - **完了**: 「キオスクで『完了』と記録された回数 / 全計画数」
     - **進行中**: 「『トリガー（行動発生）』『スキップ』、または『未記録だがメモあり』の合計件数。何らかのアクション・変化が記録されている状態です（進行中 = トリガー数 + スキップ数 + 進行中のみの件数）」
     - **未記入**: 「キオスク上でまだ一度も記録やメモが行われていない枠数（未記入 = 計画数 - 完了 - 進行中）」
2. **`MonthlySummaryTable.tsx` への tooltip 追加 (必要に応じて)**:
   - 各KPI列のヘッダーやセルに、同様の計算ロジック（Completed/Triggered/Skipped/Empty）を説明する tooltip またはヘルプアイコンを追加し、監査員や現場リーダーが「なぜこの数値になっているか」を説明しやすくします。

**完了条件**:
- Tooltip のテキストが、ステップ1〜3の集計計算ロジックと完全に正確に一致していること。
- React のコンパイルエラー・型エラーが一切ないこと。

---

## 🚫 禁止事項
1. **他のドメイン・機能ファイルの変更禁止**: 請求確定、PDF/Word、SharePoint物理保存テーブルの改修、Power Automate 連携などの関連外処理に触れないこと。
2. **既存の `MonthlyKpi` の optional フィールドを required に変更しない**: 既存データとの後方互換性が壊れます。
3. **Tooltip の説明文と実際のコードロジックを乖離させない**: 監査証跡として信頼できる正確な説明にすること。

## ✅ 最終完了条件
- [ ] 型エラーなし（`npx tsc --noEmit` 通過）
- [ ] すべての既存テストおよび新規追加テストが 100% 通過
- [ ] キオスク集計と月次KPI集計が同一データで完全に一致することがテストコードで保証されている
- [ ] MUI `Tooltip` を使った、集計根拠のヘルプ表示が画面（UserKpiCards）に実装されている
- [ ] コミットメッセージ: `feat(monthly-records): align monthly aggregation with kiosk execution evidence`
