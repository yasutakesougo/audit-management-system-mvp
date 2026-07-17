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
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/schedules/week');
    await page.waitForLoadState('networkidle');

    const fab = page.getByTestId('schedules-fab-create');
    await expect(fab).toBeVisible();
    const box = await fab.boundingBox();

    expect(box, 'FAB should have a measurable bounding box').not.toBeNull();
    expect(box!.width, 'FAB width should be at least 64px').toBeGreaterThanOrEqual(64);
    expect(box!.height, 'FAB height should be at least 64px').toBeGreaterThanOrEqual(64);
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
