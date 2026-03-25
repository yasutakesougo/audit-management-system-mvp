import { expect, test } from '@playwright/test';
import { bootstrapDashboard } from './utils/bootstrapApp';

const COLLAPSED_PARENTS_STORAGE_KEY = 'exception-collapsed-parents';
const SCHEDULES_STORAGE_KEY = 'e2e:schedules.v1';

test.describe('ExceptionCenter transport missing-driver child flow', () => {
  test('flat/grouped rendering and child deep-link landing remain consistent', async ({ page }) => {
    await page.addInitScript(({ collapsedParentsKey, schedulesKey }) => {
      const w = window as typeof window & { __ENV__?: Record<string, string> };
      w.__ENV__ = {
        ...(w.__ENV__ ?? {}),
        // ユーザー名マッピングを安定化（demo users を利用）
        VITE_FEATURE_USERS_SP: '0',
      };

      const today = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());

      const seeded = [
        {
          id: 'e2e-transport-missing-driver-1',
          title: '迎え送迎（E2E）',
          category: 'User',
          userId: 'U-002',
          userName: '鈴木 美子',
          start: `${today}T08:30:00+09:00`,
          end: `${today}T09:00:00+09:00`,
          serviceType: 'transport',
          vehicleId: '車両2',
          status: 'Planned',
          statusReason: null,
          etag: '"e2e-transport-missing-driver-1"',
        },
      ];

      window.localStorage.setItem('skipLogin', '1');
      window.localStorage.removeItem(collapsedParentsKey);
      window.localStorage.setItem(schedulesKey, JSON.stringify(seeded));
    }, {
      collapsedParentsKey: COLLAPSED_PARENTS_STORAGE_KEY,
      schedulesKey: SCHEDULES_STORAGE_KEY,
    });

    await bootstrapDashboard(page, {
      skipLogin: true,
      initialPath: '/admin/exception-center',
    });

    await expect(page.getByTestId('exception-table')).toBeVisible();

    await page.getByTestId('exception-filter-category').click();
    await page.getByRole('option', { name: /送迎異常/ }).click();

    // 1) flat: parent 配下に child が表示される
    const parentRow = page
      .locator('[data-testid^="exception-row-transport-transport-missing-driver-assignment-"]')
      .first();
    await expect(parentRow).toBeVisible();

    const childRow = page
      .locator('[data-testid^="exception-row-transport-missing-driver-"]')
      .first();
    await expect(childRow).toBeVisible();

    const parentTestId = await parentRow.getAttribute('data-testid');
    const childTestId = await childRow.getAttribute('data-testid');
    expect(parentTestId).toBeTruthy();
    expect(childTestId).toBeTruthy();

    const childItemId = (childTestId as string).replace('exception-row-', '');
    const childIdMatch = /^transport-missing-driver-(.+)-(to|from)-\d{4}-\d{2}-\d{2}$/.exec(childItemId);
    expect(childIdMatch).toBeTruthy();

    const targetUserId = childIdMatch?.[1] ?? '';
    const targetDirection = childIdMatch?.[2] as 'to' | 'from';
    const targetTab = targetDirection === 'to' ? 'transport-tab-to' : 'transport-tab-from';

    const childText = await childRow.innerText();
    const vehicleMatch = /(車両\d+|未割当)/.exec(childText);
    const vehicleLabel = vehicleMatch?.[1] ?? '未割当';

    // 2) grouped: parent 行が二重集約されない
    await page.getByTestId('exception-mode-grouped').click();
    await expect(page.getByTestId(parentTestId as string)).toHaveCount(0);
    await expect(page.locator('[data-testid^="exception-row-transport-missing-driver-"]').first()).toBeVisible();

    await page.getByTestId('exception-mode-flat').click();

    // 3) child CTA で /today deep link に遷移し、車両警告まで確認する
    await page.getByTestId(`corrective-primary-${childItemId}`).click();
    await expect(page).toHaveURL(/\/today(?:\?|$)/);
    await expect(page.getByTestId('transport-status-card')).toBeVisible();
    await expect(page.getByTestId(targetTab)).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId(`transport-leg-${targetUserId}-${targetDirection}`)).toBeVisible();

    const vehicleRow = page
      .locator('[data-testid^="transport-vehicle-row-"]')
      .filter({ hasText: vehicleLabel })
      .first();
    await expect(vehicleRow).toContainText('運転: 未設定');
    await expect(vehicleRow).toContainText('1名体制');
    await expect(vehicleRow).toContainText('要確認');
  });
});
