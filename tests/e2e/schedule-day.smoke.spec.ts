import '@/test/captureSp400';
import { expect, test } from '@playwright/test';
import { gotoDay } from './utils/scheduleNav';
import { waitForDayTimeline } from './utils/wait';

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
    'feature:schedulesWeekV2': 'true',
  },
} as const;

test.describe('Schedule day – smoke', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (message) => {
      if (message.type() === 'info' && message.text().startsWith('[schedulesClient] fixtures=')) {
        // Echo fixture-mode logs to the Playwright reporter output for quick diagnosis.
        // eslint-disable-next-line no-console
        console.log(`browser-console: ${message.text()}`);
      }
    });

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

  test('renders the day timeline with tabs and basic chrome', async ({ page }) => {
    await gotoDay(page, new Date('2025-11-24'));
    await waitForDayTimeline(page);

    const root = page.getByTestId('schedule-day-root');

    const tablist = page.getByRole('tablist', { name: /スケジュールビュー/ });
    await expect(tablist).toBeVisible();

    const dayTab = page.getByRole('tab', { name: '日' });
    const weekTab = page.getByRole('tab', { name: '週' });
    const monthTab = page.getByRole('tab', { name: '月' });

    await expect(dayTab).toHaveAttribute('aria-selected', 'true');
    await expect(weekTab).toBeVisible();
    await expect(monthTab).toBeVisible();

    const timelineGrid = root.getByRole('grid', { name: '指定日の予定一覧' });
    await expect(timelineGrid).toBeVisible();

    const firstHeader = page.locator('[id^="timeline-day-header-"]').first();
    await expect(firstHeader).toBeVisible();

    const firstRowHeader = root.getByRole('rowheader').first();
    await expect(firstRowHeader).toBeVisible();
  });
});
