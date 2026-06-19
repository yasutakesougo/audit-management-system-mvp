# SharePoint field mapping notes

## 対象
- `SupportCase` 系と `Staff/User` 系を中心に、内部名と表示名の差異が drift 判定に与える影響を整理
- 根拠ソース: 既存のフィールド定義ファイル、診断/比較ロジック、既存テスト

## 1. InternalName / DisplayName の現状

### 設計上の前提
- SharePoint 比較は「表示名の完全一致」を基本前提にしない
- 利用箇所では `fieldTitleMap` や内部名補助関数を経由して比較するケースがあり、両者がズレると一致しない前提で耐性を持たせる必要がある
- `buildListSpecs` の後段で `Title/Id` が追加されるため、定義側と API 側のキー解像度差を吸収

### 典型的な揺れ
- `support_case_*` 系の関連リスト:
  - `support_cases` と `support_case_documents/support_case_events` の関連キーが UI 名称で確認されがちで、内部参照は ID 系の不一致が起きやすい
- `staff_master` / `users_master` 系:
- ユーザーの識別キー（`Id` 系）と名称表示（`Title` 系）が非対称なリクエストで混在

## 2. ファイル別マッピング参照

### `src/sharepoint/fields/fieldUtils.ts`
- `getFieldInternalName` / `normalize` 系を通じ、UI 名から内部名へ寄せる変換責務
- ここで解決されない場合、drift 比較で誤検知/未検知が増える

### `src/sharepoint/fields/staffFields.ts`
- スタッフ系・ユーザー系の共通フィールドを定義
- `Id` 系との比較が必要な箇所はここを通して `listSpecs` で参照される想定

### `src/sharepoint/fields/supportCaseFields.ts`
- サポートケース関連のフィールド定義
- 主要イベント/ドキュメントを含む関連取得で、`expand` 対象の識別子とフィールド指定が一致しない場合、drift レベル差分に影響

### `src/sharepoint/query/builders.ts` / `src/lib/sp/spListRead.ts`
- OData クエリ生成は内部名依存。display name へ展開してから送る場合の解像度差はここで検知が必要

## 3. 今回確認した不一致リスク
- 重大:
  - display name と internal name が混在したまま query/select/filter に渡される
  - `support_case` 関連で関連先キー混在
- 中:
  - `Title` 補完の既定動作を前提にしたまま、カスタム表示名を追加した場合
- 低:
  - docs 側コメント/現状の実装説明の不一致（例: 対象リスト数の説明）

## 4. 追跡すべき恒久チェック項目（docs + test連動）
- `Field mapping` を list/field 単位で固定表として管理
- listSpec と実装 field list の差分検知を単体テスト化
- `buildListCheckPath` の title/guid 変換と list-specific field 変換との整合確認
- `Id` と `Title` の自動付与対象から外すことがないかを監査

## 5. 追加調査が必要なリスト（人間レビュー推奨）
- `support_case_documents`, `support_case_events` の関連キー
- `billing_orders`（site 依存分岐）
- `diagnostics_reports`, `drift_events_log`（運用ログ性質のため表示名差分の検知対象要否）

