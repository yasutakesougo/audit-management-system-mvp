# ExcelJS-only xlsx export path inventory (2026-07-08)

## 背景

pm audit --omit=dev の対象整理後、再調査した結果、
ランタイム依存としては xlsx パッケージは直接依存から外れており、
xceljs 経路のみが残存しています。

## 監査コマンド結果

- 
pm ls xlsx --depth=0
  - 結果: -- (empty)
- 
pm ls exceljs --depth=0
  - 結果: xceljs@4.4.0
- 保存ログ: 
  - %TEMP%\npm-ls-xlsx.json
  - %TEMP%\npm-ls-exceljs.json

## 検出した .xlsx トレース

### 実装経路
- src/features/reports/monthly/MonthlySummaryExcel.ts
  - wb.xlsx.load(...)
  - wb.xlsx.writeBuffer()
  - Worksheet / ow / cell 周辺の ExcelJS API 利用
- src/features/reports/__tests__/MonthlySummaryExcel.spec.ts
  - wb.xlsx.load(...) によるテスト検証

### 文字列表現・拡張子
- 文書内・テスト内の .xlsx 文字列/文言（ファイル名・説明文）
  - docs: docs/security/xlsx-remaining-usage-inventory.md など

## 分類（現時点）

- 直接 xlsx パッケージ利用: なし
- 残存経路: xceljs のみ
- 判定: C（exceljs 経路のみ残存）

## 対応分離方針

- 本PRの対象は棚卸し固定とし、実装変更は行わない。
- 残存 xceljs の利用経路を確認し、次 PR で下記を検討する。

### 次 PR 候補（分離）

1. **exceljs 実装の安全性確認 PR**
   - MonthlySummaryExcel.ts の xceljs 経路を再レビューし、
     セキュリティ観点・性能観点の追加対策を検討
2. **xlsx 依存除去（package lock 追加含む）PR**
   - xlsx を直接更新する PR とは独立
3. **firebase / @blocknote 対応 PR**
   - 本件外の依存更新レーンとして維持

## 補足

- package.json / package-lock.json は未更新
- app 実装（src）は未更新
- docs-only の棚卸し PR として扱う