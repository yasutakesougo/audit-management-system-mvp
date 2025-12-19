import { test, expect } from '@playwright/test';
import { setupSharePointStubs } from './helpers/setupSharePointStubs';

// Hardened E2E spec pattern:
// - ensure MSAL/login is mocked via init script (VITE_* read on app bootstrap)
// - stub SharePoint calls to avoid leaking network / flakiness
// - wait for app root to be ready (dashboard or schedules) before asserting
// - capture artifacts on failure

test.beforeEach(async ({ page }) => {
  // Must be set before app code runs.
  await page.addInitScript(() => {
    // Vite injects import.meta.env.* at build time, but this app also reads
    // these values from window/global to control E2E behavior.
    (window as any).VITE_E2E_MSAL_MOCK = '1';
    (window as any).VITE_SKIP_LOGIN = '1';

    try {
      window.localStorage.setItem('skipLogin', 'true');
      window.localStorage.setItem('demo', 'true');
    } catch {
      // ignore
    }
  });

  await setupSharePointStubs(page);
});

test.afterEach(async ({ page }, testInfo) => {
  // Always log where we ended up to help debug flakes.
  // eslint-disable-next-line no-console
  console.log(`[home.tiles] final url: ${page.url()}`);

  if (testInfo.status !== testInfo.expectedStatus) {
    await page.screenshot({
      path: testInfo.outputPath('failure.png'),
      fullPage: true,
    });
  }
});

test('home tiles (hardened)', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // Best-effort network idle: don't fail if the app keeps a connection open.
  await page
    .waitForLoadState('networkidle', { timeout: 10_000 })
    .catch(() => undefined);

  // Wait until the app root is ready: either dashboard-page root or schedules root.
  const appRoot = page.locator('dashboard-page, [data-testid="schedules-root"], #schedules-root');
  await expect(appRoot.first()).toBeVisible({ timeout: 15_000 });

  // Headings / tiles assertions should be stable after root is visible.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  // Quick action should prefer the role link by name.
  const quickAction = page.getByRole('link', { name: /支援記録（ケース記録）入力/ });
  await expect(quickAction).toBeVisible({ timeout: 15_000 });
  await expect(quickAction).toHaveAttribute('href', '/daily/activity');
});
