import { test } from '@playwright/test';
import { bootCallLogsPage } from './_helpers/bootCallLogsPage';
import { runA11ySmoke } from './utils/a11y';

const a11ySmokeRules = {
  runOnly: {
    type: 'rule' as const,
    values: ['aria-roles', 'button-name', 'color-contrast'],
  },
};

const modes = ['light', 'dark'] as const;
const states = ['empty', 'populated'] as const;

test.describe('call-logs a11y smoke', () => {
  for (const mode of modes) {
    for (const state of states) {
      test(`has no critical a11y violations (${mode}/${state})`, async ({ page }) => {
        await bootCallLogsPage(page, { mode, seedMode: state });

        await runA11ySmoke(page, `call-logs-a11y-smoke-${mode}-${state}`, {
          selectors: '#app-main-content',
          includeBestPractices: false,
          runOptions: a11ySmokeRules,
        });
      });
    }
  }
});
