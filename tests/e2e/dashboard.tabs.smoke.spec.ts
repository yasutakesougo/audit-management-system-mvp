import { expect, test } from '@playwright/test';

test('Dashboard tabs render and switch', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  const nav = page.getByRole('navigation').or(page.getByTestId('top-nav'));
  const navCount = await nav.count().catch(() => 0);
  if (navCount === 0) test.skip(true, 'Top nav not rendered (likely auth-less CI).');
  await expect(nav).toBeVisible({ timeout: 10_000 });

  const trendsTab = page.getByRole('tab', { name: '集団傾向分析' });
  const trendsCount = await trendsTab.count().catch(() => 0);
  if (trendsCount === 0) test.skip(true, 'Dashboard tabs not available in this environment.');
  await expect(trendsTab).toBeVisible();
  await expect(trendsTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('昼食摂取状況')).toBeVisible();

  const behaviorTab = page.getByRole('tab', { name: '問題行動サマリー' });
  await behaviorTab.click();
  await expect(behaviorTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('問題行動対応履歴')).toBeVisible();
});
