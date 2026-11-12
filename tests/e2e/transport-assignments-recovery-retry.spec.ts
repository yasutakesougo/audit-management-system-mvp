import { expect, test, type Page } from '@playwright/test';
import { setupSharePointStubs } from './_helpers/setupSharePointStubs';
import { bootstrapDashboard } from './utils/bootstrapApp';

const LEDGER_KEY = 'iceberg.transportAssignment.unresolvedSave.v1';
const EMPTY_MARK = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

function nextEtag(current: string): string {
  const token = current.trim().replace(/^W\//i, '').replace(/^"(.*)"$/, '$1');
  const version = Number(token.split(',')[0]);
  return `"${Number.isFinite(version) ? version + 1 : 9},1"`;
}

function scheduleRow(id: number, date: string) {
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
    UserCode: 'U002',
    TargetUserId: 'U002',
    cr014_personName: '鈴木 美子',
    AssignedStaffId: null,
    VehicleId: null,
    Note: null,
    '@odata.etag': '"8,1"',
  };
}

function ledgerTarget(dateKey: string, scheduleRowId: string) {
  return {
    dateKey,
    direction: 'to' as const,
    userId: 'U002',
    scheduleRowId,
    outcome: 'IN_FLIGHT' as const,
    conflict: true,
    writeStarted: true,
    before: { vehicleId: '', driverId: '', mark: EMPTY_MARK },
    intent: { vehicleId: '車両1', driverId: 'S001', mark: EMPTY_MARK },
  };
}

type EtagGate = {
  mergedIds: () => number[];
  etagFor: (id: number) => string;
  replayUrl: () => string;
  register: (page: Page) => Promise<void>;
};

function createEtagGate(): EtagGate {
  const etags = new Map<number, string>();
  const merged: number[] = [];
  let replayUrl = '';
  return {
    mergedIds: () => merged,
    etagFor: (id) => etags.get(id) ?? '"8,1"',
    replayUrl: () => replayUrl,
    register: async (page) => {
      await page.route('**/_api/web/**', async (route) => {
        const request = route.request();
        const override = (request.headers()['x-http-method'] ?? '').toUpperCase();
        const idMatch = request.url().match(/items\((\d+)\)/i);
        const isScheduleMerge = override === 'MERGE' && /schedule/i.test(request.url()) && idMatch;
        if (!isScheduleMerge || !idMatch) {
          await route.fallback();
          return;
        }
        const id = Number(idMatch[1]);
        const current = etags.get(id) ?? '"8,1"';
        if (request.headers()['if-match'] !== current) {
          await route.fulfill({
            status: 412,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'etag conflict' }),
          });
          return;
        }
        etags.set(id, nextEtag(current));
        merged.push(id);
        replayUrl = request.url();
        await route.fallback();
      });
    },
  };
}

async function openRecoveryPage(page: Page, requestId: string, targets: ReturnType<typeof ledgerTarget>[]): Promise<EtagGate> {
  const gate = createEtagGate();
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
          { Id: 501, StaffId: 'S001', FullName: '佐藤 運転', IsActive: true },
        ],
      },
      {
        name: 'Schedules',
        aliases: ['ScheduleEvents', 'Schedules_Master', 'SupportSchedule'],
        items: [scheduleRow(94001, '2026-03-25'), scheduleRow(94002, '2026-03-26')],
        onUpdate: (id, payload, ctx) => ({
          ...ctx.previous,
          ...(payload as Record<string, unknown>),
          '@odata.etag': gate.etagFor(id),
        }),
      },
    ],
    fallback: { status: 200, body: { value: [] } },
  });
  await gate.register(page);
  await page.addInitScript(({ key, ledger }) => {
    const scope = window as unknown as { Date: DateConstructor };
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
    window.localStorage.setItem('skipLogin', '1');
    window.localStorage.setItem('demo', '0');
    window.localStorage.setItem(key, ledger);
  }, {
    key: LEDGER_KEY,
    ledger: JSON.stringify([{
      schemaVersion: 2,
      saveContractVersion: 1,
      requestId,
      reconciliation: 'pending',
      targets,
    }]),
  });
  await bootstrapDashboard(page, {
    skipLogin: true,
    initialPath: '/transport/assignments',
    siteRelative: '/sites/demo',
  });
  await expect(page.getByTestId('transport-assignment-page')).toBeVisible();
  await expect(page.getByTestId('transport-assignment-date')).toHaveValue('2026-03-25');
  return gate;
}

test.describe('Transport assignment recovery retry', () => {
  test('keeps a two-day request when recovery merges only the visible day', async ({ page }) => {
    const gate = await openRecoveryPage(page, 'two-day', [
      ledgerTarget('2026-03-25', '94001'),
      ledgerTarget('2026-03-26', '94002'),
    ]);

    await expect(page.getByTestId('transport-assignment-recover')).toBeVisible();
    await expect(page.getByTestId('transport-assignment-save-button')).toBeDisabled();
    await page.getByTestId('transport-assignment-recover').click();
    await expect(page.getByTestId('transport-assignment-save-reconcile-failed')).toBeVisible();
    await expect(page.getByTestId('transport-assignment-recover')).toBeVisible();
    await expect(page.getByTestId('transport-assignment-save-button')).toBeDisabled();

    const ledger = await page.evaluate((key) => window.localStorage.getItem(key), LEDGER_KEY);
    expect(ledger).toContain('two-day');
    expect(ledger).toContain('94002');
    expect(gate.mergedIds()).toContain(94001);
    expect(gate.mergedIds()).not.toContain(94002);
  });

  test('releases one covered row after its ETag advances and rejects the old merge', async ({ page }) => {
    const gate = await openRecoveryPage(page, 'one-day', [
      ledgerTarget('2026-03-25', '94001'),
    ]);

    await expect(page.getByTestId('transport-assignment-recover')).toBeVisible();
    await page.getByTestId('transport-assignment-recover').click();
    await expect(page.getByTestId('transport-assignment-recover')).toHaveCount(0);
    const ledger = await page.evaluate((key) => window.localStorage.getItem(key), LEDGER_KEY);
    expect(ledger ?? '').not.toContain('one-day');
    expect(gate.etagFor(94001)).not.toBe('"8,1"');

    const status = await page.evaluate(async (url) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json;odata=nometadata',
          'Content-Type': 'application/json;odata=nometadata',
          'X-HTTP-Method': 'MERGE',
          'If-Match': '"8,1"',
        },
        body: JSON.stringify({ VehicleId: '車両9', AssignedStaffId: 'S009', Note: 'late' }),
      });
      return response.status;
    }, gate.replayUrl());
    expect(status).toBe(412);
    const stored = await page.evaluate(async (url) => {
      const response = await fetch(url, { headers: { Accept: 'application/json;odata=nometadata' } });
      return response.json() as Promise<{ VehicleId?: string | null }>;
    }, gate.replayUrl());
    expect(stored.VehicleId ?? null).not.toBe('車両9');
  });
});
