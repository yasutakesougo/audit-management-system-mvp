import { expect, test } from '@playwright/test';
import { setupSharePointStubs } from './_helpers/setupSharePointStubs';
import { bootstrapDashboard } from './utils/bootstrapApp';

const FIXED_NOW = '2026-03-25T08:00:00+09:00'; // Wednesday (JST)
const TARGET_DATE = '2026-03-25';

const TARGET_USER_ID = 'U002';
const TARGET_USER_NAME = '鈴木 美子';

test.describe('Users TransportCourse update reflects in transport assignments', () => {
  test('updating TransportCourse on /users is reflected as fixed-course default on /transport/assignments', async ({ page }) => {
    await setupSharePointStubs(page, {
      currentUser: { status: 200, body: { Id: 501, Title: 'Users Admin' } },
      lists: [
        {
          name: 'Users_Master',
          items: [
            {
              Id: 2_000,
              UserID: 'U001',
              FullName: '田中 太郎',
              Furigana: 'たなか たろう',
              IsActive: true,
              TransportCourse: 'isogo',
            },
            {
              Id: 2_001,
              UserID: TARGET_USER_ID,
              FullName: TARGET_USER_NAME,
              Furigana: 'すずき みこ',
              IsActive: true,
              TransportCourse: null,
            },
          ],
        },
        {
          name: 'Schedules',
          aliases: ['ScheduleEvents', 'Schedules_Master', 'SupportSchedule'],
          items: [
            {
              Id: 95_001,
              Title: '迎え送迎（固定コース反映）',
              EventDate: `${TARGET_DATE}T08:30:00+09:00`,
              EndDate: `${TARGET_DATE}T09:00:00+09:00`,
              Start: `${TARGET_DATE}T08:30:00+09:00`,
              End: `${TARGET_DATE}T09:00:00+09:00`,
              Status: 'Planned',
              ServiceType: 'transport',
              Category: 'User',
              cr014_category: 'User',
              UserCode: TARGET_USER_ID,
              cr014_personType: 'User',
              cr014_personId: TARGET_USER_ID,
              cr014_personName: TARGET_USER_NAME,
              AssignedStaff: 'STF001',
              AssignedStaffId: 'STF001',
              Vehicle: '車両1',
              VehicleId: '車両1',
              Note: null,
              '@odata.etag': '"e2e-transport-course-users-update-1"',
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

    // Before update: fixed course is unset for target user, so no course chip on vehicle 1.
    await bootstrapDashboard(page, {
      skipLogin: true,
      initialPath: '/transport/assignments',
    });
    await expect(page.getByTestId('transport-assignment-page')).toBeVisible();
    await expect(page.getByTestId('transport-assignment-date')).toHaveValue(TARGET_DATE);
    await expect(page.getByTestId('transport-assignment-vehicle-card-1')).toContainText(TARGET_USER_NAME);
    await expect(page.getByTestId('transport-assignment-vehicle-course-1')).toHaveCount(0);

    // Update TransportCourse on /users edit form.
    await page.goto('/users?tab=list', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('users-list-table')).toBeVisible();

    const targetRow = page
      .getByTestId('users-list-table')
      .locator('tbody tr', { hasText: TARGET_USER_NAME })
      .first();
    await expect(targetRow).toBeVisible();
    await targetRow.locator('[aria-label="編集"]').click();

    const editForm = page.getByRole('form', { name: '利用者情報編集フォーム' });
    await expect(editForm).toBeVisible();
    await editForm.getByRole('combobox', { name: '送迎固定コース' }).click();
    await page.getByRole('option', { name: '金沢' }).click();

    await editForm.getByRole('button', { name: '保存' }).click();
    await editForm.waitFor({ state: 'detached' });

    // After update: fixed-course default should be available via weekday-default apply.
    await page.goto('/transport/assignments', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('transport-assignment-page')).toBeVisible();
    await expect(page.getByTestId('transport-assignment-date')).toHaveValue(TARGET_DATE);
    await expect(page.getByTestId('transport-assignment-apply-weekday-default')).toBeVisible();
    await page.getByTestId('transport-assignment-apply-weekday-default').click();
    await expect(page.getByTestId('transport-assignment-vehicle-card-1')).toContainText(TARGET_USER_NAME);
    await expect(page.getByTestId('transport-assignment-vehicle-course-1')).toContainText('金沢');
  });
});
