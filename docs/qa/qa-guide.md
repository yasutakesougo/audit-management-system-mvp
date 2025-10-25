---
title: QA Guide — 開発プロセスと品質保証
description: ブランチ戦略・PR レビュー・CI 基準・テスト方針・品質ゲート・運用ルールを一枚に
---

# 目的
- 安定したリリースを**再現可能**にするための最小〜標準プロセスを共有。
- 本ガイドは本リポジトリの **単一の真実**（Single Source）として運用します。

---

# 全体フロー（Mermaid）

```mermaid
flowchart LR
  A[Issue/Task] --> B[feature/* で実装]
  B --> C[Local QA: typecheck/lint/test]
  C --> D[PR 作成 → 自動 CI]
  D -->|Fail| C
  D -->|Pass| E[Code Review (2 approvals)]
  E --> F[main へ merge]
  F --> G[Build & E2E Smoke]
  G --> H[Docs publish / Release notes]
```

---

# ブランチ戦略 & コミット規約

ブランチ
	• main: 安定（常にリリース可能）
	• feature/*: 機能／修正ごと
	• chore/*: 雑務（依存更新・ドキュメント等）
	• hotfix/*: 緊急修正（main から分岐して即時リリース）

Conventional Commits（推奨）

feat(ui): add schedule timeline tab
fix(sp): handle 429 with backoff and jitter
docs(architecture): add rbac matrix
test(e2e): add route smoke for /dashboard/meeting
chore(deps): bump @playwright/test to ^1.48.0

---

# PR テンプレート（そのまま貼り付け）

## 概要
- 何を・なぜ（issue link）

## 変更点
- UI/UX（スクショ/録画あれば）
- API/スキーマ変更（互換性は？）

## QA
- [ ] typecheck / lint / unit / e2e smoke 通過
- [ ] data-testid 付与／更新（必要箇所）
- [ ] docs 追従（system-map / flows / env 等）

## リスクと影響範囲
- 失敗時のロールバック手順
- Feature Flag（ある場合）

## 受入観点（確認済）
- [ ] キーボード操作可・コントラスト
- [ ] ロールごとの到達（RBAC）

.github/PULL_REQUEST_TEMPLATE.md に保存推奨。

---

# CI 基準（Quality Gates）

種別	基準	ツール/設定
TypeCheck	失敗ゼロ	npm run typecheck
Lint	失敗ゼロ（警告OK）	ESLint（TS/React/自作ルール require-testid）
Unit	全テスト成功	Vitest
Coverage	Lines/Funcs/Stmts ≥ 70% / Branches ≥ 65%	npm run test:coverage
E2E Smoke	app-smoke / routes-smoke 成功	Playwright（trace on-first-retry）
Build	成功	Vite build
Docs	MD/Lint OK, Mermaid表示可	MkDocs（Material + superfences）

しきい値は Phase 3 を現時点のベースラインとする（system-map に準拠）。

---

# テスト方針（Testing Pyramid）

graph TD
  A[Unit (厚め)] --> B[Integration]
  B --> C[E2E (最小)]

	• Unit（厚め）: 純粋ロジック（progress.ts、リトライ、$batch 解析等）を集中的に。
	• Integration: Hooks/小規模コンポーネント。
	• E2E（最小）: ルート到達・権限・監査メトリクスのごく一部のみ。

命名 & 配置

tests/
  unit/**/*.spec.ts
  e2e/*.e2e.ts

data-testid 規約
	• kebab-case／i18n非依存／主要操作に必ず付与
	• 単一ソース: src/testids.ts（UI & E2E 両方から参照）
	• 例: meeting-guide, audit-metrics, toast-message

---

# Playwright 指針（安定運用）
	• trace: 'on-first-retry', video: 'retain-on-failure', screenshot: 'only-on-failure'
	• 遅延は 期待 に持たせる（await expect(...).toBeVisible()）
	• 直リンクを優先（/dashboard/meeting など パス派）
	• RoleRoute 到達マトリクスは 1 本だけ（Admin/Staff/Viewer）

最小スモーク例（再掲）

test('meeting guide reachable', async ({ page }) => {
  await page.goto('/dashboard/meeting');
  await expect(page.getByTestId('meeting-guide')).toBeVisible();
});

---

# アクセシビリティ & パフォーマンス（軽量ゲート）

項目	最低基準	補足
Focus	Tab で到達、明確な focus ring	主要操作ボタン44px以上
色	WCAG AA（主要 UI）	トースト/エラー含む
Lighthouse Perf	デスクトップ ≥ 90	主要画面の参考値
画像代替	主要アイコン/画像に aria-label / alt	補助的アイコンは除外可

---

# レビュー・承認
	• 2 approvals が原則（例外は hotfix）
	• レビューの観点（抜粋）：
	• 設計整合（docs/architecture/* との矛盾なし）
	• テスト（pyramid バランス、E2E 最小）
	• 可観測性（audit-metrics 等の露出）
	• セキュリティ（threat-model.md と矛盾なし）
	• RBAC（rbac.md のマトリクス内）

---

# リリース基準 & ロールバック

リリース可条件
	• CI 全緑（Quality Gates 充足）
	• docs/releases/CHANGELOG.md 更新（自動/手動どちらでも）

ロールバック手順（簡易）
	1. 指定タグ/コミットへ main を Revert
	2. runbook.md の Sev 判定に従い連絡
	3. 必要なら Feature Flag で問題機能を off

---

# Flaky テストの扱い
	1. 再現手順を最小化して issue 化
	2. 一時回避（test.fixme or test.skip）は期限付き
	3. 解消まで E2E を増やさない（pyramid を守る）

---

# 実行コマンド（開発者ショートカット）

npm run typecheck
npm run lint
npm run test
npm run test:coverage
npm run test:e2e
npm run build

CI と同じ門番をローカルで再現。PR 前にできる限り緑に。

---

# 付録：GitHub Actions（要点）
	• test-e2e.yml: Playwright の trace/video/screenshot を always: true で成果物アップロード
	• report-links.yml: カバレッジ／Lighthouse／Sentry などのダッシュボードURLを PR に自動掲示
	• provision-sharepoint.yml: WhatIf → Apply の 2 段（運用レビューを通して反映）
