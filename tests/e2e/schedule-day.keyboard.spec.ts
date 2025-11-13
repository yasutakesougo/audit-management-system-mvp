import { TESTIDS } from '@/testids';
import { expect, test, type Page } from '@playwright/test';
import { enableLiveEnv } from './_helpers/schedule';
import { waitForDayScheduleReady } from './utils/wait';

async function assertActiveElementTestId(page: Page, testId: string): Promise<void> {
  await expect
    .poll(async () => {
      const result = await page.evaluate(() => {
        const active = document.activeElement as HTMLElement | null;
        return {
          id: active?.getAttribute?.('data-testid') ?? '',
          tag: active?.tagName ?? null,
        };
      });
      // eslint-disable-next-line no-console
      console.log('day-debug poll value', result);
      return result.id;
    }, {
      timeout: 10_000,
    })
    .toBe(testId);
}

test.describe('Schedule day keyboard navigation', () => {
  test.beforeEach(async ({ page }) => {
    await enableLiveEnv(page);
  });

  test('Day navigation: ArrowLeft/Right updates label/URL/focus', async ({ page }) => {
    await page.goto('/schedules/day', { waitUntil: 'domcontentloaded' });
    await waitForDayScheduleReady(page);

    const container = page.getByTestId(TESTIDS['schedules-day-page']);
    await container.focus();

    const heading = page.getByTestId(TESTIDS['schedules-day-heading']);
    const initialLabel = (await heading.textContent()) ?? '';
    expect(initialLabel).toMatch(/日次スケジュール（\d{4}\/\d{2}\/\d{2}）/);

    const initialParam = new URL(page.url()).searchParams.get('day');

    await page.keyboard.press('ArrowRight');
    await waitForDayScheduleReady(page);

    const debugActiveAfterNext = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      return {
        tag: active?.tagName ?? null,
        testId: active?.getAttribute?.('data-testid') ?? null,
        html: active?.outerHTML ?? null,
      };
    });
    // eslint-disable-next-line no-console
    console.log('day-debug after ArrowRight', debugActiveAfterNext);

    const nextLabel = (await heading.textContent()) ?? '';
    expect(nextLabel).not.toBe(initialLabel);
    await expect(page).toHaveURL(/[?&]day=\d{4}-\d{2}-\d{2}/);

    const debugBeforeAssert = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      return {
        tag: active?.tagName ?? null,
        testId: active?.getAttribute?.('data-testid') ?? null,
      };
    });
    // eslint-disable-next-line no-console
    console.log('day-debug before assert', debugBeforeAssert);
    const focusDbg = await page.evaluate(() => (window as typeof window & { __focusDbg__?: unknown }).__focusDbg__ ?? null);
    // eslint-disable-next-line no-console
    console.log('day-debug focusDbg', focusDbg);
    await assertActiveElementTestId(page, TESTIDS['schedules-next']);

    await page.keyboard.press('ArrowLeft');
    await waitForDayScheduleReady(page);

    await expect
      .poll(async () => (await heading.textContent()) ?? '', { timeout: 10_000 })
      .toBe(initialLabel);
    if (initialParam) {
      await expect(page).toHaveURL(new RegExp(`[?&]day=${initialParam}`));
    }
    await assertActiveElementTestId(page, TESTIDS['schedules-prev']);
  });
});
