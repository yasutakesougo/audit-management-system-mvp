import '@/test/captureSp400';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { TESTIDS } from '../../src/testids';
import { bootSchedule } from './_helpers/bootSchedule';
import { gotoDay } from './utils/scheduleNav';
import { waitForDayTimeline } from './utils/wait';

const DATE = new Date('2025-11-24');

test.describe('Schedule layout regression', () => {
  test.beforeEach(async ({ page }) => {
    await bootSchedule(page);
  });

  const getHeaderStickyGap = async (page: Page) =>
    page.evaluate(() => {
      const sticky = document.querySelector('.schedule-sticky') as HTMLElement | null;
      const titleNode = Array.from(document.querySelectorAll('p, h1, h2, span, div')).find((el) =>
        (el.textContent ?? '').includes('磯子区障害者地域活動ホーム'),
      ) as HTMLElement | undefined;

      const findHeaderShell = (node: HTMLElement | null | undefined): HTMLElement | null => {
        let current: HTMLElement | null = node ?? null;
        while (current) {
          const rect = current.getBoundingClientRect();
          if (rect.top <= 2 && rect.height >= 36 && rect.height <= 90) {
            return current;
          }
          current = current.parentElement;
        }
        return null;
      };

      const headerEl =
        findHeaderShell(titleNode) ??
        (document.querySelector('[data-testid="app-shell"] header') as HTMLElement | null) ??
        (document.querySelector('[data-testid="app-shell"] [class*="AppBar"]') as HTMLElement | null);

      const stickyRect = sticky?.getBoundingClientRect();
      const headerRect = headerEl?.getBoundingClientRect();

      return {
        stickyTop: stickyRect?.top ?? null,
        headerBottom: headerRect ? headerRect.top + headerRect.height : null,
        gap:
          stickyRect && headerRect
            ? stickyRect.top - (headerRect.top + headerRect.height)
            : null,
      };
    });

  test('day view has no top gap and main is the scroll area', async ({ page }) => {
    await gotoDay(page, DATE);
    await waitForDayTimeline(page);

    const sticky = page.locator('.schedule-sticky').first();
    await expect(sticky).toBeVisible();

    const geometry = await getHeaderStickyGap(page);
    expect(geometry.headerBottom).not.toBeNull();
    expect(geometry.stickyTop).not.toBeNull();
    expect(Math.abs(geometry.gap ?? 999)).toBeLessThanOrEqual(2);

    const scrollState = await page.evaluate(() => {
      const html = getComputedStyle(document.documentElement).overflowY;
      const body = getComputedStyle(document.body).overflowY;
      const main = document.querySelector('main');
      const mainOverflow = main ? getComputedStyle(main).overflowY : null;
      return { html, body, mainOverflow };
    });

    expect(['hidden', 'clip']).toContain(scrollState.html);
    expect(['hidden', 'clip']).toContain(scrollState.body);
    expect(['auto', 'scroll']).toContain(scrollState.mainOverflow ?? '');
  });

  test('day view keeps header-sticky alignment at 125% zoom equivalent', async ({ page }) => {
    await gotoDay(page, DATE);
    await waitForDayTimeline(page);

    await page.setViewportSize({ width: 1600, height: 900 });
    await page.evaluate(() => {
      document.documentElement.style.zoom = '1.25';
    });

    const sticky = page.locator('.schedule-sticky').first();
    await expect(sticky).toBeVisible();

    const geometry = await getHeaderStickyGap(page);
    expect(geometry.headerBottom).not.toBeNull();
    expect(geometry.stickyTop).not.toBeNull();
    expect(Math.abs(geometry.gap ?? 999)).toBeLessThanOrEqual(3);
  });

  test('dashboard shows footer quick action after shell refactor', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId(TESTIDS['handoff-footer-quicknote']).first()).toBeVisible();
  });

  test('dashboard keeps main-only scroll responsibility', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const scrollState = await page.evaluate(() => {
      const html = getComputedStyle(document.documentElement).overflowY;
      const body = getComputedStyle(document.body).overflowY;
      const main = document.querySelector('main');
      const mainOverflow = main ? getComputedStyle(main).overflowY : null;
      return {
        html,
        body,
        hasMain: Boolean(main),
        mainOverflow,
      };
    });

    expect(scrollState.hasMain).toBe(true);
    expect(['hidden', 'clip']).toContain(scrollState.html);
    expect(['hidden', 'clip']).toContain(scrollState.body);
    expect(['auto', 'scroll']).toContain(scrollState.mainOverflow ?? '');
  });

  test('daily table keeps main-only scroll responsibility', async ({ page }) => {
    test.skip(true, 'Skip layout regression check pending scroll architecture review');
    await page.goto('/daily/table');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/daily\/table/);

    const scrollState = await page.evaluate(() => {
      const html = getComputedStyle(document.documentElement).overflowY;
      const body = getComputedStyle(document.body).overflowY;
      const main = document.querySelector('main');
      const mainOverflow = main ? getComputedStyle(main).overflowY : null;
      const beforeWindowScrollY = window.scrollY;
      window.scrollTo(0, 240);
      const afterWindowScrollY = window.scrollY;

      return {
        html,
        body,
        hasMain: Boolean(main),
        mainOverflow,
        beforeWindowScrollY,
        afterWindowScrollY,
      };
    });

    expect(scrollState.hasMain).toBe(true);
    expect(['hidden', 'clip']).toContain(scrollState.html);
    expect(['hidden', 'clip']).toContain(scrollState.body);
    expect(scrollState.beforeWindowScrollY).toBeLessThanOrEqual(1);
    expect(scrollState.afterWindowScrollY).toBeLessThanOrEqual(1);
    expect(['auto', 'scroll']).toContain(scrollState.mainOverflow ?? '');
  });
});
