import { expect, test } from '@playwright/test';

test.describe('日次記録: /daily/table entry points @seed', () => {
  test('direct route loads the table form', async ({ page }) => {
    await page.goto('/daily/table');
    await expect(page.getByTestId('daily-table-record-form')).toBeVisible();
  });

  test('footer quick action navigates to /daily/table', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('daily-footer-activity')).toBeVisible();

    await page.getByTestId('daily-footer-activity').click();

    await expect(page).toHaveURL(/\/daily\/table/);
    await expect(page.getByTestId('daily-table-record-form')).toBeVisible();
  });

  test('header nav "日次記録" navigates to /daily/table', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('nav-daily')).toBeVisible();

    await page.getByTestId('nav-daily').click();

    await expect(page).toHaveURL(/\/daily\/table/);
    await expect(page.getByTestId('daily-table-record-form')).toBeVisible();
  });
});
