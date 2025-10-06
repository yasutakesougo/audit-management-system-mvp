# Go-Live Playbook

本書は 運営指導・記録管理システム MVP を本番環境へ移行し、段階的に機能拡張していくための **プレイブック** です。  
人間とAIエージェントの協働を想定した構成になっています。

---

## 概要

### 目的
- MVP → 本番稼働への段階的移行手順を明確化
- 機能追加・改善時の標準フローを定義
- リスク最小化とロールバック手順の整備

### 対象読者
- 開発チーム（人間・AIエージェント）
- プロジェクトマネージャー
- 運用担当者

---

## フェーズ構成

### Phase 0: 準備（Pre Go-Live）
- [ ] 本番環境用 Azure AD アプリ登録完了
- [ ] SharePoint サイト作成 & 権限設定
- [ ] GitHub Secrets 設定（本番テナント用）
- [ ] Branch Protection 有効化（main）
- [ ] CI/CD パイプライン動作確認

### Phase 1: 初回デプロイ（Minimal Go-Live）
- [ ] `whatIf:true` で本番スキーマ適用シミュレーション
- [ ] WhatIf 結果レビュー → 承認取得
- [ ] `whatIf:false` で本番リスト作成
- [ ] アプリデプロイ（静的ホスティング or Azure Static Web Apps）
- [ ] スモークテスト実施（手動）
  - サインイン → 記録一覧表示 → 新規作成 → 監査ログ確認
- [ ] 初期ユーザー研修 & フィードバック収集

### Phase 2: 安定化（Stabilization）
- [ ] 監査ログ同期の定期実行確認（手動 or 自動化）
- [ ] エラーログ監視開始
- [ ] Coverage 閾値維持 (Lines >= 70%)
- [ ] 重要な回帰テスト追加（MSALログイン E2E など）
- [ ] Runbook による初動対応訓練（週次）

### Phase 3: 機能拡張（Feature Expansion）
- [ ] Backlog 項目の優先順位付け（S工数 → M工数）
- [ ] Issue テンプレート活用（📌 Backlog Task）
- [ ] 機能追加ごとに WhatIf レビュー実施
- [ ] Coverage 段階的引き上げ（5–10pt刻み）
- [ ] E2E テスト拡充（Playwright）

---

## 本番デプロイチェックリスト

### 事前確認
1. **環境変数**
   - [ ] `VITE_SP_RESOURCE` が本番テナント URL
   - [ ] `VITE_SP_SITE_RELATIVE` が正しいサイトパス
   - [ ] `VITE_MSAL_CLIENT_ID` / `VITE_MSAL_TENANT_ID` が本番 AD アプリ
2. **SharePoint 権限**
   - [ ] アプリ権限: `Sites.FullControl.All` + 管理者同意
   - [ ] サービスアカウント or ユーザー委任スコープ設定完了
3. **CI/CD**
   - [ ] GitHub Actions が本番 Secrets を参照
   - [ ] Branch Protection で Quality Gates 必須化
   - [ ] Provision WhatIf (PR) が schema 変更時に自動実行

### デプロイ手順
1. `provision/schema.xml` を最終確認
2. Actions → `Provision SharePoint Lists` → `whatIf:true` 実行
3. Artifacts から `provision-changes.json` をダウンロード
4. 変更内容をチームでレビュー → 承認
5. `whatIf:false` で本適用
6. Job Summary で `Created/Updated` を確認
7. フロントエンドをビルド & デプロイ
   ```bash
   npm run build
   # 静的ホスティングへアップロード or CI/CD 経由デプロイ
   ```
8. 本番環境でスモークテスト実施

### ロールバック手順
1. **スキーマ問題**
   - `provision/changes.json`（WhatIf実行時の保存分）を参照
   - 必要なら `*_v2` フィールドを元のフィールド名に戻す（手動 or 再スキーマ適用）
2. **アプリ問題**
   - 前回の安定バージョンへフロントエンド再デプロイ
   - Git タグ or コミット SHA を使用
3. **データ破壊**
   - SharePoint リストのバックアップ（手動エクスポート）から復元
   - `recreateExisting:true` 使用時は事前バックアップ必須

---

## 機能拡張フロー

### 1. タスク登録
- GitHub Issue で「📌 Backlog Task」テンプレートを使用
- 目的・受け入れ基準・工数を明記

### 2. 開発
- Feature ブランチ作成（例: `feature/msal-e2e-smoke`）
- テスト駆動開発（TDD）推奨
- Coverage 閾値維持を確認

### 3. レビュー
- Pull Request 作成
- CI チェック（Quality Gates, Provision WhatIf）が緑
- コードレビュー & 承認

### 4. マージ & デプロイ
- main マージ後、自動デプロイ or 手動トリガー
- 本番スモークテスト実施

### 5. モニタリング
- 初動対応ガイド（`docs/runbook.md`）参照
- エラー発生時は Runbook のフローチャートで切り分け

---

## リスク管理

### 高リスク操作
| 操作 | リスク | 対策 |
|------|--------|------|
| `recreateExisting:true` | データ全消失 | 事前バックアップ必須 + 本番では原則禁止 |
| `forceTypeReplace:true` | 型変更失敗 | WhatIf で `*_v2` 作成を確認 + 段階適用 |
| 本番スキーマ直接変更 | 整合性崩壊 | 必ず `provision/schema.xml` 経由 + WhatIf レビュー |

### 定期レビュー項目
- **週次**: エラーログ確認 & Runbook ドリル
- **月次**: Coverage トレンド確認 & 閾値調整検討
- **四半期**: Branch Protection ルール見直し & 廃止ワークフロー整理

---

## トラブルシューティング

### 認証エラー（401/403）
1. Azure AD アプリの権限を確認
2. 管理者同意が付与されているか確認
3. トークンキャッシュをクリア（ブラウザ or LocalStorage）
4. 詳細は [`docs/runbook.md`](./runbook.md) 参照

### スロットリング（429）
1. Retry-After ヘッダーを尊重
2. バックオフ戦略の実装確認（`lib/sharepoint.ts`）
3. バッチサイズ調整検討

### スキーマ適用失敗
1. `provision/changes.json` で差分確認
2. `ValidateSchema` エラーメッセージを確認
3. Choice フィールドの値不整合を解消
4. 必要なら段階的に適用（リスト単位で分割）

---

## AI エージェント協働ガイド

### エージェントへの指示例
```markdown
## Task: MSAL E2E スモークテスト追加

### Context
- Backlog Issue #XX を参照
- Playwright で signIn → /me 表示 → signOut を自動化
- CI で実行可能にする

### Acceptance Criteria
- [ ] `tests/e2e/msal-smoke.spec.ts` 作成
- [ ] CI ワークフロー（`.github/workflows/e2e.yml`）に統合
- [ ] README に手順追記

### Constraints
- 既存テストを破壊しない
- Coverage 閾値を維持
- テスト実行時間 < 2分
```

### エージェント作業後の確認
- [ ] CI が緑
- [ ] 変更差分が最小限
- [ ] ドキュメント更新済み
- [ ] テストが安定して通る（3連続成功）

---

## 参考ドキュメント

- [SharePoint Provisioning Guide](./provisioning.md)
- [運用 Runbook](./runbook.md)
- [Branch Protection Configuration](../BRANCH_PROTECTION.md)
- [Backlog 候補](../Backlog.md)

---

## バージョン履歴

| 日付 | 変更内容 | 担当 |
|------|----------|------|
| 2025-10-06 | 初版作成 | AI エージェント |

---

最終更新: 2025-10-06
