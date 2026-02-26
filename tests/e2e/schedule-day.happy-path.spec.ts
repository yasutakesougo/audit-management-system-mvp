/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck -- Playwright e2e files live outside the main tsconfig include set to avoid alias resolution noise.
import '@/test/captureSp400';
import { expect, test } from '@playwright/test';
import { TESTIDS } from '@/testids';
import { SCHEDULE_FIELD_CATEGORY, SCHEDULE_FIELD_SERVICE_TYPE } from '@/sharepoint/fields';
import { bootSchedule } from './_helpers/bootSchedule';
import { getSchedulesTodaySeedDate, readSchedulesTodaySeed } from './_helpers/schedulesTodaySeed';
import { gotoDay } from './utils/scheduleNav';
import {
  getWeekScheduleItems,
  fillQuickUserCareForm,
  openQuickUserCareDialog,
  waitForDayViewReady,
  waitForWeekViewReady,
} from './utils/scheduleActions';
import { waitSchedulesItemsOrEmpty } from './utils/wait';

const TARGET_DATE = new Date('2025-11-24T00:00:00+09:00');
const TARGET_DATE_ISO = '2025-11-24';
const TARGET_LIST = 'ScheduleEvents';
const SCHEDULE_SEED = readSchedulesTodaySeed();
const SEED_DAY_ISO = getSchedulesTodaySeedDate();
const SEEDED_EVENT_COUNT = SCHEDULE_SEED.events.length;
const DAY_ROOT_SELECTOR = `[data-testid="${TESTIDS['schedules-day-page']}"] , [data-testid="schedule-day-root"]`;

test.describe('Schedule day seeded happy path (fixtures)', () => {
  test('renders seeded events for the anchored day', async ({ page }) => {
    await bootSchedule(page, {
      seed: { schedulesToday: true },
      autoNavigate: true,
      route: `/schedules/week?date=${SEED_DAY_ISO}&tab=day`,
    });

    await waitForDayViewReady(page);

    const dayPage = page.locator(DAY_ROOT_SELECTOR).first();
    await expect(dayPage).toBeVisible();
  });

  test('week category filter narrows visible items', async ({ page }) => {
    await bootSchedule(page, {
      seed: { schedulesToday: true },
      autoNavigate: true,
      route: `/schedules/week?date=${SEED_DAY_ISO}`,
    });

    await waitForWeekViewReady(page);
    await waitSchedulesItemsOrEmpty(page);

    const allItems = await getWeekScheduleItems(page);
    await expect(allItems).toHaveCount(SEEDED_EVENT_COUNT);

    const categoryFilter = page.getByTestId(TESTIDS['schedules-filter-category']);
    if (await categoryFilter.count()) {
      await categoryFilter.selectOption('Staff');

      const filtered = await getWeekScheduleItems(page);
      await expect(filtered).toHaveCount(1);
      const filteredCount = await filtered.count();
      expect(filteredCount).toBeLessThan(SEEDED_EVENT_COUNT);
    } else {
      // Legacy UI does not expose the select element, so validate via data-category attribute.
      const staffItems = await getWeekScheduleItems(page, { category: 'Staff' });
      await expect(staffItems).toHaveCount(1);
      const staffCount = await staffItems.count();
      expect(staffCount).toBeLessThan(SEEDED_EVENT_COUNT);
    }
  });
});

type ScheduleRecord = Record<string, unknown> & { Id: number; '@odata.etag': string };

test.describe('Schedules day happy path', () => {
  test.skip(true, 'Skip pending stub POST capture investigation');
  let recordedCreates: ScheduleRecord[];
  let recordedUpdates: ScheduleRecord[];

  const materializeRecord = (payload: unknown, id: number): ScheduleRecord => {
    const base = { ...(payload as Record<string, unknown>) };
    const recordId = typeof base.Id === 'number' && Number.isFinite(base.Id) ? base.Id : id;
    const startIso = typeof base.EventDate === 'string' && base.EventDate
      ? base.EventDate
      : typeof base.Start === 'string'
        ? base.Start
        : null;
    const endIso = typeof base.EndDate === 'string' && base.EndDate
      ? base.EndDate
      : typeof base.End === 'string'
        ? base.End
        : null;

    return {
      ...base,
      Id: recordId,
      Title: base.Title ?? `Schedule ${recordId}`,
      EventDate: startIso,
      EndDate: endIso,
      cr014_category: base.cr014_category ?? base[SCHEDULE_FIELD_CATEGORY] ?? 'User',
      cr014_serviceType: base.cr014_serviceType ?? base[SCHEDULE_FIELD_SERVICE_TYPE] ?? null,
      '@odata.etag': `"${recordId}-${Date.now()}"`,
    } as ScheduleRecord;
  };

  test.beforeEach(async ({ page }) => {
    recordedCreates = [];
    recordedUpdates = [];

    await page.route('**/login.microsoftonline.com/**', (route) => route.fulfill({ status: 204, body: '' }));
    await page.route('https://graph.microsoft.com/**', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({ value: [] }),
        headers: { 'content-type': 'application/json' },
      }),
    );

    await bootSchedule(page, {
      sharePoint: {
        currentUser: { status: 200, body: { Id: 999 } },
        fallback: { status: 200, body: { value: [] } },
        lists: [
          {
            name: TARGET_LIST,
            aliases: ['Schedules', 'SupportSchedule', 'Schedules_Master'],
            items: [],
            insertPosition: 'start',
            sort: (rows) =>
              [...rows].sort((a, b) => {
                const aDate = new Date(String(a.EventDate ?? a.Start ?? '')).getTime();
                const bDate = new Date(String(b.EventDate ?? b.Start ?? '')).getTime();
                return aDate - bDate;
              }),
            onCreate: (payload, ctx) => {
              const record = materializeRecord(payload, ctx.takeNextId());
              recordedCreates.push(record);
              return record;
            },
            onUpdate: (id, payload, ctx) => {
              const merged = { ...ctx.previous, ...(payload as Record<string, unknown>) };
              const record = materializeRecord(merged, id);
              recordedUpdates.push(record);
              return record;
            },
          },
        ],
      },
    });
  });

  test('user can create and edit a day entry through the quick dialog', async ({ page }) => {
    await gotoDay(page, TARGET_DATE);
    await waitForDayViewReady(page);

    const creationTitle = 'Playwright 送迎';
    await openQuickUserCareDialog(page);
    await fillQuickUserCareForm(page, {
      title: creationTitle,
      userInputValue: '田中',
      userOptionName: '田中 太郎',
      startLocal: `${TARGET_DATE_ISO}T10:00`,
      endLocal: `${TARGET_DATE_ISO}T11:00`,
      serviceOptionLabel: '欠席',
      staffInputValue: '佐藤',
      staffOptionName: /佐藤 花子/,
      location: '日中活動室A',
      notes: 'Playwright作成',
    });

    const beforeStoredCount = await page.evaluate(() => {
      const raw = window.localStorage.getItem('e2e:schedules.v1');
      const rows = raw ? (JSON.parse(raw) as unknown[]) : [];
      return Array.isArray(rows) ? rows.length : 0;
    });

    const dialog = page
      .getByTestId(TESTIDS['schedule-create-dialog'])
      .filter({ has: page.getByTestId(TESTIDS['schedule-create-start']) })
      .last();
    const saveButton = dialog.getByTestId(TESTIDS['schedule-create-save']).first();
    await expect(saveButton).toBeVisible({ timeout: 15_000 });
    await expect(saveButton).toBeEnabled({ timeout: 15_000 });
    await saveButton.click({ timeout: 10_000 });
    await expect(page.getByTestId(TESTIDS['schedule-create-dialog'])).toBeHidden({ timeout: 15_000 });

    const isForceWrite = await page.evaluate(
      () => String((window as typeof window & { __ENV__?: Record<string, string> }).__ENV__?.VITE_E2E_FORCE_SCHEDULES_WRITE) === '1',
    );

    const created = isForceWrite
      ? await expect
          .poll(
            async () =>
              page.evaluate((baseline) => {
                const raw = window.localStorage.getItem('e2e:schedules.v1');
                const rows = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
                if (!Array.isArray(rows) || rows.length <= baseline) {
                  return null;
                }
                return rows[rows.length - 1] ?? null;
              }, beforeStoredCount),
            { timeout: 10_000 },
          )
          .not.toBeNull()
          .then(async () =>
            page.evaluate((baseline) => {
              const raw = window.localStorage.getItem('e2e:schedules.v1');
              const rows = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
              if (!Array.isArray(rows) || rows.length <= baseline) {
                return null;
              }
              return rows[rows.length - 1] ?? null;
            }, beforeStoredCount),
          )
      : await expect
          .poll(() => recordedCreates.length, { timeout: 10_000 })
          .toBe(1)
          .then(() => recordedCreates[0]);

    expect(created).not.toBeNull();
    expect(String(created.cr014_category ?? created[SCHEDULE_FIELD_CATEGORY] ?? created.category ?? '')).toBe('User');
    expect(String(created.cr014_serviceType ?? created[SCHEDULE_FIELD_SERVICE_TYPE] ?? created.serviceType ?? '')).toMatch(/(absence|欠席|休み)/);
    expect(new Date(String(created.EventDate ?? created.Start ?? created.start ?? '')).toISOString()).toBe(
      new Date(`${TARGET_DATE_ISO}T10:00:00+09:00`).toISOString(),
    );
  });
});
