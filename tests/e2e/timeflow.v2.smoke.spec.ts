import { test, expect } from '@playwright/test';

const ROUTE = '/records/support-procedures';

test.describe('TimeFlow v2 feature flag', () => {
  test('renders v2 experience when flag is enabled', async ({ context, page }) => {
    await context.addInitScript(() => {
      window.localStorage.setItem('feature:timeflowV2', 'true');
    });

    await page.goto(ROUTE);

    await expect(page.getByTestId('timeflow-v2-root')).toBeVisible();

    await page.getByTestId('timeflow-search').fill('田中');
    await expect(page.getByTestId('timeflow-results-count')).toHaveText(/^\d+件$/);

    const planTypeChip = page.getByTestId('planType-chip-作業活動');
    if (await planTypeChip.isVisible()) {
      await planTypeChip.click();
      await expect(page.getByTestId('planType-badge')).toHaveText(/作業活動/);
      await page.getByTestId('timeflow-search').fill('佐藤');
    }

    const userCard = page.getByTestId('user-card-005');
    if (await userCard.isVisible()) {
      await userCard.click();
      await expect(page.getByTestId('compliance-progress-card')).toBeVisible();
    }

    const sampleFill = page.getByTestId('sample-fill');
    if (await sampleFill.isVisible()) {
      await sampleFill.click();
    }
  });

  test('falls back to legacy layout when flag is disabled', async ({ context, page }) => {
    await context.addInitScript(() => {
      window.localStorage.setItem('feature:timeflowV2', 'false');
    });

    await page.goto(ROUTE, { waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('timeflow-legacy-root')).toBeVisible();
    await expect(page.getByTestId('timeflow-v2-root')).toHaveCount(0);
  });
});
