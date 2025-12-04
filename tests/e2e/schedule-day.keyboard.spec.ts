import '@/test/captureSp400';
import { expect, test } from '@playwright/test';
import { gotoDay } from './utils/scheduleNav';
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
    skipLogin: '1',
    'feature:schedulesWeekV2': 'true',
  },
} as const;

test.describe('Schedule day keyboard navigation', () => {
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

  test('Tablist arrow keys switch day/week views', async ({ page }) => {
    await gotoDay(page, new Date('2025-11-24'));
    await waitForDayTimeline(page);

    const tablist = page.getByRole('tablist', { name: /スケジュールビュー切り替え/ });
    const dayTab = tablist.getByRole('tab', { name: '日' });
    const weekTab = tablist.getByRole('tab', { name: '週' });

    await dayTab.focus();

    await dayTab.press('ArrowLeft');
    await weekTab.press(' ');
    await waitForWeekTimeline(page);
    await expect(weekTab).toHaveAttribute('aria-selected', 'true');

    await weekTab.press('ArrowRight');
    await dayTab.press(' ');
    await waitForDayTimeline(page);
    await expect(dayTab).toHaveAttribute('aria-selected', 'true');
  });
});
