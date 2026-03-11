# Night Run 12 — StaffForm Playwright E2E: Create & Update Flow

**Date:** 2026-03-11
**Status:** ✅ All 12 Playwright tests passing
**Typecheck:** ✅ Pass
**Lint:** ✅ Pass

---

## Files Created / Modified

| File | Action | Description |
|------|--------|-------------|
| `src/testids.ts` | Modified | Added 8 new staff-form testid keys |
| `src/features/staff/StaffForm.tsx` | Modified | Added `TESTIDS` import, `data-testid` on `<Paper>`, submit/close `<Button>`, and `noValidate` on form |
| `src/features/staff/components/StaffFormBasicInfoSection.tsx` | Modified | Added `TESTIDS` import, `inputProps['data-testid']` on StaffID and FullName fields |
| `src/features/staff/components/StaffFormContactSection.tsx` | Modified | Added `TESTIDS` import, `inputProps['data-testid']` on Email, Phone, and Role fields |
| `tests/e2e/staff-form.flow.spec.ts` | Created | 12 Playwright E2E tests covering create and update flows |

---

## data-testid Attributes Added (8 total)

| Key | Value |
|-----|-------|
| `staff-form-root` | `staff-form-root` |
| `staff-form-submit` | `staff-form-submit` |
| `staff-form-close` | `staff-form-close` |
| `staff-form-fullname` | `staff-form-fullname` |
| `staff-form-staffid` | `staff-form-staffid` |
| `staff-form-email` | `staff-form-email` |
| `staff-form-phone` | `staff-form-phone` |
| `staff-form-role` | `staff-form-role` |

All registered in `src/testids.ts` SSOT before use. Source files use `TESTIDS['key']` constant. Test file uses a local `T` map (no `src/` import in Playwright files).

---

## Playwright Test Results

**Suite:** `tests/e2e/staff-form.flow.spec.ts`
**Project:** chromium
**Result:** 12 passed in 18.9s ✅

### StaffForm — create flow

| # | Test | Result | Notes |
|---|------|--------|-------|
| 1 | form opens when 新規職員登録 is clicked | ✅ PASS | 1.3s |
| 2 | FullName field accepts text input | ✅ PASS | 1.3s |
| 3 | submit with empty FullName and empty StaffID shows validation error | ✅ PASS | Required `noValidate` fix |
| 4 | submit with StaffID alone (no FullName) shows NO validation error message | ✅ PASS | 1.4s |
| 5 | successful create closes the form | ✅ PASS | handleCreateSuccess → setShowCreateForm(false) |
| 6 | close button triggers confirmation dialog when form is dirty | ✅ PASS | window.confirm fires |
| 7 | close button closes form immediately when form is pristine | ✅ PASS | No dialog for pristine form |

### StaffForm — update flow

| # | Test | Result | Notes |
|---|------|--------|-------|
| 8 | edit form opens with pre-filled data for 佐藤 花子 | ✅ PASS | FullName = '佐藤 花子' |
| 9 | update form pre-fills email for 佐藤 花子 | ✅ PASS | staff1@example.com |
| 10 | update form pre-fills role for 佐藤 花子 | ✅ PASS | role = '支援員' |
| 11 | editing FullName in update mode makes form dirty and triggers confirm on close | ✅ PASS | confirm dialog type verified |
| 12 | successful update closes the edit form | ✅ PASS | handleEditSuccess → setShowEditForm(false) |

---

## Validation / CI Gates

| Check | Result |
|-------|--------|
| `npm run typecheck` | ✅ Exit 0 |
| `npm run lint` | ✅ Exit 0 (0 warnings) |
| Playwright 12/12 tests | ✅ Exit 0 |

---

## Issues Encountered and Fixes Applied

### 1. `/staff` route — Admin-only access guard
**Root cause:** `RequireAudience` component with `requiredRole="admin"` blocks access unless `shouldSkipLogin()` returns true, or `VITE_E2E=1` is set in `window.__ENV__`.

**Fix:** `bootstrapStaffAdmin()` helper in test file injects all required env flags (`VITE_E2E`, `VITE_E2E_MSAL_MOCK`, `VITE_SKIP_LOGIN`, `VITE_TEST_ROLE=admin`) via `page.addInitScript()` before navigation. Pattern mirrors `authz.admin-guard.spec.ts`.

### 2. Pre-built dist vs. dev server
**Root cause:** When `PLAYWRIGHT_BASE_URL` was pointed at port 4173 (the `npx serve dist` process), tests ran against the old build without new `data-testid` attributes.

**Fix:** Tests run with `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173` to target the Vite dev server which serves the latest compiled code with HMR.

### 3. Browser native validation blocking React validation
**Root cause:** The `氏名` TextField has `required` prop, which renders `<input required />`. In the real browser (Playwright), this triggers browser's built-in required validation on form submit, preventing `onSubmit` from being called and suppressing React's custom error messages.

**Fix:** Added `noValidate` to `<form>` in `StaffForm.tsx`. This disables browser-native validation and lets `validateStaffForm()` run exclusively. All validation is handled by the existing React validation function with correct error messages.

---

## Testing Pyramid — Updated State

| Layer | Count | Status |
|-------|-------|--------|
| Unit tests (vitest) | 3,230 | ✅ |
| Component tests (renderHook + render) | 80 | ✅ |
| E2E smoke | 1 (staff.smoke.spec.ts) | ✅ |
| **E2E flow (NEW)** | **12 (staff-form.flow.spec.ts)** | **✅** |

---

## Next Recommended Steps

1. **Add `staff-form.flow.spec.ts` to the smoke allowlist** in `playwright.smoke.config.ts` if fast CI smoke checks should include the form flow
2. **Certifications section E2E** — the `StaffFormCertSection` has no `data-testid` yet; a future run could add tests for toggling certifications
3. **Shift section E2E** — `StaffFormShiftSection` and `StaffFormWorkDaysSection` lack testids; time pickers could have E2E tests
4. **Error recovery tests** — test behavior when `createStaff`/`updateStaff` throws an error (currently only success path is tested)
5. **Mobile viewport tests** — the staff form uses MUI components that should render correctly on smaller screens
