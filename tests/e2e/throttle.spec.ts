import { test, expect } from '@playwright/test';

// Base values aligned with dev:e2e env vars
const SP_BASE = 'https://contoso.sharepoint.com/sites/Audit/_api';

test.beforeEach(async ({ page }) => {
  // Intercept list GET: first 429, then 200
  let getHit = 0;
  await page.route(/https:\/\/contoso\.sharepoint\.com\/sites\/Audit\/.*\/lists\/getbytitle.*items.*/i, async route => {
    if (getHit++ === 0) {
      return route.fulfill({ status: 429, headers: { 'Retry-After': '0' } });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ value: [] }) });
  });

  // Intercept $batch: first 503 then 200 with 201 marker
  let batchHit = 0;
  await page.route(/https:\/\/contoso\.sharepoint\.com\/sites\/Audit\/.*\/\$batch/i, async route => {
    if (batchHit++ === 0) {
      return route.fulfill({ status: 503 });
    }
    return route.fulfill({ status: 200, contentType: 'text/plain', body: 'HTTP/1.1 201 Created' });
  });
});

test('GET 429 -> retry success (no fatal error)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('text=運営指導・記録管理').first()).toBeVisible();
});

test('$batch 503 -> retry success (no crash)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('text=運営指導・記録管理').first()).toBeVisible();
});
