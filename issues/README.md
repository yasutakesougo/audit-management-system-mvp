# Roadmap Issues

このディレクトリには、Iceberg-PDCA プロジェクトの計画的なロードマップを Issue として文書化したファイルが含まれています。

## 概要

プロジェクトの品質向上と CI 強化のため、以下の 2 つのフェーズに分けてロードマップを実施します：

### Phase 1: Status Quo 短期レビュー整備（S 工数）

短期的に実装できる小規模なタスクで、最小限の工数で最大限の効果を目指します。

1. [001-msal-login-e2e-smoke.md](./001-msal-login-e2e-smoke.md) - MSAL ログイン E2E スモーク
2. [002-users-crud-smoke.md](./002-users-crud-smoke.md) - Users CRUD 基本回帰テスト
3. [003-a11y-unit-checks.md](./003-a11y-unit-checks.md) - a11y 自動チェック（jest-axe 単体導入）
4. [004-msal-env-guard.md](./004-msal-env-guard.md) - MSAL 設定健全性ガード（env schema）

### Phase 2: CI 強化（M 工数、基盤整備後）

Phase 1 の基盤の上に構築する、より包括的なテストとインフラ整備です。

5. [005-users-crud-integration.md](./005-users-crud-integration.md) - Users CRUD 統合テスト（4 ステップ網羅）
6. [006-a11y-ci-integration.md](./006-a11y-ci-integration.md) - a11y CI 統合（複合ページ）
7. [007-https-restoration.md](./007-https-restoration.md) - HTTPS 復帰（RSA + TLS1.2/1.3）

## 使い方

1. 各 Issue ファイルを GitHub Issues として作成する際は、ファイルの内容をそのままコピーして使用できます
2. GitHub の Issue テンプレート（`.github/ISSUE_TEMPLATE/backlog-task.md`）に準拠した構造になっています
3. 各 Issue は独立して実装可能ですが、Phase 2 の Issue は Phase 1 の完了を前提としています

## 実装優先度

**Phase 1（短期）を優先実施:**
- すべて S 工数
- 4 つの Issue を順次実装
- CI の基礎固めと品質保証の自動化

**Phase 2（中期）は Phase 1 完了後:**
- すべて M 工数
- より包括的なテストとインフラ整備
- Phase 1 の基盤の上に構築

## 関連ドキュメント

- [Backlog.md](../Backlog.md) - 全体のバックログと候補タスク
- [.github/ISSUE_TEMPLATE/backlog-task.md](../.github/ISSUE_TEMPLATE/backlog-task.md) - Issue テンプレート
- [docs/E2E_TEST_STRATEGY.md](../docs/E2E_TEST_STRATEGY.md) - E2E テスト戦略
- [docs/E2E_BEST_PRACTICES.md](../docs/E2E_BEST_PRACTICES.md) - E2E ベストプラクティス

## 注意事項

- これらの Issue ファイルは GitHub Issues の下書きです
- 実際に GitHub Issues として作成する際は、適切なラベル（`Backlog`, `S工数` または `M工数`）を付けてください
- 各 Issue の「受け入れ基準」を満たした時点で完了とします
