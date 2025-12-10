import { expect, test } from '@playwright/test';
import { NURSE_USERS } from '../../src/features/nurse/users';
import { TESTIDS } from '../../src/testids';
import { bootNursePage } from './_helpers/bootNursePage';

test.skip(true, 'Legacy nurse observation query normalization waits for the v2 workspace.');

const getFirstActiveUser = () => {
  const fallback = NURSE_USERS.find((user) => user.isActive) ?? NURSE_USERS[0];
  if (!fallback) {
    throw new Error('NURSE_USERS is empty; cannot resolve fallback user for tests.');
  }
  return fallback;
};

test.describe('@ci-smoke nurse query normalization', () => {
  test.beforeEach(async ({ page }) => {
    await bootNursePage(page, { seed: { nurseDashboard: true } });
  });

  test('missing user/date -> falls back to first active and today', async ({ page }) => {
    const firstActive = getFirstActiveUser();
    await page.goto('/nurse/observation');

    await expect(page).toHaveURL(new RegExp(`user=${firstActive.id}`));
    const today = new Date().toISOString().slice(0, 10);
    await expect(page.url()).toMatch(new RegExp(`date=${today}`));
    await expect(page.getByTestId(TESTIDS.NURSE_OBS_USER)).toContainText(firstActive.id);
  });

  test('invalid user/date -> normalized in-place', async ({ page }) => {
    const firstActive = getFirstActiveUser();
    await page.goto('/nurse/observation?user=XYZ999&date=2025-13-99');

    await expect(page).toHaveURL(new RegExp(`user=${firstActive.id}`));
    const today = new Date().toISOString().slice(0, 10);
    await expect(page.url()).toMatch(new RegExp(`date=${today}`));
    await expect(page.getByTestId(TESTIDS.NURSE_OBS_USER)).toContainText(firstActive.id);
  });
});
