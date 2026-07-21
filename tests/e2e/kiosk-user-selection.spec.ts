import { test, expect } from '@playwright/test';
import { bootKiosk } from './_helpers/bootKiosk';
import { setupKioskReleaseContracts } from './_helpers/kioskReleaseContracts';

type KioskReleaseContracts = Awaited<ReturnType<typeof setupKioskReleaseContracts>>;

let contract: KioskReleaseContracts | undefined;

test.describe('Kiosk User Selection', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    contract = await setupKioskReleaseContracts(page, testInfo, {
      allowedRequestFailures: [/__vite_ping/i],
    });

    await bootKiosk(page, { route: '/kiosk' });
    await expect(page.getByTestId('kiosk-action-execute-steps')).toBeVisible({ timeout: 15000 });
  });

  test.afterEach(async ({ page }) => {
    if (!contract) {
      return;
    }

    await contract.assertNoFailures();
    await page.waitForLoadState('load');
    contract = undefined;
  });

  test('should navigate to user selection and show user cards', async ({ page }) => {
    // 「支援手順を実施する」をクリック
    await page.getByTestId('kiosk-action-execute-steps').click();

    // 利用者選択画面が表示されることを確認
    await expect(page).toHaveURL(/\/kiosk\/users/);
    await expect(page.getByText('利用者を選択してください')).toBeVisible();

    // 利用者カードが表示されていることを確認（モックデータがある前提）
    // もしデータがない場合は「対象の利用者がいません」が出るはず
    const noUsers = await page.getByText('対象の利用者がいません').isVisible();
    if (!noUsers) {
      const cards = page.locator('[data-testid^="kiosk-user-card-"]');
      const count = await cards.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test('should not automatically jump when wizard search params are appended', async ({ page }) => {
    await bootKiosk(page, { route: '/kiosk/users?wizard=plan&user=I005&userId=I005' });

    await expect(page).toHaveURL(/\/kiosk\/users\?wizard=plan&user=I005&userId=I005/);
    await expect(page.getByText('利用者を選択してください')).toBeVisible({ timeout: 15000 });
    await expect(page).not.toHaveURL(/\/kiosk\/users\/I005\/procedures/);
  });

  test('should navigate back to kiosk home from user selection', async ({ page }) => {
    test.setTimeout(120000);
    // 利用者選択画面が表示されるのを待つ
    await page.getByTestId('kiosk-action-execute-steps').click();
    await expect(page).toHaveURL(/\/kiosk\/users/);

    // 戻るボタンをクリック
    const backButton = page.getByTestId('kiosk-user-select-back');
    await expect(backButton).toBeVisible({ timeout: 15000 });
    await backButton.scrollIntoViewIfNeeded();

    await page.evaluate((sel) => {
      const el = document.querySelector(sel) as HTMLElement;
      if (el) el.click();
    }, '[data-testid="kiosk-user-select-back"]');
    
    await page.waitForURL(/\/kiosk(\?.*)?$/, { timeout: 15000 });

    // キオスクホームに戻ることを確認
    await expect(page.getByTestId('kiosk-action-execute-steps')).toBeVisible();
  });
});
