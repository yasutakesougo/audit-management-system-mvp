import type { Page, TestInfo } from '@playwright/test';

type MatchPattern = string | RegExp;

type StructuredFailureMatch = {
  method?: string | RegExp;
  url?: string | RegExp;
  resourceType?: string | RegExp;
  errorText?: string | RegExp;
  operation?: 'requestfailed' | 'response' | 'any';
};

type FailureMatchPattern = MatchPattern | StructuredFailureMatch;

type KioskReleaseContractOptions = {
  allowedRequestFailures?: FailureMatchPattern[];
};

type RequestFailureRecord = {
  method: string;
  url: string;
  status?: number;
  resourceType: string;
  errorText: string;
  operation: 'requestfailed' | 'response';
};

type ContractDiagnostics = {
  consoleErrors: string[];
  pageErrors: string[];
  requestFailures: RequestFailureRecord[];
};

const DEFAULT_ALLOWED_REQUEST_FAILURES: FailureMatchPattern[] = [
  /__vite_ping/i,
  /__next/i,
  /favicon\.ico$/i,
];

function testPattern(value: string, pattern?: string | RegExp): boolean {
  if (pattern == null) {
    return true;
  }
  return pattern instanceof RegExp ? pattern.test(value) : value.includes(pattern);
}

function isMatch(record: RequestFailureRecord, pattern: FailureMatchPattern): boolean {
  if (pattern instanceof RegExp || typeof pattern === 'string') {
    return testPattern(record.url, pattern);
  }

  const isMethodMatch = testPattern(record.method, pattern.method);
  const isUrlMatch = testPattern(record.url, pattern.url);
  const isResourceTypeMatch = testPattern(record.resourceType, pattern.resourceType);
  const isErrorTextMatch = testPattern(record.errorText, pattern.errorText);
  const isOperationMatch = pattern.operation == null || pattern.operation === 'any' || pattern.operation === record.operation;

  return isMethodMatch && isUrlMatch && isResourceTypeMatch && isErrorTextMatch && isOperationMatch;
}

function hasAllowedFailure(record: RequestFailureRecord, patterns: FailureMatchPattern[]): boolean {
  return patterns.some((pattern) => isMatch(record, pattern));
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

function describeRequestFailure(record: RequestFailureRecord): string {
  return `${record.operation} ${record.method} ${record.url} status=${String(record.status ?? '-')} resourceType=${record.resourceType} error=${record.errorText}`;
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
    diagnostics.requestFailures.push({
      method: request.method(),
      url: request.url(),
      status: getResponseStatus(request.response()),
      errorText: request.failure()?.errorText ?? 'unknown',
      resourceType: request.resourceType(),
      operation: 'requestfailed',
    });
  });

  page.on('response', (response) => {
    const status = response.status();
    if (status >= 500) {
      diagnostics.requestFailures.push({
        method: response.request().method(),
        url: response.url(),
        status,
        errorText: `status-${status}`,
        resourceType: response.request().resourceType(),
        operation: 'response',
      });
    }
  });

  const assertNoFailures = async (): Promise<void> => {
    await page.waitForLoadState('load');
    await page.waitForSelector('#app-main-container[data-provider]', { timeout: 10_000 }).catch(() => {});

    const unexpectedConsoleErrors = diagnostics.consoleErrors;
    const unexpectedPageErrors = diagnostics.pageErrors;
    const unexpectedRequestFailures = diagnostics.requestFailures.filter((entry) => !hasAllowedFailure(entry, allowedRequestFailures));

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

    const requestFailures = unexpectedRequestFailures.map(describeRequestFailure);

    const summary = {
      consoleErrors: unexpectedConsoleErrors,
      pageErrors: unexpectedPageErrors,
      requestFailures,
      requestFailureRecords: unexpectedRequestFailures,
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
      throw new Error(`kiosk release contract: console errors detected\n${summary.consoleErrors.join('\n')}`);
    }

    if (summary.pageErrors.length > 0) {
      throw new Error(`kiosk release contract: page errors detected\n${summary.pageErrors.join('\n')}`);
    }

    if (summary.requestFailures.length > 0) {
      throw new Error(`kiosk release contract: request failures detected\n${summary.requestFailures.join('\n')}`);
    }
  };

  return { assertNoFailures };
}
