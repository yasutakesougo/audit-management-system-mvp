import { expect, test, type Page } from '@playwright/test';

type TestRole = 'admin' | 'reception' | 'viewer';

const accessDeniedHeading = /アクセス権がありません|設定エラー/;

async function bootstrapRole(page: Page, role: TestRole, path = '/planning') {
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

async function ensureNavVisible(page: Page) {
  const navItems = page.getByTestId('nav-items').first();
  if (await navItems.isVisible().catch(() => false)) return;

  const navDrawer = page.getByTestId('nav-drawer').first();
  if (await navDrawer.isVisible().catch(() => false)) return;

  const openBtn = page.getByTestId('nav-open').first();
  const desktopBtn = page.getByTestId('desktop-nav-open').first();

  if (await openBtn.isVisible().catch(() => false)) {
    await openBtn.click();
  } else if (await desktopBtn.isVisible().catch(() => false)) {
    await desktopBtn.click();
  }

  try {
    await expect(navItems).toBeVisible({ timeout: 15_000 });
  } catch {
    await expect(navDrawer).toBeVisible({ timeout: 15_000 });
  }
}

async function closeNavOverlayIfOpen(page: Page) {
  const mobileNavItems = page.getByTestId('nav-items').first();
  if (!(await mobileNavItems.isVisible().catch(() => false))) return;
  await page.keyboard.press('Escape');
  await expect(mobileNavItems).not.toBeVisible({ timeout: 10_000 });
}

test.describe('hub entry experience ssot e2e', () => {
  test.use({
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173',
  });

  test('viewer: card/nav visibility aligns with route guard', async ({ page }) => {
    await bootstrapRole(page, 'viewer', '/planning');

    await expect(page.getByTestId('hub-landing-cards-planning')).toBeVisible();
    await expect(page.getByTestId('hub-entry-card-planning-guide')).toBeVisible();
    await expect(page.getByTestId('hub-entry-card-planning-compare')).toHaveCount(0);

    await ensureNavVisible(page);
    await expect(page.getByTestId('nav-support-plan-guide')).toBeVisible();
    await expect(page.getByTestId('nav-analysis')).toHaveCount(0);
    await closeNavOverlayIfOpen(page);

    await page.getByTestId('hub-entry-open-planning-guide').click();
    await expect(page).toHaveURL(/\/support-plan-guide(\b|\/|\?|#)/);

    await page.goto('/isp-editor', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: accessDeniedHeading })).toBeVisible();
  });

  test('admin: visible admin card navigates to an allowed admin route', async ({ page }) => {
    await bootstrapRole(page, 'admin', '/planning');

    await expect(page.getByTestId('hub-landing-cards-planning')).toBeVisible();
    await expect(page.getByTestId('hub-entry-card-planning-compare')).toBeVisible();

    await ensureNavVisible(page);
    await expect(page.getByTestId('nav-analysis')).toBeVisible();
    await closeNavOverlayIfOpen(page);

    await page.getByTestId('hub-entry-open-planning-compare').click();
    await expect(page).toHaveURL(/\/isp-editor(\b|\/|\?|#)/);
    await expect(page.getByRole('heading', { name: accessDeniedHeading })).toHaveCount(0);
  });

  test('today kiosk query hides hub cards', async ({ page }) => {
    await bootstrapRole(page, 'viewer', '/today?kiosk=1');

    await expect(page.getByTestId('app-shell')).toHaveAttribute('data-kiosk', 'true');
    await expect(page.getByTestId('hub-landing-cards-today')).toHaveCount(0);

    await page.goto('/today', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('hub-landing-cards-today')).toBeVisible();
  });
});
