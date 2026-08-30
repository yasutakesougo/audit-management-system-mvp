import {
  FIRESTORE_TRANSPORT_CLOSE_RECONNECT_OBSERVATION_WINDOW_MS,
  type FirestoreTransportCloseEvidence,
} from './classifyFirestoreTransportClose';

export type FirestoreTransportCloseFailureSnapshot = {
  observedAtMs: number;
  method: unknown;
  host: unknown;
  pathname: unknown;
  resourceType: unknown;
  safeErrorText: unknown;
  phase: unknown;
  failureWindow: unknown;
  transitionOrReloadRelated: unknown;
  transitionOrReloadDeltaMs: unknown;
  reloadObservationComplete: unknown;
  reloadObservationDurationMs: unknown;
  testEndedImmediately: unknown;
  channelLifecycleObserved: boolean;
};

export type FirestoreTransportCloseChannelSnapshot = {
  startedAtMs: number;
  finishedAtMs?: number;
};

export type FirestoreTransportCloseAuthResponseSnapshot = {
  observedAtMs: number;
  status: number;
};

export type FirestoreTransportCloseErrorCounts = {
  consoleErrors: number;
  pageErrors: number;
  httpErrors: number;
  serverErrors: number;
};

export function buildFirestoreTransportCloseEvidence(
  failure: FirestoreTransportCloseFailureSnapshot,
  channelEvents: readonly FirestoreTransportCloseChannelSnapshot[],
  authResponses: readonly FirestoreTransportCloseAuthResponseSnapshot[],
  functionalHealthPassed: boolean,
  errorCounts: FirestoreTransportCloseErrorCounts,
): FirestoreTransportCloseEvidence {
  const laterConnectionSucceeded = channelEvents.some(
    (event) =>
      event.startedAtMs > failure.observedAtMs &&
      event.finishedAtMs !== undefined &&
      event.finishedAtMs <=
        failure.observedAtMs + FIRESTORE_TRANSPORT_CLOSE_RECONNECT_OBSERVATION_WINDOW_MS,
  );
  const authEvidence = authResponses.filter(
    (response) => response.observedAtMs <= failure.observedAtMs,
  );
  const firebaseAuthHealthy = authEvidence.length === 0
    ? undefined
    : authEvidence.every((response) => response.status >= 200 && response.status < 400);

  return {
    phase: failure.phase,
    failureWindow: failure.failureWindow,
    method: failure.method,
    host: failure.host,
    pathname: failure.pathname,
    resourceType: failure.resourceType,
    safeErrorText: failure.safeErrorText,
    channelLifecycleMatch: failure.channelLifecycleObserved,
    transitionOrReloadRelated: failure.transitionOrReloadRelated,
    transitionOrReloadDeltaMs: failure.transitionOrReloadDeltaMs,
    laterConnectionSucceeded,
    firebaseAuthHealthy,
    functionalHealthPassed,
    ...errorCounts,
    reloadObservationComplete: failure.reloadObservationComplete,
    reloadObservationDurationMs: failure.reloadObservationDurationMs,
    testEndedImmediately: failure.testEndedImmediately,
  };
}
