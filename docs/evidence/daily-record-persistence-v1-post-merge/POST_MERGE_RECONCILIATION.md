# DAILY-RECORD-PERSISTENCE-V1 Post-Merge Reconciliation

Read-only confirmation that PR #2549 landed on `main` as exact-head `43655e86`, that the append-version contract is intact, and that remaining red CI is **not** a persistence regression.

## Verdict

| Gate | Status |
|---|---|
| Merge identity | **PASS** — `15111c42` = `1c8f4505` + `43655e86` |
| ADR-025 on `main` | **PASS** — Accepted 2026-08-27 |
| Saver child DELETE | **PASS** — save path uses child POST + parent MERGE only |
| Local persistence unit tests | **PASS** — 10 files / 106 tests |
| CI Preflight on merge commit | **PASS** — run [33044439152](https://github.com/yasutakesougo/audit-management-system-mvp/actions/runs/33044439152) |
| CI unit shards / Quality / fast / CSP | **PASS** — see terminal table below |
| E2E Deep | **EXPECTED RED (confirmed)** — 6/6 Chromium lanes fail; **34/34 failure keys identical** to pre-merge exact-head and `main` nightly. Deep Lane Union Audit **success**. |
| Live schema provisioning | **OPEN** — separate Gate (ADR 対象外) |
| Deploy | **NOT AUTHORIZED** until live schema Gate |

**Do not revert `15111c42` because E2E Deep is red.** That failure set is pre-existing on `main` and classified independently.

## Merge identity

| Item | Value |
|---|---|
| PR | [#2549](https://github.com/yasutakesougo/audit-management-system-mvp/pull/2549) |
| Merged at | 2026-08-27T06:02:08Z by `yasutakesougo` |
| Merge commit | `15111c423c51860feb280c22dae074b282b799ed` |
| First parent (`main`) | `1c8f4505ca27cb538aa722b1117c1eafcdf58880` |
| Second parent (exact-head) | `43655e8693b7dda4e34562abd2dfa041cf8fb9bc` |
| Diff vs pre-merge `main` | 26 files, +3210 / −205 — same as PR #2549 |

No extra commits were squashed or rewritten. The landed tree is the exact-head that E2E-DEEP-FAILURE-RECONCILIATION-V1 classified.

## Contract that landed

`DAILY_RECORD_PERSISTENCE_V1` on `main`:

- `writeRule: APPEND_NEW_VERSION`
- `existingChildDelete: PROHIBITED`
- `commitPoint: SupportRecord_Daily.LatestVersion+LatestCommitId`
- `readRule: LATEST_VERSION_AND_COMMIT_ID`
- `integrityFailure: HOLD_UNKNOWN`
- `parentCommit: SNAPSHOT_BOUND_ETAG_CAS`

`DailyRecordSaver.save` on `main`:

- Creates a `CommitId` per save attempt
- Resolves/creates parent via `resolveOrCreateParentForSave`
- Binds pointer + ETag with `readParentCommitSnapshot` (atomic GET)
- POSTs new `DailyRecordRows` with `Version` + `CommitId`
- MERGEs parent `LatestVersion` + `LatestCommitId` with snapshot-bound IF-MATCH
- No `X-HTTP-Method: DELETE` on the save path

Covered by `Saver.spec.ts`: *appends Version+CommitId children and commits LatestVersion+LatestCommitId without DELETE (AC-1, AC-2, AC-3, AC-15)*.

## Local verification (this agent, post-checkout of `origin/main`)

```text
npx vitest run
  src/features/daily/domain/persistence/__tests__/dailyRecordPersistence.spec.ts
  src/features/daily/domain/integrity/__tests__/dailyIntegrityChecker.test.ts
  src/features/daily/repositories/sharepoint/__tests__/DailyRecordSchemaDrift.spec.ts
  src/features/daily/repositories/sharepoint/__tests__/SharePointDailyRecordRepository.saveLookup.spec.ts
  src/features/daily/repositories/sharepoint/modules/DataAccess.spec.ts
  src/features/daily/repositories/sharepoint/modules/IntegrityScanner.spec.ts
  src/features/daily/repositories/sharepoint/modules/Saver.spec.ts
  src/features/daily/repositories/sharepoint/modules/dailyRecordSpHttpErrors.spec.ts
  src/sharepoint/fields/__tests__/dailyFields.drift.spec.ts
  src/features/daily/hooks/__tests__/useDailyIntegrityExceptions.spec.ts

Test Files  10 passed (10)
     Tests  106 passed (106)
```

No SharePoint mutation. No deploy. No workflow rerun.

## Post-merge CI (merge commit `15111c42`) — terminal

Push-event checks on `15111c42`: **6 failed / 30 succeeded / 2 skipped** (`quality_extended` skipped on push; Integration Scenarios skipped off-schedule). The 6 failures are exactly the Deep Chromium lanes.

| Workflow | Run | Conclusion |
|---|---|---|
| CI Preflight | [33044439152](https://github.com/yasutakesougo/audit-management-system-mvp/actions/runs/33044439152) | **success** |
| CI (typecheck + unit shards 1–3) | [33044439184](https://github.com/yasutakesougo/audit-management-system-mvp/actions/runs/33044439184) | **success** |
| Quality Gates (`quality` + `canary`) | [33044439247](https://github.com/yasutakesougo/audit-management-system-mvp/actions/runs/33044439247) | **success** |
| fast-lane | [33044439167](https://github.com/yasutakesougo/audit-management-system-mvp/actions/runs/33044439167) | **success** |
| CSP Guard | [33044439217](https://github.com/yasutakesougo/audit-management-system-mvp/actions/runs/33044439217) | **success** |
| schedule-guardrails | [33044439156](https://github.com/yasutakesougo/audit-management-system-mvp/actions/runs/33044439156) | **success** |
| storybook-a11y | [33044439166](https://github.com/yasutakesougo/audit-management-system-mvp/actions/runs/33044439166) | **success** |
| pre-deploy-gate | [33044439177](https://github.com/yasutakesougo/audit-management-system-mvp/actions/runs/33044439177) | **success** |
| Report Links | [33044439230](https://github.com/yasutakesougo/audit-management-system-mvp/actions/runs/33044439230) | **success** |
| E2E Deep Tests | [33044439186](https://github.com/yasutakesougo/audit-management-system-mvp/actions/runs/33044439186) | **failure** (6 lanes) + Deep Lane Union Audit **success** |

### E2E Deep key identity (post-merge vs pre-merge)

| Run | SHA | Failed keys | only-this-side |
|---|---|---|---|
| Post-merge push [33044439186](https://github.com/yasutakesougo/audit-management-system-mvp/actions/runs/33044439186) | `15111c42` | 34 | none |
| PR #2549 exact-head [33041195913](https://github.com/yasutakesougo/audit-management-system-mvp/actions/runs/33041195913) | `43655e86` | 34 | none |
| `main` nightly [33037472202](https://github.com/yasutakesougo/audit-management-system-mvp/actions/runs/33037472202) | `1c8f4505` | 34 | none |

Spec digest unchanged: `6b5f6fe8025ace1807a571c11fa704ec9ae612cce1265f5ba15f60d565094163`. JUnit identities 333. Bootstrap pass. True-flaky 0.

Per-lane JUnit matches pre-merge exact-head: app-a11y 11/13, fixture-memory 10/14, sp-stub 7/15, transport-date-check 3/3, implementation-hot 2/14, general 1/274. The only error-text delta is the generated CRUD timestamp in `users-crud.integration` (`統合テスト太郎_<epoch>`).

Checklist `docs/runbooks/post-merge-checklist.md` says “stop on main FAILURE”. That rule applies to **new** failures. These 6 lanes are the same pre-existing set classified in E2E-DEEP-FAILURE-RECONCILIATION-V1.

## Live schema — still a separate Gate

ADR-025 explicitly excludes list/column provisioning. Code + tests shipped first. Live apply is **not** in this merge.

| Contract | Code | Provisioning on `main` |
|---|---|---|
| Parent `LatestVersion` | resolver + saver + tests | **not** in `daily.ts` `provisioningFields` / `DAILY_RECORD_CANONICAL_ENSURE_FIELDS` |
| Parent `LatestCommitId` | same | **not** provisioned |
| Child `Version` | saver + tests | present in `support_record_rows.provisioningFields` (`governance: allow`, silent) |
| Child `CommitId` | saver + tests | **not** in `provisioningFields` |
| Parent `Title` EnforceUniqueValues | `DAILY_RECORD_PARENT_STORAGE_UNIQUENESS` + 409 adopt-existing | apply is a separate Gate |

Until those columns exist in the live SharePoint site, runtime save will fail closed (lookup `$select` / POST schema errors → abort, zero Parent/Child mutations). That is the intended HOLD, not a silent DELETE recreate.

## Deploy / SharePoint

- Deploy: **NOT AUTHORIZED**
- SharePoint mutation: **not performed**
- Production save against live lists: **do not enable** until the schema Gate lands

## Follow-up (not this merge)

1. Schema Gate: add `LatestVersion`, `LatestCommitId` to parent ensure/provisioning; add `CommitId` to child rows; apply Title unique index.
2. Keep E2E Deep follow-ups on harness PRs (stale testids, demo-vs-SP stub lane contract, fixture cardinality) — see PR #2552. Do not patch persistence to “fix” those 34 keys.
3. Quality Gates / unit shards on `15111c42` completed **success**. No additional persistence follow-up from those jobs.

## Machine-readable companion

[`POST_MERGE_RECONCILIATION.json`](./POST_MERGE_RECONCILIATION.json)
