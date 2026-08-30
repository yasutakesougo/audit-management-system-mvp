import { describe, expect, it } from 'vitest';
import {
  buildFirestoreTransportCloseEvidence,
  type FirestoreTransportCloseAuthResponseSnapshot,
  type FirestoreTransportCloseChannelSnapshot,
  type FirestoreTransportCloseFailureSnapshot,
} from '../../production/helpers/buildFirestoreTransportCloseEvidence';
import {
  FIRESTORE_TRANSPORT_CLOSE_ERROR_TEXT,
  FIRESTORE_TRANSPORT_CLOSE_HOST,
  FIRESTORE_TRANSPORT_CLOSE_METHOD,
  FIRESTORE_TRANSPORT_CLOSE_PATHNAME,
  FIRESTORE_TRANSPORT_CLOSE_RESOURCE_TYPE,
} from '../../production/helpers/classifyFirestoreTransportClose';

const baseFailure = (): FirestoreTransportCloseFailureSnapshot => ({
  observedAtMs: 1_000,
  method: FIRESTORE_TRANSPORT_CLOSE_METHOD,
  host: FIRESTORE_TRANSPORT_CLOSE_HOST,
  pathname: FIRESTORE_TRANSPORT_CLOSE_PATHNAME,
  resourceType: FIRESTORE_TRANSPORT_CLOSE_RESOURCE_TYPE,
  safeErrorText: FIRESTORE_TRANSPORT_CLOSE_ERROR_TEXT,
  phase: 'reload-after',
  failureWindow: 'after-readiness',
  transitionOrReloadRelated: true,
  transitionOrReloadDeltaMs: 250,
  reloadObservationComplete: true,
  reloadObservationDurationMs: 10_000,
  testEndedImmediately: false,
  channelLifecycleObserved: true,
});

const healthyAuth = (): FirestoreTransportCloseAuthResponseSnapshot[] => [
  { observedAtMs: 900, status: 200 },
];

const laterConnection = (): FirestoreTransportCloseChannelSnapshot[] => [
  { startedAtMs: 1_500, finishedAtMs: 1_600 },
];

const zeroErrors = {
  consoleErrors: 0,
  pageErrors: 0,
  httpErrors: 0,
  serverErrors: 0,
};

describe('buildFirestoreTransportCloseEvidence', () => {
  it('builds complete evidence for a successful later connection', () => {
    expect(
      buildFirestoreTransportCloseEvidence(
        baseFailure(),
        laterConnection(),
        healthyAuth(),
        true,
        zeroErrors,
      ),
    ).toMatchObject({
      laterConnectionSucceeded: true,
      firebaseAuthHealthy: true,
      functionalHealthPassed: true,
      consoleErrors: 0,
      pageErrors: 0,
      httpErrors: 0,
      serverErrors: 0,
    });
  });

  it('fails closed when auth evidence is absent', () => {
    const evidence = buildFirestoreTransportCloseEvidence(
      baseFailure(),
      laterConnection(),
      [],
      true,
      zeroErrors,
    );

    expect(evidence.firebaseAuthHealthy).toBeUndefined();
  });

  it('does not count a connection outside the fixed observation window', () => {
    const evidence = buildFirestoreTransportCloseEvidence(
      baseFailure(),
      [{ startedAtMs: 11_001, finishedAtMs: 11_002 }],
      healthyAuth(),
      true,
      zeroErrors,
    );

    expect(evidence.laterConnectionSucceeded).toBe(false);
  });

  it('carries non-zero error counts into the classifier evidence', () => {
    const evidence = buildFirestoreTransportCloseEvidence(
      baseFailure(),
      laterConnection(),
      healthyAuth(),
      true,
      { ...zeroErrors, httpErrors: 1 },
    );

    expect(evidence.httpErrors).toBe(1);
  });
});
