import type { Page } from '@playwright/test';
import { mockEnsureScheduleList } from './mockEnsureScheduleList';
import { setupSharePointStubs } from './setupSharePointStubs';
import { setupPlaywrightEnv } from './setupPlaywrightEnv';
import { buildWeekScheduleFixtures, SCHEDULE_FIXTURE_BASE_DATE } from '../utils/schedule.fixtures';
import type { ScheduleItem } from '../utils/spMock';
import { seedSchedulesToday } from './schedulesTodaySeed';

const FEATURE_ENV: Record<string, string> = {
  VITE_E2E_MSAL_MOCK: '1',
  VITE_SKIP_LOGIN: '1',
  VITE_FEATURE_SCHEDULES: '1',
  VITE_FEATURE_SCHEDULES_WEEK_V2: '1',
  VITE_FEATURE_SCHEDULES_GRAPH: '0',
  VITE_FEATURE_SCHEDULES_SP: '1',
  VITE_FORCE_SHAREPOINT: '1',
  VITE_SKIP_SHAREPOINT: '0',
  VITE_DEMO_MODE: '0',
  MODE: 'production',
  DEV: '0',
  VITE_SP_RESOURCE: 'https://contoso.sharepoint.com',
  VITE_SP_SITE_RELATIVE: '/sites/AuditSystem',
  VITE_SP_SCOPE_DEFAULT: 'https://contoso.sharepoint.com/AllSites.Read',
  VITE_SCHEDULE_FIXTURES: '0',
  VITE_SCHEDULES_FIXTURES: '0',
};

const FEATURE_STORAGE: Record<string, string> = {
  'feature:schedules': '1',
  'feature:schedulesWeekV2': '1',
  'feature:schedulesSp': '1',
  'schedules:fixtures': '0',
  skipLogin: '1',
  demo: '0',
};

const DEFAULT_ORG_FIXTURES = [
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

type SetupSharePointOptions = Parameters<typeof setupSharePointStubs>[1];
type ListConfigArray = NonNullable<SetupSharePointOptions['lists']>;

export type ScheduleBootOptions = {
  date?: Date;
  scheduleItems?: ScheduleItem[];
  orgItems?: Array<Record<string, unknown>>;
  mode?: 'sharepoint' | 'fixtures';
  enableWeekV2?: boolean;
  ensureList?: boolean;
  env?: Record<string, string>;
  envOverrides?: Record<string, string>;
  storage?: Record<string, string>;
  storageOverrides?: Record<string, string>;
  sharePoint?: Omit<SetupSharePointOptions, 'lists'> & {
    lists?: ListConfigArray;
    extraLists?: ListConfigArray;
  };
  seed?: {
    schedulesToday?: boolean;
  };
  autoNavigate?: boolean;
  route?: string;
};

const buildDefaultLists = (scheduleItems: ScheduleItem[], orgItems: Array<Record<string, unknown>>): ListConfigArray => [
  {
    name: 'Schedules_Master',
    aliases: ['Schedules', 'ScheduleEvents', 'SupportSchedule'],
    items: scheduleItems,
  },
  { name: 'Org_Master', items: orgItems },
  { name: 'SupportRecord_Daily', items: [] },
  { name: 'StaffDirectory', items: [] },
];

export async function bootSchedule(page: Page, options: ScheduleBootOptions = {}): Promise<void> {
  const date = options.date ?? SCHEDULE_FIXTURE_BASE_DATE;
  const seedOptions = options.seed ?? {};
  const mode = options.mode ?? 'sharepoint';
  const enableWeekV2 = options.enableWeekV2 ?? true;
  const ensureList = options.ensureList ?? true;
  const autoNavigate = options.autoNavigate ?? false;
  const route = options.route ?? '/schedules/day';

  const envOverrides = {
    ...FEATURE_ENV,
    VITE_FEATURE_SCHEDULES_WEEK_V2: enableWeekV2 ? '1' : '0',
    VITE_FEATURE_SCHEDULES_SP: mode === 'sharepoint' ? '1' : '0',
    VITE_SCHEDULE_FIXTURES: mode === 'sharepoint' ? '0' : '1',
    VITE_SCHEDULES_FIXTURES: mode === 'sharepoint' ? '0' : '1',
    ...(options.env ?? {}),
    ...(options.envOverrides ?? {}),
  };

  const storageOverrides = {
    ...FEATURE_STORAGE,
    'feature:schedulesWeekV2': enableWeekV2 ? '1' : '0',
    'feature:schedulesSp': mode === 'sharepoint' ? '1' : '0',
    'schedules:fixtures': mode === 'sharepoint' ? '0' : '1',
    ...(options.storage ?? {}),
    ...(options.storageOverrides ?? {}),
  };

  await setupPlaywrightEnv(page, {
    envOverrides,
    storageOverrides,
  });

  if (ensureList) {
    await mockEnsureScheduleList(page);
  }

  let scheduleItems = options.scheduleItems ?? buildWeekScheduleFixtures(date);
  const orgItems = options.orgItems ?? DEFAULT_ORG_FIXTURES;

  if (seedOptions.schedulesToday) {
    const seedResult = await seedSchedulesToday(page);
    scheduleItems = seedResult.scheduleItems;
  }

  const sharePointOptions = options.sharePoint ?? {};
  const { extraLists, lists: overrideLists, ...restSharePoint } = sharePointOptions;
  const lists = overrideLists ?? [...buildDefaultLists(scheduleItems, orgItems), ...(extraLists ?? [])];

  await setupSharePointStubs(page, {
    currentUser: { status: 200, body: { Id: 101 } },
    fallback: { status: 404, body: {} },
    ...restSharePoint,
    lists,
  });

  if (autoNavigate) {
    await page.goto(route, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');
  }
}

// Backward compatibility: older specs still import bootSchedulePage.
export const bootSchedulePage = bootSchedule;
