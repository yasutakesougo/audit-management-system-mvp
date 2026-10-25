import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type Request,
  type TestInfo,
} from '@playwright/test';
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
  | 'auth-hydration-wait'
  | 'auth-hydration-ready'
  | 'kiosk-goto-before'
  | 'kiosk-goto-after'
  | 'users-goto-before'
  | 'users-goto-in-flight'
  | 'users-goto-after'
  | 'users-data-readiness-before'
  | 'users-data-readiness-in-flight'
  | 'users-data-readiness-after'
  | 'toilet-goto-before'
  | 'toilet-goto-after'
  | 'wait-30s-before'
  | 'wait-30s-after'
  | 'reload-before'
  | 'reload-after'
  | 'scenario-end';

type FailureWindow =
  | 'before-goto'
  | 'during-goto'
  | 'after-goto-before-readiness'
  | 'during-readiness'
  | 'after-readiness'
  | 'unknown';

const transitionEvidenceThresholdMs = 5_000;

type ChannelAttempt = {
  id: number;
  capturedAt: string;
  phase: SmokePhase;
  page: string;
  method: string;
  host: string;
  path: string;
  resourceType: string;
  startedElapsedMs: number;
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

type AllowlistEvidence = {
  firestoreWriteChannel: boolean;
  methodAndResourceType: boolean;
  expectedError: boolean;
  transitionOrReloadRelated: boolean;
  subsequentConnectionSucceeded: boolean;
  firebaseAuthHealthy: boolean;
  functionalHealthy: boolean;
  pageAndHttpErrorsClear: boolean;
  channelLifecycleMatch: boolean;
};

type RequestFailureDiagnostic = {
  id: number;
  capturedAt: string;
  phase: SmokePhase;
  page: string;
  method: string;
  host: string;
  path: string;
  resourceType: string;
  errorText: string;
  channelId: number | null;
  failureElapsedMs: number;
  channelStartedSequence: number | null;
  channelStartedPhase: SmokePhase | null;
  channelStartedElapsedMs: number | null;
  routeGotoStartedElapsedMs: number | null;
  routeGotoCompletedElapsedMs: number | null;
  dataReadinessStartedElapsedMs: number | null;
  dataReadinessCompletedElapsedMs: number | null;
  nearestTransitionDeltaMs: number | null;
  nearestReloadDeltaMs: number | null;
  failureWindow: FailureWindow;
  channelLifecycleMatch: boolean;
  allowlistCandidate: boolean;
  allowlistEvidence: AllowlistEvidence;
};

type SafeRequestFailureSummary = {
  sequence: number;
  phase: SmokePhase;
  method: string;
  host: string;
  pathname: string;
  resourceType: string;
  safeErrorText: string;
  channelId: number | null;
  channelStartedSequence: number | null;
  channelStartedPhase: SmokePhase | null;
  channelStartedElapsedMs: number | null;
  failureElapsedMs: number;
  routeGotoStartedElapsedMs: number | null;
  routeGotoCompletedElapsedMs: number | null;
  dataReadinessStartedElapsedMs: number | null;
  dataReadinessCompletedElapsedMs: number | null;
  nearestTransitionDeltaMs: number | null;
  nearestReloadDeltaMs: number | null;
  failureWindow: FailureWindow;
  channelLifecycleMatch: boolean;
  allowlistCandidate: boolean;
  transitionOrReloadRelated: boolean;
  laterConnectionSucceeded: boolean;
  firebaseAuthHealthy: boolean;
  functionalHealthPassed: boolean;
  pageErrorsZero: boolean;
  httpErrorsZero: boolean;
  serverErrorsZero: boolean;
};

type SmokeDiagnostics = {
  capturedAt: string;
  phase: SmokePhase;
  consoleErrors: string[];
  firebaseAuthErrors: string[];
  firebaseAuthSuccessLogs: string[];
  firestoreInitializationSuccessLogs: string[];
  pageErrors: string[];
  requestFailures: RequestFailureDiagnostic[];
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
    webdriver: boolean;
    playwrightHintPresent: boolean;
    accountCount: number;
    activeAccountPresent: boolean;
    kioskAppShellVisible: boolean;
    kioskLayoutEnabled: boolean;
    kioskHomeHeadingVisible: boolean;
    executeStepsActionVisible: boolean;
    callbackRedirectObserved: boolean;
    authHydrationPollIterationCount: number;
    authHydrationTimedOut: boolean;
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
  timeline: {
    routeGotoStartedElapsedMs: number | null;
    routeGotoCompletedElapsedMs: number | null;
    dataReadinessStartedElapsedMs: number | null;
    dataReadinessCompletedElapsedMs: number | null;
    reloadStartedElapsedMs: number | null;
    reloadCompletedElapsedMs: number | null;
    transitionElapsedMs: number[];
    reloadElapsedMs: number[];
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

const diagnosticsStartedAt = new WeakMap<SmokeDiagnostics, number>();

function elapsedMs(diagnostics: SmokeDiagnostics): number {
  return Date.now() - (diagnosticsStartedAt.get(diagnostics) ?? Date.now());
}

function nearestDeltaMs(value: number, candidates: number[]): number | null {
  if (candidates.length === 0) return null;
  return Math.min(...candidates.map((candidate) => Math.abs(value - candidate)));
}

function classifyFailureWindow(
  failureElapsedMs: number,
  timeline: SmokeDiagnostics['timeline'],
): FailureWindow {
  const {
    routeGotoStartedElapsedMs,
    routeGotoCompletedElapsedMs,
    dataReadinessStartedElapsedMs,
    dataReadinessCompletedElapsedMs,
  } = timeline;

  if (routeGotoStartedElapsedMs === null) return 'unknown';
  if (failureElapsedMs < routeGotoStartedElapsedMs) return 'before-goto';
  if (routeGotoCompletedElapsedMs === null || failureElapsedMs <= routeGotoCompletedElapsedMs) {
    return 'during-goto';
  }
  if (dataReadinessStartedElapsedMs === null || failureElapsedMs < dataReadinessStartedElapsedMs) {
    return 'after-goto-before-readiness';
  }
  if (dataReadinessCompletedElapsedMs === null || failureElapsedMs <= dataReadinessCompletedElapsedMs) {
    return 'during-readiness';
  }
  return 'after-readiness';
}

function beginRouteGoto(diagnostics: SmokeDiagnostics): void {
  const started = elapsedMs(diagnostics);
  diagnostics.timeline.routeGotoStartedElapsedMs = started;
  diagnostics.timeline.routeGotoCompletedElapsedMs = null;
  diagnostics.timeline.dataReadinessStartedElapsedMs = null;
  diagnostics.timeline.dataReadinessCompletedElapsedMs = null;
  diagnostics.timeline.transitionElapsedMs.push(started);
}

function completeRouteGoto(diagnostics: SmokeDiagnostics): void {
  const completed = elapsedMs(diagnostics);
  diagnostics.timeline.routeGotoCompletedElapsedMs = completed;
  diagnostics.timeline.transitionElapsedMs.push(completed);
}

function beginDataReadiness(diagnostics: SmokeDiagnostics): void {
  diagnostics.timeline.dataReadinessStartedElapsedMs = elapsedMs(diagnostics);
}

function completeDataReadiness(diagnostics: SmokeDiagnostics): void {
  diagnostics.timeline.dataReadinessCompletedElapsedMs = elapsedMs(diagnostics);
}

function beginReload(diagnostics: SmokeDiagnostics): void {
  const started = elapsedMs(diagnostics);
  diagnostics.timeline.reloadStartedElapsedMs = started;
  diagnostics.timeline.reloadCompletedElapsedMs = null;
  diagnostics.timeline.reloadElapsedMs.push(started);
}

function completeReload(diagnostics: SmokeDiagnostics): void {
  const completed = elapsedMs(diagnostics);
  diagnostics.timeline.reloadCompletedElapsedMs = completed;
  diagnostics.timeline.reloadElapsedMs.push(completed);
}

async function isSignInScreenVisible(page: Page): Promise<boolean> {
  return page
    .locator('input[name="loginfmt"], input[type="email"]')
    .first()
    .isVisible()
    .catch(() => false);
}

async function installProductionRealAuthMode(
  context: BrowserContext,
  productionOrigin: string,
): Promise<void> {
  await context.addInitScript(
    ({ origin }) => {
      if (window.location.origin !== origin) return;

      Object.defineProperty(Navigator.prototype, 'webdriver', {
        configurable: true,
        get: () => false,
      });
    },
    { origin: productionOrigin },
  );
}

async function readAutomationState(page: Page): Promise<{
  webdriver: boolean;
  playwrightHintPresent: boolean;
}> {
  return page.evaluate(() => {
    const automationHints = window as Window & { __PLAYWRIGHT__?: unknown };
    return {
      webdriver: navigator.webdriver,
      playwrightHintPresent: Boolean(automationHints.__PLAYWRIGHT__),
    };
  });
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
    channel.transitionOrReloadRelated = false;
    channel.allowlistCandidate = false;
  }
}

function finalizeRequestFailures(diagnostics: SmokeDiagnostics): void {
  const channelsById = new Map(
    diagnostics.firestoreChannelAttempts.map((channel) => [channel.id, channel]),
  );

  for (const failure of diagnostics.requestFailures) {
    const channel = failure.channelId === null ? undefined : channelsById.get(failure.channelId);
    const failureWindow = failure.failureWindow;
    const nearestTransitionDeltaMs = failure.nearestTransitionDeltaMs;
    const nearestReloadDeltaMs = failure.nearestReloadDeltaMs;
    const transitionOrReloadRelated =
      failureWindow === 'during-goto' ||
      (failureWindow === 'after-goto-before-readiness' &&
        nearestTransitionDeltaMs !== null &&
        nearestTransitionDeltaMs <= transitionEvidenceThresholdMs) ||
      (nearestReloadDeltaMs !== null && nearestReloadDeltaMs <= transitionEvidenceThresholdMs);
    const channelLifecycleMatch = Boolean(
      channel?.lifecycle.some(
        (event) =>
          event.event === 'failed' &&
          event.phase === failure.phase &&
          event.errorText === failure.errorText,
      ),
    );
    const evidence: AllowlistEvidence = {
      firestoreWriteChannel: Boolean(channel),
      methodAndResourceType: Boolean(
        channel &&
          (channel.method === 'GET' || channel.method === 'POST') &&
          channel.resourceType === 'fetch',
      ),
      expectedError: channel?.failedErrorText === 'net::ERR_ABORTED',
      transitionOrReloadRelated,
      subsequentConnectionSucceeded: channel?.subsequentConnectionSucceeded ?? false,
      firebaseAuthHealthy:
        diagnostics.firebaseAuthErrors.length === 0 &&
        diagnostics.firebaseAuthSuccessLogs.length > 0,
      functionalHealthy:
        diagnostics.functional.usersHeadingVisible &&
        diagnostics.functional.toiletHeadingVisible &&
        diagnostics.functional.recordsSectionVisible &&
        diagnostics.functional.reloadToiletHeadingVisible,
      pageAndHttpErrorsClear:
        diagnostics.pageErrors.length === 0 && diagnostics.httpErrors.length === 0,
      channelLifecycleMatch,
    };

    failure.channelLifecycleMatch = channelLifecycleMatch;
    failure.allowlistEvidence = evidence;
    failure.allowlistCandidate = Object.values(evidence).every(Boolean);
    if (channel) {
      channel.transitionOrReloadRelated = transitionOrReloadRelated;
      channel.allowlistCandidate = failure.allowlistCandidate;
    }
  }
}

function buildSafeRequestFailureSummary(
  diagnostics: SmokeDiagnostics,
): SafeRequestFailureSummary[] {
  const pageErrorsZero = diagnostics.pageErrors.length === 0;
  const httpErrorsZero = diagnostics.httpErrors.length === 0;
  const serverErrorsZero = diagnostics.serverErrors.length === 0;

  return diagnostics.requestFailures.map((failure) => ({
    sequence: failure.id,
    phase: failure.phase,
    method: failure.method,
    host: failure.host,
    pathname: failure.path,
    resourceType: failure.resourceType,
    safeErrorText: failure.errorText,
    channelId: failure.channelId,
    channelStartedSequence: failure.channelStartedSequence,
    channelStartedPhase: failure.channelStartedPhase,
    channelStartedElapsedMs: failure.channelStartedElapsedMs,
    failureElapsedMs: failure.failureElapsedMs,
    routeGotoStartedElapsedMs: failure.routeGotoStartedElapsedMs,
    routeGotoCompletedElapsedMs: failure.routeGotoCompletedElapsedMs,
    dataReadinessStartedElapsedMs: failure.dataReadinessStartedElapsedMs,
    dataReadinessCompletedElapsedMs: failure.dataReadinessCompletedElapsedMs,
    nearestTransitionDeltaMs: failure.nearestTransitionDeltaMs,
    nearestReloadDeltaMs: failure.nearestReloadDeltaMs,
    failureWindow: failure.failureWindow,
    channelLifecycleMatch: failure.channelLifecycleMatch,
    allowlistCandidate: failure.allowlistCandidate,
    transitionOrReloadRelated: failure.allowlistEvidence.transitionOrReloadRelated,
    laterConnectionSucceeded: failure.allowlistEvidence.subsequentConnectionSucceeded,
    firebaseAuthHealthy: failure.allowlistEvidence.firebaseAuthHealthy,
    functionalHealthPassed: failure.allowlistEvidence.functionalHealthy,
    pageErrorsZero,
    httpErrorsZero,
    serverErrorsZero,
  }));
}

function isCompleteSafeRequestFailureSummary(
  summary: SafeRequestFailureSummary,
): boolean {
  return (
    Number.isInteger(summary.sequence) &&
    summary.phase.length > 0 &&
    summary.method.length > 0 &&
    summary.host.length > 0 &&
    summary.pathname.startsWith('/') &&
    summary.resourceType.length > 0 &&
    summary.safeErrorText.length > 0 &&
    (summary.channelId === null || Number.isInteger(summary.channelId)) &&
    (summary.channelStartedSequence === null || Number.isInteger(summary.channelStartedSequence)) &&
    (summary.channelStartedPhase === null || summary.channelStartedPhase.length > 0) &&
    Number.isInteger(summary.failureElapsedMs) &&
    summary.failureElapsedMs >= 0 &&
    [
      summary.channelStartedElapsedMs,
      summary.routeGotoStartedElapsedMs,
      summary.routeGotoCompletedElapsedMs,
      summary.dataReadinessStartedElapsedMs,
      summary.dataReadinessCompletedElapsedMs,
      summary.nearestTransitionDeltaMs,
      summary.nearestReloadDeltaMs,
    ].every((value) => value === null || (Number.isInteger(value) && value >= 0)) &&
    [
      'before-goto',
      'during-goto',
      'after-goto-before-readiness',
      'during-readiness',
      'after-readiness',
      'unknown',
    ].includes(summary.failureWindow) &&
    [
      summary.channelLifecycleMatch,
      summary.allowlistCandidate,
      summary.transitionOrReloadRelated,
      summary.laterConnectionSucceeded,
      summary.firebaseAuthHealthy,
      summary.functionalHealthPassed,
      summary.pageErrorsZero,
      summary.httpErrorsZero,
      summary.serverErrorsZero,
    ].every((value) => typeof value === 'boolean')
  );
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
      webdriver: false,
      playwrightHintPresent: false,
      accountCount: 0,
      activeAccountPresent: false,
      kioskAppShellVisible: false,
      kioskLayoutEnabled: false,
      kioskHomeHeadingVisible: false,
      executeStepsActionVisible: false,
      callbackRedirectObserved: false,
      authHydrationPollIterationCount: 0,
      authHydrationTimedOut: false,
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
    timeline: {
      routeGotoStartedElapsedMs: null,
      routeGotoCompletedElapsedMs: null,
      dataReadinessStartedElapsedMs: null,
      dataReadinessCompletedElapsedMs: null,
      reloadStartedElapsedMs: null,
      reloadCompletedElapsedMs: null,
      transitionElapsedMs: [],
      reloadElapsedMs: [],
    },
  };

  diagnosticsStartedAt.set(diagnostics, Date.now());

  const requests = new Map<Request, ChannelAttempt>();
  let nextChannelId = 1;
  let nextRequestFailureId = 1;

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
    const failureElapsedMs = elapsedMs(diagnostics);
    const url = new URL(request.url());
    const errorText = safeFailureText(request.failure()?.errorText ?? 'unknown');
    const channel = requests.get(request);
    diagnostics.requestFailures.push({
      id: nextRequestFailureId++,
      capturedAt,
      phase: diagnostics.phase,
      page: safeUrlPath(page.url()),
      method: request.method(),
      host: url.host,
      path: url.pathname,
      resourceType: request.resourceType(),
      errorText,
      channelId: channel?.id ?? null,
      failureElapsedMs,
      channelStartedSequence: channel?.id ?? null,
      channelStartedPhase: channel?.phase ?? null,
      channelStartedElapsedMs: channel?.startedElapsedMs ?? null,
      routeGotoStartedElapsedMs: diagnostics.timeline.routeGotoStartedElapsedMs,
      routeGotoCompletedElapsedMs: diagnostics.timeline.routeGotoCompletedElapsedMs,
      dataReadinessStartedElapsedMs: diagnostics.timeline.dataReadinessStartedElapsedMs,
      dataReadinessCompletedElapsedMs: diagnostics.timeline.dataReadinessCompletedElapsedMs,
      nearestTransitionDeltaMs: nearestDeltaMs(
        failureElapsedMs,
        diagnostics.timeline.transitionElapsedMs,
      ),
      nearestReloadDeltaMs: nearestDeltaMs(
        failureElapsedMs,
        diagnostics.timeline.reloadElapsedMs,
      ),
      failureWindow: classifyFailureWindow(failureElapsedMs, diagnostics.timeline),
      channelLifecycleMatch: false,
      allowlistCandidate: false,
      allowlistEvidence: {
        firestoreWriteChannel: false,
        methodAndResourceType: false,
        expectedError: false,
        transitionOrReloadRelated: false,
        subsequentConnectionSucceeded: false,
        firebaseAuthHealthy: false,
        functionalHealthy: false,
        pageAndHttpErrorsClear: false,
        channelLifecycleMatch: false,
      },
    });

    if (channel) {
      channel.failedErrorText = errorText;
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
      startedElapsedMs: elapsedMs(diagnostics),
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
  const requestFailureSummary = buildSafeRequestFailureSummary(diagnostics);
  const requestFailureSummaryCount = requestFailureSummary.length;
  const requestFailureCount = diagnostics.requestFailures.length;
  const summaryCountMatches = requestFailureSummaryCount === requestFailureCount;
  const allFailuresClassified =
    summaryCountMatches && requestFailureSummary.every(isCompleteSafeRequestFailureSummary);
  const allAllowlistCandidates = requestFailureSummary.every(
    (failure) => failure.allowlistCandidate,
  );
  const payload = {
    ...diagnostics,
    requestFailureSummary,
    requestFailureSummaryCount,
    requestFailureCount,
    summaryCountMatches,
    allFailuresClassified,
    allAllowlistCandidates,
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
      requestFailureSummaryCount,
      requestFailureCount,
      summaryCountMatches,
      allFailuresClassified,
      allAllowlistCandidates,
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
  const body = JSON.stringify(payload, null, 2);
  const diagnosticPath = testInfo.outputPath('production-readonly-smoke.json');

  await mkdir(dirname(diagnosticPath), { recursive: true });
  try {
    await writeFile(diagnosticPath, body, 'utf8');
    const persistedBody = await readFile(diagnosticPath, 'utf8');
    const parsedPayload: unknown = JSON.parse(persistedBody);
    if (!parsedPayload || typeof parsedPayload !== 'object') {
      throw new Error('invalid diagnostics payload');
    }
  } catch {
    throw new Error('production smoke diagnostics persistence failed');
  }

  await testInfo.attach('production-readonly-smoke.json', {
    body,
    contentType: 'application/json',
  });

  console.log(
    '[production-readonly-safe-summary]',
    JSON.stringify({
      requestFailureSummary,
      requestFailureSummaryCount,
      requestFailureCount,
      summaryCountMatches,
      allFailuresClassified,
      allAllowlistCandidates,
    }),
  );

  expect(summaryCountMatches, 'request failure summary count mismatch').toBe(true);
  expect(allFailuresClassified, 'request failure summary classification incomplete').toBe(true);

  try {
    await unlink(diagnosticPath);
  } catch {
    throw new Error('production smoke diagnostics cleanup failed');
  }
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
  await installProductionRealAuthMode(context, productionOrigin);
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
    const automationState = await readAutomationState(page);
    diagnostics.authReplay.webdriver = automationState.webdriver;
    diagnostics.authReplay.playwrightHintPresent = automationState.playwrightHintPresent;
    expect(automationState.webdriver).toBe(false);
    expect(automationState.playwrightHintPresent).toBe(false);
    diagnostics.phase = 'auth-hydration-wait';
    try {
      await expect
        .poll(
          async () => {
            diagnostics.authReplay.authHydrationPollIterationCount += 1;
            const authSnapshot = await readSafeMsalSnapshot(page).catch(() => ({
              accountCount: 0,
              activeAccountPresent: false,
            }));
            diagnostics.authReplay.accountCount = authSnapshot.accountCount;
            diagnostics.authReplay.activeAccountPresent = authSnapshot.activeAccountPresent;
            return authSnapshot.accountCount >= 1 && authSnapshot.activeAccountPresent;
          },
          {
            timeout: 30_000,
            intervals: [250, 500, 1_000, 2_000],
            message: 'production MSAL account hydration timeout',
          },
        )
        .toBe(true);
      diagnostics.phase = 'auth-hydration-ready';
    } catch (error) {
      diagnostics.authReplay.authHydrationTimedOut = true;
      throw error;
    }
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
    beginRouteGoto(diagnostics);
    diagnostics.phase = 'users-goto-in-flight';
    const usersResponse = await page.goto(`${productionBaseURL}/kiosk/users`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    completeRouteGoto(diagnostics);
    diagnostics.phase = 'users-goto-after';
    expect(usersResponse?.status()).toBe(200);
    if (usersResponse) diagnostics.dataReadiness.httpStatuses.push(usersResponse.status());
    expect(new URL(page.url()).pathname).toBe('/kiosk/users');
    await expect(
      page.getByRole('heading', { name: '利用者を選択してください' }),
    ).toBeVisible({ timeout: 30_000 });
    diagnostics.dataReadiness.usersHeadingVisible = true;
    diagnostics.functional.usersHeadingVisible = true;
    diagnostics.phase = 'users-data-readiness-before';
    beginDataReadiness(diagnostics);
    diagnostics.phase = 'users-data-readiness-in-flight';
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
    completeDataReadiness(diagnostics);
    diagnostics.phase = 'users-data-readiness-after';

    diagnostics.phase = 'toilet-goto-before';
    beginRouteGoto(diagnostics);
    const toiletResponse = await page.goto(`${productionBaseURL}/kiosk/toilet`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    completeRouteGoto(diagnostics);
    diagnostics.phase = 'toilet-goto-after';
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
    diagnostics.phase = 'wait-30s-before';
    await page.waitForTimeout(30_000);
    diagnostics.phase = 'wait-30s-after';
    diagnostics.phase = 'reload-before';
    beginReload(diagnostics);
    const reloadResponse = await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
    completeReload(diagnostics);
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
    finalizeRequestFailures(diagnostics);
    await attachDiagnostics(page, diagnostics, testInfo, readOnlyGuard.getDiagnostics());
  }
});
