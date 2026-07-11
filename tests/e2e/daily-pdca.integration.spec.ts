import { expect, type Page, test } from '@playwright/test';

import { expectTestIdVisibleBestEffort } from './_helpers/smoke';
import {
  bootDailyTablePage,
  DAILY_TABLE_E2E_DATE,
  DAILY_TABLE_E2E_USER_ID,
  PDCA_DAILY_METRICS_STORAGE_KEY,
} from './_helpers/bootDailyTablePage';

async function waitForIcebergPdcaReady(page: Page): Promise<void> {
  await page.goto('/analysis/iceberg-pdca', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/analysis\/iceberg-pdca/);

  const root = page.getByTestId('iceberg-pdca-root');
  await expect(root).toBeAttached({ timeout: 30_000 });
  await expect(root).toBeVisible({ timeout: 30_000 });
}

test.describe('daily -> PDCA integration', () => {
  test('daily submit is reflected in PDCA metrics cards', async ({ page }) => {
    await bootDailyTablePage(page, {
      featureIcebergPdca: true,
      path: `/daily/table?date=${DAILY_TABLE_E2E_DATE}`,
      draft: {
        reporterName: 'PDCA連携E2E',
        selectedUserIds: [DAILY_TABLE_E2E_USER_ID],
        savedAt: new Date(Date.now() - 120000).toISOString(),
      },
    });

    await expect(page.getByTestId('daily-table-record-form')).toBeVisible({ timeout: 15_000 });

    const reporterNameInput = page.getByPlaceholder('記録者');
    await expect(reporterNameInput).toBeVisible();
    if ((await reporterNameInput.inputValue()).trim().length === 0) {
      await reporterNameInput.fill('PDCA連携E2E');
    }

    const table = page.getByTestId('daily-table-record-form-table');
    await expect(table).toBeVisible();
    await table.getByPlaceholder('午前').first().fill('PDCA 午前活動');
    await table.getByPlaceholder('午後').first().fill('PDCA 午後活動');
    await table.getByPlaceholder('特記').first().fill('PDCA metrics E2E');

    const saveButton = page.getByRole('button', { name: /^\d+人分保存$/ });
    if (await saveButton.isDisabled()) {
      await page.getByRole('button', { name: '表示中の利用者を全選択' }).click();
    }
    await expect(saveButton).toBeEnabled();

    await saveButton.click({ force: true });
    await expect.poll(() => new URL(page.url()).pathname).toMatch(/^\/today$/);

    const storedMetrics = await page.evaluate((metricsStorageKey) => {
      const raw = localStorage.getItem(metricsStorageKey);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as Record<string, { userId: string; recordDate: string }>;
      const events = Object.values(parsed);
      return {
        count: events.length,
        firstUserId: events[0]?.userId,
        firstRecordDate: events[0]?.recordDate,
      };
    }, PDCA_DAILY_METRICS_STORAGE_KEY);

    expect(storedMetrics).toMatchObject({
      count: 1,
      firstUserId: DAILY_TABLE_E2E_USER_ID,
      firstRecordDate: DAILY_TABLE_E2E_DATE,
    });

    test.info().annotations.push({
      type: 'note',
      description: `pdca metrics snapshot: ${JSON.stringify(storedMetrics)}`,
    });

    await waitForIcebergPdcaReady(page);

    await expectTestIdVisibleBestEffort(page, 'pdca-daily-completion-card');
    await expectTestIdVisibleBestEffort(page, 'pdca-daily-leadtime-card');
  });
});
