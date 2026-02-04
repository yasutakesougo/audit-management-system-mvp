import { expect, test } from '@playwright/test';
import { primeOpsEnv } from './helpers/ops';

test.describe('Phase 1: handoff ⇔ daily integration', () => {
  test.beforeEach(async ({ page }) => {
    await primeOpsEnv(page);
  });

  test('daily page displays handoff summary card when count > 0', async ({ page }) => {
    // Pre-seed one handoff via localStorage (simulating existing data)
    await page.addInitScript(() => {
      const today = new Date().toISOString().split('T')[0];
      const handoffs = [
        {
          id: 1,
          userCode: '001',
          userDisplayName: '田中太郎',
          date: today,
          category: '体調',
          severity: '重要',
          message: 'Phase 1 test handoff',
          timeBand: '朝',
          status: '未対応',
          createdAt: new Date().toISOString()
        }
      ];
      localStorage.setItem('handoff.timeline.dev.v1', JSON.stringify({
        [today]: handoffs
      }));
    });

    await page.goto('/daily/activity');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);

    const summary = page.getByTestId('daily-handoff-summary');
    await expect(summary).toBeVisible();
    await expect(summary).toContainText(/本日の申し送り:/);

    const cta = page.getByTestId('daily-handoff-summary-cta');
    await expect(cta).toBeVisible();
    await expect(cta).toContainText('タイムラインで確認');
  });

  test('daily summary card CTA navigates to timeline with state', async ({ page }) => {
    await page.addInitScript(() => {
      const today = new Date().toISOString().split('T')[0];
      const handoffs = [
        {
          id: 1,
          userCode: 'ALL',
          userDisplayName: '全体',
          date: today,
          category: '体調',
          severity: '重要',
          message: 'Navigation test',
          timeBand: '朝',
          status: '未対応',
          createdAt: new Date().toISOString()
        }
      ];
      localStorage.setItem('handoff.timeline.dev.v1', JSON.stringify({
        [today]: handoffs
      }));
    });

    await page.goto('/daily/activity');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);

    const cta = page.getByTestId('daily-handoff-summary-cta');
    await cta.click();

    await expect(page).toHaveURL(/\/handoff-timeline/);
  });

  test('daily page does not show summary card when no handoffs exist', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('handoff.timeline.dev.v1');
    });

    await page.goto('/daily/activity');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);

    await expect(page.getByTestId('daily-handoff-summary')).toHaveCount(0);
  });
});
