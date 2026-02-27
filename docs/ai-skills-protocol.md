# 🧭 AI Skills Protocol — audit-management-system (Fortress Edition)

> プロジェクト専用のスキル活用運用ルール
> 対象: 33 features / 85+ docs / 2 ADRs / 9 runbooks / label-driven CI
> フェーズ: **Hardening → Fortress化**

---

## 0. Skill Invocation Header（入力規格）

> [!IMPORTANT]
> スキルの出力品質は **入力の品質** で決まる。全依頼の先頭にこのヘッダを付ける。

```markdown
## Skill Invocation
- 目的:（1行）
- スコープ:（対象 feature / file / route）
- 制約:（破壊的変更NG、既存パターン厳守、など）
- Definition of Done:（チェック項目 3〜7）
- Evidence:（ログ / テスト / スクショ / 計測のどれを残すか）
- リスク:（認証・データ・互換性・運用影響）
```

> [!CAUTION]
> スコープは **最大 1 feature または 1 route** に限定する。
> 一度に複数 feature（例: schedules + daily + users）を触ると壊れる。

---

## 0.1 適用単位の原則

スキルは以下の単位で適用する：

| 単位 | 説明 |
|------|------|
| ① Feature 単位 | 例: `schedules`, `daily`, `today` |
| ② PR 単位 | 1 PR = 1 Skill Chain |
| ③ Sprint 単位 | Hardening Sprint は Pick Rule 固定 |

❌ 1 ファイル単位で場当たり的に適用しない

---

## 1. フェーズ × スキル用途マトリクス

| スキル | 🔨 新機能 | 🔧 リファクタ | 🧪 テスト | 🛡 Security | 🧯 Reliability | ⚡ Perf | 📐 設計 | 📚 Doc |
|--------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| react-best-practices | ● | ● | | | | ● | | |
| testing-patterns | | | ● | | ● | | | |
| playwright-skill | | | ● | | ● | | | |
| clean-code | ● | ● | | | | | | |
| error-handling-patterns | ● | ● | | | ● | | | |
| plan-writing | ● | ● | | | | | ● | |
| firebase | ● | | | ● | | | | |
| security-audit | | | | ● | | | | ● |
| api-security-best-practices | | | ● | ● | | | | |
| web-performance-optimization | | ● | | | | ● | | |
| observability-engineer | | | | | ● | | ● | |
| accessibility-audit | | | ● | | ● | | | |
| code-review-checklist | | ● | ● | | | | | |
| code-refactoring | | ● | | | | | | |
| tdd-workflow | ● | | ● | | | | | |
| kaizen | | ● | | | | | ● | |
| wiki-architect | | | | | | | | ● |
| architecture-decision-records | | | | | | | ● | ● |
| git-pr-workflows | | | | | | | ● | |
| documentation | | | | | | | | ● |

**Hardening 3分割の主戦場:**

| 分類 | 主要スキル |
|------|-----------|
| 🛡 Security | `api-security-best-practices` / `security-audit` / `firebase` |
| 🧯 Reliability | `error-handling-patterns` / `observability-engineer` / `testing-patterns` / `playwright-skill` |
| ⚡ Performance | `web-performance-optimization` / `react-best-practices` |

---

## 2. バックログ → スキル対応マッピング

| タスク領域 | 推奨スキルチェーン |
|-----------|-------------------|
| Actionable Briefing Alerts | `plan-writing` → `react-best-practices` → `testing-patterns` |
| ISP（個別支援計画） | `plan-writing` → `clean-code` → `tdd-workflow` |
| バンドル最適化 | `web-performance-optimization` → `react-best-practices` |
| System Observability | `observability-engineer` → `error-handling-patterns` |
| CI 安定化 | `playwright-skill` → `testing-patterns` |
| Monitoring Hub | `security-audit` → `observability-engineer` |
| hooks 分割 / repository | `code-refactoring` → `clean-code` |
| PR レビュー | `code-review-checklist` → `api-security-best-practices` |
| ADR 追加 | `architecture-decision-records` |
| SharePoint / MSAL | `api-security-best-practices` → `firebase` |
| ドキュメント刷新 | `wiki-architect` → `documentation` |
| アクセシビリティ | `accessibility-audit` |

---

## 3. 運用プロトコル

### 開発フロー順のスキル投入タイミング

```
1. 設計    → @plan-writing → @architecture-decision-records
2. 実装    → @react-best-practices → @clean-code → @error-handling
3. テスト  → @tdd-workflow → @testing-patterns → @playwright-skill
4. PR      → @code-review-checklist → @api-security-best-practices
5. Harden  → @security-audit → @observability-engineer → @web-performance
6. Doc     → @wiki-architect → @documentation
```

### Skill Pick Rule（毎回 2-3 個だけ選ぶ）

**Hardening Sprint:**

| ステップ | 目的 | スキル |
|---------|------|--------|
| 1. 検知 | 問題を見つける | `observability-engineer` |
| 2. 封じ込め | 再発防止 | `error-handling-patterns` or `api-security-best-practices` |
| 3. 証跡 | 判断を固定 | `architecture-decision-records` or `documentation` |

> E2E が絡む場合は `playwright-skill` を (2) と入れ替え可

### 組み合わせパターン

| パターン | フロー |
|---------|--------|
| **A: Feature** | `plan-writing` → `react-best-practices` → `testing-patterns` → `code-review-checklist` |
| **B: Refactor** | `code-refactoring` → `clean-code` → `testing-patterns` → `kaizen` |
| **C: Hardening** | `security-audit` → `api-security` → `observability` → `web-perf` → `ADR` |
| **D: Doc Sprint** | `wiki-architect` → `documentation` → `ADR` |

### ❌ NG パターン

| NG | 正しいやり方 |
|----|-------------|
| スキルを「読み物」として消費 | `@skill-name` で明示的に呼び出す |
| 全スキル毎回参照 | Pick Rule で 2-3 個だけ |
| 出力をそのままコピペ | 既存パターンに合わせて適用 |
| Hardening で機能追加スキルだけ | Security / Reliability 優先 |
| 複数 feature を同時スコープ | 1 feature / 1 route に限定 |

---

## 4. PR ゲート連動（label-driven CI と同期）

### ラベル → 必須スキル対応表

| PR ラベル | 必須スキル |
|----------|-----------|
| `hardening-security` | `@security-audit` + `@api-security-best-practices` |
| `hardening-reliability` | `@error-handling-patterns` + `@observability-engineer` |
| `hardening-performance` | `@web-performance-optimization` + `@react-best-practices` |
| `test-flaky` | `@playwright-skill` + `@testing-patterns` |
| `refactor` | `@code-refactoring` + `@clean-code` |
| `docs` | `@wiki-architect` + `@documentation` |
| `adr` | `@architecture-decision-records` |

### PR 運用ルール

- PR 本文に **「使ったスキル名」** を列挙（2〜3 個まで）
- Evidence 欄に **「DoD 達成の根拠」** を 1 行で記載
- `hardening-*` ラベルの PR は **Exit Criteria** を満たすこと（§5 参照）

---

## 5. Evidence Pack & Exit Criteria

### Evidence Pack（Hardening の DoD 最低セット）

| 種別 | 内容 | 必須 |
|------|------|:----:|
| ✅ Unit | `npm test <scope>` 結果 | ● |
| ✅ E2E | 該当 smoke の PASS | ● |
| ✅ Observability | ログ/イベントが 1 つ増える or 既存ログに紐付く | ● |
| ✅ ADR/Doc | 変更が「どこに記録されたか」リンク | ● |

### Hardening Sprint Exit Criteria

以下を **すべて** 満たしたら完了とする：

- [ ] 新規 Observability イベントが 1 つ以上追加されている
- [ ] 再発防止のテストが 1 つ以上追加されている
- [ ] ADR または Runbook が更新されている
- [ ] CI green + required checks 通過

> Fortress 化は「やった感」ではなく **「構造が強くなったか」** で判断する。

---

## 6. 優先実行キュー（攻撃面コスト順）

| 順位 | スキル | 初回適用先 | 根拠 |
|:----:|--------|-----------|------|
| 1 | `api-security-best-practices` | MSAL + SharePoint REST + Graph | 事故単価が最も高い |
| 2 | `observability-engineer` | ErrorBoundary + structured log | 検知できない障害は直せない |
| 3 | `testing-patterns` | flaky test 修正 | 再発防止の土台 |
| 4 | `react-best-practices` | schedules / daily / today | 体感性能 + 不具合の温床削減 |
| 5 | `architecture-decision-records` | ADR-003 起草 | 判断を固定してブレを止める |

---

## 📍 スキルの場所

```
~/.gemini/antigravity/skills/skills/{スキル名}/SKILL.md
```

---

> [!CAUTION]
> **最終ルール**: スキル適用の成果物は「コード変更」ではなく **「DoD + Evidence」** で評価する。
