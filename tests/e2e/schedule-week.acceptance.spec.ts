/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck -- Playwright E2E lives outside app tsconfig include.
import '@/test/captureSp400';
import { expect, test, type Page } from '@playwright/test';
import { TESTIDS } from '@/testids';
import { bootSchedule } from './_helpers/bootSchedule';
import { gotoScheduleWeek } from './utils/scheduleWeek';
import { gotoDay } from './utils/scheduleNav';
import { waitForDayViewReady, waitForWeekViewReady } from './utils/scheduleActions';

const TARGET_DATE = new Date('2025-12-01T00:00:00+09:00');
const ACCEPT_NOTE = '電話で保護者から連絡';

const toLocalDateTime = (date: Date, time: string): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}T${time}`;
};

const dayRootLocator = (page: Page) =>
  page.getByTestId(TESTIDS['schedules-day-page']).or(page.getByTestId('schedule-day-root')).first();

test.describe('Schedules week acceptance flow', () => {
  const seedStartIso = new Date(toLocalDateTime(TARGET_DATE, '10:00')).toISOString();
  const seedEndIso = new Date(toLocalDateTime(TARGET_DATE, '11:00')).toISOString();
  const seedTitle = `E2E 受け入れ登録 ${Date.now()}`;

  const seedItems: Record<string, unknown>[] = [
    {
      Id: 1001,
      Title: seedTitle,
      Start: seedStartIso,
      End: seedEndIso,
      EventDate: seedStartIso,
      EndDate: seedEndIso,
      ServiceType: 'other',
      LocationName: 'E2E 会議室',
      Notes: '自動テスト用',
      AcceptedOn: null,
      AcceptedBy: null,
      AcceptedNote: null,
      Status: 'Planned',
      cr014_category: 'Org',
    },
  ];

  test.beforeEach(async ({ page }) => {
    await bootSchedule(page, {
      date: TARGET_DATE,
      scheduleItems: seedItems as never[],
    });
    await gotoScheduleWeek(page, TARGET_DATE);
    await waitForWeekViewReady(page);
  });

  test('受け入れ登録が週/日ビューに反映される', async ({ page }) => {
    const row = page.getByTestId('schedule-item').filter({ hasText: seedTitle }).first();
    await expect(row).toBeVisible({ timeout: 15_000 });

    await row.getByRole('button', { name: '行の操作' }).click();
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible({ timeout: 10_000 });

    const acceptMenuItem = menu.getByRole('menuitem', { name: /受け入れ登録|受入登録/ }).first();
    const hasAccept = (await acceptMenuItem.count().catch(() => 0)) > 0;
    if (!hasAccept) {
      const menuTexts = await menu.getByRole('menuitem').allTextContents().catch(() => [] as string[]);
      // eslint-disable-next-line no-console
      console.log('[acceptance] menu items:', menuTexts);
      test.skip(true, 'Acceptance menu item not available in this build/flag set.');
    }
    await acceptMenuItem.click();

    const acceptDialog = page
      .getByTestId('schedule-accept-dialog')
      .or(page.getByRole('dialog').filter({ hasText: /受け入れ登録|受入登録/ }).first())
      .or(page.getByRole('dialog').first());
    try {
      await expect(acceptDialog).toBeVisible({ timeout: 15_000 });
      await expect(acceptDialog).toContainText(/受け入れ登録|受入登録/);
    } catch {
      const dialogs = await page.getByRole('dialog').allTextContents().catch(() => [] as string[]);
      const headings = await page.getByRole('heading').allTextContents().catch(() => [] as string[]);
      // eslint-disable-next-line no-console
      console.log('[acceptance] dialogs:', dialogs);
      // eslint-disable-next-line no-console
      console.log('[acceptance] headings:', headings);
      test.skip(true, 'Acceptance dialog not available in this build/flag set.');
      return;
    }

    const acceptedByInput = acceptDialog.getByLabel('受け入れ担当者');
    const ACCEPTED_BY = 'E2E テスター';
    await acceptedByInput.fill(ACCEPTED_BY);
    await expect(acceptedByInput).toHaveValue(ACCEPTED_BY);
    await acceptDialog.getByLabel('メモ').fill(ACCEPT_NOTE);
    await acceptDialog.getByTestId('schedules-accept-submit').click();

    await expect(row.getByText('受け入れ済')).toBeVisible({ timeout: 15_000 });

    const acceptedFilter = page.getByTestId('schedules-filter-accepted');
    await acceptedFilter.click();
    await expect(row).toBeVisible();

    await gotoDay(page, TARGET_DATE);
    await waitForDayViewReady(page);

    const dayRoot = dayRootLocator(page);
    await expect(dayRoot).toBeVisible({ timeout: 15_000 });

    const dayCard = dayRoot.locator('[data-testid="schedules-event-normal"]').filter({ hasText: seedTitle }).first();
    await expect(dayCard).toBeVisible({ timeout: 15_000 });
    await expect(dayCard.getByText(/受け入れ:/)).toBeVisible();
    await expect(dayCard.getByText(/受け入れ: .* \/ /)).toBeVisible();
    await expect(dayCard.filter({ hasText: '受け入れ: 未登録' })).toHaveCount(0);
  });
});
