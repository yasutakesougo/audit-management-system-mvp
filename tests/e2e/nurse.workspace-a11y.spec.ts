import { TESTIDS } from '@/testids';
import { expect, test } from '@playwright/test';
import { bootNursePage } from './_helpers/bootNursePage';

test.skip(true, 'Legacy nurse workspace a11y checks are paused until the new workspace UI ships.');

test.describe('@ci-smoke nurse seizure workspace a11y', () => {
  test.beforeEach(async ({ page }) => {
    await bootNursePage(page, { seed: { nurseDashboard: true } });
  });

  test('heading and quick log region are exposed', async ({ page }) => {
    await page.goto('/nurse/observation');

    await expect(page.getByTestId(TESTIDS.NURSE_OBS_HEADING)).toBeVisible();
    await expect(page.getByTestId(TESTIDS.NURSE_SEIZURE_PANEL)).toBeVisible();
    await expect(page.getByRole('region', { name: '発作記録の対象設定' })).toBeVisible();
  });

  test('changing user updates query string and keeps quick log active', async ({ page }) => {
    await page.goto('/nurse/observation');

    const userSelect = page.getByTestId(TESTIDS.NURSE_OBS_USER);
    await expect(userSelect).toBeVisible();

    await userSelect.click();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/user=[A-Z]\d{3}/);
    await expect(page.getByTestId(TESTIDS.NURSE_SEIZURE_QUICKLOG)).toBeVisible();
  });

  test('date control uses ISO format and remains keyboard accessible', async ({ page }) => {
    await page.goto('/nurse/observation');

    const dateInput = page.getByTestId(TESTIDS.NURSE_SEIZURE_DATE);
    await expect(dateInput).toBeVisible();
    const initialValue = await dateInput.inputValue();
    expect(initialValue).toMatch(/\d{4}-\d{2}-\d{2}/);

    await dateInput.fill('2025-12-24');
    await expect(page).toHaveURL(/date=2025-12-24/);
  });
});
