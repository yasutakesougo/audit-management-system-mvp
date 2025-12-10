import { expect, test } from '@playwright/test';

import { bootstrapDashboard } from './utils/bootstrapApp';

test.describe('Iceberg PDCA → 日次支援記録 導線', () => {
  test('PDCA から日次支援記録へ遷移し、ユーザーと日付コンテキストを保持する', async ({ page }) => {
    await bootstrapDashboard(page, { skipLogin: true, initialPath: '/iceberg/pdca' });
    await expect(page).toHaveURL(/\/iceberg\/pdca/);

    const pdcaCards = page.getByTestId('pdca-item-card');
    const cardCount = await pdcaCards.count();
    expect(cardCount).toBeGreaterThan(0);

    const firstCard = pdcaCards.first();
    await firstCard.getByTestId('pdca-open-daily-support').click();

    await page.waitForURL(/\/daily\/support\?/);
    const url = new URL(page.url());
    const userParam = url.searchParams.get('user');
    const recordDateParam = url.searchParams.get('recordDate');
    const pdcaTitleParam = url.searchParams.get('pdcaTitle');
    const pdcaPhaseParam = url.searchParams.get('pdcaPhase');

    expect(userParam).not.toBeNull();
    expect(recordDateParam).not.toBeNull();
    expect(pdcaTitleParam).not.toBeNull();
    expect(pdcaPhaseParam).not.toBeNull();

    const dateInput = page.getByTestId('iceberg-support-record-date');
    await expect(dateInput).toHaveValue(recordDateParam ?? '');

    const contextBanner = page.getByText('今見ているコンテキスト');
    await expect(contextBanner).toBeVisible();
    const bannerContainer = contextBanner.locator('..').locator('..');
    await expect(bannerContainer).toContainText('日次支援手順記録');
    await expect(page.getByTestId('pdca-context-chip')).toBeVisible();
    await expect(page.getByTestId('pdca-title-chip')).toHaveText(pdcaTitleParam ?? '');
    await expect(page.getByTestId('pdca-phase-chip')).toContainText(pdcaPhaseParam ?? '');

    await expect(page.getByTestId('iceberg-time-based-support-record-page')).toBeVisible();
  });
});
