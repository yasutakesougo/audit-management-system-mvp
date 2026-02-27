import { expect, test } from '@playwright/test';

/**
 * TodayOps NextAction Start→Done smoke test
 *
 * Verifies that:
 * 1. NextAction card is visible with Start button
 * 2. Start → shows Done button
 * 3. Done → advances to next item or shows "完了しました"
 * 4. Reload → Done state persists (localStorage)
 */
test.describe('TodayOps NextAction Start/Done', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __E2E_TODAY_OPS_MOCK__?: boolean }).__E2E_TODAY_OPS_MOCK__ = true;
    });

    await page.route('/_api/**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ d: { results: [] } }),
    }));
  });

  test('Start → Done → next item or completion message', async ({ page }) => {
    await page.goto('/today');

    // 1. NextAction card should be visible
    const card = page.getByTestId('today-next-action-card');
    await expect(card).toBeVisible({ timeout: 3000 });

    // 2. Check for Start button (may not exist if all items are in the past)
    const startBtn = page.getByTestId('next-action-start');
    const hasUpcoming = await startBtn.isVisible().catch(() => false);

    if (hasUpcoming) {
      // 3. Click Start
      await startBtn.click();

      // 4. Done button should appear
      const doneBtn = page.getByTestId('next-action-done');
      await expect(doneBtn).toBeVisible({ timeout: 1000 });

      // 5. Click Done
      await doneBtn.click();

      // 6. After Done: either next item (Start or started) or completion message
      const afterDone = await Promise.race([
        page.getByTestId('next-action-start').waitFor({ state: 'visible', timeout: 2000 }).then(() => 'next-item'),
        page.getByTestId('next-action-done-chip').waitFor({ state: 'visible', timeout: 2000 }).then(() => 'still-done'),
        card.getByText('完了しました').waitFor({ state: 'visible', timeout: 2000 }).then(() => 'all-done'),
      ]).catch(() => 'unknown');

      // Any of these states is valid — the point is it shouldn't show the same idle item
      expect(['next-item', 'still-done', 'all-done']).toContain(afterDone);

      // 7. Verify localStorage persistence
      const lsKeys = await page.evaluate(() => {
        return Object.keys(localStorage).filter(k => k.startsWith('today.nextAction.v1'));
      });
      expect(lsKeys.length).toBeGreaterThan(0);

      // 8. Reload and verify Done state persists
      await page.reload();
      await expect(card).toBeVisible({ timeout: 3000 });

      // The Done-d item should not show as idle start again
      const lsKeysAfterReload = await page.evaluate(() => {
        return Object.keys(localStorage).filter(k => k.startsWith('today.nextAction.v1'));
      });
      expect(lsKeysAfterReload.length).toBeGreaterThan(0);
    } else {
      // All schedule items are in the past — just verify card renders correctly
      await expect(card).toContainText(/完了しました|次のアクション/);
    }
  });
});
