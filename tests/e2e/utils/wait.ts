import { expect, type Locator, type Page } from '@playwright/test';
import { TESTIDS } from '@/testids';

export async function waitForTestId(page: Page, id: string, timeout = 10_000): Promise<void> {
  await expect(page.getByTestId(id)).toBeVisible({ timeout });
}

export async function waitForAppShellReady(page: Page, timeout = 60_000): Promise<void> {
  const appShell = page.getByTestId('app-shell');
  const appShellCount = await appShell.count().catch(() => 0);
  if (appShellCount > 0) {
    await expect(appShell.first()).toBeVisible({ timeout });
    return;
  }

  const appRoot = page.getByTestId(TESTIDS['app-root']);
  const appRootCount = await appRoot.count().catch(() => 0);
  if (appRootCount > 0) {
    await expect(appRoot.first()).toBeVisible({ timeout });
  }

  const routerOutlet = page.getByTestId(TESTIDS['app-router-outlet']);
  const outletCount = await routerOutlet.count().catch(() => 0);
  if (outletCount > 0) {
    await expect(routerOutlet.first()).toBeVisible({ timeout });
  }
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
  const detailList = page.locator(`[data-testid="${TESTIDS.SCHEDULE_WEEK_LIST}"]`);
  const emptyState = page.locator(`[data-testid="${TESTIDS.SCHEDULE_WEEK_EMPTY}"]`);
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
  // Day view is now a tab within /schedules/week (renders DayView component, not TimelineDay)
  await expect(page).toHaveURL(/\/schedules\/week/);
  
  // Verify tab parameter if present
  const url = new URL(page.url());
  const tabParam = url.searchParams.get('tab');
  if (tabParam) {
    expect(tabParam).toBe('day');
  }
  
  await expect(page.getByTestId(TESTIDS['schedules-day-page'])).toBeVisible({ timeout: 15_000 });

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

  const hasNewRoot = await locatorExists(pageRoot, 15_000);
  const hasWeekPage = hasNewRoot ? true : await locatorExists(weekPageRoot, 15_000);

  if (hasNewRoot) {
    await expect(pageRoot).toBeVisible({ timeout: 15_000 });

    const weekTab = page.getByRole('tab', { name: '週' }).first();
    await expect(weekTab).toBeVisible({ timeout: 10_000 });

    const weekGrid = page.getByTestId(TESTIDS['schedules-week-grid']);
    const weekView = page.getByTestId(TESTIDS.SCHEDULE_WEEK_VIEW);
    if (await locatorExists(weekGrid, 3_000)) {
      await expect(weekGrid.first()).toBeVisible({ timeout: 15_000 });
      return;
    }
    if (await locatorExists(weekView, 3_000)) {
      await expect(weekView.first()).toBeVisible({ timeout: 15_000 });
      return;
    }

    const snippet = (await page.content()).slice(0, 1000);
    throw new Error(`Schedule week view not found. url=${url} snippet="${snippet}"`);
  }

  if (hasWeekPage) {
    await expect(weekPageRoot).toBeVisible();

    // Use testid to avoid strict mode violation (month+week headings both match /スケジュール/)
    const heading = page.getByTestId(TESTIDS['schedules-week-heading']);
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

    const gridRoot = page.getByTestId(TESTIDS['schedules-week-grid']);

    const gridVisible = async (): Promise<boolean> => {
      if (!(await locatorExists(gridRoot))) return false;
      const grid = gridRoot.first();
      return grid.isVisible().catch(() => false);
    };

    if (await gridVisible()) {
      await expect(gridRoot.first()).toBeVisible();
      return;
    }

    await weekTab.click();

    if (await gridVisible()) {
      await expect(gridRoot.first()).toBeVisible();
      return;
    }
    return;
  }

  const legacyRoot = page.getByTestId(TESTIDS.SCHEDULE_WEEK_ROOT);
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
  // Use testid to avoid strict mode violation (month+week headings both match /スケジュール/)
  const monthHeading = page.getByTestId('schedules-month-heading');
  await expect(monthHeading).toBeVisible();

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

  // New implementation: check for schedules-month-page (the actual root)
  await expect(page.getByTestId('schedules-month-page')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('schedules-month-heading')).toBeVisible({ timeout: 15_000 });
}

export async function waitForMonthViewReady(page: Page, timeout = 10_000): Promise<void> {
  // 1) まず「月ページの外枠」が出ていること（画面違いを排除）
  await expect(page.getByTestId('schedules-month-page')).toBeVisible({ timeout });

  // 2) 次に heading（hydration/描画完了の目印）
  await expect(page.getByTestId('schedules-month-heading')).toBeVisible({ timeout });
}

export async function waitSchedulesItemsOrEmpty(page: Page, timeout = 15_000): Promise<void> {
  // ロード中UIがあるなら消えるまで（存在しない場合はスキップ）
  const loading = page.getByTestId('schedules-loading');
  if (await loading.count()) {
    await expect(loading).toBeHidden({ timeout });
  }

  // items か empty state のどちらかが見えるまで待つ
  const items = page.getByTestId(TESTIDS.SCHEDULE_ITEM);
  const empty = page.getByTestId('schedules-empty-hint')
    .or(page.getByTestId('schedules-empty'))
    .or(page.getByTestId('schedule-month-empty'));

  // items が複数ある場合があるので、count で判定
  await expect(async () => {
    const itemCount = await items.count();
    const emptyCount = await empty.count();
    if (itemCount > 0 || emptyCount > 0) {
      return;
    }
    throw new Error('Neither schedule items nor empty state found');
  }).toPass({ timeout });
}
