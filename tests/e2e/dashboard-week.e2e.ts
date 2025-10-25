import { test, expect } from '@playwright/test';
import { TESTIDS } from './utils/selectors';

test('dashboard weekly chart is visible', async ({ page }) => {
  await page.goto('/dashboard/records');
  await expect(page.getByTestId(TESTIDS['dashboard-records'])).toBeVisible();
  // Summary KPI card should also be visible
  await expect(page.getByTestId(TESTIDS.DASHBOARD.SUMMARY_CARD)).toBeVisible();
  await expect(page.getByTestId(TESTIDS.DASHBOARD.WEEKLY_CHART)).toBeVisible();
});
