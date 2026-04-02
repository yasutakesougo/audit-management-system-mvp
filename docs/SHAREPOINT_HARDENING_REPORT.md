# SharePoint Infrastructure Hardening Report

## 📖 概要
本タスクでは、SharePoint リストの「列増殖（Schema Drift）」を物理的に防止するガードレールの実装と、ドリフト状態でも業務継続（データの読み書き）を可能にする **Dynamic Schema Resolution** の全域適用を完了しました。

## 🎯 達成したゴール
1. **SSOT との一致**: `spListRegistry.ts` の定義に基づき、実機 SharePoint との同期・差分検知を強化。
2. **物理ガードレールの実装**: サフィックス付きの列（例: `FullName0`）が存在する場合、新たな列追加をスキップし、既存列を再利用するロジックを `spListSchema.ts` に実装。
3. **ドリフト検知ロジックの検証**: `resolveInternalNamesDetailed` の 100% カバレッジ・ユニットテスト（`drift.spec.ts`）をパス。
4. **レポジトリの硬化**: `ServiceProvisionRecords` レポジトリをリファクタリングし、ドリフトが発生していても自動的に物理名をマッピングして CRUD を完遂する仕組み（Dynamic Resolution）を導入。
5. **診断の高度化**: ヘルスチェック画面で「列不足（FAIL）」と「列ドリフト（WARN）」を明確に区別し、運用判断を容易に。

## 🛠 実装の技術的詳細

### 1. ドリフト検知 (Helpers)
`resolveInternalNamesDetailed` により、以下の解決順序を確立しました：
1. **完全一致**: 大小文字を無視して一致を確認。
2. **サフィックス解決**: `0` 〜 `9` の連番がついた物理列名を探索。
3. **エンコード解決**: スペースが `_x0020_` に置換されたパターンを探索。

### 2. 物理ガードレール (Schema)
`ensureListExists` 内でフィールド追加前にドリフトチェックを行い、既存の類似列がある場合は `addFieldToList` をバイパスします。これにより、SharePoint 上での列無制限増殖を物理的に遮断します。

### 3. 動的マッピング (Repository)
`DataProviderServiceProvisionRepository` は、実行時に `resolveFields()` を呼び出し、物理名をキャッシュします。これにより、コード上は `RecordDate` と記述していても、バックエンドでは `RecordDate0` に対してクエリを投げ、結果を表示します。

## 🧪 テスト結果
- `src/lib/sp/__tests__/drift.spec.ts`: **PASS**
- `src/features/service-provision/infra/__tests__/DataProviderServiceProvisionRepository.spec.ts`: **PASS**
- `npm run typecheck:full`: **GREEN**

## ⚠️ 運用上の注意点
- **ドリフトは「警告」**: アプリは正常に動きますが、SharePoint 上の列名が見苦しい場合は、手動で列の削除・再作成・リネームを行うことが可能です。その際は、アプリの「診断」画面で GREEN に戻ることを確認してください。
- **キャッシュ**: 解決結果は `sessionStorage` にキャッシュされます。物理変更を行った後は、ブラウザのリロードまたは `clearAllFieldsCache()` の実行が必要です。

---
**Status**: ✅ ALL GREEN (Production Ready)
