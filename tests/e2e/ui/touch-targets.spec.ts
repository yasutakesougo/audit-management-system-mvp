import { test, expect } from '@playwright/test';

test.describe('Touch Targets', () => {
  test('Dashboard: Primary buttons meet 48px minimum', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    const buttons = await page.getByRole('button').all();
    for (const button of buttons) {
      const box = await button.boundingBox();
      if (box) {
        expect(box.height, `Button height should be at least 48px`).toBeGreaterThanOrEqual(48);
      }
    }
  });

  test('WeekPage: FAB meets 64×64px for tablet', async ({ page }) => {
    await page.goto('/schedules/week');
    await page.waitForLoadState('networkidle');

    const fab = page.locator('button[aria-label*="予定を追加"], button[aria-label*="新規作成"]').first();
    const box = await fab.boundingBox();
    
    if (box) {
      expect(box.width, 'FAB width should be at least 64px').toBeGreaterThanOrEqual(64);
      expect(box.height, 'FAB height should be at least 64px').toBeGreaterThanOrEqual(64);
    }
  });

  test('UsersPanel: Table row actions meet 48px', async ({ page }) => {
    await page.goto('/users');
    await page.waitForLoadState('domcontentloaded');

    // 利用者一覧タブに切り替え
    const listTab = page.getByRole('tab', { name: /利用者一覧/i });
    await listTab.click();
    await page.waitForTimeout(500);

    const actionButtons = page.locator('[role="table"] button').first();
    const box = await actionButtons.boundingBox();
    
    if (box) {
      expect(box.height, 'Table action button height should be at least 48px').toBeGreaterThanOrEqual(48);
    }
  });

  test('SupportRecordPage: Form inputs meet 48px', async ({ page }) => {
    await page.goto('/daily/support-record');
    await page.waitForLoadState('domcontentloaded');

    const textFields = page.locator('input[type="text"], textarea').first();
    const box = await textFields.boundingBox();
    
    if (box) {
      expect(box.height, 'Form input height should be at least 48px').toBeGreaterThanOrEqual(48);
    }
  });
});
