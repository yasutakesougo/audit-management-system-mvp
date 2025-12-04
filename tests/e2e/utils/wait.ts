import { expect, type Page } from '@playwright/test';
import { TESTIDS } from '@/testids';

export async function waitForTestId(page: Page, id: string, timeout = 10_000): Promise<void> {
  await expect(page.getByTestId(id)).toBeVisible({ timeout });
}

export async function waitForScheduleReady(page: Page, timeout = 15_000): Promise<void> {
  const pageRoot = page.getByTestId('schedules-week-page');
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

  const dayTab = page.getByRole('tab', { name: '日' });
  await expect(dayTab).toBeVisible();
  await expect(dayTab).toHaveAttribute('aria-selected', 'true');

  const root = page.getByTestId('schedule-day-root');
  await expect(root).toBeVisible();

  const firstHeader = page.locator('[id^="timeline-day-header-"]').first();
  await expect(firstHeader).toBeVisible();
}

export async function waitForWeekTimeline(page: Page): Promise<void> {
  const heading = page.getByRole('heading', { name: /スケジュール/, level: 1 });
  await expect(heading).toBeVisible();

  const tabCandidate = page.getByTestId('tab-week');
  const hasNewTab = (await tabCandidate.count().catch(() => 0)) > 0;
  const weekTab = hasNewTab ? tabCandidate.first() : page.getByRole('tab', { name: '週' }).first();
  await expect(weekTab).toBeVisible();
  await expect(weekTab).toHaveAttribute('aria-selected', 'true');

  const newViewRoot = page.getByTestId('schedule-week-view');
  const hasNewView = (await newViewRoot.count().catch(() => 0)) > 0;
  if (hasNewView) {
    await expect(newViewRoot.first()).toBeVisible();
    return;
  }

  const root = page.getByTestId('schedule-week-root');
  await expect(root).toBeVisible();

  const firstHeader = page.locator('[id^="timeline-week-header-"]').first();
  await expect(firstHeader).toBeVisible();
}

export async function waitForMonthTimeline(page: Page): Promise<void> {
  const heading = page.getByRole('heading', { name: /スケジュール/, level: 1 });
  await expect(heading).toBeVisible();

  const monthTab = page.getByRole('tab', { name: '月' });
  await expect(monthTab).toBeVisible();
  await expect(monthTab).toHaveAttribute('aria-selected', 'true');

  const root = page.getByTestId('schedule-month-root');
  await expect(root).toBeVisible();
}
