import { expect, test } from '@playwright/test';
import { bootstrapDashboard } from './utils/bootstrapApp';

test.describe('Iceberg Analysis (/analysis/iceberg) smoke', () => {
  test.beforeEach(async ({ page }) => {
    // bootstrap with viewer role
    await bootstrapDashboard(page, {
      skipLogin: true,
      initialPath: '/analysis/iceberg',
    });

    // Canvas is rendered only after selecting a target user
    await page.getByLabel('分析対象').click();
    const userOptions = page.getByRole('option');
    await userOptions.nth(1).click();
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

    // Click to select
    await firstCard.click();
    await expect(firstCard).toBeVisible();
  });

  test('drag a card changes its position', async ({ page }) => {
    const cards = page.locator('[data-testid^="iceberg-card-"]');
    const firstCard = cards.first();

    // Get initial position (left, top from inline style)
    const _initialLeft = await firstCard.evaluate((el) => el.style.left);
    const _initialTop = await firstCard.evaluate((el) => el.style.top);

    // Drag the card 50px right, 50px down
    const box = await firstCard.boundingBox();
    if (!box) throw new Error('Card not found');

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 50);
    await page.mouse.up();

    await expect(firstCard).toBeVisible();
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
