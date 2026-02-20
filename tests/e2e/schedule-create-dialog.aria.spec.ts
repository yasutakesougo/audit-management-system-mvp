import { expect, test } from '@playwright/test';
import { TESTIDS } from '@/testids';

const DIALOG_ROUTE = '/dev/schedule-create-dialog';

test.describe('ScheduleCreateDialog dev harness', () => {
  test('exposes dialog semantics, announces open state, and restores focus', async ({ page }) => {
    await page.goto(DIALOG_ROUTE, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/dev\/schedule-create-dialog/);
    const harnessRoot = page.getByTestId(TESTIDS['dev-schedule-dialog-page']);
    if ((await harnessRoot.count().catch(() => 0)) === 0) {
      test.skip(true, 'Dev schedule dialog harness is unavailable in this build.');
    }
    await expect(harnessRoot).toBeVisible({ timeout: 30_000 });

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
});
