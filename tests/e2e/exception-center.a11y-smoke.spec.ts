import { expect, test } from '@playwright/test';
import { bootstrapDashboard } from './utils/bootstrapApp';
import { runA11ySmoke } from './utils/a11y';

const a11ySmokeRules = {
  runOnly: {
    type: 'rule' as const,
    values: ['aria-roles', 'button-name', 'color-contrast'],
  },
};

const modes = ['light', 'dark'] as const;

test.describe('exception-center a11y smoke', () => {
  for (const mode of modes) {
    test(`has no critical a11y violations (${mode})`, async ({ page }) => {
      await page.addInitScript((colorMode) => {
        window.localStorage.setItem('app_color_mode', colorMode);
      }, mode);

      await bootstrapDashboard(page, {
        skipLogin: true,
        dataProvider: 'memory',
        initialPath: '/admin/exception-center',
      });

      await expect(page.getByTestId('exception-center-page')).toBeVisible({
        timeout: 20_000,
      });

      await runA11ySmoke(page, `exception-center-a11y-smoke-${mode}`, {
        selectors: '#app-main-content',
        includeBestPractices: false,
        runOptions: a11ySmokeRules,
      });
    });
  }
});
