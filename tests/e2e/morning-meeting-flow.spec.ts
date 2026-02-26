import { expect, test } from '@playwright/test';
import { TESTIDS } from '../../src/testids';

const BRIEFING_DASHBOARD_URL = '/dashboard/briefing';

test.describe('Morning Meeting Flow', () => {
  test('displays briefing dashboard and morning tab content', async ({ page }) => {
    await page.goto(BRIEFING_DASHBOARD_URL);

    const root = page.getByTestId(TESTIDS['dashboard-page-tabs']);
    await expect(root).toBeVisible();
    await expect(page.getByRole('heading', { name: '朝会・夕会情報' })).toBeVisible();

    await page.getByTestId(TESTIDS['dashboard-tab-morning']).click();

    const morningGuide = page.getByTestId(TESTIDS['dashboard-briefing-guide-morning']);
    await expect(morningGuide).toBeVisible();
    await expect(page.getByText('申し送りタイムライン（昨日）')).toBeVisible();
  });

  test('navigates from timeline tab to handoff timeline', async ({ page }) => {
    await page.goto(BRIEFING_DASHBOARD_URL);

    await page.getByTestId(TESTIDS['dashboard-tab-timeline']).click();
    await page.getByRole('button', { name: 'タイムラインを開く' }).click();
    await expect(page).toHaveURL(/\/handoff-timeline/);
  });

  test('shows meeting checklist when morning guide is expanded', async ({ page }) => {
    await page.goto(BRIEFING_DASHBOARD_URL);
    await page.getByTestId(TESTIDS['dashboard-tab-morning']).click();

    const morningGuide = page.getByTestId(TESTIDS['dashboard-briefing-guide-morning']);
    await expect(morningGuide).toBeVisible();
    await morningGuide.getByText('進行ガイド（チェックリスト）').click();
    await expect(page.getByText('安全指標の確認（注意事項があれば共有）')).toBeVisible();
  });

  test('shows morning-specific content', async ({ page }) => {
    await page.goto(BRIEFING_DASHBOARD_URL);
    await page.getByTestId(TESTIDS['dashboard-tab-morning']).click();

    await expect(page.getByText('安全指標サマリはダッシュボードの「安全インジケーター」で確認できます。')).toBeVisible();
    await expect(page.getByText('申し送りタイムライン（昨日）')).toBeVisible();
  });

  test('displays responsive layout on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(BRIEFING_DASHBOARD_URL);

    await expect(page.getByTestId(TESTIDS['dashboard-page-tabs'])).toBeVisible();
    await page.getByTestId(TESTIDS['dashboard-tab-morning']).click();
    await expect(page.getByTestId(TESTIDS['dashboard-briefing-guide-morning'])).toBeVisible();

    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.getByTestId(TESTIDS['dashboard-briefing-guide-morning'])).toBeVisible();
  });

  test('works correctly in evening mode', async ({ page }) => {
    await page.goto(BRIEFING_DASHBOARD_URL);
    await page.getByTestId(TESTIDS['dashboard-tab-evening']).click();

    await expect(page.getByTestId(TESTIDS['dashboard-briefing-guide-evening'])).toBeVisible();
    await expect(page.getByText('記録状況の詳細はダッシュボードの「ケース記録」カードから確認できます。')).toBeVisible();
    await expect(page.getByText('申し送りタイムライン（今日）')).toBeVisible();
  });

  test('handles loading states gracefully', async ({ page }) => {
    await page.goto(BRIEFING_DASHBOARD_URL);

    const root = page.getByTestId(TESTIDS['dashboard-page-tabs']);
    await expect(root).toBeVisible();
    await expect(page.getByTestId(TESTIDS['dashboard-briefing-page'])).toBeVisible({ timeout: 10000 });
  });
});