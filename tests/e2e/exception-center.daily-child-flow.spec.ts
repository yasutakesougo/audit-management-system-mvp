import { expect, test } from '@playwright/test';
import { bootstrapDashboard } from './utils/bootstrapApp';

const COLLAPSED_PARENTS_STORAGE_KEY = 'exception-collapsed-parents';

test.describe('ExceptionCenter daily-record child flow', () => {
  test('missing-record parent/child rendering and deep-link navigation remain consistent', async ({ page }) => {
    await page.addInitScript(({ collapsedParentsKey }) => {
      const w = window as typeof window & { __ENV__?: Record<string, string> };
      w.__ENV__ = {
        ...(w.__ENV__ ?? {}),
        // ExceptionCenter の expectedUsers を安定化するため demo users を使用
        VITE_FEATURE_USERS_SP: '0',
      };
      window.localStorage.setItem('skipLogin', '1');
      window.localStorage.removeItem(collapsedParentsKey);
    }, {
      collapsedParentsKey: COLLAPSED_PARENTS_STORAGE_KEY,
    });

    await bootstrapDashboard(page, {
      skipLogin: true,
      initialPath: '/admin/exception-center',
    });

    await expect(page.getByTestId('exception-table')).toBeVisible();

    await page.getByTestId('exception-filter-category').click();
    await page.getByRole('option', { name: /未入力記録/ }).click();

    const targetDate = await page.evaluate(() => new Date().toISOString().split('T')[0]);
    const parentId = `daily-missing-record-${targetDate}`;

    // 1) flat: parent 下に child が表示される
    await expect(page.getByTestId(`exception-row-${parentId}`)).toBeVisible();
    const childRows = page.locator('[data-testid^="exception-row-missing-"]');
    await expect(childRows.first()).toBeVisible();

    // 2) grouped/flat: 親行が grouped 側で二重集約されない
    await page.getByTestId('exception-mode-grouped').click();
    await expect(page.getByTestId(`exception-row-${parentId}`)).toHaveCount(0);
    await expect(page.locator('[data-testid^="exception-row-missing-"]').first()).toBeVisible();
    await page.getByTestId('exception-mode-flat').click();

    // 3) child CTA で /daily/activity へ deep link 遷移する
    await page.locator('[data-testid^="corrective-primary-missing-"]').first().click();
    await expect(page).toHaveURL(/\/daily\/activity\?/);
    await expect(page.getByTestId('records-daily-root')).toBeVisible();

    const landed = new URL(page.url());
    expect(landed.pathname).toBe('/daily/activity');
    expect(landed.searchParams.get('date')).toBe(targetDate);
    expect(landed.searchParams.get('userId')).toBeTruthy();
  });
});
