import '@/test/captureSp400';
import { expect, test, type Page } from '@playwright/test';
import { gotoOrg } from './utils/scheduleNav';

const setupEnv = {
  env: {
    VITE_E2E_MSAL_MOCK: '1',
    VITE_SKIP_LOGIN: '1',
    VITE_FEATURE_SCHEDULES: '1',
    VITE_FEATURE_SCHEDULES_WEEK_V2: '1',
  },
  storage: {
    'feature:schedules': '1',
    skipLogin: '1',
    'feature:schedulesWeekV2': 'true',
  },
} as const;

const waitForOrgTab = async (page: Page): Promise<void> => {
  const heading = page.getByRole('heading', { level: 1, name: /スケジュール/ });
  await expect(heading).toBeVisible({ timeout: 15_000 });

  const tablist = page.getByRole('tablist').first();
  await expect(tablist).toBeVisible({ timeout: 15_000 });

  const orgTab = page.getByTestId('schedule-tab-org').or(tablist.getByRole('tab', { name: /事業所|Org/ }));
  const exists = (await orgTab.count().catch(() => 0)) > 0;
  test.skip(!exists, 'Org tab is not available in this build/flag set.');

  await expect(orgTab).toBeVisible({ timeout: 15_000 });
  await orgTab.click({ timeout: 10_000 });
  await expect(orgTab).toHaveAttribute('aria-selected', /true/i);

  await expect(page.getByTestId('schedule-org-tab')).toBeVisible({ timeout: 15_000 });
};

const TARGET_DATE = new Date('2025-11-24');

test.describe('Schedules Org Tab (Smoke)', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (message) => {
      if (message.type() === 'info' && message.text().startsWith('[schedulesClient] fixtures=')) {
        // Echo fixture-mode logs to the Playwright reporter output for quick diagnosis.
        // eslint-disable-next-line no-console
        console.log(`browser-console: ${message.text()}`);
      }
    });

    await page.addInitScript(({ env, storage }) => {
      const scope = window as typeof window & { __ENV__?: Record<string, string> };
      scope.__ENV__ = {
        ...(scope.__ENV__ ?? {}),
        ...env,
      };
      for (const [key, value] of Object.entries(storage)) {
        window.localStorage.setItem(key, value);
      }
    }, setupEnv);
  });

  test('shows Org tab selector and summary', async ({ page }) => {
    await gotoOrg(page, { date: TARGET_DATE });
    await waitForOrgTab(page);

    const panel = page.getByTestId('schedule-org-tab');
    const select = page.getByTestId('schedule-org-select');
    const summary = page.getByTestId('schedule-org-summary');

    await expect(panel.getByRole('heading', { name: '事業所別スケジュール（準備中）' })).toBeVisible();
    await expect(select).toHaveValue('all');
    await expect(summary).toContainText('全事業所（統合ビュー）');

    await select.selectOption('main');
    await expect(page).toHaveURL(/org=main/);
    await expect(summary).toContainText('生活介護（本体）');
  });

  test('restores selection from org URL param', async ({ page }) => {
    await gotoOrg(page, { date: TARGET_DATE, org: 'shortstay' });
    await waitForOrgTab(page);

    const select = page.getByTestId('schedule-org-select');
    const summary = page.getByTestId('schedule-org-summary');

    await expect(select).toHaveValue('shortstay');
    await expect(summary).toContainText('短期入所');
  });
});
