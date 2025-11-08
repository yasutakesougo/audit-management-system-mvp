import { expect, test } from '@playwright/test';
import { TESTIDS } from '../../src/testids';

test.describe('users detail menu', () => {
  test('opens demo user detail and navigates via quick access controls', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('skipLogin', '1');
      window.localStorage.setItem('feature:usersCrud', '1');
      window.localStorage.setItem('demo', '1');
    });

    await page.addInitScript(() => {
      const globalWithEnv = window as typeof window & { __ENV__?: Record<string, string> };
      globalWithEnv.__ENV__ = {
        ...(globalWithEnv.__ENV__ ?? {}),
        MODE: 'development',
        DEV: '1',
        VITE_SKIP_LOGIN: '1',
        VITE_DEMO_MODE: '1',
        VITE_FEATURE_USERS_CRUD: '1',
        VITE_E2E_MSAL_MOCK: '1',
        VITE_SP_RESOURCE: 'https://contoso.sharepoint.com',
        VITE_SP_SITE_RELATIVE: '/sites/Audit',
        VITE_SP_SCOPE_DEFAULT: 'https://contoso.sharepoint.com/AllSites.Read',
      };
    });

    await page.route('**/login.microsoftonline.com/**', (route) => route.fulfill({ status: 204, body: '' }));
    await page.route('https://graph.microsoft.com/**', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({ value: [] }),
        headers: { 'content-type': 'application/json' },
      })
    );

    await page.goto('/users', { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId(TESTIDS['users-panel-root'])).toBeVisible();

    const listTab = page.getByRole('tab', { name: /利用者一覧/ });
    await listTab.click();

    const listTable = page.getByTestId(TESTIDS['users-list-table']);
    await expect(listTable).toBeVisible();
    await expect(listTable).toContainText('鈴木 美子');

    await page.goto('/users/U-002', { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');
  await page.waitForSelector(`[data-testid="${TESTIDS['user-detail-sections']}"]`, { timeout: 10000 });

    const detailSections = page.getByTestId(TESTIDS['user-detail-sections']);
    await expect(detailSections).toBeVisible();
    await expect(detailSections).toContainText('鈴木 美子');
    await expect(detailSections).toContainText('利用者ID: U-002');

    await page.getByTestId(`${TESTIDS['users-quick-prefix']}support-procedure`).click();
    await expect(page.getByRole('tab', { name: '支援手順兼記録' })).toHaveAttribute('aria-selected', 'true');
    const supportProcedurePane = page.getByTestId(`${TESTIDS['user-menu-tabpanel-prefix']}support-procedure`);
    await expect(supportProcedurePane).toBeVisible();
    await expect(supportProcedurePane).toContainText('この利用者は支援手順記録の対象に設定されていません。');

    await page.getByTestId(`${TESTIDS['users-quick-prefix']}create-user`).click();
    await page.waitForURL('**/users');
    await expect(page.getByTestId(TESTIDS['users-panel-root'])).toBeVisible();
    await expect(page.getByRole('tab', { name: '新規利用者登録' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByLabel('ユーザーID')).toBeVisible();

    await listTab.click();

    await expect(listTable).toBeVisible();

    await page.goto('/users/U-002', { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');
  await page.waitForSelector(`[data-testid="${TESTIDS['user-detail-sections']}"]`, { timeout: 10000 });
    const detailSectionsAgain = page.getByTestId(TESTIDS['user-detail-sections']);
    await expect(detailSectionsAgain).toBeVisible();
    await expect(detailSectionsAgain).toContainText('鈴木 美子');

    await page.getByTestId(`${TESTIDS['users-quick-prefix']}support-plan`).click();
    await expect(page.getByRole('tab', { name: '個別支援計画書' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId(`${TESTIDS['user-menu-tabpanel-prefix']}support-plan`)).toContainText('想定されるコンテンツ');

    await page.getByTestId(`${TESTIDS['users-quick-prefix']}monitoring`).click();
    const monitoringSection = page.getByTestId(`${TESTIDS['user-menu-section-prefix']}monitoring`);
    await expect(monitoringSection).toBeVisible();
    await expect(monitoringSection).toContainText('個別支援計画のモニタリング記録を時系列で整理します。');
  });
});
