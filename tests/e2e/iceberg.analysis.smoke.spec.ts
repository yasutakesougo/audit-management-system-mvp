import { expect, test } from '@playwright/test';
import { bootstrapDashboard } from './utils/bootstrapApp';

test.describe('Iceberg Analysis (/analysis/iceberg) smoke', () => {
  test.beforeEach(async ({ page }) => {
    // bootstrap with viewer role
    await bootstrapDashboard(page, {
      skipLogin: true,
      initialPath: '/analysis/iceberg',
    });
  });

  test('loads /analysis/iceberg and canvas is visible with cards', async ({ page }) => {
    // Verify canvas is rendered (data-testid="iceberg-canvas")
    const canvas = page.getByTestId('iceberg-canvas');
    await expect(canvas).toBeVisible();

    // Verify at least 1 card is rendered (behavior, assessment, environment)
    const cards = page.locator('[data-testid^="iceberg-card-"]');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThanOrEqual(1);
    console.info(`[iceberg-smoke] Found ${cardCount} cards`);

    // Verify waterline (SVG links) is rendered
    const links = page.getByTestId('iceberg-links');
    await expect(links).toBeVisible();
  });

  test('clicking a card selects it (visual feedback)', async ({ page }) => {
    const cards = page.locator('[data-testid^="iceberg-card-"]');
    const firstCard = cards.first();

    // Get initial state
    const initialBorderColor = await firstCard.evaluate((el) => {
      return window.getComputedStyle(el).borderColor;
    });

    // Click to select
    await firstCard.click();

    // Verify border changed (selected = primary.main color, usually #1976d2)
    const selectedBorderColor = await firstCard.evaluate((el) => {
      return window.getComputedStyle(el).borderColor;
    });

    expect(selectedBorderColor).not.toBe(initialBorderColor);
    console.info(`[iceberg-smoke] Card selection: border changed from "${initialBorderColor}" to "${selectedBorderColor}"`);
  });

  test('drag a card changes its position', async ({ page }) => {
    const cards = page.locator('[data-testid^="iceberg-card-"]');
    const firstCard = cards.first();

    // Get initial position (left, top from inline style)
    const initialLeft = await firstCard.evaluate((el) => el.style.left);
    const initialTop = await firstCard.evaluate((el) => el.style.top);

    // Drag the card 50px right, 50px down
    const box = await firstCard.boundingBox();
    if (!box) throw new Error('Card not found');

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 50);
    await page.mouse.up();

    // Get new position
    const newLeft = await firstCard.evaluate((el) => el.style.left);
    const newTop = await firstCard.evaluate((el) => el.style.top);

    // Verify position changed (parsing "100px" style strings)
    const initialLeftVal = parseInt(initialLeft || '0');
    const newLeftVal = parseInt(newLeft || '0');
    const initialTopVal = parseInt(initialTop || '0');
    const newTopVal = parseInt(newTop || '0');

    expect(newLeftVal).not.toBe(initialLeftVal);
    expect(newTopVal).not.toBe(initialTopVal);
    console.info(
      `[iceberg-smoke] DnD: moved from (${initialLeftVal}, ${initialTopVal}) to (${newLeftVal}, ${newTopVal})`,
    );
  });

  test('"仮説リンク (Demo)" button creates a link', async ({ page }) => {
    // Get initial link count
    const linksBefore = page.locator('[data-testid="iceberg-links"] line');
    const linkCountBefore = await linksBefore.count();

    // Click "仮説リンク (Demo)" button
    const linkButton = page.getByRole('button', { name: /仮説リンク/ });
    await expect(linkButton).toBeVisible();
    await linkButton.click();

    // Wait for DOM update
    await page.waitForTimeout(300);

    // Get new link count
    const linksAfter = page.locator('[data-testid="iceberg-links"] line');
    const linkCountAfter = await linksAfter.count();

    expect(linkCountAfter).toBeGreaterThan(linkCountBefore);
    console.info(`[iceberg-smoke] Links: ${linkCountBefore} → ${linkCountAfter}`);
  });
});
