# CI Gating Merge Checklist & Process

最終チェック + PR 手順 + マージ後指標

---

## ✅ 最終チェック（マージ前 3 分）

### 1) CIゲート動作確認（必須）

**Draft PR テスト**
- [ ] Draft PR を作成
- [ ] **期待**: fast-lane / storybook-a11y / e2e-smoke が起動しない ✅
- [ ] **実際**: 軽い CI (lint/typecheck) のみ走る

**run-ci ラベル付与テスト**
- [ ] PR に `run-ci` ラベルを付与
- [ ] **期待**: 3 つの重い Workflow が起動 ✅
  - fast-lane
  - storybook-a11y
  - e2e-smoke
- [ ] `gh run list -L 5` で確認 or Actions tab で見える

**ラベル削除テスト**
- [ ] PR から `run-ci` を外す
- [ ] **期待**: 次の push/sync イベントでは重い CI が起動しない ✅
- [ ] 新コミットを作って確認（軽い CI のみ）

### 2) Docs / テンプレのリンク整合

**README.md**
- [ ] CI / Workflow Policy セクションが "Development" 直前に追記済 ✅
- [ ] `docs/LABELS.md` へのリンク有 ✅
- [ ] `docs/PROJECT_BOARD.md` へのリンク有 ✅

**CONTRIBUTING.md**
- [ ] Pull Request Workflow セクションが先頭に追記済 ✅
- [ ] `docs/LABELS.md` へのリンク有 ✅
- [ ] `docs/PROJECT_BOARD.md` へのリンク有 ✅

**.github/pull_request_template.md**
- [ ] Summary / Why / Changes / Verification / Rollback セクション ✅
- [ ] UIアーキテクチャチェック欄（既存との統合） ✅
- [ ] CI/Infra チェック欄（新規） ✅

**docs/LABELS.md**
- [ ] Workflow Labels 表 ✅
- [ ] Type Labels 表 ✅
- [ ] Priority Labels 表 ✅
- [ ] 運用フロー説明 ✅

**docs/PROJECT_BOARD.md**
- [ ] Board Structure (Backlog/Inbox/Sprint/In Progress/Review/Done) ✅
- [ ] ラベル駆動フロー図 ✅
- [ ] 自動化ルール 4 つ (Draft check / ready-for-review / run-ci / merge) ✅
- [ ] Q&A ✅

**.github/ISSUE_TEMPLATE/ci-improvement.yml**
- [ ] Priority / Effort / Problem / Objective / Proposal / DoD / Rollback 全項目 ✅

### 3) Projects 自動化

**Board 存在確認**
- [ ] GitHub Projects に "CI Gating" or 既存 Board 存在
- [ ] Columns: Backlog / Inbox / Sprint / In Progress / Review / Done
- [ ] Custom fields: Priority (P0/P1/P2/P3) 等

**自動化ルール設定**
- [ ] PR created / opened → Inbox に自動追加
- [ ] `ready-for-review` ラベル → Review 列に移動
- [ ] `run-ci` ラベル → CI/Verify 列に移動（Optional: Board に CI/Verify 列がない場合は Review でOK）
- [ ] Merged → Done 列に移動

**ラベル存在確認**
- [ ] Settings > Labels に以下が存在：
  - `run-ci` ✅
  - `ready-for-review` ✅
  - `priority:P0` / `P1` / `P2` / `P3` ✅
  - `ci/infra` ✅
  - `docs` ✅

---

## 🚀 マージ手順（5 分）

### PR 情報

**Title**
```
ci: introduce label-driven CI gating and project workflow docs
```

**Body**
```markdown
## Summary
Gate heavy workflows by draft/label (run-ci) to stop action_required flood and improve PR review velocity.

## Why
- **Problem**: Heavy CI (e2e-smoke, storybook-a11y) runs on every PR → action_required flood → noise
- **Solution**: Gate by `draft` / `run-ci` label → only run when ready for final review
- **Benefit**: Clearer intent, faster feedback on WIP, smoother Board flow

## Changes
- ✅ Add label reference, project board design, and CI improvement issue template (docs/)
- ✅ Update README.md with CI/Workflow Policy section
- ✅ Update CONTRIBUTING.md with Pull Request Workflow steps
- ✅ Update .github/pull_request_template.md with Rollback Plan
- ✅ Add .github/ISSUE_TEMPLATE/ci-improvement.yml for CI-specific issues
- ⚠️ **No product code changes**

## Verification
- [x] Docs/templates linked correctly (README → docs/LABELS.md / PROJECT_BOARD.md)
- [x] CI workflow gates not yet deployed (pending separate PR for workflow changes)
- [x] Rollback: Revert this PR; if workflows already gated, remove `if: contains(..., 'run-ci')` conditions

## Rollback Plan
- Revert this PR
- If workflows already updated: remove `if:` gate conditions from `.github/workflows/*.yml`

## Notes
**Next steps (separate PRs):**
1. PR-B: Update workflows with `run-ci` gate + split e2e-smoke/deep
2. env-validator: fail fast on bad .env at CI start
3. boundary-lint: warn on features cross-imports
```

### マージコマンド

```bash
# 1. PR 番号を確認
gh pr list -L 5 -s open

# 2. マージ（Squash推奨）
gh pr merge <PR_NUMBER> --squash --delete-branch

# 3. ローカル整理
git fetch origin main && git checkout main && git pull
```

---

## 📣 マージ後の一言共有（Slack / Teams）

**短版（30秒）**
```
🎯 CI Gating が本線入りしました

📌 重いCI (e2e-smoke / storybook-a11y) は `run-ci` ラベル付与時のみ起動します
📌 WIP/Draft PR では軽いCI (lint/typecheck) だけ走ります
📌 詳細は README.md / docs/LABELS.md / docs/PROJECT_BOARD.md を参照

👉 これで Action required 洪水が減り、PR待ち時間が短縮します！
```

**詳版（1 分、optional）**
```
🎯 CI Gating & Project Board Workflow が本線入りしました

## 変わること
✅ Draft PR → 軽い CI のみ（lint/typecheck）
✅ run-ci ラベル → 重い CI 全起動（e2e-smoke / storybook-a11y / lighthouse-ci）
✅ ready-for-review → Projects Board の Review 列に自動移動
✅ Merged → Done 列に自動移動

## なぜ？
- Action required 洪水を止めて、本当に必要な時だけ重い CI を回す
- PR の意図を明確にして、レビュー効率を上げる
- Board と CI が連動して、進捗が見やすい

## 詳細
📚 README.md: CI / Workflow Policy
📚 docs/LABELS.md: ラベル辞書
📚 docs/PROJECT_BOARD.md: Board 設計と自動化

💡 次は e2e-smoke/deep 分離 (PR-B) に進みます
```

---

## 📈 マージ後に見るべき指標（1 日後）

| 指標 | 現状目安 | 目標 | 確認方法 |
|-----|--------|------|--------|
| **Action required 件数** | ~15-20/日 | ~0-2/日 | GitHub > Actions > Jobs output |
| **PR 平均待ち時間** | ~2-3h | ~1-1.5h | GitHub > Insights > Pulse |
| **CI 成功率** | ~85-90% | ~90-95% | GitHub > Actions > Workflows |
| **人手による再実行** | ~3-5/day | ~0-1/day | Actions ログ / 再実行 API 呼び出し |

---

## 🚀 次の一手（おすすめ順）

### Phase 1: PR-B（1-2 日）
**E2E Smoke / Deep 分離・Deep 非ブロッキング**

```yaml
# 例：workflow if-gate + Playwright config split
workflows/
  e2e-smoke.yml      → fast path (5 min, blocking)
  e2e-deep.yml       → slow path (20 min, non-blocking, run-ci only)
```

**メリット**
- Smoke が 5 分で帰ってくる → さらに快適
- Deep は好きなタイミングで走らせる

### Phase 2: Env Validator（1 日）
**CI 冒頭で Fail Fast**

```yaml
# .env 検証スクリプト（CI start）
- name: Validate .env
  run: npm run validate:env
```

**メリット**
- Bad config を 10 秒で検知 → 無駄な CI 時間ゼロ

### Phase 3: Boundary Lint（warn）（2 日）
**Features 分離の下地**

```bash
npm run lint:boundary -- --warn
```

**メリット**
- Features 間の cross-imports を可視化
- 将来の大規模リファクタに備える

---

## 最後の確認

**このチェックリストを全部 ✅ できたら、本線マージ OK**
- [ ] CIゲート動作確認 ✅
- [ ] Docs/テンプレリンク整合 ✅
- [ ] Projects 自動化 ✅
- [ ] マージ手順で実行 ✅
- [ ] Slack/Teams に一言共有 ✅

**Next PR (PR-B) の準備**
- [ ] e2e-smoke.yml の `if:` ゲート確認
- [ ] Playwright config の smoke/deep 分割パターン確認

---

質問や詰まったら、このドキュメントの該当セクションを参照 → Slack で共有してください！
