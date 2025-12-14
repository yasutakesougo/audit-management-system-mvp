import { expect, test } from '@playwright/test';

import { TESTIDS } from '../../src/testids';
import { bootstrapDashboard } from './utils/bootstrapApp';

test.describe('Iceberg PDCA nav smoke', () => {
  test('navigates via nav and shows empty state for unmatched user', async ({ page }) => {
    await bootstrapDashboard(page, { skipLogin: true, featureSchedules: true, initialPath: '/dashboard' });

    await page.getByTestId(TESTIDS.nav.icebergPdca).first().click();
    await expect(page).toHaveURL(/\/analysis\/iceberg-pdca/);
    await expect(page.getByTestId(TESTIDS['iceberg-pdca-root'])).toBeVisible();

    await expect(page.getByRole('combobox', { name: '利用者で絞り込み' })).toBeVisible();
    await expect(page.getByText('利用者を選択してください')).toBeVisible();
    await expect(page.getByTestId(TESTIDS['iceberg-pdca-empty'])).toBeVisible();
  });
});
