import { test, expect } from '@playwright/test';
import { disableSchedulesFeature, enableSchedulesFeature } from './_helpers/featureFlags';
import { enableSchedulesEnv } from './_helpers/nav.schedule';

const scheduleNavLabel = /スケジュール(?:（月表示）)?/;

test.describe("schedule feature flag", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
    });
    await enableSchedulesFeature(page, { create: true, msalMock: true });
    await enableSchedulesEnv(page, {
      env: { VITE_E2E_MSAL_MOCK: '1', VITE_SKIP_LOGIN: '1' },
      feature: { create: true, msalMock: true },
    });
  });

  test("hides schedule navigation and redirects deep links when flag disabled", async ({ page }) => {
    await disableSchedulesFeature(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('link', { name: scheduleNavLabel })).toHaveCount(0);

    await page.goto('/schedules/month');
    await expect(page).toHaveURL(/\/$/);
  });

  test("shows navigation and loads schedule month when flag enabled", async ({ page }) => {
    await enableSchedulesFeature(page, { create: true, msalMock: true });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const monthNav = page.getByRole('link', { name: scheduleNavLabel });
    await expect(monthNav).toBeVisible();

    await monthNav.click();

    await expect(page).toHaveURL(/\/schedules\/week$/);
    await expect(page.getByRole('heading', { name: /スケジュール（週表示）/ })).toBeVisible();
  });
});
