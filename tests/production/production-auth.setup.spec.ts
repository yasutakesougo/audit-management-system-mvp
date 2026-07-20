import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { expect, test } from '@playwright/test';

const productionBaseURL =
  process.env.PRODUCTION_BASE_URL ??
  'https://audit-management-system-mvp.momosantanuki.workers.dev';
const productionStorageState = 'tests/.auth/production-storageState.json';
const authWaitTimeout = Number(process.env.PRODUCTION_AUTH_TIMEOUT_MS ?? 180_000);

test('create production Workers Entra storage state', async ({ page, context }) => {
  const productionOrigin = new URL(productionBaseURL).origin;

  await page.goto(`${productionBaseURL}/`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });

  // The headed page is intentionally left available for manual Entra/MFA completion.
  await page.goto(`${productionBaseURL}/kiosk`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await expect(page.getByRole('button', { name: 'サインアウト' })).toBeVisible({
    timeout: authWaitTimeout,
  });
  await expect(page.getByRole('heading', { name: 'キオスクモード' })).toBeVisible({
    timeout: authWaitTimeout,
  });

  const currentURL = new URL(page.url());
  expect(currentURL.origin).toBe(productionOrigin);
  expect(['/auth/callback', '/callback']).not.toContain(currentURL.pathname);
  expect(currentURL.pathname).toBe('/kiosk');

  await mkdir(dirname(productionStorageState), { recursive: true });
  await context.storageState({ path: productionStorageState });
});
