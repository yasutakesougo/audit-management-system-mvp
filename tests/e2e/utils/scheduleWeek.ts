/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck -- Playwright helpers live outside the main tsconfig include set.
import { expect, type Page } from '@playwright/test';

import { TESTIDS } from '@/testids';

import { gotoWeek } from './scheduleNav';
import { waitForWeekViewReady } from './wait';

type GotoWeekOptions = Parameters<typeof gotoWeek>[2];

export async function gotoScheduleWeek(page: Page, date: Date, options?: GotoWeekOptions): Promise<void> {
  await gotoWeek(page, date, options);
  await waitForWeekViewReady(page);
}

const toLocalDateTime = (date: Date, time: string): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}T${time}`;
};

type CreateOrgScheduleOptions = {
  title: string;
  date?: Date;
  startTime?: string;
  endTime?: string;
  location?: string;
  notes?: string;
};

export async function createOrgSchedule(page: Page, options: CreateOrgScheduleOptions): Promise<void> {
  const date = options.date ?? new Date();
  const startLocal = toLocalDateTime(date, options.startTime ?? '10:00');
  const endLocal = toLocalDateTime(date, options.endTime ?? '11:00');

  await page.getByTestId(TESTIDS.SCHEDULES_FAB_CREATE).click();
  const dialog = page.getByTestId(TESTIDS['schedule-create-dialog']);
  await expect(dialog).toBeVisible();

  await dialog.getByTestId(TESTIDS['schedule-create-title']).fill(options.title);

  const categorySelect = dialog.getByTestId(TESTIDS['schedule-create-category-select']);
  await categorySelect.click();
  await page.getByRole('option', { name: '事業所' }).click();

  await dialog.getByTestId(TESTIDS['schedule-create-start']).fill(startLocal);
  await dialog.getByTestId(TESTIDS['schedule-create-end']).fill(endLocal);

  if (options.location) {
    await dialog.getByTestId(TESTIDS['schedule-create-location']).fill(options.location);
  }
  if (options.notes) {
    await dialog.getByTestId(TESTIDS['schedule-create-notes']).fill(options.notes);
  }

  await dialog.getByTestId(TESTIDS['schedule-create-save']).click();
  await expect(dialog).toBeHidden({ timeout: 15_000 });
}
