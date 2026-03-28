import { expect, test, type Page } from '@playwright/test';
import { TESTIDS } from '@/testids';

async function waitForTodayMain(page: Page): Promise<void> {
  await page.goto('/today');
  await expect(page.getByTestId(TESTIDS.TODAY_HERO)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('hero-action-card')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('hero-cta')).toBeVisible({ timeout: 15_000 });
}

async function openUnfilledDrawerByUrl(page: Page, userId = 'U005') {
  await page.goto(`/today?mode=unfilled&userId=${encodeURIComponent(userId)}&autoNext=1`);
  const drawer = page.getByTestId('today-quickrecord-drawer');
  await expect(drawer).toBeVisible({ timeout: 10_000 });
  return drawer;
}

test.describe('Today Ops Screen - Sort Attendance', () => {
  // Use VITE_E2E=1 to trigger the fallback Mock mechanism defined in TodayOpsPage
  test.use({
    extraHTTPHeaders: {
      'x-vite-e2e': '1',
    },
  });

  test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => {
      console.log(`[PAGE ERROR] ${error.message}`);
    });

    await page.addInitScript(() => {
      (window as unknown as { __E2E_TODAY_OPS_MOCK__?: boolean }).__E2E_TODAY_OPS_MOCK__ = true;
    });

    await page.route('/_api/**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ d: { results: [] } })
    }));
  });

  test('unfilled drawer keeps target user id and remains stable when candidates are filtered out', async ({ page }) => {
    await waitForTodayMain(page);
    const drawer = await openUnfilledDrawerByUrl(page);

    const embedForm = drawer.getByTestId('today-quickrecord-form-embed');

    // 1st User tracking -- ensuring absent users (U001) are bypassed
    const firstUserIdText = await embedForm.getByTestId('today-quickrecord-target-userid').textContent();
    const firstUserId = firstUserIdText?.trim() || '';

    expect(firstUserId.replace(/-/g, '')).toBe('U005');
    await expect(page).toHaveURL(new RegExp(`userId=${firstUserId}`));

    const selectionCount = embedForm.getByTestId('selection-count');
    await expect(selectionCount).toContainText('0人選択中');
    await expect(embedForm).toContainText('該当する利用者が見つかりません');
  });
});
