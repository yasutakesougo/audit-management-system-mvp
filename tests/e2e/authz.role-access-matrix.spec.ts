import { expect, test, type Page } from '@playwright/test';

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

const accessDeniedHeading = /アクセス権がありません|設定エラー|権限不足/;

test.describe('Role-based Access Control Matrix E2E', () => {
  test.use({
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173',
  });

  // ---------------------------------------------------------------------------
  // 1. Viewer Role Validation
  // ---------------------------------------------------------------------------
  test.describe('viewer role access limits', () => {
    test('should show access denied on /checklist', async ({ page }) => {
      await bootstrapRole(page, 'viewer', '/checklist');
      await expect(page.getByRole('heading', { name: accessDeniedHeading })).toBeVisible();
    });

    test('should show access denied on /audit', async ({ page }) => {
      await bootstrapRole(page, 'viewer', '/audit');
      await expect(page.getByRole('heading', { name: accessDeniedHeading })).toBeVisible();
      await expect(page.getByTestId('audit-root')).toHaveCount(0);
    });

    test('should show access denied on /admin/exception-center', async ({ page }) => {
      await bootstrapRole(page, 'viewer', '/admin/exception-center');
      await expect(page.getByRole('heading', { name: accessDeniedHeading })).toBeVisible();
    });

    test('should redirect to /today when accessing /exceptions', async ({ page }) => {
      await bootstrapRole(page, 'viewer', '/exceptions');
      // Should be redirected to /today due to AdminSurfaceRouteGuard
      await expect(page).toHaveURL(/\/today/);
      await expect(page.getByRole('heading', { name: accessDeniedHeading })).toHaveCount(0);
    });

    test('should show access denied on /staff', async ({ page }) => {
      await bootstrapRole(page, 'viewer', '/staff');
      await expect(page.getByRole('heading', { name: accessDeniedHeading })).toBeVisible();
      await expect(page.getByTestId('staff-panel-root')).toHaveCount(0);
    });

    test('should show access denied on /admin/templates', async ({ page }) => {
      await bootstrapRole(page, 'viewer', '/admin/templates');
      await expect(page.getByRole('heading', { name: accessDeniedHeading })).toBeVisible();
      await expect(page.getByTestId('support-activity-master-page')).toHaveCount(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Reception Role Validation
  // ---------------------------------------------------------------------------
  test.describe('reception role access limits', () => {
    test('should show access denied on /checklist', async ({ page }) => {
      await bootstrapRole(page, 'reception', '/checklist');
      await expect(page.getByRole('heading', { name: accessDeniedHeading })).toBeVisible();
    });

    test('should show access denied on /audit', async ({ page }) => {
      await bootstrapRole(page, 'reception', '/audit');
      await expect(page.getByRole('heading', { name: accessDeniedHeading })).toBeVisible();
    });

    test('should show access denied on /admin/exception-center', async ({ page }) => {
      await bootstrapRole(page, 'reception', '/admin/exception-center');
      await expect(page.getByRole('heading', { name: accessDeniedHeading })).toBeVisible();
    });

    test('should successfully access /exceptions', async ({ page }) => {
      await bootstrapRole(page, 'reception', '/exceptions');
      await expect(page.getByRole('heading', { name: accessDeniedHeading })).toHaveCount(0);
      await expect(page.getByRole('heading', { name: /Exception Center/ })).toBeVisible();
    });

    test('should show access denied on /staff', async ({ page }) => {
      await bootstrapRole(page, 'reception', '/staff');
      await expect(page.getByRole('heading', { name: accessDeniedHeading })).toBeVisible();
    });

    test('should show access denied on /admin/templates', async ({ page }) => {
      await bootstrapRole(page, 'reception', '/admin/templates');
      await expect(page.getByRole('heading', { name: accessDeniedHeading })).toBeVisible();
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Admin Role Validation
  // ---------------------------------------------------------------------------
  test.describe('admin role permissions', () => {
    test('should successfully access /checklist', async ({ page }) => {
      await bootstrapRole(page, 'admin', '/checklist');
      await expect(page.getByRole('heading', { name: accessDeniedHeading })).toHaveCount(0);
      await expect(page.getByRole('heading', { name: '監査チェックリスト' })).toBeVisible();
    });

    test('should successfully access /audit', async ({ page }) => {
      await bootstrapRole(page, 'admin', '/audit');
      await expect(page.getByRole('heading', { name: accessDeniedHeading })).toHaveCount(0);
      await expect(page.getByTestId('audit-root')).toBeVisible();
    });

    test('should successfully access /admin/exception-center', async ({ page }) => {
      await bootstrapRole(page, 'admin', '/admin/exception-center');
      await expect(page.getByRole('heading', { name: accessDeniedHeading })).toHaveCount(0);
      await expect(page.getByRole('heading', { name: /Exception Center/ })).toBeVisible();
    });

    test('should successfully access /exceptions', async ({ page }) => {
      await bootstrapRole(page, 'admin', '/exceptions');
      await expect(page.getByRole('heading', { name: accessDeniedHeading })).toHaveCount(0);
      await expect(page.getByRole('heading', { name: /Exception Center/ })).toBeVisible();
    });

    test('should successfully access /staff', async ({ page }) => {
      await bootstrapRole(page, 'admin', '/staff');
      await expect(page.getByRole('heading', { name: accessDeniedHeading })).toHaveCount(0);
      await expect(page.getByTestId('staff-panel-root')).toBeVisible();
    });

    test('should successfully access /admin/templates', async ({ page }) => {
      await bootstrapRole(page, 'admin', '/admin/templates');
      await expect(page.getByRole('heading', { name: accessDeniedHeading })).toHaveCount(0);
      await expect(page.getByTestId('support-activity-master-page')).toBeVisible();
    });
  });
});
