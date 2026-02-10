/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck -- Playwright helpers live outside the main tsconfig include set.
import { expect, test } from '@playwright/test';

import { TESTIDS } from '@/testids';

import { bootstrapScheduleEnv } from './utils/scheduleEnv';
import { gotoScheduleWeek } from './utils/scheduleWeek';
import { waitForDayTimeline, waitForWeekViewReady } from './utils/wait';

test.describe('Schedules day create flow (facility)', () => {
  test('Week lane -> Day create defaults to facility', async ({ page }) => {
    await bootstrapScheduleEnv(page, {
      storage: { 'e2e:schedules.v1': JSON.stringify([]) },
    });

    const date = new Date('2026-02-10T00:00:00+09:00');
    await gotoScheduleWeek(page, date, { searchParams: { lane: 'Org' } });
    await waitForWeekViewReady(page);
    await waitForDayTimeline(page);

    const cta = page.getByRole('button', { name: '施設予定を追加' });
    await expect(cta).toBeVisible();
    await cta.click();

    const dialog = page.getByTestId(TESTIDS['schedule-create-dialog']);
    await expect(dialog).toBeVisible();

    const categorySelect = dialog.getByTestId(TESTIDS['schedule-create-category-select']);
    await expect(categorySelect).toContainText('施設');

    const titleInput = dialog.getByTestId(TESTIDS['schedule-create-title']);
    await expect(titleInput).toBeFocused();
  });
});
