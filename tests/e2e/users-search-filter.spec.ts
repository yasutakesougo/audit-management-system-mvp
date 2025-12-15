import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { TESTIDS } from '../../src/testids';
import { scrollAndClick, waitForAppRoot, waitVisible } from './utils/pageReady';
import { bootUsersPage } from './_helpers/bootUsersPage';

type UsersMasterSeed = {
  users: Array<{
    UserID: string;
    FullName?: string;
    IsActive?: boolean | null;
    IsHighIntensitySupportTarget?: boolean | null;
    severeFlag?: boolean | null;
  }>;
};

const USERS_MASTER_FIXTURE_PATH = resolve(process.cwd(), 'tests/e2e/_fixtures/users.master.dev.v1.json');
const usersMasterSeed = JSON.parse(readFileSync(USERS_MASTER_FIXTURE_PATH, 'utf-8')) as UsersMasterSeed;
const SEEDED_USERS = usersMasterSeed.users;

const countActive = () => SEEDED_USERS.filter((user) => user.IsActive !== false).length;
const countSevere = () =>
  SEEDED_USERS.filter((user) => {
    const severeFlag = user.severeFlag ?? user.IsHighIntensitySupportTarget;
    return Boolean(severeFlag);
  }).length;
const countSevereAndActive = () =>
  SEEDED_USERS.filter((user) => {
    const severeFlag = user.severeFlag ?? user.IsHighIntensitySupportTarget;
    return user.IsActive !== false && Boolean(severeFlag);
  }).length;

test.describe('users search & filter (seeded)', () => {
  test('search narrows rows and filters by severity/active flags', async ({ page }, testInfo) => {
    await bootUsersPage(page, { seed: { usersMaster: true } });

      await waitForAppRoot(page, undefined, { testInfo, label: 'users-search-app' });
      await scrollAndClick(page.getByRole('tab', { name: /利用者一覧/ }), page, {
        testInfo,
        label: 'users-tab-list',
      });

      const maybeOpen = page.getByTestId(TESTIDS['users-panel-open']);
      const openCount = await maybeOpen.count().catch(() => 0);
      if (openCount > 0) {
        await scrollAndClick(maybeOpen, page, { testInfo, label: 'users-panel-open' });
      }

      const panel = page.getByTestId(TESTIDS['users-panel-root']);
      await waitVisible(panel, page, { testInfo, label: 'users-panel-root' });

      const rowHandles = page.locator(`[data-testid^="${TESTIDS['users-list-table-row']}-"]`);
      await expect(rowHandles).toHaveCount(SEEDED_USERS.length);

      const searchInput = panel.getByTestId(TESTIDS['users-panel-search']);
    const targetUser = SEEDED_USERS[0];
    await searchInput.fill(targetUser.UserID);
    await expect(rowHandles).toHaveCount(1);
    await expect(page.getByTestId(`${TESTIDS['users-list-table-row']}-${targetUser.UserID}`)).toBeVisible();

    await searchInput.fill('');
    await expect(rowHandles).toHaveCount(SEEDED_USERS.length);

    const activeFilter = page.getByTestId(TESTIDS['users-panel-filter-active']);
    const severeFilter = page.getByTestId(TESTIDS['users-panel-filter-severe']);

    await activeFilter.click();
    await expect(rowHandles).toHaveCount(countActive());

    await severeFilter.click();
    await expect(rowHandles).toHaveCount(countSevereAndActive());

    await activeFilter.click();
    await expect(rowHandles).toHaveCount(countSevere());

    await severeFilter.click();
    await expect(rowHandles).toHaveCount(SEEDED_USERS.length);
  });
});
