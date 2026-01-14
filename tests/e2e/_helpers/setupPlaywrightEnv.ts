/**
 * Playwright test environment initializer (single entry point for all specs).
 *
 * Responsibilities:
 * - Reset browser storage (localStorage/sessionStorage) before each spec
 * - Inject shared baseline __ENV__ values (feature flags, auth mocks, etc.)
 * - Allow per-spec overrides via `envOverrides` / `storageOverrides`
 *
 * Required call order for every E2E spec (do not skip):
 *   1. Register mocks (Graph / MSAL / SharePoint / REST / etc.)
 *   2. await setupPlaywrightEnv(page, { envOverrides, storageOverrides })
 *   3. await bootXxxPage(page, { seed })
 *   4. Execute interactions + assertions
 *
 * Boot helpers MUST call this helper before applying their own seeds, and
 * feature flags MUST flow through `envOverrides` (never mutate window.__ENV__
 * directly). This contract keeps test worlds deterministic and prevents
 * cross-spec bleed.
 */
import type { Page } from '@playwright/test';

const BASE_ENV: Record<string, string> = {
  NODE_ENV: 'development',
  VITE_APP_ENV: 'e2e',
  VITE_E2E: '1',
  VITE_E2E_MSAL_MOCK: '1',
  VITE_SKIP_LOGIN: '1',
  VITE_DEMO_MODE: '1',
  VITE_SKIP_SHAREPOINT: '1',
  VITE_FORCE_SHAREPOINT: '0',
  MODE: 'development',
  DEV: '1',
  VITE_SP_RESOURCE: 'https://contoso.sharepoint.com',
  VITE_SP_SITE_RELATIVE: '/sites/Audit',
  VITE_SP_SCOPE_DEFAULT: 'https://contoso.sharepoint.com/AllSites.Read',
  // MSAL: Mock mode, so these are just placeholders
  VITE_MSAL_CLIENT_ID: 'e2e-mock-client-id-12345678',
  VITE_MSAL_TENANT_ID: 'common',
};

const BASE_STORAGE: Record<string, string> = {
  skipLogin: '1',
  demo: '1',
};

export type SetupPlaywrightEnvOptions = {
  /** Clear localStorage/sessionStorage before applying overrides. Defaults to true. */
  resetLocalStorage?: boolean;
  /** Additional environment variables to expose via window.__ENV__. */
  envOverrides?: Record<string, string>;
  /** Additional localStorage entries to seed after reset. */
  storageOverrides?: Record<string, string>;
};

export async function setupPlaywrightEnv(page: Page, options: SetupPlaywrightEnvOptions = {}): Promise<void> {
  const {
    resetLocalStorage = true,
    envOverrides = {},
    storageOverrides = {},
  } = options;

  const envPayload = { ...BASE_ENV, ...envOverrides };
  const storagePayload = { ...BASE_STORAGE, ...storageOverrides };

  await page.addInitScript((providedEnv) => {
    const scope = window as typeof window & { __ENV__?: Record<string, string> };
    scope.__ENV__ = {
      ...(scope.__ENV__ ?? {}),
      ...providedEnv,
    };
  }, envPayload);

  if (resetLocalStorage) {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  }

  if (Object.keys(storagePayload).length > 0) {
    await page.addInitScript((entries) => {
      for (const [key, value] of Object.entries(entries)) {
        window.localStorage.setItem(key, value);
      }
    }, storagePayload);
  }
}
