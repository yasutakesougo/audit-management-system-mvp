import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { TESTIDS } from '../../src/testids';
import { bootUsersPage } from './_helpers/bootUsersPage';

const waitForDetailSections = async (page: Page) => {
	await page.waitForSelector(`[data-testid="${TESTIDS['user-detail-sections']}"]`, { timeout: 30_000 });
};

test.describe('users support flow', () => {
	test.beforeEach(async ({ page }, testInfo) => {
		await page.route('**/login.microsoftonline.com/**', (route) => route.fulfill({ status: 204, body: '' }));
		await page.route('https://graph.microsoft.com/**', (route) =>
			route.fulfill({
				status: 200,
				body: JSON.stringify({ value: [] }),
				headers: { 'content-type': 'application/json' },
			}),
		);

		await bootUsersPage(page, {
			seed: { usersMaster: true },
		}, testInfo);
	});

	test('navigates from detail quick access to support procedure guidance', async ({ page }) => {
		await page.goto('/users/U-001', { waitUntil: 'load' });
		await page.waitForLoadState('networkidle');
		await page.waitForURL('**/users?*selected=U-001*');
		await waitForDetailSections(page);

		const supportQuickButton = page.getByTestId(`${TESTIDS['users-quick-prefix']}support-procedure`);
		await expect(supportQuickButton).toBeVisible();
		await supportQuickButton.click();

		const supportTab = page.getByRole('tab', { name: '支援手順兼記録' });
		await expect(supportTab).toHaveAttribute('aria-selected', 'true');
		const supportTabPanel = page.getByTestId(`${TESTIDS['user-menu-tabpanel-prefix']}support-procedure`);
		await expect(supportTabPanel).toBeVisible();
		await expect(supportTabPanel).toContainText('支援手順テンプレート');
		await expect(supportTabPanel).not.toContainText('対象に設定されていません');

		await page.goto('/users/U-004', { waitUntil: 'load' });
		await page.waitForLoadState('networkidle');
		await page.waitForURL('**/users?*selected=U-004*');
		await waitForDetailSections(page);

		const nonTargetQuickButton = page.getByTestId(`${TESTIDS['users-quick-prefix']}support-procedure`);
		await nonTargetQuickButton.click();
		const warning = page.getByText('この利用者は支援手順記録の対象に設定されていません。');
		await expect(warning).toBeVisible();
	});
});
