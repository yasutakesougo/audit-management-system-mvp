# Projects Board Setup & Automation

このリポジトリの GitHub Projects は **ラベル駆動** + **自動化** で効率的に運用されます。

## Board Structure

### Columns

1. **Backlog**
   - まだ優先度が決まっていない Issue / PR
   - 自動フロー：なし（手動で Backlog に作成）

2. **Inbox**
   - 新規の未分類 Issue / PR が自動で到着
   - レビュー者が優先度判定 → Backlog / Sprint に移動

3. **Sprint** (or To Do)
   - 今週対応予定の Issue / PR
   - `priority:P0` / `priority:P1` が多い

4. **In Progress**
   - 誰かが作業中
   - 自動化：Draft PR は **入らない** （Ready for Review / run-ci 付与時に自動流入）
   - 手動：Issue は「assiggnee を設定」で移動を示唆

5. **Review** (or CI/Verify)
   - レビュー待ち / CI実行中
   - 自動化：`ready-for-review` ラベル付与で自動流入
   - `run-ci` 付与で重いCIが起動

6. **Done**
   - マージ済み / 完了
   - 自動化：PR がマージされたら自動移動

## ラベル駆動の流れ

```
Draft PR (no labels)
    ↓ 作成者が作業中、早期レビューのため PR 作成
    ↓ Reviewers が見て、フィードバック
    ↓ 作成者が対応完了
    ↓
Ready (ready-for-review) ← 作成者が付与
    ↓
Review 列に自動移動
    ↓ Reviewers が最終チェック
    ↓ 承認が出たら run-ci を付与
    ↓
(CI-dependent workflows 起動) ← fast-lane / storybook-a11y / e2e-smoke
    ↓
CI green ← (チェック自動通知)
    ↓
Merge ← 作成者がマージ
    ↓
Done 列に自動移動
```

## 自動化ルール (Workflows)

### 1) PR が Draft → Ready に変わったら Review 列に移動

**Trigger**: `pull_request` (opened / ready_for_review / labeled)
**Condition**: `ready-for-review` ラベルが付与されている
**Action**: Project card を Review 列に移動

```yaml
if: contains(github.event.pull_request.labels.*.name, 'ready-for-review')
  → Update Project card status to "Review"
```

### 2) Draft PR は In Progress に出さない

**Trigger**: `pull_request` (opened / labeled)
**Condition**: `isDraft == true`
**Action**: ラベルに関わらず Board フローに入らない（Inbox に戻す）

```yaml
if: github.event.pull_request.draft == true
  → Move to Inbox (or do nothing)
```

### 3) `run-ci` ラベル付与で重いCI起動

**Trigger**: `pull_request` (labeled)
**Condition**: label == `run-ci`
**Action**: e2e-smoke / storybook-a11y / fast-lane を起動

```yaml
name: Trigger Heavy CI
on:
  pull_request:
    types: [labeled]

jobs:
  check-label:
    if: contains(github.event.pull_request.labels.*.name, 'run-ci')
    runs-on: ubuntu-latest
    steps:
      - name: Trigger e2e-smoke
        run: gh workflow run e2e-smoke.yml -f pr=${{ github.event.number }}
```

### 4) PR マージ時に Done に自動移動

**Trigger**: `pull_request` (closed + merged)
**Action**: Project card を Done 列に移動

```yaml
if: github.event.pull_request.merged == true
  → Update Project card status to "Done"
```

## CI/Workflow 条件

### Light CI（常に実行）

```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]
```

- Lint
- TypeCheck
- Unit Tests
- Build

### Heavy CI（`run-ci` ラベル付与時のみ）

```yaml
on:
  pull_request:
    types: [labeled]

jobs:
  check:
    if: contains(github.event.pull_request.labels.*.name, 'run-ci')
```

- E2E Smoke (chromium, mobile-chrome)
- Storybook A11y
- Fast-Lane (critical paths)
- Lighthouse CI

### Docs-only Skip

```yaml
if: |
  ! (
    contains(github.event.pull_request.labels.*.name, 'docs') &&
    ! contains(github.event.pull_request.labels.*.name, 'ci/infra')
  )
```

docs-only PR（`docs` ラベル & `ci/infra` なし）は e2e-smoke, LHCI をスキップ。

## 運用チェックリスト

- [ ] Board を Projects から作成（自動化ルールを設定）
- [ ] ラベルを作成：`ready-for-review`, `run-ci`, `priority:P0-P3`, `ci/infra`, `docs`
- [ ] Workflows を追加：
  - `label.yml` — `run-ci` で重いCI起動
  - `project-automation.yml` — Board 自動移動
- [ ] README / CONTRIBUTING にリンク貼る
- [ ] チーム全体で一度レビュー・運用ルール説明

## Q&A

**Q: Docs-only PR でも e2e-smoke を走らせたい場合は？**
A: `ci/infra` ラベルも一緒に付けてください。そうすると重いCI も起動します。

**Q: Priority ラベルは必須？**
A: Projects の Priority フィールド（カスタムフィールド）で既に管理していたら不要です。代わりにフィールドベースで絞ります。

**Q: Draft PR を Board に出さない場合、どうやって進捗を共有するの？**
A: PR の Description に進捗をコメント / PR 本体の checkbox を埋める。Board は公式が ready-for-review まで出ない設計です（完成度が高まってからBoard入り）。

**Q: `ready-for-review` と `run-ci` は同時に付けるの？**
A: 理想は段階：
1. Draft 作成 → 早期レビュー（ラベル無し）
2. 対応完了 → `ready-for-review` 付与
3. Review 一巡 → `run-ci` 付与

ただし急ぐなら同時付与でも OK です。

詳細は [LABELS.md](LABELS.md) を参照。
