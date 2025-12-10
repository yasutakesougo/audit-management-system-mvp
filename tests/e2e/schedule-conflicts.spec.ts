import '@/test/captureSp400';
import { expect, test } from '@playwright/test';
import { gotoDay, gotoWeek } from './utils/scheduleNav';
import { waitForDayTimeline, waitForWeekTimeline } from './utils/wait';

const setupEnv = {
  env: {
    VITE_E2E_MSAL_MOCK: '1',
    VITE_SKIP_LOGIN: '1',
    VITE_FEATURE_SCHEDULES: '1',
    VITE_FEATURE_SCHEDULES_WEEK_V2: '1',
  },
  storage: {
    'feature:schedules': '1',
    'feature:schedulesWeekV2': '1',
    skipLogin: '1',
  },
} as const;

const TARGET_DATE = new Date('2025-11-14');
const CONFLICT_SCENARIO = 'conflicts-basic';
const CONFLICT_SELECTOR = '[data-testid="schedule-warning-indicator"]';

test.describe('Schedule conflicts – timeline views', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (message) => {
      if (message.type() === 'info' && message.text().startsWith('[schedulesClient] fixtures=')) {
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

  test('highlights conflicting events in the day timeline', async ({ page }) => {
    await gotoDay(page, TARGET_DATE, { searchParams: { scenario: CONFLICT_SCENARIO } });
    await waitForDayTimeline(page);

    const dayRoot = page.getByTestId('schedule-day-root');
    await expect(dayRoot).toBeVisible();

    const conflicts = dayRoot.locator(CONFLICT_SELECTOR);
    await expect(conflicts.first()).toBeVisible();
  });

  test('highlights the same conflicts in the week timeline', async ({ page }) => {
    await gotoWeek(page, TARGET_DATE, { searchParams: { scenario: CONFLICT_SCENARIO } });
    await waitForWeekTimeline(page);

    const weekRoot = page.getByTestId('schedule-week-root');
    await expect(weekRoot).toBeVisible();

    const conflicts = weekRoot.locator(CONFLICT_SELECTOR);
    await expect(conflicts.first()).toBeVisible();
  });
});