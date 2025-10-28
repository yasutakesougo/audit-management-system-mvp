import type { Page } from '@playwright/test';

type SharePointThrottleOptions = {
  logRequests?: boolean;
};

export async function mockSharePointThrottle(page: Page, options: SharePointThrottleOptions = {}): Promise<void> {
  if (options.logRequests) {
    page.on('request', (request) => {
      if (request.url().includes('/_api/web/')) {
        console.log('[sp-throttle:req]', request.method(), request.url());
      }
    });
    page.on('pageerror', (error) => {
      console.log('[sp-throttle:error]', error.message);
    });
  }

  let listHit = 0;
  await page.route('**/lists/**/items**', async (route) => {
    if (listHit === 0) {
      listHit += 1;
      await route.fulfill({
        status: 429,
        headers: {
          'Retry-After': '0',
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({ error: { code: 'throttled', message: 'Too Many Requests' } }),
      });
      return;
    }
    listHit += 1;
    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'application/json;odata=nometadata; charset=utf-8',
        'Cache-Control': 'no-store',
      },
      body: JSON.stringify({ value: [] }),
    });
  });

  let batchHit = 0;
  await page.route('**/$batch', async (route) => {
    if (batchHit === 0) {
      batchHit += 1;
      await route.fulfill({ status: 503, body: 'Service Unavailable' });
      return;
    }
    batchHit += 1;
    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ value: [{ status: 201, body: {} }] }),
    });
  });
}
