import '@/test/captureSp400';
import { expect, test, type Page } from '@playwright/test';
import { bootSchedule } from './_helpers/bootSchedule';
import { gotoOrg } from './utils/scheduleNav';

const waitForOrgTab = async (page: Page): Promise<void> => {
  await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 15_000 });

  const tablist = page.getByRole('tablist').first();
  await expect(tablist).toBeVisible({ timeout: 15_000 });

  const orgTab = page.getByTestId('schedule-tab-org').or(tablist.getByRole('tab', { name: /事業所|Org/ }));
  const exists = (await orgTab.count().catch(() => 0)) > 0;
  test.skip(!exists, 'Org tab is not available in this build/flag set.');

  await expect(orgTab).toBeVisible({ timeout: 15_000 });
  await orgTab.click({ timeout: 10_000 });
  await expect(orgTab).toHaveAttribute('aria-selected', /true/i);

  await expect(page.getByTestId('schedule-org-tab')).toBeVisible({ timeout: 15_000 });
};

const TARGET_DATE = new Date('2025-11-24');

test.describe('Schedules Org Tab (Smoke)', () => {
  test.beforeEach(async ({ page }) => {
    await bootSchedule(page);
  });

  test('shows Org tab selector and summary', async ({ page }) => {
    await gotoOrg(page, { date: TARGET_DATE });
    await waitForOrgTab(page);

    const panel = page.getByTestId('schedule-org-tab');
    const select = page.getByTestId('schedule-org-select');
    const summary = page.getByTestId('schedule-org-summary');

    await expect(panel.getByRole('heading').first()).toBeVisible();
    await expect(select).toHaveValue('all');
    await expect(summary).toContainText('全事業所（統合ビュー）');

    await select.selectOption('main');
    await expect(page).toHaveURL(/org=main/);
    await expect(summary).toContainText('生活介護（本体）');
  });

  test('restores selection from org URL param', async ({ page }) => {
    await gotoOrg(page, { date: TARGET_DATE, org: 'shortstay' });
    await waitForOrgTab(page);

    const select = page.getByTestId('schedule-org-select');
    const summary = page.getByTestId('schedule-org-summary');

    await expect(select).toHaveValue('shortstay');
    await expect(summary).toContainText('短期入所');
  });
});
