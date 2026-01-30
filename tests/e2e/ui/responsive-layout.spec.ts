import { test, expect } from '@playwright/test';

const BREAKPOINTS = [
  { name: 'mobile (375px)', width: 375, height: 667 },
  { name: 'tablet (768px)', width: 768, height: 1024 },
  { name: 'laptop (1024px)', width: 1024, height: 768 },
  { name: 'desktop (1366px)', width: 1366, height: 768 },
];

test.describe('Responsive Layout', () => {
  for (const bp of BREAKPOINTS) {
    test(`Dashboard has no horizontal scroll at ${bp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.goto('/dashboard');
      await page.waitForLoadState('domcontentloaded');

      const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
      const clientWidth = await page.evaluate(() => document.body.clientWidth);
      
      expect(scrollWidth, `No horizontal scroll at ${bp.name}`).toBeLessThanOrEqual(clientWidth + 1);
    });

    test(`WeekPage has no horizontal scroll at ${bp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.goto('/schedules/week');
      await page.waitForLoadState('networkidle');

      const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
      const clientWidth = await page.evaluate(() => document.body.clientWidth);
      
      expect(scrollWidth, `No horizontal scroll at ${bp.name}`).toBeLessThanOrEqual(clientWidth + 1);
    });
  }

  test('UsersPanel shows appropriate layout', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/users');
    await page.waitForLoadState('domcontentloaded');

    // タブが表示されるまで待機
    const listTab = page.getByRole('tab', { name: /利用者一覧/i });
    await listTab.click();
    await page.waitForTimeout(500);

    // テーブルまたは空状態が表示されることを確認
    const tableExists = (await page.locator('[role="table"]').count()) > 0;
    const emptyStateExists = (await page.locator(':text("利用者が登録されていません")').count()) > 0;
    
    expect(tableExists || emptyStateExists, 'Table or empty state should be visible').toBeTruthy();
  });

  test('SupportRecordPage grid layout (tablet: 768px)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/daily/support-record');
    await page.waitForLoadState('domcontentloaded');

    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const clientWidth = await page.evaluate(() => document.body.clientWidth);
    
    expect(scrollWidth, 'No horizontal scroll at tablet').toBeLessThanOrEqual(clientWidth + 1);
  });
});
