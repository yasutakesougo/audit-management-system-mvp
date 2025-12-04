/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck -- Playwright helpers live outside the main tsconfig include set.

import { expect, type Locator, type Page } from '@playwright/test';

import { TESTIDS } from '@/testids';

import { waitForDayTimeline, waitForMonthTimeline, waitForWeekTimeline } from './wait';

type SelectOption = string | RegExp;

type QuickUserCareFormOptions = {
  title?: string;
  userInputValue?: string;
  userOptionName?: SelectOption;
  staffInputValue?: string;
  staffOptionName?: SelectOption;
  serviceOptionLabel?: SelectOption;
  startLocal?: string;
  endLocal?: string;
  location?: string;
  notes?: string;
};

const selectComboboxOption = async (page: Page, option?: SelectOption) => {
  if (typeof option === 'string') {
    await page.getByRole('option', { name: option }).first().click();
    return;
  }
  if (option instanceof RegExp) {
    await page.getByRole('option', { name: option }).first().click();
    return;
  }
  await page.getByRole('option').first().click();
};

export async function waitForDayViewReady(page: Page) {
  await waitForDayTimeline(page);
}

export async function waitForWeekViewReady(page: Page) {
  await waitForWeekTimeline(page);
}

export async function waitForMonthViewReady(page: Page) {
  await waitForMonthTimeline(page);
}

export async function openQuickUserCareDialog(page: Page) {
  const trigger = page.getByTestId(TESTIDS['schedule-create-quick-button']);
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.getByTestId(TESTIDS['schedule-create-dialog'])).toBeVisible();
}

export async function fillQuickUserCareForm(page: Page, opts: QuickUserCareFormOptions = {}) {
  const dialog = page.getByTestId(TESTIDS['schedule-create-dialog']);

  if (opts.title) {
    await dialog.getByTestId(TESTIDS['schedule-create-title']).fill(opts.title);
  }

  if (opts.userInputValue || opts.userOptionName) {
    const userInput = dialog.getByTestId(TESTIDS['schedule-create-user-input']);
    if (opts.userInputValue) {
      await userInput.fill(opts.userInputValue);
    } else {
      await userInput.click();
    }
    await selectComboboxOption(page, opts.userOptionName ?? opts.userInputValue);
  }

  if (opts.staffInputValue || opts.staffOptionName) {
    const staffInput = dialog.getByTestId(TESTIDS['schedule-create-staff-id']);
    if (opts.staffInputValue) {
      await staffInput.fill(opts.staffInputValue);
    } else {
      await staffInput.click();
    }
    await selectComboboxOption(page, opts.staffOptionName ?? opts.staffInputValue);
  }

  if (opts.startLocal) {
    await dialog.getByTestId(TESTIDS['schedule-create-start']).fill(opts.startLocal);
  }

  if (opts.endLocal) {
    await dialog.getByTestId(TESTIDS['schedule-create-end']).fill(opts.endLocal);
  }

  if (opts.serviceOptionLabel) {
    await dialog.getByTestId(TESTIDS['schedule-create-service-type']).click();
    await selectComboboxOption(page, opts.serviceOptionLabel);
  }

  if (typeof opts.location === 'string') {
    await dialog.getByTestId(TESTIDS['schedule-create-location']).fill(opts.location);
  }

  if (typeof opts.notes === 'string') {
    await dialog.getByTestId(TESTIDS['schedule-create-notes']).fill(opts.notes);
  }
}

export async function submitQuickUserCareForm(page: Page) {
  const dialog = page.getByTestId(TESTIDS['schedule-create-dialog']);
  await dialog.getByTestId(TESTIDS['schedule-create-save']).click();
  await expect(dialog).toBeHidden({ timeout: 10_000 });
  await waitForDayTimeline(page);
}

export async function assertDayHasUserCareEvent(
  page: Page,
  opts: {
    titleContains?: string;
    serviceContains?: string;
    userName?: string;
    memoContains?: string;
  } = {},
) {
  const { titleContains, serviceContains, userName, memoContains } = opts;
  const root = page.locator(
    `[data-testid="${TESTIDS['schedules-day-page']}"] , [data-testid="schedule-day-root"]`,
  ).first();
  await expect(root).toBeVisible();

  if (titleContains) {
    const card = root
      .locator('[data-schedule-event="true"][data-category="User"]')
      .filter({ hasText: titleContains })
      .first();
    await expect(card).toBeVisible({ timeout: 15_000 });
    if (serviceContains) {
      await expect(card).toContainText(serviceContains);
    }
  }

  if (userName) {
    await expect(root.getByText(userName, { exact: false }).first()).toBeVisible({ timeout: 15_000 });
  }

  if (memoContains) {
    await expect(root.getByText(memoContains, { exact: false }).first()).toBeVisible({ timeout: 15_000 });
  }
}

export async function getOrgChipText(page: Page, view: 'week' | 'month' | 'day'): Promise<string> {
  const testIdMap = {
    week: TESTIDS.SCHEDULE_WEEK_ORG_INDICATOR,
    month: TESTIDS.SCHEDULE_MONTH_ORG_INDICATOR,
    day: TESTIDS.SCHEDULE_DAY_ORG_INDICATOR,
  } as const;
  return page.getByTestId(testIdMap[view]).innerText();
}

const WEEK_PANEL_VISIBLE = '#panel-week:not([hidden])';
const WEEK_TIMELINE_PANEL_VISIBLE = '#panel-timeline:not([hidden])';

const buildWeekRootCandidates = (page: Page): Locator[] => [
  page.locator(`${WEEK_TIMELINE_PANEL_VISIBLE} [data-testid="schedules-week-timeline"]`),
  page.locator(`${WEEK_TIMELINE_PANEL_VISIBLE} [data-testid="schedule-week-root"]`),
  page.getByTestId('schedules-week-timeline'),
  page.locator(`${WEEK_PANEL_VISIBLE} [data-testid="schedule-week-root"]`),
  page.locator(`${WEEK_PANEL_VISIBLE} [data-testid="schedule-week-view"]`),
  page.getByTestId('schedule-week-root'),
  page.getByTestId('schedule-week-view'),
];

const getWeekTimelineRoot = async (page: Page): Promise<Locator> => {
  const candidates = buildWeekRootCandidates(page);
  for (const locator of candidates) {
    const candidate = locator.first();
    if ((await candidate.count().catch(() => 0)) === 0) continue;
    const visible = await candidate.isVisible().catch(() => false);
    if (visible) {
      return candidate;
    }
  }

  for (const locator of candidates) {
    const candidate = locator.first();
    if ((await candidate.count().catch(() => 0)) > 0) {
      return candidate;
    }
  }

  return page.getByTestId('schedule-week-view').first();
};

export async function getWeekScheduleItems(
  page: Page,
  opts: {
    category?: 'User' | 'Staff' | 'Org';
  } = {},
) {
  const { category } = opts;
  const categorySelector = category ? `[data-category="${category}"]` : '';
  const root = await getWeekTimelineRoot(page);
  return root.locator(`[data-testid="schedule-item"]${categorySelector}`);
}

export async function openWeekEventCard(
  page: Page,
  opts: {
    index?: number;
    titleContains?: string;
    category?: 'User' | 'Staff' | 'Org';
  } = {},
) {
  const root = await getWeekTimelineRoot(page);
  await expect(root).toBeVisible({ timeout: 15_000 });

  const { index = 0, titleContains, category } = opts;
  let locator = await getWeekScheduleItems(page, { category });

  if (titleContains) {
    locator = locator.filter({ hasText: titleContains });
  }

  const target = locator.nth(index);
  await expect(target).toBeVisible({ timeout: 15_000 });
  const buttonCandidate = target.locator('button').first();
  if ((await buttonCandidate.count().catch(() => 0)) > 0) {
    await buttonCandidate.focus();
    await buttonCandidate.click();
    return buttonCandidate;
  }
  await target.focus();
  await target.click();
  return target;
}

export async function assertWeekHasUserCareEvent(
  page: Page,
  opts: {
    titleContains?: string;
    serviceContains?: string;
    userName?: string;
    memoContains?: string;
  } = {},
) {
  const root = await getWeekTimelineRoot(page);
  await expect(root).toBeVisible({ timeout: 15_000 });
  const rootTestId = await root.getAttribute('data-testid').catch(() => null);
  const isTimelineOnlyLayout = rootTestId === 'schedules-week-timeline';

  const { titleContains, serviceContains, userName, memoContains } = opts;
  let cardLocator = await getWeekScheduleItems(page, { category: 'User' });

  if (titleContains) {
    cardLocator = cardLocator.filter({ hasText: titleContains });
  }

  const card = cardLocator.first();
  await expect(card).toBeVisible({ timeout: 15_000 });

  if (serviceContains && !isTimelineOnlyLayout) {
    await expect(card).toContainText(serviceContains);
  }

  if (userName && !isTimelineOnlyLayout) {
    await expect(root.getByText(userName, { exact: false }).first()).toBeVisible({ timeout: 15_000 });
  }

  if (memoContains && !isTimelineOnlyLayout) {
    await expect(root.getByText(memoContains, { exact: false }).first()).toBeVisible({ timeout: 15_000 });
  }
}
