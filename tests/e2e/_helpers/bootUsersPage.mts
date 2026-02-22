import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import type { TestInfo } from '@playwright/test';
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

export async function bootUsersPage(page: Page, options: BootUsersOptions = {}, _testInfo?: TestInfo): Promise<void> {
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

  // Bootstrap monitoring: JS/network failures + console errors logged on all CI runs
  const isDebug = process.env.E2E_DEBUG === '1' || process.env.CI === 'true';
  const reqFailed: string[] = [];
  const consoleErr: string[] = [];
  const pageErr: string[] = [];

  page.on('requestfailed', (req) => {
    const url = req.url();
    const type = req.resourceType();
    const failure = req.failure()?.errorText;
    if (type === 'script' || type === 'document' || type === 'stylesheet') {
      reqFailed.push(`[requestfailed] ${type} ${url} :: ${failure ?? 'unknown'}`);
    }
  });

  page.on('response', (res) => {
    const url = res.url();
    if ((url.endsWith('.js') || url.includes('/assets/')) && res.status() >= 400) {
      reqFailed.push(`[bad response] ${res.status()} ${url}`);
    }
  });

  page.on('pageerror', (err) => {
    pageErr.push(`[pageerror] ${String(err)}`);
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErr.push(`[console.error] ${msg.text()}`);
    }
  });

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

    // Verify: root element actually mounted after navigation
    // Only log on failure (root is empty) or when E2E_DEBUG enabled
    await page.waitForTimeout(200);
    const rootHtml = await page.locator('#root').innerHTML().catch(() => '');
    const isMounted = rootHtml && rootHtml.trim() !== '';

    if (!isMounted || isDebug) {
      if (!isMounted) {
        console.log('\n❌ ERROR [bootUsersPage]: React root is empty after navigation');
        console.log('  URL:', page.url());
        console.log('  Network failures:', reqFailed.slice(0, 5).join('\n  '));
        console.log('  Page errors:', pageErr.slice(0, 5).join('\n  '));
        console.log('  Console errors:', consoleErr.slice(0, 5).join('\n  '));

        try {
          const moduleScripts = await page.$$eval('script[type="module"]', (els) =>
            (els as HTMLScriptElement[]).map((e) => e.src || '[inline]'),
          );
          console.log('  Module scripts loaded:', moduleScripts.length);
        } catch {
          console.log('  Failed to inspect module scripts');
        }
      }

      if (isDebug && isMounted) {
        console.log('[bootUsersPage] DEBUG: Bootstrap complete, root mounted');
        console.log('  Network failures:', reqFailed.length);
        console.log('  Console errors:', consoleErr.length);
      }
    }
  }

  // CI: Always attach error logs for diagnostics (visible in artifacts)
  if (_testInfo && process.env.CI === 'true') {
    if (consoleErr.length > 0) {
      console.log('\n⚠️ [CI DIAGNOSTICS] Console Errors Captured:');
      consoleErr.forEach((err) => console.log('  ' + err));
      await _testInfo.attach('console-errors', {
        body: consoleErr.join('\n'),
        contentType: 'text/plain',
      });
    }
    if (pageErr.length > 0) {
      console.log('\n⚠️ [CI DIAGNOSTICS] Page Errors Captured:');
      pageErr.forEach((err) => console.log('  ' + err));
      await _testInfo.attach('page-errors', {
        body: pageErr.join('\n'),
        contentType: 'text/plain',
      });
    }
    if (reqFailed.length > 0) {
      console.log('\n⚠️ [CI DIAGNOSTICS] Network Failures Captured:');
      reqFailed.slice(0, 10).forEach((err) => console.log('  ' + err));
      await _testInfo.attach('request-failures', {
        body: reqFailed.join('\n'),
        contentType: 'text/plain',
      });
    }
  }
}
