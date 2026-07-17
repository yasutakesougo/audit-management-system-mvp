/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */
// @ts-nocheck -- Playwright e2e files live outside the main tsconfig include set.
import '@/test/captureSp400';
import { expect, test } from '@playwright/test';
import { TESTIDS } from '@/testids';
import { bootSchedule } from './_helpers/bootSchedule';
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

    const pageRoot = page.getByTestId(TESTIDS['schedules-day-page']);
    await expect(pageRoot).toHaveCount(1);
    await expect(pageRoot).toBeVisible();

    const returnWeek = page.getByTestId('schedules-return-week');
    await expect(returnWeek).toHaveCount(1);
    await expect(returnWeek).toBeVisible();

    const dayTimeline = page.getByTestId(TESTIDS['schedules-day-page']);
    await expect(dayTimeline).toBeVisible();

    await openQuickUserCareDialog(page);

    const dialog = page.getByTestId(TESTIDS['schedule-create-dialog']);
    await expect(dialog).toHaveCount(1);
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-labelledby', `${TESTIDS['schedule-create-dialog']}-heading`);
    await expect(dialog).toHaveAttribute('aria-describedby', `${TESTIDS['schedule-create-dialog']}-description`);
    await expect(page.getByTestId(TESTIDS['schedule-create-heading'])).toHaveText('スケジュール新規作成');

    // Close via Escape key to avoid MUI Dialog pointer-event interception
    // (CloseIcon SVG in the aria-hidden root subtree blocks button clicks).
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden({ timeout: 5_000 });
    const createTrigger = page.getByTestId(TESTIDS.SCHEDULES_FAB_CREATE).or(
      page.getByTestId(TESTIDS.SCHEDULES_HEADER_CREATE),
    );
    await expect(createTrigger).toHaveCount(1);
    await expect(createTrigger).toBeVisible();
    await expect(createTrigger).toBeFocused();
  });

  test('header action uses descriptive aria-label', async ({ page }) => {
    await gotoDay(page, new Date('2025-11-10'));
    await waitForDayViewReady(page);
    await expect(page).toHaveURL(/\/schedules\/week/);
    await expect(page).toHaveURL(/tab=day/);

    const prevButton = page.getByTestId(TESTIDS.SCHEDULES_PREV_WEEK);
    await expect(prevButton).toHaveCount(1);
    await expect(prevButton).toHaveAttribute('aria-label', /前の期間/);

    const nextButton = page.getByTestId(TESTIDS.SCHEDULES_NEXT_WEEK);
    await expect(nextButton).toHaveCount(1);
    await expect(nextButton).toHaveAttribute('aria-label', /次の期間/);
  });
});
