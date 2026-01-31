# E2E Skip Recovery Status - Final Update (2026-01-16)

**Session Result: 103 → 106 passed (+3 tests, +2.9%)**

---

## ✅ Recovered Tests (3)

### 1. ✅ Priority 1: A11y Keyboard Navigation
- **Test:** `schedule-week.keyboard.spec.ts:39`
- **Name:** "keyboard focus moves across tabs and restores the week timeline"
- **Status:** RECOVERED
- **Implementation:** Roving tabindex pattern + Arrow key focus management
- **Commits:** 3c44f97
- **Result:** +1 test passing (keyboard-only navigation now works)

---

### 2. ✅ Priority 2: UI Migration (Root Cause → Solution)
- **Test:** `schedule-week.edit.aria.spec.ts:31`
- **Name:** "clicking a timeline card opens an edit dialog with data prefilled"
- **Status:** RECOVERED via UI migration
- **Root Cause:** `enableWeekV2:false` conflicts with nightly's `E2E_VITE_FEATURE_SCHEDULES=0` override
  - Legacy `/schedule` route becomes unreachable when `/schedules` feature is disabled
  - Result: bootSchedule hangs → 60s timeout → page closed
- **Solution Applied:** Removed `enableWeekV2:false`, explicitly set `route: '/schedules/week?tab=week'`
- **Commit:** 1421d7f
- **Result:** +1 test passing (25.4s runtime, no more page closes)
- **Infrastructure:** openEditorFromRowMenu retry/backoff logic added (8a9fbd2) - reusable for other menu tests

---

### 3. ✅ Priority 3: Grid Rendering
- **Test:** `schedule-week.smoke.spec.ts:38`
- **Name:** "week tab stays active when switching views"
- **Status:** RECOVERED (via Priority 1 tab fix)
- **Reason:** Tab keyboard navigation fix (roving tabindex) enables proper day→week tab switching
- **Result:** +1 test passing

**Note:** Also fixed 2 month navigation tests (schedule-month-to-day, schedule-month.aria) - commit 385360c

---

## 📋 Deferred/Remaining (3 tests)

### All 3: `schedule-org-filter.spec.ts`
- **Status:** Skipped (feature not implemented in new UI)
- **Category:** Feature/NotImplemented
- **Tests:**
  1. `defaults to merged org view when org query param is absent`
  2. `keeps selected org when navigating weeks`
  3. `preserves org selection across week, month, and day tabs`
- **Blocker:** Organization filter (事業所別) not in `/schedules` UI
- **Recovery Path:**
  - **Option A (Recommended):** Implement org filter in `/schedules` UI (2-3 hours)
  - **Option B (Not Recommended):** Redirect tests to `/schedule` (old UI - conflicts with nightly flags)
- **Next Steps:** Requires product decision + implementation

---

## 🔑 Key Learnings

### Environment & Nightly Execution
- **nightly.sh** runs with `E2E_VITE_FEATURE_SCHEDULES=0` (disables old `/schedule` UI)
- **Constraint:** Do not use `enableWeekV2:false` in nightly tests
  - Instead, migrate to `/schedules` (new UI) by default
  - If legacy UI testing needed separately, requires custom job/config

### Test Migration Pattern
```typescript
// OLD (incompatible with nightly):
await bootSchedule(page, { enableWeekV2: false, ... });

// NEW (nightly-compatible):
await bootSchedule(page, { 
  // enableWeekV2 removed (use default: true)
  route: '/schedules/week?tab=week',
  ...
});
```

---

## 🎯 Next Recovery Priority

1. **Option A (3 hours):** Implement org filter in `/schedules` → +3 tests
2. **Backlog:** Legacy UI edge cases (if nightly environment allows separate runs)

---

## Session Metrics

| Metric | Value |
|--------|-------|
| Tests Recovered | 3 (+2.9%) |
| Commits | 4 (fixes + recovery) |
| Pass Rate | 48.4% (106/219 active) |
| Failures | 0 (maintained) |
| Key Infrastructure | openEditorFromRowMenu retry/backoff |
| A11y Improvements | WCAG 2.1 Level A (keyboard tabs) |
| Root Causes Identified | 1 (enableWeekV2:false + nightly override) |

