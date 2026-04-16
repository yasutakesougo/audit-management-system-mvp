import { test as setup } from '@playwright/test';

/**
 * Setup: SharePoint authentication for integration tests
 *
 * This saves the browser context with SharePoint cookies to storageState.json,
 * enabling integration tests to make authenticated REST API calls.
 *
 * Requires SHAREPOINT_SITE env var (absolute URL, e.g., https://tenant.sharepoint.com/sites/site)
 */
setup('authenticate with SharePoint', async ({ page, context }) => {
  const siteUrl = process.env.SHAREPOINT_SITE;
  if (!siteUrl) {
    throw new Error('[setup] SHAREPOINT_SITE is required (e.g., https://tenant.sharepoint.com/sites/site)');
  }

  // Navigate to SharePoint site
  // This will trigger Microsoft login if not authenticated
  await page.goto(siteUrl, { waitUntil: 'domcontentloaded' });

  // Wait for page to stabilize (sign-in might redirect)
  await page.waitForTimeout(2000);

  // Verify authentication by checking currentuser endpoint
  // Retry up to 600 times (300 seconds / 5 minutes) to allow for manual login + MFA + 'Stay signed in'
  const userCheckUrl = `${siteUrl}/_api/web/currentuser`;

  let lastStatus: number | null = null;
  for (let i = 0; i < 600; i++) {
    const res = await page.request.get(userCheckUrl);
    lastStatus = res.status();

    if (res.ok()) {
      const json = await res.json().catch(() => null);
      const user = (json as any)?.d ?? json; // verbose/non-verbose 両対応
      console.log(`[setup] ✅ Authenticated as: ${user?.Title ?? 'Unknown'} (${user?.Email ?? 'Unknown'})`);

      await context.storageState({ path: 'tests/.auth/storageState.json' });
      console.log('[setup] SharePoint authentication complete. storageState saved.');
      return;
    }

    if ((i + 1) % 20 === 0) {
      console.log(`[setup] Retry ${i + 1}/600: currentuser status=${lastStatus} (Waiting for manual login / MFA...)`);
    }
    await page.waitForTimeout(500);
  }

  throw new Error(`[setup] ❌ Cannot verify authentication for ${siteUrl}. lastStatus=${lastStatus}`);
});
