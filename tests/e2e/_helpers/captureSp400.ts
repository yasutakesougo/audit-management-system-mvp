import { Page } from '@playwright/test';

const MAX_BODY_PREVIEW = 2000;

export function captureSp400(page: Page): void {
  page.on('response', async (response) => {
    const url = response.url();

    // SharePoint API のみに反応
    if (!/\/_api\//i.test(url)) return;

    const status = response.status();
    if (status < 400) return;

    // 画像 / svg / layouts はノイズなので除外
    if (/\.(svg|png|jpg|gif)$/i.test(url)) return;
    if (url.includes('/_layouts/')) return;

    let body = '<no-text-body>';

    try {
      const text = await response.text();
      if (text) {
        // JSON なら整形
        try {
          body = JSON.stringify(JSON.parse(text), null, 2).slice(0, MAX_BODY_PREVIEW);
        } catch {
          // JSON 以外はテキスト扱い
          body = text.slice(0, MAX_BODY_PREVIEW);
        }
      } else {
        body = '<empty>';
      }
    } catch {
      body = '<no-text-body>';
    }

    const category = status >= 500 ? '[SP 5xx]' : '[SP 4xx]';

    // eslint-disable-next-line no-console
    console.error(
      category,
      status,
      url,
      '\n--- body ---\n',
      body.trim() || '<empty>',
      '\n------------\n'
    );
  });
}
