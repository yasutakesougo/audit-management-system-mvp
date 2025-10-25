import { test } from '@playwright/test';
import { expectVisible } from '../utils/selectors';

test.describe('Route smoke', () => {
  test('dashboard records tab', async ({ page }) => {
    await page.goto('/dashboard/records');
    await expectVisible(page, 'dashboard-records');
  });

  test('attendance placeholder', async ({ page }) => {
    await page.goto('/attendance');
    await expectVisible(page, 'attendance-page');
  });

  test('meeting guide', async ({ page }) => {
    await page.goto('/dashboard/meeting');
    await expectVisible(page, 'meeting-guide');
  });

  test('catch-all redirect to /plan', async ({ page }) => {
    await page.goto('/unknown/or/wildcard');
    await expectVisible(page, 'plan-create-page'); // or /plan の固定testidに合わせる
  });
});
