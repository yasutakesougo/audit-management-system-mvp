# 支援実績フロー完了条件整理（2026-07-15）

## 対象
- 出欠 → 日次支援実績（time based）→ 月次集計 → 利用者別確認 → CSV出力の完了条件確認
- 調査範囲: 月次記録UI、日次支援記録保存、月次集計、ユーザー別月次表示、CSV出力

## 基準
- Baseline: `ad65bd7acf62014e68e6c0a408cca1f7e4ec621a`
- 方針: 製品コードは変更しない。docsのみ。既存文書を追従し、事実として固定。

## 1) フローの実装境界（現時点）

```text
出欠（/daily/attendance）
  → 日次支援実績入力（/daily/support）
    → 月次集計データ作成（/records/monthly）
      → 利用者別詳細表示（/records/monthly?tab=user-detail）
        → CSV出力（UsersPanel）
```

## 2) ステージ別完了条件（実装に基づく）

### 2-1) 出欠
- エントリ: ルート `/daily/attendance`（viewer表示、`/daily/*`は`RequireAudience("viewer")`）
  - `src/app/routes/dailyRoutes.tsx` L19-L23, L67-L71, L75-L79
- 完了条件の明示は本調査の主対象外（別PR候補）。ただし欠席日との整合は月次集計に影響する前提入力として扱う。
- この調査では、日次支援側での欠席ガード（欠席日新規抑止）を主要テーマとする。

### 2-2) 日次支援実績（`/daily/support`）
- `TimeBasedSupportRecordPage` で `UseSupportRecordSubmit` を使用し、`/daily/support` は viewer権限で到達可能。
  - `src/pages/TimeBasedSupportRecordPage.tsx` L67-L77, L132-L140, L193-L201
- 画面上の必須データ:
  - 保存時: `behaviorRepo.add(...)`
  - 実行実績: `executionStore.upsertRecord(...)`（slot 単位）
  - 追加永続化（Layer3）: `persistDailySubmission(...)` の実行トライ
  - `src/pages/hooks/useSupportRecordSubmit.ts` L86-L105, L162-L183
- 保存完了と見なす条件:
  - `behaviorRepo.add` と `executionStore.upsertRecord` が成功し、`persistDailySubmission` が例外なく完了すること（例外時は再試行状態へ）
  - エラーフローでは保存失敗通知や再試行UIがある（`setSubmitError`, `retryPersist`）
- 未記録扱い:
  - 画面導線が未選択ユーザーや未選択ステップ時は、hookレベルでガードや選択状態の初期化が走る（例: `handleUserChange`, `selectedStepId`, `ibdGuard`）

### 2-3) 月次集計（`/records/monthly`）
- 集計取得:
  - `useMonthlySummaries` が当月範囲で DailyAttendance・祝日・ユーザーを取得し、`executeKioskMonthlyAggregation` をユーザー毎に呼ぶ
  - `src/features/records/monthly/hooks/useMonthlySummaries.ts` L66-L99, L117-L126
- 月次集計の実態:
  - 計画日数: `plannedRows = useWorkingDays(既定) × rowsPerDay`
    ただし `contractWeekdays/holidays/absences` がある場合は `calculateDetailedPlannedRows` を適用
  - `src/features/records/monthly/aggregate.ts` L85-L92, L108-L110
- 実績/対象外判定:
  - 実績集計は `dailyRecords`（kiosk execution 由来）を`completed/inProgress/emptyRows` に振り分け。
  - `src/features/records/monthly/kioskEvidence.ts` L83-L87, L159-L110, L212-L219
- 例外:
  - repository 例外時は空サマリを返すフォールバックが走る（KPI 0）
  - `src/features/records/monthly/kioskMonthlyAggregationUseCase.ts` L46-L61

### 2-4) 利用者別確認（月次詳細）
- `MonthlyRecordPage` の `detail` タブは以下で表示分岐:
  - 要約なし (`summaries.length===0`)、ユーザー未選択、対象月未選択、利用者未選択時などで空状態表示を出す
  - `src/pages/MonthlyRecordPage.tsx` L409-L442
- 詳細表示は `summary` 配列上の対象レコードを `detailSummary` として描画。
- `status` 表示は `details` テーブルで `completionRate`、`completedRows`、`emptyRows` 等を数値化。

### 2-5) CSV出力（利用者別）
- CSVは `UsersPanel` のエクスポートフックが担う。
  - 対象月 `yyyy-MM` を `dailyRepository.list({ startDate, endDate })` で取得
  - `exportMonthlySummary(...)` を動的importして実行
  - `src/features/users/UsersPanel/hooks/useUsersPanelExport.ts` L58-L93
- 出力時点は「月次全体スナップショット」。欠席除外や記録対象外フィルタを明示的に分離してはいない（要注意点）。

## 3) 実装・テスト・文書の不一致

### FINDING-001: 欠席日ガードが日次入力に未反映
- 期待（設計）: `AttendanceVisit` がない/欠席日は新規作成抑止（`docs/design/daily-support-records.md` L70-L71）
- 実装（保存フロー）: `/daily/support` 側の送信処理は `targetDate` とユーザー/スロットを基に保存。欠席判定の明示ガードは見当たらない。
  - `useSupportRecordSubmit.ts` L86-L107, L110-L144, L159-L188
- テスト: 月次レイヤーの再集計/表示中心。日次入力の欠席ガードを担保するE2Eは未確認。
- 分類: **B. テストは実装を追従している、設計が未対応を規定**
- 影響: P1（月次集計の欠席対象除外意図と整合しない恐れ）

### FINDING-002: 月次再集計ボタンのUI文言と実処理の乖離
- 期待: 再集計が「実データ再計算」を反映
- 実装:
  - 行UIは再集計APIとして状態表示・disable制御を持つが、`MonthlyRecordPage` 側は `setTimeout` のみによるモック遅延
  - `src/pages/MonthlyRecordPage.tsx` L129-L140
  - 表示更新の実体は主に `MonthlySummaryTable` 側ステータス表示
  - `src/features/records/monthly/MonthlySummaryTable.tsx` L140-L161, L510-L515
- テスト:
- `tests/e2e/monthly.summary-smoke.spec.ts` は主に状態遷移文言と表示確認（実データ差分検証なし）
- `tests/e2e/_helpers/enableMonthly.ts` の `triggerReaggregateAndWait` はメッセージ差分の変化のみ監視
- 分類: **C. 実装とテストは整合、設計意図（実再集計保証）が未確定**
- 影響: P1（運用上の誤認リスク）

### FINDING-003: 月次PDF領域の実生成保証は現時点では別途扱い
- 既存別PRで整理済み。ここでは再確認として、`/records/monthly` のPDFタブは `setTimeout` ベースのUI実行で、実ファイル生成が未連携のままとする契約を維持。
- `src/pages/MonthlyRecordPage.tsx` L152-L165, L534-L541
- 分類: **C（既存契約の未実装領域）**

## 4) 契約の現状サマリ（固定）

- 日次支援保存完了: `behaviorRepo + executionStore + layer3 persist` が揃うことを保存完了として扱う。
- 月次集計完了: 対象月の要約行が `useMonthlySummaries` で取得・整形済みであること。
- 月次利用者別表示完了: `detailSummary` が存在し、空状態/エラー状態メッセージが表示されること。
- CSV完了: `dailyRepository.list` 取得成功後、`exportMonthlySummary` 実行・ブラウザダウンロード生成を試行。

## 5) 対応優先順位（現時点）

- P1
  1. 月次再集計の契約を「UI見た目」「保存済み反映」の2段階に分解し、実再計算ルートと表示ルートを分離
  2. 欠席日ガードの仕様（未実装か、または他フローで担保されるか）を日次入力の実運用仕様として確定
  3. CSV出力で「対象者/対象日（欠席日扱い）」の除外ルールを実装有無として明記
- P2
  1. 月次詳細の「前段未完了」時案内文言と復帰導線の統一
  2. E2E の assertion を実データ再現性（保存先更新検証）寄りへ分離

## 6) 本調査で確定した実装境界（次PR境界）

- 含める: 現状観測の契約（roles, 集計手順, 欠席ガード有無, 再集計の実体）
- 外す:
  - 欠席導線の実装修正（後続PR）
  - 再集計API/ジョブ連携実装
  - 月次CSV出力のフィルタリングロジック追加
  - PDF tab 実実装
  - lint/lint:docs/arch など別カテゴリの基盤修正

## 補足
- 本ファイルは調査レポート固定用であり、実装変更は含めない。
- 追加の参照は調査順序に従い、次回PRで `P1` の差分解消を分離して進める。
