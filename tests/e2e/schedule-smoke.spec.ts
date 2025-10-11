import { expect, test } from '@playwright/test';
import { enableSchedulesFeature } from './_helpers/featureFlags';
import { openSchedules } from './_helpers/nav.schedule';
import { seedSchedules } from './_helpers/schedulesSeed';
import { fixtures } from './_helpers/schedulesSeed.fixtures';

test.describe('Schedule smoke', () => {
  test('shows demo appointments on month view', async ({ page }) => {
    await enableSchedulesFeature(page, { create: true, msalMock: true });
    await seedSchedules(page, fixtures.forDate('2025-10-08', 'Asia/Tokyo'));
    await openSchedules(page, {
      view: 'month',
      at: '2025-10-08',
      env: { VITE_E2E_MSAL_MOCK: '1', VITE_SKIP_LOGIN: '1' },
      feature: { create: true, msalMock: true },
    });

    await expect(page.getByRole('heading', { name: 'スケジュール（月表示）' })).toBeVisible();
    await expect(page.getByTestId('schedule-month-grid')).toBeVisible();

    const items = page.getByTestId('schedule-item');
    await expect
      .poll(async () => items.count(), { timeout: 20_000 })
      .toBeGreaterThan(0);
    await expect(items.first()).toBeVisible();
  });
});

