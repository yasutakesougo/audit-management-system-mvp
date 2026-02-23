import { expect, test } from '@playwright/test';
import { TESTIDS } from '../../src/testids';
import { bootUsersPage } from './_helpers/bootUsersPage.mts';

test.describe('users detail menu', () => {
  test.beforeEach(async ({ page }) => {
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
    });
  });

  test('opens demo user detail and navigates via quick access controls', async ({ page, baseURL }) => {
    // Ensure app is fully initialized
    const appUrl = baseURL || 'http://localhost:5173';
    await page.goto(appUrl, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');
    
    // Now navigate to users route
    await page.goto(`${appUrl}/users`, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');
    
    // Wait for users panel to be visible
    await expect(page.getByTestId(TESTIDS['users-panel-root'])).toBeVisible({ timeout: 15000 });

    const listTab = page.getByRole('tab', { name: /利用者一覧/ });
    await listTab.click();

    const listTable = page.getByTestId(TESTIDS['users-list-table']);
    await expect(listTable).toBeVisible();
    await expect(listTable).toContainText('南雲 こはる');

    await page.goto('/users/UX-020', { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');
    await page.waitForURL('**/users?tab=list&selected=UX-020');
    await page.waitForSelector(`[data-testid="${TESTIDS['user-detail-sections']}"]`, { timeout: 10000 });

    const detailSections = page.getByTestId(TESTIDS['user-detail-sections']);
    await expect(detailSections).toBeVisible();
    await expect(detailSections).toContainText('南雲 こはる');
    await expect(detailSections).toContainText('利用者コード: UX-020');

    await page.getByTestId(`${TESTIDS['users-quick-prefix']}support-procedure`).click();
    await expect(page.getByRole('tab', { name: '支援手順兼記録' })).toHaveAttribute('aria-selected', 'true');
    const supportProcedurePane = page.getByTestId(`${TESTIDS['user-menu-tabpanel-prefix']}support-procedure`);
    await expect(supportProcedurePane).toBeVisible();
    await expect(supportProcedurePane).toContainText('この利用者は支援手順記録の対象に設定されていません。');

    await page.getByTestId(`${TESTIDS['users-quick-prefix']}create-user`).click();
    await page.waitForURL('**/users');
    await expect(page.getByTestId(TESTIDS['users-panel-root'])).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('tab', { name: '新規利用者登録' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByLabel('ユーザーID')).toBeVisible();

    await listTab.click();

    await expect(listTable).toBeVisible();

    await page.goto('/users/UX-020', { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');
    await page.waitForURL('**/users?tab=list&selected=UX-020');
    await page.waitForSelector(`[data-testid="${TESTIDS['user-detail-sections']}"]`, { timeout: 10000 });
    const detailSectionsAgain = page.getByTestId(TESTIDS['user-detail-sections']);
    await expect(detailSectionsAgain).toBeVisible();
    await expect(detailSectionsAgain).toContainText('南雲 こはる');

    await page.getByTestId(`${TESTIDS['users-quick-prefix']}support-plan`).click();
    await expect(page.getByRole('tab', { name: '個別支援計画書' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId(`${TESTIDS['user-menu-tabpanel-prefix']}support-plan`)).toContainText('想定されるコンテンツ');

    await page.getByTestId(`${TESTIDS['users-quick-prefix']}monitoring`).click();
    const monitoringSection = page.getByTestId(`${TESTIDS['user-menu-section-prefix']}monitoring`);
    await expect(monitoringSection).toBeVisible();
    await expect(monitoringSection).toContainText('個別支援計画のモニタリング記録を時系列で整理します。');
  });
});
