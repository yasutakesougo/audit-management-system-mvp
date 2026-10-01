import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { TESTIDS } from '../../src/testids';
import { scrollAndClick, waitForAppRoot, waitVisible } from './utils/pageReady';
import { bootUsersPage } from './_helpers/bootUsersPage.mts';

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
const activeUsers = () => SEEDED_USERS.filter((user) => user.IsActive !== false);

test.describe('users search & filter (seeded)', () => {
  test('search narrows rows and filters by severity/active flags', async ({ page }, testInfo) => {
    await bootUsersPage(page, { seed: { usersMaster: true } });

      await waitForAppRoot(page, undefined, { testInfo, label: 'users-search-app' });
      await scrollAndClick(page.getByRole('tab', { name: /利用者一覧/ }), page, {
        testInfo,
        label: 'users-tab-list',
      });

      const panel = page.getByTestId(TESTIDS['users-panel-root']);
      await waitVisible(panel, page, { testInfo, label: 'users-panel-root' });
      const searchInput = panel.getByTestId(TESTIDS['users-panel-search']).locator('input');
      await waitVisible(searchInput, page, { testInfo, label: 'users-panel-search' });

      const rowHandles = page.locator(`[data-testid^="${TESTIDS['users-list-table-row']}-"]`);
      await expect(rowHandles).toHaveCount(countActive());
      for (const user of activeUsers()) {
        await expect(page.getByTestId(`${TESTIDS['users-list-table-row']}-${user.UserID}`)).toBeVisible();
      }
      const inactiveUser = SEEDED_USERS.find((user) => user.IsActive === false);
      if (inactiveUser) {
        await expect(page.getByTestId(`${TESTIDS['users-list-table-row']}-${inactiveUser.UserID}`)).toHaveCount(0);
      }

    const targetUser = activeUsers()[0];
    await searchInput.fill(targetUser.UserID);
    await expect(rowHandles).toHaveCount(1);
    await expect(page.getByTestId(`${TESTIDS['users-list-table-row']}-${targetUser.UserID}`)).toBeVisible();
    for (const user of activeUsers().filter((user) => user.UserID !== targetUser.UserID)) {
      await expect(page.getByTestId(`${TESTIDS['users-list-table-row']}-${user.UserID}`)).toHaveCount(0);
    }
    if (inactiveUser) {
      await expect(page.getByTestId(`${TESTIDS['users-list-table-row']}-${inactiveUser.UserID}`)).toHaveCount(0);
    }

    await searchInput.fill('');
    await expect(rowHandles).toHaveCount(countActive());

    const activeFilter = page.getByTestId(TESTIDS['users-panel-filter-active']);
    const severeFilter = page.getByTestId(TESTIDS['users-panel-filter-severe']);

    await activeFilter.click();
    await expect(rowHandles).toHaveCount(SEEDED_USERS.length);

    await severeFilter.click();
    await expect(rowHandles).toHaveCount(countSevere());

    await activeFilter.click();
    await expect(rowHandles).toHaveCount(countSevereAndActive());

    await severeFilter.click();
    await expect(rowHandles).toHaveCount(countActive());
  });
});
