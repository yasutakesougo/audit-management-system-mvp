# /billing 1週間安定化・受け入れ確認スプリント

## 目的

`/billing` を試験運用から現場運用へ近づけるため、1週間は大きな機能追加を止め、導線・集計・精算状態の永続化・診断結果だけを確認する。

既存の SharePoint 接続・List3 列確認は [billing-list3-live-verification.md](./billing-list3-live-verification.md) を参照する。

## 期間

- 推奨期間: 連続する営業日 5日から7日
- 対象画面: `/billing`, `/kiosk`, `/admin/status`
- 対象ロール: viewer, reception, admin
- 原則: 期間中は新機能追加を止め、問題点は小さな修正 PR に限定する

## 受け入れ条件

| ID | 条件 | 判定 |
| --- | --- | --- |
| A1 | 一般スタッフ権限で `/billing` が開ける | [ ] Pass / [ ] Fail |
| A2 | キオスクフッター「コーヒー精算」から `/billing` へ自然に遷移できる | [ ] Pass / [ ] Fail |
| A3 | 対象月の提供数・合計金額が現場記録と一致する | [ ] Pass / [ ] Fail |
| A4 | 印刷が使える | [ ] Pass / [ ] Fail |
| A5 | CSV出力が使える | [ ] Pass / [ ] Fail |
| A6 | 精算状態を変更後、再読み込みしても状態が復元される | [ ] Pass / [ ] Fail |
| A7 | `/admin/status` で BillingOrders 関連の WARN/FAIL がない、または既知の許容理由が記録されている | [ ] Pass / [ ] Fail |

## 初日チェック

| 項目 | 確認方法 | 結果 |
| --- | --- | --- |
| viewer 直アクセス | viewer で `/billing` を直接開く | [ ] OK / [ ] NG |
| キオスク導線 | `/kiosk` 下部ナビの「コーヒー精算」を押す | [ ] OK / [ ] NG |
| 対象月選択 | 当月または実データがある月を選ぶ | [ ] OK / [ ] NG |
| 月次集計 | 注文履歴・紙記録・現金表と突合する | [ ] OK / [ ] NG |
| 精算トグル | 1名だけ精算済みにし、再読み込みする | [ ] OK / [ ] NG |
| 逆操作 | 同じ1名を未精算に戻し、再読み込みする | [ ] OK / [ ] NG |
| CSV | CSVを出力し、対象月・金額・精算状況を確認する | [ ] OK / [ ] NG |
| 印刷 | 印刷プレビューで表が崩れないか確認する | [ ] OK / [ ] NG |
| 診断 | `/admin/status` の WARN/FAIL を記録する | [ ] OK / [ ] NG |

## 日次チェック

| 日付 | 確認者 | 対象月 | 集計一致 | 精算復元 | CSV | 印刷 | `/admin/status` | メモ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Day 1 |  |  | [ ] | [ ] | [ ] | [ ] | FAIL: / WARN: |  |
| Day 2 |  |  | [ ] | [ ] | [ ] | [ ] | FAIL: / WARN: |  |
| Day 3 |  |  | [ ] | [ ] | [ ] | [ ] | FAIL: / WARN: |  |
| Day 4 |  |  | [ ] | [ ] | [ ] | [ ] | FAIL: / WARN: |  |
| Day 5 |  |  | [ ] | [ ] | [ ] | [ ] | FAIL: / WARN: |  |
| Day 6 |  |  | [ ] | [ ] | [ ] | [ ] | FAIL: / WARN: |  |
| Day 7 |  |  | [ ] | [ ] | [ ] | [ ] | FAIL: / WARN: |  |

## 問題記録テンプレート

```text
日付:
確認者:
画面:
ロール:
対象月:

事象:
期待:
実際:
再現手順:
影響範囲:
一時対応:
スクリーンショット:
関連PR/Issue:
```

## Go / No-Go 判定

Ready:
- 受け入れ条件 A1 から A7 がすべて Pass
- 集計不一致がない
- 精算状態の再読み込み復元が連続して確認できている
- `/admin/status` の BillingOrders 関連 WARN/FAIL が 0、または既知の許容理由が記録されている

Needs Fix:
- 一般スタッフが `/billing` を開けない
- キオスク導線から到達できない
- 月次集計または精算状態が再読み込み後に崩れる
- CSV/印刷が現場運用で使えない
- BillingOrders の WARN/FAIL が未整理
