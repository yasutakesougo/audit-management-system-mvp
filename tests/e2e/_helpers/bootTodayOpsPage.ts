import type { Page } from '@playwright/test';
import { setupPlaywrightEnv } from './setupPlaywrightEnv';

export async function bootTodayOpsPage(page: Page): Promise<void> {
  await setupPlaywrightEnv(page, {
    envOverrides: {
      VITE_E2E: '1',
      VITE_E2E_MSAL_MOCK: '1',
      VITE_SKIP_SHAREPOINT: '1',
      VITE_DEMO_MODE: '1',
    },
  });

  await page.addInitScript(() => {
    (
      window as typeof window & {
        __E2E_TODAY_OPS_MOCK__?: boolean;
      }
    ).__E2E_TODAY_OPS_MOCK__ = true;
  });

  await page.route('/_api/**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ d: { results: [] } }),
  }));
}
