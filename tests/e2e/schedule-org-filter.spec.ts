import '@/test/captureSp400';
import { expect, test, type Page } from '@playwright/test';

import { bootSchedule } from './_helpers/bootSchedule';
import { gotoOrg } from './utils/scheduleNav';

const TARGET_DATE = new Date('2025-11-14');

type OrgFilterKey = 'all' | 'main' | 'shortstay' | 'respite' | 'other';

const getOrgParam = (page: Page): string | null => new URL(page.url()).searchParams.get('org');

const selectOrgInTab = async (page: Page, value: OrgFilterKey) => {
  const orgTab = page.getByRole('tab', { name: '事業所別' });
  await orgTab.click();
  const select = page.getByTestId('schedule-org-select');
  await expect(select).toBeVisible();
  await select.selectOption(value);
};

test.describe('Schedule org query param contract', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (message) => {
      if (message.type() === 'info' && message.text().startsWith('[schedulesClient] fixtures=')) {
        // eslint-disable-next-line no-console
        console.log(`browser-console: ${message.text()}`);
      }
    });

    await bootSchedule(page, { date: TARGET_DATE, enableWeekV2: false });
    await gotoOrg(page, { date: TARGET_DATE });
  });

  test('org param is absent when no org selected on Org tab', async ({ page }) => {
    expect(getOrgParam(page)).toBeNull();
    const select = page.getByTestId('schedule-org-select');
    await expect(select).toBeVisible();
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
