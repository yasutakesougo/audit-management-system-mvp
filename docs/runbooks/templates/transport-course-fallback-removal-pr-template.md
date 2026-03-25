# TransportCourse Fallback削除 PR Template

## PR Title

`refactor(transport-course): remove legacy fallback keys after 14-day zero-hit window`

## Summary

- Remove legacy fallback key handling for transport course resolution after 14 consecutive days of `fallback_hit_count = 0`.
- Keep `TransportCourse` as the single source of truth for user transport course.
- Update tests and runbooks to reflect the end-state (fallback removed).

## Why now

- `transport-course-fallback-tracking.csv` shows `fallback_hit_count = 0` for 14 consecutive days.
- Initial baseline and subsequent daily runs confirmed:
  - fallback dependency is zero
  - backfill target count remains zero
- Legacy compatibility paths are no longer needed.

## Primary files

- `src/features/transport-assignments/domain/userTransportCourse.ts`
- `src/features/transport-assignments/domain/__tests__/userTransportCourse.spec.ts`
- `src/pages/TransportAssignmentPage.tsx`
- `docs/runbooks/transport-course-migration.md`
- `docs/design/users.md`
- `docs/design/sharepoint-lists.md`

## Changes

- Remove old fallback key resolution from `userTransportCourse.ts`.
- Make `TransportCourse` the only accepted source in transport course resolution.
- Update unit tests to fix the new SSOT behavior.
- Update migration/runbook docs from compatibility mode to completed state.

## Validation

- [ ] `npm run test -- tests/unit/users.selectFields.spec.ts tests/unit/userSchema.hierarchy.spec.ts src/features/transport-assignments/domain/__tests__/userTransportCourse.spec.ts src/features/transport-assignments/domain/__tests__/transportAssignmentDraft.spec.ts src/pages/__tests__/TransportAssignmentPage.test.tsx`
- [ ] `npm run typecheck`
- [ ] `npm run lint -- src/features/transport-assignments/domain/userTransportCourse.ts src/pages/TransportAssignmentPage.tsx src/features/users/infra/SharePointUserRepository.ts src/features/users/infra/RestApiUserRepository.ts`
- [ ] Confirm `transport-course-fallback-tracking.csv` has 14 consecutive zero-hit records.

## Implementation checklist

- [ ] Remove legacy key references from `userTransportCourse.ts`.
- [ ] Make `TransportCourse` the only resolution path.
- [ ] Update fallback-based tests and naming.
- [ ] Update runbook (Phase A-D) to completed state.
- [ ] Mention 14-day zero-hit evidence in the PR body.

## Rollback

- Revert this PR.
- Restore legacy key fallback resolution in `userTransportCourse.ts`.
- Resume daily tracking if unexpected fallback dependency is found.

## Merge gate

- `fallback_hit_count = 0` for 14 consecutive days (target window example: 2026-03-25 to 2026-04-08).
