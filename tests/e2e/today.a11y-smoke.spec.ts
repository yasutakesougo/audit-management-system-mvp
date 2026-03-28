import { expect, test, type Page } from '@playwright/test';
import { TESTIDS } from '@/testids';
import { setupPlaywrightEnv } from './_helpers/setupPlaywrightEnv';
import { runA11ySmoke } from './utils/a11y';

const a11ySmokeRules = {
  runOnly: {
    type: 'rule' as const,
    values: ['aria-roles', 'button-name', 'color-contrast'],
  },
};

const modes = ['light', 'dark'] as const;

const bootTodayPage = async (page: Page, mode: (typeof modes)[number]): Promise<void> => {
  await setupPlaywrightEnv(page, {
    envOverrides: {
      VITE_SKIP_LOGIN: '1',
      VITE_E2E_MSAL_MOCK: '1',
      VITE_SKIP_SHAREPOINT: '1',
      VITE_DEMO_MODE: '1',
    },
    storageOverrides: {
      skipLogin: '1',
      demo: '1',
      app_color_mode: mode,
    },
  });

  await page.addInitScript(() => {
    (
      window as typeof window & {
        __E2E_TODAY_OPS_MOCK__?: boolean;
      }
    ).__E2E_TODAY_OPS_MOCK__ = true;
  });

  await page.route('/_api/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ d: { results: [] } }),
    }),
  );

  await page.goto('/today', { waitUntil: 'load' });
  await page.waitForLoadState('networkidle');
};

test.describe('today a11y smoke', () => {
  for (const mode of modes) {
    test(`has no critical a11y violations (${mode})`, async ({ page }) => {
      await bootTodayPage(page, mode);

      await expect(page.getByTestId(TESTIDS.TODAY_HERO)).toBeVisible({ timeout: 15_000 });

      await runA11ySmoke(page, `today-a11y-smoke-${mode}`, {
        selectors: '#app-main-content',
        includeBestPractices: false,
        runOptions: a11ySmokeRules,
      });
    });
  }
});
