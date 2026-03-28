import { expect, test, type Page } from '@playwright/test';
import { TESTIDS } from '@/testids';

async function waitForTodayReady(page: Page): Promise<void> {
  await page.goto('/today');
  await expect(page.getByTestId(TESTIDS.TODAY_HERO)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('hero-action-card')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('hero-cta')).toBeVisible({ timeout: 15_000 });
}

async function assertHeroCtaAction(page: Page): Promise<void> {
  const cta = page.getByTestId('hero-cta');
  const label = (await cta.innerText()).trim();

  await cta.click();

  if (/記録/.test(label)) {
    const drawer = page.getByTestId('today-quickrecord-drawer');
    await expect(drawer).toBeVisible({ timeout: 5_000 });
    const mode = new URL(page.url()).searchParams.get('mode');
    expect(mode === 'user' || mode === 'unfilled').toBeTruthy();
    return;
  }

  if (/出欠/.test(label)) {
    await expect(page).toHaveURL(/\/daily\/attendance/);
    return;
  }

  if (/申し送り/.test(label)) {
    await expect(page).toHaveURL(/\/handoff-timeline/);
    return;
  }

  if (/一覧/.test(label)) {
    await expect(page.getByTestId(TESTIDS.TODAY_USER_LIST)).toBeVisible();
    return;
  }

  await expect(
    page.getByTestId(TESTIDS.TODAY_USER_LIST).or(page.getByTestId(TESTIDS.TODAY_HANDOFF)),
  ).toBeVisible();
}

test.describe('TodayOps NextAction Start/Done', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __E2E_TODAY_OPS_MOCK__?: boolean }).__E2E_TODAY_OPS_MOCK__ = true;
    });

    await page.route('/_api/**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ d: { results: [] } }),
    }));
  });

  test('HeroActionCard CTA is actionable before/after reload', async ({ page }) => {
    await waitForTodayReady(page);
    await assertHeroCtaAction(page);

    await waitForTodayReady(page);
  });
});
