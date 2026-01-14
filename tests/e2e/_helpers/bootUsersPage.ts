import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { setupPlaywrightEnv } from './setupPlaywrightEnv';
import { setupSharePointStubs } from './setupSharePointStubs';
import type { IUserMaster } from '../../../src/features/users/types';
import { DEMO_USERS } from '../../../src/features/users/constants';

const FEATURE_ENV: Record<string, string> = {
  VITE_FEATURE_USERS_CRUD: '1',
};

const FEATURE_STORAGE: Record<string, string> = {
  'feature:usersCrud': '1',
};

const USERS_MASTER_STORAGE_KEY = 'users.master.dev.v1';

type UsersMasterSeedPayload = {
  version?: string;
  generatedAt?: string;
  users?: IUserMaster[];
};

const USERS_MASTER_FIXTURE_PATH = resolve(process.cwd(), 'tests/e2e/_fixtures/users.master.dev.v1.json');
const usersMasterFixture = JSON.parse(readFileSync(USERS_MASTER_FIXTURE_PATH, 'utf-8')) as UsersMasterSeedPayload;

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

export type BootUsersOptions = {
  envOverrides?: Record<string, string>;
  storageOverrides?: Record<string, string>;
  demoUsers?: IUserMaster[];
  orgItems?: Array<Record<string, unknown>>;
  seed?: {
    usersMaster?: boolean;
  };
  route?: string;
  autoNavigate?: boolean;
  sharePoint?: Omit<SetupSharePointOptions, 'lists'> & {
    lists?: ListConfigArray;
    extraLists?: ListConfigArray;
  };
};

const buildDefaultLists = (
  users: IUserMaster[],
  orgItems: Array<Record<string, unknown>>,
): ListConfigArray => {
  const userItems = users.map((user) => ({ ...user })) as Array<Record<string, unknown>>;
  const readUserId = (item: Record<string, unknown>): string => String(item['UserID'] ?? '');

  return [
    {
      name: 'Users_Master',
      aliases: ['Users', 'UserDirectory', 'UserMaster'],
      items: userItems,
      sort: (items) => [...items].sort((a, b) => readUserId(a).localeCompare(readUserId(b))),
    },
    { name: 'Org_Master', items: orgItems },
  ];
};

export async function bootUsersPage(page: Page, options: BootUsersOptions = {}): Promise<void> {
  const envOverrides = { ...FEATURE_ENV, ...(options.envOverrides ?? {}) };
  const storageOverrides = { ...FEATURE_STORAGE, ...(options.storageOverrides ?? {}) };
  const shouldSeedUsers = options.seed?.usersMaster ?? false;
  const seededUsers = usersMasterFixture.users;
  const users = shouldSeedUsers && Array.isArray(seededUsers) && seededUsers.length > 0
    ? (seededUsers as IUserMaster[])
    : (options.demoUsers ?? DEMO_USERS);
  const orgItems = options.orgItems ?? DEFAULT_ORG_FIXTURES;
  const route = options.route ?? '/users';
  const shouldNavigate = options.autoNavigate !== false;

  await setupPlaywrightEnv(page, {
    envOverrides,
    storageOverrides,
  });

  // Ensure app is initialized by navigating to root first
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForLoadState('networkidle');

  if (shouldSeedUsers && Array.isArray(seededUsers)) {
    await page.addInitScript(
      ([key, payload]) => {
        try {
          window.localStorage.setItem(key, JSON.stringify(payload));
        } catch {
          // 念のため swallow。テスト側で fixture 未注入を検知できる。
        }
      },
      [USERS_MASTER_STORAGE_KEY, usersMasterFixture] as const,
    );
  }

  const sharePointOptions = options.sharePoint ?? {};
  const { lists: overrideLists, extraLists, ...rest } = sharePointOptions;
  const lists = overrideLists ?? [...buildDefaultLists(users, orgItems), ...(extraLists ?? [])];

  await setupSharePointStubs(page, {
    currentUser: { status: 200, body: { Id: 101 } },
    fallback: { status: 200, body: { value: [] } },
    ...rest,
    lists,
  });

  if (shouldNavigate) {
    await page.goto(route, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');
  }
}
