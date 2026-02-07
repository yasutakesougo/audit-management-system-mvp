# Phase 2-1: Complete Write-System Error Handling (2-1a/2-1b/2-1c)

## What

Complete 3-phase implementation of Result-based error handling for schedule CRUD operations:

- **2-1a**: Convert `port.create/update` from exceptions to `Promise<Result<SchedItem>>`
- **2-1b**: Map HTTP 412 Precondition Failed → `result.conflict()` with etag metadata
- **2-1c**: Display conflict errors in UI with MUI Snackbar + refetch recovery

## Scope

### Write-System Changes
- ✅ All adapters (demoAdapter, graphAdapter, sharePointAdapter, createAdapters) return `Promise<Result<SchedItem>>`
- ✅ Port interface updated: `create/update return Promise<Result<SchedItem>>`
- ✅ useSchedules hook unwraps Result, captures conflict errors

### Error Handling Strategy
- **Conflicts (HTTP 412)**: Displayed in UI with "最新を表示" recovery button
- **Validation/Forbidden/NotFound/Unknown**: Silent (console.warn only, no UI)
- **Other HTTP errors**: Mapped to appropriate ResultError kinds

### UI Changes (Minimal)
- **File**: `src/features/schedules/WeekPage.tsx`
- **Change**: Single Snackbar component added for conflict display only
- **Action**: Clicking "最新を表示" calls `refetch()` → reloads list from server

### Files Modified
1. `src/shared/result.ts` - Result type with generic T, conflict/forbidden/notFound/validation/unknown kinds
2. `src/features/schedules/data/port.ts` - Promise<Result<SchedItem>> signatures
3. `src/features/schedules/useSchedules.ts` - lastError state + clearLastError + refetch handlers
4. `src/features/schedules/WeekPage.tsx` - Conflict Snackbar + Button import
5. Adapters - All return Promise<Result<SchedItem>>
6. Tests - Phase 2-1a/2-1b test files added

## Quality Gates ✅

```bash
npm run typecheck  # ✅ Passed
npm run lint       # ✅ Passed (max-warnings=0)
npm test -- --run  # ✅ 269 files, 1598 tests passing
npm run health     # ✅ All gates pass
```

## Manual Testing

### Test Conflict Recovery Flow

1. **Trigger etag mismatch locally** (simulated):
   ```bash
   # Open browser DevTools → Network
   # Create a schedule
   # Manually modify the schedule in another tab
   # Try to update original → catches 412
   ```

2. **Verify Snackbar appears**:
   - Yellow warning alert appears at bottom-center
   - Shows "更新が競合しました（最新を読み込み直してください）"
   - "最新を表示" button visible

3. **Click "最新を表示"**:
   - Snackbar closes
   - Schedule list refreshes with latest data
   - Previous error dismissed

4. **Verify other errors remain silent**:
   - Validation errors → console.warn only
   - Forbidden → console.warn only
   - NotFound → console.warn only
   - Check DevTools Console for warnings

## Rollback

If issues arise, revert to previous commit:

```bash
git revert <commit-hash>
```

This safely reverts all Phase 2-1 changes while maintaining git history.

## Future Phases

**2-2: Conflict Resolution UI** (Not in scope)
- Show diff between local and server versions
- Auto-merge strategy selection
- Manual field reconciliation

**2-3: Optimistic Updates** (Not in scope)
- Cache update optimistically
- Rollback on conflict
- Undo/redo support

## Dependencies

None - Phase 2-1 is self-contained and backward compatible.

## Notes

- Error handling is **non-blocking**: Conflicts displayed as notifications, not modals
- **Silent other errors**: Preserves existing behavior for non-conflict scenarios
- **Type-safe**: All Result discriminations checked at compile-time
- **Refetch pattern**: Uses token-based effect dependency, not direct port call
