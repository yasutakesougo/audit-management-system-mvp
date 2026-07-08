# ExcelJS export-route validation (residual risk inventory)

最終確認日: 2026-07-08

## 1. 監査コマンド
- `npm ls xlsx --depth=0`
  - 結果: `(empty)`
- `npm ls exceljs --depth=0`
  - 結果: `exceljs@4.4.0`
- `npm ls xlsx --json --depth=0 > $TEMP\npm-ls-xlsx.json`
- `npm ls exceljs --json --depth=0 > $TEMP\npm-ls-exceljs.json`

## 2. `rg` 検出（`src` / `docs`）
再検索 `rg -n "\bxlsx\b" src docs` で確認:

- 直接 `import ... from 'xlsx'` は未確認
- `exceljs` API 利用:
  - `src/lib/reports/xlsxUtils.ts` (`workbook.xlsx.load`, `workbook.xlsx.writeBuffer`)
  - `src/features/official-forms/generateSupportProcedureExcel.ts` (`wb.xlsx.*`)
  - `src/features/official-forms/generateSeikatsuKaigoExcel.ts` (`wb.xlsx.*`)
- 文字列表現としての拡張子・テンプレート参照:
  - `src/pages/TimeBasedSupportRecordPage.tsx` (`/templates/seikatsu_kaigo_template.xlsx`)
  - `docs/` とテスト群の `.xlsx` 記載（要件/仕様側）

## 3. 現時点の分類
- 直接 `xlsx` パッケージ依存: なし
- 残存経路: `exceljs` のみ
- 判定: **C（exceljs-only）**

## 4. PR 影響境界（本ドキュメント）
- docs-only で 1 ファイル更新（`docs/security/exceljs-export-route-validation.md`）
- `package.json` / `package-lock.json` は未更新
- app 実装は未更新

## 5. 次 PR 候補
1. exceljs 実装の安全性/影響範囲整理（`exceljs` 経路の個別検証）
2. `xlsx` 依存除去方針（必要なら `package`/`lockfile` を伴う別 PR）
3. `firebase` / `@blocknote` major lane は別 PR（今回対象外）
