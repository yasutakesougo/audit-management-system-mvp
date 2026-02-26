// tests/e2e/dashboard-happy-path.spec.ts

/**
 * Dashboard happy-path spec
 *
 * 目的:
 * - shared seed (`agenda.dashboard.dev.v1`, `schedules.today.dev.v1`)
 *   を使って、Dashboard 上の handoff summary / 今日の予定カードが期待通りのカウント・内容になっているか検証する
 * - Dashboard ↔ Agenda ↔ Schedule の「幹ルート」が JSON fixture と 1:1 で結び付いていることを担保する
 *
 * 特徴:
 * - `bootAgenda` の seed オプションに強く依存する deterministic テスト
 * - fixture を更新した場合は、この spec の期待値も必ず更新する必要がある
 *
 * 更新の目安:
 * - handoff summary や 今日の予定カードの UI / testid / カウント仕様を変えたとき
 * - shared seed JSON (`agenda.dashboard.dev.v1`, `schedules.today.dev.v1`) を変更したとき
 */
import { expect, test } from '@playwright/test';
import { TESTIDS } from '../../src/testids';
import { bootAgenda } from './_helpers/bootAgenda';

const DASHBOARD_ENTRY = '/dashboard?zeroscroll=0';

/**
 * Dashboard happy path (fixture-locked):
 * - Seeds agenda.dashboard.dev.v1 + schedules.today.dev.v1 via bootAgenda
 * - Asserts dashboard-handoff-summary-(total|alert|action) reflect the shared JSON counts
 * - Ensures the "今日の予定" card renders the seeded staff lane plus the schedule CTA
 *
 * Update this spec alongside the handoff/schedule fixtures whenever those cards change.
 */
test.describe('Dashboard happy path (handoff + agenda seeds)', () => {
  test('shows seeded handoff summary and today schedule snapshot', async ({ page }) => {
    await bootAgenda(page, {
      seed: {
        agenda: true,
        schedulesToday: true,
      },
    });

    await page.goto(DASHBOARD_ENTRY);
    await expect(page.getByTestId(TESTIDS['dashboard-page'])).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard/);

    const summaryRoot = page.getByTestId(TESTIDS['dashboard-handoff-summary']);
    await expect(summaryRoot.getByTestId(TESTIDS['dashboard-handoff-summary-total'])).toContainText('3');
    await expect(summaryRoot.getByTestId(TESTIDS['dashboard-handoff-summary-alert'])).toContainText('1');
    await expect(summaryRoot.getByTestId(TESTIDS['dashboard-handoff-summary-action'])).toContainText('1');

    const scheduleSection = page.getByTestId('dashboard-section-schedule');
    await expect(scheduleSection.getByRole('heading', { name: '今日の予定' })).toBeVisible();
    await expect(page.getByText('職員朝会 / 申し送り確認').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'マスタースケジュールを開く' })).toBeVisible();
  });
});
