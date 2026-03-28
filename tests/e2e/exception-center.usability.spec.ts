import { expect, test, type Page } from '@playwright/test';
import { bootstrapDashboard } from './utils/bootstrapApp';

const E2E_SUGGESTIONS_STORAGE_KEY = 'e2e:corrective-suggestions.v1';
const SUGGESTION_STATE_STORAGE_KEY = 'action-engine.suggestion-states.v1';
const COLLAPSED_PARENTS_STORAGE_KEY = 'exception-collapsed-parents';

const modes = ['light', 'dark'] as const;

const seedSuggestions = [
  {
    id: 'seed-usability-1',
    stableId: 'ca-usability-1',
    type: 'assessment_update',
    priority: 'P1',
    targetUserId: 'U-001',
    title: '行動傾向の再評価を実施してください',
    reason: '直近の記録で増加傾向があります',
    evidence: {
      metric: '行動発生件数',
      currentValue: '5.0',
      threshold: '前週比 +30%',
      period: '直近7日',
    },
    cta: {
      label: 'アセスメントを確認',
      route: '/assessment?userId=U-001',
    },
    createdAt: '2026-03-28T00:00:00.000Z',
    ruleId: 'behavior-trend-increase',
  },
];

async function bootExceptionCenter(page: Page, mode: (typeof modes)[number]): Promise<void> {
  await page.addInitScript(
    ({ colorMode, suggestionsKey, suggestionStateKey, collapsedParentsKey, seededSuggestions }) => {
      const w = window as typeof window & { __ENV__?: Record<string, string> };
      w.__ENV__ = {
        ...(w.__ENV__ ?? {}),
        VITE_FEATURE_USERS_SP: '0',
      };

      window.localStorage.setItem('skipLogin', '1');
      window.localStorage.setItem('app_color_mode', colorMode);
      window.localStorage.removeItem(suggestionStateKey);
      window.localStorage.removeItem(collapsedParentsKey);
      window.localStorage.setItem(suggestionsKey, JSON.stringify(seededSuggestions));
    },
    {
      colorMode: mode,
      suggestionsKey: E2E_SUGGESTIONS_STORAGE_KEY,
      suggestionStateKey: SUGGESTION_STATE_STORAGE_KEY,
      collapsedParentsKey: COLLAPSED_PARENTS_STORAGE_KEY,
      seededSuggestions: seedSuggestions,
    },
  );

  await bootstrapDashboard(page, {
    skipLogin: true,
    initialPath: '/admin/exception-center',
  });

  await expect(page.getByTestId('exception-center-page')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('exception-table')).toBeVisible();
}

test.describe('exception-center usability', () => {
  for (const mode of modes) {
    test(`keyboard users can skip to main and reach table controls (${mode})`, async ({ page }) => {
      await bootExceptionCenter(page, mode);

      const skipLink = page.getByTestId('skip-to-main-link');

      await page.keyboard.press('Tab');
      await expect(skipLink).toBeFocused();

      await page.keyboard.press('Enter');
      await expect(page.locator('#app-main-content')).toBeFocused();

      let reachedTableControl = false;
      for (let i = 0; i < 20; i += 1) {
        await page.keyboard.press('Tab');
        const isControlFocused = await page.evaluate(() => {
          const active = document.activeElement as HTMLElement | null;
          if (!active) return false;
          const inExceptionTable = Boolean(active.closest('[data-testid="exception-table"]'));
          if (!inExceptionTable) return false;
          const role = active.getAttribute('role');
          return (
            active.tagName === 'BUTTON' ||
            role === 'button' ||
            role === 'combobox' ||
            role === 'switch'
          );
        });
        if (isControlFocused) {
          reachedTableControl = true;
          break;
        }
      }

      expect(reachedTableControl).toBe(true);
    });

    test(`mobile keeps table scroll inside container (${mode})`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await bootExceptionCenter(page, mode);

      const metrics = await page.evaluate(() => {
        const container = document.querySelector(
          '[data-testid="exception-table"] .MuiTableContainer-root',
        ) as HTMLElement | null;
        if (!container) return null;

        const style = window.getComputedStyle(container);
        const body = document.body;
        const headerCells = Array.from(container.querySelectorAll('thead th')).map((cell) =>
          (cell as HTMLElement).getBoundingClientRect().height,
        );

        return {
          overflowX: style.overflowX,
          clientWidth: container.clientWidth,
          scrollWidth: container.scrollWidth,
          bodyClientWidth: body.clientWidth,
          bodyScrollWidth: body.scrollWidth,
          headerCellCount: headerCells.length,
        };
      });

      expect(metrics).not.toBeNull();
      expect(metrics?.overflowX === 'auto' || metrics?.overflowX === 'scroll').toBe(
        true,
      );
      expect(metrics?.scrollWidth ?? 0).toBeGreaterThan(metrics?.clientWidth ?? 0);
      expect(metrics?.bodyScrollWidth ?? 0).toBeLessThanOrEqual(
        (metrics?.bodyClientWidth ?? 0) + 1,
      );
      expect(metrics?.headerCellCount ?? 0).toBeGreaterThan(0);
    });
  }
});
