import { TESTIDS } from '@/testids';
import { expect, test } from '@playwright/test';
import { waitForScheduleReady } from './utils/wait';

const scheduleNavLabel = /スケジュール/;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem('feature:schedules', 'false');
  });

  await page.addInitScript(() => {
    const globalWithEnv = window as typeof window & { __ENV__?: Record<string, string> };
    globalWithEnv.__ENV__ = {
      ...(globalWithEnv.__ENV__ ?? {}),
      VITE_FEATURE_SCHEDULES: '0',
      VITE_SKIP_LOGIN: '1',
      VITE_E2E_MSAL_MOCK: '1',
      VITE_SP_RESOURCE: 'https://contoso.sharepoint.com',
      VITE_SP_SITE_RELATIVE: '/sites/Audit',
    };
  });
});

test.describe('schedule feature flag', () => {
  test('hides schedule navigation and redirects deep links when flag disabled', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5_000 });

    const maybeWeek = page.getByTestId(TESTIDS.SCHEDULES_PAGE_ROOT).or(page.getByTestId(TESTIDS['schedules-week-page']));
    if ((await maybeWeek.count()) > 0) {
      await waitForScheduleReady(page);
    }

    await expect(page.getByTestId(TESTIDS.nav.schedules)).toHaveCount(0);
    await expect(page.getByRole('link', { name: scheduleNavLabel }).first()).toHaveCount(0);

    await page.goto('/schedules/week', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5_000 });
    await expect(page).not.toHaveURL(/\/schedules\/week$/);
  });

  test('shows navigation and loads schedule when flag enabled', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('feature:schedules', 'true');
      const globalWithEnv = window as typeof window & { __ENV__?: Record<string, string> };
      globalWithEnv.__ENV__ = {
        ...(globalWithEnv.__ENV__ ?? {}),
        VITE_FEATURE_SCHEDULES: '1',
        VITE_FEATURE_SCHEDULES_WEEK_V2: '1',
        VITE_SKIP_LOGIN: '1',
        VITE_E2E_MSAL_MOCK: '1',
        VITE_SP_RESOURCE: 'https://contoso.sharepoint.com',
        VITE_SP_SITE_RELATIVE: '/sites/Audit',
      };
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5_000 });

    const maybeWeek = page.getByTestId(TESTIDS.SCHEDULES_PAGE_ROOT).or(page.getByTestId(TESTIDS['schedules-week-page']));
    if ((await maybeWeek.count()) > 0) {
      await waitForScheduleReady(page);
    }

    const nav = page.getByTestId(TESTIDS.nav.schedules);
    await expect(nav).toBeVisible();
    await expect(page.getByRole('link', { name: scheduleNavLabel }).first()).toBeVisible();

    if ((await nav.count()) > 0) {
      await nav.first().click();
    } else {
      await page.goto('/schedules/week', { waitUntil: 'domcontentloaded' });
    }

    await expect.poll(async () => page.url()).toMatch(/\/schedules\/week$/);
    await waitForScheduleReady(page);
    await expect(page.getByRole('heading', { name: /スケジュール/ })).toBeVisible();
  });
});
