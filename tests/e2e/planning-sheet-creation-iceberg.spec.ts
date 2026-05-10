import { expect, test } from '@playwright/test';
import { setupSharePointStubs } from './_helpers/setupSharePointStubs';

import usersFixture from './_fixtures/users.master.dev.v1.json';

test.describe('Support Planning Sheet — Iceberg Creation Flow', () => {
  test('auto-selects user, auto-triggers Iceberg preview, imports fields, and saves successfully', async ({ page }) => {
    await page.route('**/env.runtime.json', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          MODE: 'development',
          VITE_MSAL_CLIENT_ID: 'e2e-client-id',
          VITE_MSAL_TENANT_ID: 'e2e-tenant-id',
          VITE_SP_RESOURCE: 'https://isogokatudouhome.sharepoint.com',
          VITE_SP_SITE_RELATIVE: '/sites/welfare',
          VITE_SP_SITE_URL: 'https://isogokatudouhome.sharepoint.com/sites/welfare',
          VITE_SP_BASE_URL: 'https://isogokatudouhome.sharepoint.com/sites/welfare',
          VITE_SCHEDULES_TZ: 'Asia/Tokyo',
          VITE_SKIP_SHAREPOINT: '0',
          VITE_SKIP_LOGIN: '1',
          VITE_DEMO_MODE: '0',
          VITE_DATA_PROVIDER: 'sharepoint',
          VITE_FORCE_SHAREPOINT: '1',
          VITE_SKIP_PROVISIONING: '1',
          VITE_FEATURE_SCHEDULES_SP: '1',
          VITE_FEATURE_SCHEDULES: '1',
          VITE_ALLOW_SHAREPOINT_OUTSIDE_SPFX: '1',
          VITE_SP_LIST_USERS: 'Users_Master',
          VITE_SP_LIST_STAFF: 'Staff_Master',
          VITE_SP_LIST_ORG_MASTER: 'Org_Master',
          VITE_SP_LIST_OFFICES: 'Offices',
          VITE_SP_LIST_DAILY_RECORD: 'SupportRecord_Daily',
          VITE_SP_LIST_ATTENDANCE: 'Daily_Attendance',
          VITE_SP_LIST_SCHEDULES: 'Schedules',
          VITE_SP_ENABLED: 'true',
          VITE_E2E: '1',
          VITE_E2E_MSAL_MOCK: '1',
          VITE_AUDIT_DEBUG: '1',
        }),
      });
    });

    await page.addInitScript(() => {
      (window as any).__MSAL_PUBLIC_CLIENT__ = {
        initialize: async () => {},
        handleRedirectPromise: async () => null,
        getActiveAccount: () => ({ username: 'e2e@example.com', name: 'E2E User' }),
        getAllAccounts: () => [{ username: 'e2e@example.com', name: 'E2E User' }],
        setActiveAccount: () => {},
      };
    });

    const updatedAt = new Date().toISOString();

    await setupSharePointStubs(page, {
      lists: [
        {
          name: 'Users_Master',
          items: usersFixture.users,
        },
        {
          name: 'SupportPlanningSheet_Master',
          items: [],
          onCreate: (payload: any, { takeNextId }) => ({
            Id: takeNextId(),
            ...payload,
            Created: new Date().toISOString(),
          }),
        },
        {
          name: 'ISP_Master',
          items: [
            { Id: 5001, UserCode: 'UX-001', IsCurrent: true, Title: '現行個別支援計画' },
          ],
        },
        {
          name: 'Iceberg_Analysis',
          items: [
            {
              Id: 9001,
              Title: '氷山分析 UX-001',
              UserId: 'UX-001',
              SessionId: 'session-ux-001-e2e',
              SchemaVersion: 1,
              UpdatedAt: updatedAt,
              PayloadJson: JSON.stringify({
                schemaVersion: 1,
                sessionId: 'session-ux-001-e2e',
                userId: 'UX-001',
                title: '氷山分析 UX-001',
                updatedAt,
                status: 'active',
                nodes: [
                  {
                    id: 'n1',
                    type: 'behavior',
                    label: '外出活動前に大声で座り込む',
                    position: { x: 0, y: 0 },
                    status: 'fact',
                  },
                  {
                    id: 'n2',
                    type: 'environment',
                    label: '急なスケジュールの変更',
                    position: { x: 100, y: 100 },
                    status: 'hypothesis',
                  },
                ],
                links: [
                  {
                    id: 'l1',
                    sourceNodeId: 'n2',
                    targetNodeId: 'n1',
                    confidence: 'high',
                    status: 'validated',
                  },
                ],
                logs: [],
              }),
            },
          ],
        },
        { name: 'MonitoringMeetings', items: [] },
        { name: 'SupportRecord_Daily', items: [] },
        { name: 'Schedules', items: [] },
      ],
    });

    await page.goto('/support-planning-sheet/new?userId=UX-001&source=iceberg');

    await expect(page.getByRole('heading', { name: '基本情報' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/現行個別支援計画と紐付けます/)).toBeVisible();

    const previewDialog = page.getByRole('dialog', { name: /取込プレビュー/ });
    await expect(previewDialog).toBeVisible({ timeout: 10000 });
    await previewDialog.getByRole('button', { name: 'この内容で取り込む' }).click();
    await expect(previewDialog).toBeHidden();

    const testTitle = `E2E Iceberg Link Plan ${Date.now()}`;
    await page.getByLabel('計画タイトル').fill(testTitle);

    await page.getByRole('button', { name: '次へ' }).click();
    await expect(page.getByLabel('対象行動')).toHaveValue('外出活動前に大声で座り込む');

    await page.getByRole('button', { name: '次へ' }).click();
    await expect(page.getByPlaceholder('行動を引き起こす直接的なきっかけ')).toHaveValue('急なスケジュールの変更');

    for (let i = 0; i < 7; i++) {
      await page.getByRole('button', { name: '次へ' }).click();
    }

    const submitBtn = page.getByRole('button', { name: '支援計画シートを作成' });
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    await expect(page).toHaveURL(/\/support-planning-sheet\/(sp-)?\d+/);
    await expect(page.getByText(testTitle)).toBeVisible();
  });
});
