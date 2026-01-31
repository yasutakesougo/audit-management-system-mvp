import '@/test/captureSp400';
import { expect, test, type Page } from '@playwright/test';

import { bootSchedule } from './_helpers/bootSchedule';
import { gotoWeek } from './utils/scheduleNav';
import { getOrgChipText } from './utils/scheduleActions';
import { waitForDayTimeline, waitForMonthTimeline, waitForWeekTimeline } from './utils/wait';

const TARGET_DATE = new Date('2025-11-14');

type OrgFilterKey = 'all' | 'main' | 'shortstay' | 'respite' | 'other';

const ORG_LABELS: Record<OrgFilterKey, string> = {
  all: '全事業所（統合ビュー）',
  main: '生活介護（本体）',
  shortstay: '短期入所',
  respite: '一時ケア',
  other: 'その他（将来拡張）',
};

const selectOrg = async (page: Page, value: OrgFilterKey) => {
  const orgTab = page.getByRole('tab', { name: '事業所別' });
  await orgTab.click();
  const select = page.getByTestId('schedule-org-select');
  await expect(select).toBeVisible();
  await select.selectOption(value);
  await expect(page).toHaveURL(new RegExp(`org=${value}`));
};

type TimelineView = 'week' | 'day' | 'month';

const assertOrgChip = async (page: Page, view: TimelineView, org: OrgFilterKey, expectedCount?: number) => {
  const chipText = await getOrgChipText(page, view);
  expect(chipText).toContain(ORG_LABELS[org]);
  if (typeof expectedCount === 'number') {
    expect(chipText).toContain(`${expectedCount}件`);
  }
};

const getOrgParam = (page: Page): string | null => new URL(page.url()).searchParams.get('org');

test.describe('Schedule week org filter', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (message) => {
      if (message.type() === 'info' && message.text().startsWith('[schedulesClient] fixtures=')) {
        // eslint-disable-next-line no-console
        console.log(`browser-console: ${message.text()}`);
      }
    });

    await bootSchedule(page, { date: TARGET_DATE });
  });

  // NOTE(e2e-skip): Organization filter (事業所別) tab not implemented in new /schedules UI.
  // TODO: Implement org filter in WeekPage.tsx or redirect tests to /schedule (singular) feature.
  // Repro: npx playwright test tests/e2e/schedule-org-filter.spec.ts --project=chromium --workers=1 --reporter=line
  test.skip('defaults to merged org view when org query param is absent', async ({ page }) => {
    await gotoWeek(page, TARGET_DATE);
    await waitForWeekTimeline(page);

    await assertOrgChip(page, 'week', 'all', 5);
    expect(getOrgParam(page)).toBeNull();
  });

  // NOTE(e2e-skip): Organization filter (事業所別) tab not implemented in new /schedules UI.
  // TODO: Implement org filter in WeekPage.tsx or redirect tests to /schedule (singular) feature.
  // Repro: npx playwright test tests/e2e/schedule-org-filter.spec.ts --project=chromium --workers=1 --reporter=line
  test.skip('keeps selected org when navigating weeks', async ({ page }) => {
    await gotoWeek(page, TARGET_DATE);
    await waitForWeekTimeline(page);

    await selectOrg(page, 'shortstay');

    const weekTab = page.getByRole('tab', { name: '週' });
    await weekTab.click();
    await waitForWeekTimeline(page);

    await assertOrgChip(page, 'week', 'shortstay');
    expect(getOrgParam(page)).toBe('shortstay');

    const initialChipText = await getOrgChipText(page, 'week');
    expect(initialChipText).toContain(ORG_LABELS.shortstay);

    await page.getByRole('button', { name: '次の期間' }).click();
    await waitForWeekTimeline(page);
    const indicatorAfterNextText = await getOrgChipText(page, 'week');
    expect(indicatorAfterNextText).toContain(ORG_LABELS.shortstay);
    expect(getOrgParam(page)).toBe('shortstay');

    await page.getByRole('button', { name: '前の期間' }).click();
    await waitForWeekTimeline(page);
    const indicatorAfterPrevText = await getOrgChipText(page, 'week');
    expect(indicatorAfterPrevText).toContain(ORG_LABELS.shortstay);
    expect(getOrgParam(page)).toBe('shortstay');
  });

  // NOTE(e2e-skip): Organization filter (事業所別) tab not implemented in new /schedules UI.
  // TODO: Implement org filter in WeekPage.tsx or redirect tests to /schedule (singular) feature.
  // Repro: npx playwright test tests/e2e/schedule-org-filter.spec.ts --project=chromium --workers=1 --reporter=line
  test.skip('preserves org selection across week, month, and day tabs', async ({ page }) => {
    await gotoWeek(page, TARGET_DATE);
    await waitForWeekTimeline(page);

    await selectOrg(page, 'respite');

    const weekTab = page.getByRole('tab', { name: '週' });
    await weekTab.click();
    await waitForWeekTimeline(page);
    await assertOrgChip(page, 'week', 'respite', 2);
    expect(getOrgParam(page)).toBe('respite');

    const monthTab = page.getByRole('tab', { name: '月' });
    await monthTab.click();
    await waitForMonthTimeline(page);
    await assertOrgChip(page, 'month', 'respite', 2);
    expect(getOrgParam(page)).toBe('respite');

    const dayTab = page.getByRole('tab', { name: '日' });
    await dayTab.click();
    await waitForDayTimeline(page);
    await assertOrgChip(page, 'day', 'respite', 2);
    expect(getOrgParam(page)).toBe('respite');
  });
});
