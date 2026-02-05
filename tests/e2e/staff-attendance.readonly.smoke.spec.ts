import { test, expect } from '@playwright/test';
import { bootstrapDashboard } from './utils/bootstrapApp';

const ATTENDANCE_KEY = 'staff-attendance.v1';

function ymd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

test.describe('staff attendance read-only guard', () => {
  test('shows read-only notice and disables saves', async ({ page }) => {
    const date = ymd(new Date());

    const seed = {
      attendances: [
        {
          staffId: 'S001',
          recordDate: date,
          status: '出勤',
          note: 'seed note',
          checkInAt: `${date}T09:00:00.000Z`,
        },
      ],
    };
    const seedJson = JSON.stringify(seed);

    await page.addInitScript(
      ([key, value]) => {
        localStorage.setItem(key, value);
      },
      [ATTENDANCE_KEY, seedJson]
    );

    await page.addInitScript(() => {
      const w = window as typeof window & { __ENV__?: Record<string, string> };
      w.__ENV__ = {
        ...(w.__ENV__ ?? {}),
        VITE_STAFF_ATTENDANCE_STORAGE: 'local',
        VITE_STAFF_ATTENDANCE_WRITE: '0',
      };
    });

    await bootstrapDashboard(page, { skipLogin: true, featureSchedules: true, initialPath: '/admin/staff-attendance' });

    // ---- Diagnostic: Verify page state ----
    const bodyText = (await page.locator('body').innerText()).slice(0, 1200);
    console.info('[e2e] before-expect url=', page.url());
    console.info('[e2e] before-expect title=', await page.title());
    console.info('[e2e] before-expect body(head)=', bodyText.replace(/\s+/g, ' '));

    await page.waitForTimeout(250);
    await expect(page.getByTestId('staff-attendance-admin-root')).toBeVisible();
    await expect(page.getByTestId('staff-attendance-readonly')).toBeVisible();

    await page.getByTestId('staff-attendance-row-S001').click();
    await expect(page.getByTestId('staff-attendance-edit-dialog')).toBeVisible();
    await expect(page.getByTestId('staff-attendance-edit-save')).toBeDisabled();
    await page.getByTestId('staff-attendance-edit-cancel').click();

    await page.getByTestId('staff-attendance-bulk-toggle').click();
    await page.getByTestId('staff-attendance-select-S001').click();
    await page.getByTestId('staff-attendance-bulk-open').click();
    await expect(page.getByTestId('staff-attendance-bulk-drawer')).toBeVisible();
    await expect(page.getByTestId('staff-attendance-bulk-save')).toBeDisabled();
  });
});
