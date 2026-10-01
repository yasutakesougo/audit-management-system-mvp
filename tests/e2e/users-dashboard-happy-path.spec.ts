import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { TESTIDS } from '../../src/testids';
import { bootUsersPage } from './_helpers/bootUsersPage.mts';

/**
 * Deterministic Users happy-path
 * Stage 1 → Stage 2 combined spec.
 *
 * Stage 1: Verify the seeded list renders exactly N rows using the shared JSON fixture.
 * Stage 2: Interact with the detail CTA (embedded panel + `/users/:userId` route).
 *
 * Seeds:
 *   - `tests/e2e/_fixtures/users.master.dev.v1.json`
 * Command:
 *   DEV_SERVER_PORT=5173 npx playwright test tests/e2e/users-dashboard-happy-path.spec.ts --reporter=line
 */

type UsersMasterSeed = {
  users: Array<{
    Id: number;
    UserID: string;
    FullName: string;
  }>;
};

const USERS_MASTER_FIXTURE_PATH = resolve(process.cwd(), 'tests/e2e/_fixtures/users.master.dev.v1.json');
const usersMasterSeed = JSON.parse(readFileSync(USERS_MASTER_FIXTURE_PATH, 'utf-8')) as UsersMasterSeed;
const SEEDED_USERS = usersMasterSeed.users;
const ACTIVE_USERS = SEEDED_USERS.filter((user) => user.IsActive !== false);
const DEMO_USER_IDS = ['I005', 'U-001', 'U-012', 'U-005'];

test.describe('users dashboard happy path (seeded)', () => {
  test('renders seeded list and navigates via detail CTA', async ({ page }) => {
    await bootUsersPage(page, { seed: { usersMaster: true } });

    const panelRoot = page.getByTestId(TESTIDS['users-panel-root']);
    await expect(panelRoot).toBeVisible();

    await page.getByRole('tab', { name: /利用者一覧/ }).click();

    const listTable = page.getByTestId(TESTIDS['users-list-table']);
    await expect(listTable).toBeVisible();
    const rowHandles = page.locator(`[data-testid^="${TESTIDS['users-list-table-row']}-"]`);
    await expect(rowHandles).toHaveCount(ACTIVE_USERS.length);

    for (const user of ACTIVE_USERS) {
      const rowCell = page.getByTestId(`${TESTIDS['users-list-table-row']}-${user.UserID}`);
      await expect(rowCell).toBeVisible();
      await expect(rowCell).toContainText(user.FullName);
    }

    const inactiveUser = SEEDED_USERS.find((user) => user.IsActive === false);
    if (inactiveUser) {
      await expect(
        page.getByTestId(`${TESTIDS['users-list-table-row']}-${inactiveUser.UserID}`),
      ).toHaveCount(0);
    }
    for (const userId of DEMO_USER_IDS) {
      await expect(page.locator(`[data-testid="${TESTIDS['users-list-table-row']}-${userId}"]`)).toHaveCount(0);
    }

    const targetUser = ACTIVE_USERS[0];
    const targetRowCell = page.getByTestId(`${TESTIDS['users-list-table-row']}-${targetUser.UserID}`);
    const targetRow = targetRowCell;
    await targetRow.click();

    const detailPane = page.getByTestId(TESTIDS['users-detail-pane']);
    await expect(detailPane).toContainText(targetUser.FullName);
    await expect(detailPane).toContainText(targetUser.UserID);

    await page.goto(`/users/${encodeURIComponent(targetUser.UserID)}`, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');
    const detailSections = page.getByTestId(TESTIDS['user-detail-sections']);
    await expect(detailSections).toBeVisible();
    await expect(detailSections).toContainText(targetUser.UserID);
  });
});
