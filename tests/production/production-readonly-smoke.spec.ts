import { expect, test, type Page, type Request, type TestInfo } from '@playwright/test';
import {
  installProductionReadOnlyGuard,
  isProductionSharePointRequest,
  isAuthRedirect,
  readSafeMsalSnapshot,
  type ProductionReadOnlyGuardDiagnostics,
} from './_helpers/productionReadOnlyGuard';

const productionBaseURL =
  process.env.PRODUCTION_BASE_URL ??
  'https://audit-management-system-mvp.momosantanuki.workers.dev';
const kioskDataReadyTimeout = 60_000;

type SmokePhase =
  | 'authenticated-storage-state-reuse'
  | 'kiosk-goto-before'
  | 'kiosk-goto-after'
  | 'users-goto-before'
  | 'users-goto-after'
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
  authReplay: {
    storageStateCreated: boolean;
    freshContextCreated: boolean;
    accountCount: number;
    activeAccountPresent: boolean;
    kioskAppShellVisible: boolean;
    kioskLayoutEnabled: boolean;
    kioskHomeHeadingVisible: boolean;
    executeStepsActionVisible: boolean;
    callbackRedirectObserved: boolean;
  };
  dataReadiness: {
    timeoutMs: number;
    elapsedMs: number;
    httpStatuses: number[];
    progressbarVisible: boolean;
    usersHeadingVisible: boolean;
    userCardVisible: boolean;
    loadErrorVisible: boolean;
  };
  functional: {
    kioskAppShellVisible: boolean;
    kioskHomeHeadingVisible: boolean;
    executeStepsActionVisible: boolean;
    usersHeadingVisible: boolean;
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

function safeFailureText(value: string): string {
  if (value === 'net::ERR_ABORTED') return value;
  if (/timed? ?out/i.test(value)) return 'timeout';
  return 'request-failed';
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

async function isSignInScreenVisible(page: Page): Promise<boolean> {
  return page
    .locator('input[name="loginfmt"], input[type="email"]')
    .first()
    .isVisible()
    .catch(() => false);
}

async function readKioskDataReadiness(page: Page, startedAt: number): Promise<{
  elapsedMs: number;
  progressbarVisible: boolean;
  usersHeadingVisible: boolean;
  userCardVisible: boolean;
  loadErrorVisible: boolean;
}> {
  return {
    elapsedMs: Date.now() - startedAt,
    progressbarVisible: await page.getByRole('progressbar').first().isVisible().catch(() => false),
    usersHeadingVisible: await page
      .getByRole('heading', { name: '利用者を選択してください' })
      .isVisible()
      .catch(() => false),
    userCardVisible: await page
      .locator('[data-testid^="kiosk-user-card-"]')
      .first()
      .isVisible()
      .catch(() => false),
    loadErrorVisible: await page
      .getByText('利用者の読み込みに失敗しました', { exact: true })
      .isVisible()
      .catch(() => false),
  };
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
      diagnostics.functional.usersHeadingVisible &&
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
    authReplay: {
      storageStateCreated: true,
      freshContextCreated: true,
      accountCount: 0,
      activeAccountPresent: false,
      kioskAppShellVisible: false,
      kioskLayoutEnabled: false,
      kioskHomeHeadingVisible: false,
      executeStepsActionVisible: false,
      callbackRedirectObserved: false,
    },
    dataReadiness: {
      timeoutMs: kioskDataReadyTimeout,
      elapsedMs: 0,
      httpStatuses: [],
      progressbarVisible: false,
      usersHeadingVisible: false,
      userCardVisible: false,
      loadErrorVisible: false,
    },
    functional: {
      kioskAppShellVisible: false,
      kioskHomeHeadingVisible: false,
      executeStepsActionVisible: false,
      usersHeadingVisible: false,
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
    const errorText = message.text();
    if (message.type() === 'error') {
      diagnostics.consoleErrors.push('console-error');
    }
    if (errorText.includes('[firebase-auth] ✅')) {
      diagnostics.firebaseAuthSuccessLogs.push('firebase-auth-success');
    }
    if (errorText.includes('[firebase-auth]') && errorText.includes('initialization failed')) {
      diagnostics.firebaseAuthErrors.push('firebase-auth-initialization-failed');
    }
    if (/\[firestore\].*(initialized|connected|ready|success)/i.test(errorText)) {
      diagnostics.firestoreInitializationSuccessLogs.push('firestore-initialized');
    }
  });

  page.on('pageerror', () => {
    diagnostics.pageErrors.push('page-error');
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
      errorText: safeFailureText(request.failure()?.errorText ?? 'unknown'),
    });

    const channel = requests.get(request);
    if (channel) {
      channel.failedErrorText = safeFailureText(request.failure()?.errorText ?? 'unknown');
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
  guardDiagnostics: ProductionReadOnlyGuardDiagnostics,
): Promise<void> {
  const productionOrigin = new URL(productionBaseURL).origin;
  const productionProtocol = new URL(productionBaseURL).protocol;
  const sharePointHttpErrors = diagnostics.httpErrors.filter(
    (error) =>
      isProductionSharePointRequest(
        `${productionProtocol}//${error.host}${error.path}`,
        productionOrigin,
      ),
  );
  const payload = {
    ...diagnostics,
    sharePoint: {
      ...guardDiagnostics,
      http4xx: sharePointHttpErrors.filter((error) => error.status >= 400 && error.status < 500).length,
      http5xx: sharePointHttpErrors.filter((error) => error.status >= 500).length,
    },
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
      sharePointReadRequests: guardDiagnostics.readRequests,
      sharePointMutationAttempts: guardDiagnostics.mutationAttempts,
      sharePointMutationAttemptsBlocked: guardDiagnostics.mutationAttemptsBlocked,
      sharePointHttp4xx: sharePointHttpErrors.filter((error) => error.status >= 400 && error.status < 500).length,
      sharePointHttp5xx: sharePointHttpErrors.filter((error) => error.status >= 500).length,
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

test('production read-only kiosk smoke collects all browser failure channels', async ({ page, context }, testInfo) => {
  const diagnostics = installProductionDiagnostics(page);
  const productionOrigin = new URL(productionBaseURL).origin;
  let callbackRedirectObserved = false;
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame() && isAuthRedirect(frame.url(), productionOrigin)) {
      callbackRedirectObserved = true;
    }
  });
  const readOnlyGuard = await installProductionReadOnlyGuard(context, {
    productionOrigin,
    getPhase: () => diagnostics.phase,
  });

  try {
    diagnostics.phase = 'kiosk-goto-before';
    const kioskResponse = await page.goto(`${productionBaseURL}/kiosk`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    expect(kioskResponse?.status()).toBe(200);
    if (kioskResponse) diagnostics.dataReadiness.httpStatuses.push(kioskResponse.status());
    expect(new URL(page.url()).pathname).toBe('/kiosk');
    const authSnapshot = await readSafeMsalSnapshot(page);
    diagnostics.authReplay.accountCount = authSnapshot.accountCount;
    diagnostics.authReplay.activeAccountPresent = authSnapshot.activeAccountPresent;
    diagnostics.authReplay.callbackRedirectObserved = callbackRedirectObserved;
    expect(diagnostics.authReplay.accountCount).toBeGreaterThanOrEqual(1);
    expect(diagnostics.authReplay.activeAccountPresent).toBe(true);
    expect(diagnostics.authReplay.callbackRedirectObserved).toBe(false);
    expect(await isSignInScreenVisible(page)).toBe(false);

    const appShell = page.getByTestId('app-shell');
    await expect(appShell).toBeVisible({ timeout: 30_000 });
    diagnostics.authReplay.kioskAppShellVisible = true;
    diagnostics.functional.kioskAppShellVisible = true;
    diagnostics.authReplay.kioskLayoutEnabled = (await appShell.getAttribute('data-kiosk')) === 'true';
    expect(diagnostics.authReplay.kioskLayoutEnabled).toBe(true);

    await expect(
      page.getByRole('heading', { name: 'キオスクモード' }),
    ).toBeVisible({ timeout: 30_000 });
    diagnostics.authReplay.kioskHomeHeadingVisible = true;
    diagnostics.functional.kioskHomeHeadingVisible = true;
    await expect(
      page.getByTestId('kiosk-action-execute-steps'),
    ).toBeVisible({ timeout: 30_000 });
    diagnostics.authReplay.executeStepsActionVisible = true;
    diagnostics.functional.executeStepsActionVisible = true;
    diagnostics.phase = 'kiosk-goto-after';

    diagnostics.phase = 'users-goto-before';
    const usersResponse = await page.goto(`${productionBaseURL}/kiosk/users`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    expect(usersResponse?.status()).toBe(200);
    if (usersResponse) diagnostics.dataReadiness.httpStatuses.push(usersResponse.status());
    expect(new URL(page.url()).pathname).toBe('/kiosk/users');
    await expect(
      page.getByRole('heading', { name: '利用者を選択してください' }),
    ).toBeVisible({ timeout: 30_000 });
    diagnostics.dataReadiness.usersHeadingVisible = true;
    diagnostics.functional.usersHeadingVisible = true;
    const dataReadyStartedAt = Date.now();
    await expect
      .poll(
        async () => {
          const readiness = await readKioskDataReadiness(page, dataReadyStartedAt);
          Object.assign(diagnostics.dataReadiness, readiness);
          return !readiness.progressbarVisible && (readiness.userCardVisible || readiness.loadErrorVisible);
        },
        {
          timeout: kioskDataReadyTimeout,
          message: 'kiosk data readiness timeout',
        },
      )
      .toBe(true);
    diagnostics.phase = 'users-goto-after';

    diagnostics.phase = 'toilet-goto-before';
    const toiletResponse = await page.goto(`${productionBaseURL}/kiosk/toilet`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    expect(toiletResponse?.status()).toBe(200);
    if (toiletResponse) diagnostics.dataReadiness.httpStatuses.push(toiletResponse.status());
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
    const reloadResponse = await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
    if (reloadResponse) diagnostics.dataReadiness.httpStatuses.push(reloadResponse.status());
    await expect(page.getByRole('heading', { name: '本日のトイレ確認' })).toBeVisible({
      timeout: 30_000,
    });
    diagnostics.functional.reloadToiletHeadingVisible = true;
    diagnostics.phase = 'reload-after';

    const guardDiagnostics = readOnlyGuard.getDiagnostics();
    expect(
      guardDiagnostics.mutationAttempts,
      'production read-only violation: SharePoint mutation request attempted',
    ).toBe(0);
    expect(diagnostics.consoleErrors).toHaveLength(0);
    expect(diagnostics.pageErrors).toHaveLength(0);
    expect(diagnostics.requestFailures).toHaveLength(0);
    expect(diagnostics.httpErrors).toHaveLength(0);
    expect(diagnostics.serverErrors).toHaveLength(0);
  } finally {
    diagnostics.phase = 'scenario-end';
    finalizeChannelAttempts(diagnostics);
    await attachDiagnostics(page, diagnostics, testInfo, readOnlyGuard.getDiagnostics());
  }
});
