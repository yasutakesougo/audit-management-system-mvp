# 🧠 AI Usage Protocol — audit-management-system-mvp

> **フェーズ**: Hardening → Fortress化  
> **スタック**: React + MUI + Vite + Playwright + Zod + MSAL + SharePoint + Cloudflare Worker  
> **作成日**: 2026-02-28

---

## 0. フェーズ定義（移行条件）

| From | To | 移行条件 |
|---|---|---|
| MVP | 運用 | CRUD + 認証 + 基本E2E green / 主要ユーザーフロー smoke test PASS |
| 運用 | Hardening | エラーハンドリング統一済 / 主要モジュールに unit + E2E / MSAL・SharePoint 認証監査完了 |
| Hardening | **Fortress** | Evidence Pack 運用開始 / ADR が機能単位で整備 / Observability イベントが全主要フローに存在 |

> [!IMPORTANT]
> フェーズ移行は「雰囲気」で判断しない。上記条件を満たしたことを ADR またはチェックリストで記録する。

---

## 1. Fortress Criteria

以下を**すべて**満たしたモジュールを **Fortress-ready** と定義する：

- [ ] Unit coverage: 主要ロジック 80%以上
- [ ] Smoke E2E が存在
- [ ] エラー分類が統一されている（`classifyError` 系）
- [ ] ADR が 1 つ以上紐付いている
- [ ] Observability イベントが 1 つ以上存在

---

## 2. スキル適用ルール

> [!WARNING]
> **1 PR = 1 Skill Chain（最大 3 スキル）**
>
> 28 workflows ある CI 環境では PR 肥大化 → CI 不安定化に直結する。  
> スキルチェーン単位で PR 粒度を制御すること。

### 日次小PR運用

日常的な軽微改善は、毎回プロンプトを作り直さず `.agents/daily-task.md` を入口にする。
候補は docs-only または test-only を優先し、仕様変更・依存追加・SharePoint list / field candidates 変更を含めない。

---

## 3. スキル × フェーズ マトリクス

| スキル | Hardening | Fortress | 運用安定 | 新機能 |
|--------|:---------:|:--------:|:--------:|:------:|
| `react-best-practices` | ✅ | ✅ | ✅ | ✅ |
| `testing-patterns` | ✅ | ✅ | ✅ | ✅ |
| `playwright-skill` | ✅ | ✅ | ✅ | — |
| `error-handling-patterns` | ✅ | ✅ | ✅ | — |
| `api-security-best-practices` | ✅ | ✅ | — | — |
| `architecture-decision-records` | ✅ | ✅ | — | ✅ |
| `observability-engineer` | — | ✅ | ✅ | — |
| `code-refactoring-refactor-clean` | ✅ | — | — | — |
| `wiki-architect` | — | ✅ | ✅ | — |
| `git-pr-workflows-git-workflow` | ✅ | ✅ | ✅ | — |
| `clean-code` | ✅ | — | — | ✅ |
| `plan-writing` | — | — | — | ✅ |
| `code-review-checklist` | ✅ | ✅ | ✅ | ✅ |

---

## 4. バックログ × スキルマッピング

### Phase 1（S工数）

| バックログ | スキル | プロンプト例 |
|---|---|---|
| MSAL E2E スモーク | `playwright-skill` | `@playwright-skill MSAL signIn→/me→signOut E2Eを設計` |
| Users CRUD 回帰 | `testing-patterns` | `@testing-patterns CRUD追加→削除のモック回帰テスト戦略` |
| a11y チェック | `react-best-practices` | `@react-best-practices axe統合パターンを提案` |
| env ガード | `error-handling-patterns` | `@error-handling-patterns Zod env validationのエラー伝搬レビュー` |

### Phase 2（M工数）

| バックログ | スキル | プロンプト例 |
|---|---|---|
| CRUD 統合テスト | `playwright-skill` + `testing-patterns` | `@playwright-skill 4ステップCRUD統合テストのPO設計` |
| a11y CI | `code-review-checklist` | `@code-review-checklist axeレポートCI保存ワークフローレビュー` |
| HTTPS 復帰 | `api-security-best-practices` | `@api-security-best-practices mkcert TLS構成セキュリティレビュー` |

---

## 5. 開発ワークフロー別プロトコル

### 🏗️ 新機能開発
```
1. @plan-writing → 実装計画
2. @architecture-decision-records → ADRドラフト
3. @react-best-practices → コンポーネント設計確認
4. @testing-patterns → テスト戦略
5. @code-review-checklist → セルフレビュー
```

### 🔧 リファクタリング
```
1. @code-refactoring-refactor-clean → 技術負債特定
2. @plan-writing → 段階的計画
3. @clean-code → 品質確認
4. @testing-patterns → 回帰テスト追加
```

### 🛡️ Hardening
```
1. @api-security-best-practices → エンドポイント監査
2. @error-handling-patterns → エラー処理強化
3. @playwright-skill → セキュリティE2E
4. @architecture-decision-records → ADR作成
```

### 📊 運用（Phase 4+）
```
1. @observability-engineer → 計測ポイント設計
2. @wiki-architect → ドキュメント自動生成
3. @architecture-decision-records → 運用判断記録
```

---

## 6. モジュール × Fortress 進捗

| モジュール | ファイル数 | 推奨スキル | Unit | E2E | エラー統一 | ADR | Obs |
|---|---|---|:---:|:---:|:---:|:---:|:---:|
| `schedules` | 72 | `react-best-practices`, `refactor-clean` | ☐ | ☐ | ☐ | ☐ | ☐ |
| `daily` | 56 | `testing-patterns`, `error-handling` | ☐ | ☐ | ☐ | ☐ | ☐ |
| `nurse` | 49 | `react-best-practices`, `clean-code` | ☐ | ☐ | ☐ | ☐ | ☐ |
| `users` | 45 | `playwright-skill`, `testing-patterns` | ☐ | ☐ | ☐ | ☐ | ☐ |
| `dashboard` | 64 | `observability-engineer` | ☐ | ☐ | ☐ | ☐ | ☐ |
| `auth` | 14 | `api-security-best-practices` | ☐ | ☐ | ☐ | ☐ | ☐ |
| `audit` | 13 | `api-security`, `error-handling` | ☐ | ☐ | ☐ | ☐ | ☐ |

> チェックが全列で埋まったモジュール = **Fortress-ready** ✅

---

## 7. CI 統合

| CI ステージ | スキル | 活用 |
|---|---|---|
| Pre-commit (Husky) | `clean-code` | 品質チェック |
| PR チェック (28 workflows) | `code-review-checklist` | レビュー補助 |
| E2E (Playwright) | `playwright-skill` | flaky test 診断 |
| Nightly | `observability-engineer` | パフォーマンス計測 |

---

## 8. 拡張候補

| スキル | 導入タイミング | 理由 |
|---|---|---|
| `dependency-injection-patterns` | Adapter層拡大時 | GraphAdapter/OfflineAdapter 追加 |
| `accessibility-compliance-accessibility-audit` | a11y CI統合時 | WCAG体系的監査 |
| `deployment-pipeline-design` | CD整備時 | 28 workflows 整理 |
| `incident-runbook-templates` | 本番運用後 | 障害対応標準化 |
