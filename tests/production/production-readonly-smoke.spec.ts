import { expect, test, type Page, type TestInfo } from '@playwright/test';

const productionBaseURL =
  process.env.PRODUCTION_BASE_URL ??
  'https://audit-management-system-mvp.momosantanuki.workers.dev';
const authWaitTimeout = Number(process.env.PRODUCTION_AUTH_TIMEOUT_MS ?? 120_000);

type SmokeDiagnostics = {
  capturedAt: string;
  consoleErrors: string[];
  pageErrors: string[];
  requestFailures: string[];
  serverErrors: string[];
};

function safeUrlPath(rawURL: string): string {
  try {
    const url = new URL(rawURL);
    return `${url.host}${url.pathname}`;
  } catch {
    return '<unparsed-url>';
  }
}

function redactDiagnosticText(value: string): string {
  return value
    .replace(/Bearer\s+[^\s]+/gi, 'Bearer <redacted>')
    .replace(/\b[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '<redacted-token>');
}

function installProductionDiagnostics(page: Page): SmokeDiagnostics {
  const diagnostics: SmokeDiagnostics = {
    capturedAt: new Date().toISOString(),
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    serverErrors: [],
  };

  page.on('console', (message) => {
    if (message.type() === 'error') {
      diagnostics.consoleErrors.push(redactDiagnosticText(message.text()));
    }
  });

  page.on('pageerror', (error) => {
    diagnostics.pageErrors.push(redactDiagnosticText(String(error)));
  });

  page.on('requestfailed', (request) => {
    diagnostics.requestFailures.push(
      `${request.method()} ${safeUrlPath(request.url())} ${
        request.failure()?.errorText ?? 'unknown'
      }`,
    );
  });

  page.on('response', (response) => {
    if (response.status() >= 500) {
      diagnostics.serverErrors.push(
        `${response.status()} ${response.request().method()} ${safeUrlPath(response.url())}`,
      );
    }
  });

  return diagnostics;
}

async function attachDiagnostics(
  page: Page,
  diagnostics: SmokeDiagnostics,
  testInfo: TestInfo,
): Promise<void> {
  const payload = {
    ...diagnostics,
    finalUrl: safeUrlPath(page.url()),
    counts: {
      consoleErrors: diagnostics.consoleErrors.length,
      pageErrors: diagnostics.pageErrors.length,
      requestFailures: diagnostics.requestFailures.length,
      serverErrors: diagnostics.serverErrors.length,
    },
    policy: {
      save操作: 'なし',
      queryString: '記録しない',
      fragment: '記録しない',
      credentials: '記録しない',
    },
  };

  await testInfo.attach('production-readonly-smoke.json', {
    body: JSON.stringify(payload, null, 2),
    contentType: 'application/json',
  });
}

test('production read-only kiosk smoke collects all browser failure channels', async ({ page }, testInfo) => {
  const diagnostics = installProductionDiagnostics(page);

  try {
    await page.goto(`${productionBaseURL}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });

    await page.goto(`${productionBaseURL}/kiosk`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await expect(page.getByRole('heading', { name: 'キオスクモード' })).toBeVisible({
      timeout: authWaitTimeout,
    });

    await page.goto(`${productionBaseURL}/kiosk/toilet`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await expect(page.getByRole('heading', { name: '本日のトイレ確認' })).toBeVisible({
      timeout: 30_000,
    });

    await page.waitForTimeout(30_000);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.getByRole('heading', { name: '本日のトイレ確認' })).toBeVisible({
      timeout: 30_000,
    });

    expect(diagnostics.consoleErrors).toHaveLength(0);
    expect(diagnostics.pageErrors).toHaveLength(0);
    expect(diagnostics.requestFailures).toHaveLength(0);
    expect(diagnostics.serverErrors).toHaveLength(0);
  } finally {
    await attachDiagnostics(page, diagnostics, testInfo);
  }
});
