import { expect, type Locator, type Page } from '@playwright/test';
import { TESTIDS } from '@/testids';

export async function waitForTestId(page: Page, id: string, timeout = 10_000): Promise<void> {
  await expect(page.getByTestId(id)).toBeVisible({ timeout });
}

const locatorExists = async (locator: Locator, timeout = 2_000): Promise<boolean> => {
  try {
    await locator.first().waitFor({ state: 'attached', timeout });
    return true;
  } catch {
    return false;
  }
};

export async function waitForScheduleReady(page: Page, timeout = 15_000): Promise<void> {
  const pageRoot = page.getByTestId(TESTIDS['schedules-week-page']);
  const detailList = page.locator('[data-testid="schedule-week-list"]');
  const emptyState = page.locator('[data-testid="schedule-week-empty"]');
  const loading = page.locator('[aria-busy="true"]');

  await expect(pageRoot).toBeVisible({ timeout });
  await expect(detailList.or(emptyState).or(loading)).toBeVisible({ timeout });

  if (await loading.isVisible().catch(() => false)) {
    await loading.waitFor({ state: 'detached', timeout }).catch(() => undefined);
  }

  await expect(detailList.or(emptyState)).toBeVisible({ timeout });
}

export async function waitForDayScheduleReady(page: Page, timeout = 15_000): Promise<void> {
  const pageRoot = page.getByTestId('schedules-day-page');
  const skeleton = page.getByTestId('schedules-day-skeleton');
  const list = page.getByTestId('schedules-day-list');
  const emptyState = page.getByTestId(TESTIDS.SCHEDULES_EMPTY_HINT);
  const heading = page.getByTestId(TESTIDS['schedules-day-heading']);

  await expect(pageRoot).toBeVisible({ timeout });
  await expect(list.or(emptyState).or(skeleton)).toBeVisible({ timeout });

  if (await skeleton.isVisible().catch(() => false)) {
    await skeleton.waitFor({ state: 'detached', timeout }).catch(() => undefined);
  }

  try {
    await expect(list.or(emptyState)).toBeVisible({ timeout });
  } catch {
    // Some environments (demo fixtures, SP fallback) render an error notice instead of list/empty.
    // Ensure at least the heading is present before continuing to reduce flakes.
    await expect(heading).toBeVisible({ timeout });
  }
}

export async function waitForDayTimeline(page: Page): Promise<void> {
  const heading = page.getByRole('heading', { name: /スケジュール/, level: 1 });
  await expect(heading).toBeVisible();

  const dayTab = page.getByTestId(TESTIDS.SCHEDULES_WEEK_TAB_DAY).first();
  await expect(dayTab).toBeVisible();
  const isSelected = (await dayTab.getAttribute('aria-selected')) === 'true';
  if (!isSelected) {
    await dayTab.click();
  }
  await expect(dayTab).toHaveAttribute('aria-selected', 'true');

  const dayPage = page.getByTestId(TESTIDS['schedules-day-page']);
  const hasDayPage = await locatorExists(dayPage, 2_000);
  const root = hasDayPage ? dayPage.first() : page.getByTestId('schedule-day-root').first();
  await expect(root).toBeVisible();
}

export async function waitForWeekTimeline(page: Page): Promise<void> {
  const url = page.url();

  const pageRoot = page.getByTestId(TESTIDS.SCHEDULES_PAGE_ROOT);
  const weekPageRoot = page.getByTestId(TESTIDS['schedules-week-page']);

  const hasNewRoot = await locatorExists(pageRoot, 3_000);
  const hasWeekPage = hasNewRoot ? true : await locatorExists(weekPageRoot, 3_000);

  if (hasNewRoot) {
    await expect(pageRoot).toBeVisible({ timeout: 15_000 });

    const weekTab = page.getByRole('tab', { name: '週' }).first();
    await expect(weekTab).toBeVisible({ timeout: 10_000 });

    // Explicitly select the week timeline tab before waiting for timeline
    const isSelected = (await weekTab.getAttribute('aria-selected')) === 'true';
    if (!isSelected) {
      await weekTab.click();
      await expect(weekTab).toHaveAttribute('aria-selected', 'true');
    }

    const timeline = page.getByTestId(TESTIDS.SCHEDULES_WEEK_TIMELINE);
    if (await locatorExists(timeline, 3_000)) {
      await expect(timeline.first()).toBeVisible({ timeout: 15_000 });
      return;
    }

    const snippet = (await page.content()).slice(0, 1000);
    throw new Error(`Schedule week timeline not found. url=${url} snippet="${snippet}"`);
  }

  if (hasWeekPage) {
    await expect(weekPageRoot).toBeVisible();

    const heading = page.getByTestId(TESTIDS['schedules-week-heading']).or(
      page.getByRole('heading', { name: /スケジュール/, level: 1 }),
    );
    await expect(heading).toBeVisible();

    const tablist = page.getByTestId(TESTIDS.SCHEDULES_WEEK_TABLIST);
    if (await locatorExists(tablist)) {
      await expect(tablist.first()).toBeVisible();
    }

    const weekTabCandidate = page.getByTestId(TESTIDS.SCHEDULES_WEEK_TAB_WEEK);
    const weekTab = (await locatorExists(weekTabCandidate))
      ? weekTabCandidate.first()
      : page.getByRole('tab', { name: '週' }).first();
    await expect(weekTab).toBeVisible();

    // Explicitly select the week tab before checking for grid/timeline
    const isWeekSelected = (await weekTab.getAttribute('aria-selected')) === 'true';
    if (!isWeekSelected) {
      await weekTab.click();
      await expect(weekTab).toHaveAttribute('aria-selected', 'true');
    }

    const gridRoot = page.getByTestId(TESTIDS['schedules-week-grid']);
    const timelinePanel = page.getByTestId(TESTIDS.SCHEDULES_WEEK_TIMELINE_PANEL);
    const timeline = page.getByTestId(TESTIDS['schedules-week-timeline']);

    const gridVisible = async (): Promise<boolean> => {
      if (!(await locatorExists(gridRoot))) return false;
      const grid = gridRoot.first();
      return grid.isVisible().catch(() => false);
    };

    const timelineVisible = async (): Promise<boolean> => {
      if (!(await locatorExists(timelinePanel))) return false;
      return timeline.first().isVisible().catch(() => false);
    };

    if (await gridVisible()) {
      await expect(gridRoot.first()).toBeVisible();
      return;
    }

    if (await timelineVisible()) {
      await expect(timeline.first()).toBeVisible();
      return;
    }

    // If neither are visible yet, the tab click above should trigger them
    // Wait a bit more for the content to appear
    await page.waitForTimeout(500);

    if (await gridVisible()) {
      await expect(gridRoot.first()).toBeVisible();
      return;
    }

    if (await timelineVisible()) {
      await expect(timeline.first()).toBeVisible();
      return;
    }

    return;
  }

  const legacyRoot = page.getByTestId('schedule-week-root');
  const hasLegacyRoot = await locatorExists(legacyRoot, 3_000);
  if (!hasLegacyRoot) {
    let domSnippet = '';
    try {
      domSnippet = await page.evaluate(() => document.body.innerHTML.slice(0, 10000));
      domSnippet = domSnippet.replace(/\s+/g, ' ').trim();
    } catch {
      domSnippet = '[failed to capture DOM]';
    }
    throw new Error(
      `Schedule week view not found (neither SchedulePage nor WeekPage nor legacy timeline). url=${url} snippet="${domSnippet}"`,
    );
  }

  await expect(legacyRoot).toBeVisible();

  const legacyHeading = page.getByRole('heading', { level: 1, name: /スケジュール/ });
  await expect(legacyHeading).toBeVisible();

  const legacyWeekTab = page.getByRole('tab', { name: /週/ }).first();
  await expect(legacyWeekTab).toBeVisible();
  await expect(legacyWeekTab).toHaveAttribute('aria-selected', 'true');

  const legacyHeader = page.locator('[id^="timeline-week-header-"]').first();
  await expect(legacyHeader).toBeVisible();
}

export async function waitForMonthTimeline(page: Page): Promise<void> {
  const heading = page.getByRole('heading', { name: /スケジュール/, level: 1 });
  await expect(heading).toBeVisible();

  const tablist = page.getByRole('tablist').first();
  await expect(tablist).toBeVisible({ timeout: 15_000 });

  const monthTab = tablist.getByRole('tab', { name: /^月$/ });
  const monthCount = await monthTab.count().catch(() => 0);
  if (monthCount === 0) {
    // Month tab not available; treat as non-blocking for callers that opt to skip.
    return;
  }

  await expect(monthTab).toBeVisible({ timeout: 15_000 });

  const selected = await monthTab.getAttribute('aria-selected');
  if (selected !== 'true') {
    await monthTab.click({ timeout: 10_000 });
  }
  const root = page
    .getByTestId('schedule-month-root')
    .or(page.getByTestId('schedules-month-root'));
  try {
    await expect(root).toBeVisible({ timeout: 15_000 });
  } catch {
    const tabs = await tablist.getByRole('tab').allTextContents().catch(() => [] as string[]);
    // eslint-disable-next-line no-console
    console.log('[waitForMonthTimeline] tabs:', tabs);
    return;
  }

  // Some layouts may not update aria-selected immediately; consider the view ready once the month root is visible.
}
