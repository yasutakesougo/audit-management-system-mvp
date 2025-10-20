import { test, expect } from '@playwright/test';
// --- toast helper ---
async function expectToast(page: import('@playwright/test').Page, pattern: RegExp = /保存しました|保留しました|失敗しました/) {
  // Only match Snackbar's Alert, not dialog info
  const toast = page.locator('[data-testid="toast"], .MuiSnackbar-root [role="alert"]');
  await expect(toast).toBeVisible();
  await expect(toast).toContainText(pattern);
}
// ---------------------

// Robust gotoAttendance: testid first, fallback to heading
async function gotoAttendance(page: import('@playwright/test').Page, _baseURL?: string) {
  const startPath = process.env.E2E_START_PATH || '/e2e/attendance';
  await page.goto(startPath, { waitUntil: 'domcontentloaded' });
  // Wait for either attendance-page or heading-attendance to be visible
  await page.locator('[data-testid="attendance-page"], [data-testid="heading-attendance"]').first().waitFor({ state: 'visible', timeout: 5000 });
}

test.describe('Service Records - basic flow', () => {
  test('check-in -> check-out -> confirm, and absence disabled after check-in', async ({ page, baseURL }) => {
  await gotoAttendance(page, baseURL);

    const card = page.getByTestId('card-I001');
    await expect(card).toBeVisible();

    const btnCheckIn = card.getByTestId('btn-checkin-I001');
    const btnCheckOut = card.getByTestId('btn-checkout-I001');
    const btnAbsence = card.getByTestId('btn-absence-I001');
    const btnConfirm = card.getByTestId('btn-confirm-I001');

    await expect(btnCheckOut).toBeDisabled();
    await expect(btnConfirm).toBeDisabled();
    await expect(btnAbsence).toBeEnabled();

    await btnCheckIn.click();
    await expect(btnCheckOut).toBeEnabled();
    await expect(btnAbsence).toBeDisabled();

    await btnCheckOut.click();
    await expect(btnConfirm).toBeEnabled();

    await btnConfirm.click();
    await expect(btnConfirm).toBeDisabled();
    await expectToast(page, /保存しました/);
  });

  test('absence flow: open dialog and save (I003)', async ({ page, baseURL }) => {
  await gotoAttendance(page, baseURL);

    const card = page.getByTestId('card-I003');
    await expect(card).toBeVisible();

    const btnAbsence = card.getByTestId('btn-absence-I003');
    await expect(btnAbsence).toBeEnabled();

    await btnAbsence.click();

    await expect(page.getByRole('dialog', { name: '欠席対応記録' })).toBeVisible();

    const morningSwitch = page.getByRole('switch', { name: '朝の受入連絡' });
    await morningSwitch.check();
    await page.getByLabel('連絡方法').click();
    await page.getByRole('option', { name: '電話' }).click();

    const eveningSwitch = page.getByRole('switch', { name: '夕方の様子伺い' });
    await eveningSwitch.check();
    await page.getByLabel('夕方の様子メモ').fill('様子OK');
    await expectToast(page, /保存しました/);

    await page.getByRole('button', { name: '保存' }).click();

    await expect(page.getByRole('dialog', { name: '欠席対応記録' })).toBeHidden();
    await expect(card.getByText('欠席対応:')).toBeVisible();
  });
});
