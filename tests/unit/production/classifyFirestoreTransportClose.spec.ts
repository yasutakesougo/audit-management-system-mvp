import { describe, expect, it } from 'vitest';
import {
  classifyFirestoreTransportClose,
  summarizeFirestoreTransportClose,
  type FirestoreTransportCloseEvidence,
} from '../../production/helpers/classifyFirestoreTransportClose';

const baseEvidence = (): FirestoreTransportCloseEvidence => ({
  phase: 'users-goto-in-flight',
  failureWindow: 'during-goto',
  method: 'POST',
  host: 'firestore.googleapis.com',
  pathname: '/google.firestore.v1.Firestore/Write/channel',
  resourceType: 'fetch',
  safeErrorText: 'net::ERR_ABORTED',
  channelLifecycleMatch: true,
  transitionOrReloadRelated: true,
  transitionOrReloadDeltaMs: 100,
  laterConnectionSucceeded: true,
  firebaseAuthHealthy: true,
  functionalHealthPassed: true,
  consoleErrors: 0,
  pageErrors: 0,
  httpErrors: 0,
  serverErrors: 0,
  testEndedImmediately: false,
});

const expectRejected = (
  overrides: Partial<FirestoreTransportCloseEvidence>,
): ReturnType<typeof classifyFirestoreTransportClose> => {
  const result = classifyFirestoreTransportClose({ ...baseEvidence(), ...overrides });
  expect(result.acceptedTransportClose).toBe(false);
  expect(result.classification).toBe('unclassifiedRequestFailure');
  return result;
};

describe('classifyFirestoreTransportClose', () => {
  it('accepts a transition-adjacent failure when every condition is satisfied', () => {
    expect(
      classifyFirestoreTransportClose({
        ...baseEvidence(),
        failureWindow: 'after-goto-before-readiness',
        transitionOrReloadDeltaMs: 0,
      }),
    ).toEqual({
      acceptedTransportClose: true,
      classification: 'acceptedTransportClose',
      reason: 'accepted',
    });
  });

  it('accepts a reload-adjacent failure after ten seconds of observation and reconnection', () => {
    expect(
      classifyFirestoreTransportClose({
        ...baseEvidence(),
        phase: 'reload-after',
        failureWindow: 'after-readiness',
        transitionOrReloadDeltaMs: 250,
        reloadObservationComplete: true,
        reloadObservationDurationMs: 10_000,
      }).acceptedTransportClose,
    ).toBe(true);
  });

  it.each([
    ['during-readiness', { failureWindow: 'during-readiness' }],
    ['before-goto', { failureWindow: 'before-goto' }],
    ['unknown window', { failureWindow: 'unknown' }],
    ['missing window', { failureWindow: undefined }],
    ['null window', { failureWindow: null }],
  ] as const)('rejects %s', (_label, overrides) => {
    expectRejected(overrides);
  });

  it.each([
    ['host', { host: 'other.example.com' }],
    ['pathname', { pathname: '/google.firestore.v1.Firestore/Listen/channel' }],
    ['method', { method: 'GET' }],
    ['resource type', { resourceType: 'xhr' }],
    ['error text', { safeErrorText: 'net::ERR_FAILED' }],
  ] as const)('rejects a %s mismatch', (_label, overrides) => {
    expectRejected(overrides);
  });

  it.each([
    ['missing method', { method: undefined }],
    ['null host', { host: null }],
    ['unknown path', { pathname: 'unknown' }],
    ['unknown phase', { phase: 'unknown' }],
    ['null lifecycle', { channelLifecycleMatch: null }],
    ['undefined auth health', { firebaseAuthHealthy: undefined }],
  ] as const)('rejects %s as missing or unknown evidence', (_label, overrides) => {
    expectRejected(overrides);
  });

  it.each([undefined, null])('rejects %s evidence objects without throwing', (evidence) => {
    expect(classifyFirestoreTransportClose(evidence)).toEqual({
      acceptedTransportClose: false,
      classification: 'unclassifiedRequestFailure',
      reason: 'request-shape-mismatch',
    });
  });

  it('rejects a channel lifecycle mismatch', () => {
    expectRejected({ channelLifecycleMatch: false });
  });

  it('rejects when the later connection did not succeed', () => {
    expectRejected({ laterConnectionSucceeded: false });
  });

  it('rejects when transition or reload evidence is absent or too far away', () => {
    expect(expectRejected({ transitionOrReloadRelated: false }).reason).toBe(
      'missing-transition-or-reload-evidence',
    );
    expect(expectRejected({ transitionOrReloadDeltaMs: undefined }).reason).toBe(
      'missing-transition-or-reload-evidence',
    );
    expect(expectRejected({ transitionOrReloadDeltaMs: 5_001 }).reason).toBe(
      'missing-transition-or-reload-evidence',
    );
  });

  it('rejects an unhealthy Firebase auth state', () => {
    expectRejected({ firebaseAuthHealthy: false });
  });

  it('rejects an unhealthy functional state', () => {
    expectRejected({ functionalHealthPassed: false });
  });

  it.each(['consoleErrors', 'pageErrors', 'httpErrors', 'serverErrors'] as const)(
    'rejects when %s is non-zero',
    (field) => {
      expectRejected({ [field]: 1 });
    },
  );

  it('rejects a reload failure before the ten-second observation minimum', () => {
    expect(
      expectRejected({
        phase: 'reload-after',
        failureWindow: 'after-readiness',
        reloadObservationComplete: true,
        reloadObservationDurationMs: 9_999,
      }).reason,
    ).toBe('reload-observation-incomplete');
  });

  it('rejects reload evidence that is incomplete even when its duration is long enough', () => {
    expect(
      expectRejected({
        phase: 'reload-after',
        failureWindow: 'after-readiness',
        reloadObservationComplete: false,
        reloadObservationDurationMs: 10_000,
      }).reason,
    ).toBe('reload-observation-incomplete');
  });

  it('rejects a failure observed at test termination', () => {
    expect(expectRejected({ testEndedImmediately: true }).reason).toBe('test-ended-immediately');
    expect(expectRejected({ testEndedImmediately: undefined }).reason).toBe(
      'test-ended-immediately',
    );
  });

  it('preserves raw failures while separating accepted and unclassified counts', () => {
    const summary = summarizeFirestoreTransportClose([
      {
        ...baseEvidence(),
        failureWindow: 'after-goto-before-readiness',
      },
      {
        ...baseEvidence(),
        method: 'GET',
      },
    ]);

    expect(summary.rawRequestFailureCount).toBe(2);
    expect(summary.acceptedTransportCloseCount).toBe(1);
    expect(summary.unclassifiedRequestFailureCount).toBe(1);
    expect(summary.results.map((result) => result.classification)).toEqual([
      'acceptedTransportClose',
      'unclassifiedRequestFailure',
    ]);
  });

  it('fails closed when the summary contains missing evidence', () => {
    const summary = summarizeFirestoreTransportClose([undefined, null]);

    expect(summary).toMatchObject({
      rawRequestFailureCount: 2,
      acceptedTransportCloseCount: 0,
      unclassifiedRequestFailureCount: 2,
    });
    expect(summary.results.every((result) => !result.acceptedTransportClose)).toBe(true);
  });
});
