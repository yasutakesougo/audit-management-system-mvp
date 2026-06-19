# PR Merge Safety Runbook

> ⚠️ この runbook は **現在の標準手順**です
> 数字が 0 でも **pendingChecks / failingChecks が空であること**を必ず確認してください

## Daily small PR scope guard

mixed worktree で daily-task の小PRを作る場合は、既存の未コミット差分を巻き込まないことを最優先にします。`git status --short` と対象ファイルの diff を確認し、stage は対象ファイルだけに限定してください。`git add .` や `git add -A` は使わず、PR 本文には `Scope` / `Verification` / `Out of scope` を必ず明記します。

SharePoint list/field candidates や `src/sharepoint/contracts/driftProbeTargets.ts` の差分は daily-task ではなく別枠差分として扱い、由来確認や採用判断が終わるまで小PRには含めません。

## A. マージ前の条件確認

### 1) CI Status の可視化

```bash
# failed / pending のカウントと、実際のチェック名を可視化
gh pr view <PR_NUMBER> --json statusCheckRollup -q '
{
  failed: ([.statusCheckRollup[]|select(.conclusion=="FAILURE")]|length),
  pending: ([.statusCheckRollup[]|select(.status=="IN_PROGRESS")]|length),
  failingChecks: [.statusCheckRollup[]|select(.conclusion=="FAILURE")|.name],
  pendingChecks: [.statusCheckRollup[]|select(.status=="IN_PROGRESS")|.name]
}'
```

**期待値:**
```json
{
  "failed": 0,
  "pending": 0,
  "failingChecks": [],
  "pendingChecks": []
}
```

### 2) 最終ゲート（自動ガード）

```bash
# failed/pending が 0 でなければ exit 1 → マージ不可
gh pr view <PR_NUMBER> --json statusCheckRollup \
  -q '([.statusCheckRollup[]|select(.conclusion=="FAILURE" or .status=="IN_PROGRESS")]|length)' \
| grep -qx 0
```

- ✅ **成功**: CI 全緑 → 次へ進む
- ❌ **失敗**: まだ pending/failed が残っている → マージしない

### 3) BEHIND 状態の扱い

```bash
gh pr view <PR_NUMBER> --json mergeStateStatus -q '.mergeStateStatus'
```

`mergeStateStatus` が `BEHIND` の場合は、pending/failed がないことを確認したあと、マージ判断前に main を取り込む。
ブランチの名前を確認し、必要に応じて本番 PR 側のブランチを最新化する。

```bash
git switch <BRANCH_NAME>
git fetch origin
git rebase origin/main
git push --force-with-lease
```

main 追従後はチェックが再実行されるため、再度 failed / pending が 0 になるまで待つ。

### 4) Review 承認確認

```bash
gh pr view <PR_NUMBER> --json reviewDecision -q '.reviewDecision'
# 期待値: APPROVED
```

## B. マージ実行

```bash
# Squash merge + ブランチ削除
gh pr merge <PR_NUMBER> --squash --delete-branch
```

## C. main の同期と確認

```bash
git switch main
git pull --ff-only

# マージコミットのSHA確認
git log -1 --oneline
```

## D. main の Actions 確認

```bash
# 最新の完了済み run を取得
RUN_ID=$(gh run list --branch main --limit 1 --json databaseId,status \
  -q '.[]|select(.status=="completed")|.databaseId')

echo "Checking run: $RUN_ID"

# 結論の確認
gh run view "$RUN_ID" --json conclusion -q '.conclusion'
# 期待値: success
```

**重要チェック:**
- ✅ Smoke Tests (schedule-smoke, health.smoke, nav.smoke)
- ✅ Quality Guardrails (lint, typecheck, vitest, playwright deep)

失敗時：
```bash
# 失敗したジョブのログ確認
gh run view "$RUN_ID" --log-failed

# 必要に応じてartifactダウンロード
gh run download "$RUN_ID"
```

## E. ローカルブランチのクリーンアップ

```bash
# マージ済みブランチの削除
git branch -d <BRANCH_NAME>

# リモート追跡ブランチの削除（既に --delete-branch で削除済み）
git fetch --prune
```

## F. 手動テスト（推奨）

開発サーバーで主要ページを確認：

```bash
npm run dev
```

1. **Health診断**: http://localhost:5173/health
   - カテゴリ別集計が表示される
   - JSON エクスポートが動作する

2. **チェックリスト**: http://localhost:5173/checklist
   - 管理者の場合：checklist-root が表示される
   - 非管理者：エラーなく表示される

3. **週間スケジュール**: http://localhost:5173/schedules/week
   - タブ切り替えが動作する
   - ローディング → リスト/Empty State のどちらかが表示される

---

## 付録：Test Responsibility Boundary

### 🔍 Smoke Tests (smoke.spec.ts)
**責務**: URL + main + 最小限のUI (heading/nav/tab)
- ❌ **含まない**: データロード待機、リスト内容の検証、複雑なインタラクション
- ✅ **含む**: ページ遷移、レイアウト表示、ナビゲーションバー

### 📄 Contract Tests (契約テスト)
**責務**: URL ↔ State の関係性
- ✅ **Contract A**: URL 保持 (`?org=A` がページ読み込み時に保持される)
- ✅ **Contract B**: UI 操作による URL 更新 (コンボボックス選択 → URL 変化)
- **実行**: chromium プロジェクト（smoke プロジェクトではない）

### 🧪 Deep Tests (通常の .spec.ts)
**責務**: データロード + インタラクション + ビジネスロジック
- ✅ **含む**: scheduleItems injection、リスト内容検証、フォーム入力、エラーハンドリング

---

## 付録：Org Filter Contract Test Template

```typescript
// tests/e2e/contract-org-filter.spec.ts
import { test, expect } from '@playwright/test';
import { bootSchedule } from './_helpers/bootSchedule';

test.describe('Org Filter: URL Contract', () => {
  test('Contract A: preserves org query param on page load', async ({ page }) => {
    // TODO: skip この仕様が未実装の場合
    // test.skip(true, 'Org filter not yet implemented');

    await bootSchedule(page, {
      mode: 'fixtures',
      enableWeekV2: false,
      autoNavigate: false,
    });

    // 直接 ?org=A 付きで遷移
    await page.goto('/schedules/week?org=A');

    // URL が保持されているか
    await expect(page).toHaveURL(/\/schedules\/week\?org=A\b/);

    // TODO(testid): [role=main] を [data-testid="schedule-week-main"] に変更
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('Contract B: updates URL when org selected in UI', async ({ page }) => {
    // TODO: skip UI未実装の場合
    // test.skip(true, 'Org combobox not yet added');

    await bootSchedule(page, {
      mode: 'fixtures',
      enableWeekV2: false,
      autoNavigate: false,
    });

    await page.goto('/schedules/week');

    // TODO(testid): [role=combobox] を [data-testid="org-filter-select"] に変更
    const orgSelect = page.getByRole('combobox', { name: /組織/ });
    await orgSelect.selectOption('A');

    // URL が更新されたか
    await expect(page).toHaveURL(/\/schedules\/week\?org=A\b/);
  });
});
```

**Contract 運用メモ:**
- `test.skip()` で仕様未実装時の CI 不安定化を防止
- `org=A` の値は、実装進捗に応じて実際の組織ID/codeに置き換える
- Contract Test は chromium プロジェクトで実行（smoke プロジェクトではない）

---

## トラブルシューティング

### Q1: pending が 0 にならない

```bash
# 進行中のチェックを確認
gh pr view <PR_NUMBER> --json statusCheckRollup \
  -q '.statusCheckRollup[]|select(.status=="IN_PROGRESS")|.name'
```

**対処**: 5分待機 → 再確認。10分以上続く場合は CI キャンセル → 再実行

### Q2: main Actions が fail する

```bash
# 失敗した check の詳細
gh run view "$RUN_ID" --log-failed | grep -A 10 "Error"
```

**対処**:
1. Smoke failure → artifact ダウンロード → trace 分析
2. Lint/Typecheck → ローカルで `npm run health` 実行
3. Deep test failure → 該当 spec ファイルを `npx playwright test <file>` でローカル実行

### Q3: マージ後にローカルで動かない

```bash
# node_modules の再インストール
rm -rf node_modules package-lock.json
npm install

# Playwright ブラウザの更新
npx playwright install --with-deps chromium
```

---

**最終確認チェックリスト:**
- [ ] `failed: 0`, `pending: 0`, `failingChecks: []`, `pendingChecks: []`
- [ ] Review が APPROVED
- [ ] 最終ゲート（自動ガード）が成功
- [ ] main Actions が success
- [ ] 手動テストで主要3ページが動作
- [ ] ブランチクリーンアップ完了

✅ すべて完了 → **安全にマージ完了**
