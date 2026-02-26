import type { Locator } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { clickBestEffort, expectLocatorVisibleBestEffort } from './_helpers/smoke';

// ---------------------------------------------------------------------------
// Helper: parse gridTemplateColumns into token array
// Browsers may resolve `1fr` as `minmax(0px, 1fr)`, raw px, or `auto`.
// We split on whitespace that is NOT inside parentheses so
// `minmax(0px, 1fr)` stays as a single token.
// ---------------------------------------------------------------------------
function parseGridColumns(raw: string): string[] {
  const tokens: string[] = [];
  let depth = 0;
  let buf = '';
  for (const ch of raw) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ' ' && depth === 0) {
      if (buf) tokens.push(buf);
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf) tokens.push(buf);
  return tokens;
}

// ---------------------------------------------------------------------------
// Helper: evaluate grid columns from AppShell's grid container
// ---------------------------------------------------------------------------
async function getGridColumns(appShell: Locator): Promise<string> {
  return appShell.evaluate((node: HTMLElement) => {
    const gridContainer = node.firstElementChild as HTMLElement | null;
    if (!gridContainer) return '';
    return window.getComputedStyle(gridContainer).gridTemplateColumns;
  });
}

test.describe('AppShell Sidebar layout guard', () => {

  // -----------------------------------------------------------------------
  // Desktop: 48px 独立レーンが存在しない + aria-current=1（ナビ領域限定）
  // -----------------------------------------------------------------------
  test('Desktop: no standalone 48px column, aria-current=1 in nav', async ({ page }) => {
    await page.goto('/schedules/week');
    const appShell = page.getByTestId('app-shell');
    await expect(appShell).toBeVisible({ timeout: 15_000 });

    const raw = await getGridColumns(appShell);
    const cols = parseGridColumns(raw);

    // どのトークンにも 48px を含まない
    for (const col of cols) {
      expect(col).not.toContain('48px');
    }

    // aria-current は「主要ナビゲーション」領域内で ちょうど1
    const nav = page.getByRole('navigation', { name: /主要ナビゲーション/i });
    const activeLinkCount = await nav.locator('a[aria-current="page"]').count();
    expect(activeLinkCount).toBe(1);
  });

  // -----------------------------------------------------------------------
  // Desktop: サイドバー開閉トグルしても 48px が復活しない
  // -----------------------------------------------------------------------
  test('Desktop: sidebar toggle keeps no 48px column', async ({ page }) => {
    await page.goto('/schedules/week');
    const appShell = page.getByTestId('app-shell');
    await expect(appShell).toBeVisible({ timeout: 15_000 });

    const toggle = page.getByTestId('desktop-nav-open');

    // --- Toggle closed ---
    const before = await getGridColumns(appShell);
    await toggle.click();
    // 条件待ち: gridTemplateColumns が変わるまで
    await expect.poll(async () => getGridColumns(appShell)).not.toBe(before);

    const colsAfterCollapse = parseGridColumns(await getGridColumns(appShell));
    for (const col of colsAfterCollapse) {
      expect(col).not.toContain('48px');
    }

    // --- Toggle open ---
    const beforeReopen = await getGridColumns(appShell);
    await toggle.click();
    await expect.poll(async () => getGridColumns(appShell)).not.toBe(beforeReopen);

    const colsAfterExpand = parseGridColumns(await getGridColumns(appShell));
    for (const col of colsAfterExpand) {
      expect(col).not.toContain('48px');
    }
  });

  // -----------------------------------------------------------------------
  // Mobile: Drawer open でも 48px 列が復活しない + aria-current=1
  // -----------------------------------------------------------------------
  test('Mobile: no 48px column even with drawer open, aria-current=1 in nav', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/schedules/week');

    const appShell = page.getByTestId('app-shell');
    await expect(appShell).toBeVisible({ timeout: 15_000 });

    // Open mobile drawer
    await clickBestEffort(page.getByTestId('nav-open'), 'nav-open not found');
    const drawer = page.getByTestId('nav-drawer');
    await expectLocatorVisibleBestEffort(drawer, 'nav-drawer not found');

    // Grid columns check
    const raw = await getGridColumns(appShell);
    const cols = parseGridColumns(raw);
    for (const col of cols) {
      expect(col).not.toContain('48px');
    }

    // aria-current inside nav drawer
    const activeLinks = await drawer.locator('a[aria-current="page"]').count();
    expect(activeLinks).toBe(1);
  });
});
