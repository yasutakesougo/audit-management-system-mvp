import { test, expect } from '@playwright/test';
import { setupSharePointStubs } from './_helpers/setupSharePointStubs';
import { mockSharePointThrottle } from './_helpers/mockSharePointThrottle';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const globalWithEnv = window as typeof window & { __ENV__?: Record<string, string> };
    globalWithEnv.__ENV__ = {
      ...(globalWithEnv.__ENV__ ?? {}),
      VITE_E2E_MSAL_MOCK: '1',
      VITE_SKIP_LOGIN: '1',
      VITE_DEMO_MODE: '0',
    };
    try {
      window.localStorage.setItem('skipLogin', '1');
      window.localStorage.setItem('demo', '0');
    } catch {
      // ignore storage failures in unsupported environments
    }
  });

  await page.route('**/login.microsoftonline.com/**', (route) => route.fulfill({ status: 204, body: '' }));
  await page.route('https://graph.microsoft.com/**', (route) =>
    route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: [] }) })
  );

  await setupSharePointStubs(page, {
    currentUser: { status: 200, body: { Id: 1234 } },
    lists: [
      { name: 'Users_Master', items: [] },
      { name: 'Schedules', aliases: ['ScheduleEvents'], items: [] },
      { name: 'SupportRecord_Daily', items: [] },
    ],
    fallback: { status: 200, body: { value: [] } },
  });

  await mockSharePointThrottle(page);
});

test('GET 429 -> retry success (no fatal error)', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.getByTestId('dashboard-page')).toBeVisible({ timeout: 15000 });
});

test('$batch 503 -> retry success (no crash)', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.getByTestId('dashboard-page')).toBeVisible({ timeout: 15000 });
});
