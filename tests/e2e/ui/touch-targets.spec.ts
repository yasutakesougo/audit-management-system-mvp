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
    await page.waitForLoadState('networkidle');

    // 利用者一覧タブに切り替え
    const listTab = page.getByRole('tab', { name: /利用者一覧/i });
    await listTab.click();
    await page.waitForTimeout(1000);

    // テーブルが存在しない場合はスキップ
    const tableExists = (await page.locator('[role="table"]').count()) > 0;
    if (!tableExists) {
      test.skip();
      return;
    }

    const actionButtons = page.locator('[role="table"] button').first();
    const box = await actionButtons.boundingBox();
    
    if (box) {
      expect(box.height, 'Table action button height should be at least 48px').toBeGreaterThanOrEqual(48);
    }
  });

  test('SupportRecordPage: Form inputs meet 48px', async ({ page }) => {
    await page.goto('/daily/support-record');
    await page.waitForLoadState('networkidle');

    // MUI TextFieldまたはSelectを探す（より確実なセレクター）
    const inputElement = page.locator('.MuiTextField-root input, .MuiSelect-root, textarea').first();
    
    const elementExists = (await inputElement.count()) > 0;
    if (!elementExists) {
      test.skip();
      return;
    }

    const box = await inputElement.boundingBox();
    
    if (box) {
      expect(box.height, 'Form input height should be at least 48px').toBeGreaterThanOrEqual(48);
    }
  });
});
