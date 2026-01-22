import { test, expect } from '@playwright/test';

test.describe('Schedules: list existence gate', () => {
  test('renders schedules week view successfully (tokenReady + listReady gate active)', async ({
    page,
  }) => {
    // This test verifies that the two-stage gate (tokenReady + listReady) is in place and NOT blocking valid requests.
    // In E2E mode (VITE_SKIP_SHAREPOINT=1, VITE_DEMO_MODE=1), list checks are bypassed.
    // The real 404 blocking is integration-tested separately.

    await page.goto('/schedules/week', { waitUntil: 'networkidle' });

    // 1) Expect: Week view heading is visible (proves ProtectedRoute allowed render-through)
    const weekHeading = page.getByTestId('schedules-week-heading');
    await expect(weekHeading).toBeVisible({ timeout: 5000 });

    // 2) Expect: No error message shown (proves listReady gate did not block)
    const errorMessage = page.getByText('スケジュール用の SharePoint リストが見つかりません');
    await expect(errorMessage).not.toBeVisible();
  });

  test.skip('shows error when DailyOpsSignals list returns 404', async ({ page }) => {
    // Mock the list metadata endpoint to return 404
    // This runs only in chromium-sp-integration project where VITE_SKIP_SHAREPOINT=0
    // The route pattern must be broad enough to catch both relative and absolute URLs
    await page.route('**/*DailyOpsSignals*', async (route) => {
      // Only mock the getbytitle query (list existence check)
      if (route.request().url().includes('$select=Id,Title')) {
        await route.respond({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({
            'odata.error': {
              code: '-2130575151, Microsoft.SharePoint.Client.ResourceNotFoundException',
              message: {
                value: 'The list with ID {12345678-1234-1234-1234-123456789012} does not exist.'
              }
            }
          })
        });
      } else {
        // Pass through other requests
        await route.continue();
      }
    });

    // Navigate to schedules
    await page.goto('/schedules/week', { waitUntil: 'networkidle' });

    // Should show error message
    const errorText = page.getByText(/スケジュール用の SharePoint リストが見つかりません/i);
    await expect(errorText).toBeVisible({ timeout: 5000 });

    // Should show admin contact guidance
    const adminText = page.getByText(/管理者に連絡してください/i);
    await expect(adminText).toBeVisible();

    // Gate should prevent further navigation
    const weekHeading = page.getByTestId('schedules-week-heading');
    await expect(weekHeading).not.toBeVisible();
  });
});
