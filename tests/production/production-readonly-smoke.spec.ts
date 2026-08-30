import { expect, test, type Page, type Request, type TestInfo } from '@playwright/test';
import {
  FIRESTORE_TRANSPORT_CLOSE_HOST,
  FIRESTORE_TRANSPORT_CLOSE_METHOD,
  FIRESTORE_TRANSPORT_CLOSE_PATHNAME,
  FIRESTORE_TRANSPORT_CLOSE_RECONNECT_OBSERVATION_WINDOW_MS,
  FIRESTORE_TRANSPORT_CLOSE_RESOURCE_TYPE,
  FIRESTORE_TRANSPORT_CLOSE_MIN_RELOAD_OBSERVATION_MS,
  summarizeFirestoreTransportClose,
} from './helpers/classifyFirestoreTransportClose';
import { buildFirestoreTransportCloseEvidence } from './helpers/buildFirestoreTransportCloseEvidence';

const productionBaseURL =
  process.env.PRODUCTION_BASE_URL ??
  'https://audit-management-system-mvp.momosantanuki.workers.dev';
const authWaitTimeout = Number(process.env.PRODUCTION_AUTH_TIMEOUT_MS ?? 120_000);

type SafeRequestTarget = {
  host: string;
  pathname: string;
};

type FailureContext = {
  phase: unknown;
  failureWindow: unknown;
  transitionOrReloadRelated: unknown;
  transitionOrReloadDeltaMs: unknown;
  reloadObservationComplete: unknown;
  reloadObservationDurationMs: unknown;
  testEndedImmediately: unknown;
};

type FirestoreRequestFailureObservation = {
  sequence: number;
  observedAt: string;
  observedAtMs: number;
  method: unknown;
  host: unknown;
  pathname: unknown;
  resourceType: unknown;
  safeErrorText: unknown;
  context: FailureContext;
  channelLifecycleObserved: boolean;
};

type ChannelLifecycleEvent = {
  request: Request;
  startedAtMs: number;
  finishedAtMs?: number;
};

type AuthResponseObservation = {
  observedAtMs: number;
  status: number;
};

type SmokeDiagnostics = {
  capturedAt: string;
  consoleErrors: string[];
  pageErrors: string[];
  requestFailures: FirestoreRequestFailureObservation[];
  httpErrors: string[];
  serverErrors: string[];
};

type SmokeContext = {
  phase: unknown;
  failureWindow: unknown;
  transitionOrReloadRelated: unknown;
  referenceAtMs?: number;
  reloadObservationComplete: boolean;
  reloadObservationDurationMs?: number;
};

function safeRequestTarget(rawURL: string): SafeRequestTarget | undefined {
  try {
    const url = new URL(rawURL);
    return { host: url.host, pathname: url.pathname };
  } catch {
    return undefined;
  }
}

function safeRequestLabel(method: unknown, target: SafeRequestTarget | undefined): string {
  return `${typeof method === 'string' ? method : 'unknown'} ${
    target ? `${target.host}${target.pathname}` : '<unparsed-url>'
  }`;
}

function redactDiagnosticText(value: string): string {
  return value
    .replace(/Bearer\s+[^\s]+/gi, 'Bearer <redacted>')
    .replace(/\b[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '<redacted-token>');
}

function isExactFirestoreChannelRequest(request: Request): boolean {
  const target = safeRequestTarget(request.url());
  return (
    request.method() === FIRESTORE_TRANSPORT_CLOSE_METHOD &&
    target?.host === FIRESTORE_TRANSPORT_CLOSE_HOST &&
    target.pathname === FIRESTORE_TRANSPORT_CLOSE_PATHNAME &&
    request.resourceType() === FIRESTORE_TRANSPORT_CLOSE_RESOURCE_TYPE
  );
}

function isFirebaseAuthResponse(responseURL: string): boolean {
  const target = safeRequestTarget(responseURL);
  return (
    target?.pathname === '/api/firebase/exchange' ||
    target?.host === 'identitytoolkit.googleapis.com' ||
    target?.host === 'securetoken.googleapis.com'
  );
}

function installProductionDiagnostics(page: Page): {
  diagnostics: SmokeDiagnostics;
  channelEvents: ChannelLifecycleEvent[];
  authResponses: AuthResponseObservation[];
  setContext: (context: SmokeContext) => void;
  setTestEnding: (ending: boolean) => void;
} {
  const diagnostics: SmokeDiagnostics = {
    capturedAt: new Date().toISOString(),
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    httpErrors: [],
    serverErrors: [],
  };
  const channelEvents: ChannelLifecycleEvent[] = [];
  const channelEventByRequest = new WeakMap<Request, ChannelLifecycleEvent>();
  const authResponses: AuthResponseObservation[] = [];
  let context: SmokeContext = {
    phase: undefined,
    failureWindow: undefined,
    transitionOrReloadRelated: undefined,
    reloadObservationComplete: false,
  };
  let testEnding = false;

  page.on('console', (message) => {
    if (message.type() === 'error') {
      diagnostics.consoleErrors.push(redactDiagnosticText(message.text()));
    }
  });

  page.on('pageerror', (error) => {
    diagnostics.pageErrors.push(redactDiagnosticText(String(error)));
  });

  page.on('request', (request) => {
    if (!isExactFirestoreChannelRequest(request)) return;
    const event: ChannelLifecycleEvent = { request, startedAtMs: Date.now() };
    channelEvents.push(event);
    channelEventByRequest.set(request, event);
  });

  page.on('requestfinished', (request) => {
    const event = channelEventByRequest.get(request);
    if (event) event.finishedAtMs = Date.now();
  });

  page.on('requestfailed', (request) => {
    const observedAtMs = Date.now();
    const target = safeRequestTarget(request.url());
    const channelEvent = channelEventByRequest.get(request);
    const transitionOrReloadDeltaMs = context.referenceAtMs === undefined
      ? undefined
      : Math.abs(observedAtMs - context.referenceAtMs);

    diagnostics.requestFailures.push({
      sequence: diagnostics.requestFailures.length + 1,
      observedAt: new Date(observedAtMs).toISOString(),
      observedAtMs,
      method: request.method(),
      host: target?.host,
      pathname: target?.pathname,
      resourceType: request.resourceType(),
      safeErrorText: request.failure()?.errorText ?? 'unknown',
      context: {
        phase: context.phase,
        failureWindow: context.failureWindow,
        transitionOrReloadRelated: context.transitionOrReloadRelated,
        transitionOrReloadDeltaMs,
        reloadObservationComplete: context.reloadObservationComplete,
        reloadObservationDurationMs: context.reloadObservationDurationMs,
        testEndedImmediately: testEnding,
      },
      channelLifecycleObserved: channelEvent !== undefined,
    });
  });

  page.on('response', (response) => {
    const status = response.status();
    const label = `${status} ${safeRequestLabel(response.request().method(), safeRequestTarget(response.url()))}`;

    if (status >= 400 && status < 500) diagnostics.httpErrors.push(label);
    if (status >= 500) diagnostics.serverErrors.push(label);
    if (isFirebaseAuthResponse(response.url())) {
      authResponses.push({ observedAtMs: Date.now(), status });
    }
  });

  return {
    diagnostics,
    channelEvents,
    authResponses,
    setContext: (nextContext) => {
      context = nextContext;
    },
    setTestEnding: (ending) => {
      testEnding = ending;
    },
  };
}

function buildEvidence(
  failure: FirestoreRequestFailureObservation,
  channelEvents: readonly ChannelLifecycleEvent[],
  authResponses: readonly AuthResponseObservation[],
  functionalHealthPassed: boolean,
  errorCounts: {
    consoleErrors: number;
    pageErrors: number;
    httpErrors: number;
    serverErrors: number;
  },
) {
  return buildFirestoreTransportCloseEvidence(
    {
      observedAtMs: failure.observedAtMs,
      method: failure.method,
      host: failure.host,
      pathname: failure.pathname,
      resourceType: failure.resourceType,
      safeErrorText: failure.safeErrorText,
      phase: failure.context.phase,
      failureWindow: failure.context.failureWindow,
      transitionOrReloadRelated: failure.context.transitionOrReloadRelated,
      transitionOrReloadDeltaMs: failure.context.transitionOrReloadDeltaMs,
      reloadObservationComplete: failure.context.reloadObservationComplete,
      reloadObservationDurationMs: failure.context.reloadObservationDurationMs,
      testEndedImmediately: failure.context.testEndedImmediately,
      channelLifecycleObserved: failure.channelLifecycleObserved,
    },
    channelEvents,
    authResponses,
    functionalHealthPassed,
    errorCounts,
  );
}

async function attachDiagnostics(
  page: Page,
  diagnostics: SmokeDiagnostics,
  channelEvents: readonly ChannelLifecycleEvent[],
  authResponses: readonly AuthResponseObservation[],
  functionalHealthPassed: boolean,
  testInfo: TestInfo,
): Promise<void> {
  const evidence = diagnostics.requestFailures.map((failure) =>
    buildEvidence(failure, channelEvents, authResponses, functionalHealthPassed, {
      consoleErrors: diagnostics.consoleErrors.length,
      pageErrors: diagnostics.pageErrors.length,
      httpErrors: diagnostics.httpErrors.length,
      serverErrors: diagnostics.serverErrors.length,
    }),
  );
  const summary = summarizeFirestoreTransportClose(evidence);
  const payload = {
    capturedAt: diagnostics.capturedAt,
    finalUrl: safeRequestTarget(page.url()),
    requestFailures: diagnostics.requestFailures,
    classifiedRequestFailures: evidence.map((item, index) => ({
      sequence: diagnostics.requestFailures[index]?.sequence,
      evidence: item,
      result: summary.results[index],
    })),
    counts: {
      consoleErrors: diagnostics.consoleErrors.length,
      pageErrors: diagnostics.pageErrors.length,
      httpErrors: diagnostics.httpErrors.length,
      serverErrors: diagnostics.serverErrors.length,
      requestFailures: diagnostics.requestFailures.length,
      rawRequestFailureCount: summary.rawRequestFailureCount,
      acceptedTransportCloseCount: summary.acceptedTransportCloseCount,
      unclassifiedRequestFailureCount: summary.unclassifiedRequestFailureCount,
    },
    errors: {
      console: diagnostics.consoleErrors,
      page: diagnostics.pageErrors,
      http: diagnostics.httpErrors,
      server: diagnostics.serverErrors,
    },
    contract: {
      method: FIRESTORE_TRANSPORT_CLOSE_METHOD,
      reloadMinimumObservationMs: FIRESTORE_TRANSPORT_CLOSE_MIN_RELOAD_OBSERVATION_MS,
      reconnectObservationWindowMs: FIRESTORE_TRANSPORT_CLOSE_RECONNECT_OBSERVATION_WINDOW_MS,
      duringReadiness: 'always-reject',
      unknownOrMissingEvidence: 'fail-closed',
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

test('production read-only kiosk smoke classifies Firestore transport closes', async ({ page }, testInfo) => {
  const installed = installProductionDiagnostics(page);
  let functionalHealthPassed = false;

  try {
    installed.setContext({
      phase: 'root-goto',
      failureWindow: 'during-goto',
      transitionOrReloadRelated: true,
      referenceAtMs: Date.now(),
      reloadObservationComplete: false,
    });
    await page.goto(`${productionBaseURL}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });

    installed.setContext({
      phase: 'kiosk-goto',
      failureWindow: 'during-goto',
      transitionOrReloadRelated: true,
      referenceAtMs: Date.now(),
      reloadObservationComplete: false,
    });
    await page.goto(`${productionBaseURL}/kiosk`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    installed.setContext({
      phase: 'kiosk-readiness',
      failureWindow: 'after-goto-before-readiness',
      transitionOrReloadRelated: true,
      referenceAtMs: Date.now(),
      reloadObservationComplete: false,
    });
    await expect(page.getByRole('heading', { name: 'キオスクモード' })).toBeVisible({
      timeout: authWaitTimeout,
    });
    functionalHealthPassed = true;

    installed.setContext({
      phase: 'toilet-goto',
      failureWindow: 'during-goto',
      transitionOrReloadRelated: true,
      referenceAtMs: Date.now(),
      reloadObservationComplete: false,
    });
    await page.goto(`${productionBaseURL}/kiosk/toilet`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    installed.setContext({
      phase: 'toilet-readiness',
      failureWindow: 'after-goto-before-readiness',
      transitionOrReloadRelated: true,
      referenceAtMs: Date.now(),
      reloadObservationComplete: false,
    });
    await expect(page.getByRole('heading', { name: '本日のトイレ確認' })).toBeVisible({
      timeout: 30_000,
    });
    functionalHealthPassed = true;

    installed.setContext({
      phase: 'toilet-ready-before-reload',
      failureWindow: 'after-readiness',
      transitionOrReloadRelated: false,
      reloadObservationComplete: false,
    });
    await page.waitForTimeout(30_000);

    const reloadCompletedAtMs = Date.now();
    installed.setContext({
      phase: 'reload-in-flight',
      failureWindow: 'after-readiness',
      transitionOrReloadRelated: true,
      referenceAtMs: reloadCompletedAtMs,
      reloadObservationComplete: false,
    });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.getByRole('heading', { name: '本日のトイレ確認' })).toBeVisible({
      timeout: 30_000,
    });
    functionalHealthPassed = true;

    const observationStartedAtMs = Date.now();
    installed.setContext({
      phase: 'reload-after',
      failureWindow: 'after-readiness',
      transitionOrReloadRelated: true,
      referenceAtMs: observationStartedAtMs,
      reloadObservationComplete: false,
    });
    await page.waitForTimeout(FIRESTORE_TRANSPORT_CLOSE_MIN_RELOAD_OBSERVATION_MS);
    installed.setContext({
      phase: 'reload-after-observed',
      failureWindow: 'after-readiness',
      transitionOrReloadRelated: true,
      referenceAtMs: observationStartedAtMs,
      reloadObservationComplete: true,
      reloadObservationDurationMs: Date.now() - observationStartedAtMs,
    });

    installed.setTestEnding(true);
    const evidence = installed.diagnostics.requestFailures.map((failure) =>
      buildEvidence(failure, installed.channelEvents, installed.authResponses, functionalHealthPassed, {
        consoleErrors: installed.diagnostics.consoleErrors.length,
        pageErrors: installed.diagnostics.pageErrors.length,
        httpErrors: installed.diagnostics.httpErrors.length,
        serverErrors: installed.diagnostics.serverErrors.length,
      }),
    );
    const summary = summarizeFirestoreTransportClose(evidence);

    expect(summary.rawRequestFailureCount).toBe(installed.diagnostics.requestFailures.length);
    expect(
      summary.acceptedTransportCloseCount + summary.unclassifiedRequestFailureCount,
    ).toBe(summary.rawRequestFailureCount);
    expect(summary.unclassifiedRequestFailureCount).toBe(0);
    expect(installed.diagnostics.consoleErrors).toHaveLength(0);
    expect(installed.diagnostics.pageErrors).toHaveLength(0);
    expect(installed.diagnostics.httpErrors).toHaveLength(0);
    expect(installed.diagnostics.serverErrors).toHaveLength(0);
  } finally {
    installed.setTestEnding(true);
    await attachDiagnostics(
      page,
      installed.diagnostics,
      installed.channelEvents,
      installed.authResponses,
      functionalHealthPassed,
      testInfo,
    );
  }
});
