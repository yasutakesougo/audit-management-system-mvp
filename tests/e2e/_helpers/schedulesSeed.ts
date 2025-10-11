import type { Page, Route } from '@playwright/test';

declare global {
  interface Window {
    __SCHEDULE_FIXTURES__?: unknown;
  }
}

export type ScheduleStatus = 'draft' | 'submitted' | 'approved';

export type DemoSchedule = {
  id: number;
  title: string;
  startUtc: string;
  endUtc: string;
  status?: ScheduleStatus;
  location?: string | null;
  category?: 'User' | 'Staff' | 'Org';
  staffId?: number | string | null;
  userId?: number | string | null;
  notes?: string | null;
  allDay?: boolean;
  recurrenceRule?: string | null;
  statusLabel?: string;
  serviceType?: string;
  personType?: string;
  personId?: string | null;
  personName?: string | null;
  dayPart?: string | null;
  sharePointExtra?: Record<string, unknown>;
};

export type SharePointScheduleItem = {
  Id: number;
  Title: string;
  EventDate: string;
  EndDate: string;
  AllDay: boolean;
  Status?: string;
  Location?: string | null;
  [key: string]: unknown;
};

const STATUS_LABEL_MAP: Record<ScheduleStatus, string> = {
  draft: '未確定',
  submitted: '実施中',
  approved: '確定',
};

const toJst = (iso: string): Date => new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);

const computeFiscalYearFromIso = (iso: string): string | undefined => {
  try {
    const date = toJst(iso);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    return String(month >= 4 ? year : year - 1);
  } catch {
    return undefined;
  }
};

const toDomainSchedule = (seed: DemoSchedule) => {
  const start = seed.startUtc;
  const end = seed.endUtc;
  const dayKey = start.slice(0, 10).replace(/-/g, '');
  const monthKey = start.slice(0, 7).replace(/-/g, '');
  const status = seed.status ?? 'draft';
  const category = seed.category ?? 'User';
  const staffId = seed.staffId ?? null;
  const userId = seed.userId ?? null;
  const recurrenceRule = seed.recurrenceRule ?? null;
  const statusLabel = seed.statusLabel ?? STATUS_LABEL_MAP[status];
  const serviceType = seed.serviceType ?? '一時ケア';
  const personType = seed.personType ?? 'Internal';
  const personId = seed.personId ?? (userId != null ? String(userId) : null);
  const personName = seed.personName ?? seed.title;
  const dayPart = seed.dayPart ?? null;
  const notes = seed.notes ?? null;
  const allDay = seed.allDay ?? false;
  const staffIdString = typeof staffId === 'number' ? String(staffId) : staffId ?? undefined;
  const staffIds = staffIdString ? [staffIdString] : [];

  return {
    id: seed.id,
    etag: `W/"${seed.id}"`,
    title: seed.title,
    start: start,
    end: end,
    startUtc: start,
    endUtc: end,
    startLocal: start,
    endLocal: end,
    startDate: start.slice(0, 10),
    endDate: end.slice(0, 10),
    allDay,
    location: seed.location ?? null,
    staffId: staffId ?? null,
    userId: typeof userId === 'string' ? Number(userId) : userId ?? null,
    status,
    notes,
    recurrenceRaw: recurrenceRule,
    recurrence: recurrenceRule
      ? {
          rule: recurrenceRule,
          timezone: 'Asia/Tokyo',
          instanceStart: start,
          instanceEnd: end,
        }
      : undefined,
    created: start,
    modified: end,
    category,
    serviceType,
    personType,
    personId,
    personName,
    staffIds,
    staffNames: staffIds.length ? staffIds.map((id) => `スタッフ${id}`) : undefined,
    dayPart,
    billingFlags: [],
    targetUserIds: userId != null ? [userId] : [],
    targetUserNames: userId != null ? [`利用者${userId}`] : undefined,
    relatedResourceIds: [],
    relatedResourceNames: [],
    rowKey: `row-${seed.id}`,
    dayKey,
    monthKey,
    createdAt: start,
    updatedAt: end,
    assignedStaffIds: [...staffIds],
    assignedStaffNames: staffIds.length ? staffIds.map((id) => `スタッフ${id}`) : undefined,
    statusLabel,
  };
};

export const buildDomainSchedules = (seeds: readonly DemoSchedule[]): ReturnType<typeof toDomainSchedule>[] =>
  seeds.map((item) => toDomainSchedule(item));

export async function seedSchedulesInApp(page: Page, items: readonly DemoSchedule[], options: { append?: boolean } = {}) {
  const fixtures = buildDomainSchedules(items);
  await page.addInitScript(({ schedules, append }) => {
    const scope = window as typeof window & { __SCHEDULE_FIXTURES__?: unknown };
    const existing = Array.isArray(scope.__SCHEDULE_FIXTURES__)
      ? (scope.__SCHEDULE_FIXTURES__ as Array<ReturnType<typeof toDomainSchedule>>)
      : [];
    scope.__SCHEDULE_FIXTURES__ = append ? [...existing, ...schedules] : schedules;
  }, { schedules: fixtures, append: Boolean(options.append) });
}

export const toSharePointScheduleItems = (seeds: readonly DemoSchedule[]): SharePointScheduleItem[] =>
  seeds.map((item) => {
    const domain = toDomainSchedule(item);
    const start = item.startUtc;
    const end = item.endUtc;
    const dayKey = domain.dayKey ?? start.slice(0, 10).replace(/-/g, '');
    const monthKey = domain.monthKey ?? start.slice(0, 7).replace(/-/g, '');
    const fiscalYear = computeFiscalYearFromIso(start);
    const staffIds = domain.staffIds ?? [];
    const staffNames = domain.staffNames ?? undefined;
    const primaryStaffId = staffIds[0];

    const sharePointRecord: SharePointScheduleItem = {
      Id: item.id,
      Title: item.title,
      EventDate: start,
      EndDate: end,
      StartDateTime: start,
      EndDateTime: end,
      AllDay: item.allDay ?? false,
      Status: item.status ?? 'draft',
      Location: item.location ?? null,
      cr014_category: domain.category,
      cr014_serviceType: domain.serviceType,
      cr014_personType: domain.personType,
      cr014_personId: domain.personId ?? undefined,
      cr014_personName: domain.personName ?? undefined,
      cr014_staffIds: staffIds.length ? staffIds : undefined,
      cr014_staffNames: staffNames,
      cr014_dayKey: dayKey,
      MonthKey: monthKey,
      cr014_fiscalYear: fiscalYear,
      AssignedStaffId: primaryStaffId ?? undefined,
      AssignedStaff: staffNames && staffNames.length ? staffNames[0] : undefined,
      UserIdId: typeof domain.userId === 'number' ? domain.userId : undefined,
      TargetUserId: domain.userId ?? undefined,
      TargetUser: domain.personName ?? undefined,
      ...(item.sharePointExtra ?? {}),
    };

    return sharePointRecord;
  });

const SHAREPOINT_HEADERS = {
  'Content-Type': 'application/json;odata=nometadata; charset=utf-8',
  'Cache-Control': 'no-store',
};

const parseScheduleListUrl = (url: string): { remainder: string } | null => {
  const match = /\/_api\/web\/lists\/getbytitle\((%27|')(schedule(events)?|schedules)(%27|')\)(.*)$/i.exec(url);
  if (!match) return null;
  const remainder = match[5] ?? '';
  return { remainder };
};

export async function stubSharePointSchedules(page: Page, items: readonly SharePointScheduleItem[]) {
  const fixtures = [...items];
  await page.route('**/_api/web/lists/**', async (route) => {
    const url = route.request().url();
    const match = parseScheduleListUrl(url);
    if (!match) {
      await route.continue();
      return;
    }

    const remainder = match.remainder ?? '';

    if (!remainder || remainder === '/' || /^\?/.test(remainder)) {
      await route.fulfill({
        status: 200,
        headers: SHAREPOINT_HEADERS,
        body: JSON.stringify({
          Title: 'ScheduleEvents',
          Id: 'ScheduleEvents',
        }),
      });
      return;
    }

    const idMatch = /items\((\d+)\)/i.exec(remainder);
    if (idMatch) {
      const id = Number(idMatch[1]);
      const found = fixtures.find((item) => Number(item.Id) === id);
      await route.fulfill({
        status: found ? 200 : 404,
        headers: SHAREPOINT_HEADERS,
        body: JSON.stringify(found ?? {}),
      });
      return;
    }

  const target = new URL(url);
    const filterRaw = target.searchParams.get('$filter') ?? '';
    let filtered = fixtures;
    if (filterRaw.includes("cr014_category")) {
      const categoryMatch = /cr014_category\s+eq\s+'?(\w+)'?/i.exec(filterRaw);
      if (categoryMatch) {
        const desired = categoryMatch[1]?.toLowerCase();
        filtered = fixtures.filter((item) => {
          const category = String((item as Record<string, unknown>)['cr014_category'] ?? 'User').toLowerCase();
          return category === desired;
        });
      }
    }

    await route.fulfill({
      status: 200,
      headers: SHAREPOINT_HEADERS,
      body: JSON.stringify({ value: filtered }),
    });
  });
}

export async function seedSchedules(page: Page, items: readonly DemoSchedule[], options: { append?: boolean } = {}) {
  await seedSchedulesInApp(page, items, options);
  await stubSharePointSchedules(page, toSharePointScheduleItems(items));
}

export async function seedGraphSchedules(page: Page, items: readonly DemoSchedule[]) {
  await page.route('**/v1.0/me/calendarView**', async (route: Route) => {
    const body = {
      value: items.map((item) => ({
        id: `seed-${item.id}`,
        subject: item.title,
        start: { dateTime: item.startUtc, timeZone: 'UTC' },
        end: { dateTime: item.endUtc, timeZone: 'UTC' },
        location: item.location ? { displayName: item.location } : undefined,
      })),
    };

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

const DEMO_GRAPH_FIXTURES: DemoSchedule[] = [
  {
    id: 1001,
    title: 'デモ予定 A',
    startUtc: '2025-03-05T01:00:00Z',
    endUtc: '2025-03-05T02:00:00Z',
  },
  {
    id: 1002,
    title: 'デモ予定 B',
    startUtc: '2025-03-05T10:00:00Z',
    endUtc: '2025-03-05T11:00:00Z',
  },
];

export async function seedSchedulesDemo(page: Page) {
  await seedGraphSchedules(page, DEMO_GRAPH_FIXTURES);
}

