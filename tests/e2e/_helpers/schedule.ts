import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

/** Locates a User category timeline card containing the given text and asserts the status enum. */
export async function expectUserCardStatusEnum(page: Page, containsText: string, expectedEnum: string): Promise<Locator> {
  const card = page
    .locator('[data-testid^="event-card-"][data-category="User"]')
    .filter({ hasText: containsText })
    .first();

  await expect(card, `User card containing "${containsText}" not found`).toBeVisible({ timeout: 10_000 });

  const chip = card.getByTestId('status-chip');
  await expect(chip, `User card(${containsText}) status should be ${expectedEnum}`).toHaveAttribute(
    'data-status-enum',
    expectedEnum
  );

  return card;
}

/**
 * Live環境設定でのE2Eサンドボックスを準備
 *
 * NOTE: "live" 設定だが、SharePoint APIはfetchモックで完全スタブ。
 * 実際の本番SPには一切リクエストを飛ばさない "Live-config E2E sandbox" 用。
 * 外向きは live 設定、内側は e2e サンドボックスとして動作する。
 *
 * @param page - Playwright Page オブジェクト
 * @param options - 設定オプション
 */
export async function enableLiveEnv(page: Page, options?: { mockSharePoint?: boolean }): Promise<void> {
  const { mockSharePoint = true } = options ?? {};

  await page.addInitScript(({ mockSharePoint }) => {
    const w = window as typeof window & { __ENV__?: Record<string, string> };
    w.__ENV__ = {
      ...(w.__ENV__ ?? {}),
      VITE_E2E_MSAL_MOCK: '0',
      VITE_SKIP_LOGIN: '0',
      VITE_FEATURE_SCHEDULES: '1',
      // NOTE: 移行期互換のため、旧VITE_SCHEDULE_FIXTURES / 新VITE_SCHEDULES_FIXTURES の両方をOFF
      VITE_SCHEDULE_FIXTURES: '0',
      VITE_SCHEDULES_FIXTURES: '0',
      VITE_SP_RESOURCE: 'https://isogokatudouhome.sharepoint.com',
      VITE_SP_SITE_RELATIVE: '/sites/welfare',
      VITE_SP_SITE_ID: '5dac33c9-5fe9-470c-bf80-77cd83f30869',
    };

    (window as typeof window & { __FOCUS_GUARD_MS__?: number }).__FOCUS_GUARD_MS__ = 8_000;
    (window as typeof window & { __routeFocusRestore__?: boolean }).__routeFocusRestore__ = true;

    const account = {
      homeAccountId: 'live-e2e-home-account',
      localAccountId: 'live-e2e-local-account',
      environment: 'sharepoint-live',
      tenantId: 'live-e2e-tenant',
      username: 'live.e2e@example.com',
      name: 'Live E2E User',
    };

    const msalPatch = (instance: Record<string, unknown>) => {
      instance.initialize = async () => undefined;
      instance.handleRedirectPromise = async () => null;
      instance.getActiveAccount = () => account;
      instance.getAllAccounts = () => [account];
      instance.setActiveAccount = () => undefined;
      instance.loginPopup = async () => ({ account });
      instance.acquireTokenPopup = async () => ({ account, accessToken: 'mock-live-token' });
      instance.acquireTokenSilent = async () => ({ accessToken: 'mock-live-token' });
      return instance;
    };

    let msalRef: Record<string, unknown> | undefined;
    Object.defineProperty(globalThis, '__MSAL_PUBLIC_CLIENT__', {
      configurable: true,
      get() {
        return msalRef;
      },
      set(value) {
        if (value && typeof value === 'object') {
          msalRef = msalPatch(value as Record<string, unknown>);
        } else {
          msalRef = value as Record<string, unknown> | undefined;
        }
      },
    });

    if (typeof process === 'undefined') {
      Object.defineProperty(globalThis, 'process', {
        configurable: true,
        value: { env: { PLAYWRIGHT_TEST: '1' } },
      });
    } else if (process && process.env) {
      process.env.PLAYWRIGHT_TEST = '1';
    }

    window.localStorage.removeItem('schedules:fixtures');
    window.localStorage.removeItem('skipLogin');
    window.localStorage.setItem('feature:schedules', '1');
    window.localStorage.setItem('hydration:disable', '1');

    try {
      window.sessionStorage.setItem('spToken', 'mock-live-token');
    } catch {
      // ignore sandbox sessionStorage failures
    }

    if (typeof window.history?.replaceState === 'function') {
      const originalReplaceState = window.history.replaceState.bind(window.history);
      window.history.replaceState = (data, unused, url) => {
        try {
          const scope = window as typeof window & { __urlLog__?: string[] };
          scope.__urlLog__ = [...(scope.__urlLog__ ?? []), new URL(url ?? window.location.href, window.location.href).search];
        } catch {
          // ignore logging failure
        }
        return originalReplaceState(data, unused, url);
      };
    }

    if (mockSharePoint) {
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const url = (() => {
          if (typeof input === 'string') return input;
          if (input instanceof URL) return input.href;
          if (typeof Request !== 'undefined' && input instanceof Request) return input.url;
          return '';
        })();
        if (/\/(_api\/web|sharepoint-api)\//.test(url)) {
          const body = JSON.stringify({ value: [] });
          return new Response(body, {
            status: 200,
            headers: {
              'Content-Type': 'application/json;odata=nometadata',
            },
          });
        }
        return originalFetch(input, init);
      };
    }
  }, { mockSharePoint });
}
