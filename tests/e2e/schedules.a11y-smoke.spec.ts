import { expect, test } from '@playwright/test';
import { TESTIDS } from '@/testids';
import { bootstrapScheduleEnv } from './utils/scheduleEnv';
import { gotoScheduleWeek } from './utils/scheduleWeek';
import { runA11ySmoke } from './utils/a11y';

const a11ySmokeRules = {
  runOnly: {
    type: 'rule' as const,
    values: ['aria-roles', 'button-name', 'color-contrast'],
  },
};

const modes = ['light', 'dark'] as const;

test.describe('schedules a11y smoke', () => {
  for (const mode of modes) {
    test(`week view has no critical a11y violations (${mode})`, async ({ page }) => {
      await bootstrapScheduleEnv(page, {
        enableWeekV2: true,
        storage: {
          app_color_mode: mode,
        },
      });

      await gotoScheduleWeek(page, new Date('2025-11-24'));
      await expect(page.getByTestId(TESTIDS['schedules-week-page'])).toBeVisible({ timeout: 15_000 });

      await runA11ySmoke(page, `schedules-week-a11y-smoke-${mode}`, {
        selectors: '#app-main-content',
        includeBestPractices: false,
        runOptions: a11ySmokeRules,
      });
    });
  }
});
