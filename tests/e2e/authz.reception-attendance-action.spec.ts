import { test, expect, type Page } from '@playwright/test';

type TestRole = 'admin' | 'reception' | 'viewer';

async function bootstrapRole(page: Page, role: TestRole, path = '/dashboard') {
  await page.addInitScript((opts: { role: TestRole }) => {
    const w = window as typeof window & { __ENV__?: Record<string, string> };
    w.__ENV__ = {
      ...(w.__ENV__ ?? {}),
      VITE_E2E: '1',
      VITE_E2E_MSAL_MOCK: '1',
      VITE_SKIP_LOGIN: '1',
      VITE_E2E_ENFORCE_AUDIENCE: '1',
      VITE_TEST_ROLE: opts.role,
      VITE_AAD_ADMIN_GROUP_ID: 'e2e-admin-group-id',
      VITE_AAD_RECEPTION_GROUP_ID: 'e2e-reception-group-id',
      VITE_FEATURE_STAFF_ATTENDANCE: '1',
    };

    window.localStorage.setItem('skipLogin', '1');
  }, { role });

  await page.goto(path, { waitUntil: 'domcontentloaded' });
}

const accessDeniedHeading = /アクセス権がありません|設定エラー/;

test.describe('reception attendance action guard e2e', () => {
  test.use({
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173',
  });

  test('viewer is blocked on staff attendance route', async ({ page }) => {
    await bootstrapRole(page, 'viewer', '/staff/attendance');

    await expect(page.getByRole('heading', { name: accessDeniedHeading })).toBeVisible();
    await expect(page.getByTestId('staff-attendance-input-root')).toHaveCount(0);
  });

  test('reception can update attendance status', async ({ page }) => {
    await bootstrapRole(page, 'reception', '/staff/attendance');

    await expect(page.getByTestId('staff-attendance-input-root')).toBeVisible();
    const absentButton = page.getByTestId('staff-attendance-status-STF001-absent');
    await expect(absentButton).toBeVisible();
    await absentButton.click();
    await expect(absentButton).toHaveAttribute('aria-pressed', 'true');
  });

  test('admin can update attendance status', async ({ page }) => {
    await bootstrapRole(page, 'admin', '/staff/attendance');

    await expect(page.getByTestId('staff-attendance-input-root')).toBeVisible();
    const awayButton = page.getByTestId('staff-attendance-status-STF001-away');
    await expect(awayButton).toBeVisible();
    await awayButton.click();
    await expect(awayButton).toHaveAttribute('aria-pressed', 'true');
  });
});
