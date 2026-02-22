import { expect, test } from '@playwright/test';

import { TESTIDS } from '../../src/testids';
import { openMobileNav } from './_helpers/openMobileNav';
import { bootstrapDashboard } from './utils/bootstrapApp';
import { expectTestIdVisibleBestEffort } from './_helpers/smoke';

test.describe('Iceberg PDCA nav smoke', () => {
  test('navigates via nav and shows empty state for unmatched user', async ({ page }) => {
    await bootstrapDashboard(page, { skipLogin: true, featureSchedules: true, initialPath: '/dashboard' });

    await openMobileNav(page); // Ensure nav is visible before clicking
    const navItem = page.getByTestId(TESTIDS.nav.icebergPdca).first();
    const navVisible = await navItem.isVisible().catch(() => false);
    test.skip(!navVisible, 'Iceberg PDCA nav entry is not available in this layout/feature set.');
    await navItem.click();
    await expect(page).toHaveURL(/\/analysis\/iceberg-pdca/);
    await expectTestIdVisibleBestEffort(page, TESTIDS['iceberg-pdca-root']);

    await expect(page.getByRole('combobox', { name: '利用者で絞り込み' })).toBeVisible();
    await expect(page.getByText('利用者を選択してください')).toBeVisible();
    await expectTestIdVisibleBestEffort(page, TESTIDS['iceberg-pdca-empty']);
  });

  test('navigates from PDCA link to /daily/support with date query', async ({ page }) => {
    await bootstrapDashboard(page, { skipLogin: true, featureSchedules: true, initialPath: '/dashboard' });

    await openMobileNav(page);
    const navItem = page.getByTestId(TESTIDS.nav.icebergPdca).first();
    const navVisible = await navItem.isVisible().catch(() => false);
    test.skip(!navVisible, 'Iceberg PDCA nav entry is not available in this layout/feature set.');
    await navItem.click();

    await page.getByRole('link', { name: '対象日の支援記録へ' }).click();
    await expect(page).toHaveURL(/\/daily\/support(?:\?.*)?[?&]date=\d{4}-\d{2}-\d{2}/);
  });
});
