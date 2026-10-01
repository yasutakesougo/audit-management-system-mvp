export const FIRESTORE_TRANSPORT_CLOSE_HOST = 'firestore.googleapis.com';
export const FIRESTORE_TRANSPORT_CLOSE_PATHNAME =
  '/google.firestore.v1.Firestore/Write/channel';
export const FIRESTORE_TRANSPORT_CLOSE_METHOD = 'POST';
export const FIRESTORE_TRANSPORT_CLOSE_RESOURCE_TYPE = 'fetch';
export const FIRESTORE_TRANSPORT_CLOSE_ERROR_TEXT = 'net::ERR_ABORTED';
export const FIRESTORE_TRANSPORT_CLOSE_MAX_TRANSITION_DELTA_MS = 5_000;
export const FIRESTORE_TRANSPORT_CLOSE_MIN_RELOAD_OBSERVATION_MS = 10_000;
export const FIRESTORE_TRANSPORT_CLOSE_RECONNECT_OBSERVATION_WINDOW_MS = 10_000;

export type FirestoreTransportCloseFailureWindow =
  | 'during-goto'
  | 'after-goto-before-readiness'
  | 'after-readiness';

export type FirestoreTransportCloseClassification =
  | 'acceptedTransportClose'
  | 'unclassifiedRequestFailure';

export type FirestoreTransportCloseRejectionReason =
  | 'accepted'
  | 'request-shape-mismatch'
  | 'invalid-phase'
  | 'unsupported-failure-window'
  | 'missing-transition-or-reload-evidence'
  | 'channel-lifecycle-mismatch'
  | 'later-connection-not-observed'
  | 'firebase-auth-unhealthy'
  | 'functional-health-failed'
  | 'browser-or-server-errors-present'
  | 'reload-observation-incomplete'
  | 'test-ended-immediately';

/**
 * Safe, production-independent evidence consumed by the transport-close
 * classifier. Values are intentionally unknown so malformed or missing
 * evidence cannot pass through truthy coercion.
 */
export type FirestoreTransportCloseEvidence = {
  phase: unknown;
  failureWindow: unknown;
  method: unknown;
  host: unknown;
  pathname: unknown;
  resourceType: unknown;
  safeErrorText: unknown;
  channelLifecycleMatch: unknown;
  transitionOrReloadRelated: unknown;
  transitionOrReloadDeltaMs: unknown;
  laterConnectionSucceeded: unknown;
  firebaseAuthHealthy: unknown;
  functionalHealthPassed: unknown;
  consoleErrors: unknown;
  pageErrors: unknown;
  httpErrors: unknown;
  serverErrors: unknown;
  reloadObservationComplete?: unknown;
  reloadObservationDurationMs?: unknown;
  testEndedImmediately: unknown;
};

export type FirestoreTransportCloseResult = {
  acceptedTransportClose: boolean;
  classification: FirestoreTransportCloseClassification;
  reason: FirestoreTransportCloseRejectionReason;
};

export type FirestoreTransportCloseSummary = {
  rawRequestFailureCount: number;
  acceptedTransportCloseCount: number;
  unclassifiedRequestFailureCount: number;
  results: FirestoreTransportCloseResult[];
};

const allowedFailureWindows: readonly FirestoreTransportCloseFailureWindow[] = [
  'during-goto',
  'after-goto-before-readiness',
  'after-readiness',
];

const rejected = (reason: FirestoreTransportCloseRejectionReason): FirestoreTransportCloseResult => ({
  acceptedTransportClose: false,
  classification: 'unclassifiedRequestFailure',
  reason,
});

const accepted = (): FirestoreTransportCloseResult => ({
  acceptedTransportClose: true,
  classification: 'acceptedTransportClose',
  reason: 'accepted',
});

function isKnownPhase(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value !== 'unknown';
}

function isAllowedFailureWindow(value: unknown): value is FirestoreTransportCloseFailureWindow {
  return (
    typeof value === 'string' &&
    allowedFailureWindows.includes(value as FirestoreTransportCloseFailureWindow)
  );
}

function isFiniteNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isZeroErrorCount(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value === 0;
}

export function classifyFirestoreTransportClose(
  evidence: FirestoreTransportCloseEvidence | null | undefined,
): FirestoreTransportCloseResult {
  if (evidence === null || evidence === undefined) {
    return rejected('request-shape-mismatch');
  }

  const requestShapeMatches =
    evidence.method === FIRESTORE_TRANSPORT_CLOSE_METHOD &&
    evidence.host === FIRESTORE_TRANSPORT_CLOSE_HOST &&
    evidence.pathname === FIRESTORE_TRANSPORT_CLOSE_PATHNAME &&
    evidence.resourceType === FIRESTORE_TRANSPORT_CLOSE_RESOURCE_TYPE &&
    evidence.safeErrorText === FIRESTORE_TRANSPORT_CLOSE_ERROR_TEXT;

  if (!requestShapeMatches) return rejected('request-shape-mismatch');
  if (!isKnownPhase(evidence.phase)) return rejected('invalid-phase');
  if (!isAllowedFailureWindow(evidence.failureWindow)) {
    return rejected('unsupported-failure-window');
  }

  if (
    evidence.transitionOrReloadRelated !== true ||
    !isFiniteNonNegativeNumber(evidence.transitionOrReloadDeltaMs) ||
    evidence.transitionOrReloadDeltaMs > FIRESTORE_TRANSPORT_CLOSE_MAX_TRANSITION_DELTA_MS
  ) {
    return rejected('missing-transition-or-reload-evidence');
  }

  if (evidence.channelLifecycleMatch !== true) {
    return rejected('channel-lifecycle-mismatch');
  }
  if (evidence.laterConnectionSucceeded !== true) {
    return rejected('later-connection-not-observed');
  }
  if (evidence.firebaseAuthHealthy !== true) {
    return rejected('firebase-auth-unhealthy');
  }
  if (evidence.functionalHealthPassed !== true) {
    return rejected('functional-health-failed');
  }

  if (
    !isZeroErrorCount(evidence.consoleErrors) ||
    !isZeroErrorCount(evidence.pageErrors) ||
    !isZeroErrorCount(evidence.httpErrors) ||
    !isZeroErrorCount(evidence.serverErrors)
  ) {
    return rejected('browser-or-server-errors-present');
  }

  if (evidence.testEndedImmediately !== false) {
    return rejected('test-ended-immediately');
  }

  if (evidence.failureWindow === 'after-readiness') {
    if (
      evidence.reloadObservationComplete !== true ||
      !isFiniteNonNegativeNumber(evidence.reloadObservationDurationMs) ||
      evidence.reloadObservationDurationMs < FIRESTORE_TRANSPORT_CLOSE_MIN_RELOAD_OBSERVATION_MS
    ) {
      return rejected('reload-observation-incomplete');
    }
  }

  return accepted();
}

export function summarizeFirestoreTransportClose(
  evidence: readonly (FirestoreTransportCloseEvidence | null | undefined)[],
): FirestoreTransportCloseSummary {
  const results = evidence.map((item) => classifyFirestoreTransportClose(item));
  const acceptedTransportCloseCount = results.filter(
    (result) => result.acceptedTransportClose,
  ).length;

  return {
    rawRequestFailureCount: evidence.length,
    acceptedTransportCloseCount,
    unclassifiedRequestFailureCount: evidence.length - acceptedTransportCloseCount,
    results,
  };
}
