import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { TESTIDS } from '../../src/testids';
import { bootUsersPage } from './_helpers/bootUsersPage';

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

test.describe('users dashboard happy path (seeded)', () => {
  test('renders seeded list and navigates via detail CTA', async ({ page }) => {
    await bootUsersPage(page, { seed: { usersMaster: true } });

    const panelRoot = page.getByTestId(TESTIDS['users-panel-root']);
    await expect(panelRoot).toBeVisible();

    await page.getByRole('tab', { name: /利用者一覧/ }).click();

    const listTable = page.getByTestId(TESTIDS['users-list-table']);
    await expect(listTable).toBeVisible();
    const rowHandles = page.locator(`[data-testid^="${TESTIDS['users-list-table-row']}-"]`);
    await expect(rowHandles).toHaveCount(SEEDED_USERS.length);

    for (const user of SEEDED_USERS) {
      const rowCell = page.getByTestId(`${TESTIDS['users-list-table-row']}-${user.UserID}`);
      await expect(rowCell).toContainText(String(user.Id));
    }

    const targetUser = SEEDED_USERS.find((user) => user.UserID === 'UX-020') ?? SEEDED_USERS[SEEDED_USERS.length - 1];
    const targetRowCell = page.getByTestId(`${TESTIDS['users-list-table-row']}-${targetUser.UserID}`);
    const targetRow = targetRowCell.locator('xpath=ancestor::tr');
    await targetRow.locator('[aria-label="詳細"]').click();

    const detailPane = page.getByTestId(TESTIDS['users-detail-pane']);
    await expect(detailPane).toContainText(targetUser.FullName);
    await expect(detailPane).toContainText(targetUser.UserID);

    await page.goto(`/users/${encodeURIComponent(targetUser.UserID)}`, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');
    const detailSections = page.getByTestId(TESTIDS['user-detail-sections']);
    await expect(detailSections).toBeVisible();
    await expect(detailSections).toContainText(`利用者コード: ${targetUser.UserID}`);
  });
});
