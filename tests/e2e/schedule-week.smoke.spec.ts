import '@/test/captureSp400';
import { expect, test, type Page } from '@playwright/test';
import { gotoWeek } from './utils/scheduleNav';
import { runA11ySmoke } from './utils/a11y';

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
  await expect(heading).toBeVisible({ timeout: 15_000 });

  const weekTab = page.getByRole('tab', { name: /週/ });
  await expect(weekTab).toHaveAttribute('aria-selected', 'true');

  await expect(page.getByTestId('schedule-week-root')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[id^="timeline-week-header-"]').first()).toBeVisible({ timeout: 15_000 });
};

test.describe('Schedule week smoke', () => {
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

  test('renders week timeline, shows headers, and passes Axe', async ({ page }) => {
    await gotoWeek(page, new Date('2025-11-24'));
    await waitForWeekTimeline(page);

    const timeline = page.getByTestId('schedule-week-root');
    await expect(timeline).toBeVisible();

    const grid = page.getByRole('grid', { name: '週ごとの予定一覧' });
    await expect(grid).toBeVisible();

    const columnHeaders = page.locator('[id^="timeline-week-header-"]');
    await expect(columnHeaders.first()).toBeVisible();

    for (const label of ['利用者レーン', '職員レーン', '組織イベント'] as const) {
      await expect(page.getByRole('rowheader', { name: label })).toBeVisible();
    }

    await expect(page.getByRole('gridcell').first()).toBeVisible();

    await runA11ySmoke(page, 'Schedules Week', {
      selectors: '[data-testid="schedule-week-root"]',
      // Known contrast + focusable issues tracked in PDCA-2187; re-enable once tokens are updated.
      runOptions: {
        rules: {
          'color-contrast': { enabled: false },
          'scrollable-region-focusable': { enabled: false },
        },
      },
    });
  });

  test('week tab stays active when switching views', async ({ page }) => {
    await gotoWeek(page, new Date('2025-11-24'));
    await waitForWeekTimeline(page);

    const tablist = page.getByRole('tablist');
    const weekTab = tablist.getByRole('tab', { name: '週' });
    const dayTab = tablist.getByRole('tab', { name: '日' });

    await dayTab.click();
    await expect(dayTab).toHaveAttribute('aria-selected', 'true');

    await weekTab.click();
    await expect(weekTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('schedule-week-root')).toBeVisible();
    await expect(page.locator('[id^="timeline-week-header-"]').first()).toBeVisible();
  });

  test('period controls shift the visible week headers', async ({ page }) => {
    await gotoWeek(page, new Date('2025-11-24'));
    await waitForWeekTimeline(page);

    const readFirstHeaderId = async (): Promise<string> => (await page.locator('[id^="timeline-week-header-"]').first().getAttribute('id')) ?? '';
    const initialHeaderId = await readFirstHeaderId();
    expect(initialHeaderId).toMatch(/^timeline-week-header-/);

    const prevButton = page.getByRole('button', { name: '前の期間' });
    const nextButton = page.getByRole('button', { name: '次の期間' });

    await prevButton.click();
    await expect.poll(readFirstHeaderId, { timeout: 10_000 }).not.toBe(initialHeaderId);

    await nextButton.click();
    await expect.poll(readFirstHeaderId, { timeout: 10_000 }).toBe(initialHeaderId);
  });
});
