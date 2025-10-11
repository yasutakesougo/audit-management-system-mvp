import type { Page } from '@playwright/test';

declare global {
  interface Window {
    __ENV__?: Record<string, string>;
  }
}

const DAILY_HEADING_LOCATOR = /日次記録|Daily\s*Records/i;

export async function openDailyRecords(page: Page, options: { env?: Record<string, string> } = {}) {
  const envOverrides = {
    VITE_FEATURE_SCHEDULES: '0',
    VITE_FEATURE_SCHEDULES_CREATE: '0',
    VITE_SKIP_LOGIN: '1',
    VITE_E2E_MSAL_MOCK: 'true',
    ...options.env,
  } as Record<string, string>;

  await page.addInitScript(({ env }) => {
    window.__ENV__ = { ...(window.__ENV__ ?? {}), ...env };
  }, { env: envOverrides });

  await page.goto('/records/daily', { waitUntil: 'domcontentloaded' });
  try {
    await page.getByRole('heading', { name: DAILY_HEADING_LOCATOR }).waitFor({ timeout: 10_000 });
    return;
  } catch {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(200);
    await page.getByRole('heading', { name: DAILY_HEADING_LOCATOR }).waitFor({ timeout: 10_000 });
  }
}
