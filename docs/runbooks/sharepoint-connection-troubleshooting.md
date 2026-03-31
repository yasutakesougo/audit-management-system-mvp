# Runbook: SharePoint 接続障害対応ガイド (Ver 2026.03)

## 検知シグナル
| シグナル | 疑われる原因 |
|---|---|
| `Real repository missing, using Demo` | リスト実体不在、または全必須列の解決失敗 |
| `400 Bad Request` (on items request) | 未解決の内部名が $select に混入 |
| `sp:provision_failed` | 403権限不足、またはSharePoint側の物理リソース制限（500） |
| `Rate limit exceeded` (Auth) | Bootstrap 並列数が多すぎる、または通信遅延によるリトライ過多 |

## 対応手順
1. **コンソールログの確認**: `spProvisioningCoordinator` が出力する `Missing: [FieldNames]` を特定。
2. **内部名の確認**: SharePointのリスト設定画面等から、実際の物理名を確認。
3. **解決ロジックの確認**: `src/lib/sp/helpers.ts` の `resolveInternalNamesDetailed` のパターン（Suffix/Space）で吸収可能か判断。

## ❗ 禁止事項
- **SharePoint の内部名をコードに直接ハードコードしないこと**（例: `FullName`, `UsageStatus` など）。
- 必ず `resolveInternalNamesDetailed` を経由し、解決された `resolvedFields` を用いて `$select` やマッピングを行うこと。
