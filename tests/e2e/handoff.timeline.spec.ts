import { expect, test } from '@playwright/test';

/**
 * Validates that the global "今すぐ申し送り" button dispatches the inline
 * quick-note open event while visiting /handoff-timeline.
 */
test.describe('Handoff Timeline footer quick note', () => {
  test('footer button opens inline quick note card', async ({ page }) => {
    const consoleErrors: string[] = [];
    const allowlistedConsolePatterns = [/\[MSAL CONFIG\]/, /\[firebase-auth\]/, /auth\/invalid-api-key/];
    page.on('console', (message) => {
      if (message.type() === 'error') {
        const text = message.text();
        if (allowlistedConsolePatterns.some((pattern) => pattern.test(text))) {
          return;
        }
        consoleErrors.push(`[console] ${text}`);
      }
    });
    page.on('pageerror', (error) => {
      consoleErrors.push(`[pageerror] ${error.message}`);
    });

    await page.goto('/handoff-timeline');

    // Collapse the inline quick note card to ensure the event path is required.
    const closeButton = page.getByRole('button', { name: '申し送り入力カードを閉じる' });
    if (await closeButton.isVisible()) {
      await closeButton.click();
    }

    const inlineQuickNoteOpenButton = page.getByRole('button', { name: '今すぐ申し送り入力カードを開く' });
    await expect(inlineQuickNoteOpenButton).toBeVisible();

    // Trigger the footer quick action, which should dispatch the custom event.
    await page.getByTestId('handoff-footer-quicknote').click();

    await expect(inlineQuickNoteOpenButton).toBeHidden();

    expect(consoleErrors).toEqual([]);
  });
});
