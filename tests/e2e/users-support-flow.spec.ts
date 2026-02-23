import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { TESTIDS } from '../../src/testids';
import { bootUsersPage } from './_helpers/bootUsersPage.mts';

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
			route: '/users?tab=list',
		}, testInfo);
	});

	test('navigates from detail quick access to support procedure guidance', async ({ page }) => {
		// Already navigated to /users by bootUsersPage
		const table = page.getByTestId('users-list-table');
		await expect(table).toBeVisible({ timeout: 30_000 });
		
		// Click detail access button for first user (UX-001)
		await table.locator('[aria-label="詳細"]').first().click();
		
		// Wait for detail sections to appear
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

		// Select second user (UX-014) from table by clicking its detail button
		const userRow = page.locator('tr', { has: page.getByText('UX-014') });
		await userRow.locator('[aria-label="詳細"]').click();
		
		// Wait for detail sections instead of URL pattern
		await waitForDetailSections(page);

		const supportQuickButton2 = page.getByTestId(`${TESTIDS['users-quick-prefix']}support-procedure`);
		await expect(supportQuickButton2).toBeVisible();
	});
});
