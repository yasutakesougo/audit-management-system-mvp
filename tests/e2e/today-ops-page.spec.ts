import { expect, test, type Page } from '@playwright/test';
import { TESTIDS } from '@/testids';

async function waitForTodayMain(page: Page): Promise<void> {
  await page.goto('/today');
  await expect(page.getByTestId(TESTIDS.TODAY_HERO)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('hero-action-card')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('hero-cta')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId(TESTIDS.TODAY_USER_LIST)).toBeVisible({ timeout: 15_000 });
}

async function openUnfilledDrawerByUrl(page: Page, userId = 'U005') {
  await page.goto(`/today?mode=unfilled&userId=${encodeURIComponent(userId)}&autoNext=1`);
  const drawer = page.getByTestId('today-quickrecord-drawer');
  await expect(drawer).toBeVisible({ timeout: 10_000 });
  return drawer;
}

test.describe('Today Ops Screen - Happy Path', () => {
  // Use VITE_E2E=1 to trigger the fallback Mock mechanism defined in TodayOpsPage
  test.use({
    extraHTTPHeaders: {
      'x-vite-e2e': '1', // Ensure custom env variable injection bypasses real APIs globally if needed
    },
  });

  test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => {
      console.log(`[PAGE ERROR] ${error.message}`);
    });
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`[CONSOLE ERROR] ${msg.text()}`);
      }
    });

    await page.addInitScript(() => {
      (window as unknown as { __E2E_TODAY_OPS_MOCK__?: boolean }).__E2E_TODAY_OPS_MOCK__ = true;
    });

    // mock api calls since we only care about UI flow
    await page.route('/_api/**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ d: { results: [] } })
    }));
  });

  test('renders HeroActionCard and opens Quick Record Drawer via URL state', async ({ page }) => {
    await waitForTodayMain(page);
    await expect(page.getByTestId('hero-cta')).toBeVisible();

    const drawer = await openUnfilledDrawerByUrl(page);

    await expect(page).toHaveURL(/[?&]mode=unfilled/);
    await expect(page).toHaveURL(/[?&]userId=U-?\d+/);

    const embedForm = drawer.getByTestId('today-quickrecord-form-embed');
    await expect(embedForm).toBeVisible();

    const targetUserIdText = await embedForm.getByTestId('today-quickrecord-target-userid').textContent();
    expect(targetUserIdText?.trim()).toMatch(/^U-?\d+/);

    const closeBtn = page.getByTestId('today-quickrecord-close');
    await closeBtn.click();

    await expect(drawer).not.toBeVisible();
    await expect(page).not.toHaveURL(/[?&]mode=/);
    await expect(page).not.toHaveURL(/[?&]userId=/);
  });

  test('opens Quick Record Drawer with focused user when tapping a user card', async ({ page }) => {
    await waitForTodayMain(page);

    const userList = page.getByTestId(TESTIDS.TODAY_USER_LIST);
    const firstUserCard = userList.locator('div[role="button"][tabindex="0"]').first();
    await expect(firstUserCard).toBeVisible({ timeout: 10_000 });
    await firstUserCard.click();

    const drawer = page.getByTestId('today-quickrecord-drawer');
    await expect(drawer).toBeVisible();
    await expect(page).toHaveURL(/[?&]mode=user/);
    await expect(page).toHaveURL(/[?&]userId=/);

    const embedForm = drawer.getByTestId('today-quickrecord-form-embed');
    await expect(embedForm).toBeVisible();

    const selectionCountAlert = embedForm.getByTestId('selection-count');
    await expect(selectionCountAlert).toBeVisible();
    await expect(selectionCountAlert).toContainText(/\d+人(の利用者が選択されています|選択中)/);

    const expectedUserId = new URL(page.url()).searchParams.get('userId');
    const targetUserIdText = await embedForm.getByTestId('today-quickrecord-target-userid').textContent();
    expect(targetUserIdText?.trim()).toBe(expectedUserId);

    const closeBtn = page.getByTestId('today-quickrecord-close');
    await closeBtn.click();

    await expect(drawer).not.toBeVisible();
    await expect(page).not.toHaveURL(/[?&]mode=/);
    await expect(page).not.toHaveURL(/[?&]userId=/);
  });

  test('continuous input toggle updates autoNext query in unfilled mode', async ({ page }) => {
    await waitForTodayMain(page);
    const drawer = await openUnfilledDrawerByUrl(page);

    const toggle = drawer.locator('input[type="checkbox"]').first();
    await expect(toggle).toBeAttached({ timeout: 10_000 });
    await expect(toggle).toBeChecked();
    await expect(page).toHaveURL(/[?&]autoNext=1/);

    await drawer.getByText('連続入力').click();
    await expect(toggle).not.toBeChecked();
    await expect(page).toHaveURL(/[?&]autoNext=0/);

    await drawer.getByText('連続入力').click();
    await expect(toggle).toBeChecked();
    await expect(page).toHaveURL(/[?&]autoNext=1/);

    await page.getByTestId('today-quickrecord-close').click();

    await expect(drawer).not.toBeVisible();
    await expect(page).not.toHaveURL(/[?&]mode=/);
  });
});
