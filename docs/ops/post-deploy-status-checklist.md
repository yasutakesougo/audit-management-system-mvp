# デプロイ後 `/admin/status` 点検チェックリスト

## 目的

SharePoint 列名 drift、認証、proxy、List 接続の問題をデプロイ直後に検知する。大きな PR、環境変数変更、SharePoint 列追加、権限変更の後は必ず確認する。

## 実施タイミング

- 本番デプロイ直後
- SharePoint の列・List・権限を変更した後
- 認証設定または proxy 設定を変更した後
- 週1回の定例点検

## 入口

- 管理者権限で `/admin/status` を開く。
- 可能なら Chrome のハードリロード後に確認する。
- FAIL/WARN の件数と、前回から増えた項目を記録する。

## 必須確認

| ID | 項目 | 期待 | 結果 |
| --- | --- | --- | --- |
| S1 | Summary | FAIL が 0 | [ ] OK / [ ] NG |
| S2 | Summary | WARN が 0、または既知の許容理由がある | [ ] OK / [ ] NG |
| S3 | Users_Master | 接続・必須列が正常 | [ ] OK / [ ] NG |
| S4 | ToiletRecords | 接続・必須列が正常 | [ ] OK / [ ] NG |
| S5 | BillingOrders | BillingOrders 関連の WARN/FAIL がない | [ ] OK / [ ] NG |
| S6 | SupportProcedureRecord_Daily | 接続・必須列が正常 | [ ] OK / [ ] NG |
| S7 | SharePoint proxy | proxy 経由の API が失敗していない | [ ] OK / [ ] NG |
| S8 | 認証状態 | MSAL / token / account 状態が正常 | [ ] OK / [ ] NG |

## BillingOrders 補足

BillingOrders は `/sites/2` の List3 を使うため、通常の `/sites/welfare` 診断とは扱いが異なる。環境変数は以下を確認する。

```env
VITE_SP_SITE_RELATIVE=/sites/welfare
VITE_SP_LIST_BILLING_ORDERS_SITE_RELATIVE=/sites/2
VITE_SP_LIST_BILLING_ORDERS=c4be5492-9803-4fc6-ac7e-82d10e95ff6d
```

詳細は [billing-list3-live-verification.md](./billing-list3-live-verification.md) を参照する。

## 記録テンプレート

```text
日時:
確認者:
デプロイ/PR:
環境:

FAIL:
WARN:

Users_Master:
ToiletRecords:
BillingOrders:
SupportProcedureRecord_Daily:
SharePoint proxy:
認証状態:

対応が必要な項目:
```

## 判定

Ready:
- FAIL が 0
- WARN が 0、または既知の許容理由と対応予定が記録されている
- BillingOrders, Users_Master, ToiletRecords, SupportProcedureRecord_Daily がすべて確認済み

Stop:
- FAIL が 1件以上ある
- BillingOrders の精算状態永続化に関わる WARN/FAIL がある
- 認証または proxy が不安定
- List 接続が失敗し、現場画面で「対象者なし」と誤認される可能性がある
