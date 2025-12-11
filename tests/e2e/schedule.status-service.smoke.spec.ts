/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck -- Playwright e2e specs live outside the primary tsconfig include path.
import '@/test/captureSp400';
import { expect, test } from '@playwright/test';
import { formatInTimeZone } from 'date-fns-tz';
import { TESTIDS } from '@/testids';
import { bootSchedule } from './_helpers/bootSchedule';
import { buildScheduleFixturesForDate, SCHEDULE_FIXTURE_BASE_DATE } from './utils/schedule.fixtures';
import { gotoWeek } from './utils/scheduleNav';
import {
  fillQuickUserCareForm,
  getWeekScheduleItems,
  openQuickUserCareDialog,
  openWeekEventCard,
  waitForWeekViewReady,
} from './utils/scheduleActions';
import { TIME_ZONE } from './utils/spMock';

const LIST_TITLE = 'Schedules_Master';
const TEST_DATE = new Date(SCHEDULE_FIXTURE_BASE_DATE);
const TEST_DAY_KEY = formatInTimeZone(TEST_DATE, TIME_ZONE, 'yyyy-MM-dd');

const buildLocalDateTime = (time: string) => `${TEST_DAY_KEY}T${time}`;

async function selectQuickServiceType(page, dialog, optionLabel: string | RegExp) {
  const select = dialog.getByTestId(TESTIDS['schedule-create-service-type']);
  await select.click();
  await page.getByRole('option', { name: optionLabel }).first().click();
  return select;
}

const buildScheduleItems = () => {
  const fixtures = buildScheduleFixturesForDate(TEST_DATE);
  const items = [...fixtures.User, ...fixtures.Staff, ...fixtures.Org].map((item) => ({ ...item }));

  const livingCare = items.find((item) => item.Id === 9101) ?? items.find((item) => item.cr014_category === 'User');
  if (livingCare) {
    livingCare.Title = '生活介護 午後ケア';
    livingCare.Status = '承認済み';
    livingCare.cr014_serviceType = '生活介護';
  }

  const legacyPending = items.find((item) => item.Id === 9102);
  if (legacyPending) {
    legacyPending.Status = '申請中';
  }

  return items;
};

const orgMasterFixtures = [
  {
    Id: 501,
    Title: '磯子区障害支援センター',
    OrgCode: 'ORG-ISO',
    OrgType: 'Center',
    Audience: 'Staff,User',
    SortOrder: 1,
    IsActive: true,
    Notes: 'E2E demo org',
  },
];

test.describe('Schedule dialog: status/service end-to-end', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (message) => {
      if (message.type() === 'info' && message.text().startsWith('[schedulesClient] fixtures=')) {
        // eslint-disable-next-line no-console
        console.log(`browser-console: ${message.text()}`);
      }
    });

    await bootSchedule(page, {
      env: {
        VITE_E2E_MSAL_MOCK: '1',
        VITE_SKIP_LOGIN: '1',
        VITE_FEATURE_SCHEDULES: '1',
        VITE_DEMO_MODE: '0',
        MODE: 'production',
        DEV: '0',
        VITE_SP_RESOURCE: 'https://contoso.sharepoint.com',
        VITE_SP_SITE_RELATIVE: '/sites/AuditSystem',
        VITE_SP_SCOPE_DEFAULT: 'https://contoso.sharepoint.com/AllSites.Read',
        VITE_FEATURE_SCHEDULES_SP: '1',
        VITE_FEATURE_SCHEDULES_GRAPH: '0',
        VITE_FORCE_SHAREPOINT: '1',
        VITE_SKIP_SHAREPOINT: '0',
        VITE_SCHEDULE_FIXTURES: '0',
        VITE_SCHEDULES_FIXTURES: '0',
      },
      sharePoint: {
        currentUser: { status: 200, body: { Id: 101 } },
        fallback: { status: 404, body: {} },
        lists: [
          {
            name: LIST_TITLE,
            aliases: ['Schedules', 'ScheduleEvents', 'SupportSchedule'],
            items: buildScheduleItems(),
            onUpdate: (_id, payload, ctx) => ({
              ...ctx.previous,
              ...(payload as Record<string, unknown>),
            }),
            onCreate: (payload, ctx) => {
              type ScheduleRecord = Record<string, unknown> & { Id: number; Status?: string };
              const record = {
                Id: ctx.takeNextId(),
                ...(payload as Record<string, unknown>),
              } as ScheduleRecord;
              const status = typeof record.Status === 'string' ? record.Status.trim() : '';
              if (!status) {
                record.Status = '予定';
              }
              return record;
            },
          },
          { name: 'Org_Master', items: orgMasterFixtures },
          { name: 'SupportRecord_Daily', items: [] },
          { name: 'StaffDirectory', items: [] },
        ],
      },
    });

    await page.addInitScript(() => {
      const resetKey = '__scheduleDraftsCleared__';
      if (!window.localStorage.getItem(resetKey)) {
        window.localStorage.removeItem('schedule.localDrafts.v1');
        window.localStorage.setItem(resetKey, '1');
      }
    });

    await page.route('**/login.microsoftonline.com/**', (route) => route.fulfill({ status: 204, body: '' }));
    await gotoWeek(page, TEST_DATE);
    await waitForWeekViewReady(page);
    const items = await getWeekScheduleItems(page);
    await expect(items.first()).toBeVisible();
  });

    test('edit living care event via quick dialog persists service type', async ({ page }) => {
      await gotoWeek(page, TEST_DATE);
      await waitForWeekViewReady(page);

      await openWeekEventCard(page, { category: 'User', index: 0 });

      let dialog = page.getByTestId(TESTIDS['schedule-create-dialog']);
      await expect(dialog).toBeVisible();

      const select = await selectQuickServiceType(page, dialog, /欠席/);
      await expect(select).toHaveText(/欠席/);

      await dialog.getByTestId(TESTIDS['schedule-create-save']).click();
      await expect(dialog).toBeHidden({ timeout: 10_000 });

      await page.reload();
      await gotoWeek(page, TEST_DATE);
      await waitForWeekViewReady(page);

      await openWeekEventCard(page, { category: 'User', index: 0 });
      dialog = page.getByTestId(TESTIDS['schedule-create-dialog']);
      await expect(dialog).toBeVisible();
      await expect(dialog.getByTestId(TESTIDS['schedule-create-service-type'])).toHaveText(/欠席/);

      await dialog.getByRole('button', { name: 'キャンセル' }).click();
      await expect(dialog).toBeHidden({ timeout: 10_000 });
    });

  test('create new 生活介護休み entry via quick dialog', async ({ page }) => {
    await gotoWeek(page, TEST_DATE);
    await waitForWeekViewReady(page);

    await openQuickUserCareDialog(page);
    await fillQuickUserCareForm(page, {
      title: '生活介護 休み',
      userInputValue: '田中',
      userOptionName: /田中/, // matches resident fixtures (田中 実)
      staffInputValue: '佐藤',
      staffOptionName: /佐藤/, // demo staff fixture: 佐藤 花子
      serviceOptionLabel: /欠席/,
      startLocal: buildLocalDateTime('05:00'),
      endLocal: buildLocalDateTime('05:30'),
      location: '生活介護室A',
      notes: 'E2E quick create',
    });
    const creationDialog = page.getByTestId(TESTIDS['schedule-create-dialog']);
    await creationDialog.getByTestId(TESTIDS['schedule-create-save']).click();
    await expect(creationDialog).toBeHidden({ timeout: 10_000 });

    await waitForWeekViewReady(page);
    const createdRecord = await page.evaluate(async () => {
      const response = await fetch(`/_api/web/lists/getbytitle('ScheduleEvents')/items?$select=Id,Title,ServiceType,cr014_serviceType`);
      const data = await response.json();
      const records = Array.isArray(data?.value) ? data.value : [];
      return records.find((item) => String(item?.Title ?? item?.cr014_title ?? '').includes('生活介護 休み')) ?? null;
    });
    expect(createdRecord).not.toBeNull();
    const serviceTypeValue = String(createdRecord.cr014_serviceType ?? createdRecord.ServiceType ?? '').trim();
    expect(serviceTypeValue).toMatch(/(欠席|休み|absence)/);
  });

  test('legacy 申請中 schedule normalises to その他 in quick dialog', async ({ page }) => {
    await gotoWeek(page, TEST_DATE);
    await waitForWeekViewReady(page);

    await openWeekEventCard(page, { titleContains: '訪問看護', category: 'User' });
    const dialog = page.getByTestId(TESTIDS['schedule-create-dialog']);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId(TESTIDS['schedule-create-service-type'])).toHaveText(/その他/);
    await dialog.getByRole('button', { name: 'キャンセル' }).click();
    await expect(dialog).toBeHidden();
  });
});
