import { expect, test } from '@playwright/test';
import { installNetworkGuard } from '../helpers/networkGuard';
import { bootstrapDashboard } from './utils/bootstrapApp';

test.describe('Staff page smoke (hermetic)', () => {
  test('renders staff page without external calls', async ({ page }) => {
    const guard = installNetworkGuard(page, 'allowlist-localhost');

    await bootstrapDashboard(page, { skipLogin: true, initialPath: '/staff' });
    await expect(page.getByTestId('staff-panel-root')).toBeVisible();

    guard?.assertNoViolations?.();
  });
});
