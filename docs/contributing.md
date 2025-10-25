---
title: Contributing — 開発ルール & PR ガイド
description: ブランチ運用・命名規約・レビュー観点・テスト/CI 基準・ドキュメント更新ルール
---

# 目的
このドキュメントは、誰が参加しても **同じ品質で安全に変更できる** ための共通ルールです。  
**単一の真実**（Single Source of Truth）として、PR 前に必ず確認してください。

---

## ブランチ戦略
- `main` … 常にリリース可能
- `feature/<brief-topic>` … 機能追加（例: `feature/records-batch-retry`）
- `chore/<topic>` … 依存更新・ドキュメント等（例: `chore/update-playwright`）
- `fix|hotfix/<issue-or-topic>` … 不具合修正（本番緊急は `hotfix/`）

**小さく早く**: 1PR = 1トピック。500行超えは要分割を検討。

---

## コミット規約（Conventional Commits）

feat(ui): add schedule timeline tab
fix(sp): handle 429 with backoff and jitter
docs(architecture): add rbac matrix
test(e2e): add route smoke for /dashboard/meeting
chore(deps): bump @playwright/test to ^1.48.0

- `feat|fix|docs|test|chore|refactor|perf|ci` を優先利用
- **なぜ**を残す: 本質的な設計判断は PR 説明にも記載

---

## 命名規約（要点）
- **ファイル/ディレクトリ**: `kebab-case`（例: `support-plan-guide.tsx`）
- **型/コンポーネント/Enum**: `PascalCase`、**フック**: `useCamelCase`
- **定数**: `SCREAMING_SNAKE_CASE` は環境定数のみに限定
- **data-testid**: `kebab-case`（例: `meeting-guide`, `audit-metrics`）  
  - **単一ソース**: `src/testids.ts` に登録し、UI/E2E 双方から参照

---

## PR 作成前チェック（ローカル QA）
```bash
npm run typecheck
npm run lint
npm run test
npm run test:coverage
npm run test:e2e
npm run build
```

	• Coverage ゲート: Lines/Funcs/Stmts ≥ 70% / Branches ≥ 65%（Phase 3）
	• E2E は最小: ルート到達・RBAC・監査メトリクスのみを基本に

---

## PR テンプレ（貼り付け可）

## 概要
- 何を・なぜ（Issue/背景リンク）

## 変更点
- UI/UX（スクショ or 動画）
- API/スキーマ変更（互換性への影響）

## QA
- [ ] typecheck / lint / unit / e2e smoke 通過
- [ ] data-testid 追加/更新（ `src/testids.ts` 反映済 ）
- [ ] docs 更新（architecture/flows/env 等）

## リスク・影響範囲
- ロールバック手順 / Feature Flag

## 受入確認
- [ ] RBAC 到達（roleごと）
- [ ] アクセシビリティ（Tab移動/コントラスト）

.github/PULL_REQUEST_TEMPLATE.md に保存推奨。

---

## レビュー指針（レビュアー向け）
	• 設計整合: docs/architecture/* と矛盾がないか（フロー・RBAC・Threat Model）
	• テスト戦略: ピラミッドを守れているか（Unit 厚め / E2E 最小）
	• 可観測性: 監査メトリクスやログ露出は十分か（audit-metrics 等）
	• アクセシビリティ: キーボード操作/ラベル/コントラスト
	• 保守性: 命名/分割/責務（Fat Component 回避、純粋ロジックは分離）
	• セキュリティ: env-config.md / threat-model.md と整合、シークレット露出がない

承認規則: 原則 2 approvals（hotfix は例外許容）

---

## テスト方針（Pyramid）

graph TD
  A[Unit — 純粋ロジック/小粒Hook] --> B[Integration]
  B --> C[E2E — ルート/RBAC/監査メトリクスだけ]

	• Unit: progress.ts、リトライ/バッチ解析、utility、hooks
	• Integration: 狭い境界のUI（jsdom）
	• E2E: ルート到達、RoleRoute 境界、audit-metrics 整合性

---

## E2E の実務ルール（Playwright）
	• trace: 'on-first-retry', video: 'retain-on-failure', screenshot: 'only-on-failure'
	• 直リンクでテスト（/dashboard/meeting など）— URL 状態は パス派
	• フラグ機能は localStorage で開通: feature:schedules=1
	• 安定取得: getByTestId + expect(...).toBeVisible() を基本に

---

## アクセシビリティ & パフォーマンス（軽量ゲート）

項目	最低基準	備考
Focus 移動	Tab 到達 + 明確な focus ring	主要ボタン44px以上
色/コントラスト	WCAG AA 相当	トースト/エラー含む
代替テキスト	主要画像/アイコンに alt/aria-label	補助アイコンは除外可
Lighthouse(Desktop)	Perf ≥ 90	主要画面で参考取得

---

## ドキュメント更新ルール
	• 設計/仕様の変更は 必ず docs/architecture/* を更新
	• 運用フロー変更は docs/ops/runbook.md
	• 監査可観測性の追加は docs/metrics/audit-observability.md
	• RBAC 変更は docs/architecture/rbac.md と E2E を同期

---

## バージョニング & リリース
	• タグ形式: vMAJOR.MINOR.PATCH
	• 生成ワークフロー: release-notes.yml（テンプレ→ docs/releases/<version>/）
	• metrics.yaml に coverage / Lighthouse / エラー率などを記録

---

## コードスタイル & ツール
	• ESLint（TS/React + カスタム require-testid ルール）
	• Prettier（エディタ保存時フォーマット）
	• import 順序: auto-sort（任意）
	• alias: @/ は tsconfig.json に従う（Playwright では相対推奨）

---

## セキュリティ/秘匿情報
	• .env はリポジトリに含めない（.env.example のみ）
	• フロントにクライアントシークレットを置かない
	• MSAL/スコープ設定は env-config.md を参照
	• 個人情報/監査ログは サンプル化して Issue/PR に貼付

---

## Flaky テストの扱い
	1. Issue 化（最小再現/環境/頻度）
	2. test.fixme|skip は期限付きで運用
	3. 解消まで E2E の追加は抑制（Unit に寄せる）

---

## よくある質問（FAQ）

Q. as const で TS/ESLint がエラー
A. Object.freeze({ ... }) 方式を採用、または parser 設定を見直し。src/testids.ts を参照。

Q. 直リンクで 404/403 になる
A. RBAC/Feature Flag/ガード順序を auth-flow.md で確認。E2E は /dashboard/meeting 直叩きを推奨。

---

## 署名（任意）
	• DCO もしくは CLA 運用を採用する場合は、ここに署名手順・スコープを追記してください。
