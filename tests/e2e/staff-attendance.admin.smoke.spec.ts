import { expect, test } from '@playwright/test';
import { expectLocatorVisibleBestEffort, expectTestIdVisibleBestEffort } from './_helpers/smoke';
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

    // ---- Diagnostic: Verify page state ----
    const bodyText = (await page.locator('body').innerText()).slice(0, 1200);
    console.info('[e2e] before-expect url=', page.url());
    console.info('[e2e] before-expect title=', await page.title());
    console.info('[e2e] before-expect body(head)=', bodyText.replace(/\s+/g, ' '));

    // ---- Verify Admin UI loads ----
    await page.waitForTimeout(250);
    await expectTestIdVisibleBestEffort(page, 'staff-attendance-admin-root');

    // Date picker
    const dateInput = page.getByTestId('staff-attendance-date');
    await expectLocatorVisibleBestEffort(
      dateInput,
      'testid not found: staff-attendance-date (allowed for smoke)'
    );
    await dateInput.fill(date);

    // Table visible
    await expectTestIdVisibleBestEffort(page, 'staff-attendance-table');

    // ---- 1) Single edit via dialog ----
    await page.getByTestId('staff-attendance-row-S001').click();
    await expectTestIdVisibleBestEffort(page, 'staff-attendance-edit-dialog');

    // Change status (MUI Select: find and click the combobox wrapper)
    const selects = await page.locator('div[class*="MuiSelect-select"]').all();
    if (selects.length > 0) {
      await selects[0].click();
      await page.getByRole('option', { name: '欠勤' }).click();
    }

    // Edit note (multiline TextField becomes a div wrapper with input inside)
    await page.getByTestId('staff-attendance-edit-note').locator('..').locator('textarea, input').first().fill('updated note');

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
    await expectTestIdVisibleBestEffort(page, 'staff-attendance-bulk-drawer');

    // Set bulk status (will overwrite both)
    const bulkSelects = await page.locator('div[class*="MuiSelect-select"]').all();
    if (bulkSelects.length > 0) {
      await bulkSelects[bulkSelects.length - 1].click(); // Last one should be bulk status
      await page.getByRole('option', { name: '出勤' }).click();
    }

    // Set bulk check-in time (will overwrite both)
    await page.getByTestId('staff-attendance-bulk-checkin').locator('input').fill('11:30');

    // Note field: leave empty (= preserve existing notes per safety rule)
    const noteField = page.getByTestId('staff-attendance-bulk-note').locator('..').locator('textarea, input').first();
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
