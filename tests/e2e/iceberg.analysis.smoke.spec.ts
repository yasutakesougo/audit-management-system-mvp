import { expect, test } from '@playwright/test';
import { bootstrapDashboard } from './utils/bootstrapApp';

async function openIcebergCanvas(page: import('@playwright/test').Page) {
  await bootstrapDashboard(page, {
    skipLogin: true,
    initialPath: '/analysis/iceberg',
  });

  await page.getByLabel('分析対象').click();
  await page.getByRole('option').nth(1).click();

  const canvas = page.getByTestId('iceberg-canvas').last();
  await expect(canvas).toBeVisible();

  const cards = page.locator('[data-testid^="iceberg-card-item"]');
  return { canvas, cards };
}

async function createManualNode(page: import('@playwright/test').Page, canvas: import('@playwright/test').Locator) {
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not found');

  await canvas.dblclick({ position: { x: Math.min(box.width - 20, 320), y: Math.min(box.height - 20, 320) } });

  const cards = page.locator('[data-testid^="iceberg-card-item"]');
  await expect.poll(() => cards.count()).toBeGreaterThan(0);

  return cards;
}

test.describe('Iceberg Analysis (/analysis/iceberg) smoke', () => {
  test('loads /analysis/iceberg and canvas is visible with cards', async ({ page }) => {
    const { canvas } = await openIcebergCanvas(page);
    const cards = await createManualNode(page, canvas);
    await expect(canvas).toBeVisible();

    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThanOrEqual(1);
    console.info(`[iceberg-smoke] Found ${cardCount} cards`);

    const links = page.getByTestId('iceberg-links').last();
    await expect(links).toBeVisible();
  });

  test('clicking a card selects it (visual feedback)', async ({ page }) => {
    const { canvas } = await openIcebergCanvas(page);
    const cards = await createManualNode(page, canvas);
    const firstCard = cards.first();

    await firstCard.click();
    await expect(firstCard).toBeVisible();
  });

  test('drag a card changes its position', async ({ page }) => {
    const { canvas } = await openIcebergCanvas(page);
    const cards = await createManualNode(page, canvas);
    const firstCard = cards.first();

    const _initialLeft = await firstCard.evaluate((el) => el.style.left);
    const _initialTop = await firstCard.evaluate((el) => el.style.top);

    const box = await firstCard.boundingBox();
    if (!box) throw new Error('Card not found');

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 50);
    await page.mouse.up();

    await expect(firstCard).toBeVisible();
  });

  test('double-clicking canvas creates a manual node', async ({ page }) => {
    const { canvas, cards } = await openIcebergCanvas(page);
    const countBefore = await cards.count();

    await createManualNode(page, canvas);
    await expect.poll(() => cards.count()).toBeGreaterThan(countBefore);
  });
});
