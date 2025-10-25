import { test, expect } from '@playwright/test';

test('Schedule WeekPage renders', async ({ page }) => {
  await page.goto('/schedules/week');
  await expect(page).toHaveURL(/\/schedules\/week$/);

  const root = page.getByTestId('week-page');
  if (await root.count()) {
    await expect(root).toBeVisible();
  } else {
    const cal = page.getByTestId('week-calendar');
    if (await cal.count()) {
      await expect(cal).toBeVisible();
    } else {
      // フォールバック：見出しテキストでも確認
      await expect(
        page.getByRole('heading', { name: /スケジュール|週間|week/i })
      ).toBeVisible();
    }
  }
});
