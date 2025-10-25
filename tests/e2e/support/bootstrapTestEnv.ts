import type { Page } from '@playwright/test';

type BootstrapOptions = {
  /** skip MSAL login & SP health probe, render in local/demo mode */
  skipLogin?: boolean;
  /** short-circuit SharePoint fetches to deterministic stubs */
  mockSharePoint?: boolean;
  /** feature flags to flip before app boot */
  flags?: Partial<Record<string, boolean>>;
  /** seed local/session storage (runs before app boot) */
  storage?: {
    local?: Record<string, string>;
    session?: Record<string, string>;
  };
};

const FLAG_ENV_KEYS: Record<string, string> = {
  schedules: 'VITE_FEATURE_SCHEDULES',
  schedulesCreate: 'VITE_FEATURE_SCHEDULES_CREATE',
  timeflowV2: 'VITE_FEATURE_TIMEFLOW_V2',
  records: 'VITE_FEATURE_RECORDS',
};

/**
 * One-call test bootstrap:
 * - Seeds feature flags & app toggles
 * - Blocks MSAL redirects
 * - Mocks SharePoint endpoints (optional)
 * - Ensures helpers/selectors are ready before navigation
 */
export async function bootstrapTestEnv(page: Page, opts: BootstrapOptions = {}) {
  const {
    skipLogin = true,
    mockSharePoint = true,
    flags = {},
    storage = {},
  } = opts;

  await page.addInitScript(
    ({ skipLogin, mockSharePoint, flags, storage, flagEnvKeys }) => {
      const local = window.localStorage;
      const session = window.sessionStorage;
      const globalWithEnv = window as typeof window & {
        __ENV__?: Record<string, string>;
        __RUNTIME_ENV__?: Record<string, string>;
      };

      const ensureEnvRecord = (key: '__ENV__' | '__RUNTIME_ENV__'): Record<string, string> => {
        const current = globalWithEnv[key];
        if (current && typeof current === 'object') {
          return current;
        }
        const created: Record<string, string> = {};
        globalWithEnv[key] = created;
        return created;
      };

      const env = ensureEnvRecord('__ENV__');
      const runtimeEnv = ensureEnvRecord('__RUNTIME_ENV__');
      const assignEnv = (key: string, value: string) => {
        env[key] = value;
        runtimeEnv[key] = value;
      };

      try {
        local.clear();
      } catch {
        /* ignore storage clear errors */
      }
      try {
        session.clear();
      } catch {
        /* ignore storage clear errors */
      }

      const truthy = (value: unknown) => Boolean(value);
      const flagString = (value: unknown) => (truthy(value) ? '1' : '0');

      Object.entries(flags || {}).forEach(([key, value]) => {
        const storeKey = `feature:${key}`;
        const normalized = flagString(value);
        local.setItem(storeKey, normalized);
        const envKey = flagEnvKeys?.[key];
        if (envKey) {
          assignEnv(envKey, normalized);
        }
      });

      if (skipLogin) {
        assignEnv('VITE_SKIP_LOGIN', '1');
        assignEnv('VITE_SKIP_SP_HEALTHCHECK', '1');
        assignEnv('VITE_SKIP_SP_CHECK', '1');
        assignEnv('VITE_MSAL_STUB', '1');
        local.setItem('VITE_SKIP_LOGIN', '1');
        local.setItem('VITE_SKIP_SP_HEALTHCHECK', '1');
        local.setItem('VITE_SKIP_SP_CHECK', '1');
        local.setItem('VITE_MSAL_STUB', '1');
      }

      Object.entries(storage?.local ?? {}).forEach(([key, value]) => {
        local.setItem(key, value);
      });
      Object.entries(storage?.session ?? {}).forEach(([key, value]) => {
        session.setItem(key, value);
      });

      const originalReplace = window.location.replace.bind(window.location);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- test monkey patch
      // @ts-ignore
      window.location.replace = (url: string | URL) => {
        const target = String(url);
        if (target.includes('login.microsoftonline.com')) {
          console.debug('[E2E] Prevented MSAL redirect (replace):', target);
          return;
        }
        originalReplace(url);
      };

      const originalAssign = window.location.assign.bind(window.location);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- test monkey patch
      // @ts-ignore
      window.location.assign = (url: string | URL) => {
        const target = String(url);
        if (target.includes('login.microsoftonline.com')) {
          console.debug('[E2E] Prevented MSAL redirect (assign):', target);
          return;
        }
        originalAssign(url);
      };

      const originalFetch = window.fetch.bind(window);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- exposed for debugging
      (window as any).__REAL_FETCH__ = originalFetch;
      const sharePointHost = 'isogokatudouhome.sharepoint.com';

      const respondJson = (body: unknown, status = 200): Response => {
        const payload = typeof body === 'string' ? body : JSON.stringify(body ?? {});
        return new Response(payload, {
          status,
          headers: { 'content-type': 'application/json;odata=nometadata' },
        });
      };

      const sharePointStub = (url: string): Response => {
        if (url.includes('/_api/web?$select=Id')) {
          return respondJson({ Id: 1 });
        }

        if (url.match(/\/\_api\/web\/lists\/getbytitle\(/i)) {
          return respondJson({ Id: '00000000-0000-0000-0000-000000000001' });
        }

        if (url.includes('ScheduleEvents') && url.includes('/items')) {
          return respondJson({
            value: [
              {
                Id: 101,
                Title: 'デモ予定 A',
                EventDate: '2025-01-05T01:00:00Z',
                EndDate: '2025-01-05T02:00:00Z',
                AllDay: false,
                Status: '下書き',
                '@odata.etag': '"1"',
              },
              {
                Id: 102,
                Title: 'デモ予定 B (終日)',
                EventDate: '2025-01-06T00:00:00Z',
                EndDate: '2025-01-06T23:59:59Z',
                AllDay: true,
                Status: '確定',
                '@odata.etag': '"1"',
              },
            ],
          });
        }

        return respondJson({});
      };

      window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
        const target = typeof input === 'string' ? input : String(input);

        if (
          target.startsWith('/') ||
          target.startsWith('http://localhost') ||
          target.startsWith('http://127.0.0.1') ||
          target.startsWith('http://0.0.0.0')
        ) {
          return originalFetch(input, init);
        }

        if (target.includes('login.microsoftonline.com') || target.includes('OneCollector/1.0')) {
          return Promise.resolve(new Response('', { status: 204 }));
        }

        if (mockSharePoint && target.includes(sharePointHost)) {
          return Promise.resolve(sharePointStub(target));
        }

        return originalFetch(input, init);
      };
    },
    { skipLogin, mockSharePoint, flags, storage, flagEnvKeys: FLAG_ENV_KEYS },
  );

  await page.addInitScript(() => {
    try {
      const nav = navigator as typeof navigator & { connection?: Record<string, unknown> };
      const connection = nav.connection ?? (nav.connection = {} as Record<string, unknown>);
      Object.defineProperty(connection, 'saveData', { value: false, configurable: true });
      Object.defineProperty(connection, 'effectiveType', { value: '4g', configurable: true });
      Object.defineProperty(connection, 'downlink', { value: 50, configurable: true });
      Object.defineProperty(connection, 'rtt', { value: 50, configurable: true });
    } catch {
      // ignore navigator connection overrides when unavailable
    }
  });
}
