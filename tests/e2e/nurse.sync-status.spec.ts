import { TESTIDS } from '@/testids';
import { expect, test } from '@playwright/test';
import { setupNurseFlags } from './_helpers/setupNurse.flags';

test.describe('@ci-smoke nurse sync telemetry', () => {
  test.beforeEach(async ({ page }) => {
    await setupNurseFlags(page);
  });

  test('queued observation flushes when returning online', async ({ page }) => {
    const created: unknown[] = [];

    await page.route('**/api/sp/lists/**', async (route) => {
      const request = route.request();
      const method = request.method().toUpperCase();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: [] }),
        });
        return;
      }
      if (method === 'POST') {
        const raw = request.postData() ?? '';
        try {
          created.push(JSON.parse(raw));
        } catch {
          created.push(raw);
        }
        await route.fulfill({
          status: 201,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: created.length }),
        });
        return;
      }
      if (method === 'PATCH') {
        await route.fulfill({
          status: 204,
          headers: { 'Content-Type': 'application/json' },
          body: '',
        });
        return;
      }
      await route.fulfill({ status: 204, headers: { 'Content-Type': 'application/json' }, body: '' });
    });

    await page.goto('/nurse/observation?user=I022&hud=1');

    const statusLocator = page.getByTestId(TESTIDS.NURSE_SYNC_STATUS);
    await expect(statusLocator).toHaveAttribute('role', 'status');
  await expect(statusLocator).toContainText(/同期履歴なし|同期/i);

    // Verify HUD is visible when enabled via query parameter
    await expect(page.getByTestId(TESTIDS.NURSE_SYNC_HUD)).toBeVisible();
    await expect(page.getByTestId(TESTIDS.NURSE_SYNC_MINUTE_LABEL)).toBeVisible();

    await page.getByTestId(TESTIDS.NURSE_MEMO_TOGGLE).click();
    await page.getByTestId(TESTIDS.NURSE_OBS_MEMO).locator('textarea').first().fill('オンライン復帰同期の確認');
    await page.getByTestId(TESTIDS.NURSE_OBS_SAVE).click();
    await expect(page.getByRole('alert')).toContainText(/保存しました|queued|同期/i);

    await page.evaluate(() => {
      window.dispatchEvent(new Event('online'));
    });

    await expect.poll(() => created.length).toBeGreaterThan(0);
    await expect(page.getByRole('alert')).toContainText(/オンライン復帰: (一部同期|\d+件同期済み)/);
    await expect(statusLocator).toHaveText(/オンライン復帰同期：.*（\d{2}:\d{2}）/);

    const remainingQueue = await page.evaluate(() => {
      const raw = window.localStorage.getItem('nurse.queue.v2');
      if (!raw) return 0;
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.length : 0;
      } catch {
        return 0;
      }
    });
    expect(remainingQueue).toBe(0);
  });
});
