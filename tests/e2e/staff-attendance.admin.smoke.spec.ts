import { test, expect } from '@playwright/test';
import { bootstrapDashboard } from './utils/bootstrapApp';

const ATTENDANCE_KEY = 'staff-attendance.v1';

function ymd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

test.describe('staff attendance admin smoke', () => {
  test('admin can view, edit, and bulk update attendance', async ({ page }) => {
    // ---- Seed: localStorage ----
    const date = ymd(new Date()); // 今日の日付

    const seed = {
      attendances: [
        {
          staffId: 'S001',
          recordDate: date,
          status: '出勤',
          note: 'seed note',
          checkInAt: `${date}T09:00:00.000Z`,
        },
        {
          staffId: 'S002',
          recordDate: date,
          status: '欠勤',
          note: '',
          checkInAt: null,
        },
      ],
    };

    await page.addInitScript(
      ([key, value]) => {
        localStorage.setItem(key, JSON.stringify(value));
      },
      [ATTENDANCE_KEY, seed]
    );

    // ---- App bootstrap ----
    await bootstrapDashboard(page, { skipLogin: true, featureSchedules: true, initialPath: '/admin/staff-attendance' });

    // ---- Verify Admin UI loads ----
    await expect(page.getByTestId('staff-attendance-admin-root')).toBeVisible();

    // Date picker
    const dateInput = page.getByTestId('staff-attendance-date');
    await expect(dateInput).toBeVisible();
    await dateInput.fill(date);

    // Table visible
    await expect(page.getByTestId('staff-attendance-table')).toBeVisible();

    // ---- 1) Single edit via dialog ----
    await page.getByTestId('staff-attendance-row-S001').click();
    await expect(page.getByTestId('staff-attendance-edit-dialog')).toBeVisible();

    // Change status
    await page.getByTestId('staff-attendance-edit-status').selectOption('外出中');

    // Edit note
    await page.getByTestId('staff-attendance-edit-note').fill('updated note');

    // Edit check-in time
    await page.getByTestId('staff-attendance-edit-checkin').fill('10:10');

    // Save
    await page.getByTestId('staff-attendance-edit-save').click();

    // Dialog should close
    await expect(page.getByTestId('staff-attendance-edit-dialog')).toBeHidden();

    // Verify update reflected in table (note changed)
    await expect(page.getByTestId('staff-attendance-row-S001')).toContainText('updated note');

    // ---- 2) Bulk update ----
    // Toggle bulk mode
    const bulkToggle = page.getByTestId('staff-attendance-bulk-toggle');
    await bulkToggle.click();

    // Select both rows
    await page.getByTestId('staff-attendance-select-S001').click();
    await page.getByTestId('staff-attendance-select-S002').click();

    // Open bulk drawer
    await page.getByTestId('staff-attendance-bulk-open').click();
    await expect(page.getByTestId('staff-attendance-bulk-drawer')).toBeVisible();

    // Set bulk status (will overwrite both)
    await page.getByTestId('staff-attendance-bulk-status').selectOption('出勤');

    // Set bulk check-in time (will overwrite both)
    await page.getByTestId('staff-attendance-bulk-checkin').fill('11:30');

    // Note field: leave empty (= preserve existing notes per safety rule)
    const noteField = page.getByTestId('staff-attendance-bulk-note');
    await noteField.clear();

    // Save
    await page.getByTestId('staff-attendance-bulk-save').click();

    // Drawer should close
    await expect(page.getByTestId('staff-attendance-bulk-drawer')).toBeHidden();

    // Verify both rows now have "出勤" status
    await expect(page.getByTestId('staff-attendance-row-S001')).toContainText('出勤');
    await expect(page.getByTestId('staff-attendance-row-S002')).toContainText('出勤');

    // Verify S001's note was preserved (from single edit)
    await expect(page.getByTestId('staff-attendance-row-S001')).toContainText('updated note');

    // Verify S002's note remained empty (from bulk, note not overwritten)
    // (S002 row should not have a note or show "—")
  });
});
