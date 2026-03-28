import { expect, test } from '@playwright/test';
import { bootCallLogsPage, type CallLogsSeedMode } from './_helpers/bootCallLogsPage';

const modes = ['light', 'dark'] as const;
const states: CallLogsSeedMode[] = ['empty', 'populated'];

test.describe('call-logs usability', () => {
  for (const mode of modes) {
    for (const state of states) {
      test(`keyboard users can skip to main and reach call-log controls (${mode}/${state})`, async ({
        page,
      }) => {
        await bootCallLogsPage(page, { mode, seedMode: state });

        const skipLink = page.getByTestId('skip-to-main-link');

        await page.keyboard.press('Tab');
        await expect(skipLink).toBeFocused();

        await page.keyboard.press('Enter');
        await expect(page.locator('#app-main-content')).toBeFocused();

        let reachedControl = false;
        for (let i = 0; i < 16; i += 1) {
          await page.keyboard.press('Tab');
          const isControlFocused = await page.evaluate(() => {
            const active = document.activeElement as HTMLElement | null;
            if (!active) return false;
            const inCallLogPage = Boolean(active.closest('[data-testid="call-log-page"]'));
            if (!inCallLogPage) return false;
            const role = active.getAttribute('role');
            return (
              active.tagName === 'BUTTON' ||
              role === 'tab' ||
              role === 'button' ||
              role === 'combobox' ||
              role === 'switch'
            );
          });
          if (isControlFocused) {
            reachedControl = true;
            break;
          }
        }

        expect(reachedControl).toBe(true);
      });

      test(`mobile keeps layout within viewport and uses stacked filter bar (${mode}/${state})`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await bootCallLogsPage(page, { mode, seedMode: state });

        const metrics = await page.evaluate(() => {
          const body = document.body;
          const filterBar = document.querySelector(
            '[data-testid="call-log-filter-bar"]',
          ) as HTMLElement | null;
          const tabs = document.querySelector('[data-testid="call-log-tabs"]') as HTMLElement | null;
          const list = document.querySelector('[data-testid="call-log-list"]') as HTMLElement | null;

          const filterStyle = filterBar ? window.getComputedStyle(filterBar) : null;
          const tabsStyle = tabs ? window.getComputedStyle(tabs) : null;

          return {
            bodyClientWidth: body.clientWidth,
            bodyScrollWidth: body.scrollWidth,
            filterDirection: filterStyle?.flexDirection ?? null,
            tabsOverflowX: tabsStyle?.overflowX ?? null,
            hasList: Boolean(list),
          };
        });

        expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.bodyClientWidth + 1);
        expect(metrics.filterDirection).toBe('column');
        expect(metrics.tabsOverflowX === 'hidden' || metrics.tabsOverflowX === 'auto').toBe(
          true,
        );
        if (state === 'populated') {
          expect(metrics.hasList).toBe(true);
        }
      });
    }
  }
});
