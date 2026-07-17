# Phase 4 月次CSV出力契約

更新日: 2026-07-14

## 結論

Phase 4 の月次支援実績フローにおける出力契約は CSV である。

- 実出力: CSV
- UI契約: CSV
- unit契約: CSV
- `.xlsx` 生成: なし
- 公式帳票系の Excel 出力: 別機能として存在

## 根拠

- `src/features/reports/monthly/MonthlySummaryExcel.ts`
  - `text/csv;charset=utf-8` の Blob を生成する
  - `利用実績月次サマリ_<YYYY-MM>.csv` を download filename にする
- `src/features/reports/__tests__/MonthlySummaryExcel.spec.ts`
  - `.csv` filename を期待する
- `src/features/users/UsersPanel/UsersMenu.tsx`
  - UI は `利用実績月次サマリ (CSV) 出力` と表示する
- `src/features/official-forms/*Excel.ts`
  - 公式帳票系は `exceljs` を使う実 `.xlsx` 出力として月次 CSV とは分離する

## 分類

分類:

- `Excel名称・出力形式契約の不一致`

非該当:

- `月次Excel生成の故障`
- `CSV出力の回帰`
- `Excel依存の欠落`

## 次の分離

`MonthlySummaryExcel` は歴史的な module 名であり、実出力契約とは一致していない。

この rename は別PRで機械的に行う。

- `MonthlySummaryExcel` -> `MonthlySummaryCsv`
- 挙動変更なし
- import / test 名のみ追従
