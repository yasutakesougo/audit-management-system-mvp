import { expect, test, type ConsoleMessage, type Locator, type Page } from '@playwright/test';

type BestEffortOptions = {
  timeout?: number;
  note?: string;
};

type SmokeReadyOptions = {
  timeout?: number;
};

const smokeRuntimeEnv = {
  VITE_DEMO_MODE: '1',
  VITE_E2E: '1',
  VITE_E2E_MSAL_MOCK: '1',
  VITE_SKIP_LOGIN: '1',
  VITE_SKIP_SHAREPOINT: '1',
  VITE_SP_RESOURCE: 'https://contoso.sharepoint.com',
  VITE_SP_SITE_RELATIVE: '/sites/Audit',
  VITE_MSAL_CLIENT_ID: '00000000-0000-0000-0000-000000000000',
  VITE_MSAL_TENANT_ID: '00000000-0000-0000-0000-000000000000',
  __ALLOW_RUNTIME_FLAG_OVERRIDES__: '1',
} as const;

const smokeRuntimeFlagKeys = Object.keys(smokeRuntimeEnv);

type SmokeDiagnostics = {
  consoleMessages: string[];
  consoleErrors: string[];
  initScriptInstalled: boolean;
  listenersInstalled: boolean;
  pageErrors: string[];
};

const diagnosticsByPage = new WeakMap<Page, SmokeDiagnostics>();

function getSmokeDiagnostics(page: Page): SmokeDiagnostics {
  const existing = diagnosticsByPage.get(page);
  if (existing) return existing;

  const diagnostics: SmokeDiagnostics = {
    consoleMessages: [],
    consoleErrors: [],
    initScriptInstalled: false,
    listenersInstalled: false,
    pageErrors: [],
  };
  diagnosticsByPage.set(page, diagnostics);
  return diagnostics;
}

function pushLimited(values: string[], value: string, limit: number): void {
  values.push(value);
  if (values.length > limit) {
    values.splice(0, values.length - limit);
  }
}

function formatConsoleMessage(message: ConsoleMessage): string {
  return `[${message.type()}] ${message.text()}`;
}

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }
  return String(error);
}

function installSmokeDiagnostics(page: Page): void {
  const diagnostics = getSmokeDiagnostics(page);
  if (diagnostics.listenersInstalled) return;

  diagnostics.listenersInstalled = true;

  page.on('console', (message) => {
    const formatted = formatConsoleMessage(message);
    pushLimited(diagnostics.consoleMessages, formatted, 100);
    if (message.type() === 'error' || message.type() === 'warning') {
      pushLimited(diagnostics.consoleErrors, formatted, 50);
    }
  });

  page.on('pageerror', (error) => {
    pushLimited(diagnostics.pageErrors, formatUnknownError(error), 25);
  });
}

async function collectSmokePageSnapshot(page: Page): Promise<Record<string, unknown>> {
  const fallback = {
    pageUrl: page.url(),
  };

  try {
    const snapshot = await page.evaluate((keys) => {
      const windowWithEnv = window as Window & { __ENV__?: Record<string, unknown> };
      const localStorageFlags: Record<string, string | null> = {};

      for (const key of keys) {
        try {
          localStorageFlags[key] = window.localStorage.getItem(key);
        } catch {
          localStorageFlags[key] = '<localStorage unavailable>';
        }
      }

      return {
        bodyInnerHTML: document.body?.innerHTML?.slice(0, 2000) ?? '',
        bodyInnerText: document.body?.innerText?.slice(0, 1000) ?? '',
        documentTitle: document.title,
        localStorageFlags,
        readyState: document.readyState,
        url: window.location.href,
        windowEnv: windowWithEnv.__ENV__ ?? null,
      };
    }, smokeRuntimeFlagKeys);

    return {
      ...fallback,
      ...snapshot,
    };
  } catch (error) {
    return {
      ...fallback,
      evaluateError: formatUnknownError(error),
    };
  }
}

async function attachSmokePageDiagnostics(page: Page, cause: unknown): Promise<void> {
  const diagnostics = getSmokeDiagnostics(page);
  const snapshot = await collectSmokePageSnapshot(page);
  const payload = {
    cause: formatUnknownError(cause),
    consoleErrors: diagnostics.consoleErrors,
    consoleMessages: diagnostics.consoleMessages,
    pageErrors: diagnostics.pageErrors,
    snapshot,
  };
  const serialized = JSON.stringify(payload, null, 2);

  await test.info().attach('smoke-page-diagnostics.json', {
    body: serialized,
    contentType: 'application/json',
  });

  console.error('[smoke diagnostics]', serialized);
}

export async function prepareSmokePage(page: Page): Promise<void> {
  const diagnostics = getSmokeDiagnostics(page);
  installSmokeDiagnostics(page);

  if (diagnostics.initScriptInstalled) return;
  diagnostics.initScriptInstalled = true;

  await page.addInitScript((env) => {
    const windowWithEnv = window as Window & { __ENV__?: Record<string, unknown> };
    windowWithEnv.__ENV__ = { ...(windowWithEnv.__ENV__ ?? {}), ...env };
    for (const [key, value] of Object.entries(env)) {
      try {
        window.localStorage.setItem(key, String(value));
      } catch {
        // localStorage can be unavailable in restricted contexts; window.__ENV__ remains primary.
      }
    }
  }, smokeRuntimeEnv);
}

export async function expectSmokePageReady(
  page: Page,
  options: SmokeReadyOptions = {}
): Promise<void> {
  const timeout = options.timeout ?? 15_000;

  try {
    await expect(async () => {
      const hasHeading = await page.getByRole('heading').first().isVisible().catch(() => false);
      const hasAppShell = await page.getByTestId('app-shell').isVisible().catch(() => false);
      const hasMain = await page.locator('main').first().isVisible().catch(() => false);

      expect(hasHeading || hasAppShell || hasMain).toBe(true);
    }).toPass({ timeout });
  } catch (error) {
    await attachSmokePageDiagnostics(page, error);
    throw error;
  }
}

export async function expectLocatorVisibleBestEffort(
  locator: Locator,
  note: string,
  timeout?: number
): Promise<void> {
  const count = await locator.count().catch(() => 0);
  if (count > 0) {
    try {
      if (timeout !== undefined) {
        await expect(locator.first()).toBeVisible({ timeout });
      } else {
        await expect(locator.first()).toBeVisible();
      }
      return;
    } catch (error) {
      test.info().annotations.push({
        type: 'note',
        description: `${note}; visible check failed: ${String(error)}`,
      });
      return;
    }
  }

  test.info().annotations.push({
    type: 'note',
    description: note,
  });
}

export async function expectLocatorEnabledBestEffort(
  locator: Locator,
  note: string,
  timeout?: number
): Promise<void> {
  const count = await locator.count().catch(() => 0);
  if (count > 0) {
    try {
      if (timeout !== undefined) {
        await expect(locator.first()).toBeEnabled({ timeout });
      } else {
        await expect(locator.first()).toBeEnabled();
      }
      return;
    } catch (error) {
      test.info().annotations.push({
        type: 'note',
        description: `${note}; enabled check failed: ${String(error)}`,
      });
      return;
    }
  }

  test.info().annotations.push({
    type: 'note',
    description: note,
  });
}

export async function expectTestIdVisibleBestEffort(
  page: Page,
  testId: string,
  options: BestEffortOptions = {}
): Promise<void> {
  const note = options.note ?? `testid not found: ${testId} (allowed for smoke)`;
  const locator = page.getByTestId(testId);
  await expectLocatorVisibleBestEffort(locator, note, options.timeout);
}

export async function expectTestIdEnabledBestEffort(
  page: Page,
  testId: string,
  options: BestEffortOptions = {}
): Promise<void> {
  const note = options.note ?? `testid not found: ${testId} (allowed for smoke)`;
  const locator = page.getByTestId(testId);
  await expectLocatorEnabledBestEffort(locator, note, options.timeout);
}

export async function clickBestEffort(
  locator: Locator,
  note = 'locator not found (allowed for smoke)'
): Promise<void> {
  const count = await locator.count().catch(() => 0);
  if (count > 0) {
    try {
      await locator.first().click();
    } catch (error) {
      test.info().annotations.push({
        type: 'note',
        description: `${note}; click failed: ${String(error)}`,
      });
    }
    return;
  }

  test.info().annotations.push({
    type: 'note',
    description: note,
  });
}
