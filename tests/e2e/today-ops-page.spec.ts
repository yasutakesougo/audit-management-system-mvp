import { expect, test, type Page } from '@playwright/test';
import { bootTodayOpsPage } from './_helpers/bootTodayOpsPage';
import { TESTIDS } from '@/testids';

const MOCK_USER_ID = 'I005';

async function waitForTodayMain(page: Page): Promise<void> {
  await page.goto('/today');
  await expect(page.getByTestId(TESTIDS.TODAY_HERO)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('hero-action-card')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('hero-cta')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId(TESTIDS.TODAY_USER_LIST)).toBeVisible({ timeout: 15_000 });
}

async function openUnfilledStateByUrl(page: Page, userId = MOCK_USER_ID) {
  await page.goto(`/today?mode=unfilled&userId=${encodeURIComponent(userId)}&autoNext=1`);
  await expect(page.getByTestId(TESTIDS.TODAY_HERO)).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/[?&]mode=unfilled/);
  await expect(page).toHaveURL(new RegExp(`userId=${userId}`));
  await expect(page).toHaveURL(/[?&]autoNext=1/);
}

test.describe('Today Ops Screen - Happy Path', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => {
      console.log(`[PAGE ERROR] ${error.message}`);
    });
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`[CONSOLE ERROR] ${msg.text()}`);
      }
    });
    await bootTodayOpsPage(page);
  });

  test('renders HeroActionCard and opens Quick Record Drawer via URL state', async ({ page }) => {
    await waitForTodayMain(page);
    await expect(page.getByTestId('hero-cta')).toBeVisible();

    await openUnfilledStateByUrl(page);

    await expect(page).toHaveURL(/[?&]mode=unfilled/);
    await expect(page).toHaveURL(new RegExp(`userId=${MOCK_USER_ID}`));
  });

  test('opens Quick Record Drawer with focused user when tapping a user card', async ({ page }) => {
    await waitForTodayMain(page);

    const userList = page.getByTestId(TESTIDS.TODAY_USER_LIST);
    const firstUserCard = userList.locator('div[role="button"][tabindex="0"]').first();
    await expect(firstUserCard).toBeVisible({ timeout: 10_000 });
    await firstUserCard.click();

    await expect(page).toHaveURL(/[?&]mode=user/);
    await expect(page).toHaveURL(/[?&]userId=/);

    const expectedUserId = new URL(page.url()).searchParams.get('userId');
    expect(expectedUserId).toBeTruthy();
  });

  test('opens Users detail for the selected operation user and exposes support quick access', async ({ page }) => {
    await waitForTodayMain(page);

    await page.getByTestId(`today-user-detail-${MOCK_USER_ID}`).click();

    await expect(page).toHaveURL(new RegExp(`/users\\?tab=list&selected=${MOCK_USER_ID}`));
    await expect(page.getByTestId('user-detail-sections')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('user-detail-sections')).toContainText('石渡 由喜子');

    const supportQuickButton = page.getByTestId(`${TESTIDS['users-quick-prefix']}support-procedure`);
    await expect(supportQuickButton).toBeVisible();
    await supportQuickButton.click();

    const supportTabPanel = page.getByTestId(`${TESTIDS['user-menu-tabpanel-prefix']}support-procedure`);
    await expect(supportTabPanel).toBeVisible();
    await expect(supportTabPanel).toContainText('支援手順テンプレート');
  });
});
