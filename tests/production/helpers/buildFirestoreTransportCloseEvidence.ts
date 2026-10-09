import type { Request } from '@playwright/test';
import type { FirestoreTransportCloseEvidence } from './classifyFirestoreTransportClose';

export type RawRequestFailureObserved = {
  method: string;
  url: string;
  safeErrorText: string;
};

export type ObservedRequestFailureData = {
  request: Request;
  phase: string;
  failureWindow: 'during-goto' | 'after-goto-before-readiness' | 'after-readiness';
  timestamp: number;
};

export type SmokeObservationContext = {
  phase: string;
  channelLifecycleMatch: boolean;
  transitionOrReloadRelated: boolean;
  transitionOrReloadDeltaMs: number;
  laterConnectionSucceeded: boolean;
  firebaseAuthHealthy: boolean;
  functionalHealthPassed: boolean;
  consoleErrorsCount: number;
  pageErrorsCount: number;
  httpErrorsCount: number;
  serverErrorsCount: number;
  reloadObservationComplete?: boolean;
  reloadObservationDurationMs?: number;
  testEndedImmediately: boolean;
};

export function parseRequestUrl(rawURL: string): { host: string; pathname: string; safeUrlPath: string } {
  try {
    const url = new URL(rawURL);
    return {
      host: url.host,
      pathname: url.pathname,
      safeUrlPath: `${url.host}${url.pathname}`,
    };
  } catch {
    return {
      host: '<unparsed-host>',
      pathname: '<unparsed-pathname>',
      safeUrlPath: '<unparsed-url>',
    };
  }
}

export function buildFirestoreTransportCloseEvidence(
  failure: ObservedRequestFailureData,
  ctx: SmokeObservationContext,
): FirestoreTransportCloseEvidence {
  const { host, pathname } = parseRequestUrl(failure.request.url());
  const method = failure.request.method();
  const resourceType = failure.request.resourceType();
  const safeErrorText = failure.request.failure()?.errorText ?? 'unknown';

  return {
    phase: failure.phase,
    failureWindow: failure.failureWindow,
    method,
    host,
    pathname,
    resourceType,
    safeErrorText,
    channelLifecycleMatch: ctx.channelLifecycleMatch,
    transitionOrReloadRelated: ctx.transitionOrReloadRelated,
    transitionOrReloadDeltaMs: ctx.transitionOrReloadDeltaMs,
    laterConnectionSucceeded: ctx.laterConnectionSucceeded,
    firebaseAuthHealthy: ctx.firebaseAuthHealthy,
    functionalHealthPassed: ctx.functionalHealthPassed,
    consoleErrors: ctx.consoleErrorsCount,
    pageErrors: ctx.pageErrorsCount,
    httpErrors: ctx.httpErrorsCount,
    serverErrors: ctx.serverErrorsCount,
    reloadObservationComplete: ctx.reloadObservationComplete,
    reloadObservationDurationMs: ctx.reloadObservationDurationMs,
    testEndedImmediately: ctx.testEndedImmediately,
  };
}

export type FirestoreTransportCloseSummary = {
  rawRequestFailureCount: number;
  acceptedTransportCloseCount: number;
  unclassifiedRequestFailureCount: number;
  failures: {
    raw: RawRequestFailureObserved[];
    accepted: RawRequestFailureObserved[];
    unclassified: RawRequestFailureObserved[];
  };
};

export function summarizeFirestoreTransportClose(
  rawFailures: RawRequestFailureObserved[],
  acceptedFailures: RawRequestFailureObserved[],
): FirestoreTransportCloseSummary {
  const rawCount = rawFailures.length;
  const acceptedCount = acceptedFailures.length;
  const unclassifiedCount = rawCount - acceptedCount;

  const acceptedSet = new Set(acceptedFailures);
  const unclassifiedFailures = rawFailures.filter((item) => !acceptedSet.has(item));

  return {
    rawRequestFailureCount: rawCount,
    acceptedTransportCloseCount: acceptedCount,
    unclassifiedRequestFailureCount: unclassifiedCount,
    failures: {
      raw: rawFailures,
      accepted: acceptedFailures,
      unclassified: unclassifiedFailures,
    },
  };
}
