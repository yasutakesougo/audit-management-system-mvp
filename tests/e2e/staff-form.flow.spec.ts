/**
 * StaffForm — E2E: Create & Update Flow
 * Night Run 12
 *
 * Tests the StaffForm component in create and update modes.
 * Uses demo data (no SharePoint). Environment: VITE_SKIP_LOGIN=1, VITE_DEMO_MODE=1.
 * The /staff route is admin-only; we inject VITE_TEST_ROLE=admin via addInitScript.
 *
 * DO NOT MODIFY: tests/e2e/staff.smoke.spec.ts
 */
import { expect, test } from '@playwright/test';

// Local testid map — mirrors src/testids.ts SSOT (avoid src/ import in Playwright files)
const T = {
  panelRoot: 'staff-panel-root',
  formRoot: 'staff-form-root',
  formSubmit: 'staff-form-submit',
  formClose: 'staff-form-close',
  formFullname: 'staff-form-fullname',
  formStaffId: 'staff-form-staffid',
  formEmail: 'staff-form-email',
  formPhone: 'staff-form-phone',
  formRole: 'staff-form-role',
} as const;

/**
 * Bootstrap the app with admin role so the /staff route (admin-only guard) is accessible.
 * Pattern mirrors authz.admin-guard.spec.ts bootstrapRole helper.
 */
async function bootstrapStaffAdmin(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as typeof window & { __ENV__?: Record<string, string> };
    w.__ENV__ = {
      ...(w.__ENV__ ?? {}),
      VITE_E2E: '1',
      VITE_E2E_MSAL_MOCK: '1',
      VITE_SKIP_LOGIN: '1',
      VITE_TEST_ROLE: 'admin',
      VITE_AAD_ADMIN_GROUP_ID: 'e2e-admin-group-id',
      VITE_SCHEDULE_ADMINS_GROUP_ID: 'e2e-admin-group-id',
      VITE_MSAL_CLIENT_ID: 'e2e-mock-client-id-12345678',
      VITE_MSAL_TENANT_ID: 'common',
      VITE_FEATURE_SCHEDULES: '1',
    };
    window.localStorage.setItem('skipLogin', '1');
  });
  await page.goto('/staff', { waitUntil: 'domcontentloaded' });
}

// ── Helpers ────────────────────────────────────────────────────────

/** Opens the create form by clicking the header "新規職員登録" button. */
async function openCreateForm(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: '新規職員登録' }).first().click();
  await expect(page.getByTestId(T.formRoot)).toBeVisible({ timeout: 10_000 });
}

// ──────────────────────────────────────────────────────────────────
// StaffForm — create flow
// ──────────────────────────────────────────────────────────────────
test.describe('StaffForm — create flow', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapStaffAdmin(page);
    await expect(page.getByTestId(T.panelRoot)).toBeVisible({ timeout: 15_000 });
  });

  test('form opens when 新規職員登録 is clicked', async ({ page }) => {
    await openCreateForm(page);
    await expect(page.getByTestId(T.formRoot)).toBeVisible();
  });

  test('FullName field accepts text input', async ({ page }) => {
    await openCreateForm(page);
    const fullnameInput = page.getByTestId(T.formFullname);
    await fullnameInput.fill('テスト 太郎');
    await expect(fullnameInput).toHaveValue('テスト 太郎');
  });

  test('submit with empty FullName and empty StaffID shows validation error', async ({ page }) => {
    await openCreateForm(page);
    // Both fields are empty — submit should fail validation
    await page.getByTestId(T.formSubmit).click();
    await expect(
      page.getByText('氏名（またはスタッフID）のいずれかは必須です')
    ).toBeVisible({ timeout: 5_000 });
  });

  test('submit with StaffID alone (no FullName) shows NO validation error message', async ({ page }) => {
    await openCreateForm(page);
    // Fill only the StaffID — the OR-validation should pass
    await page.getByTestId(T.formStaffId).fill('ST-999');
    await page.getByTestId(T.formSubmit).click();
    // Validation error text must NOT be visible
    await expect(
      page.getByText('氏名（またはスタッフID）のいずれかは必須です')
    ).not.toBeVisible({ timeout: 5_000 });
  });

  test('successful create closes the form', async ({ page }) => {
    await openCreateForm(page);
    await page.getByTestId(T.formFullname).fill('テスト 職員');
    await page.getByTestId(T.formSubmit).click();
    // StaffPanel.handleCreateSuccess → setShowCreateForm(false) → formRoot unmounts
    await expect(page.getByTestId(T.formRoot)).not.toBeVisible({ timeout: 10_000 });
  });

  test('close button triggers confirmation dialog when form is dirty', async ({ page }) => {
    await openCreateForm(page);
    await page.getByTestId(T.formFullname).fill('変更あり');

    let dialogType: string | null = null;
    page.once('dialog', async (dialog) => {
      dialogType = dialog.type();
      await dialog.dismiss();
    });

    await page.getByTestId(T.formClose).click();
    // Give a moment for the dialog event to fire
    await page.waitForTimeout(500);
    expect(dialogType).toBe('confirm');
  });

  test('close button closes form immediately when form is pristine', async ({ page }) => {
    await openCreateForm(page);
    // Do NOT fill anything — form is pristine (not dirty)
    // Dismiss any dialog that might appear (should not for pristine)
    page.on('dialog', async (dialog) => dialog.dismiss());
    await page.getByTestId(T.formClose).click();
    // Form should close without confirmation
    await expect(page.getByTestId(T.formRoot)).not.toBeVisible({ timeout: 5_000 });
  });
});

// ──────────────────────────────────────────────────────────────────
// StaffForm — update flow
// ──────────────────────────────────────────────────────────────────
test.describe('StaffForm — update flow', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapStaffAdmin(page);
    await expect(page.getByTestId(T.panelRoot)).toBeVisible({ timeout: 15_000 });
  });

  /**
   * Opens the edit form for a given staff member by finding their row
   * and clicking the 編集 button within it.
   */
  async function openEditForm(page: import('@playwright/test').Page, staffName: string): Promise<void> {
    const row = page.getByRole('row').filter({ hasText: staffName });
    await row.getByRole('button', { name: '編集' }).click();
    await expect(page.getByTestId(T.formRoot)).toBeVisible({ timeout: 10_000 });
  }

  test('edit form opens with pre-filled data for 佐藤 花子', async ({ page }) => {
    await openEditForm(page, '佐藤 花子');
    await expect(page.getByTestId(T.formRoot)).toBeVisible();
    // FullName should be pre-filled with the staff name
    await expect(page.getByTestId(T.formFullname)).toHaveValue('佐藤 花子');
  });

  test('update form pre-fills email for 佐藤 花子', async ({ page }) => {
    await openEditForm(page, '佐藤 花子');
    // Demo staff id=1 → email: staff1@example.com
    await expect(page.getByTestId(T.formEmail)).toHaveValue('staff1@example.com');
  });

  test('update form pre-fills role for 佐藤 花子', async ({ page }) => {
    await openEditForm(page, '佐藤 花子');
    // Demo makeStaff base role: '支援員' (no role override for id=1)
    await expect(page.getByTestId(T.formRole)).toHaveValue('支援員');
  });

  test('editing FullName in update mode makes form dirty and triggers confirm on close', async ({ page }) => {
    await openEditForm(page, '佐藤 花子');
    const fullnameInput = page.getByTestId(T.formFullname);
    await fullnameInput.fill('佐藤 花子 (変更)');

    let dialogType: string | null = null;
    page.once('dialog', async (dialog) => {
      dialogType = dialog.type();
      await dialog.dismiss();
    });

    await page.getByTestId(T.formClose).click();
    await page.waitForTimeout(500);
    expect(dialogType).toBe('confirm');
  });

  test('successful update closes the edit form', async ({ page }) => {
    await openEditForm(page, '鈴木 次郎');
    // Change role field to a new value
    const roleInput = page.getByTestId(T.formRole);
    await roleInput.fill('新しい役職');
    await page.getByTestId(T.formSubmit).click();
    // StaffPanel.handleEditSuccess → setShowEditForm(false) → formRoot unmounts
    await expect(page.getByTestId(T.formRoot)).not.toBeVisible({ timeout: 10_000 });
  });
});
