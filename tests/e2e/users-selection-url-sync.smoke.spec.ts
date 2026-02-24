import { expect, test } from '@playwright/test';
import { bootUsersPage } from './_helpers/bootUsersPage.mts';

// TODO: Re-enable after optimizing smoke test performance (currently timing out at 20 min)
test.describe.skip('Users selection URL sync', () => {
  test('persists selection in URL and restores on reload', async ({ page }) => {
    await bootUsersPage(page, { route: '/users?tab=list' });

    await page.getByRole('tab', { name: /利用者一覧/ }).click();
    const table = page.getByTestId('users-list-table');
    await expect(table).toBeVisible();
    await expect(page.locator('[data-testid^="users-list-table-row-"]').first()).toBeVisible();

    await table.locator('[aria-label="詳細"]').first().click();

    await expect(page).toHaveURL(/selected=/);
    const selectedId = new URL(page.url()).searchParams.get('selected');
    expect(selectedId).not.toBeNull();

    await expect(page.getByRole('button', { name: '詳細表示を閉じる' })).toBeVisible();

    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(new RegExp(`selected=${selectedId}`));
    await expect(page.getByRole('button', { name: '詳細表示を閉じる' })).toBeVisible();
  });

  test('clears invalid selected after load', async ({ page }) => {
    await bootUsersPage(page, { route: '/users?tab=list&selected=U-999' });

    await page.getByRole('tab', { name: /利用者一覧/ }).click();
    const table = page.getByTestId('users-list-table');
    await expect(table).toBeVisible();

    await expect.poll(() => new URL(page.url()).searchParams.get('selected')).toBeNull();
    await expect(page.getByText('利用者が未選択です')).toBeVisible();
    await expect(page.getByRole('button', { name: '詳細表示を閉じる' })).toHaveCount(0);
  });
});
