import type { Page } from '@playwright/test';

import { gotoWeek } from './scheduleNav';
import { waitForWeekTimeline } from './wait';

type GotoWeekOptions = Parameters<typeof gotoWeek>[2];

export async function gotoScheduleWeek(page: Page, date: Date, options?: GotoWeekOptions): Promise<void> {
  await gotoWeek(page, date, options);
  await waitForWeekTimeline(page);
}
