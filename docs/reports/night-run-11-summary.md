# Night Run 11 — useStaffForm Tests + Section Smoke Tests

**Date:** 2026-03-10
**Goal:** Capitalize on Night Run 10's hook/component split by adding focused unit tests for `useStaffForm` and light render tests for all 6 section components.

---

## Files Created

| File | Tests | Type |
|------|-------|------|
| `src/features/staff/__tests__/useStaffForm.spec.ts` | **47** | Hook unit tests (renderHook + vi.mock) |
| `src/features/staff/__tests__/StaffFormSections.spec.tsx` | **33** | Section component render tests |
| **Total new tests** | **80** | |

---

## Test Coverage Per File

### useStaffForm.spec.ts (47 tests)

| Group | Tests |
|-------|-------|
| Initial state — create mode | 9 |
| Initial state — update mode | 6 |
| setField | 3 |
| isDirty tracking | 1 |
| toggleWorkDay | 4 |
| toggleBaseWorkingDay | 3 |
| toggleCertification | 3 |
| removeCertification | 3 |
| handleAddCustomCertification | 4 |
| setCustomCertification | 1 |
| setMessage | 2 |
| handleClose | 5 |
| refs | 2 |

**Mock strategy:** `vi.mock('@/stores/useStaff')` with `mockCreateStaff` / `mockUpdateStaff` fns. No SharePoint, no MSW, no render.

### StaffFormSections.spec.tsx (33 tests)

| Component | Tests |
|-----------|-------|
| `StaffFormHeader` | 4 |
| `StaffFormBasicInfoSection` | 5 |
| `StaffFormContactSection` | 6 |
| `StaffFormShiftSection` | 6 |
| `StaffFormWorkDaysSection` | 4 |
| `StaffFormCertSection` | 8 |

**Mock strategy:** None needed. All section components are pure presentational — render() from @testing-library/react with minimal prop fixtures.

---

## Validation Results

| Check | Result |
|-------|--------|
| New tests (focused run) | ✅ **80/80 PASS** |
| Full suite | ✅ **3,230 passed, 38 skipped, exit code 0** |

---

## Running Test Count

| Run | Tests Added | Cumulative |
|-----|-------------|-----------|
| Night Run 5 | 30 | 30 |
| Night Run 6 | +6 (regression) | 36 |
| Night Run 7 | pipeline tests | 36 |
| Night Run 8 | +1 guard test | 36 |
| Night Run 9 | +31 serviceProvision | 67 |
| Night Run 10 | 0 (structure) | ~2,451 total |
| **Night Run 11** | **+80** | **~3,231 total** |

---

## Technical Notes

### Hook Test Pattern
```ts
const mockCreateStaff = vi.fn();
vi.mock('@/stores/useStaff', () => ({
  useStaff: () => ({ createStaff: mockCreateStaff, updateStaff: mockUpdateStaff, ... }),
}));

const { result } = renderHook(() => useStaffForm({ mode: 'create' }));
act(() => { result.current.toggleWorkDay('Mon'); });
expect(result.current.values.WorkDays).toContain('Mon');
```

### handleClose guard coverage
- No dirty + onClose → fires immediately ✅
- Dirty + `confirm()` returns true → onClose fires ✅
- Dirty + `confirm()` returns false → onClose suppressed ✅
- No onClose provided → no throw ✅

### Section component disabled-state assertion
```ts
// 追加 button is disabled when customCertification is empty
const addBtn = screen.getByRole('button', { name: '追加' }) as HTMLButtonElement;
expect(addBtn.disabled).toBe(true);
```

---

## Next Recommended Steps

1. **handleSubmit branch coverage** — mock `createStaff()` to resolve/reject and assert `message`, `isSaving`, `onSuccess/onDone` callbacks (requires async act).
2. **keyboard shortcut tests** — verify Ctrl+Enter triggers `formRef.current.requestSubmit()` and Escape triggers `handleClose`.
3. **Fix `BulkDailyRecordList` flaky timeout** — pre-existing 5000ms timeout, unrelated to staff feature.
4. **Next heavy form target** — per Wave 3 KI roadmap: `BusinessJournalPreviewPage`, `IBDDemoPage`, or `navigationConfig`.
