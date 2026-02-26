import { test } from '@playwright/test';

test.describe('Dashboard Debug', () => {
  test('check dashboard for errors', async ({ page }) => {
    // エラー収集用
    const errors: string[] = [];
    const consoleMessages: string[] = [];

    page.on('pageerror', (error) => {
      errors.push(`Page Error: ${error.message}`);
      console.log('Page Error:', error.message);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleMessages.push(`Console Error: ${msg.text()}`);
        console.log('Console Error:', msg.text());
      }
    });

    await page.goto('/dashboard?mode=morning');

    // 十分な時間を待つ
    await page.waitForTimeout(10000);

    console.log('=== Error Summary ===');
    console.log('Page errors:', errors.length);
    console.log('Console errors:', consoleMessages.length);

    errors.forEach(error => console.log('ERROR:', error));
    consoleMessages.forEach(msg => console.log('CONSOLE:', msg));

    // HTML構造を確認
    const bodyText = await page.locator('body').textContent();
    console.log('Body text length:', bodyText?.length || 0);
    console.log('Body text preview:', bodyText?.substring(0, 200) || 'No text');

    // 特定の要素が存在するか確認
    const dashboardElements = await page.$$('[data-testid]');
    console.log('Elements with testid:', dashboardElements.length);

    // data-testidの一覧を取得
    for (const element of dashboardElements.slice(0, 10)) {
      const testid = await element.getAttribute('data-testid');
      console.log('Found testid:', testid);
    }
  });
});