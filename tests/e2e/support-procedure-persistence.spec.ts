import { test, expect } from '@playwright/test';
import { TESTIDS } from '../../src/testing/testids';

const ROUTE = '/records/support-procedures';

test.describe('Support Procedure Persistence', () => {
  test('should persist daily records in localStorage', async ({ page }) => {
    await page.goto(ROUTE);

    // 1. Select a user
    await page.getByText('User A').click();
    await expect(page.getByText('記録サマリー - User A')).toBeVisible();

    // 2. Make a change
    const firstAccordion = page.locator('.MuiAccordion-root').first();
    await firstAccordion.click();
    const notesInput = firstAccordion.getByLabel('特記事項');
    await notesInput.fill('Test note');
    await page.getByTestId(TESTIDS.supportProcedures.form.save).click();

    // 3. Reload the page
    await page.reload();

    // 4. Verify the change is still there
    await page.getByText('User A').click();
    await expect(page.getByText('記録サマリー - User A')).toBeVisible();
    
    const firstAccordionAfterReload = page.locator('.MuiAccordion-root').first();
    await firstAccordionAfterReload.click();
    const notesInputAfterReload = firstAccordionAfterReload.getByLabel('特記事項');
    await expect(notesInputAfterReload).toHaveValue('Test note');
  });
});
