import { expect, type Page } from '@playwright/test';

export async function waitForTestId(page: Page, id: string, timeout = 10_000): Promise<void> {
  await expect(page.getByTestId(id)).toBeVisible({ timeout });
}

export async function waitForScheduleReady(page: Page, timeout = 15_000): Promise<void> {
  const pageRoot = page.getByTestId('schedules-week-page');
  const skeleton = page.getByTestId('schedules-week-skeleton');
  const grid = page.getByTestId('schedules-week-grid');
  const emptyState = page.getByTestId('schedules-empty');

  await expect(pageRoot).toBeVisible({ timeout });
  await expect(grid.or(emptyState).or(skeleton)).toBeVisible({ timeout });

  if (await skeleton.isVisible()) {
    await skeleton.waitFor({ state: 'detached', timeout }).catch(() => undefined);
  }

  await expect(grid.or(emptyState)).toBeVisible({ timeout });
}

export async function waitForDayScheduleReady(page: Page, timeout = 15_000): Promise<void> {
  const pageRoot = page.getByTestId('schedules-day-page');
  const skeleton = page.getByTestId('schedules-day-skeleton');
  const list = page.getByTestId('schedules-day-list');
  const emptyState = page.getByTestId('schedules-empty');

  await expect(pageRoot).toBeVisible({ timeout });
  await expect(list.or(emptyState).or(skeleton)).toBeVisible({ timeout });

  if (await skeleton.isVisible().catch(() => false)) {
    await skeleton.waitFor({ state: 'detached', timeout }).catch(() => undefined);
  }

  await expect(list.or(emptyState)).toBeVisible({ timeout });
}
