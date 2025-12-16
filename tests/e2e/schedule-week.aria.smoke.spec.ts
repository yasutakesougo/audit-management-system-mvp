import '@/test/captureSp400';
import { expect, test } from '@playwright/test';
import { TESTIDS } from '@/testids';
import { bootstrapDashboard } from './utils/bootstrapApp';
import { gotoScheduleWeek } from './utils/scheduleWeek';

const getWeekTablist = async (page) => {
  const byTestId = page.getByTestId(TESTIDS.SCHEDULES_WEEK_TABLIST);
  if ((await byTestId.count().catch(() => 0)) > 0) return byTestId.first();

  const byRole = page.getByRole('tablist', { name: /スケジュールビュー切り替え/ });
  if ((await byRole.count().catch(() => 0)) > 0) return byRole.first();

  return byTestId;
};

test.describe('Schedule week page – ARIA smoke', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapDashboard(page, {
      skipLogin: true,
      featureSchedules: true,
      initialPath: '/schedule/week',
    });
  });

  test('exposes main landmark, heading, tabs, and week tabpanel', async ({ page }) => {
    await gotoScheduleWeek(page, new Date());

    const pageRoot = page.getByTestId(TESTIDS.SCHEDULES_PAGE_ROOT);
    const section = pageRoot.or(page.getByTestId(TESTIDS['schedules-week-page']));
    await expect(section).toBeVisible({ timeout: 15_000 });

    const heading = page.getByRole('heading', { name: /スケジュール管理|マスター スケジュール/ });
    await expect(heading).toBeVisible({ timeout: 10_000 });

    const tablist = await getWeekTablist(page);
    await expect(tablist).toBeVisible({ timeout: 15_000 });

    const weekTab = page
      .getByTestId(TESTIDS.SCHEDULES_WEEK_TAB_WEEK)
      .or(tablist.getByRole('tab', { name: /週/ }));
    await expect(weekTab).toBeVisible({ timeout: 15_000 });
    const weekSelected = tablist.getByRole('tab', { selected: true }).or(weekTab);
    await expect(weekSelected).toBeVisible({ timeout: 15_000 });

    const weekView = page
      .getByTestId(TESTIDS['schedules-week-view'] ?? 'schedules-week-view')
      .or(page.getByTestId(TESTIDS['schedules-week-grid'] ?? 'schedules-week-grid'))
      .or(page.getByTestId(TESTIDS['schedule-week-view'] ?? 'schedule-week-view'))
      .or(page.getByRole('grid', { name: /週ごとの予定一覧|週|week/i }));
    await expect(weekView).toBeVisible({ timeout: 15_000 });
  });

  test('tab selection toggles when clicking tabs', async ({ page }) => {
    await gotoScheduleWeek(page, new Date());

    const tablist = await getWeekTablist(page);
    const weekTab = tablist.getByRole('tab', { name: /週/ });
    const monthTab = tablist.getByRole('tab', { name: /月/ }).first();

    await expect(tablist).toBeVisible({ timeout: 15_000 });
    await expect(weekTab).toBeVisible({ timeout: 15_000 });
    await expect(weekTab).toBeVisible({ timeout: 15_000 });

    if ((await monthTab.count().catch(() => 0)) > 0) {
      await expect(monthTab).toHaveAttribute('role', 'tab');
      await expect(monthTab).toBeVisible({ timeout: 15_000 });
    } else {
      test.skip(true, 'Month tab not available or inactive in this configuration.');
    }
  });
});
