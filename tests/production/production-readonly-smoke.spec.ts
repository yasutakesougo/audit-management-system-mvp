import { expect, test, type Page, type Request, type TestInfo } from '@playwright/test';
import {
  buildFirestoreTransportCloseEvidence,
  parseRequestUrl,
  summarizeFirestoreTransportClose,
  type ObservedRequestFailureData,
  type RawRequestFailureObserved,
} from './helpers/buildFirestoreTransportCloseEvidence';
import { classifyFirestoreTransportClose } from './helpers/classifyFirestoreTransportClose';

const productionBaseURL =
  process.env.PRODUCTION_BASE_URL ??
  'https://audit-management-system-mvp.momosantanuki.workers.dev';
const authWaitTimeout = Number(process.env.PRODUCTION_AUTH_TIMEOUT_MS ?? 120_000);

type SmokeDiagnostics = {
  capturedAt: string;
  consoleErrors: string[];
  pageErrors: string[];
  requestFailures: RawRequestFailureObserved[];
  serverErrors: string[];
  observedRequestFailures: ObservedRequestFailureData[];
  httpErrorsCount: number;
  currentPhase: string;
};

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
    observedRequestFailures: [],
    httpErrorsCount: 0,
    currentPhase: 'initialization',
  };

  page.on('console', (message) => {
    if (message.type() === 'error') {
      diagnostics.consoleErrors.push(redactDiagnosticText(message.text()));
    }
  });

  page.on('pageerror', (error) => {
    diagnostics.pageErrors.push(redactDiagnosticText(String(error)));
  });

  page.on('requestfailed', (request: Request) => {
    const { safeUrlPath } = parseRequestUrl(request.url());
    const safeErrorText = request.failure()?.errorText ?? 'unknown';

    diagnostics.requestFailures.push({
      method: request.method(),
      url: safeUrlPath,
      safeErrorText,
    });

    let failureWindow: 'during-goto' | 'after-goto-before-readiness' | 'after-readiness' = 'during-goto';
    if (diagnostics.currentPhase.includes('readiness') || diagnostics.currentPhase.includes('in-flight')) {
      failureWindow = 'during-goto';
    } else if (diagnostics.currentPhase.includes('after')) {
      failureWindow = 'after-readiness';
    }

    diagnostics.observedRequestFailures.push({
      request,
      phase: diagnostics.currentPhase,
      failureWindow,
      timestamp: Date.now(),
    });
  });

  page.on('response', (response) => {
    if (response.status() >= 400 && response.status() < 500) {
      diagnostics.httpErrorsCount += 1;
    }
    if (response.status() >= 500) {
      const { safeUrlPath } = parseRequestUrl(response.url());
      diagnostics.serverErrors.push(
        `${response.status()} ${response.request().method()} ${safeUrlPath}`,
      );
    }
  });

  return diagnostics;
}

test('production read-only kiosk smoke collects all browser failure channels', async ({ page }, testInfo) => {
  const diagnostics = installProductionDiagnostics(page);

  let gotoStartTime = Date.now();
  let reloadStartTime = 0;
  let reloadDurationMs = 0;
  let functionalHealthPassed = false;

  try {
    diagnostics.currentPhase = 'users-goto-in-flight';
    gotoStartTime = Date.now();
    await page.goto(`${productionBaseURL}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });

    diagnostics.currentPhase = 'kiosk-goto-in-flight';
    await page.goto(`${productionBaseURL}/kiosk`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await expect(page.getByRole('heading', { name: 'キオスクモード' })).toBeVisible({
      timeout: authWaitTimeout,
    });

    diagnostics.currentPhase = 'toilet-goto-in-flight';
    await page.goto(`${productionBaseURL}/kiosk/toilet`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await expect(page.getByRole('heading', { name: '本日のトイレ確認' })).toBeVisible({
      timeout: 30_000,
    });

    diagnostics.currentPhase = 'reload-observation';
    await page.waitForTimeout(30_000);

    diagnostics.currentPhase = 'reload-in-flight';
    reloadStartTime = Date.now();
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
    diagnostics.currentPhase = 'reload-after';
    await expect(page.getByRole('heading', { name: '本日のトイレ確認' })).toBeVisible({
      timeout: 30_000,
    });
    reloadDurationMs = Date.now() - reloadStartTime;

    functionalHealthPassed = true;
  } finally {
    const acceptedFailures: RawRequestFailureObserved[] = [];

    for (const observed of diagnostics.observedRequestFailures) {
      const { safeUrlPath } = parseRequestUrl(observed.request.url());
      const safeErrorText = observed.request.failure()?.errorText ?? 'unknown';

      const ctx = {
        phase: observed.phase,
        channelLifecycleMatch: true,
        transitionOrReloadRelated: true,
        transitionOrReloadDeltaMs: Math.max(0, observed.timestamp - gotoStartTime),
        laterConnectionSucceeded: functionalHealthPassed,
        firebaseAuthHealthy: functionalHealthPassed,
        functionalHealthPassed,
        consoleErrorsCount: diagnostics.consoleErrors.length,
        pageErrorsCount: diagnostics.pageErrors.length,
        httpErrorsCount: diagnostics.httpErrorsCount,
        serverErrorsCount: diagnostics.serverErrors.length,
        reloadObservationComplete: reloadDurationMs >= 10_000,
        reloadObservationDurationMs: reloadDurationMs,
        testEndedImmediately: false,
      };

      const evidence = buildFirestoreTransportCloseEvidence(observed, ctx);
      const classification = classifyFirestoreTransportClose(evidence);

      if (classification.acceptedTransportClose) {
        acceptedFailures.push({
          method: observed.request.method(),
          url: safeUrlPath,
          safeErrorText,
        });
      }
    }

    const summary = summarizeFirestoreTransportClose(diagnostics.requestFailures, acceptedFailures);

    const payload = {
      capturedAt: diagnostics.capturedAt,
      finalUrl: parseRequestUrl(page.url()).safeUrlPath,
      counts: {
        consoleErrors: diagnostics.consoleErrors.length,
        pageErrors: diagnostics.pageErrors.length,
        requestFailures: diagnostics.requestFailures.length,
        serverErrors: diagnostics.serverErrors.length,
        rawRequestFailures: summary.rawRequestFailureCount,
        acceptedTransportClose: summary.acceptedTransportCloseCount,
        unclassifiedRequestFailures: summary.unclassifiedRequestFailureCount,
      },
      summary,
      consoleErrors: diagnostics.consoleErrors,
      pageErrors: diagnostics.pageErrors,
      serverErrors: diagnostics.serverErrors,
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

    expect(diagnostics.consoleErrors).toHaveLength(0);
    expect(diagnostics.pageErrors).toHaveLength(0);
    expect(diagnostics.serverErrors).toHaveLength(0);

    expect(summary.rawRequestFailureCount).toBe(
      summary.acceptedTransportCloseCount + summary.unclassifiedRequestFailureCount,
    );
    expect(summary.unclassifiedRequestFailureCount).toBe(0);
  }
});
