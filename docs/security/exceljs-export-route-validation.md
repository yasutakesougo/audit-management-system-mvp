# ExcelJS export routes validation (post #2364)

## Scope
- docs-only
- `#2364` の `xlsx` 置換・使用縮小後、`xlsx` 残存経路を再棚卸し
- `xlsx` 依存が production から除去され、`exceljs` 経路のみが残ることを固定

## 確認コマンド（実行時刻: 2026-07-08）

```bash
rg -n "\bxlsx\b" src docs
npm ls xlsx --depth=0
npm ls exceljs --depth=0
```

### 実行結果

- `rg -n "\bxlsx\b" src docs`
  - `src` 側: `wb.xlsx.load(...)`, `wb.xlsx.writeBuffer()`, テンプレート/出力名 `.xlsx`
  - `src` 側に `from 'xlsx'` の直接 import は確認されず
  - `exceljs` ベースの経路が主
  - `docs` 側: 仕様・ガイド上の `.xlsx` 記載あり（実コード依存とは分離）
- `npm ls xlsx --depth=0`
  - `-- (empty)`（production 依存なし）
- `npm ls exceljs --depth=0`
  - `-- exceljs@4.4.0`

## 分類

- 方針: **C（exceljs 経路のみ残存）**
- `xlsx` package 削除・更新や major updateは本PR対象外
- `exceljs` の出力・読み込みルート（`generateSupportProcedureExcel`, `generateSeikatsuKaigoExcel`, `xlsxUtils` 等）の妥当性を次PRで分離して検討

## リスク / 次アクション

1. `exceljs` ベースの月次・各種レポート生成のユースケース別レビュー
2. 既存の `.xlsx` 出力要件を維持しつつ、`xlsx` package 非依存の状態を維持できるかを確認
3. 必要なら `exceljs` 経路のテスト追加 or 改修を別PR化

## 別レーン（今回非対象）

- package.json / package-lock.json の更新
- `xlsx` 削除（runtime impact を伴うため別PR）
- `firebase` / `@blocknote` の major update 対応
- app 実装の大規模差し替え
