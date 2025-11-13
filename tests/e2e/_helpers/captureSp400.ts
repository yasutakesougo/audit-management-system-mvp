import { Page } from '@playwright/test';

const MAX_BODY_PREVIEW = 2000;

export function captureSp400(page: Page): void {
  page.on('response', async (response) => {
    const url = response.url();
    if (!url.includes('/_api/')) return;
    const status = response.status();
    if (status < 400) return;

    let body = '<no-text-body>';
    try {
      const text = await response.text();
      body = text ? text.slice(0, MAX_BODY_PREVIEW) : '<empty>';
    } catch {
      body = '<no-text-body>';
    }

    // eslint-disable-next-line no-console
    console.error('[SP 4xx]', status, url, '\n--- body ---\n', body.trim() || '<empty>', '\n------------\n');
  });
}
