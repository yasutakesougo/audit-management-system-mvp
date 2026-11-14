import { expect, test, type Page } from '@playwright/test';
import { setupSharePointStubs } from './_helpers/setupSharePointStubs';
import { bootstrapDashboard } from './utils/bootstrapApp';
import { selectMuiOptionByLabel } from './utils/muiSelect';

const PARTIAL_COPY = '一部の配車設定が保存された可能性があります。最新の記録を確認するまで、同じ内容を再保存しないでください。';

async function failSecondScheduleMerge(page: Page): Promise<{ count: () => number }> {
  let scheduleMerges = 0;
  await page.route('**/_api/web/**', async (route) => {
    const request = route.request();
    const isScheduleMerge = request.url().includes('Schedules')
      && request.headers()['x-http-method'] === 'MERGE';
    if (isScheduleMerge) {
      scheduleMerges += 1;
      if (scheduleMerges >= 2) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'synthetic partial failure' }),
        });
        return;
      }
    }
    await route.fallback();
  });
  return { count: () => scheduleMerges };
}

test.describe('Transport assignment partial save', () => {
  test('normal save stops after a mid-batch failure and keeps the draft', async ({ page }) => {
    const today = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    await setupSharePointStubs(page, {
      currentUser: { status: 200, body: { Id: 401, Title: 'Transport Operator' } },
      lists: [
        {
          name: 'Users_Master',
          items: [
            { Id: 2000, UserID: 'U001', FullName: '田中 太郎', TransportCourse: 'Course1', IsActive: true, Modified: today },
            { Id: 2001, UserID: 'U002', FullName: '鈴木 美子', TransportCourse: 'Course1', IsActive: true, Modified: today },
          ],
        },
        {
          name: 'Staff_Master',
          items: [
            { Id: 501, StaffId: 'S001', FullName: '佐藤 運転', IsActive: true },
            { Id: 502, StaffId: 'S002', FullName: '鈴木 添乗', IsActive: true },
          ],
        },
        {
          name: 'Schedules',
          aliases: ['ScheduleEvents', 'Schedules_Master', 'SupportSchedule'],
          items: [
            {
              Id: 94001,
              Title: '迎え送迎（E2E）',
              EventDate: `${today}T08:30:00+09:00`,
              EndDate: `${today}T09:00:00+09:00`,
              Start: `${today}T08:30:00+09:00`,
              End: `${today}T09:00:00+09:00`,
              Status: 'Planned',
              ServiceType: 'transport',
              Category: 'User',
              TargetUserId: 'U002',
              cr014_personName: '鈴木 美子',
              AssignedStaffId: null,
              VehicleId: null,
              '@odata.etag': '"partial-1"',
            },
            {
              Id: 94002,
              Title: '迎え送迎（E2E）',
              EventDate: `${today}T08:40:00+09:00`,
              EndDate: `${today}T09:10:00+09:00`,
              Start: `${today}T08:40:00+09:00`,
              End: `${today}T09:10:00+09:00`,
              Status: 'Planned',
              ServiceType: 'transport',
              Category: 'User',
              TargetUserId: 'U001',
              cr014_personName: '田中 太郎',
              AssignedStaffId: null,
              VehicleId: null,
              '@odata.etag': '"partial-2"',
            },
          ],
        },
      ],
      fallback: { status: 200, body: { value: [] } },
    });

    await page.addInitScript(() => {
      const w = window as typeof window & { __ENV__?: Record<string, string> };
      w.__ENV__ = {
        ...(w.__ENV__ ?? {}),
        VITE_FORCE_SHAREPOINT: '1',
        VITE_DATA_PROVIDER: 'sharepoint',
        VITE_SKIP_SHAREPOINT: '0',
        VITE_DEMO_MODE: '0',
        VITE_FEATURE_USERS_SP: '1',
        VITE_SP_RESOURCE: 'https://contoso.sharepoint.com',
        VITE_SP_SITE_RELATIVE: '/sites/Audit',
      };
      window.localStorage.setItem('skipLogin', '1');
      window.localStorage.setItem('demo', '0');
    });
    const merges = await failSecondScheduleMerge(page);

    await bootstrapDashboard(page, { skipLogin: true, initialPath: '/transport/assignments' });
    await expect(page.getByTestId('transport-assignment-page')).toBeVisible();

    await selectMuiOptionByLabel(page, page.getByTestId('transport-assignment-add-user-select-1'), /鈴木\s*美子/);
    await page.getByTestId('transport-assignment-vehicle-card-1').getByRole('button', { name: '追加' }).click();
    await selectMuiOptionByLabel(page, page.getByTestId('transport-assignment-driver-select-1'), /佐藤/);
    await selectMuiOptionByLabel(page, page.getByTestId('transport-assignment-add-user-select-2'), /田中\s*太郎/);
    await page.getByTestId('transport-assignment-vehicle-card-2').getByRole('button', { name: '追加' }).click();
    await selectMuiOptionByLabel(page, page.getByTestId('transport-assignment-driver-select-2'), /鈴木/);

    await page.getByTestId('transport-assignment-save-button').click();
    const partial = page.getByTestId('transport-assignment-save-partial');
    await expect(partial).toBeVisible();
    await expect(partial).toContainText(PARTIAL_COPY);
    await expect(partial).toContainText('確認できた保存');
    await expect(partial).not.toContainText('結果不明 0件');
    await expect(page.getByTestId('transport-assignment-save-success')).toHaveCount(0);
    await expect(page.getByTestId('transport-assignment-unassign-車両1-U002')).toBeVisible();
    await expect(page.getByTestId('transport-assignment-unassign-車両2-U001')).toBeVisible();

    const mergesAfterFailure = merges.count();
    await page.waitForTimeout(400);
    expect(merges.count()).toBe(mergesAfterFailure);
    expect(merges.count()).toBeGreaterThanOrEqual(2);
  });

  test('week bulk save stops after a mid-batch failure and keeps the bulk draft', async ({ page }) => {
    await setupSharePointStubs(page, {
      currentUser: { status: 200, body: { Id: 401, Title: 'Transport Operator' } },
      lists: [
        {
          name: 'Users_Master',
          items: [
            { Id: 2001, UserID: 'U002', FullName: '鈴木 美子', TransportCourse: 'Course1', IsActive: true },
          ],
        },
        {
          name: 'Staff_Master',
          items: [
            { Id: 501, StaffID: 'STF001', StaffId: 'STF001', FullName: '佐藤 運転', IsActive: true },
          ],
        },
        {
          name: 'Schedules',
          aliases: ['ScheduleEvents', 'Schedules_Master', 'SupportSchedule'],
          items: [
            scheduleRow(95001, '2026-03-25', 'U002', null, null),
            scheduleRow(95002, '2026-03-23', 'U002', null, null),
            scheduleRow(95003, '2026-03-18', 'U002', '車両1', 'STF001'),
            scheduleRow(95004, '2026-03-16', 'U002', '車両1', 'STF001'),
          ],
        },
      ],
      fallback: { status: 200, body: { value: [] } },
    });

    await page.addInitScript(() => {
      const scope = window as unknown as { Date: DateConstructor; __ENV__?: Record<string, string> };
      const RealDate = Date;
      const fixedTs = new RealDate('2026-03-25T08:00:00+09:00').getTime();
      class MockDate extends RealDate {
        constructor(...args: ConstructorParameters<typeof RealDate>) {
          if (args.length === 0) super(fixedTs);
          else super(...args);
        }
        static now(): number {
          return fixedTs;
        }
      }
      scope.Date = MockDate;
      scope.__ENV__ = {
        ...(scope.__ENV__ ?? {}),
        VITE_FORCE_SHAREPOINT: '1',
        VITE_DATA_PROVIDER: 'sharepoint',
        VITE_SKIP_SHAREPOINT: '0',
        VITE_DEMO_MODE: '0',
        VITE_FEATURE_USERS_SP: '1',
        VITE_SP_RESOURCE: 'https://contoso.sharepoint.com',
        VITE_SP_SITE_RELATIVE: '/sites/Audit',
      };
      window.localStorage.setItem('skipLogin', '1');
      window.localStorage.setItem('demo', '0');
    });
    const merges = await failSecondScheduleMerge(page);

    await bootstrapDashboard(page, { skipLogin: true, initialPath: '/transport/assignments' });
    await expect(page.getByTestId('transport-assignment-date')).toHaveValue('2026-03-25');
    await page.getByTestId('transport-assignment-apply-week-bulk-default').click();
    await expect(page.getByTestId('transport-assignment-week-bulk-summary')).toBeVisible();
    await page.getByTestId('transport-assignment-save-button').click();

    const partial = page.getByTestId('transport-assignment-save-partial');
    await expect(partial).toBeVisible();
    await expect(partial).toContainText(PARTIAL_COPY);
    await expect(page.getByTestId('transport-assignment-save-success')).toHaveCount(0);
    await expect(page.getByTestId('transport-assignment-week-bulk-summary')).toBeVisible();
    const mergesAfterFailure = merges.count();
    await page.waitForTimeout(400);
    expect(merges.count()).toBe(mergesAfterFailure);
    expect(merges.count()).toBeGreaterThanOrEqual(2);
  });

  test('an unresolved save stays blocked across direction, date, and reload', async ({ page }) => {
    const today = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const otherDay = today.endsWith('12') ? today.slice(0, 8) + '11' : today.slice(0, 8) + '12';

    await setupSharePointStubs(page, {
      currentUser: { status: 200, body: { Id: 401, Title: 'Transport Operator' } },
      lists: [
        {
          name: 'Users_Master',
          items: [
            { Id: 2000, UserID: 'U001', FullName: '田中 太郎', TransportCourse: 'Course1', IsActive: true, Modified: today },
            { Id: 2001, UserID: 'U002', FullName: '鈴木 美子', TransportCourse: 'Course1', IsActive: true, Modified: today },
          ],
        },
        {
          name: 'Staff_Master',
          items: [
            { Id: 501, StaffId: 'S001', FullName: '佐藤 運転', IsActive: true },
            { Id: 502, StaffId: 'S002', FullName: '鈴木 添乗', IsActive: true },
          ],
        },
        {
          name: 'Schedules',
          aliases: ['ScheduleEvents', 'Schedules_Master', 'SupportSchedule'],
          items: [
            {
              Id: 94001,
              Title: '迎え送迎（E2E）',
              EventDate: `${today}T08:30:00+09:00`,
              EndDate: `${today}T09:00:00+09:00`,
              Start: `${today}T08:30:00+09:00`,
              End: `${today}T09:00:00+09:00`,
              Status: 'Planned',
              ServiceType: 'transport',
              Category: 'User',
              TargetUserId: 'U002',
              cr014_personName: '鈴木 美子',
              AssignedStaffId: null,
              VehicleId: null,
              '@odata.etag': '"partial-1"',
            },
          ],
        },
      ],
      fallback: { status: 200, body: { value: [] } },
    });
    await page.addInitScript(() => {
      const w = window as typeof window & { __ENV__?: Record<string, string> };
      w.__ENV__ = {
        ...(w.__ENV__ ?? {}),
        VITE_FORCE_SHAREPOINT: '1',
        VITE_DATA_PROVIDER: 'sharepoint',
        VITE_SKIP_SHAREPOINT: '0',
        VITE_DEMO_MODE: '0',
        VITE_FEATURE_USERS_SP: '1',
        VITE_SP_RESOURCE: 'https://contoso.sharepoint.com',
        VITE_SP_SITE_RELATIVE: '/sites/Audit',
      };
      window.localStorage.setItem('skipLogin', '1');
      window.localStorage.setItem('demo', '0');
    });

    let scheduleMerges = 0;
    let listsToFail = 0;
    await page.route('**/_api/web/**', async (route) => {
      const request = route.request();
      const isScheduleWrite = request.url().includes("getbytitle('Schedules')/items(")
        && (request.headers()['x-http-method'] === 'MERGE' || request.method() === 'POST');
      const isScheduleRead = request.method() === 'GET'
        && request.url().includes("getbytitle('Schedules')/items?");
      if (isScheduleWrite) {
        scheduleMerges += 1;
        listsToFail = 3;
      }
      if (isScheduleRead && listsToFail > 0) {
        listsToFail -= 1;
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'synthetic reconcile failure' }) });
        return;
      }
      await route.fallback();
    });

    await bootstrapDashboard(page, { skipLogin: true, initialPath: '/transport/assignments' });
    await expect(page.getByTestId('transport-assignment-page')).toBeVisible();
    await selectMuiOptionByLabel(page, page.getByTestId('transport-assignment-add-user-select-1'), /鈴木\s*美子/);
    await page.getByTestId('transport-assignment-vehicle-card-1').getByRole('button', { name: '追加' }).click();
    await selectMuiOptionByLabel(page, page.getByTestId('transport-assignment-driver-select-1'), /佐藤/);
    await page.getByTestId('transport-assignment-save-button').click();
    await expect(page.getByTestId('transport-assignment-save-reconcile-failed')).toBeVisible();

    const mergesAfterFailure = scheduleMerges;
    await page.getByRole('button', { name: '送り' }).click();
    await page.getByRole('button', { name: '迎え' }).click();
    await page.getByTestId(`transport-assignment-weekday-${otherDay}`).click();
    await page.getByTestId(`transport-assignment-weekday-${today}`).click();
    const blocked = page.getByTestId('transport-assignment-save-blocked');
    await expect(blocked).toBeVisible();
    await expect(blocked).not.toContainText('0件');
    await expect(page.getByTestId('transport-assignment-save-button')).toBeDisabled();
    expect(scheduleMerges).toBe(mergesAfterFailure);

    await page.reload();
    await expect(page.getByTestId('transport-assignment-page')).toBeVisible();
    await expect(page.getByTestId('transport-assignment-save-blocked')).toBeVisible();
    await expect(page.getByTestId('transport-assignment-save-button')).toBeDisabled();
    const stored = await page.evaluate(() => window.localStorage.getItem('iceberg.transportAssignment.unresolvedSave.v1'));
    expect(stored).toContain('U002');
    expect(stored).not.toContain('FullName');
    expect(stored).not.toContain('notes');
    expect(scheduleMerges).toBe(mergesAfterFailure);
  });

  test('a reload during save stays blocked after a before-image check and after the late merge lands', async ({ page }) => {
    const today = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    await setupSharePointStubs(page, {
      currentUser: { status: 200, body: { Id: 401, Title: 'Transport Operator' } },
      lists: [
        {
          name: 'Users_Master',
          items: [
            { Id: 2001, UserID: 'U002', FullName: '鈴木 美子', TransportCourse: 'Course1', IsActive: true, Modified: today },
          ],
        },
        {
          name: 'Staff_Master',
          items: [{ Id: 501, StaffId: 'S001', FullName: '佐藤 運転', IsActive: true }],
        },
        {
          name: 'Schedules',
          aliases: ['ScheduleEvents', 'Schedules_Master', 'SupportSchedule'],
          items: [
            {
              Id: 94001,
              Title: '迎え送迎（E2E）',
              EventDate: `${today}T08:30:00+09:00`,
              EndDate: `${today}T09:00:00+09:00`,
              Start: `${today}T08:30:00+09:00`,
              End: `${today}T09:00:00+09:00`,
              Status: 'Planned',
              ServiceType: 'transport',
              Category: 'User',
              TargetUserId: 'U002',
              cr014_personName: '鈴木 美子',
              AssignedStaffId: null,
              VehicleId: null,
              '@odata.etag': '"partial-hold"',
            },
          ],
        },
      ],
      fallback: { status: 200, body: { value: [] } },
    });
    await page.addInitScript(() => {
      const w = window as typeof window & { __ENV__?: Record<string, string> };
      w.__ENV__ = {
        ...(w.__ENV__ ?? {}),
        VITE_FORCE_SHAREPOINT: '1',
        VITE_DATA_PROVIDER: 'sharepoint',
        VITE_SKIP_SHAREPOINT: '0',
        VITE_DEMO_MODE: '0',
        VITE_FEATURE_USERS_SP: '1',
        VITE_SP_RESOURCE: 'https://contoso.sharepoint.com',
        VITE_SP_SITE_RELATIVE: '/sites/Audit',
      };
      window.localStorage.setItem('skipLogin', '1');
      window.localStorage.setItem('demo', '0');
    });
    let merges = 0;
    let releaseMerge: (() => void) | undefined;
    let markMergeApplied: (() => void) | undefined;
    const mergeApplied = new Promise<void>((resolve) => {
      markMergeApplied = resolve;
    });
    await page.route('**/_api/web/**', async (route) => {
      const request = route.request();
      const isScheduleWrite = request.url().includes("getbytitle('Schedules')/items(")
        && (request.headers()['x-http-method'] === 'MERGE' || request.method() === 'POST');
      if (isScheduleWrite) {
        merges += 1;
        await new Promise<void>((resolve) => {
          releaseMerge = resolve;
        });
        await route.fallback();
        markMergeApplied?.();
        return;
      }
      await route.fallback();
    });
    await bootstrapDashboard(page, { skipLogin: true, initialPath: '/transport/assignments' });
    await expect(page.getByTestId('transport-assignment-page')).toBeVisible();
    await selectMuiOptionByLabel(page, page.getByTestId('transport-assignment-add-user-select-1'), /鈴木\s*美子/);
    await page.getByTestId('transport-assignment-vehicle-card-1').getByRole('button', { name: '追加' }).click();
    await selectMuiOptionByLabel(page, page.getByTestId('transport-assignment-driver-select-1'), /佐藤/);
    const saveClick = page.getByTestId('transport-assignment-save-button').click();
    await page.waitForFunction(() => (window.localStorage.getItem('iceberg.transportAssignment.unresolvedSave.v1') ?? '').includes('"schemaVersion":2'));
    await expect.poll(() => merges).toBe(1);
    const mergesAtReload = merges;
    await page.reload();
    await saveClick.catch(() => undefined);
    await expect(page.getByTestId('transport-assignment-page')).toBeVisible();
    await expect(page.getByTestId('transport-assignment-save-blocked')).toBeVisible();
    await expect(page.getByTestId('transport-assignment-save-button')).toBeDisabled();
    expect(merges).toBe(mergesAtReload);

    await page.getByTestId('transport-assignment-reconcile').click();
    await page.waitForFunction(() => (window.localStorage.getItem('iceberg.transportAssignment.unresolvedSave.v1') ?? '').includes('write_still_possible'));
    await expect(page.getByTestId('transport-assignment-save-blocked')).toContainText('以前の保存処理がまだ反映される可能性があります');
    expect(merges).toBe(mergesAtReload);
    const storedBeforeMerge = await page.evaluate(() => window.localStorage.getItem('iceberg.transportAssignment.unresolvedSave.v1'));
    expect(storedBeforeMerge).toContain('write_still_possible');

    releaseMerge?.();
    await mergeApplied;
    const rereadAfterMerge = page.waitForResponse((response) => (
      response.request().method() === 'GET' && response.url().includes("getbytitle('Schedules')/items")
    ));
    await page.getByTestId('transport-assignment-reconcile').click();
    await rereadAfterMerge;
    await expect(page.getByTestId('transport-assignment-save-blocked')).toContainText('以前の保存処理がまだ反映される可能性があります');
    await expect(page.getByTestId('transport-assignment-save-button')).toBeDisabled();
    expect(merges).toBe(mergesAtReload);
    const storedAfterMerge = await page.evaluate(() => window.localStorage.getItem('iceberg.transportAssignment.unresolvedSave.v1'));
    expect(storedAfterMerge).toContain('write_still_possible');
    expect(storedAfterMerge).toContain('U002');
  });

  test('a damaged ledger stays visible and blocks saving', async ({ page }) => {
    const today = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    await setupSharePointStubs(page, {
      currentUser: { status: 200, body: { Id: 401, Title: 'Transport Operator' } },
      lists: [
        { name: 'Users_Master', items: [] },
        { name: 'Staff_Master', items: [] },
        { name: 'Schedules', aliases: ['ScheduleEvents', 'Schedules_Master', 'SupportSchedule'], items: [] },
      ],
      fallback: { status: 200, body: { value: [] } },
    });
    await page.addInitScript(() => {
      const w = window as typeof window & { __ENV__?: Record<string, string> };
      w.__ENV__ = {
        ...(w.__ENV__ ?? {}),
        VITE_FORCE_SHAREPOINT: '1',
        VITE_DATA_PROVIDER: 'sharepoint',
        VITE_SKIP_SHAREPOINT: '0',
        VITE_DEMO_MODE: '0',
        VITE_FEATURE_USERS_SP: '1',
        VITE_SP_RESOURCE: 'https://contoso.sharepoint.com',
        VITE_SP_SITE_RELATIVE: '/sites/Audit',
      };
      window.localStorage.setItem('skipLogin', '1');
      window.localStorage.setItem('demo', '0');
      window.localStorage.setItem('iceberg.transportAssignment.unresolvedSave.v1', '{');
    });
    await bootstrapDashboard(page, { skipLogin: true, initialPath: '/transport/assignments' });
    await expect(page.getByTestId('transport-assignment-ledger-corrupt')).toBeVisible();
    await expect(page.getByTestId('transport-assignment-save-button')).toBeDisabled();
    await expect(page.getByTestId('transport-assignment-reconcile')).toHaveCount(0);
    const stored = await page.evaluate(() => window.localStorage.getItem('iceberg.transportAssignment.unresolvedSave.v1'));
    expect(stored).toBe('{');
  });

  test('a read-only check leaves an unreadable save blocked', async ({ page }) => {
    const today = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    await setupSharePointStubs(page, {
      currentUser: { status: 200, body: { Id: 401, Title: 'Transport Operator' } },
      lists: [
        {
          name: 'Users_Master',
          items: [{ Id: 2001, UserID: 'U002', FullName: '鈴木 美子', TransportCourse: 'Course1', IsActive: true, Modified: today }],
        },
        { name: 'Staff_Master', items: [{ Id: 501, StaffId: 'S001', FullName: '佐藤 運転', IsActive: true }] },
        {
          name: 'Schedules',
          aliases: ['ScheduleEvents', 'Schedules_Master', 'SupportSchedule'],
          items: [
            {
              Id: 94001,
              Title: '迎え送迎（E2E）',
              EventDate: `${today}T08:30:00+09:00`,
              EndDate: `${today}T09:00:00+09:00`,
              Start: `${today}T08:30:00+09:00`,
              End: `${today}T09:00:00+09:00`,
              Status: 'Planned',
              ServiceType: 'transport',
              Category: 'User',
              TargetUserId: 'U002',
              cr014_personName: '鈴木 美子',
              AssignedStaffId: null,
              VehicleId: null,
              '@odata.etag': '"partial-1"',
            },
          ],
        },
      ],
      fallback: { status: 200, body: { value: [] } },
    });
    await page.addInitScript(() => {
      const w = window as typeof window & { __ENV__?: Record<string, string> };
      w.__ENV__ = {
        ...(w.__ENV__ ?? {}),
        VITE_FORCE_SHAREPOINT: '1',
        VITE_DATA_PROVIDER: 'sharepoint',
        VITE_SKIP_SHAREPOINT: '0',
        VITE_DEMO_MODE: '0',
        VITE_FEATURE_USERS_SP: '1',
        VITE_SP_RESOURCE: 'https://contoso.sharepoint.com',
        VITE_SP_SITE_RELATIVE: '/sites/Audit',
      };
      window.localStorage.setItem('skipLogin', '1');
      window.localStorage.setItem('demo', '0');
    });
    let merges = 0;
    let listsToFail = 0;
    let failReads = false;
    await page.route('**/_api/web/**', async (route) => {
      const request = route.request();
      const isScheduleWrite = request.url().includes("getbytitle('Schedules')/items(")
        && (request.headers()['x-http-method'] === 'MERGE' || request.method() === 'POST');
      const isScheduleRead = request.method() === 'GET' && request.url().includes("getbytitle('Schedules')/items?");
      if (isScheduleWrite) {
        merges += 1;
        listsToFail = 3;
      }
      if (isScheduleRead && (failReads || listsToFail > 0)) {
        if (!failReads) listsToFail -= 1;
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'synthetic reconcile failure' }) });
        return;
      }
      await route.fallback();
    });
    await bootstrapDashboard(page, { skipLogin: true, initialPath: '/transport/assignments' });
    await expect(page.getByTestId('transport-assignment-page')).toBeVisible();
    await selectMuiOptionByLabel(page, page.getByTestId('transport-assignment-add-user-select-1'), /鈴木\s*美子/);
    await page.getByTestId('transport-assignment-vehicle-card-1').getByRole('button', { name: '追加' }).click();
    await selectMuiOptionByLabel(page, page.getByTestId('transport-assignment-driver-select-1'), /佐藤/);
    await page.getByTestId('transport-assignment-save-button').click();
    await expect(page.getByTestId('transport-assignment-save-reconcile-failed')).toBeVisible();
    const mergesAfterFailure = merges;
    listsToFail = 0;
    await page.reload();
    await expect(page.getByTestId('transport-assignment-reconcile')).toBeVisible();
    failReads = true;
    await page.getByTestId('transport-assignment-reconcile').click();
    await expect(page.getByTestId('transport-assignment-save-blocked')).toBeVisible();
    expect(merges).toBe(mergesAfterFailure);
    const stored = await page.evaluate(() => window.localStorage.getItem('iceberg.transportAssignment.unresolvedSave.v1'));
    expect(stored).toContain('U002');
  });
});

function scheduleRow(
  id: number,
  date: string,
  userId: string,
  vehicleId: string | null,
  staffId: string | null,
) {
  return {
    Id: id,
    Title: '送迎（往路）',
    EventDate: `${date}T08:30:00+09:00`,
    EndDate: `${date}T09:00:00+09:00`,
    Start: `${date}T08:30:00+09:00`,
    End: `${date}T09:00:00+09:00`,
    Status: 'Planned',
    ServiceType: 'transport',
    Category: 'User',
    cr014_category: 'User',
    UserCode: userId,
    cr014_personType: 'User',
    cr014_personId: userId,
    cr014_personName: '鈴木 美子',
    AssignedStaffId: staffId,
    VehicleId: vehicleId,
    Note: null,
    '@odata.etag': `"partial-${id}"`,
  };
}
