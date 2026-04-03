import { expect, test, type Page } from '@playwright/test';

type TestRole = 'admin' | 'viewer';

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
    };

    window.localStorage.setItem('skipLogin', '1');
  }, { role });

  await page.goto(path, { waitUntil: 'domcontentloaded' });
}

const accessDeniedHeading = /アクセス権がありません|設定エラー/;

test.describe('admin guard e2e', () => {
  test.use({
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173',
  });

  test('admin can access audit page', async ({ page }) => {
    await bootstrapRole(page, 'admin');
    await page.goto('/audit', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('audit-root')).toBeVisible();
    await expect(page.getByRole('heading', { name: accessDeniedHeading })).toHaveCount(0);
  });

  test('viewer is blocked when opening audit or users from app link', async ({ page }) => {
    await bootstrapRole(page, 'viewer');

    // Verify links are hidden from navigation sidebar for unauthorized users
    await expect(page.getByRole('link', { name: /監査ログ|Audit/ })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /利用者|Users/ })).toHaveCount(0);
  });

  test('viewer is blocked on direct admin route access', async ({ page }) => {
    // Audit
    await bootstrapRole(page, 'viewer', '/audit');
    await expect(page.getByRole('heading', { name: accessDeniedHeading })).toBeVisible();
    await expect(page.getByTestId('audit-root')).toHaveCount(0);

    // Users
    await bootstrapRole(page, 'viewer', '/users');
    await expect(page.getByRole('heading', { name: accessDeniedHeading })).toBeVisible();
    await expect(page.getByTestId('users-panel-root')).toHaveCount(0);
  });
});
