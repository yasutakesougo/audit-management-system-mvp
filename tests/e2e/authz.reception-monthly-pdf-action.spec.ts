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
    };

    window.localStorage.setItem('skipLogin', '1');
  }, { role });

  await page.goto(path, { waitUntil: 'domcontentloaded' });
}

const accessDeniedHeading = /アクセス権がありません|設定エラー/;

test.describe('reception monthly pdf action guard e2e', () => {
  test.use({
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173',
  });

  test('viewer cannot access monthly pdf action', async ({ page }) => {
    await bootstrapRole(page, 'viewer', '/records/monthly?tab=pdf');

    await expect(page.getByRole('heading', { name: accessDeniedHeading })).toBeVisible();
    await expect(page.getByTestId('monthly-pdf-generate-btn')).toHaveCount(0);
  });

  test('reception can use monthly pdf action', async ({ page }) => {
    await bootstrapRole(page, 'reception', '/records/monthly?tab=pdf');

    const generateButton = page.getByTestId('monthly-pdf-generate-btn');
    await expect(generateButton).toBeVisible();
    await expect(generateButton).toBeEnabled();
  });

  test('admin can use monthly pdf action', async ({ page }) => {
    await bootstrapRole(page, 'admin', '/records/monthly?tab=pdf');

    const generateButton = page.getByTestId('monthly-pdf-generate-btn');
    await expect(generateButton).toBeVisible();
    await expect(generateButton).toBeEnabled();
  });
});
