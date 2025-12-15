import { expect, test } from '@playwright/test';

import { prepareHydrationApp } from './_helpers/hydrationHud';
import { scrollAndClick, waitForAppRoot, waitVisible } from './utils/pageReady';

test.describe('Telemetry flush', () => {
  test('flushes spans via HUD and falls back on sendBeacon failure', async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      const win = window as typeof window & { __ENV__?: Record<string, string | undefined> };
      win.__ENV__ = {
        ...(win.__ENV__ ?? {}),
        VITE_TELEMETRY_SAMPLE: '1',
      };

      const state = { mode: 'success' as 'success' | 'throw', calls: 0 };
      const nav = navigator as Navigator & { __telemetry__?: typeof state };
      nav.__telemetry__ = state;
      const original = nav.sendBeacon?.bind(nav);
      nav.sendBeacon = (url, data) => {
        state.calls += 1;
        if (state.mode === 'throw') {
          state.mode = 'success';
          throw new Error('forced sendBeacon failure');
        }
        if (original) {
          return original(url, data);
        }
        return true;
      };
    });

    await prepareHydrationApp(page);

    const payloads: string[] = [];
    await page.route('**/__telemetry__', async (route) => {
      payloads.push(route.request().postData() ?? '');
      await route.fulfill({ status: 204, body: '' });
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForAppRoot(page, undefined, { testInfo, label: 'telemetry-app' });

    const hudToggle = page.getByTestId('prefetch-hud-toggle');
    await scrollAndClick(hudToggle, page, { testInfo, label: 'telemetry-hud-toggle' });

    const hud = page.getByTestId('hud-telemetry');
    await waitVisible(hud, page, { testInfo, label: 'telemetry-hud' });

    const flush = page.getByTestId('hud-telemetry-flush');
    await scrollAndClick(flush, page, { testInfo, label: 'telemetry-flush' });
    await expect.poll(() => payloads.length).toBeGreaterThanOrEqual(1);

    await page.evaluate(() => {
      const nav = navigator as Navigator & { __telemetry__?: { mode: 'success' | 'throw' } };
      if (nav.__telemetry__) {
        nav.__telemetry__.mode = 'throw';
      }
    });

    await scrollAndClick(flush, page, { testInfo, label: 'telemetry-flush-retry' });
    await expect.poll(() => payloads.length).toBeGreaterThanOrEqual(2);

    const telemetryCalls = await page.evaluate(() => {
      const nav = navigator as Navigator & { __telemetry__?: { calls: number } };
      return nav.__telemetry__?.calls ?? 0;
    });
    expect(telemetryCalls).toBeGreaterThanOrEqual(2);

    const parsed = payloads.map((body) => JSON.parse(body) as { spans?: Array<Record<string, unknown>> });
    expect(parsed[0]?.spans?.length ?? 0).toBeGreaterThan(0);
    expect(parsed[1]?.spans?.length ?? 0).toBeGreaterThan(0);
  });
});
