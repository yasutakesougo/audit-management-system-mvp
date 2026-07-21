import { expect, test, type Page, type Request, type TestInfo } from '@playwright/test';

const productionBaseURL =
  process.env.PRODUCTION_BASE_URL ??
  'https://audit-management-system-mvp.momosantanuki.workers.dev';

type SmokePhase =
  | 'authenticated-storage-state-reuse'
  | 'root-goto-before'
  | 'root-goto-after'
  | 'kiosk-goto-before'
  | 'kiosk-goto-after'
  | 'toilet-goto-before'
  | 'toilet-goto-after'
  | 'wait-30s-before'
  | 'wait-30s-after'
  | 'reload-before'
  | 'reload-after'
  | 'scenario-end';

type ChannelAttempt = {
  id: number;
  capturedAt: string;
  phase: SmokePhase;
  page: string;
  method: string;
  host: string;
  path: string;
  resourceType: string;
  lifecycle: Array<{
    capturedAt: string;
    event: 'request' | 'response' | 'finished' | 'failed';
    phase: SmokePhase;
    status?: number;
    errorText?: string;
  }>;
  responseStatus?: number;
  failedErrorText?: string;
  subsequentConnectionSucceeded: boolean;
  transitionOrReloadRelated: boolean;
  allowlistCandidate: boolean;
};

type SmokeDiagnostics = {
  capturedAt: string;
  phase: SmokePhase;
  consoleErrors: string[];
  firebaseAuthErrors: string[];
  firebaseAuthSuccessLogs: string[];
  firestoreInitializationSuccessLogs: string[];
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
  firestoreChannelAttempts: ChannelAttempt[];
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
  functional: {
    kioskHeadingVisible: boolean;
    toiletHeadingVisible: boolean;
    recordsSectionVisible: boolean;
    reloadToiletHeadingVisible: boolean;
  };
  lifecycle: {
    pageCloseOrContextClose: 'not-invoked-by-test';
  };
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

function isFirestoreWriteChannel(rawURL: string): boolean {
  try {
    const url = new URL(rawURL);
    return (
      url.host === 'firestore.googleapis.com' &&
      url.pathname === '/google.firestore.v1.Firestore/Write/channel'
    );
  } catch {
    return false;
  }
}

function isTransitionOrReloadPhase(phase: SmokePhase): boolean {
  return phase.includes('goto') || phase.includes('reload');
}

function channelKey(channel: Pick<ChannelAttempt, 'method' | 'host' | 'path' | 'resourceType'>): string {
  return [channel.method, channel.host, channel.path, channel.resourceType].join('|');
}

function finalizeChannelAttempts(diagnostics: SmokeDiagnostics): void {
  for (const channel of diagnostics.firestoreChannelAttempts) {
    channel.subsequentConnectionSucceeded = diagnostics.firestoreChannelAttempts.some((candidate) => {
      if (candidate.id <= channel.id || channelKey(candidate) !== channelKey(channel)) return false;
      return candidate.responseStatus !== undefined && candidate.responseStatus >= 200 && candidate.responseStatus < 400;
    });
    channel.transitionOrReloadRelated = isTransitionOrReloadPhase(channel.phase);
    channel.allowlistCandidate =
      channel.host === 'firestore.googleapis.com' &&
      channel.path === '/google.firestore.v1.Firestore/Write/channel' &&
      (channel.method === 'GET' || channel.method === 'POST') &&
      channel.resourceType === 'fetch' &&
      channel.failedErrorText === 'net::ERR_ABORTED' &&
      channel.transitionOrReloadRelated &&
      channel.subsequentConnectionSucceeded &&
      diagnostics.firebaseAuthErrors.length === 0 &&
      diagnostics.firebaseAuthSuccessLogs.length > 0 &&
      diagnostics.functional.kioskHeadingVisible &&
      diagnostics.functional.toiletHeadingVisible &&
      diagnostics.functional.recordsSectionVisible &&
      diagnostics.functional.reloadToiletHeadingVisible &&
      diagnostics.pageErrors.length === 0 &&
      diagnostics.httpErrors.length === 0;
  }
}

function installProductionDiagnostics(page: Page): SmokeDiagnostics {
  const diagnostics: SmokeDiagnostics = {
    capturedAt: new Date().toISOString(),
    phase: 'authenticated-storage-state-reuse',
    consoleErrors: [],
    firebaseAuthErrors: [],
    firebaseAuthSuccessLogs: [],
    firestoreInitializationSuccessLogs: [],
    pageErrors: [],
    requestFailures: [],
    firestoreChannelAttempts: [],
    httpErrors: [],
    serverErrors: [],
    functional: {
      kioskHeadingVisible: false,
      toiletHeadingVisible: false,
      recordsSectionVisible: false,
      reloadToiletHeadingVisible: false,
    },
    lifecycle: {
      pageCloseOrContextClose: 'not-invoked-by-test',
    },
  };

  const requests = new Map<Request, ChannelAttempt>();
  let nextChannelId = 1;

  page.on('console', (message) => {
    const errorText = redactDiagnosticText(message.text());
    if (message.type() === 'error') {
      diagnostics.consoleErrors.push(errorText);
    }
    if (errorText.includes('[firebase-auth] ✅')) {
      diagnostics.firebaseAuthSuccessLogs.push(errorText);
    }
    if (errorText.includes('[firebase-auth]') && errorText.includes('initialization failed')) {
      diagnostics.firebaseAuthErrors.push(errorText);
    }
    if (/\[firestore\].*(initialized|connected|ready|success)/i.test(errorText)) {
      diagnostics.firestoreInitializationSuccessLogs.push(errorText);
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

    const channel = requests.get(request);
    if (channel) {
      channel.failedErrorText = request.failure()?.errorText ?? 'unknown';
      channel.lifecycle.push({
        capturedAt,
        event: 'failed',
        phase: diagnostics.phase,
        errorText: channel.failedErrorText,
      });
    }
  });

  page.on('request', (request) => {
    if (!isFirestoreWriteChannel(request.url())) return;
    const url = new URL(request.url());
    const capturedAt = new Date().toISOString();
    const channel: ChannelAttempt = {
      id: nextChannelId++,
      capturedAt,
      phase: diagnostics.phase,
      page: safeUrlPath(page.url()),
      method: request.method(),
      host: url.host,
      path: url.pathname,
      resourceType: request.resourceType(),
      lifecycle: [{ capturedAt, event: 'request', phase: diagnostics.phase }],
      subsequentConnectionSucceeded: false,
      transitionOrReloadRelated: false,
      allowlistCandidate: false,
    };
    requests.set(request, channel);
    diagnostics.firestoreChannelAttempts.push(channel);
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

    const request = response.request();
    const channel = requests.get(request);
    if (channel) {
      channel.responseStatus = response.status();
      channel.lifecycle.push({
        capturedAt: new Date().toISOString(),
        event: 'response',
        phase: diagnostics.phase,
        status: response.status(),
      });
    }
  });

  page.on('requestfinished', (request) => {
    const channel = requests.get(request);
    if (channel) {
      channel.lifecycle.push({
        capturedAt: new Date().toISOString(),
        event: 'finished',
        phase: diagnostics.phase,
        status: channel.responseStatus,
      });
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
    firebaseState: {
      authInitialization: diagnostics.firebaseAuthErrors.length > 0
        ? 'failed'
        : diagnostics.firebaseAuthSuccessLogs.length > 0
          ? 'success'
          : 'not-observed',
      firestoreInitialization: diagnostics.firestoreInitializationSuccessLogs.length > 0
        ? 'success'
        : 'not-observed',
    },
    counts: {
      consoleErrors: diagnostics.consoleErrors.length,
      firebaseAuthErrors: diagnostics.firebaseAuthErrors.length,
      pageErrors: diagnostics.pageErrors.length,
      requestFailures: diagnostics.requestFailures.length,
      httpErrors: diagnostics.httpErrors.length,
      serverErrors: diagnostics.serverErrors.length,
      firestoreChannelAttempts: diagnostics.firestoreChannelAttempts.length,
      allowlistCandidates: diagnostics.firestoreChannelAttempts.filter((channel) => channel.allowlistCandidate).length,
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
    diagnostics.phase = 'root-goto-before';
    const rootResponse = await page.goto(`${productionBaseURL}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    expect(rootResponse?.status()).toBe(200);
    diagnostics.phase = 'root-goto-after';

    diagnostics.phase = 'kiosk-goto-before';
    const kioskResponse = await page.goto(`${productionBaseURL}/kiosk`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    expect(kioskResponse?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'キオスクモード' })).toBeVisible({
      timeout: 30_000,
    });
    diagnostics.functional.kioskHeadingVisible = true;
    diagnostics.phase = 'kiosk-goto-after';

    diagnostics.phase = 'toilet-goto-before';
    const toiletResponse = await page.goto(`${productionBaseURL}/kiosk/toilet`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    expect(toiletResponse?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: '本日のトイレ確認' })).toBeVisible({
      timeout: 30_000,
    });
    diagnostics.functional.toiletHeadingVisible = true;
    await expect(page.getByRole('heading', { name: '本日の全記録（個人別）' })).toBeVisible({
      timeout: 30_000,
    });
    diagnostics.functional.recordsSectionVisible = true;
    diagnostics.phase = 'toilet-goto-after';

    diagnostics.phase = 'wait-30s-before';
    await page.waitForTimeout(30_000);
    diagnostics.phase = 'wait-30s-after';
    diagnostics.phase = 'reload-before';
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.getByRole('heading', { name: '本日のトイレ確認' })).toBeVisible({
      timeout: 30_000,
    });
    diagnostics.functional.reloadToiletHeadingVisible = true;
    diagnostics.phase = 'reload-after';

    expect(diagnostics.consoleErrors).toHaveLength(0);
    expect(diagnostics.pageErrors).toHaveLength(0);
    expect(diagnostics.requestFailures).toHaveLength(0);
    expect(diagnostics.httpErrors).toHaveLength(0);
    expect(diagnostics.serverErrors).toHaveLength(0);
  } finally {
    diagnostics.phase = 'scenario-end';
    finalizeChannelAttempts(diagnostics);
    await attachDiagnostics(page, diagnostics, testInfo);
  }
});
