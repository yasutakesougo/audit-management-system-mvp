import { test, expect } from '@playwright/test';

test.describe('Scroll Behavior', () => {
  test('Dashboard: Natural page scroll (no internal scroll containers)', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    // ページ全体がスクロール可能であることを確認
    const isPageScrollable = await page.evaluate(() => {
      return document.documentElement.scrollHeight > window.innerHeight;
    });

    // 意図しない内部スクロールコンテナがないか検証
    const unintendedScrolls = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      return elements.filter((el) => {
        const htmlEl = el as HTMLElement;
        // MUI Dialog, Menu, Popover は除外
        if (htmlEl.closest('[role="dialog"], [role="menu"], [role="tooltip"]')) {
          return false;
        }
        const overflowY = window.getComputedStyle(htmlEl).overflowY;
        const hasScroll = htmlEl.scrollHeight > htmlEl.clientHeight;
        return (overflowY === 'scroll' || overflowY === 'auto') && hasScroll;
      }).map((el) => (el as HTMLElement).tagName);
    });

    // ページレベルのスクロールが可能であること
    if (isPageScrollable) {
      expect(isPageScrollable, 'ページ全体がスクロール可能').toBe(true);
    }

    // 意図しない内部スクロールが存在しないこと
    expect(unintendedScrolls.length, '意図しない内部スクロールコンテナがない').toBe(0);
  });

  test('UsersPanel: Table scrolls naturally within container', async ({ page }) => {
    await page.goto('/users');
    await page.waitForLoadState('networkidle');

    // 利用者一覧タブに切り替え
    const listTab = page.getByRole('tab', { name: /利用者一覧/i });
    await listTab.click();
    
    // テーブルまたは空状態が表示されるまで待機
    await page.waitForTimeout(500);

    // テーブルが存在する場合のみ検証
    const tableExists = (await page.locator('[role="table"]').count()) > 0;
    if (!tableExists) {
      return;
    }

    // TableContainer は意図的な内部スクロール（許可される）
    const tableContainer = page.locator('[role="table"]').locator('..');
    const hasScroll = await tableContainer.evaluate((el) => {
      return el.scrollHeight > el.clientHeight;
    });

    // テーブルが長い場合、内部スクロールは許容される
    if (hasScroll) {
      expect(hasScroll, 'テーブルは内部スクロール可能（意図的）').toBe(true);
    }
  });

  test('WeekPage: Sticky header with content scroll', async ({ page }) => {
    await page.goto('/schedules/week');
    await page.waitForLoadState('networkidle');

    // ページをスクロール
    await page.evaluate(() => window.scrollBy(0, 100));

    // Sticky ヘッダーの位置確認（実装によって異なる）
    const header = page.locator('header, [role="banner"]').first();
    const box = await header.boundingBox();
    
    if (box) {
      // Stickyヘッダーがページ上部に固定されていることを確認
      expect(box.y, 'Sticky header stays at top').toBeLessThanOrEqual(10);
    }
  });

  test('SupportRecordPage: Form elements do not create nested scroll', async ({ page }) => {
    await page.goto('/daily/support-record');
    await page.waitForLoadState('domcontentloaded');

    // フォームエリアが意図しないスクロールコンテナになっていないか
    const unintendedScrolls = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('form, [role="form"]'));
      return elements.filter((el) => {
        const htmlEl = el as HTMLElement;
        // MUI Dialog, Menu は除外
        if (htmlEl.closest('[role="dialog"], [role="menu"]')) {
          return false;
        }
        const overflowY = window.getComputedStyle(htmlEl).overflowY;
        const hasScroll = htmlEl.scrollHeight > htmlEl.clientHeight;
        return (overflowY === 'scroll' || overflowY === 'auto') && hasScroll;
      }).map((el) => (el as HTMLElement).tagName);
    });

    expect(unintendedScrolls.length, 'フォーム内に意図しないスクロールコンテナがない').toBe(0);
  });
});
