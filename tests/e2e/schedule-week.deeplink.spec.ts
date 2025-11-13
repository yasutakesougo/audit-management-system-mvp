import '@/test/captureSp400';
import { expect, test, type Page } from '@playwright/test';
import { waitForScheduleReady } from './utils/wait';

const setupEnv = {
  env: {
    VITE_E2E_MSAL_MOCK: '1',
    VITE_SKIP_LOGIN: '1',
    VITE_FEATURE_SCHEDULES: '1',
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

  test('loads the requested week and preserves announcements after reload', async ({ page }) => {
    const targetWeekLabel = '2025/11/24 – 2025/11/29';

    await page.goto('/schedules/week?week=2025-11-24', { waitUntil: 'domcontentloaded' });
    await waitForScheduleReady(page);

    const heading = page.getByTestId('schedules-week-heading');
    await expect(heading).toHaveText(new RegExp(targetWeekLabel));

    await expect
      .poll(async () => readLiveMessage(page), { timeout: 5_000 })
      .not.toBe('');

    const liveText = await readLiveMessage(page);
    expect(liveText).toContain(targetWeekLabel);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForScheduleReady(page);

    const reloadedLiveText = await readLiveMessage(page);
    expect(reloadedLiveText).toBe(liveText);
  });
});
