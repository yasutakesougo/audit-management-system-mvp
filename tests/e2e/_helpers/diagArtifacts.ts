import { expect, type Page, type TestInfo } from '@playwright/test';

export async function attachUIState(page: Page, testInfo: TestInfo, name = 'ui-state') {
  // URL
  await testInfo.attach(`${name}.url.txt`, {
    body: Buffer.from(page.url(), 'utf-8'),
    contentType: 'text/plain',
  });

  // DOM snapshot（巨大になりやすいので軽めに）
  const html = await page.content();
  await testInfo.attach(`${name}.html`, {
    body: Buffer.from(html, 'utf-8'),
    contentType: 'text/html',
  });

  // Console logs（必要なら後でon('console')で蓄積する方式に拡張）
}

export async function attachOnFailure(page: Page, testInfo: TestInfo) {
  if (testInfo.status !== testInfo.expectedStatus) {
    // screenshot / trace は config で取れてる前提でも、ここで追撃の1枚を確実に残す
    await testInfo.attach('failure.png', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    await attachUIState(page, testInfo, 'failure');
  }
}

export async function expectVisibleWithShot(
  locator: ReturnType<Page['locator']> | any,
  page: Page,
  testInfo: TestInfo,
  label: string,
  timeout = 10_000
) {
  try {
    await expect(locator).toBeVisible({ timeout });
  } catch (e) {
    await testInfo.attach(`missing-${label}.png`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
    throw e;
  }
}
