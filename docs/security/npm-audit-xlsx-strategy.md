# xlsx 対応方針（npm audit: npm-audit-separation lane 1）

更新日: 2026-07-14

## 固定範囲

- 対象: 月次サマリ出力と `xlsx` / `exceljs` 系エクスポートの役割分離
- 対象ブランチ: `main` ベース
- 変更しない: lockfile / app 実装 / CSV 列契約 / 公式帳票 Excel

## 現行契約

- 月次サマリ出力は CSV である
  - 実装: `src/features/reports/monthly/MonthlySummaryExcel.ts`
  - MIME: `text/csv;charset=utf-8`
  - filename: `利用実績月次サマリ_<YYYY-MM>.csv`
  - UI: `利用実績月次サマリ (CSV) 出力`
  - unit: `MonthlySummaryExcel.spec.ts` が `.csv` download を期待
- `MonthlySummaryExcel` は歴史的な module 名であり、現行の実出力形式は Excel ではない
- 公式帳票系の `.xlsx` 生成は別機能である
  - `generateSupportProcedureExcel.ts`
  - `generateSeikatsuKaigoExcel.ts`
  - こちらは `exceljs` を使う実 Excel 出力として扱う

## 監査証跡

- `npm ls exceljs --depth=0`
  - `exceljs@4.4.0`
- `npm ls xlsx --depth=0`
  - direct dependency なし
- `npx vitest run src/features/reports/__tests__/MonthlySummaryExcel.spec.ts --reporter=verbose`
  - 1 file / 2 tests passed
- `npx vitest run tests/unit/official-forms/generateSupportProcedureExcel.spec.ts tests/unit/official-forms/generateSeikatsuKaigoExcel.spec.ts --reporter=verbose`
  - 2 files / 13 tests passed

## 方針判断

Phase 4 の月次支援実績フローでは、Excel 生成を追加しない。

分類:

- `Excel名称・出力形式契約の不一致`

非該当:

- `月次Excel生成の故障`
- `CSV出力の回帰`
- `Excel依存の欠落`

## 次PR候補

1. 契約文言の整合
   - 月次支援実績は CSV と明記
   - 公式帳票 Excel との境界を明記
   - 製品挙動は変更しない
2. 機械的 rename
   - `MonthlySummaryExcel` -> `MonthlySummaryCsv`
   - import / test 名のみ追従
   - Blob 形式、filename、CSV 列、UI 操作は変更しない
