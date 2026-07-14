# Phase 4 Monthly Records / Billing Order Flow Boundary

> Status: fixed as Phase 4 audit flow correction
> Evidence HEAD: `d494e7bdec51e8a7e0d8ffa779e732515b32a3ab`
> Related fix: #2439 (`57b1c9e8b80e73335a71e64ded896376d6482d4a`)

## 判定

Phase 4 の監査対象フローは、現行仕様では単一の縦断フローではなく、次の独立した 2 系統として扱う。

```text
支援実績:
出欠
-> 日次支援実績
-> 月次集計
-> 利用者別詳細

請求注文:
BillingOrders/List3
-> 請求集計
-> 請求CSV
```

`MonthlyRecord_Summary` から `BillingOrders/List3` / `BillingOrder` への明示的な変換契約は、最新 main の read-only 再実証では確認できなかった。そのため、月次支援実績の件数と請求注文の件数・金額を一致させるテストは、現行仕様を根拠に作らない。

## データ起点

| 系統 | 起点 | 主な確認対象 | 出力 |
| --- | --- | --- | --- |
| 支援実績 | 出欠、日次支援実績、`MonthlyRecord_Summary` | `userId`、対象月、日次件数、月次一覧、利用者別詳細 | 月次画面、利用者別詳細 |
| 請求注文 | `BillingOrders/List3` | `ordererCode`、`orderDate`、`orderCount`、`drinkPrice`、`served`、`totalCount`、`totalAmount` | 請求画面、請求CSV |

`MonthlyRecord_Summary` の列定義は月次支援実績側の SharePoint drift 対応であり、`BillingOrders/List3` の注文データ変換ではない。

## 出力の扱い

- CSV: 請求注文系の実出力として扱う。対象月、注文者、件数、金額を `BillingOrders/List3` 起点で追跡する。
- Excel: `src/features/reports/monthly/MonthlySummaryExcel.ts` は現状 `.xlsx` ではなく CSV を生成する。名称と実出力形式の不一致は別課題として扱う。
- PDF: 月次PDFは開発中/モック扱いで、現時点では実生成PDFの本文照合対象外とする。

## 分断分類

```text
分類:
監査対象フロー定義の誤り

根拠:
独立ドメイン間に存在しない縦断接続を監査対象としていた。

対応:
実装修正ではなく、監査フロー定義を補正する。
```

## read-only 再実証

- 請求認可: 3 passed
- 月次サマリー / 利用者別詳細: 19 passed
- 請求集計 / CSV unit: 8 files / 54 tests passed
- MonthlySummaryExcel / kokuhoren CSV unit: 2 files / 9 tests passed
- 月次PDF / PDF認可 E2E: 13 passed
- 出欠入口 / 月次認可: 5 passed

## 次の扱い

1. 支援実績系と請求注文系を別々に完了判定する。
2. Excel の名称と出力形式の不一致を独立評価する。
3. PDF の出力契約を仕様課題として独立管理する。
4. 月次実績と請求注文を接続する場合は、`userId -> ordererCode`、対象月範囲、件数、金額の変換契約を先に定義する。
