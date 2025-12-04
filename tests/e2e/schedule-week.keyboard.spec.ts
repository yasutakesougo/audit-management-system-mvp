import '@/test/captureSp400';
import { expect, test, type Locator, type Page } from '@playwright/test';
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

  const weekTab = page.getByRole('tab', { name: /週/ });
  await expect(weekTab).toHaveAttribute('aria-selected', 'true');

  await expect(page.getByTestId('schedule-week-root')).toBeVisible();
  await expect(page.locator('[id^="timeline-week-header-"]').first()).toBeVisible();
};

const readFirstTimelineHeaderId = async (page: Page): Promise<string> => {
  const firstHeader = page.locator('[id^="timeline-week-header-"]').first();
  await expect(firstHeader).toBeVisible();
  const id = await firstHeader.getAttribute('id');
  if (!id) {
    throw new Error('Timeline header id missing');
  }
  return id;
};

const focusLocator = async (locator: Locator): Promise<void> => {
  await locator.scrollIntoViewIfNeeded();
  await locator.focus();
};

test.describe('Schedule week keyboard navigation', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (message) => {
      if (message.type() === 'info' && message.text().startsWith('[schedulesClient] fixtures=')) {
        // Forward fixture logs to the Playwright reporter to aid debugging when the mock layer changes.
        // eslint-disable-next-line no-console
        console.log(`browser-console: ${message.text()}`);
      }
      if (message.type() === 'error' && message.text().includes('SharePoint')) {
        // eslint-disable-next-line no-console
        console.log(`browser-console:error ${message.text()}`);
      }
    });

    page.on('requestfailed', (request) => {
      const failure = request.failure();
      // eslint-disable-next-line no-console
      console.log(`request-failed: ${request.url()} ${failure?.errorText ?? ''}`.trim());
    });

    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/_api/')) {
        // eslint-disable-next-line no-console
        console.log(`request: ${url}`);
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

  test('keyboard focus moves across tabs and restores the week timeline', async ({ page }) => {
    await gotoWeek(page, new Date('2025-11-24'));
    await waitForWeekTimeline(page);

    const tablist = page.getByRole('tablist', { name: 'スケジュールビュー切り替え' });
    const weekTab = tablist.getByRole('tab', { name: '週' });
    const dayTab = tablist.getByRole('tab', { name: '日' });

    await weekTab.click();
    await focusLocator(weekTab);
    await expect(weekTab).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(dayTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('schedule-day-root')).toBeVisible();

    await focusLocator(dayTab);
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Enter');
    await expect(weekTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('schedule-week-root')).toBeVisible();
    await expect(page.locator('[id^="timeline-week-header-"]').first()).toBeVisible();
  });

  test('period navigation buttons respond to keyboard activation', async ({ page }) => {
    await gotoWeek(page, new Date('2025-11-24'));
    await waitForWeekTimeline(page);

    const readHeader = () => readFirstTimelineHeaderId(page);
    const initialHeaderId = await readHeader();

    const prevButton = page.getByRole('button', { name: '前の期間' });
    await focusLocator(prevButton);
    await page.keyboard.press('Enter');
    await expect.poll(readHeader, { timeout: 10_000 }).not.toBe(initialHeaderId);

    const nextButton = page.getByRole('button', { name: '次の期間' });
    await focusLocator(nextButton);
    await page.keyboard.press('Enter');
    await expect.poll(readHeader, { timeout: 10_000 }).toBe(initialHeaderId);
  });

  test('search interactions do not change the active week timeline', async ({ page }) => {
    await gotoWeek(page, new Date('2025-11-24'));
    await waitForWeekTimeline(page);

    const weekTab = page.getByRole('tab', { name: '週' });
    const readHeader = () => readFirstTimelineHeaderId(page);
    const initialHeaderId = await readHeader();

    const searchInput = page.getByPlaceholder('予定名、メモ、担当など');
    await focusLocator(searchInput);
    await searchInput.type('ABC');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');

    expect(await readHeader()).toBe(initialHeaderId);
    await expect(weekTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('schedule-week-root')).toBeVisible();
  });
});
