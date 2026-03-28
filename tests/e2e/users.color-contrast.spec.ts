import { expect, test } from '@playwright/test';
import { bootUsersPage } from './_helpers/bootUsersPage.mts';
import { runA11ySmoke } from './utils/a11y';

const colorContrastOnly = {
  runOnly: {
    type: 'rule' as const,
    values: ['color-contrast'],
  },
};

const modes = ['light', 'dark'] as const;

test.describe('users color contrast', () => {
  for (const mode of modes) {
    test(`has zero color-contrast violations in skip-login mode (${mode})`, async ({ page }) => {
      await bootUsersPage(page, {
        route: '/users?tab=list',
        autoNavigate: true,
        storageOverrides: {
          app_color_mode: mode,
        },
      });

      await expect(page.getByTestId('users-panel-root')).toBeVisible({ timeout: 10_000 });
      await runA11ySmoke(page, `users-color-contrast-skip-login-${mode}`, {
        includeBestPractices: false,
        runOptions: colorContrastOnly,
      });
    });
    test(`has zero color-contrast violations in signed-out mode (${mode})`, async ({ page }) => {
      await bootUsersPage(page, {
        route: '/users?tab=list',
        autoNavigate: true,
        envOverrides: {
          VITE_SKIP_LOGIN: '0',
          VITE_E2E_MSAL_MOCK: '0',
          VITE_DEMO_MODE: '0',
          VITE_SKIP_SHAREPOINT: '0',
          VITE_FORCE_SHAREPOINT: '1',
        },
        storageOverrides: {
          skipLogin: '0',
          demo: '0',
          app_color_mode: mode,
        },
      });

      await expect(page.getByRole('button', { name: 'サインイン' })).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole('button', { name: 'サインアウト' })).toHaveCount(0);

      await runA11ySmoke(page, `users-color-contrast-signed-out-${mode}`, {
        includeBestPractices: false,
        runOptions: colorContrastOnly,
      });
    });
  }
});
