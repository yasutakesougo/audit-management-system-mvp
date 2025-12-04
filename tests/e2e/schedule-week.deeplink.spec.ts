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

test.describe('Schedule week deep link', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (message) => {
      if (message.type() === 'info' && message.text().startsWith('[schedulesClient] fixtures=')) {
        // Surface fixture warnings when mocks change.
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

  const readLiveMessage = async (page: Page): Promise<string> =>
    page.evaluate(() => {
      const polite = document.querySelector('[data-testid="live-polite"]')?.textContent ?? '';
      const assertive = document.querySelector('[data-testid="live-assertive"]')?.textContent ?? '';
      return (polite || assertive).trim();
    });

  const waitForSchedulePage = async (page: Page): Promise<void> => {
    const heading = page.getByRole('heading', { level: 1, name: /スケジュール/ });
    await expect(heading).toBeVisible();
    const weekTab = page.getByRole('tab', { name: /週/ });
    await expect(weekTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[id^="timeline-week-header-"]').first()).toBeVisible();
  };

  test('loads the requested week and preserves announcements after reload', async ({ page }) => {
    await gotoWeek(page, new Date('2025-11-24'));
    await waitForSchedulePage(page);

    const mondayHeader = page.locator('#timeline-week-header-2025-11-24');
    await expect(mondayHeader).toBeVisible();
    const liveText = await readLiveMessage(page);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForSchedulePage(page);
    const reloadedLiveText = await readLiveMessage(page);
    expect(reloadedLiveText).toBe(liveText);
  });
});
