## PRタイトル

`feat(iceberg): planningSheetId を PDCA 永続化・導線まで貫通し、差分監査ドキュメントを追加`

## PR要約

`planningSheetId` を「任意情報」から、通せる経路では確実に伝播する**リンク契約**へ引き上げました。  
あわせて `Iceberg_Analysis` / `Iceberg_PDCA` の実フィールド差分および欠落監査を文書化しています。

This change is backward-compatible and does not break existing records without PlanningSheetId.

## 変更内容

### 契約・フィールド

- `Iceberg_PDCA` の field map に `planningSheetId` を追加
- SharePoint 内部名の候補解決（drift 吸収）を実装

### 永続化（Repository）

- `SharePointPdcaRepository`
  - read / write / filter を `planningSheetId` 対応
  - 列未存在時は fail-open で安全動作
- `InMemoryPdcaRepository` も同仕様に統一

### クエリ・キャッシュ

- `useIcebergPdcaList`
- mutation invalidation key

`planningSheetId` 軸での分離に対応

### 画面導線

- `IcebergPdcaPage`
  - URL (`planningSheetId`) → list/create/update に伝播
- `support-planning` → `iceberg-pdca`
  - 遷移 URL に `planningSheetId` を付与

### ストア

- `icebergStore`
  - snapshot 保存/復元で `planningSheetId` を保持

### プロビジョニング

- `spListRegistry`
  - `iceberg_pdca` に `PlanningSheetId` 列を追加

### ドキュメント

- `docs/architecture/iceberg-field-diff-and-planning-link-audit.md`
  - フィールド差分
  - 欠落監査
  - 対応方針

## 検証

- `inMemoryPdcaRepository` テスト ✅
- `SharePointIcebergRepository` テスト ✅
- `navigationLinks` テスト ✅
- `typecheck` ✅

## 既知の制約 / 次フェーズ

- `Iceberg -> Intervention` 変換契約に `planningSheetId` が未露出
- Planning 作成後の Iceberg snapshot への逆リンク patch は未実装
