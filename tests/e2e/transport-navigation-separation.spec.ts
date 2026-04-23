import { test, expect } from '@playwright/test';

test.describe('Transport Domain Separation Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app root (mock auth might be needed depending on env, 
    // but assuming dev server with bypass as per other tests)
    await page.goto('/');
    
    // Ensure auth is ready or skip login if enabled
    // Note: In this MVP, we usually have a bypass or auto-login in dev.
  });

  test('should navigate to dedicated Transport Execution page from Today menu', async ({ page }) => {
    // Open side menu if mobile, or just find the item
    // Using Role + Name for robustness. The sidebar items are links.
    const executionNavItem = page.getByRole('link', { name: '送迎実施' });
    await expect(executionNavItem).toBeVisible();
    await executionNavItem.click();

    // Verify URL
    await expect(page).toHaveURL(/\/transport\/execution/);

    // Verify Page Content
    const header = page.getByRole('heading', { name: '送迎実施', level: 1 });
    await expect(header).toBeVisible();

    // Verify Transport Status Card exists
    const statusCard = page.getByTestId('transport-status-card');
    await expect(statusCard).toBeVisible();
  });

  test('should navigate to Transport Assignment page from Schedules menu', async ({ page }) => {
    const assignmentNavItem = page.getByRole('link', { name: '送迎配車調整' });
    await expect(assignmentNavItem).toBeVisible();
    await assignmentNavItem.click();

    // Verify URL
    await expect(page).toHaveURL(/\/transport\/assignments/);

    // Verify Page Content
    const header = page.getByRole('heading', { name: '送迎配車表', level: 1 });
    await expect(header).toBeVisible();
  });

  test('should allow navigating back to Today from Execution page', async ({ page }) => {
    await page.goto('/transport/execution');
    
    // The "Back" button is actually a Link component rendered as a button
    const backButton = page.getByRole('link', { name: '今日の業務へ戻る' });
    await expect(backButton).toBeVisible();
    await backButton.click();

    // Should return to today hub
    await expect(page).toHaveURL(/\/today/);
  });
});
