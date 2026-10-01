# E2E-DEEP-FAILURE-RECONCILIATION-V1

Read-only classification of the six failed Chromium lanes on PR #2549 exact-head `43655e8693b7dda4e34562abd2dfa041cf8fb9bc`.

## Boundary (honored)

- DAILY-RECORD-PERSISTENCE-V1 production code: **not changed**
- PR #2549: **no additional commits**
- Workflow rerun: **not performed**
- Deploy / SharePoint mutation: **not performed**
- Method: existing GitHub Actions artifacts + source inspection

## Verdict

**0 / 6 lanes are caused by the PR #2549 diff.**

All six lanes already fail on `main` (`1c8f4505`) with the **same 34 failure keys**. Deep Lane Union Audit passed on both runs. Six bootstraps were healthy. True-flaky count was 0. Daily-record E2E in the `general` lane passed.

PR #2549 E2E Deep HOLD is therefore **unrelated** to DAILY-RECORD-PERSISTENCE-V1.

## Evidence pins

| Item | PR #2549 exact-head | main nightly |
|---|---|---|
| SHA | `43655e8693b7dda4e34562abd2dfa041cf8fb9bc` | `1c8f4505ca27cb538aa722b1117c1eafcdf58880` |
| E2E Deep run | [33041195913](https://github.com/yasutakesougo/audit-management-system-mvp/actions/runs/33041195913) (`pull_request`) | [33037472202](https://github.com/yasutakesougo/audit-management-system-mvp/actions/runs/33037472202) (`schedule`) |
| Union failed keys | 34 | 34 |
| Keys only on this side | none | none |
| Spec digest | `6b5f6fe8025ace1807a571c11fa704ec9ae612cce1265f5ba15f60d565094163` | same |
| Owned specs / JUnit identities | 190 / 333 | 190 / 333 |
| Bootstrap / true-flaky | pass / 0 | pass / 0 |
| Deep Lane Union Audit | success | success |
| Setup failure step (all 6 lanes) | `none` | `none` |

PR #2549 changed 26 files, all under daily persistence / ADR / health-store test timestamps. No `tests/e2e/**` files and no UI of the failing surfaces (call-logs, exception-center, users list, ISP editor, transport assignments, planning-sheet reverse-bridge copy).

## Classification key

Each lane gets **one primary class**. `main既存障害` is recorded separately because it is overlay evidence (identical failure-key set), not a competing root cause.

| Class | Meaning in this report |
|---|---|
| PR #2549差分起因 | Failure keys appear on exact-head and not on `main`, **and** the failing surface is in the PR diff |
| main既存障害 | Same failure keys already fail on `main` `1c8f4505` |
| fixture drift | Seed / fixture cardinality or identity does not match what the spec asserts |
| environment contract | Lane runtime (`VITE_SKIP_SHAREPOINT` / `VITE_DEMO_MODE` / `VITE_DATA_PROVIDER`) does not match what the spec injects (`setupSharePointStubs`, `/_api` mocks, offline SP lane) |
| stale expectation | Spec asserts DOM copy or testids that production no longer (or never) renders |

## Lane results

| Lane | JUnit | Primary class | PR-diff? | main既存? | Contributing |
|---|---|---|---|---|---|
| app-a11y | 11 fail / 13 | **stale expectation** | no | yes (11/11 keys) | — |
| fixture-memory | 10 fail / 14 | **fixture drift** | no | yes (10/10 keys) | environment contract, stale expectation |
| sp-stub | 7 fail / 15 | **stale expectation** | no | yes (7/7 keys) | environment contract |
| transport-date-check | 3 fail / 3 | **environment contract** | no | yes (3/3 keys) | fixture drift |
| implementation-hot | 2 fail / 14 | **environment contract** | no | yes (2/2 keys) | fixture drift |
| general | 1 fail / 274 | **stale expectation** | no | yes (1/1 keys) | fixture drift |

Partition of **primary** class: PR-diff 0, main-as-primary 0 (used as overlay), fixture drift 1, environment contract 2, stale expectation 3.

---

### 1. app-a11y → stale expectation

Runtime: `demo` / `VITE_SKIP_SHAREPOINT=1` / `VITE_FEATURE_USERS_SP=0`. Setup passed. Classification `deep_tests_failed`.

| Spec | Symptom |
|---|---|
| `call-logs.usability` skip-to-main (empty + populated, light/dark) | `getByTestId('skip-to-main-link')` not found / not focused |
| `call-logs.usability` mobile populated (light/dark) | `call-log-list` not found |
| `exception-center.usability` (4) | `exception-center-page` not found (20s) |
| `users.usability` skip link | `skip-to-main-link` not found |

Independent source check:

- `skip-to-main-link` has **zero** matches under `src/`.
- `ExceptionCenterPage.tsx` has **no** `data-testid`. Specs wait for `exception-center-page`.
- `call-log-list` exists, but only when `filteredLogs.length > 0`. Empty mobile cases **passed**, so the page boots; populated seed does not produce a list, and skip-link cases never could pass.

Not PR-diff: call-logs / exception-center / skip-link are outside the daily persistence diff. Identical 11 keys on main.

---

### 2. fixture-memory → fixture drift

Runtime: `demo-memory` / `VITE_DATA_PROVIDER=memory` / `VITE_FEATURE_USERS_SP=1`. Setup passed.

| Spec | Symptom | Sub-cause |
|---|---|---|
| `users-dashboard-happy-path` | row count expected 3, received 4 | fixture drift (`users.master.dev.v1.json` has 3 users; demo store adds a fourth) |
| `users-search-filter` | `users-panel-open` is hidden | stale expectation (`UsersPanel` renders the control with `display: none`) |
| `users-basic-edit-flow` / `users-crud.integration` | seeded / generated names not in list | fixture drift (CRUD timestamp in error text differs PR vs main; same locator miss) |
| `fortress` (2) | `不備データ 太郎` / `MISSING-001` not found | environment contract (spec injects SharePoint `Users_Master` into a memory lane) |
| `nurse-dashboard-happy-path` | `nurse-dashboard-root` not found | stale expectation (testid lives only in `src/testids.ts`) |
| `agenda-happy-path` | `合計 3件` not found | fixture drift |
| `irc-reliability` | `田中 太郎` not found | fixture drift |
| `exception-center.transport-missing-driver-flow` | transport missing-driver row not found | fixture drift |

Counter-evidence that daily persistence is not implicated: `exception-center.daily-child-flow` and `exception-center.handoff-child-flow` **passed** in this same lane.

Only error-text delta vs main is the generated CRUD name timestamp (`統合テスト太郎_1787807290640` vs `_1787803235259`). Same failure key.

---

### 3. sp-stub → stale expectation (environment contract contributing)

Runtime: `sp-stub` / `VITE_SKIP_SHAREPOINT=0` / `VITE_FORCE_SHAREPOINT=1` / `VITE_DEMO_MODE=0` / `VITE_DATA_PROVIDER=sharepoint`. Setup passed. Lane runtime contract validation succeeded.

| Spec | Symptom | Sub-cause |
|---|---|---|
| `isp-editor.integration` heading (3) | heading `/個別支援計画 前回比較・更新エディタ/` not found | stale expectation — production title is `個別支援計画 比較・更新エディタ` (`ISPComparisonEditorView.tsx`) |
| `isp-editor.integration` error banner | `locator('[role="alert"]')` matches 2 nodes | stale expectation (strict-mode locator) |
| `hub-entry-experience.ssot` viewer/admin | `nav-support-plan-guide` / `nav-analysis` not found | environment contract (`VITE_TEST_ROLE` init-script vs baked preview env) |
| `dashboard.sp-lane.error` | `data-state` expected `error`, received `""` | environment contract (offline `navigator.onLine=false` does not drive SP-lane error in this preview) |

`transport-assignments-integration.spec.ts` (5/5) **passed** in this lane, so SP-stub transport plumbing is not globally broken.

---

### 4. transport-date-check → environment contract

Runtime: `demo` / `VITE_SKIP_SHAREPOINT=1` / `VITE_DEMO_MODE=1` / `VITE_DATA_PROVIDER=memory`. Setup passed.

All three owned specs call `setupSharePointStubs` and freeze time at `2026-03-25` (Wednesday JST). The lane preview is demo/memory, so those SharePoint items are not the data source.

| Spec | Symptom |
|---|---|
| week bulk apply | summary received `月 変更なし / 火 変更なし / 水 変更なし / 木 変更なし / 金 変更なし` (expected `水 1件`) |
| users TransportCourse → assignments | vehicle card 1 is empty assignment chrome; expected `鈴木 美子` |
| save reflects in today | boolean assertion `true` vs `false` after assign/unassign |

This is a lane/spec contract mismatch, already present on main. Not daily persistence.

---

### 5. implementation-hot → environment contract

Runtime: same demo/memory contract as transport-date-check.

| Spec | Result |
|---|---|
| `staff-form.flow.spec.ts` | **12/12 passed**, including update flow for `佐藤 花子` |
| `transport-assignments-repository-flow` concurrency ETag | 120s timeout waiting for `getByRole('option', { name: /佐藤/ })` |
| `transport-assignments-repository-flow` coordination errors | same timeout |

The failing spec stubs `Staff_Master` with `FullName: '佐藤'` and `Role: 'driver'`. The lane does not use SharePoint. Demo staff that satisfy the staff form (`佐藤 花子`) are not offered as a **driver** option, so the click never proceeds to the ETag conflict path.

---

### 6. general → stale expectation

Runtime: `demo-memory`. 211 passed / 1 failed / 62 skipped (smoke inverted).

**Only failure:** `support-date-governance.spec.ts` → `Reverse-Bridge suggestions in Step 8 populate monitoring text fields` waiting for `確信度: 中`.

Independent source check:

- Comment in the spec: “since we have 3 records”.
- The same spec stubs `SupportRecord_Daily` as `[]`.
- `useReverseBridge` reads `executionStore.getRecords`, not the SharePoint daily list.
- `buildReverseBridgeSuggestions` returns `confidence: 'none'` when `recordCount === 0`.
- `SectionMonitoring` does **not render** the confidence chip when `confidence === 'none'`.

So the assertion is stale relative to both the empty stub and the current reverse-bridge contract.

#### Daily persistence E2E in this lane (all passed)

This is the gate evidence that PR #2549 did not regress daily recording:

- `daily.table.spec.ts` (direct route, hub open, draft lifecycle, unsent recovery)
- `daily.records-flow.spec.ts`
- `daily-pdca.integration.spec.ts`
- `daily-record-menu.spec.ts` (11 cases)
- `records-daily.spec.ts`
- `procedure-17row-bridge.spec.ts` (2)
- `kiosk-procedure-*` / `kiosk-toilet.spec.ts`
- `handoff-daily.phase1` / `phase2-1`
- `exception-center.daily-child-flow` (owned by fixture-memory, also passed)

---

## What this is not

- Not a flaky-lane problem: true-flaky count 0 on both runs; retries 68 evaluated, none classified flaky.
- Not a bootstrap / runtime-contract validation failure: `setup_failure_step=none`, bootstrap status `pass`, lane `env.runtime.json` check ran before tests.
- Not a taxonomy / ownership problem: Deep Lane Union Audit success, 0 duplicate specs, 0 duplicate JUnit identities, 0 duplicate failure keys.
- Not a reason to patch DAILY-RECORD-PERSISTENCE-V1 or to rerun `e2e-deep.yml`.

## Follow-up (out of scope here)

These belong on dedicated test-harness PRs, not on PR #2549:

1. **stale expectation:** drop or rewrite `skip-to-main-link` / `exception-center-page` / ISP heading `前回比較・更新` / Reverse-Bridge `確信度: 中` without seeded execution records.
2. **environment contract:** move SharePoint-stub transport specs onto `sp-stub` (or give those specs a demo-memory seed path). `transport-date-check` and `implementation-hot` currently own SP-stub tests while building a demo preview.
3. **fixture drift:** reconcile `users.master.dev.v1.json` (3) with the demo store (4), and stop injecting SharePoint malformed users into the memory lane.

## Machine-readable companion

[`LANE_CLASSIFICATION.json`](./LANE_CLASSIFICATION.json)
