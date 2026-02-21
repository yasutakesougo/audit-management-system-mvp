import { expect, test } from '@playwright/test';

import { expectTestIdVisibleBestEffort } from './_helpers/smoke';
import { bootstrapDashboard } from './utils/bootstrapApp';

const TABLE_DAILY_DRAFT_STORAGE_KEY = 'daily-table-record:draft:v1';
const PDCA_DAILY_METRICS_STORAGE_KEY = 'pdca:daily-submission-events:v1';

test.describe('daily -> PDCA integration', () => {
  test('daily submit is reflected in PDCA metrics cards', async ({ page }) => {
    await bootstrapDashboard(page, {
      skipLogin: true,
      featureSchedules: true,
      featureIcebergPdca: true,
      initialPath: '/daily/table',
    });

    await page.evaluate(([draftStorageKey, metricsStorageKey]) => {
      localStorage.removeItem(draftStorageKey);
      localStorage.removeItem(metricsStorageKey);

      localStorage.setItem(draftStorageKey, JSON.stringify({
        formData: {
          date: new Date().toISOString().slice(0, 10),
          reporter: { name: 'PDCA連携E2E', role: '生活支援員' },
          userRows: [],
        },
        selectedUserIds: ['e2e-pdca-user'],
        searchQuery: '',
        showTodayOnly: true,
        savedAt: new Date(Date.now() - 120000).toISOString(),
      }));
    }, [TABLE_DAILY_DRAFT_STORAGE_KEY, PDCA_DAILY_METRICS_STORAGE_KEY]);

    await page.reload();

    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    await page.getByRole('button', { name: /人分保存/ }).click();
    await expect(page).toHaveURL(/\/dashboard/);

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
      };
    }, PDCA_DAILY_METRICS_STORAGE_KEY);
    test.info().annotations.push({
      type: 'note',
      description: `pdca metrics snapshot: ${JSON.stringify(storedMetrics)}`,
    });

    await page.goto('/analysis/iceberg-pdca');
    await expect(page.getByTestId('iceberg-pdca-root')).toBeVisible();

    await expectTestIdVisibleBestEffort(page, 'pdca-daily-completion-card');
    await expectTestIdVisibleBestEffort(page, 'pdca-daily-leadtime-card');
  });
});
