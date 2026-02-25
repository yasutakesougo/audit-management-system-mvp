# Contributing

Thanks for taking the time to contribute! Please follow the guidelines below to help keep the project healthy.

## Pull Request Workflow

### 1) PR を作る（Draft 推奨）

- まずは Draft PR で OK（WIPの共有）
- この時点では `run-ci` は付けない
- ラベルを付ける必要もありません（軽いCI は常に走ります）

### 2) レビュー準備ができたら

- `ready-for-review` を付ける
- PR 説明（What/Why）、DoD、影響範囲、ロールバックをPR本文に書く
- Projects Board の Review 列に自動移動します

### 3) 重いCI を回す

- `run-ci` を付ける（e2e-smoke / storybook-a11y / fast-lane / lighthouse-ci が起動）
- Projects Board の CI/Verify 列に移動する（自動化されている場合）

### 4) マージ条件（最低限）

- Required checks が green
- PR本文のDoDが満たされている
- ロールバック手順が書かれている（必要な場合）

### Tips

- **Draft → Ready** の段階で早期フィードバック（軽いCI で十分）
- **Ready → run-ci** で最終確認（重いCI）
- **重いCIは必要なときだけ**：ラベル無しなら e2e-smoke / storybook は走りません

詳細は [docs/LABELS.md](../docs/LABELS.md) / [docs/PROJECT_BOARD.md](../docs/PROJECT_BOARD.md) を参照。

## Preflight before PR

Run the appropriate safety net locally before opening a Pull Request:

```bash
# Quick check (lint + typecheck + unit tests)
npm run preflight

# Full check (includes build + E2E schedules smoke)
npm run preflight:full
```

**Recommended workflow:**
- **Daily/PR prep:** `npm run preflight` (2-3 min)
- **Before landing:** `npm run preflight:full` (5-8 min)
- **CI pipeline:** Runs subset checks defined in `.github/workflows/` (type checking, Users E2E, linting)

If a preflight fails, address the issue and re-run the same command locally before pushing new commits.

## Test Isolation & CI Stability

Maintaining a 100% green CI is a shared responsibility. We use a **Hybrid Isolation** model to ensure tests are fast yet deterministic.

### 🧪 Key Rules for Vitest
- **Stubs are Persistent**: Browser API stubs (localStorage, matchMedia) are globally managed in `vitest.setup.ts`.
- **Global Reset Prohibition**: 🚫 DO NOT use `vi.unstubAllGlobals()` in `afterEach`. This breaks the structural lock for concurrent or lazy-loaded tests.
- **Data Reset**: Storage is cleared automatically in `beforeEach`.
- **Timeouts**: Heavy UI tests should use a higher `findBy` timeout (up to 30s) to survive CI load.

For a deep dive into the architecture, see [docs/ci-stabilization.md](docs/ci-stabilization.md).

## Local E2E testing (Schedules smoke suite)

For stable local E2E runs without TTY suspension issues, use this pattern:

```bash
# Clean up any existing port usage, start dev server (TTY-free), wait for ready, run E2E, cleanup
lsof -ti :5173 | xargs -r kill -9 && \
nohup npm run dev:5173 </dev/null > /tmp/vite-5173.log 2>&1 & \
sleep 1 && npx wait-on http://127.0.0.1:5173/ --timeout 60000 && \
curl -I http://127.0.0.1:5173/ 2>&1 | head -3 && \
BASE_URL=http://127.0.0.1:5173 npx playwright test tests/e2e/schedule-day.aria.smoke.spec.ts --project=chromium --reporter=line && \
lsof -ti :5173 | xargs -r kill -9
```

**Why this approach:**
- **Avoid `npm run dev &` in terminal** (causes TTY suspension when stdin is not redirected)
- `nohup ... </dev/null` prevents TTY suspension (main cause of dev server hangs)
- `wait-on` confirms HTTP 200 before running tests
- `curl` validates connectivity before E2E
- `lsof -ti :5173 | xargs -r kill` cleans up only the dev server (not other Node processes)

**Troubleshooting:**
- If `wait-on` times out: check `/tmp/vite-5173.log` tail for startup errors
- If playwright times out: verify curl returns HTTP 200 first

- スケジュール週ビューを変更した場合: `npm run test:schedule-week`

## Playwright Smoke テスト実行

Mobile Chrome smoke テストの実行ガイドは [`docs/PLAYWRIGHT_SMOKE_RUNBOOK.md`](docs/PLAYWRIGHT_SMOKE_RUNBOOK.md) を参照してください。
基本的には `npx playwright test --config=playwright.smoke.config.ts --reporter=line` で、`CONNECTION_REFUSED` が出た場合のトラブルシューティングも記載されています。

## E2E Skip Reduction Strategy (Schedule Suite)

When improving Schedule E2E test coverage, classify skips into **categories**:

| Category | Pattern | Action |
|----------|---------|--------|
| **A** | Root existence, empty state | ✅ Fix by supporting empty state (make tests pass without data) |
| **B** | Data-dependent assertions | ✅ Add env guard (e.g., `E2E_HAS_SCHEDULE_DATA=1` to enable) |
| **C** | Environment-specific (feature flags, SharePoint, UI divergence) | 🤔 Decide: CI fixture vs. integration-only vs. keep skipped |

**Current Category C Inventory (20 skips):**
- **5 skips** in `popover.spec.ts` — Test scaffold placeholders (unimplemented)
- **14 true-fixed skips** — Environment dependencies (no data, feature unavailable, UI divergence in Preview mode)
- **2 SharePoint-only skips** — Require real persistence (fixtures don't save edits); candidate for integration env or `IS_FIXTURES` gate

**Decision framework for C:**
1. **Unimplemented tests** (e.g., popover) → Keep skipped until feature ready
2. **Data-dependent** (no events) → Add `E2E_HAS_SCHEDULE_DATA=1` guard (same as Category B)
3. **Preview UI divergence** (`IS_PREVIEW` guard) → Acceptable; only skip in preview mode
4. **SharePoint persistence** (`IS_FIXTURES` guard) → Acceptable; only skip in fixtures mode
5. **Feature flags unavailable** → Skip with clear reason; revisit when flag enabled

**When PRing skip reductions, explain:** "This skip is Category {A|B|C}, and here's why we can safely remove/gate it."

## Nurse medication layout updates

- When touching the nurse medication layout (`src/features/nurse/medication/MedicationRound.tsx`), refresh the visual baselines locally:

  ```bash
  VITE_SKIP_LOGIN=1 npx playwright test tests/e2e/nurse.med.visual.spec.ts --update-snapshots
  ```

- Commit the updated assets under `tests/e2e/__screenshots__/nurse.med.visual.spec.ts/`.
- The spec relies on `TESTIDS.NURSE_MEDS_GRID_SUMMARY` and `TESTIDS.NURSE_MEDS_GRID_CONTROLS`; keep these identifiers intact when editing the markup.
- Ensure the nurse workspace flags remain enabled by setting `VITE_FEATURE_NURSE=1` (CI uses the same env alongside `VITE_SKIP_LOGIN=1`).

## Architecture & Lint

### Boundaries Rule
- **Current Status**: ESLint `boundaries/element-types` is set to **`off`** in both CI (`npm run lint`) and pre-push hook to maintain consistency.
- **Rationale**: Prevents "passes CI but blocks local push" pattern that leads to `--no-verify` abuse.
- **Improvement Plan**: Boundaries violations are tracked separately for incremental architectural refactoring in dedicated sprints.

### PR Updates (Avoiding Loss)
- **Preferred**: Use GitHub "Update branch" button or `git merge origin/main` to resolve BEHIND status.
- **Avoid**: `git rebase origin/main` on PRs that are BEHIND can cause commit loss if branch state is unclear.
- **Why**: Rebasing a BEHIND branch may eliminate unique commits, leading to PR closure without merge (see PR #472 incident).
