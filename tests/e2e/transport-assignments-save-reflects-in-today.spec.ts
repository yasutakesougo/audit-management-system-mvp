import { expect, test } from '@playwright/test';
import { setupSharePointStubs } from './_helpers/setupSharePointStubs';
import { bootstrapDashboard } from './utils/bootstrapApp';
import { selectMuiOptionByLabel } from './utils/muiSelect';

const TARGET_USER_ID = 'U002';
const TARGET_USER_NAME = '鈴木 美子';

test.describe('Transport assignments save reflects in today', () => {
  test('assign/save and unassign/save are reflected in today transport vehicle board', async ({ page }) => {
    const today = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    await setupSharePointStubs(page, {
      currentUser: { status: 200, body: { Id: 401, Title: 'Transport Operator' } },
      lists: [
        {
          name: 'Users_Master',
          items: [
            {
              Id: 2_000,
              UserID: 'U001',
              FullName: '田中 太郎',
              TransportCourse: 'Course1',
              IsActive: true,
              Modified: today,
            },
            {
              Id: 2_001,
              UserID: TARGET_USER_ID,
              FullName: TARGET_USER_NAME,
              TransportCourse: 'Course1',
              IsActive: true,
              Modified: today,
            },
          ],
        },
        {
          name: 'Staff_Master',
          items: [
            {
              Id: 501,
              StaffId: 'S001',
              FullName: '佐藤 運転',
              IsActive: true,
            },
            {
              Id: 502,
              StaffId: 'S002',
              FullName: '鈴木 添乗',
              IsActive: true,
            },
          ],
        },
        {
          name: 'SupportPlanningSheet_Master',
          aliases: ['PlanningSheet'],
          items: [{ Id: 1, Title: 'Dummy Planning Sheet' }],
        },
        {
          name: 'ISP_Master',
          items: [{ Id: 1, Title: 'Dummy ISP' }],
        },
        {
          name: 'Schedules',
          aliases: ['ScheduleEvents', 'Schedules_Master', 'SupportSchedule'],
          items: [
            {
              Id: 92_001,
              Title: '迎え送迎（E2E）',
              EventDate: `${today}T08:30:00+09:00`,
              EndDate: `${today}T09:00:00+09:00`,
              Start: `${today}T08:30:00+09:00`,
              End: `${today}T09:00:00+09:00`,
              Status: 'Planned',
              ServiceType: 'transport',
              Category: 'User',
              TargetUserId: TARGET_USER_ID,
              cr014_personName: TARGET_USER_NAME,
              AssignedStaffId: null,
              VehicleId: null,
              '@odata.etag': '"e2e-transport-assignments-save-1"',
            },
          ],
        },
      ],
      fallback: { status: 200, body: { value: [] } },
    });

    await page.addInitScript(() => {
      const w = window as typeof window & { __ENV__?: Record<string, string> };
      w.__ENV__ = {
        ...(w.__ENV__ ?? {}),
        VITE_FORCE_SHAREPOINT: '1',
        VITE_SKIP_SHAREPOINT: '0',
        VITE_DEMO_MODE: '0',
        VITE_FEATURE_USERS_SP: '1',
        VITE_SP_RESOURCE: 'https://contoso.sharepoint.com',
        VITE_SP_SITE_RELATIVE: '/sites/Audit',
      };
      window.localStorage.setItem('skipLogin', '1');
      window.localStorage.setItem('demo', '0');
    });

    await bootstrapDashboard(page, {
      skipLogin: true,
      initialPath: '/transport/assignments',
    });

    await expect(page.getByTestId('transport-assignment-page')).toBeVisible();
    await expect(page.getByTestId('transport-assignment-save-button')).toBeDisabled();

    const vehicle1Card = page.getByTestId('transport-assignment-vehicle-card-1');
    const selectedUser = await selectMuiOptionByLabel(
      page,
      page.getByTestId('transport-assignment-add-user-select-1'),
      /鈴木\s*美子/,
    );
    expect(selectedUser).toBe(true);
    await vehicle1Card.getByRole('button', { name: '追加' }).click();

    const selectedDriver = await selectMuiOptionByLabel(
      page,
      page.getByTestId('transport-assignment-driver-select-1'),
      /佐藤/,
    );
    expect(selectedDriver).toBe(true);
    const selectedAttendant = await selectMuiOptionByLabel(
      page,
      page.getByTestId('transport-assignment-attendant-select-1'),
      /鈴木/,
    );
    expect(selectedAttendant).toBe(true);

    const saveButton = page.getByTestId('transport-assignment-save-button');
    await expect(saveButton).toBeEnabled();
    await saveButton.click();
    await expect(page.getByTestId('transport-assignment-save-success')).toBeVisible();

    await page.goto('/today', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('transport-status-card')).toBeVisible();
    await page.getByTestId('transport-tab-to').click();

    const vehicle1Row = page
      .locator('[data-testid^="transport-vehicle-row-"]')
      .filter({ hasText: '車両1' })
      .first();
    await expect(vehicle1Row).toContainText(/運転:\s*佐藤/);
    await expect(vehicle1Row).toContainText(/添乗:\s*鈴木/);
    await expect(vehicle1Row).toContainText('2名体制');
    await expect(vehicle1Row).toContainText('乗車 (1名)');
    await expect(vehicle1Row).toContainText(TARGET_USER_NAME);

    await page.getByTestId('transport-edit-assignments-link').click();
    await expect(page).toHaveURL(/\/transport\/assignments(?:\?|$)/);
    await expect(page.getByTestId(`transport-assignment-unassign-車両1-${TARGET_USER_ID}`)).toBeVisible();
    await page.getByTestId(`transport-assignment-unassign-車両1-${TARGET_USER_ID}`).click();

    await expect(page.getByTestId('transport-assignment-save-button')).toBeEnabled();

    // 通信レベルでの正規化（"" -> null）を検証するためのインターセプター
    const patchRequestPromise = page.waitForRequest(
      (req) => 
        req.url().includes('_api/web/lists/getbytitle') && 
        req.method() === 'POST' && 
        req.headers()['x-http-method'] === 'MERGE',
    );

    await page.getByTestId('transport-assignment-save-button').click();

    const request = await patchRequestPromise;
    const payload = JSON.parse(request.postData() || '{}');

    // リポジトリの正規化ロジックにより、空文字（解除）が null に変換されていることを確認
    expect(payload).toMatchObject({
      VehicleId: null,
      AssignedStaffId: null,
      Note: null,
    });
    expect(request.headers()['x-http-method']).toBe('MERGE');

    await expect(page.getByTestId('transport-assignment-save-success')).toBeVisible();

    await page.goto('/today', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('transport-status-card')).toBeVisible();
    await page.getByTestId('transport-tab-to').click();

    const vehicle1RowAfterUnassign = page
      .locator('[data-testid^="transport-vehicle-row-"]')
      .filter({ hasText: '車両1' })
      .first();
    await expect(vehicle1RowAfterUnassign).toContainText('空車');

    const unassignedRow = page
      .locator('[data-testid^="transport-vehicle-row-"]')
      .filter({ hasText: '未割当' })
      .first();
    await expect(unassignedRow).toContainText(TARGET_USER_NAME);
  });
});
