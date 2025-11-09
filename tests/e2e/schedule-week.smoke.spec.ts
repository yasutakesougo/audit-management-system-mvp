import { test, expect } from '@playwright/test';
import { runA11ySmoke } from './utils/a11y';
import { waitForTestId } from './utils/wait';

test.describe('Schedule week smoke', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (message) => {
      if (message.type() === 'info' && message.text().startsWith('[schedulesClient] fixtures=')) {
        // Echo fixture-mode logs to the Playwright reporter output for quick diagnosis.
        // eslint-disable-next-line no-console
        console.log(`browser-console: ${message.text()}`);
      }
    });

    await page.addInitScript(({ env, storage }) => {
      const scope = window as typeof window & { __ENV__?: Record<string, string> };
      scope.__ENV__ = {
        ...(scope.__ENV__ ?? {}),
        ...env,
      };
      for (const [key, value] of Object.entries(storage)) {
        window.localStorage.setItem(key, value);
      }
    }, {
      env: {
        VITE_E2E_MSAL_MOCK: '1',
        VITE_SKIP_LOGIN: '1',
        VITE_FEATURE_SCHEDULES: '1',
      },
      storage: {
        'feature:schedules': '1',
        skipLogin: '1',
      },
    });
  });

  test('renders week view, shows events or empty state, and passes Axe', async ({ page }) => {
    await page.goto('/schedules/week', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5_000 });

    // Page mounts with stable test id
    await waitForTestId(page, 'schedules-week-page');

    // Heading or period label should be present (implement with data-testid="schedules-week-heading")
    const heading = page.getByTestId('schedules-week-heading').or(page.getByRole('heading', { level: 1 }));
    await expect(heading.first()).toBeVisible();

    // Either a grid with items or an explicit empty state is rendered (both should be stable)
    const grid = page.getByTestId('schedules-week-grid');
    const empty = page.getByTestId('schedules-empty');
    const skeleton = page.getByTestId('schedules-week-skeleton');

    await expect(grid.or(empty).or(skeleton)).toBeVisible({ timeout: 10_000 });

    if (await skeleton.isVisible()) {
      await skeleton.waitFor({ state: 'detached', timeout: 10_000 }).catch(() => undefined);
    }

    await expect(grid.or(empty)).toBeVisible({ timeout: 10_000 });

    // If grid is present, basic sanity: at least 0+ items (do not assert >0 to allow fixture-less weeks)
    if (await grid.isVisible()) {
      // Optionally: check a cell/row structure
      const anyItem = page.locator('[data-testid="schedule-item"]').first();
      // Not hard-failing if absent; this is a smoke
      if ((await anyItem.count()) > 0) {
        await expect(anyItem).toBeVisible();
      }
    }

  // A11y baseline (no violations)
  await runA11ySmoke(page, 'Schedules Week', { selectors: '[data-testid="schedules-week-page"]' });
  });

  test('week navigation remains stable (prev/next)', async ({ page }) => {
    await page.goto('/schedules/week', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5_000 });
    await waitForTestId(page, 'schedules-week-page');

    // Use stable test ids for nav buttons (add them in your UI)
    const prev = page.getByTestId('schedules-week-prev');
    const next = page.getByTestId('schedules-week-next');

    // If buttons exist, they should navigate without layout thrash or empties
    if ((await prev.count()) > 0) {
      await prev.click();
      await expect(page.getByTestId('schedules-week-page')).toBeVisible();
    }
    if ((await next.count()) > 0) {
      await next.click();
      await expect(page.getByTestId('schedules-week-page')).toBeVisible();
    }
  });
});
