import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  _resetSuggestionTelemetryGuard,
  recordSuggestionTelemetry,
} from '../recordSuggestionTelemetry';
import { SUGGESTION_TELEMETRY_EVENTS, type SuggestionTelemetryEvent } from '../buildSuggestionTelemetryEvent';

const { mockAddDoc, mockCollection, mockDb, mockIsFirestoreWriteAvailable, mockGetDb } = vi.hoisted(() => {
  const mockDb = 'mock-db';
  return {
    mockAddDoc: vi.fn().mockResolvedValue({ id: 'test-doc-id' }),
    mockCollection: vi.fn().mockReturnValue('mock-collection-ref'),
    mockDb,
    mockIsFirestoreWriteAvailable: vi.fn(() => true),
    mockGetDb: vi.fn(() => mockDb),
  };
});

vi.mock('firebase/firestore', () => ({
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  serverTimestamp: () => 'mock-server-timestamp',
}));

vi.mock('@/infra/firestore/client', () => ({
  db: mockDb,
  isFirestoreWriteAvailable: mockIsFirestoreWriteAvailable,
  getDb: mockGetDb,
}));

const baseEvent: SuggestionTelemetryEvent = {
  event: SUGGESTION_TELEMETRY_EVENTS.SHOWN,
  sourceScreen: 'today',
  stableId: 'rule:user:2026-W12',
  ruleId: 'rule',
  priority: 'P1',
  timestamp: '2026-03-21T10:00:00.000Z',
};

describe('recordSuggestionTelemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetSuggestionTelemetryGuard();
  });

  it('Firestore telemetry に送信する', () => {
    recordSuggestionTelemetry(baseEvent);

    expect(mockCollection).toHaveBeenCalledWith('mock-db', 'telemetry');
    expect(mockAddDoc).toHaveBeenCalledWith(
      'mock-collection-ref',
      expect.objectContaining({
        ...baseEvent,
        type: 'suggestion_lifecycle_event',
        ts: 'mock-server-timestamp',
        clientTs: '2026-03-21T10:00:00.000Z',
      }),
    );
  });

  it('dedupeKey が同じ場合は重複送信しない', () => {
    recordSuggestionTelemetry(baseEvent, { dedupeKey: 'shown:today:rule:user:2026-W12' });
    recordSuggestionTelemetry(baseEvent, { dedupeKey: 'shown:today:rule:user:2026-W12' });

    expect(mockAddDoc).toHaveBeenCalledTimes(1);
  });

  it('collection() が同期例外でも throw しない', () => {
    mockCollection.mockImplementationOnce(() => {
      throw new Error('db not ready');
    });

    expect(() => {
      recordSuggestionTelemetry(baseEvent);
    }).not.toThrow();
  });

  it('isFirestoreWriteAvailable が false の場合は no-op で collection/addDoc を呼ばない', () => {
    mockIsFirestoreWriteAvailable.mockReturnValueOnce(false);

    recordSuggestionTelemetry(baseEvent);

    expect(mockCollection).not.toHaveBeenCalled();
    expect(mockAddDoc).not.toHaveBeenCalled();
  });
});
