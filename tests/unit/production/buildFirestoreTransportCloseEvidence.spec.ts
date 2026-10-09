import { describe, expect, it } from 'vitest';
import {
  buildFirestoreTransportCloseEvidence,
  parseRequestUrl,
  summarizeFirestoreTransportClose,
  type ObservedRequestFailureData,
  type RawRequestFailureObserved,
  type SmokeObservationContext,
} from '../../production/helpers/buildFirestoreTransportCloseEvidence';
import { classifyFirestoreTransportClose } from '../../production/helpers/classifyFirestoreTransportClose';

describe('buildFirestoreTransportCloseEvidence', () => {
  it('parses URLs safely', () => {
    expect(parseRequestUrl('https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?foo=bar')).toEqual({
      host: 'firestore.googleapis.com',
      pathname: '/google.firestore.v1.Firestore/Write/channel',
      safeUrlPath: 'firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel',
    });

    expect(parseRequestUrl('invalid-url')).toEqual({
      host: '<unparsed-host>',
      pathname: '<unparsed-pathname>',
      safeUrlPath: '<unparsed-url>',
    });
  });

  const mockRequest = (url: string, method = 'POST', resourceType = 'fetch', errorText = 'net::ERR_ABORTED') =>
    ({
      url: () => url,
      method: () => method,
      resourceType: () => resourceType,
      failure: () => ({ errorText }),
    }) as any;

  const validCtx = (): SmokeObservationContext => ({
    phase: 'users-goto-in-flight',
    channelLifecycleMatch: true,
    transitionOrReloadRelated: true,
    transitionOrReloadDeltaMs: 100,
    laterConnectionSucceeded: true,
    firebaseAuthHealthy: true,
    functionalHealthPassed: true,
    consoleErrorsCount: 0,
    pageErrorsCount: 0,
    httpErrorsCount: 0,
    serverErrorsCount: 0,
    testEndedImmediately: false,
  });

  const validFailure = (): ObservedRequestFailureData => ({
    request: mockRequest('https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel'),
    phase: 'users-goto-in-flight',
    failureWindow: 'during-goto',
    timestamp: Date.now(),
  });

  it('builds evidence from observed data that passes classifier', () => {
    const evidence = buildFirestoreTransportCloseEvidence(validFailure(), validCtx());
    const result = classifyFirestoreTransportClose(evidence);
    expect(result.acceptedTransportClose).toBe(true);
    expect(result.classification).toBe('acceptedTransportClose');
  });

  it('summarizes request failures and enforces identity raw = accepted + unclassified', () => {
    const item1: RawRequestFailureObserved = {
      method: 'POST',
      url: 'firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel',
      safeErrorText: 'net::ERR_ABORTED',
    };
    const item2: RawRequestFailureObserved = {
      method: 'GET',
      url: 'example.com/api',
      safeErrorText: 'net::ERR_FAILED',
    };

    // Case 1: 0 failures
    const summary0 = summarizeFirestoreTransportClose([], []);
    expect(summary0.rawRequestFailureCount).toBe(0);
    expect(summary0.acceptedTransportCloseCount).toBe(0);
    expect(summary0.unclassifiedRequestFailureCount).toBe(0);
    expect(summary0.rawRequestFailureCount).toBe(
      summary0.acceptedTransportCloseCount + summary0.unclassifiedRequestFailureCount,
    );

    // Case 2: 1 raw, 1 accepted
    const summary1 = summarizeFirestoreTransportClose([item1], [item1]);
    expect(summary1.rawRequestFailureCount).toBe(1);
    expect(summary1.acceptedTransportCloseCount).toBe(1);
    expect(summary1.unclassifiedRequestFailureCount).toBe(0);
    expect(summary1.rawRequestFailureCount).toBe(
      summary1.acceptedTransportCloseCount + summary1.unclassifiedRequestFailureCount,
    );

    // Case 3: 2 raw, 1 accepted
    const summary2 = summarizeFirestoreTransportClose([item1, item2], [item1]);
    expect(summary2.rawRequestFailureCount).toBe(2);
    expect(summary2.acceptedTransportCloseCount).toBe(1);
    expect(summary2.unclassifiedRequestFailureCount).toBe(1);
    expect(summary2.failures.unclassified).toEqual([item2]);
    expect(summary2.rawRequestFailureCount).toBe(
      summary2.acceptedTransportCloseCount + summary2.unclassifiedRequestFailureCount,
    );
  });

  // Additional 15 required test scenarios
  it('1. request failure 0件 -> 0 / 0 / 0', () => {
    const summary = summarizeFirestoreTransportClose([], []);
    expect(summary.rawRequestFailureCount).toBe(0);
    expect(summary.acceptedTransportCloseCount).toBe(0);
    expect(summary.unclassifiedRequestFailureCount).toBe(0);
  });

  it('2. valid transport-close -> raw 1 / accepted 1 / unclassified 0', () => {
    const evidence = buildFirestoreTransportCloseEvidence(validFailure(), validCtx());
    const classification = classifyFirestoreTransportClose(evidence);
    expect(classification.acceptedTransportClose).toBe(true);

    const rawItem: RawRequestFailureObserved = {
      method: String(evidence.method),
      url: `${evidence.host}${evidence.pathname}`,
      safeErrorText: String(evidence.safeErrorText),
    };
    const summary = summarizeFirestoreTransportClose([rawItem], [rawItem]);
    expect(summary.rawRequestFailureCount).toBe(1);
    expect(summary.acceptedTransportCloseCount).toBe(1);
    expect(summary.unclassifiedRequestFailureCount).toBe(0);
  });

  it('3. host mismatch -> unclassified 1', () => {
    const failure = {
      ...validFailure(),
      request: mockRequest('https://other.example.com/google.firestore.v1.Firestore/Write/channel'),
    };
    const evidence = buildFirestoreTransportCloseEvidence(failure, validCtx());
    const classification = classifyFirestoreTransportClose(evidence);
    expect(classification.acceptedTransportClose).toBe(false);
  });

  it('4. pathname mismatch -> unclassified 1', () => {
    const failure = {
      ...validFailure(),
      request: mockRequest('https://firestore.googleapis.com/other/path'),
    };
    const evidence = buildFirestoreTransportCloseEvidence(failure, validCtx());
    const classification = classifyFirestoreTransportClose(evidence);
    expect(classification.acceptedTransportClose).toBe(false);
  });

  it('5. method mismatch -> unclassified 1', () => {
    const failure = {
      ...validFailure(),
      request: mockRequest('https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel', 'GET'),
    };
    const evidence = buildFirestoreTransportCloseEvidence(failure, validCtx());
    const classification = classifyFirestoreTransportClose(evidence);
    expect(classification.acceptedTransportClose).toBe(false);
  });

  it('6. resourceType mismatch -> unclassified 1', () => {
    const failure = {
      ...validFailure(),
      request: mockRequest('https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel', 'POST', 'xhr'),
    };
    const evidence = buildFirestoreTransportCloseEvidence(failure, validCtx());
    const classification = classifyFirestoreTransportClose(evidence);
    expect(classification.acceptedTransportClose).toBe(false);
  });

  it('7. errorText mismatch -> unclassified 1', () => {
    const failure = {
      ...validFailure(),
      request: mockRequest('https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel', 'POST', 'fetch', 'net::ERR_FAILED'),
    };
    const evidence = buildFirestoreTransportCloseEvidence(failure, validCtx());
    const classification = classifyFirestoreTransportClose(evidence);
    expect(classification.acceptedTransportClose).toBe(false);
  });

  it('8. reconnect未観測 -> unclassified 1', () => {
    const ctx = { ...validCtx(), laterConnectionSucceeded: false };
    const evidence = buildFirestoreTransportCloseEvidence(validFailure(), ctx);
    const classification = classifyFirestoreTransportClose(evidence);
    expect(classification.acceptedTransportClose).toBe(false);
  });

  it('9. Firebase auth unknown -> unclassified 1', () => {
    const ctx = { ...validCtx(), firebaseAuthHealthy: false };
    const evidence = buildFirestoreTransportCloseEvidence(validFailure(), ctx);
    const classification = classifyFirestoreTransportClose(evidence);
    expect(classification.acceptedTransportClose).toBe(false);
  });

  it('10. functional health false -> unclassified 1', () => {
    const ctx = { ...validCtx(), functionalHealthPassed: false };
    const evidence = buildFirestoreTransportCloseEvidence(validFailure(), ctx);
    const classification = classifyFirestoreTransportClose(evidence);
    expect(classification.acceptedTransportClose).toBe(false);
  });

  it('11. HTTP errorあり -> unclassified 1', () => {
    const ctx = { ...validCtx(), httpErrorsCount: 1 };
    const evidence = buildFirestoreTransportCloseEvidence(validFailure(), ctx);
    const classification = classifyFirestoreTransportClose(evidence);
    expect(classification.acceptedTransportClose).toBe(false);
  });

  it('12. reload観測不足 -> unclassified 1', () => {
    const failure: ObservedRequestFailureData = {
      ...validFailure(),
      phase: 'reload-after',
      failureWindow: 'after-readiness',
    };
    const ctx: SmokeObservationContext = {
      ...validCtx(),
      phase: 'reload-after',
      reloadObservationComplete: true,
      reloadObservationDurationMs: 5_000,
    };
    const evidence = buildFirestoreTransportCloseEvidence(failure, ctx);
    const classification = classifyFirestoreTransportClose(evidence);
    expect(classification.acceptedTransportClose).toBe(false);
  });

  it('13. evidence欠損 -> unclassified 1', () => {
    const result = classifyFirestoreTransportClose(null);
    expect(result.acceptedTransportClose).toBe(false);
  });

  it('14. Firestore以外のrequest failure -> unclassified 1', () => {
    const rawItem: RawRequestFailureObserved = {
      method: 'GET',
      url: 'api.example.com/data',
      safeErrorText: 'net::ERR_CONNECTION_REFUSED',
    };
    const summary = summarizeFirestoreTransportClose([rawItem], []);
    expect(summary.rawRequestFailureCount).toBe(1);
    expect(summary.acceptedTransportCloseCount).toBe(0);
    expect(summary.unclassifiedRequestFailureCount).toBe(1);
  });

  it('15. 2件中1件accepted -> raw 2 / accepted 1 / unclassified 1', () => {
    const itemAccepted: RawRequestFailureObserved = {
      method: 'POST',
      url: 'firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel',
      safeErrorText: 'net::ERR_ABORTED',
    };
    const itemUnclassified: RawRequestFailureObserved = {
      method: 'GET',
      url: 'example.com/asset.png',
      safeErrorText: 'net::ERR_FAILED',
    };
    const summary = summarizeFirestoreTransportClose([itemAccepted, itemUnclassified], [itemAccepted]);
    expect(summary.rawRequestFailureCount).toBe(2);
    expect(summary.acceptedTransportCloseCount).toBe(1);
    expect(summary.unclassifiedRequestFailureCount).toBe(1);
  });
});
