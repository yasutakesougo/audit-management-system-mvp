import '@/test/captureSp400';
import { expect, test, type Page } from '@playwright/test';
import { gotoWeek } from './utils/scheduleNav';

const setupEnv = {
  env: {
    VITE_E2E_MSAL_MOCK: '1',
    VITE_SKIP_LOGIN: '1',
    VITE_FEATURE_SCHEDULES: '1',
    VITE_FEATURE_SCHEDULES_WEEK_V2: '1',
  },
  storage: {
    'feature:schedules': '1',
    skipLogin: '1',
  },
} as const;

const waitForWeekTimeline = async (page: Page): Promise<void> => {
  const heading = page.getByRole('heading', { level: 1, name: /スケジュール/ });
  await expect(heading).toBeVisible();

  const tab = page.getByRole('tab', { name: /週/ });
  await expect(tab).toHaveAttribute('aria-selected', 'true');

  await expect(page.getByTestId('schedule-week-root')).toBeVisible();
  await expect(page.locator('[id^="timeline-week-header-"]').first()).toBeVisible();
};

test.describe('Schedule week – mobile toolbar/search', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(({ env, storage }) => {
      const scope = window as typeof window & { __ENV__?: Record<string, string> };
      scope.__ENV__ = {
        ...(scope.__ENV__ ?? {}),
        ...env,
      };
      for (const [key, value] of Object.entries(storage)) {
        window.localStorage.setItem(key, value);
      }
    }, setupEnv);
  });

  test('keeps the timeline visible while using the mobile search toolbar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await gotoWeek(page, new Date('2025-11-24'));
    await waitForWeekTimeline(page);

    const toolbar = page.getByRole('toolbar', { name: 'スケジュールの検索とフィルタ' });
    await expect(toolbar).toBeVisible();

    const searchInput = page.getByRole('textbox', { name: '検索' });
    await expect(searchInput).toBeVisible();
    await searchInput.fill('早番');
    await expect(searchInput).toHaveValue('早番');

    const clearButton = page.getByRole('button', { name: '検索条件をクリア' });
    await expect(clearButton).toBeEnabled();
    await clearButton.click();
    await expect(searchInput).toHaveValue('');

    await expect(page.getByTestId('schedule-week-root')).toBeVisible();
    await expect(page.locator('[id^="timeline-week-header-"]').first()).toBeVisible();
  });
});
