import '@/test/captureSp400';
import { expect, test } from '@playwright/test';
import { TESTIDS } from '@/testids';
import { runA11ySmoke } from './utils/a11y';
import { bootstrapScheduleEnv } from './utils/scheduleEnv';
import { gotoScheduleWeek } from './utils/scheduleWeek';

test.describe('Schedule week smoke', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapScheduleEnv(page);

    // Ensure V2 is always used regardless of helper defaults
    await page.addInitScript(() => {
      localStorage.setItem('feature:schedules', '1');
      localStorage.setItem('feature:schedulesWeekV2', '1');
    });
  });

  test('renders week overview and passes Axe', async ({ page }) => {
    await gotoScheduleWeek(page, new Date('2025-11-24'));

    await expect(page.getByTestId('schedules-week-root')).toBeVisible();
    const weekRoot = page.getByTestId(TESTIDS.SCHEDULES_PAGE_ROOT).or(page.getByTestId(TESTIDS['schedules-week-page']));
    await expect(weekRoot).toBeVisible();

    const heading = page.getByTestId(TESTIDS['schedules-week-heading']);
    await expect(heading).toBeVisible();

    const grid = page.getByTestId(TESTIDS['schedules-week-grid']);
    await expect(grid).toBeVisible();
    await expect(grid.getByRole('gridcell').first()).toBeVisible();

    await runA11ySmoke(page, 'Schedules Week', {
      selectors: `[data-testid="${TESTIDS['schedules-week-page']}"]`,
      // Known contrast + focusable issues tracked in PDCA-2187; re-enable once tokens are updated.
      runOptions: {
        rules: {
          'color-contrast': { enabled: false },
          'scrollable-region-focusable': { enabled: false },
        },
      },
    });
  });

  test('week tab stays active when switching views', async ({ page }) => {
    await gotoScheduleWeek(page, new Date('2025-11-24'));

    const tablist = page.getByTestId(TESTIDS.SCHEDULES_WEEK_TABLIST);
    const weekTab = tablist.getByTestId(TESTIDS.SCHEDULES_WEEK_TAB_WEEK);
    const dayTab = tablist.getByTestId(TESTIDS.SCHEDULES_WEEK_TAB_DAY);

    await expect(dayTab).toBeVisible({ timeout: 15_000 });
    await dayTab.click();
    await expect(dayTab).toHaveAttribute('aria-selected', 'true');
    const dayPanel = page.locator('#panel-day');
    const dayPanelVisible = await dayPanel.isVisible().catch(() => false);
    if (dayPanelVisible) {
      await expect(dayPanel).toBeVisible({ timeout: 15_000 });
    } else {
      await expect(page.getByTestId(TESTIDS['schedules-week-grid'])).toBeVisible({ timeout: 15_000 });
    }

    await weekTab.click();
    await expect(weekTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId(TESTIDS['schedules-week-grid'])).toBeVisible({ timeout: 15_000 });
  });

  test('period controls shift the visible week headers', async ({ page }) => {
    await gotoScheduleWeek(page, new Date('2025-11-24'));
    const rangeLabel = page.getByTestId(TESTIDS.SCHEDULES_RANGE_LABEL);
    const readRange = async (): Promise<string> => (await rangeLabel.textContent())?.trim() ?? '';
    const initialRange = await readRange();
    expect(initialRange).toMatch(/表示期間/);

    const prevButton = page.getByRole('button', { name: '前の期間' });
    const nextButton = page.getByRole('button', { name: '次の期間' });

    await prevButton.click();
    await expect.poll(readRange, { timeout: 10_000 }).not.toBe(initialRange);

    await nextButton.click();
    await expect.poll(readRange, { timeout: 10_000 }).toBe(initialRange);
  });

  test('opens week view without infinite render loop (AppShell guard)', async ({ page }) => {
    // Guard against regression of "Maximum update depth exceeded" (AppShell role-sync fix)
    const fatalErrors: string[] = [];
    page.on('pageerror', (err) => {
      fatalErrors.push(`[pageerror] ${err.message}`);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore known non-fatal errors (SharePoint 404/403 in demo mode)
        if (text.includes('404') || text.includes('403') || text.includes('Failed to fetch')) {
          return;
        }
        fatalErrors.push(`[console.error] ${text}`);
      }
    });

    await gotoScheduleWeek(page, new Date('2025-11-24'));

    // Verify basic rendering (proves AppShell didn't crash)
    const weekPage = page.getByTestId(TESTIDS['schedules-week-page']);
    await expect(weekPage).toBeVisible({ timeout: 15_000 });

    const heading = page.getByTestId(TESTIDS['schedules-week-heading']);
    await expect(heading).toBeVisible({ timeout: 10_000 });

    // Critical assertion: No infinite loop errors
    const joined = fatalErrors.join('\n');
    expect(joined, 'Should not have infinite render loop').not.toMatch(/Maximum update depth exceeded/i);
    expect(joined, 'Should not have too many re-renders').not.toMatch(/Too many re-renders/i);
  });

  test('navigates between admin and staff role paths without loop', async ({ page }) => {
    const fatalErrors: string[] = [];
    page.on('pageerror', (err) => fatalErrors.push(`[pageerror] ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('404') && !msg.text().includes('403')) {
        fatalErrors.push(`[console.error] ${msg.text()}`);
      }
    });

    // Start at staff context
    await page.goto('/schedules/week', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId(TESTIDS['schedules-week-page'])).toBeVisible({ timeout: 15_000 });

    // Navigate to admin context
    await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000); // Allow role sync to settle

    // Navigate back to staff context
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Back to schedules (staff)
    await page.goto('/schedules/week', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId(TESTIDS['schedules-week-page'])).toBeVisible({ timeout: 10_000 });

    // No infinite loop errors should occur during role transitions
    const joined = fatalErrors.join('\n');
    expect(joined).not.toMatch(/Maximum update depth exceeded/i);
    expect(joined).not.toMatch(/Too many re-renders/i);
  });

  test('opens create dialog and saves (demo)', async ({ page }) => {
    // Demo mode: create → save → verify no crashes
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`));

    // Navigate directly to day view
    await page.goto('/schedules/day', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000); // Allow page to settle

    // Click create button (FAB) - only visible if user has permissions
    const fabButton = page.getByTestId(TESTIDS.SCHEDULES_FAB_CREATE);
    if (!(await fabButton.isVisible().catch(() => false))) {
      // Skip if not authorized (not reception/admin)
      return;
    }

    await fabButton.click();

    // Dialog opens
    const dialog = page.getByTestId(TESTIDS['schedule-create-dialog']);
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Fill title
    await dialog.getByTestId(TESTIDS['schedule-create-title']).fill('smoke test: 新規予定');

    // Save (start/end use default values from dialog initialization)
    const saveButton = dialog.getByTestId(TESTIDS['schedule-create-save']);
    await saveButton.click();

    // Wait a moment for save to process
    await page.waitForTimeout(1000);

    // Verify no crashes or infinite loops
    const errorsSummary = errors.join('\n');
    expect(errorsSummary).not.toContain('Maximum update depth exceeded');
    expect(errorsSummary).not.toContain('Too many re-renders');
  });
});
