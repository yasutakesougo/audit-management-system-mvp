import { test, expect } from '@playwright/test';
import { TESTIDS } from '../../src/testids';
import { bootstrapDashboard } from './utils/bootstrapApp';

test('loads audit panel via /audit route and shows heading', async ({ page }) => {
  await bootstrapDashboard(page, { initialPath: '/audit' });
  await expect(page).toHaveURL(/\/audit/);
  await expect(page.getByTestId('audit-root')).toBeVisible();
  await expect(page.getByTestId(TESTIDS['audit-heading'])).toBeVisible();
});
