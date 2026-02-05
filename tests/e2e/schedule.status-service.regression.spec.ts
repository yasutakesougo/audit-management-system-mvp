/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck -- Playwright e2e specs live outside the primary tsconfig include path.
import '@/test/captureSp400';
import { expect, test } from '@playwright/test';
import { formatInTimeZone } from 'date-fns-tz';
import { bootSchedule } from './_helpers/bootSchedule';
import { buildScheduleFixturesForDate, SCHEDULE_FIXTURE_BASE_DATE } from './utils/schedule.fixtures';
import { gotoWeek } from './utils/scheduleNav';
import {
  fillQuickUserCareForm,
  getQuickDialogSaveButton,
  getQuickScheduleDialog,
  getWeekScheduleItems,
  openQuickUserCareDialog,
  waitForWeekViewReady,
} from './utils/scheduleActions';
import { TIME_ZONE } from './utils/spMock';

const LIST_TITLE = 'Schedules_Master';
const TEST_DATE = new Date(SCHEDULE_FIXTURE_BASE_DATE);
const TEST_DAY_KEY = formatInTimeZone(TEST_DATE, TIME_ZONE, 'yyyy-MM-dd');
const IS_PREVIEW = process.env.PW_USE_PREVIEW === '1';

const buildLocalDateTime = (time: string) => `${TEST_DAY_KEY}T${time}`;

type MutableScheduleItem = ScheduleItem & {
  cr014_status?: string;
  IsLocked?: boolean;
  cr014_isLocked?: boolean;
  Accepted?: boolean;
  cr014_accepted?: boolean;
  ReadOnly?: boolean;
  cr014_readOnly?: boolean;
};

const buildScheduleItems = () => {
  const fixtures = buildScheduleFixturesForDate(TEST_DATE);
  const items = [...fixtures.User, ...fixtures.Staff, ...fixtures.Org].map((item) => ({ ...item }));

  const livingCare = items.find((item) => item.Id === 9101) ?? items.find((item) => item.cr014_category === 'User');
  if (livingCare) {
    const mutable = livingCare as MutableScheduleItem;
    livingCare.Title = '生活介護 午後ケア';
    livingCare.Status = '下書き';
    livingCare.cr014_serviceType = '生活介護';
    livingCare.cr014_category = 'User';
    livingCare.cr014_staffIds = ['101'];
    livingCare.cr014_staffNames = ['E2E Admin'];
    mutable.cr014_status = '下書き';
    mutable.IsLocked = false;
    mutable.cr014_isLocked = false;
    mutable.Accepted = false;
    mutable.cr014_accepted = false;
    mutable.ReadOnly = false;
    mutable.cr014_readOnly = false;
  }

  const startIso = `${TEST_DAY_KEY}T14:00:00+09:00`;
  const endIso = `${TEST_DAY_KEY}T14:30:00+09:00`;
  items.push({
    Id: 9999,
    Title: '生活介護 午後ケア',
    Start: startIso,
    EventDate: startIso,
    End: endIso,
    EndDate: endIso,
    AllDay: false,
    Status: '下書き',
    Location: '生活介護室A',
    cr014_category: 'User',
    cr014_serviceType: '生活介護',
    cr014_personType: 'Internal',
    cr014_personId: 'U-101',
    cr014_personName: '田中 実',
    cr014_staffIds: ['101'],
    cr014_staffNames: ['E2E Admin'],
    cr014_dayKey: TEST_DAY_KEY,
    cr014_fiscalYear: formatInTimeZone(TEST_DATE, TIME_ZONE, 'yyyy'),
    '@odata.etag': '"e2e-living-care"',
  } satisfies ScheduleItem);

  const legacyPending = items.find((item) => item.Id === 9102);
  if (legacyPending) {
    legacyPending.Status = '申請中';
    legacyPending.Title = '訪問看護';
    legacyPending.cr014_title = '訪問看護';
    legacyPending.cr014_category = 'User';
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

test.describe('Schedule quick-create (regression)', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (message) => {
      if (message.type() === 'info' && message.text().startsWith('[schedulesClient] fixtures=')) {
        // eslint-disable-next-line no-console
        console.log(`browser-console: ${message.text()}`);
      }
    });

    const scheduleItems = buildScheduleItems();

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
      storageOverrides: {
        role: 'admin',
      },
      sharePoint: {
        currentUser: { status: 200, body: { Id: 101 } },
        fallback: { status: 404, body: {} },
        lists: [
          {
            name: LIST_TITLE,
            aliases: ['Schedules', 'ScheduleEvents', 'SupportSchedule'],
            items: scheduleItems,
            onUpdate: (_id, payload: Record<string, unknown>, ctx) => {
              const ensureText = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);
              const merged: Record<string, unknown> = { ...ctx.previous, ...payload };
              const service = ensureText(payload['ServiceType']) ?? ensureText(payload['cr014_serviceType']) ?? '欠席';
              merged.ServiceType = service;
              merged.cr014_serviceType = service;
              return merged;
            },
            onCreate: (payload, ctx) => {
              type ScheduleRecord = Record<string, unknown> & { Id: number; Status?: string };
              const source = (payload as Record<string, unknown>) ?? {};

              const normalizeText = (value: unknown) => (typeof value === 'string' ? value : '');
              const title = normalizeText(source.Title ?? source.cr014_title ?? source.title);
              const serviceType = normalizeText(source.ServiceType ?? source.cr014_serviceType ?? source.serviceType);

              const record = {
                Id: ctx.takeNextId(),
                ...source,
                Title: title || '新規スケジュール',
                cr014_title: title || (source.cr014_title ?? '新規スケジュール'),
                ServiceType: serviceType || source.ServiceType,
                cr014_serviceType: serviceType || source.cr014_serviceType,
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
    await expect(items.first()).toBeVisible({ timeout: 15_000 });
  });

  test('create new 生活介護休み entry via quick dialog', async ({ page }, testInfo) => {
    test.skip(IS_PREVIEW, 'Preview UI diverges; quick dialog not exposed.');
    await gotoWeek(page, TEST_DATE);
    await waitForWeekViewReady(page);

    const createResponsePromise = page.waitForResponse(
      (resp) =>
        resp.request().method() === 'POST' &&
        resp.url().includes('/_api/web/lists/') &&
        resp.url().includes('/items') &&
        resp.ok(),
    );

    await openQuickUserCareDialog(page);
    const createDialog = getQuickScheduleDialog(page);
    await expect(createDialog).toBeVisible({ timeout: 15_000 });
    await fillQuickUserCareForm(page, {
      title: '生活介護 休み',
      userInputValue: '田中',
      userOptionName: /田中/, // matches resident fixtures (田中 実)
      staffInputValue: '佐藤',
      staffOptionName: /佐藤/, // demo staff fixture: 佐藤 花子
      serviceOptionLabel: /欠席|休み/,
      startLocal: buildLocalDateTime('05:00'),
      endLocal: buildLocalDateTime('05:30'),
      location: '生活介護室A',
      notes: 'E2E quick create',
    });
    const { inDialog, global } = getQuickDialogSaveButton(page);
    const creationSave = (await inDialog.count()) > 0 ? inDialog : global;
    await creationSave.click();
    const createResponse = await createResponsePromise;
    await expect(creationSave).toBeHidden({ timeout: 15_000 });

    await waitForWeekViewReady(page);
    const createdResponseBody = await createResponse.json();

    expect(createdResponseBody).not.toBeNull();
    const recordId =
      createdResponseBody?.Id ??
      createdResponseBody?.ID ??
      createdResponseBody?.d?.Id ??
      createdResponseBody?.d?.ID;
    expect(recordId).toBeTruthy();

    const serviceTypeValue = String(
      createdResponseBody?.cr014_serviceType ??
      createdResponseBody?.ServiceType ??
      createdResponseBody?.d?.cr014_serviceType ??
      createdResponseBody?.d?.ServiceType ??
      '',
    ).trim();
    expect(serviceTypeValue).toMatch(/(欠席|休み|absence)/);

    const createdRecords = await page.evaluate(async () => {
      const response = await fetch(
        "/_api/web/lists/getbytitle('Schedules_Master')/items?$select=Id,Title,ServiceType,cr014_serviceType,cr014_title",
      );
      type CreatedRecord = {
        Id?: number;
        ID?: number;
        Title?: string;
        cr014_title?: string;
        ServiceType?: string;
        cr014_serviceType?: string;
      };

      const data = (await response.json()) as { value?: unknown };
      const value = Array.isArray(data.value) ? data.value : [];
      return value as CreatedRecord[];
    });

    if (testInfo) {
      const body = JSON.stringify(createdRecords, null, 2);
      await testInfo.attach('schedules-master-after-create.json', {
        body,
        contentType: 'application/json',
      });
    }

    const createdRecord = createdRecords.find((item) => {
      const idCandidate = item?.Id ?? item?.ID;
      return idCandidate && String(idCandidate) === String(recordId);
    });
    expect(createdRecord).not.toBeNull();
  });
});
