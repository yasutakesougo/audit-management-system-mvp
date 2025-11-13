import '@/test/captureSp400';
import { TESTIDS } from '@/testids';
import { expect, test, type Page } from '@playwright/test';
import { enableLiveEnv } from './_helpers/schedule';
import { waitForScheduleReady } from './utils/wait';

async function expectActiveElementTestId(page: Page, testId: string): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute?.('data-testid') ?? ''), {
      timeout: 10_000,
    })
    .toBe(testId);
}

async function readLiveMessage(page: Page): Promise<string> {
  return page.evaluate(() => {
    const polite = document.querySelector('[data-testid="live-polite"]')?.textContent ?? '';
    const assertive = document.querySelector('[data-testid="live-assertive"]')?.textContent ?? '';
    return (polite || assertive).trim();
  });
}

test.describe('Schedule week keyboard navigation', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (message) => {
      if (message.type() === 'info' && message.text().startsWith('[schedulesClient] fixtures=')) {
        // Forward fixture logs to the Playwright reporter to aid debugging when the mock layer changes.
        // eslint-disable-next-line no-console
        console.log(`browser-console: ${message.text()}`);
      }
      if (message.type() === 'error' && message.text().includes('SharePoint')) {
        // eslint-disable-next-line no-console
        console.log(`browser-console:error ${message.text()}`);
      }
    });

    page.on('requestfailed', (request) => {
      const failure = request.failure();
      // eslint-disable-next-line no-console
      console.log(`request-failed: ${request.url()} ${failure?.errorText ?? ''}`.trim());
    });

    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/_api/')) {
        // eslint-disable-next-line no-console
        console.log(`request: ${url}`);
      }
    });

    await enableLiveEnv(page);
  });

  test('ArrowLeft/ArrowRight move the visible week and trigger live updates', async ({ page }) => {
    await page.goto('/schedules/week', { waitUntil: 'domcontentloaded' });
    const envSnapshot = await page.evaluate(() => {
      const scope = window as typeof window & { __ENV__?: Record<string, string> };
      const processEnv = typeof process !== 'undefined' ? (process.env as Record<string, string | undefined>) : undefined;
      return {
        windowSkip: scope.__ENV__?.VITE_SKIP_LOGIN ?? null,
        processSkip: processEnv?.VITE_SKIP_LOGIN ?? null,
        inlineSkip: (globalThis as typeof globalThis & { __inlineSkip__?: string }).__inlineSkip__ ?? null,
        shouldSkip: (() => {
          try {
            const key = 'skipLogin';
            const raw = window.localStorage.getItem(key);
            return raw ?? null;
          } catch {
            return 'storage-error';
          }
        })(),
      };
    });
    // eslint-disable-next-line no-console
    console.log('env-snapshot', envSnapshot);
    await waitForScheduleReady(page);

    const root = page.getByTestId(TESTIDS['schedules-week-page']);
    const heading = page.getByTestId('schedules-week-heading');
    const livePolite = page.getByTestId('live-polite');
    const liveAssertive = page.getByTestId('live-assertive');

    const initialLabel = await page.evaluate(
      () => (window as typeof window & { __anchorLabel__?: string }).__anchorLabel__ ?? '',
    );
    const initialLive = await readLiveMessage(page);
    expect(initialLive).toContain(initialLabel);

    await expect(livePolite).toHaveAttribute('role', 'status');
    await expect(livePolite).toHaveAttribute('aria-live', 'polite');
    await expect(liveAssertive).toHaveAttribute('role', 'status');
    await expect(liveAssertive).toHaveAttribute('aria-live', 'assertive');

    await root.focus();
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? ''), { timeout: 3_000 })
      .toBe(TESTIDS['schedules-week-page']);
    await page.keyboard.press('ArrowRight');
    const keydownCountAfterNext = await page.evaluate(() => (window as typeof window & { __weekKeydown__?: number }).__weekKeydown__ ?? 0);
    expect(keydownCountAfterNext).toBeGreaterThan(0);
    const anchorLogAfterNext = await page.evaluate(() => (window as typeof window & { __anchorLog__?: string[] }).__anchorLog__ ?? []);
    // eslint-disable-next-line no-console
    console.log('anchor log', anchorLogAfterNext);
    const anchorLabelAfterNext = await page.evaluate(() => (window as typeof window & { __anchorLabel__?: string }).__anchorLabel__ ?? null);
    // eslint-disable-next-line no-console
    console.log('anchor label after next', anchorLabelAfterNext);
    expect(anchorLabelAfterNext).not.toBeNull();
    const anchorLabelAfterNextText = anchorLabelAfterNext ?? '';
    expect(anchorLabelAfterNextText).not.toBe(initialLabel);
    const focusImmediateAfterNext = await page.evaluate(
      () => (window as typeof window & { __focusImmediate__?: string | null }).__focusImmediate__ ?? null,
    );
    // eslint-disable-next-line no-console
    console.log('focus immediate after next', focusImmediateAfterNext);
    const focusDbgAfterNext = await page.evaluate(() => {
      const scope = window as typeof window & {
        __focusDbg__?: { events: string[]; attempts: string[]; active: string | null };
      };
      return scope.__focusDbg__ ?? { events: [], attempts: [], active: null };
    });
    // eslint-disable-next-line no-console
    console.log('focus debug after next', focusDbgAfterNext);
    const anchorStateAfterNext = await page.evaluate(
      () => (window as typeof window & { __anchorState__?: string }).__anchorState__ ?? null,
    );
    // eslint-disable-next-line no-console
    console.log('anchor state after next', anchorStateAfterNext);
    const urlAfterNext = await page.evaluate(() => window.location.search);
    // eslint-disable-next-line no-console
    console.log('url after next', urlAfterNext);
    const anchorFromParamsLog = await page.evaluate(
      () => (window as typeof window & { __anchorFromParams__?: string[] }).__anchorFromParams__ ?? [],
    );
    // eslint-disable-next-line no-console
    console.log('anchor from params log', anchorFromParamsLog);
    const anchorParamSetLog = await page.evaluate(
      () => (window as typeof window & { __anchorParamSet__?: string[] }).__anchorParamSet__ ?? [],
    );
    // eslint-disable-next-line no-console
    console.log('anchor param set log', anchorParamSetLog);
    await page.waitForTimeout(2000);
    const anchorLabelAfterTimeout = await page.evaluate(
      () => (window as typeof window & { __anchorLabel__?: string }).__anchorLabel__ ?? null,
    );
    // eslint-disable-next-line no-console
    console.log('anchor label after timeout', anchorLabelAfterTimeout);
    const anchorStateAfterTimeout = await page.evaluate(
      () => (window as typeof window & { __anchorState__?: string }).__anchorState__ ?? null,
    );
    // eslint-disable-next-line no-console
    console.log('anchor state after timeout', anchorStateAfterTimeout);
    const ignoredParams = await page.evaluate(
      () => (window as typeof window & { __anchorParamIgnored__?: string[] }).__anchorParamIgnored__ ?? [],
    );
    // eslint-disable-next-line no-console
    console.log('anchor param ignored log', ignoredParams);
    const anchorDebug = await page.evaluate(
      () => (window as typeof window & { __anchorDebug__?: string[] }).__anchorDebug__ ?? [],
    );
    // eslint-disable-next-line no-console
    console.log('anchor debug log', anchorDebug);
    const anchorAdoptLog = await page.evaluate(
      () => (window as typeof window & { __anchorAdopt__?: string[] }).__anchorAdopt__ ?? [],
    );
    // eslint-disable-next-line no-console
    console.log('anchor adopt log', anchorAdoptLog);
    const urlLog = await page.evaluate(() => (window as typeof window & { __urlLog__?: string[] }).__urlLog__ ?? []);
    // eslint-disable-next-line no-console
    console.log('url log', urlLog);
    await expect
      .poll(() => page.evaluate(() => (window as typeof window & { __anchorLabel__?: string }).__anchorLabel__ ?? ''), {
        timeout: 10_000,
      })
      .toBe(anchorLabelAfterNextText);
    await expect
      .poll(async () => (await heading.textContent()) ?? '', { timeout: 10_000 })
      .toContain(anchorLabelAfterNextText);
    await expect
      .poll(async () => readLiveMessage(page), { timeout: 10_000 })
      .toContain(anchorLabelAfterNextText);
    await waitForScheduleReady(page);

    const focusDbg = await page.evaluate(() => {
      const scope = window as typeof window & {
        __focusDbg__?: { events: string[]; attempts: string[]; active: string | null };
      };
      return scope.__focusDbg__ ?? { events: [], attempts: [], active: null };
    });
    const activeTag = await page.evaluate(() => document.activeElement?.tagName ?? null);
    const activeHtml = await page.evaluate(() => document.activeElement?.outerHTML ?? null);
    // eslint-disable-next-line no-console
    console.log('focus debug after ArrowRight attempt', focusDbg, 'tag', activeTag, 'html', activeHtml);

    await expectActiveElementTestId(page, TESTIDS['schedules-next']);

    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const scope = window as typeof window & {
              __focusDbg__?: { events: string[]; attempts: string[]; active: string | null };
            };
            return scope.__focusDbg__?.active ?? null;
          }),
        { timeout: 10_000 },
      )
      .toBe(TESTIDS['schedules-next']);
  });

  test('Arrow key debounce advances exactly one week', async ({ page }) => {
    await page.goto('/schedules/week', { waitUntil: 'domcontentloaded' });
    await waitForScheduleReady(page);

    const heading = page.getByTestId('schedules-week-heading');

    const initialHeadingText = (await heading.textContent()) ?? '';
    const match = initialHeadingText.match(/（(\d{4}\/\d{2}\/\d{2}) – (\d{4}\/\d{2}\/\d{2})）/);
    expect(match).not.toBeNull();
    if (!match) {
      throw new Error('Failed to parse initial heading text');
    }
    const [, startDate, endDate] = match;
    const toDate = (value: string) => {
      const [year, month, day] = value.split('/').map(Number);
      return new Date(Date.UTC(year, month - 1, day));
    };
    const formatDate = (value: Date) => {
      const year = value.getUTCFullYear();
      const month = String(value.getUTCMonth() + 1).padStart(2, '0');
      const day = String(value.getUTCDate()).padStart(2, '0');
      return `${year}/${month}/${day}`;
    };
    const expectedStartDate = toDate(startDate);
    expectedStartDate.setUTCDate(expectedStartDate.getUTCDate() + 7);
    const expectedEndDate = toDate(endDate);
    expectedEndDate.setUTCDate(expectedEndDate.getUTCDate() + 7);
    const expectedStart = formatDate(expectedStartDate);
    const expectedEnd = formatDate(expectedEndDate);

    const root = page.getByTestId(TESTIDS['schedules-week-page']);
    await root.focus();

    const anchorBefore = await page.evaluate(
      () => (window as typeof window & { __anchorState__?: string }).__anchorState__ ?? null,
    );

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');

    await page.waitForTimeout(350);
    await waitForScheduleReady(page);

    const [navCount, anchorAfter] = await page.evaluate(() => {
      const scope = window as typeof window & { __navCount__?: number; __anchorState__?: string };
      return [scope.__navCount__ ?? 0, scope.__anchorState__ ?? null];
    });

    expect(navCount).toBe(1);
    expect(anchorAfter).not.toBeNull();
    expect(anchorAfter).not.toBe(anchorBefore);

    const anchorLabel = await page.evaluate(
      () => (window as typeof window & { __anchorLabel__?: string }).__anchorLabel__ ?? '',
    );
    expect(anchorLabel).not.toBe('');
    await expect
      .poll(() => page.evaluate(() => (window as typeof window & { __anchorLabel__?: string }).__anchorLabel__ ?? ''), {
        timeout: 10_000,
      })
      .toBe(anchorLabel);

    await expect
      .poll(async () => (await heading.textContent()) ?? '', { timeout: 10_000 })
      .toContain(expectedStart);
    await expect
      .poll(async () => (await heading.textContent()) ?? '', { timeout: 10_000 })
      .toContain(expectedEnd);

    await expectActiveElementTestId(page, TESTIDS['schedules-next']);
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const scope = window as typeof window & {
              __focusDbg__?: { events: string[]; attempts: string[]; active: string | null };
            };
            return scope.__focusDbg__?.active ?? null;
          }),
        { timeout: 10_000 },
      )
      .toBe(TESTIDS['schedules-next']);
  });

  test('URL & heading update + input guard', async ({ page }) => {
    await page.goto('/schedules/week', { waitUntil: 'domcontentloaded' });
    await waitForScheduleReady(page);

    const container = page.getByTestId(TESTIDS['schedules-week-page']);
    const heading = page.getByTestId('schedules-week-heading');

    await container.focus();

    const urlBefore = page.url();
    const initialLabel = await page.evaluate(
      () => (window as typeof window & { __anchorLabel__?: string }).__anchorLabel__ ?? '',
    );
    const beforeHeadingText = (await heading.textContent()) ?? '';

    await page.keyboard.press('ArrowLeft');

    await expect
      .poll(() => page.evaluate(() => (window as typeof window & { __anchorLabel__?: string }).__anchorLabel__ ?? ''), {
        timeout: 10_000,
      })
      .not.toBe(initialLabel);

    const label = await page.evaluate(
      () => (window as typeof window & { __anchorLabel__?: string }).__anchorLabel__ ?? '',
    );
    expect(label).not.toBe('');

    await expect
      .poll(async () => (await heading.textContent()) ?? '', { timeout: 10_000 })
      .toContain(label);
    await expect
      .poll(async () => readLiveMessage(page), { timeout: 10_000 })
      .toContain(label);

    const labelStart = label.split(' – ')[0] ?? '';
    const expectedWeekParam = labelStart.replace(/\//g, '-');
    expect(expectedWeekParam).not.toBe('');
    await expect
      .poll(() => new URL(page.url()).searchParams.get('week'), { timeout: 10_000 })
      .toBe(expectedWeekParam);

    await waitForScheduleReady(page);

    expect(page.url()).not.toBe(urlBefore);
    await expect
      .poll(async () => (await heading.textContent()) ?? '', { timeout: 10_000 })
      .not.toBe(beforeHeadingText);

    const maybeInput = page.locator('input,textarea,select').first();
    if ((await maybeInput.count()) > 0) {
      await maybeInput.focus();
      const lockedWeek = new URL(page.url()).searchParams.get('week');
      await page.keyboard.press('ArrowRight');
      await expect
        .poll(() => new URL(page.url()).searchParams.get('week'), { timeout: 10_000 })
        .toBe(lockedWeek);
    }

    await expect
      .poll(async () => readLiveMessage(page), { timeout: 5_000 })
      .not.toBe('');
  });
});
