import { TESTIDS } from '@/testids';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { setupNurseFlags } from './_helpers/setupNurse.flags';
import { gotoNurseBulk } from './nurse/_helpers/bulk';

const SHAREPOINT_ROUTE = '**/api/sp/lists/**';
const TARGET_USERS = ['I015', 'I022', 'I031', 'I044'] as const;

const fillQueuedRows = async (page: Page) => {
  for (let index = 0; index < TARGET_USERS.length; index += 1) {
    const userId = TARGET_USERS[index];
    await page.getByTestId(`${TESTIDS.NURSE_BULK_FIELD_PREFIX}-temp-${userId}`).fill((36.5 + index).toFixed(1));
    await page.keyboard.press('Enter');
  }
};

test.describe('Nurse bulk rows reflect partial/error summaries', () => {
  test.beforeEach(async ({ page }) => {
    await setupNurseFlags(page, { bulk: true });
    await page.route(SHAREPOINT_ROUTE, async (route) => {
      const request = route.request();
      const method = request.method().toUpperCase();
      if (method === 'GET') {
        await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: [] }) });
        return;
      }
      if (method === 'POST') {
        await route.fulfill({ status: 201, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 1 }) });
        return;
      }
      if (method === 'PATCH') {
        await route.fulfill({ status: 204, headers: { 'Content-Type': 'application/json' }, body: '' });
        return;
      }
      await route.fulfill({ status: 204, headers: { 'Content-Type': 'application/json' }, body: '' });
    });
    await gotoNurseBulk(page);
  });

  test('partial summary applies per-row status markers', async ({ page }) => {
    await expect(page.getByTestId(TESTIDS.NURSE_BULK_SHORTCUT_HINT)).toBeVisible();
    await expect(page.getByTestId(TESTIDS.NURSE_BULK_STATUS_LEGEND)).toBeVisible();

    await fillQueuedRows(page);

    for (const userId of TARGET_USERS) {
      await expect(page.getByTestId(`${TESTIDS.NURSE_BULK_STATUS_PREFIX}-${userId}`)).toHaveAttribute('data-status', 'queued');
    }

    await page.evaluate((mode) => {
      (window as typeof window & { __MSW_NURSE_MODE__?: typeof mode }).__MSW_NURSE_MODE__ = mode;
    }, 'partial' as const);

    await page.keyboard.press('Alt+S');

    await expect(page.getByTestId(TESTIDS.NURSE_SYNC_ANNOUNCE)).toContainText('一部同期');

    const expectations: Record<typeof TARGET_USERS[number], 'ok' | 'partial'> = {
      I015: 'partial',
      I022: 'ok',
      I031: 'ok',
      I044: 'partial',
    };

    for (const userId of TARGET_USERS) {
      const statusCell = page.getByTestId(`${TESTIDS.NURSE_BULK_STATUS_PREFIX}-${userId}`);
      await expect(statusCell).toHaveAttribute('data-status', expectations[userId]);
      await expect(page.getByTestId(`${TESTIDS.NURSE_BULK_ROW_PREFIX}-${userId}`)).toHaveAttribute('data-status', expectations[userId]);
    }
  });

  test('error summary marks queued rows as error and announces failure', async ({ page }) => {
    await fillQueuedRows(page);

    await page.evaluate((mode) => {
      (window as typeof window & { __MSW_NURSE_MODE__?: typeof mode }).__MSW_NURSE_MODE__ = mode;
    }, 'error' as const);

    await page.keyboard.press('Alt+S');

    await expect(page.getByTestId(TESTIDS.NURSE_SYNC_ANNOUNCE)).toContainText('エラー');

    const errorTargets = TARGET_USERS.slice(0, 2);
    for (const userId of errorTargets) {
      const statusCell = page.getByTestId(`${TESTIDS.NURSE_BULK_STATUS_PREFIX}-${userId}`);
      await expect(statusCell).toHaveAttribute('data-status', 'error');
      await expect(page.getByTestId(`${TESTIDS.NURSE_BULK_ROW_PREFIX}-${userId}`)).toHaveAttribute('data-status', 'error');
    }
  });
});
