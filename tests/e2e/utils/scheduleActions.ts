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

export const getVisibleListbox = (page: Page) => page.locator('[role="listbox"]:visible').first();

const selectComboboxOption = async (page: Page, option?: SelectOption) => {
  // Use the visible listbox to avoid preview UI portal differences.
  const listbox = getVisibleListbox(page);
  await expect(listbox).toBeVisible({ timeout: 10_000 });

  if (typeof option === 'string') {
    await listbox.getByRole('option', { name: option }).first().click();
    return;
  }
  if (option instanceof RegExp) {
    await listbox.getByRole('option', { name: option }).first().click();
    return;
  }
  await listbox.getByRole('option').first().click();
};

export const getQuickScheduleDialog = (page: Page) => {
  const byRole = page
    .getByRole('dialog')
    .filter({ has: page.getByTestId(TESTIDS['schedule-create-save']) })
    .first();

  const byPresentation = page
    .locator('[role="presentation"]')
    .filter({ has: page.getByTestId(TESTIDS['schedule-create-save']) })
    .first();

  const legacy = page.getByTestId(TESTIDS['schedule-create-dialog']);

  const fallbackSave = page.getByTestId(TESTIDS['schedule-create-save']);

  return byRole.or(byPresentation).or(legacy).or(fallbackSave).first();
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
  const trigger = page.getByTestId(TESTIDS.SCHEDULES_FAB_CREATE);
  await expect(trigger).toBeVisible();
  await trigger.click();
  const dialog = getQuickScheduleDialog(page);
  await expect(dialog).toBeVisible({ timeout: 15_000 });
}

export async function fillQuickUserCareForm(page: Page, opts: QuickUserCareFormOptions = {}) {
  const dialog = getQuickScheduleDialog(page);
  await expect(dialog).toBeVisible({ timeout: 15_000 });

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
    await expect(getVisibleListbox(page)).toBeVisible({ timeout: 10_000 });
    await selectComboboxOption(page, opts.userOptionName ?? opts.userInputValue);
  }

  if (opts.staffInputValue || opts.staffOptionName) {
    const staffInput = dialog.getByTestId(TESTIDS['schedule-create-staff-id']);
    if (opts.staffInputValue) {
      await staffInput.fill(opts.staffInputValue);
    } else {
      await staffInput.click();
    }
    await expect(getVisibleListbox(page)).toBeVisible({ timeout: 10_000 });
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
    await expect(getVisibleListbox(page)).toBeVisible({ timeout: 10_000 });
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
  const dialog = getQuickScheduleDialog(page);
  await expect(dialog).toBeVisible({ timeout: 15_000 });

  const saveButton = dialog.getByTestId(TESTIDS['schedule-create-save']);
  await expect(saveButton).toBeVisible({ timeout: 15_000 });
  await expect(saveButton).toBeEnabled({ timeout: 15_000 });

  await saveButton.click();
  await expect(dialog).toBeHidden({ timeout: 15_000 });
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
  // Ensure week tab/panel is active in preview UI.
  const weekTab = page.getByRole('tab', { name: /週|Week/i });
  if ((await weekTab.count().catch(() => 0)) > 0) {
    await weekTab.first().click();
  }
  await expect(page.locator('#panel-week:not([hidden])')).toBeVisible({ timeout: 15_000 });

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
    await expect(getQuickScheduleDialog(page)).toBeVisible({ timeout: 15_000 });
    return buttonCandidate;
  }
  await target.focus();
  await target.click();
  await expect(getQuickScheduleDialog(page)).toBeVisible({ timeout: 15_000 });
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
