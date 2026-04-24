/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck -- Playwright helpers live outside the main tsconfig include set.
import { expect, test } from '@playwright/test';

import { TESTIDS } from '@/testids';

import { bootstrapScheduleEnv } from './utils/scheduleEnv';
import { gotoDay } from './utils/scheduleNav';

const skipSp = process.env.VITE_SKIP_SHAREPOINT === '1' || process.env.VITE_FEATURE_SCHEDULES_SP === '0';

test.describe('Schedules day create flow (facility)', () => {
  test.skip(skipSp, 'SharePoint/SP disabled in this run');
  test('Week lane -> Day create defaults to facility', async ({ page }) => {
    page.on('console', msg => console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`));
    page.on('pageerror', err => console.log(`[BROWSER ERROR] ${err.message}`));

    await bootstrapScheduleEnv(page, {
      storage: { 'e2e:schedules.v1': JSON.stringify([]) },
    });

    const date = new Date('2026-02-10T00:00:00+09:00');
    await gotoDay(page, date, { searchParams: { lane: 'Org' } });

    // Diagnostic logging
    const env = await page.evaluate(() => (window as any).__ENV__);
    const size = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
    console.log('Runtime Env:', JSON.stringify(env, null, 2));
    console.log('Viewport Size:', size);

    await page.waitForURL(/\/schedules\/week/);
    await expect(page.getByTestId(TESTIDS.SCHEDULES_PAGE_ROOT)).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId(TESTIDS.SCHEDULES_HEADER_ROOT)).toBeVisible({ timeout: 10000 });
    // Wait for loading to finish
    await expect(page.locator('[aria-busy="true"]')).toBeHidden({ timeout: 15000 });

    const fabCta = page.getByTestId(TESTIDS.SCHEDULES_FAB_CREATE);
    const headerCta = page.getByTestId(TESTIDS.SCHEDULES_HEADER_CREATE);
    const textCta = page.getByRole('button', { name: /予定を追加/ });

    if (await fabCta.isVisible().catch(() => false)) {
      await fabCta.click();
    } else if (await headerCta.isVisible().catch(() => false)) {
      await headerCta.click();
    } else {
      await expect(textCta).toBeVisible({ timeout: 10000 });
      await textCta.click();
    }

    const dialog = page.getByTestId(TESTIDS['schedule-create-dialog']);
    await expect(dialog).toBeVisible();

    const categorySelect = dialog.getByTestId(TESTIDS['schedule-create-category-select']);
    await expect(categorySelect).toContainText('施設');

    const titleInput = dialog.getByTestId(TESTIDS['schedule-create-title']);
    try {
      await expect(titleInput).toBeFocused({ timeout: 3_000 });
    } catch {
      await titleInput.click();
      await expect(titleInput).toBeFocused();
    }
  });
});
