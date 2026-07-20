import { expect, test, type Page, type TestInfo } from '@playwright/test';

const productionBaseURL =
  process.env.PRODUCTION_BASE_URL ??
  'https://audit-management-system-mvp.momosantanuki.workers.dev';

type SmokeDiagnostics = {
  capturedAt: string;
  consoleErrors: string[];
  firebaseAuthErrors: string[];
  pageErrors: string[];
  requestFailures: Array<{
    capturedAt: string;
    page: string;
    method: string;
    host: string;
    path: string;
    resourceType: string;
    errorText: string;
  }>;
  httpErrors: Array<{
    capturedAt: string;
    page: string;
    method: string;
    host: string;
    path: string;
    status: number;
    resourceType: string;
  }>;
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
  const redacted = value
    .replace(/Bearer\s+[^\s]+/gi, 'Bearer <redacted>')
    .replace(/\b[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '<redacted-token>');

  return redacted.replace(/https?:\/\/[^\s"'<>]+/gi, (rawURL) => safeUrlPath(rawURL));
}

function installProductionDiagnostics(page: Page): SmokeDiagnostics {
  const diagnostics: SmokeDiagnostics = {
    capturedAt: new Date().toISOString(),
    consoleErrors: [],
    firebaseAuthErrors: [],
    pageErrors: [],
    requestFailures: [],
    httpErrors: [],
    serverErrors: [],
  };

  page.on('console', (message) => {
    if (message.type() === 'error') {
      const errorText = redactDiagnosticText(message.text());
      diagnostics.consoleErrors.push(errorText);
      if (errorText.includes('[firebase-auth]')) {
        diagnostics.firebaseAuthErrors.push(errorText);
      }
    }
  });

  page.on('pageerror', (error) => {
    diagnostics.pageErrors.push(redactDiagnosticText(String(error)));
  });

  page.on('requestfailed', (request) => {
    const capturedAt = new Date().toISOString();
    const url = new URL(request.url());
    diagnostics.requestFailures.push({
      capturedAt,
      page: safeUrlPath(page.url()),
      method: request.method(),
      host: url.host,
      path: url.pathname,
      resourceType: request.resourceType(),
      errorText: request.failure()?.errorText ?? 'unknown',
    });
  });

  page.on('response', (response) => {
    if (response.status() >= 400) {
      const capturedAt = new Date().toISOString();
      const request = response.request();
      const url = new URL(response.url());
      diagnostics.httpErrors.push({
        capturedAt,
        page: safeUrlPath(page.url()),
        method: request.method(),
        host: url.host,
        path: url.pathname,
        status: response.status(),
        resourceType: request.resourceType(),
      });
    }

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
      firebaseAuthErrors: diagnostics.firebaseAuthErrors.length,
      pageErrors: diagnostics.pageErrors.length,
      requestFailures: diagnostics.requestFailures.length,
      httpErrors: diagnostics.httpErrors.length,
      serverErrors: diagnostics.serverErrors.length,
    },
    policy: {
      saveOperation: 'none',
      queryString: 'not-recorded',
      fragment: 'not-recorded',
      credentials: 'not-recorded',
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
    const rootResponse = await page.goto(`${productionBaseURL}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    expect(rootResponse?.status()).toBe(200);

    const kioskResponse = await page.goto(`${productionBaseURL}/kiosk`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    expect(kioskResponse?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'キオスクモード' })).toBeVisible({
      timeout: 30_000,
    });

    const toiletResponse = await page.goto(`${productionBaseURL}/kiosk/toilet`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    expect(toiletResponse?.status()).toBe(200);
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
