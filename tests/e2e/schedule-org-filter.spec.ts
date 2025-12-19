import '@/test/captureSp400';
import { expect, test, type Page } from '@playwright/test';

import { bootSchedule } from './_helpers/bootSchedule';

const TARGET_DATE = new Date('2025-11-14');
const TARGET_DATE_STRING = '2025-11-14';

type OrgFilterKey = 'all' | 'main' | 'shortstay' | 'respite' | 'other';

const getOrgParam = (page: Page): string | null => new URL(page.url()).searchParams.get('org');

const selectOrgInTab = async (page: Page, value: OrgFilterKey) => {
  const orgTab = page.getByRole('tab', { name: '事業所別' });
  await expect(orgTab).toBeVisible({ timeout: 15_000 });
  await orgTab.click({ timeout: 10_000 });
  await expect(orgTab).toHaveAttribute('aria-selected', /true/i);

  const select = page.getByTestId('schedule-org-select');
  await expect(select).toBeVisible({ timeout: 15_000 });
  await select.selectOption(value);

  if (value !== 'all') {
    await expect(page).toHaveURL(new RegExp(`org=${value}`), { timeout: 10_000 });
  }
};

const waitForOrgTab = async (page: Page) => {
  const heading = page.getByRole('heading', { level: 1, name: /スケジュール/ });
  await expect(heading).toBeVisible({ timeout: 15_000 });

  const tablist = page.getByRole('tablist').first();
  await expect(tablist).toBeVisible({ timeout: 15_000 });

  const orgTab = page.getByTestId('schedule-tab-org').or(tablist.getByRole('tab', { name: /事業所|Org/ }));
  await expect(orgTab).toBeVisible({ timeout: 15_000 });
  await orgTab.click({ timeout: 10_000 });
  await expect(orgTab).toHaveAttribute('aria-selected', /true/i);

  await expect(page.getByTestId('schedule-org-tab')).toBeVisible({ timeout: 15_000 });
};

test.describe('Schedule org query param contract', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (message) => {
      if (message.type() === 'info' && message.text().startsWith('[schedulesClient] fixtures=')) {
        // eslint-disable-next-line no-console
        console.log(`browser-console: ${message.text()}`);
      }
    });

    await bootSchedule(page, {
      date: TARGET_DATE,
      enableWeekV2: false,
      autoNavigate: true,
      route: `/schedules/week?date=${TARGET_DATE_STRING}&tab=org`,
    });
    await page.waitForLoadState('networkidle');
    await waitForOrgTab(page);
  });

  test('org param is absent when no org selected on Org tab', async ({ page }) => {
    expect(getOrgParam(page)).toBeNull();
    const select = page.getByTestId('schedule-org-select');
    await expect(select).toBeVisible({ timeout: 15_000 });
  });

  test('org param reflects Org tab selection and clears on all', async ({ page }) => {
    await selectOrgInTab(page, 'shortstay');
    expect(getOrgParam(page)).toBe('shortstay');
    await expect(page).toHaveURL(/org=shortstay/);

    await selectOrgInTab(page, 'all');
    expect(getOrgParam(page)).toBeNull();
    await expect(page).not.toHaveURL(/org=/);
  });
});
