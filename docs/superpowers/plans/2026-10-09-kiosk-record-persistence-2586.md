# Kiosk record persistence #2586 implementation plan

**Goal:** Verify observation save, list reflection, and fresh SharePoint readback for route user 6; repair the Index Audit connection configuration.

**Architecture:** Keep the real kiosk UI, hooks, and SharePoint execution repository. Stub only SharePoint HTTP responses locally, with persisted parent/child state surviving browser reload while browser execution storage is cleared.

**Tech Stack:** TypeScript, React, Playwright, Vitest, GitHub Actions.

**Spec:** User's 2026-10-09 acceptance sequence in this chat.

## Constraints

- PR baseline: `23134a0ba648fb6c6ddc1cd0f3f24a228c3f6d7c`.
- Preserve the original checkout's dirty files and evidence.
- MERGE / DEPLOY = HOLD. No production SharePoint writes.
- Local synthetic readback does not establish real SharePoint persistence or human acceptance.
- Leave partial lookup failure without a found record fail-closed.

## Review focus

- Fresh record must survive reload without execution storage seeds.
- Legacy `N` / `row-N` records must update the existing row.
- Another procedure must remain unrecorded after a save.
- A failed lookup followed by empty candidates must remain an error.
- Audit failures must not be bypassed or called schema success.

## Tasks

- [x] Run the four existing PR-related unit suites as baseline.
- [x] Add SharePoint HTTP E2E scenarios to `tests/e2e/kiosk-procedure-detail.spec.ts`: new record, legacy `1`, legacy `row-1`; use synthetic user `Id: 6 / UserID: I005`.
- [x] Assert success feedback, list badge/content, fresh GET readback after reload, restored detail input, and unrelated card remaining unrecorded.
- [x] Reproduce the empty input hydration defect with the new E2E cases, then verify loaded-identity gating restores the records.
- [x] Repair `.github/workflows/ci.yml` by passing the configured SharePoint resource/site to Index Audit; add real CLI regressions and correct failure exit statuses.
- [x] Run related unit suites, kiosk E2E, typecheck, and lint; report every observed failure and verification limits.
- [x] Save reviewable local changes and a production acceptance checklist; recheck remote PR identity without pushing or deploying.
