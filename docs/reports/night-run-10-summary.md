# Night Run 10 — StaffForm.tsx Modularization

**Date:** 2026-03-10
**Goal:** Split 597-line monolithic `StaffForm.tsx` into a custom hook + 6 section components, slimming the shell to ≤ 150 lines.

---

## Files Created / Modified

### New Files

| File | Lines | Purpose |
|------|-------|---------|
| `src/features/staff/useStaffForm.ts` | 292 | Custom hook — all state and logic, no JSX |
| `src/features/staff/components/StaffFormHeader.tsx` | 28 | Header bar (PersonIcon, title, close button) |
| `src/features/staff/components/StaffFormBasicInfoSection.tsx` | 50 | スタッフID + 氏名 fields |
| `src/features/staff/components/StaffFormContactSection.tsx` | 65 | メール + 電話 + 役職 fields |
| `src/features/staff/components/StaffFormShiftSection.tsx` | 92 | 基本勤務パターン (time inputs + base weekday checkboxes) |
| `src/features/staff/components/StaffFormWorkDaysSection.tsx` | 48 | 出勤曜日 checkboxes |
| `src/features/staff/components/StaffFormCertSection.tsx` | 93 | 資格 chips + custom input + selected list |

### Modified Files

| File | Before | After | Change |
|------|--------|-------|--------|
| `src/features/staff/StaffForm.tsx` | 597 lines | **149 lines** | Shell only — imports hook + section components |

### Untouched Files (as required)

- `src/features/staff/domain/staffFormDomain.ts` — unchanged
- `src/features/staff/StaffPanel.tsx` — unchanged
- `src/features/staff/index.ts` — unchanged
- `src/features/staff/store.ts` — unchanged

---

## Final Line Count: StaffForm.tsx

**149 lines** ✅ (budget ≤ 150)

---

## Validation Results

| Check | Result |
|-------|--------|
| `npm run typecheck` | ✅ **PASS** (exit code 0) |
| `npm run lint` | ✅ **PASS** (exit code 0, 0 warnings) |
| `npm run test -- --run` | ✅ **PASS** (2451 passed, 4 skipped, 1 pre-existing timeout in unrelated `BulkDailyRecordList.test.tsx`) |

> The sole failing test (`BulkDailyRecordList.test.tsx > 一括保存時のstatus更新ロジック`) times out at 5000ms and has zero references to staff. It is a pre-existing flaky test predating this run.

---

## Diff Summary: What Moved Where

### StaffForm.tsx lines 34–253 → `useStaffForm.ts`
All state, refs, effects, handlers, and the submit function moved to a custom hook. Hook receives `StaffFormProps` and returns a typed `UseStaffFormReturn` interface.

**TypeScript fix applied:** `formRef` required a cast `useRef<HTMLFormElement>(null) as React.RefObject<HTMLFormElement>` to satisfy JSX `ref` prop variance (MUI/React type constraint).

### StaffForm.tsx lines 257–270 → `StaffFormHeader.tsx`
Header box with `PersonIcon`, mode-dependent title, optional `IconButton/CloseIcon`.

### StaffForm.tsx lines 288–321 → `StaffFormBasicInfoSection.tsx`
スタッフID and 氏名 `TextField`s. Imports `FormValues`, `Errors` from domain.

### StaffForm.tsx lines 322–368 → `StaffFormContactSection.tsx`
メール, 電話番号, 役職 `TextField`s with `autoComplete` attributes preserved.

### StaffForm.tsx lines 370–438 → `StaffFormShiftSection.tsx`
開始時刻/終了時刻 time inputs + 基本勤務曜日 checkbox row. Imports `BASE_WEEKDAY_OPTIONS` from domain.

### StaffForm.tsx lines 440–473 → `StaffFormWorkDaysSection.tsx`
出勤曜日 checkbox row. Imports `DAYS` from domain.

### StaffForm.tsx lines 475–541 → `StaffFormCertSection.tsx`
Certification chip palette, custom certification `TextField` + `追加` button, selected certifications chip display. Imports `CERTIFICATION_OPTIONS` from domain.

### StaffForm.tsx shell (remaining)
Retains inline: Alert status message, 在籍ステータス checkbox, action buttons block, Success Snackbar.
Both `export function StaffForm` (named) and `export default StaffForm` present.

---

## Non-Negotiable Compliance

- ✅ Public API unchanged: `StaffForm` named + default export preserved
- ✅ `domain/staffFormDomain.ts` untouched
- ✅ `StaffPanel.tsx` untouched
- ✅ `index.ts` untouched
- ✅ No new npm packages added
- ✅ All `sx=` props, MUI component names, `data-form="staff"`, `autoComplete` attrs identical to original
- ✅ All section components use relative paths within the feature; cross-feature imports use `@/`

---

## Next Recommended Steps

1. **Add unit tests for `useStaffForm`** — test `toggleWorkDay`, `toggleBaseWorkingDay`, `toggleCertification`, `removeCertification`, `handleAddCustomCertification` as pure logic extracts (Night Run 11 candidate).
2. **Fix `BulkDailyRecordList.test.tsx` flaky timeout** — increase timeout or mock the async operation that stalls.
3. **Address Wave 3 targets** — per roadmap KI: `navigationConfig`, `sharePointAdapter`, `BusinessJournalPreviewPage`, `IBDDemoPage`, `IcebergPdcaPage`.
4. **Consider `StaffPanel.tsx` decomposition** — at 9671 bytes it may benefit from a similar night run split.
