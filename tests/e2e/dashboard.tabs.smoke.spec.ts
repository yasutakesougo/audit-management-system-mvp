import { expect, test } from '@playwright/test';

test('Dashboard tabs render and switch', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('navigation').or(page.getByTestId('top-nav'))).toBeVisible({ timeout: 10_000 });

  const trendsTab = page.getByRole('tab', { name: '集団傾向分析' });
  await expect(trendsTab).toBeVisible();
  await expect(trendsTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('昼食摂取状況')).toBeVisible();

  const behaviorTab = page.getByRole('tab', { name: '問題行動サマリー' });
  await behaviorTab.click();
  await expect(behaviorTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('問題行動対応履歴')).toBeVisible();
});
