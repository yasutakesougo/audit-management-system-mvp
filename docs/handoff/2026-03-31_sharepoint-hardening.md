# Handoff: SharePoint Pipeline Hardening — 2026-03-31

## 完了したこと
- SharePoint実データ接続の復旧（Users/Schedules/Daily）
- スキーマドリフトを完全に吸収するFuzzy解決の実装
- Bootstrap時の認証負荷緩和（50/secへの暫定拡張）

## 将来的な硬化ステップ
今回の対応で復旧しましたが、更なる安定化のために以下を検討してください。
- **並列制御の導入**: 認証レート制限を広げるのではなく、`spFetch` 層で同時実行数を絞る。
- **列数制限への抜本対策**: 500エラーが出ている `Results` 等のリストは、列削除ではなく「新規リストへの正規化」を検討する。

## 参照ADR
- [ADR-005: Adopt Fuzzy Schema Resolution for SharePoint Internal Names](../adr/005-sharepoint-fuzzy-schema-resolution.md)
