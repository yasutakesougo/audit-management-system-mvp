import { expect, test } from '@playwright/test';
import { installNetworkGuard } from '../helpers/networkGuard';

test.describe('Staff Dev Harness (hermetic)', () => {
  test('renders and allows basic interaction without external calls', async ({ page }) => {
    const guard = installNetworkGuard(page, 'allowlist-localhost');

    await page.goto('/dev/staff');
    await expect(page.getByTestId('staff-dev-harness')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Staff Dev Harness' })).toBeVisible();

    await page.getByRole('button', { name: 'Reload' }).click();
    await expect(page.getByText(/Tick:\s*1/)).toBeVisible();

    guard?.assertNoViolations?.();
  });
});
