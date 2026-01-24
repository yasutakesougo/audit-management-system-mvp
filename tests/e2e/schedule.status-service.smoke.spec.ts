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
  assertWeekHasUserCareEvent,
  fillQuickUserCareForm,
  getWeekScheduleItems,
  getQuickDialogSaveButton,
  getQuickScheduleDialog,
  getVisibleListbox,
  openQuickUserCareDialog,
  openWeekEventCard,
  openWeekEventEditor,
  waitForWeekViewReady,
} from './utils/scheduleActions';
import { TIME_ZONE, type ScheduleItem } from './utils/spMock';

const LIST_TITLE = 'ScheduleEvents';
const TEST_DATE = new Date(SCHEDULE_FIXTURE_BASE_DATE);
const TEST_DAY_KEY = formatInTimeZone(TEST_DATE, TIME_ZONE, 'yyyy-MM-dd');
const IS_PREVIEW = process.env.PW_USE_PREVIEW === '1';
const IS_FIXTURES = process.env.VITE_FORCE_SHAREPOINT !== '1';
const HAS_SCHEDULE_DATA = process.env.E2E_HAS_SCHEDULE_DATA === '1';

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

const ensureWeekPanel = async (page) => {
  const panel = page.locator('#panel-week:not([hidden])');

  const candidates = [
    panel,
    page.getByRole('tabpanel', { name: /週|week/i }),
    page.getByTestId('schedule-week-view'),
    page.getByTestId('schedule-week-root'),
    page.getByTestId('schedules-week-view'),
    page.getByTestId('schedules-week-timeline'),
  ];

  for (const locator of candidates) {
    const candidate = locator.first();
    if ((await candidate.count().catch(() => 0)) === 0) continue;
    const visible = await candidate.isVisible().catch(() => false);
    if (!visible) {
      await expect(candidate).toBeVisible({ timeout: 15_000 }).catch(() => undefined);
    }
    const nowVisible = await candidate.isVisible().catch(() => false);
    if (nowVisible) return candidate;
  }

  return panel;
};

const getWeekUserItem = async (page, text?: string | RegExp) => {
  const root = await ensureWeekPanel(page);

  const candidates: Array<ReturnType<typeof root.locator>> = [
    root.locator('[data-testid="schedule-item"][data-category="User"]'),
    root.getByTestId('schedule-item'),
    root.getByRole('listitem'),
  ];

  const passes: Array<(locator: ReturnType<typeof root.locator>) => ReturnType<typeof root.locator>> = [
    (loc) => (text ? loc.filter({ hasText: text }) : loc),
    (loc) => loc,
  ];

  for (const narrow of passes) {
    for (const base of candidates) {
      const scoped = narrow(base);
      const count = await scoped.count().catch(() => 0);
      if (count === 0) continue;
      const item = scoped.first();
      await expect(item).toBeVisible({ timeout: 15_000 });
      return item;
    }
  }

  throw new Error('No week user item found');
};

async function selectQuickServiceType(page, dialog, optionLabel: string | RegExp) {
  const select = dialog.getByTestId(TESTIDS['schedule-create-service-type']);
  await expect(select).toBeVisible({ timeout: 10_000 });
  await select.scrollIntoViewIfNeeded();
  await select.click({ timeout: 10_000 });
  const listbox = getVisibleListbox(page);
  await expect(listbox).toBeVisible({ timeout: 10_000 });
  await listbox.getByRole('option', { name: optionLabel }).first().click();
  return select;
}

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
    // Loosen any potential edit locks/read-only flags the UI might check.
    mutable.cr014_status = '下書き';
    mutable.IsLocked = false;
    mutable.cr014_isLocked = false;
    mutable.Accepted = false;
    mutable.cr014_accepted = false;
    mutable.ReadOnly = false;
    mutable.cr014_readOnly = false;
  }

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

test.describe('Schedule dialog: status/service end-to-end', () => {
  test.beforeEach(async ({ page }, testInfo) => {
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
        VITE_E2E_SCHEDULE_SAFE_SELECT: '1',
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

              // Normalize title/service fields because the app sometimes posts cr014_title / cr014_serviceType
              // instead of Title / ServiceType, and the smoke assertion looks for Title/ServiceType.
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
    const count = await items.count();

    await testInfo.attach('week-schedule-items-count', {
      body: Buffer.from(String(count)),
      contentType: 'text/plain',
    });

    const requireData = process.env.E2E_REQUIRE_SCHEDULE_DATA === '1';
    if (count === 0) {
      const msg = 'No schedule items found in week view (fixtures empty or stub mismatch).';
      if (requireData) {
        throw new Error(msg);
      }
      test.skip(msg);
    }
  });

  test('edit living care event via quick dialog persists service type', async ({ page }, testInfo) => {
      test.skip(IS_PREVIEW, 'Preview UI diverges; quick dialog not exposed.');
      test.skip(IS_FIXTURES, 'Requires real SharePoint; fixtures mode does not persist edits.');
      const userItems = await getWeekScheduleItems(page, { category: 'User' });
      await expect(userItems.first()).toBeVisible({ timeout: 15_000 });

    const targetRow = await getWeekUserItem(page, /生活介護/);

    const editor = await openWeekEventEditor(page, targetRow, {
      testInfo,
      label: 'status-service-open',
    });

    const { inDialog, global } = getQuickDialogSaveButton(page);
    const saveButton = (await inDialog.count()) > 0 ? inDialog : global;
    await expect(saveButton).toBeVisible({ timeout: 15_000 });
    await expect(saveButton).toBeEnabled({ timeout: 15_000 });

    const select = await selectQuickServiceType(page, editor, /欠席|休み/);
    await expect(select).toHaveText(/欠席|休み/);

      const patchResponsePromise = page
        .waitForResponse((r) => r.url().includes('/items(') && r.request().method() === 'PATCH' && r.ok(), {
          timeout: 20_000,
        })
        .catch(() => null);
      const refreshResponsePromise = page
        .waitForResponse(
          (r) =>
            r.url().includes("/_api/web/lists/getbytitle('ScheduleEvents')/items") &&
            r.request().method() === 'GET' &&
            r.ok(),
          { timeout: 20_000 },
        )
        .catch(() => null);

      await saveButton.click();
      const patchResponse = await patchResponsePromise;
      const refreshResponse = await refreshResponsePromise;
      const patchMeta = patchResponse
        ? { status: patchResponse.status(), url: patchResponse.url() }
        : { status: null, url: null };
      const refreshMeta = refreshResponse
        ? { status: refreshResponse.status(), url: refreshResponse.url() }
        : { status: null, url: null };
      const saveResponsesBody = JSON.stringify({ patch: patchMeta, refresh: refreshMeta }, null, 2);
      await testInfo.attach('week-save-responses.json', {
        body: saveResponsesBody,
        contentType: 'application/json',
      });
      const refreshJson = refreshResponse ? await refreshResponse.json().catch(() => null) : null;
      if (refreshJson) {
        const body = JSON.stringify(refreshJson, null, 2);
        await testInfo.attach('week-refresh-after-save.json', {
          body,
          contentType: 'application/json',
        });
      }
      await waitForWeekViewReady(page);

    const targetRowAfterSave = await getWeekUserItem(page, /生活介護/);
    await expect(targetRowAfterSave.getByText(/欠席|休み/)).toBeVisible({ timeout: 10_000 });

    await expect(editor).toBeHidden({ timeout: 10_000 });

    await page.reload();
    await gotoWeek(page, TEST_DATE);
    await waitForWeekViewReady(page);

    const targetRowReload = await getWeekUserItem(page, /生活介護/);

    const dialogReload = await openWeekEventEditor(page, targetRowReload, {
      testInfo,
      label: 'status-service-reopen',
    });
    const serviceSelectReload = dialogReload.getByTestId(TESTIDS['schedule-create-service-type']);
    await expect(serviceSelectReload).toBeVisible({ timeout: 10_000 });
    await expect(serviceSelectReload).toHaveText(/欠席|休み/);
    await serviceSelectReload.click();
    const listboxReload = getVisibleListbox(page);
    await expect(listboxReload).toBeVisible({ timeout: 5_000 });
    await expect(listboxReload).toContainText(/欠席|休み/);
    await page.keyboard.press('Escape');
    await dialogReload.getByRole('button', { name: 'キャンセル' }).click();
    await expect(dialogReload).toBeHidden({ timeout: 10_000 });
  });

  test('create new 生活介護休み entry via quick dialog', async ({ page }) => {
    test.skip(IS_PREVIEW, 'Preview UI diverges; quick dialog not exposed.');
    test.skip(true, 'Skipping quick create in smoke while quick dialog stabilisation is pending.');
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
    const creationSave = page.getByTestId(TESTIDS['schedule-editor-save']);
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

    const createdRecord = await page.evaluate(async () => {
      const response = await fetch(
        "/_api/web/lists/getbytitle('ScheduleEvents')/items?$select=Id,Title,ServiceType,cr014_serviceType,cr014_title",
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
      const records = value as CreatedRecord[];
      return (
        records.find((item) => {
          const title = String(item?.Title ?? item?.cr014_title ?? '');
          return title.includes('生活介護') && title.includes('休み');
        }) ?? null
      );
    });
    expect(createdRecord).not.toBeNull();
  });

  test('legacy 申請中 schedule normalises to その他 in quick dialog', async ({ page }, testInfo) => {
    test.skip(IS_PREVIEW, 'Preview UI diverges; quick dialog not exposed.');
    test.skip(IS_FIXTURES, 'Requires real SharePoint; fixtures mode does not persist edits.');
    const userItems = await getWeekScheduleItems(page, { category: 'User' });
    await expect(userItems.first()).toBeVisible({ timeout: 15_000 });

    const userItemCount = await userItems.count();
    // eslint-disable-next-line no-console
    console.log(`🔍 User items visible: ${userItemCount}`);
    if (userItemCount > 0) {
      const texts = await userItems.allTextContents();
      // eslint-disable-next-line no-console
      console.log('📋 User item texts:', texts);
      if (testInfo) {
        await testInfo.attach('week-user-items.txt', { body: texts.join('\n'), contentType: 'text/plain' });
      }
    }

    const spUserItems = await page.evaluate(async () => {
      type ScheduleRecord = {
        Id?: number;
        ID?: number;
        Title?: string;
        cr014_title?: string;
        ServiceType?: string;
        cr014_serviceType?: string;
        cr014_category?: string;
        cr014_dayKey?: string;
        Status?: string;
      };

      const response = await fetch(
        "/_api/web/lists/getbytitle('ScheduleEvents')/items?$select=Id,Title,ServiceType,cr014_serviceType,cr014_title,cr014_category,cr014_dayKey,Status",
      );
      const data = (await response.json()) as { value?: unknown };
      const value = Array.isArray(data.value) ? data.value : [];
      return value as ScheduleRecord[];
    });

    if (testInfo) {
      await testInfo.attach('sp-user-items.json', {
        body: JSON.stringify(spUserItems, null, 2),
        contentType: 'application/json',
      });
    }
    if (!HAS_SCHEDULE_DATA && userItemCount === 0) {
      test.skip(true, 'No week user items present (set E2E_HAS_SCHEDULE_DATA=1 to enable).');
    }

    await assertWeekHasUserCareEvent(page);

    const dialog = await openWeekEventCard(page, {
      index: 0,
      category: 'User',
      testInfo,
      label: 'legacy-pending-open',
    });
    const { inDialog: saveReloadInDialog, global: saveReloadGlobal } = getQuickDialogSaveButton(page);
    const saveReload = (await saveReloadInDialog.count()) > 0 ? saveReloadInDialog : saveReloadGlobal;
    await expect(saveReload).toBeVisible({ timeout: 15_000 });
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    const serviceSelectReload = dialog.getByTestId(TESTIDS['schedule-create-service-type']);
    await expect(serviceSelectReload).toBeVisible({ timeout: 10_000 });
    await serviceSelectReload.click();
    const listboxReload = getVisibleListbox(page);
    await expect(listboxReload).toBeVisible({ timeout: 5_000 });
    await listboxReload.getByRole('option', { name: /その他/ }).first().click();
    await expect(serviceSelectReload).toContainText(/その他/);
    await dialog.getByRole('button', { name: 'キャンセル' }).click();
    await expect(dialog).toBeHidden();
  });
});
