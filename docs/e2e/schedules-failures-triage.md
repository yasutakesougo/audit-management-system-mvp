# Schedules E2E Failures Triage (Batch)

## Goal
- 既存 failures を「原因カテゴリ」に分解し、直し方針（Fix / Skip / Refactor）を決める。
- 1 failure = 1 issue に落とせる粒度にする。

## Run Context
- Date:
- Branch:
- Command:
- Env (key flags):
  - VITE_E2E_FORCE_SCHEDULES_WRITE=
  - VITE_SKIP_SHAREPOINT=
  - VITE_FEATURE_SCHEDULES_WEEK_V2=

## Categories (choose one)
- Locator drift (testid/role/text changed)
- Navigation / route guard (gate / redirect / tab state)
- Timing / wait condition (async render / debounce / networkidle)
- Fixture / seed mismatch (data not present, date out of range)
- Feature-flag mismatch (flag assumptions differ)
- SharePoint / integration dependency (should be gated/skip or mocked)
- Actual product bug (real defect)
- Flaky (non-deterministic; needs stabilization)

## Failure Table
| Spec | Test | Symptom | Category | Quick Fix | Proper Fix | Owner | Issue |
|---|---|---|---|---|---|---|---|

## Notes / Patterns
- (例) "getByRole(tab, name=Week)" が複数ヒット → locator drift
- (例) "LIST_CHECK_PENDING" → gate / env mismatch