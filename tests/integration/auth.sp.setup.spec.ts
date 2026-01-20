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
  await page.goto(siteUrl, { waitUntil: 'networkidle' });

  // Wait for page to stabilize (sign-in might redirect)
  // If already signed in, this completes quickly
  // If not signed in, user must complete login manually in interactive mode
  await page.waitForTimeout(2000);

  // Check if we're logged in by looking for typical SharePoint page indicators
  // (This is a simple heuristic; production setups might need more robust detection)
  const bodyHTML = await page.content();
  const isLoggedIn =
    bodyHTML.includes('_layouts') || // SharePoint URL pattern
    bodyHTML.includes('ms-Persona') || // SharePoint persona component
    bodyHTML.includes('Fluent') || // Fluent UI presence
    !bodyHTML.includes('Sign in'); // Not on login page

  if (!isLoggedIn) {
    console.warn('[setup] May not be fully authenticated. Continuing anyway...');
  }

  // Save the context (with SharePoint cookies) to storageState
  await context.storageState({ path: 'tests/.auth/storageState.json' });

  console.log('[setup] SharePoint authentication complete. storageState saved.');
});
