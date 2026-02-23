/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */
// @ts-nocheck -- Playwright e2e files live outside the main tsconfig include set.
import '@/test/captureSp400';
import { expect, test } from '@playwright/test';
import { TESTIDS } from '@/testids';
import { bootSchedule } from './_helpers/bootSchedule';
import { expectLocatorVisibleBestEffort, expectTestIdVisibleBestEffort } from './_helpers/smoke';
import { gotoDay } from './utils/scheduleNav';
import { waitForDayViewReady, openQuickUserCareDialog } from './utils/scheduleActions';

// Mirrors the week ARIA smoke test to ensure the day view wires the shared dialog + focus semantics.

test.describe('Schedules day ARIA smoke', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (message) => {
      if (message.type() === 'info' && message.text().startsWith('[schedulesClient] fixtures=')) {
        // Echo fixture-mode logs to the Playwright reporter output for quick diagnosis.
        // eslint-disable-next-line no-console
        console.log(`browser-console: ${message.text()}`);
      }
    });

    await bootSchedule(page);
  });

  test('Quick create button opens dialog and restores focus', async ({ page }) => {
    await gotoDay(page, new Date('2025-11-24'));
    await waitForDayViewReady(page);

    const pageRoot = page.getByTestId(TESTIDS['schedules-day-page']).first();
    await expectLocatorVisibleBestEffort(
      pageRoot,
      `testid not found: ${TESTIDS['schedules-day-page']} (allowed for smoke)`
    );

    const dayTab = page.getByTestId(TESTIDS.SCHEDULES_WEEK_TAB_DAY).first();
    await expectLocatorVisibleBestEffort(
      dayTab,
      `testid not found: ${TESTIDS.SCHEDULES_WEEK_TAB_DAY} (allowed for smoke)`
    );

    const dayTimeline = page.getByTestId(TESTIDS['schedules-day-page']).first();
    await expectLocatorVisibleBestEffort(
      dayTimeline,
      `testid not found: ${TESTIDS['schedules-day-page']} (allowed for smoke)`
    );

    await openQuickUserCareDialog(page);

    const dialog = page.getByTestId(TESTIDS['schedule-create-dialog']);
    await expectLocatorVisibleBestEffort(
      dialog,
      `testid not found: ${TESTIDS['schedule-create-dialog']} (allowed for smoke)`
    );
    await expect(dialog).toHaveAttribute('aria-labelledby', `${TESTIDS['schedule-create-dialog']}-heading`);
    await expect(dialog).toHaveAttribute('aria-describedby', `${TESTIDS['schedule-create-dialog']}-description`);
    await expect(page.getByTestId(TESTIDS['schedule-create-heading'])).toHaveText('スケジュール新規作成');

    await page.getByRole('button', { name: 'キャンセル' }).click();
    await expect(dialog).toBeHidden();
    await expectTestIdVisibleBestEffort(page, TESTIDS.SCHEDULES_FAB_CREATE);
  });

  test('header action uses descriptive aria-label', async ({ page }) => {
    await gotoDay(page, new Date('2025-11-10'));
    await waitForDayViewReady(page);
    await expect(page).toHaveURL(/\/schedules\/week/);
    await expect(page).toHaveURL(/tab=day/);

    const prevButton = page.getByTestId(TESTIDS.SCHEDULES_PREV_WEEK).first();
    await expect(prevButton).toHaveCount(1);
    await expect(prevButton).toHaveAttribute('aria-label', /前の期間/);

    const nextButton = page.getByTestId(TESTIDS.SCHEDULES_NEXT_WEEK).first();
    await expect(nextButton).toHaveCount(1);
    await expect(nextButton).toHaveAttribute('aria-label', /次の期間/);
  });
});
