import '@/test/captureSp400';
import { expect, test, type Page } from '@playwright/test';

import { bootSchedule } from './_helpers/bootSchedule';
import { gotoOrg } from './utils/scheduleNav';

const TARGET_DATE = new Date('2025-11-14');

type OrgFilterKey = 'all' | 'main' | 'shortstay' | 'respite' | 'other';

const getOrgParam = (page: Page): string | null => new URL(page.url()).searchParams.get('org');

// Tab name patterns for both Japanese and English
const TAB_NAMES = {
  WEEK: /週|Week/i,
  MONTH: /月|Month/i,
  DAY: /日|Day/i,
} as const;

const selectOrgInTab = async (page: Page, value: OrgFilterKey) => {
  // Ensure org tab is active (use testid for reliability)
  const orgTab = page.getByTestId('schedule-tab-org');
  await orgTab.click();
  await expect(orgTab).toHaveAttribute('aria-selected', 'true', { timeout: 5000 });
  
  // Select option
  const select = page.getByTestId('schedule-org-select');
  await expect(select).toBeVisible({ timeout: 5000 });
  await select.selectOption(value);
  
  // Wait for URL update
  await page.waitForURL((url) => new URL(url).searchParams.get('org') === (value === 'all' ? null : value), { timeout: 5000 });
};

test.describe('Schedule org query param contract', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (message) => {
      if (message.type() === 'info' && message.text().startsWith('[schedulesClient] fixtures=')) {
        // eslint-disable-next-line no-console
        console.log(`browser-console: ${message.text()}`);
      }
    });

    // Boot schedule with WeekV1 (org tab only exists in v1)
    await bootSchedule(page, { date: TARGET_DATE, enableWeekV2: false });
    await gotoOrg(page, { date: TARGET_DATE });
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    
    // Verify org tab is ready - use testid as fallback
    const orgTab = page.getByTestId('schedule-tab-org');
    await expect(orgTab).toBeVisible({ timeout: 10000 });
    await expect(orgTab).toHaveAttribute('aria-selected', 'true', { timeout: 10000 });
    
    // Verify select is ready
    const select = page.getByTestId('schedule-org-select');
    await expect(select).toBeVisible({ timeout: 10000 });
  });

  test('org param is absent when no org selected on Org tab', async ({ page }) => {
    expect(getOrgParam(page)).toBeNull();
    const select = page.getByTestId('schedule-org-select');
    await expect(select).toBeVisible();
  });

  test('org param reflects Org tab selection and clears on all', async ({ page }) => {
    await selectOrgInTab(page, 'shortstay');
    // Contract A: URL is the source of truth.
    // Note: value may be normalized (e.g., legacy alias -> canonical org key).
    expect(getOrgParam(page)).toBe('shortstay');
    await expect(page).toHaveURL(/org=shortstay/);

    await selectOrgInTab(page, 'all');
    expect(getOrgParam(page)).toBeNull();
    await expect(page).not.toHaveURL(/org=/);
  });

  test('org param persists when switching between week, month, and day tabs', async ({ page }) => {
    await selectOrgInTab(page, 'respite');
    expect(getOrgParam(page)).toBe('respite');
    await expect(page).toHaveURL(/org=respite/);

    // Switch to week tab
    const weekTab = page.getByRole('tab', { name: TAB_NAMES.WEEK });
    await weekTab.click();
    await expect(weekTab).toHaveAttribute('aria-selected', 'true');
    expect(getOrgParam(page)).toBe('respite');
    await expect(page).toHaveURL(/org=respite/);

    // Switch to month tab
    const monthTab = page.getByRole('tab', { name: TAB_NAMES.MONTH });
    await monthTab.click();
    await expect(monthTab).toHaveAttribute('aria-selected', 'true');
    expect(getOrgParam(page)).toBe('respite');
    await expect(page).toHaveURL(/org=respite/);

    // Switch to day tab
    const dayTab = page.getByRole('tab', { name: TAB_NAMES.DAY });
    await dayTab.click();
    await expect(dayTab).toHaveAttribute('aria-selected', 'true');
    expect(getOrgParam(page)).toBe('respite');
    await expect(page).toHaveURL(/org=respite/);
  });
});
