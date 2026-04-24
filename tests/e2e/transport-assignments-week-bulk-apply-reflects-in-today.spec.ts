import { expect, test } from '@playwright/test';
import { setupSharePointStubs } from './_helpers/setupSharePointStubs';
import { bootstrapDashboard } from './utils/bootstrapApp';

const FIXED_NOW = '2026-03-25T08:00:00+09:00'; // Wednesday (JST)
const TARGET_DATE = '2026-03-25';
const PREV_SAME_WEEKDAY = '2026-03-18';

const USER_APPLY_ID = 'U002';
const USER_APPLY_NAME = '鈴木 美子';
const USER_KEEP_ID = 'U001';
const USER_KEEP_NAME = '田中 太郎';

test.describe('Transport assignments week bulk apply reflects in today', () => {
  test('bulk apply + save reflects in today board and does not overwrite existing assignment', async ({ page }) => {
    await setupSharePointStubs(page, {
      currentUser: { status: 200, body: { Id: 401, Title: 'Transport Operator' } },
      lists: [
        {
          name: 'Users_Master',
          items: [
            {
              Id: 2_001,
              UserID: USER_KEEP_ID,
              FullName: USER_KEEP_NAME,
            },
            {
              Id: 2_000,
              UserID: USER_APPLY_ID,
              FullName: USER_APPLY_NAME,
            },
          ],
        },
        {
          name: 'Schedules',
          aliases: ['ScheduleEvents', 'Schedules_Master', 'SupportSchedule'],
          items: [
            {
              Id: 93_001,
              Title: '送迎（往路）',
              EventDate: `${TARGET_DATE}T08:30:00+09:00`,
              EndDate: `${TARGET_DATE}T09:00:00+09:00`,
              Start: `${TARGET_DATE}T08:30:00+09:00`,
              End: `${TARGET_DATE}T09:00:00+09:00`,
              Status: 'Planned',
              ServiceType: 'transport',
              Category: 'User',
              cr014_category: 'User',
              UserCode: USER_APPLY_ID,
              cr014_personType: 'User',
              cr014_personId: USER_APPLY_ID,
              cr014_personName: USER_APPLY_NAME,
              AssignedStaff: null,
              AssignedStaffId: null,
              Vehicle: null,
              VehicleId: null,
              Note: null,
              '@odata.etag': '"e2e-transport-week-bulk-apply-1"',
            },
            {
              Id: 93_002,
              Title: '送迎（往路）',
              EventDate: `${TARGET_DATE}T08:40:00+09:00`,
              EndDate: `${TARGET_DATE}T09:10:00+09:00`,
              Start: `${TARGET_DATE}T08:40:00+09:00`,
              End: `${TARGET_DATE}T09:10:00+09:00`,
              Status: 'Planned',
              ServiceType: 'transport',
              Category: 'User',
              cr014_category: 'User',
              UserCode: USER_KEEP_ID,
              cr014_personType: 'User',
              cr014_personId: USER_KEEP_ID,
              cr014_personName: USER_KEEP_NAME,
              AssignedStaff: 'STF003',
              AssignedStaffId: 'STF003',
              Vehicle: '車両2',
              VehicleId: '車両2',
              Note: null,
              '@odata.etag': '"e2e-transport-week-bulk-apply-2"',
            },
            {
              Id: 93_003,
              Title: '送迎（往路）',
              EventDate: `${PREV_SAME_WEEKDAY}T08:30:00+09:00`,
              EndDate: `${PREV_SAME_WEEKDAY}T09:00:00+09:00`,
              Start: `${PREV_SAME_WEEKDAY}T08:30:00+09:00`,
              End: `${PREV_SAME_WEEKDAY}T09:00:00+09:00`,
              Status: 'Planned',
              ServiceType: 'transport',
              Category: 'User',
              cr014_category: 'User',
              UserCode: USER_APPLY_ID,
              cr014_personType: 'User',
              cr014_personId: USER_APPLY_ID,
              cr014_personName: USER_APPLY_NAME,
              AssignedStaff: 'STF001',
              AssignedStaffId: 'STF001',
              Vehicle: '車両1',
              VehicleId: '車両1',
              Note: '玄関前待機 [transport_attendant:STF002] [transport_course:isogo]',
              '@odata.etag': '"e2e-transport-week-bulk-apply-3"',
            },
            {
              Id: 93_004,
              Title: '送迎（往路）',
              EventDate: `${PREV_SAME_WEEKDAY}T08:40:00+09:00`,
              EndDate: `${PREV_SAME_WEEKDAY}T09:10:00+09:00`,
              Start: `${PREV_SAME_WEEKDAY}T08:40:00+09:00`,
              End: `${PREV_SAME_WEEKDAY}T09:10:00+09:00`,
              Status: 'Planned',
              ServiceType: 'transport',
              Category: 'User',
              cr014_category: 'User',
              UserCode: USER_KEEP_ID,
              cr014_personType: 'User',
              cr014_personId: USER_KEEP_ID,
              cr014_personName: USER_KEEP_NAME,
              AssignedStaff: 'STF001',
              AssignedStaffId: 'STF001',
              Vehicle: '車両4',
              VehicleId: '車両4',
              Note: null,
              '@odata.etag': '"e2e-transport-week-bulk-apply-4"',
            },
          ],
        },
      ],
      fallback: { status: 200, body: { value: [] } },
    });

    await page.addInitScript(({ fixedNow }) => {
      const scope = window as unknown as { Date: DateConstructor; __ENV__?: Record<string, string> };
      const RealDate = Date;
      const fixedTs = new RealDate(fixedNow).getTime();

      class MockDate extends RealDate {
        constructor(...args: ConstructorParameters<typeof RealDate>) {
          if (args.length === 0) {
            super(fixedTs);
          } else {
            super(...args);
          }
        }

        static now(): number {
          return fixedTs;
        }
      }

      scope.Date = MockDate;
      scope.__ENV__ = {
        ...(scope.__ENV__ ?? {}),
        VITE_FORCE_SHAREPOINT: '1',
        VITE_SKIP_SHAREPOINT: '0',
        VITE_DEMO_MODE: '0',
        VITE_FEATURE_USERS_SP: '1',
        VITE_SP_RESOURCE: 'https://contoso.sharepoint.com',
        VITE_SP_SITE_RELATIVE: '/sites/Audit',
        VITE_MSAL_CLIENT_ID: 'dummy-client-id',
        VITE_MSAL_TENANT_ID: 'dummy-tenant-id',
      };
      window.localStorage.setItem('skipLogin', '1');
      window.localStorage.setItem('demo', '0');
    }, { fixedNow: FIXED_NOW });

    await bootstrapDashboard(page, {
      skipLogin: true,
      initialPath: '/transport/assignments',
    });

    await expect(page.getByTestId('transport-assignment-page')).toBeVisible();
    await expect(page.getByTestId('transport-assignment-date')).toHaveValue(TARGET_DATE);
    await expect(page.getByTestId('transport-assignment-save-button')).toBeDisabled();

    await page.getByTestId('transport-assignment-apply-week-bulk-default').click();

    const bulkSummary = page.getByTestId('transport-assignment-week-bulk-summary');
    await expect(bulkSummary).toBeVisible();
    await expect(bulkSummary).toContainText('水 1件');
    await expect(bulkSummary).toContainText('月 変更なし');
    await expect(page.getByTestId('transport-assignment-payload-count')).toContainText('更新予定 1件');
    await expect(page.getByTestId(`transport-assignment-unassign-車両2-${USER_KEEP_ID}`)).toBeVisible();

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
    await expect(vehicle1Row).toContainText(USER_APPLY_NAME);
    await expect(vehicle1Row).toContainText('磯子');
    await expect(vehicle1Row).toContainText(/運転:\s*佐藤/);
    await expect(vehicle1Row).toContainText(/添乗:\s*鈴木/);
    await expect(vehicle1Row).toContainText('2名体制');

    const vehicle4Row = page
      .locator('[data-testid^="transport-vehicle-row-"]')
      .filter({ hasText: '車両4' })
      .first();
    await expect(vehicle4Row).toContainText('空車');
  });
});
