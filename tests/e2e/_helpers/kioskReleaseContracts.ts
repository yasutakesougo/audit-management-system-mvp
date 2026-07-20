import type { Page, TestInfo } from '@playwright/test';

type MatchPattern = string | RegExp;

type KioskReleaseContractOptions = {
  allowedRequestFailures?: MatchPattern[];
};

type ContractDiagnostics = {
  consoleErrors: string[];
  pageErrors: string[];
  requestFailures: string[];
};

const DEFAULT_ALLOWED_REQUEST_FAILURES: MatchPattern[] = [
  /__vite_ping/i,
  /__next/i,
  /favicon\.ico$/i,
];

function matchesPattern(url: string, patterns: MatchPattern[]): boolean {
  return patterns.some((pattern) => {
    if (pattern instanceof RegExp) {
      return pattern.test(url);
    }
    return url.includes(pattern);
  });
}

function describeRequestFailure(url: string, method: string, status: number | undefined, failureText: string | null, resourceType: string): string {
  return `${method} ${url} status=${String(status ?? '-')} type=${resourceType} failure=${failureText ?? 'unknown'}`;
}

function getResponseStatus(response: unknown): number | undefined {
  // Playwright type definitions vary across versions; keep runtime-safe extraction.
  const responseObj = response as { status?: unknown };
  if (typeof responseObj?.status === 'number') {
    return responseObj.status;
  }
  const responseFn = (responseObj as { status?: () => unknown }).status;
  if (typeof responseFn === 'function') {
    const value = responseFn.call(responseObj);
    return typeof value === 'number' ? value : undefined;
  }
  return undefined;
}

export type KioskReleaseContracts = {
  assertNoFailures: () => Promise<void>;
};

export async function setupKioskReleaseContracts(page: Page, testInfo: TestInfo, options: KioskReleaseContractOptions = {}): Promise<KioskReleaseContracts> {
  const allowedRequestFailures = [...DEFAULT_ALLOWED_REQUEST_FAILURES, ...(options.allowedRequestFailures ?? [])];
  const diagnostics: ContractDiagnostics = {
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
  };

  page.on('console', (message) => {
    if (message.type() === 'error') {
      diagnostics.consoleErrors.push(`${message.type()}: ${message.text()}`);
    }
  });

  page.on('pageerror', (error) => {
    diagnostics.pageErrors.push(String(error));
  });

  page.on('requestfailed', (request) => {
    diagnostics.requestFailures.push(
      describeRequestFailure(
        request.url(),
        request.method(),
        getResponseStatus(request.response()),
        request.failure()?.errorText ?? null,
        request.resourceType(),
      ),
    );
  });

  page.on('response', (response) => {
    const url = response.url();
    const status = response.status();
    if (status >= 500) {
      diagnostics.requestFailures.push(`response-failure ${response.request().method()} ${url} status=${status}`);
    }
  });

  const assertNoFailures = async (): Promise<void> => {
    await page.waitForLoadState('load');
    await page.waitForSelector('#app-main-container[data-provider]', { timeout: 10_000 }).catch(() => {});

    const unexpectedConsoleErrors = diagnostics.consoleErrors;
    const unexpectedPageErrors = diagnostics.pageErrors;
    const unexpectedRequestFailures = diagnostics.requestFailures.filter((entry) => !matchesPattern(entry, allowedRequestFailures));

    const contract = await page.evaluate(() => {
      const env = (window as Window & { __ENV__?: Record<string, string> }).__ENV__ ?? {};
      const skipLogin = window.localStorage?.getItem?.('skipLogin') ?? null;
      const appMain = document.querySelector('#app-main-container') as HTMLElement | null;
      const appShell = document.querySelector('[data-testid="app-shell"]') as HTMLElement | null;
      const search = new URLSearchParams(window.location.search);

      return {
        env,
        url: window.location.href,
        skipLogin,
        dataProvider: appMain?.getAttribute('data-provider') ?? null,
        isKioskShell: appShell?.getAttribute('data-kiosk') === 'true',
        hasKioskParam: search.has('kiosk'),
      };
    });

    const missingContracts: string[] = [];
    const url = new URL(contract.url);
    const isKioskRoute = url.pathname.startsWith('/kiosk');
    if (!isKioskRoute && !contract.hasKioskParam && !contract.isKioskShell) {
      missingContracts.push('kiosk route not active');
    }

    if (!contract.env.VITE_SKIP_LOGIN || contract.env.VITE_SKIP_LOGIN !== '1') {
      missingContracts.push('runtime env VITE_SKIP_LOGIN is not 1');
    }

    if (!contract.skipLogin || contract.skipLogin !== '1') {
      missingContracts.push('skip-login initialization localStorage flag is not set');
    }

    if (!contract.env.VITE_E2E || contract.env.VITE_E2E !== '1') {
      missingContracts.push('runtime env VITE_E2E is not 1');
    }

    if (!contract.dataProvider) {
      missingContracts.push('data-provider attribute is missing');
    }

    const summary = {
      consoleErrors: unexpectedConsoleErrors,
      pageErrors: unexpectedPageErrors,
      requestFailures: unexpectedRequestFailures,
      missingContracts,
    };

    await testInfo.attach('kiosk-release-contract.json', {
      body: JSON.stringify(summary, null, 2),
      contentType: 'application/json',
    });

    if (summary.missingContracts.length > 0) {
      throw new Error(`kiosk release contract failures: ${summary.missingContracts.join(', ')}`);
    }

    if (summary.consoleErrors.length > 0) {
      throw new Error(`kiosk release contract: console errors detected\\n${summary.consoleErrors.join('\\n')}`);
    }

    if (summary.pageErrors.length > 0) {
      throw new Error(`kiosk release contract: page errors detected\\n${summary.pageErrors.join('\\n')}`);
    }

    if (summary.requestFailures.length > 0) {
      throw new Error(`kiosk release contract: request failures detected\\n${summary.requestFailures.join('\\n')}`);
    }
  };

  return { assertNoFailures };
}
