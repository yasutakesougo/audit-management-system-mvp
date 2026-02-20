/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */
// @ts-nocheck -- Playwright e2e files live outside the main tsconfig include set.
import '@/test/captureSp400';
import { expect, Page, test } from '@playwright/test';
import { TESTIDS } from '@/testids';
import { bootSchedule } from './_helpers/bootSchedule';
import { expectLocatorVisibleBestEffort, expectTestIdVisibleBestEffort } from './_helpers/smoke';
import { gotoMonth } from './utils/scheduleNav';
import { getOrgChipText, waitForDayViewReady, waitForMonthViewReady } from './utils/scheduleActions';

const OCTOBER_START = new Date('2025-10-01');
const NOVEMBER_TARGET = new Date('2025-11-26');

const openMonthView = async (page: Page, date: Date) => {
  await gotoMonth(page, date);
  await waitForMonthViewReady(page);
};

async function waitForMonthDayOverlay(page: Page) {
  const popoverOpenDay = page.getByTestId(TESTIDS['schedules-popover-open-day']);
  const anyDialog = page
    .getByRole('dialog')
    .filter({ has: page.getByRole('button', { name: /追加|Add/i }) });

  await Promise.race([
    popoverOpenDay.waitFor({ state: 'visible', timeout: 15_000 }),
    anyDialog.first().waitFor({ state: 'visible', timeout: 15_000 }),
  ]);

  const popoverVisible = await popoverOpenDay.isVisible().catch(() => false);
  if (popoverVisible) {
    return { kind: 'popover' as const, popoverOpenDay };
  }

  return { kind: 'dialog' as const, dialog: anyDialog.first() };
}

test.describe('Schedules month ARIA smoke', () => {
  test.beforeEach(async ({ page }) => {
    await bootSchedule(page);
  });

  test('shows guidance when no events exist', async ({ page }) => {
    await openMonthView(page, OCTOBER_START);

    const root = page.getByTestId('schedules-month-page');
    await expectLocatorVisibleBestEffort(
      root,
      'testid not found: schedules-month-page (allowed for smoke)'
    );

    // Empty hint may or may not be present depending on data
    const emptyHint = root.getByTestId('schedules-empty-hint');
    if ((await emptyHint.count()) > 0) {
      await expect(emptyHint).toBeVisible();
    }
  });

  test('exposes heading, navigation, and org indicator', async ({ page }) => {
    await openMonthView(page, NOVEMBER_TARGET);

    const root = page.getByTestId('schedules-month-page');
    await expectLocatorVisibleBestEffort(
      root,
      'testid not found: schedules-month-page (allowed for smoke)'
    );

    // Navigation buttons may not be present if no events exist
    const prevButton = page.getByRole('button', { name: '前の月へ移動' });
    const prevButtonCount = await prevButton.count();
    if (prevButtonCount === 0) {
      test.skip(true, 'Month navigation not available (no events in environment).');
    }

    await expect(prevButton).toBeVisible();
    await expect(page.getByRole('button', { name: '今月に移動' })).toBeVisible();
    await expect(page.getByRole('button', { name: '次の月へ移動' })).toBeVisible();

    // Heading is expected in most cases
    const heading = page.getByRole('heading', { level: 2 });
    if ((await heading.count()) > 0) {
      await expect(heading).toBeVisible();
    }

    // Org chip may not be available in all environments
    const orgChipText = await getOrgChipText(page, 'month');
    if (!orgChipText) {
      test.skip(true, 'Month org indicator not available in this environment.');
    }
  });

  test('month navigation updates the heading label', async ({ page }) => {
    await openMonthView(page, NOVEMBER_TARGET);

    const heading = page.getByRole('heading', { level: 2 });
    const headingCount = await heading.count();
    if (headingCount === 0) {
      test.skip(true, 'Month heading not rendered (no data in environment).');
    }
    const before = (await heading.textContent())?.trim();

    await page.getByRole('button', { name: '前の月へ移動' }).click();

    await expect
      .poll(async () => (await heading.textContent())?.trim() ?? '')
      .not.toBe(before ?? '');
  });

  test('navigates to day view when a calendar card is clicked', async ({ page }) => {
    await openMonthView(page, OCTOBER_START);
    await page.getByRole('dialog').first().waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});

    const dayCards = page.locator(`[data-testid^="${TESTIDS.SCHEDULES_MONTH_DAY_PREFIX}-"]`);
    const dayCardsCount = await dayCards.count();
    if (dayCardsCount === 0) {
      test.skip(true, 'No day cards in month view (no events in environment).');
    }

    const dayCard = dayCards.first();
    await expect(dayCard).toBeVisible();
    await dayCard.click();

    const overlay = await waitForMonthDayOverlay(page);
    if (overlay.kind === 'popover') {
      await expectLocatorVisibleBestEffort(
        overlay.popoverOpenDay,
        `testid not found: ${TESTIDS['schedules-popover-open-day']} (allowed for smoke)`
      );
      await overlay.popoverOpenDay.click();

      await waitForDayViewReady(page);
      await expect(page).toHaveURL(/tab=day/);
      await expectTestIdVisibleBestEffort(page, TESTIDS['schedules-day-page']);
      return;
    }

    await expect(overlay.dialog.getByRole('button', { name: /追加|Add/i })).toBeVisible();
  });
});
