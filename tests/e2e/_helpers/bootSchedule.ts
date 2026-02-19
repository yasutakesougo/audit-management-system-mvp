import type { Page } from '@playwright/test';
import { mockEnsureScheduleList } from './mockEnsureScheduleList';
import { setupSharePointStubs } from './setupSharePointStubs';
import { setupPlaywrightEnv } from './setupPlaywrightEnv';
import { buildWeekScheduleFixtures, SCHEDULE_FIXTURE_BASE_DATE, buildStaffMorningFixture, buildUserMinimalFixture } from '../utils/schedule.fixtures';
import type { ScheduleItem } from '../utils/spMock';
import { seedSchedulesToday, seedSchedulesTodayForDemoAdapter } from './schedulesTodaySeed';

const FEATURE_ENV: Record<string, string> = {
  VITE_E2E: '1',
  VITE_E2E_MSAL_MOCK: '1',
  VITE_E2E_FORCE_SCHEDULES_WRITE: process.env.VITE_E2E_FORCE_SCHEDULES_WRITE ?? '0',
  VITE_SKIP_LOGIN: '1',
  VITE_SKIP_SHAREPOINT: process.env.VITE_SKIP_SHAREPOINT ?? '0',
  VITE_MSAL_CLIENT_ID: 'e2e-mock-client-id-12345678',
  VITE_MSAL_TENANT_ID: 'common',
  VITE_FEATURE_SCHEDULES: '1',
  VITE_FEATURE_SCHEDULES_WEEK_V2: '1',
  VITE_SCHEDULES_SAVE_MODE: 'mock',
  VITE_FEATURE_SCHEDULES_GRAPH: '0',
  VITE_FEATURE_SCHEDULES_SP: '0',
  VITE_FORCE_SHAREPOINT: '0',
  VITE_DEMO_MODE: '0',
  VITE_ALLOW_SHAREPOINT_OUTSIDE_SPFX: '1',
  // Clear group-based authz to keep edit flows enabled in E2E regardless of build-time env
  VITE_RECEPTION_GROUP_ID: '',
  VITE_SCHEDULE_ADMINS_GROUP_ID: '',
  MODE: 'production',
  DEV: '0',
  VITE_SCHEDULE_FIXTURES: '1',
  VITE_SCHEDULES_FIXTURES: '1',
};

const FEATURE_STORAGE: Record<string, string> = {
  'feature:schedules': '1',
  'feature:schedulesWeekV2': '1',
  'feature:schedulesSp': '0',
  'schedules:fixtures': '1',
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

type SetupSharePointOptions = NonNullable<Parameters<typeof setupSharePointStubs>[1]>;
type ListConfigArray = NonNullable<SetupSharePointOptions['lists']>;

export type ScheduleBootOptions = {
  date?: Date;
  scheduleItems?: ScheduleItem[];
  orgItems?: Array<Record<string, unknown>>;
  mode?: 'sharepoint' | 'fixtures';
  ui?: 'legacy' | 'weekV2' | 'auto';
  enableWeekV2?: boolean;
  ensureList?: boolean;
  env?: Record<string, string>;
  envOverrides?: Record<string, string>;
  storage?: Record<string, string>;
  storageOverrides?: Record<string, string>;
  resetLocalStorage?: boolean;
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
  const uiMode = options.ui ?? 'auto';
  const enableWeekV2 =
    uiMode === 'legacy' ? false : uiMode === 'weekV2' ? true : (options.enableWeekV2 ?? true);
  const ensureList = options.ensureList ?? true;
  const autoNavigate = options.autoNavigate ?? false;
  const route = options.route ?? '/schedules/day';
  const requireData = process.env.E2E_REQUIRE_SCHEDULE_DATA === '1';

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
    resetLocalStorage: options.resetLocalStorage,
  });

  if (ensureList) {
    await mockEnsureScheduleList(page);
  }

  let scheduleItems = options.scheduleItems ?? buildWeekScheduleFixtures(date);
  const orgItems = options.orgItems ?? DEFAULT_ORG_FIXTURES;

  if (seedOptions.schedulesToday) {
    const seedResult = await seedSchedulesToday(page);
    scheduleItems = seedResult.scheduleItems;
    // E2E fixture を demo adapter 用に注入
    await seedSchedulesTodayForDemoAdapter(page, { payload: seedResult.payload });
  }

  // If the environment requires at least one schedule item, ensure a minimal seed exists.
  if (requireData) {
    const userCount = Array.isArray(scheduleItems) ? scheduleItems.filter((item: ScheduleItem) => item.cr014_category === 'User').length : 0;

    if (!Array.isArray(scheduleItems) || scheduleItems.length === 0) {
      // If completely empty, inject both User and Staff
      scheduleItems = [buildUserMinimalFixture(date), buildStaffMorningFixture(date)];
    } else if (userCount === 0) {
      // If User items are missing, supplement with User seed
      scheduleItems = [buildUserMinimalFixture(date), ...scheduleItems];
    }
  }

  const sharePointOptions = options.sharePoint ?? {};
  const { extraLists, lists: inputLists, ...restSharePoint } = sharePointOptions;
  let overrideLists = inputLists;

  // If E2E_REQUIRE_SCHEDULE_DATA and overrideLists lacks User items, supplement them
  if (requireData && overrideLists) {
    overrideLists = overrideLists.map((cfg) => {
      const names = [cfg.name, ...(cfg.aliases ?? [])].map((n) => n.trim().toLowerCase());
      const isSchedule = names.some((n) =>
        n === 'schedules' || n === 'scheduleevents' || n === 'schedules_master' || n === 'supportschedule',
      );
      if (isSchedule && Array.isArray(cfg.items)) {
        const userCount = cfg.items.filter((item: ScheduleItem) => item.cr014_category === 'User').length;
        if (userCount === 0 && cfg.items.length > 0) {
          // Supplement with User seed if schedule list has items but no User items
          return {
            ...cfg,
            items: [buildUserMinimalFixture(date), ...cfg.items],
          };
        }
      }
      return cfg;
    });
  }

  let finalLists: ListConfigArray;
  if (overrideLists) {
    // Respect explicit overrides, but if E2E_REQUIRE_SCHEDULE_DATA is enabled and no schedule
    // list provides items, append a minimal seed list to guarantee at least one item.
    const hasScheduleWithItems = overrideLists.some((cfg) => {
      const names = [cfg.name, ...(cfg.aliases ?? [])].map((n) => n.trim().toLowerCase());
      const isSchedule = names.some((n) =>
        n === 'schedules' || n === 'scheduleevents' || n === 'schedules_master' || n === 'supportschedule',
      );
      return isSchedule && Array.isArray(cfg.items) && cfg.items.length > 0;
    });
    const seedNeeded = requireData && !hasScheduleWithItems;
    const seedList: ListConfigArray = seedNeeded
      ? [
          {
            name: 'Schedules_Master',
            aliases: ['Schedules', 'ScheduleEvents', 'SupportSchedule'],
            items: [buildUserMinimalFixture(date), buildStaffMorningFixture(date)],
          },
        ]
      : [];
    if (seedNeeded) {
      console.log(`[bootSchedule] E2E_REQUIRE_SCHEDULE_DATA override seed injected: ${[buildUserMinimalFixture(date), buildStaffMorningFixture(date)].length} items`);
    }
    finalLists = [...overrideLists, ...seedList, ...(extraLists ?? [])];
  } else {
    finalLists = [...buildDefaultLists(scheduleItems, orgItems), ...(extraLists ?? [])];
  }

  await setupSharePointStubs(page, {
    currentUser: { status: 200, body: { Id: 101 } },
    fallback: { status: 404, body: {} },
    ...restSharePoint,
    lists: finalLists,
  });


  if (autoNavigate) {
    await page.goto(route, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');
  }
}

// Backward compatibility: older specs still import bootSchedulePage.
export const bootSchedulePage = bootSchedule;
