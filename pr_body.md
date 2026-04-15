# PR Draft: strengthen list failure observability and surface threshold guidance

## 概要

Schedules 本線におけるアイテム取得失敗が、SharePoint のリストビューしきい値（5000件制限）による HTTP 500 エラーであることを実機ログにて確認しました。
本 PR は、コード側での直接的なクエリ最適化を行う前に、まず運用側でのインデックス対応を確実にガイドできるよう、`DataProviderScheduleRepository` 周辺のエラーハンドリング観測性を強化するものです。

## 変更内容

1. **共通エラー拡張 (`src/lib/sp/helpers.ts`)**

   * `raiseHttpError` において、SharePoint 相関 ID (`sprequestguid`) をエラーオブジェクトに付与
   * これにより、必要な呼び出し元で調査用 ID をログに残せるようにします

2. **Schedules 観測性強化 (`src/features/schedules/infra/DataProviderScheduleRepository.ts`)**

   * `list()` および `resolveFields()` の失敗時に `status` と `sprequestguid` を明示的にログ出力
   * SharePoint のしきい値エラーを検知した場合、管理者向けアクション（`EventDate` などのインデックス化確認が必要であること）をメッセージに付加
   * locale 差を考慮し、日本語・英語どちらのしきい値メッセージでも判定できるようにする

## 運用側のアクション（管理者向け）

本 PR は観測性と運用誘導の強化であり、SharePoint 側の設定が未完了の場合はエラー自体は継続します。
以下の列について「インデックス付きの列」設定を確認してください。

* `EventDate`
* `EndDate`
* `cr014_dayKey`

## 後続の予定

* SharePoint 側でのインデックス対応後の挙動確認
* 必要に応じたクエリ最適化（例: 取得上限や取得戦略の見直し）の検討
* `DataProviderScheduleRepository.list()` 失敗時の観測性を他リポジトリにも横展開するかの判断
