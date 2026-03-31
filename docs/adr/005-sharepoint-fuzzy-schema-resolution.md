# ADR-005: Adopt Fuzzy Schema Resolution for SharePoint Internal Names

## 状態
承認済み (Proposed -> Accepted)

## 背景
SharePointの内部名は、列の削除と再作成、あるいは特定の文字の使用により、開発時の想定とは異なる名前に変更される（スキーマドリフト）。具体的には以下の事象が発生していた：
- 数値サフィックスの付与列 (`FullName0`, `FullName1`)
- ODataエンコード列 (`Usage_x0020_Status`)
- 大文字小文字の不一致 (`severeFlag` vs `SevereFlag`)

## 問題
従来の「厳密一致」ベースのフィールド解決では、上記のような揺れが発生した瞬間に OData クエリ ($select) が 400 Bad Request を返し、リポジトリが Demo データへフォールバックしたり、データの同期が停止したりする。

## 決定
`resolveInternalNamesDetailed` による**動的・曖昧フィールド解決（Fuzzy Resolution）**を全面的に採用する。
- Case-insensitive な一致確認。
- スペースエンコード (`_x0020_`) の自動吸収。
- 数値サフィックスの自動探索。
- 解決した「実際の名（Actual Name）」を用いて `$select` クエリを再構築し、Repository マッピングに使用する。

## トレードオフ
- **メリット**: スキーマの微細な変化に対してシステムが「停止しない（Resilient）」状態を維持できる。
- **デメリット**: 物理的な列名の不一致を許容するため、SharePoint側で「古い列が残っているが、意図しない新しいサフィックス列が参照される」といった意図しない紐付けのリスクがゼロではない。

## 影響範囲
- `IDataProvider` および `spProvisioningCoordinator` を利用する全ドメイン。
