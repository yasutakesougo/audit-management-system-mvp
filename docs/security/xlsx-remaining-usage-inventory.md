# xlsx 残存利用棚卸し（`#2364` 後）

更新日: 2026-07-08

## 固定条件

- 基準: `main`（最新 origin/main）を起点
- 本PR: docs-only / 実装変更なし / lockfile 更新なし
- 方針: `xlsx` の残存利用箇所を固定し、次PR候補へ分離
- 監査証跡:
  - `npm ls xlsx --depth=0`
  - `npm ls xlsx --json --depth=0 > %TEMP%\\npm-ls-xlsx.json`
  - `rg -n "xlsx" src docs`

## 監査結果（`xlsx` 直接依存）

`npm ls xlsx --depth=0` の結果:

- `xlsx@0.18.5` が直近production依存として存在
- `npm ls xlsx --json --depth=0` は `package.json`/`package-lock.json` の依存関係として `xlsx` を記録

## 残存利用パス（現時点）

### A. xlsx モジュールを直接 import する実装

- `src/lib/reports/xlsxUtils.ts`
  - `import * as XLSX from 'xlsx';`
  - `XLSX.writeFile(..., \`<fileName>.xlsx\`)` で書き出し
- 補足:
  - 本時点で `src/lib/reports/xlsxUtils.ts` の参照は `rg -n "xlsxUtils|MonthlySummaryExcel" src` では未検出（未参照候補）
  - 参照状態は次PRで要精査（削除・代替・整理）

### B. `xlsx` 文字列を扱うが `exceljs` ベースの実装（`xlsx` 依存とは別）

- `src/features/official-forms/generateSupportProcedureExcel.ts`
  - `import ExcelJS from 'exceljs';`
  - `wb.xlsx.load(...)`, `wb.xlsx.writeBuffer()`, 出力名 `.xlsx`
- `src/features/official-forms/generateSeikatsuKaigoExcel.ts`
  - `import ExcelJS from 'exceljs';`
  - `wb.xlsx.load(...)`, `wb.xlsx.writeBuffer()`, 出力名 `.xlsx`
- `src/features/support-plan-guide/utils/excelAdapter.ts`
  - `filename: ... .xlsx`

### C. テンプレート/API 周辺の `.xlsx` 文字列

- `src/features/official-forms/useGenerateOfficialForm.ts`
  - `/templates/seikatsu_kaigo_template.xlsx` を fetch
- `src/pages/TimeBasedSupportRecordPage.tsx`
  - `/templates/seikatsu_kaigo_template.xlsx` を fetch
- `src/features/official-forms/__tests__/uploadToSharePoint.spec.ts`
  - SharePoint upload API の `.xlsx` ファイル名テスト

## 分類

- `xlsx` 依存そのものの実コード起点: **A（直接依存）**
- `exceljs` 経由（`xlsx` 形式として出力）は **B（別依存経路）**
- 文字列上の `.xlsx` 命名/テンプレート参照は **C（形式要件・仕様側）**

## 次PR候補（分離）

1. `src/lib/reports/xlsxUtils.ts` の参照有無を確定し、`xlsx` 依存削除を狙う
   - 方針例: 依存未参照であれば削除候補として優先整理
2. 月次以外の公式帳票系（`exceljs`）の形式要件を再確認
   - 置換、CSV/CSV+ZIP、または backend 生成検討
3. `template.xlsx` 系の入出力 API と拡張子要件を別レイヤで分離定義

## スコープ固定（今回の棚卸しPR）

- `docs/security/xlsx-remaining-usage-inventory.md` のみ変更
- `package.json` / `package-lock.json` 変更なし
- app code 実装差分なし
- firebase / `@blocknote` / lockfile 対応は別PR
