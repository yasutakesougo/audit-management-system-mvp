import { expect, test } from '@playwright/test';
import { TESTIDS } from '@/testids';

const DIALOG_ROUTE = '/dev/schedule-create-dialog';

test.describe('ScheduleCreateDialog dev harness', () => {
  test('exposes dialog semantics, announces open state, and restores focus', async ({ page }) => {
    await page.goto(DIALOG_ROUTE);
    await page.getByTestId(TESTIDS['dev-schedule-dialog-page']).waitFor();

    const trigger = page.getByTestId(TESTIDS['dev-schedule-dialog-open']);
    await trigger.focus();
    await trigger.press('Enter');

    const dialog = page.getByTestId(TESTIDS['schedule-create-dialog']);
    await expect(dialog).toBeVisible();

    const labelledBy = `${TESTIDS['schedule-create-dialog']}-heading`;
    const describedBy = `${TESTIDS['schedule-create-dialog']}-description`;
    await expect(dialog).toHaveAttribute('aria-labelledby', labelledBy);
    await expect(dialog).toHaveAttribute('aria-describedby', describedBy);

    const livePolite = page.getByTestId('live-polite');
    await expect
      .poll(async () => (await livePolite.textContent())?.trim() ?? '')
      .toContain('スケジュール新規作成ダイアログを開きました。');

    await page.getByRole('button', { name: 'キャンセル' }).click();

    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('StatusReason input has stable data-testid for E2E', async ({ page }) => {
    await page.goto(DIALOG_ROUTE);
    await page.getByTestId(TESTIDS['dev-schedule-dialog-page']).waitFor();

    const trigger = page.getByTestId(TESTIDS['dev-schedule-dialog-open']);
    await trigger.click();

    const dialog = page.getByTestId(TESTIDS['schedule-create-dialog']);
    await expect(dialog).toBeVisible();

    // Verify StatusReason input is accessible via testid
    const statusReasonInput = page.getByTestId(TESTIDS['schedule-create-status-reason']);
    await expect(statusReasonInput).toBeAttached();

    // Verify we can interact with the input using the testid
    await statusReasonInput.fill('Test status reason');
    await expect(statusReasonInput).toHaveValue('Test status reason');

    await page.getByRole('button', { name: 'キャンセル' }).click();
  });
});
