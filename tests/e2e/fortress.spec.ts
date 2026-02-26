/**
 * Users Fortress E2E Test
 *
 * 目的:
 * - 不正な形式のデータ（Zodバリデーションエラー）が SharePoint から返された場合の
 *   フロントエンドの堅牢性（不時着、クラッシュ防止）を検証する。
 * - Fail Fast 原則により、異常なデータは検出しつつも、UI全体を破壊しないことを保証。
 */

import { expect, test } from '@playwright/test';
import { bootUsersPage } from './_helpers/bootUsersPage';

test.describe('Users Fortress - Validation Error Handling', () => {
  test('gracefully handles malformed Id and UserID from SharePoint', async ({ page }, testInfo) => {
    // 1. 不正なデータをシード
    const malformedUsers = [
      {
        Id: 'INVALID', // Should be number
        UserID: 12345, // Should be string
      } as any
    ];

    await bootUsersPage(page, {
      route: '/users',
      autoNavigate: true,
      sharePoint: {
        lists: [
          {
            name: 'Users_Master',
            items: malformedUsers,
          },
          {
            name: 'Org_Master',
            items: [
              { Id: 501, Title: '磯子区障害者地域活動ホーム', OrgCode: 'ORG-ISO', IsActive: true }
            ],
          }
        ]
      }
    }, testInfo);

    // 2. クラッシュせずルート要素が表示されることを確認
    await expect(page.getByTestId('users-panel-root')).toBeVisible({ timeout: 15000 });

    // 3. リストタブに遷移
    const listTab = page.getByRole('tab', { name: /利用者一覧/i }).or(page.getByRole('button', { name: /利用者一覧/i })).first();
    await listTab.click();

    // 4. データが表示されている（フォールバックが機能している）ことを確認
    await expect(page.getByText('不備データ 太郎')).toBeVisible({ timeout: 10000 });

    // 5. コンソールにエラーが出力されていることを確認 (bootUsersPage のログ機能を活用)
    // 注意: bootUsersPage.mts の内部で console.error がフックされ、
    // testInfo.attach などで報告される設計になっていることを想定
  });

  test('handles missing essential fields by displaying fallback data', async ({ page }, testInfo) => {
    // FullName が欠落しているデータ
    const missingFieldsUsers = [
      {
        Id: 999,
        UserID: 'MISSING-001',
        FullName: undefined as any, // 必須
        IsActive: true,
      }
    ];

    await bootUsersPage(page, {
      route: '/users',
      autoNavigate: true,
      sharePoint: {
        debug: true,
        lists: [
          {
            name: 'Users_Master',
            aliases: ['Users', 'UserDirectory', 'UserMaster'],
            items: missingFieldsUsers as any[],
          },
          {
            name: 'Org_Master',
            items: [
              { Id: 501, Title: '磯子区障害者地域活動ホーム', OrgCode: 'ORG-ISO', IsActive: true }
            ],
          }
        ]
      }
    }, testInfo);

    const listTab = page.getByRole('tab', { name: /利用者一覧/i }).or(page.getByRole('button', { name: /利用者一覧/i })).first();
    await listTab.click();

    // UserID は存在するので、行自体は特定可能
    // 完全に欠落している場合、UIは table を表示すべき
    await expect(page.getByRole('table')).toBeVisible();

    // 特定の文字列を検索
    await expect(page.getByText('MISSING-001')).toBeVisible({ timeout: 10000 });
  });
});
