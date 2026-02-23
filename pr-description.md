## feat(attendance): classify persist errors in hook and unify snackbar handling

### What
- Added error classification to useAttendanceActions
  - CONFLICT (412/409)
  - THROTTLED (429/503)
  - NETWORK
  - UNKNOWN
- Unified error handling in AttendanceRecordPage via showAttendanceError
- Ensured rollback correctness by making persist propagate failures
- Added minimal unit tests for classification logic

### Why
- Prevent silent persist failures breaking optimistic rollback
- Provide actionable feedback to staff (refresh / wait / check network)
- Keep UI clean: Page handles presentation, Hook handles operational correctness

### Design Notes
- Snapshot for rollback captured inside setVisits(prev => ...)
- Hook re-throws classified errors
- Repository-level ETag/412 handling remains unchanged
- UI layer has no SharePoint-specific branching

### Manual QA
- [ ] CheckIn optimistic update works
- [ ] CheckOut optimistic update works
- [ ] Failure rolls back correctly
- [ ] Error message matches classification
- [ ] No regression in absence flow

### Tests
Added:
- useAttendanceActions.classify.spec.ts
  - 409/412 → CONFLICT
  - 429/503 → THROTTLED
  - Network-like error → NETWORK
  - Unknown error → UNKNOWN
  - isAttendanceError type guard

All new tests passing.

### Risk
Low.
Only affects attendance hook + page error handling.
Rollback correctness improved.
