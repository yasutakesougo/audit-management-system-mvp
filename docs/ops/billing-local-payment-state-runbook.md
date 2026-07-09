# Billing Local Payment State Runbook

## 目的

請求画面の端末内一時状態 `app:billing:payment_states` の扱いを、削除前に確認できるようにするための運用メモです。

このキーは、SharePoint の精算状態列 `PaymentStatus` が解決できない場合に使われていた LocalStorage fallback です。現在の方針では、`PaymentStatus` が解決できる環境では SharePoint 側を正本として扱い、端末内一時状態を正式な精算状態として扱いません。

## 対象キー

- `app:billing:payment_states`

## 現在の扱い

- `PaymentStatus` が解決できる環境では、SharePoint の `PaymentStatus` を正本として表示します。
- `PaymentStatus` が解決できる環境では、新規の LocalStorage 保存は行いません。
- 既存端末に残っている `app:billing:payment_states` は、互換確認のため読み取り自体は残しています。
- `PaymentStatus` が解決できない環境では、既存 LocalStorage 値が表示や CSV の精算状態に影響する可能性があります。
- 自動削除、削除ボタン、読み取り停止はまだ行いません。

## 画面での見え方

請求画面は、`app:billing:payment_states` に既存値が残っている場合だけ注意を表示します。

- `PaymentStatus` 解決済み: 端末内の過去一時状態が残っていても、現在は SharePoint の精算状態を正本として表示していることを表示します。
- `PaymentStatus` 未解決: 端末内の一時状態が表示や CSV に影響する可能性があることを表示します。

## 手動確認方法

ブラウザの開発者ツール Console で確認します。

```js
localStorage.getItem('app:billing:payment_states')
```

件数の目安を確認する場合:

```js
Object.keys(JSON.parse(localStorage.getItem('app:billing:payment_states') || '{}')).length
```

内容を確認する場合:

```js
JSON.parse(localStorage.getItem('app:billing:payment_states') || '{}')
```

## 削除判断の前提

削除は、少なくとも以下を確認してから行います。

- 本番または検証の請求画面で `PaymentStatus` が解決済みである。
- `PaymentStatus`, `PaidAt`, `PaidBy` が対象 SharePoint リストに存在する。
- 請求担当が端末内一時状態を現行の精算確認に使っていない。
- CSV の精算状況を LocalStorage fallback 由来で運用していない。
- 複数端末で SharePoint 側の精算状態が一致している。

## 削除してはいけないタイミング

- `isPersistenceMissing=true` の警告が出ている。
- diagnostics で `env_fallback_list3`, `field_resolution_error`, `missing_payment_status` が出ている。
- 現場が端末内一時状態を使って精算確認している可能性が残っている。
- SharePoint の接続先、list id、siteRelative が確認できていない。
- 削除後の問い合わせ先と復旧手順が決まっていない。

## 手動削除コマンド

削除判断が完了した端末でのみ実行します。

```js
localStorage.removeItem('app:billing:payment_states')
```

削除後は請求画面を再読み込みし、端末内一時状態の注意表示が消えること、SharePoint の `PaymentStatus` に基づく精算状態が表示されることを確認します。

## 後続PR候補

1. `isPersistenceMissing=true` 時の新規 LocalStorage 保存停止
2. 既存 LocalStorage 値の削除手順の現場展開
3. LocalStorage 読み取り停止
4. `app:billing:payment_states` 関連コード削除
