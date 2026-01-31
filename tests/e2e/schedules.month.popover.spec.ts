import { test, expect } from '@playwright/test';

test.describe('Schedule Month: Day Popover with Top 5 + More', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/schedules/month');
  });

  test('popover displays top 5 items and "more N" when items > 5', async ({ page }) => {
    // 1. Popover表示: 予定が複数ある日をクリック（テスト用fixture: 2026-01-15は6件以上と仮定）
    // 実際はfixture依存なので、存在する日付を手動で指定 or GraphQL seedを別途

    // 予定件数があるセルを探す
    let cellWithItems = null;
    const allCells = page.locator('[data-testid*="schedules-month-day-"]');
    const count = await allCells.count();

    for (let i = 0; i < count; i++) {
      const cell = allCells.nth(i);
      const badge = cell.locator('.MuiBadge-badge');
      const badgeText = await badge.textContent();
      if (badgeText && parseInt(badgeText, 10) >= 6) {
        cellWithItems = cell;
        break;
      }
    }

    if (!cellWithItems) {
      test.skip();
      return;
    }

    await cellWithItems.click();

    // 2. Popover が表示される
    const popover = page.locator('[data-testid="schedules-day-popover"]');
    await expect(popover).toBeVisible();

    // 3. 表示アイテム = 5件（上位5件）
    const visibleItems = page.locator('[data-testid^="day-popover-item-"]');
    const visibleCount = await visibleItems.count();
    expect(visibleCount).toBe(5);

    // 4. "他 N 件" が表示されている
    const moreButton = page.locator('[data-testid="day-popover-more"]');
    await expect(moreButton).toBeVisible();
    const moreText = await moreButton.textContent();
    expect(moreText).toMatch(/他 \d+ 件/);
  });

  test('clicking "more N items" navigates to day view', async ({ page }) => {
    // 1. 5件以上の予定がある日を探す
    const allCells = page.locator('[data-testid*="schedules-month-day-"]');
    const count = await allCells.count();
    let cellWithItems = null;

    for (let i = 0; i < count; i++) {
      const cell = allCells.nth(i);
      const badge = cell.locator('.MuiBadge-badge');
      const badgeText = await badge.textContent();
      if (badgeText && parseInt(badgeText, 10) >= 6) {
        cellWithItems = cell;
        break;
      }
    }

    if (!cellWithItems) {
      test.skip();
      return;
    }

    await cellWithItems.click();

    // 2. "他 N 件" をクリック
    const moreButton = page.locator('[data-testid="day-popover-more"]');
    await moreButton.click();

    // 3. Day view へ遷移（URLで確認）
    await expect(page).toHaveURL(/\/schedules\/day/);

    // 4. Popover が閉じている
    const popover = page.locator('[data-testid="schedules-day-popover"]');
    await expect(popover).not.toBeVisible();
  });

  test('keyboard navigation: Enter/Space on "more N" item', async ({ page }) => {
    // 1. Popover表示
    const allCells = page.locator('[data-testid*="schedules-month-day-"]');
    const count = await allCells.count();
    let cellWithItems = null;

    for (let i = 0; i < count; i++) {
      const cell = allCells.nth(i);
      const badge = cell.locator('.MuiBadge-badge');
      const badgeText = await badge.textContent();
      if (badgeText && parseInt(badgeText, 10) >= 6) {
        cellWithItems = cell;
        break;
      }
    }

    if (!cellWithItems) {
      test.skip();
      return;
    }

    await cellWithItems.click();

    // 2. "他 N 件" にフォーカス
    const moreButton = page.locator('[data-testid="day-popover-more"]');
    await moreButton.focus();

    // 3. Enter キー押下
    await moreButton.press('Enter');

    // 4. Day view へ遷移
    await expect(page).toHaveURL(/\/schedules\/day/);
  });

  test('keyboard navigation: Space key on "more N" item', async ({ page }) => {
    // 1. Popover表示
    const allCells = page.locator('[data-testid*="schedules-month-day-"]');
    const count = await allCells.count();
    let cellWithItems = null;

    for (let i = 0; i < count; i++) {
      const cell = allCells.nth(i);
      const badge = cell.locator('.MuiBadge-badge');
      const badgeText = await badge.textContent();
      if (badgeText && parseInt(badgeText, 10) >= 6) {
        cellWithItems = cell;
        break;
      }
    }

    if (!cellWithItems) {
      test.skip();
      return;
    }

    await cellWithItems.click();

    // 2. "他 N 件" にフォーカス
    const moreButton = page.locator('[data-testid="day-popover-more"]');
    await moreButton.focus();

    // 3. Space キー押下
    await moreButton.press(' ');

    // 4. Day view へ遷移
    await expect(page).toHaveURL(/\/schedules\/day/);
  });

  test('all visible items and "more" are keyboard accessible', async ({ page }) => {
    // 1. Popover表示
    const allCells = page.locator('[data-testid*="schedules-month-day-"]');
    const count = await allCells.count();
    let cellWithItems = null;

    for (let i = 0; i < count; i++) {
      const cell = allCells.nth(i);
      const badge = cell.locator('.MuiBadge-badge');
      const badgeText = await badge.textContent();
      if (badgeText && parseInt(badgeText, 10) >= 6) {
        cellWithItems = cell;
        break;
      }
    }

    if (!cellWithItems) {
      test.skip();
      return;
    }

    await cellWithItems.click();

    // 2. 各行が Tab キーでフォーカス可能
    const popover = page.locator('[data-testid="schedules-day-popover"]');
    const allItems = popover.locator('[data-testid^="day-popover-item-"], [data-testid="day-popover-more"]');
    const totalItems = await allItems.count();

    for (let i = 0; i < totalItems; i++) {
      const item = allItems.nth(i);
      // 最初のアイテムに初期フォーカス
      if (i === 0) {
        await item.focus();
      } else {
        await page.keyboard.press('Tab');
      }
      await expect(item).toBeFocused();
    }
  });
});
