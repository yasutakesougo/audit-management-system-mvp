import '@/test/captureSp400';
import { expect, test, type Page } from '@playwright/test';
import { expectTestIdVisibleBestEffort } from './_helpers/smoke';
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

  await expectTestIdVisibleBestEffort(page, 'schedule-org-tabpanel', { timeout: 15_000 });
};

const TARGET_DATE = new Date('2025-11-24');

test.describe('Schedules Org Tab (Smoke)', () => {
  test.beforeEach(async ({ page }) => {
    await bootSchedule(page);
  });

  test('shows Org tab selector and summary', async ({ page }) => {
    await gotoOrg(page, { date: TARGET_DATE });
    await waitForOrgTab(page);

    const panel = page.getByTestId('schedule-org-tabpanel');
    const select = page.getByTestId('schedule-org-select');
    const summary = page.getByTestId('schedule-org-summary');

    // Contract: DEFAULT_ORG_FIXTURES must include 'all', 'main', 'shortstay'
    await expect(select.locator('option[value="all"]')).toBeAttached();
    await expect(select.locator('option[value="main"]')).toBeAttached();
    await expect(select.locator('option[value="shortstay"]')).toBeAttached();

    await expect(panel.getByRole('heading').first()).toBeVisible();
    await expect(select).toHaveValue('all');
    await expect(summary).toContainText('全事業所'); // Partial match for label flexibility

    await select.selectOption('main');
    await expect(page).toHaveURL(/org=main/);
    await expect(summary).toContainText('生活介護'); // Partial match
  });

  test('restores selection from org URL param', async ({ page }) => {
    await gotoOrg(page, { date: TARGET_DATE, org: 'shortstay' });
    await waitForOrgTab(page);

    const select = page.getByTestId('schedule-org-select');
    const summary = page.getByTestId('schedule-org-summary');

    // Contract: Test ID-based selection (primary), label is secondary
    await expect(select).toHaveValue('shortstay');
    await expect(summary).toContainText('短期'); // Partial match for label flexibility
  });
});
