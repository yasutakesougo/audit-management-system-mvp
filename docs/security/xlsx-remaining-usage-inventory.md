# xlsx 残存利用棚卸し

更新日: 2026-07-14

## 固定条件

- 基準: 最新 `origin/main`
- 本PR: docs / comment の契約整合のみ
- 変更しない: package / lockfile / app code の出力挙動
- 監査証跡:
  - `npm ls xlsx --depth=0`
  - `npm ls exceljs --depth=0`
  - `rg -n "xlsx|MonthlySummaryExcel|Excel" src docs`

## 監査結果

`npm ls xlsx --depth=0` の結果:

- direct dependency なし

`npm ls exceljs --depth=0` の結果:

- `exceljs@4.4.0`

## 残存利用パス

### A. 月次サマリ出力

- `src/features/reports/monthly/MonthlySummaryExcel.ts`
  - 歴史的に `Excel` を含む module 名だが、実出力は CSV
  - Blob type は `text/csv;charset=utf-8`
  - download filename は `利用実績月次サマリ_<YYYY-MM>.csv`
- `src/features/users/UsersPanel/UsersMenu.tsx`
  - UI は `利用実績月次サマリ (CSV) 出力`

### B. 公式帳票 Excel 出力

- `src/features/official-forms/generateSupportProcedureExcel.ts`
  - `exceljs` で `.xlsx` を生成する
- `src/features/official-forms/generateSeikatsuKaigoExcel.ts`
  - `exceljs` で `.xlsx` を生成する

### C. テンプレート/API 周辺の `.xlsx` 文字列

- `src/features/official-forms/useGenerateOfficialForm.ts`
  - `/templates/seikatsu_kaigo_template.xlsx` を fetch
- `src/pages/TimeBasedSupportRecordPage.tsx`
  - `/templates/seikatsu_kaigo_template.xlsx` を fetch
- `src/features/official-forms/__tests__/uploadToSharePoint.spec.ts`
  - SharePoint upload API の `.xlsx` ファイル名テスト

## 分類

- 月次支援実績フロー: **CSV 出力**
- 公式帳票フロー: **ExcelJS による `.xlsx` 出力**
- `xlsx` package direct dependency: **なし**
- 残課題: `MonthlySummaryExcel` の歴史的 module 名が CSV 契約と一致していない

## 次PR候補

1. 契約文言の整合
   - 月次支援実績は CSV と明記
   - 公式帳票 Excel との境界を明記
   - 製品挙動は変更しない
2. 機械的 rename
   - `MonthlySummaryExcel` -> `MonthlySummaryCsv`
   - import / test 名のみ追従
   - CSV 列、Blob type、filename、UI 操作は変更しない
