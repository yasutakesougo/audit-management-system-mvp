import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PHASE_EVENTS,
  recordPhaseEvent,
  _resetGuard,
  type PhaseEventPayload,
} from './recordPhaseEvent';

// ── Mock Firestore ──
const mockAddDoc = vi.fn().mockResolvedValue({ id: 'test-doc-id' });
const mockCollection = vi.fn().mockReturnValue('mock-collection-ref');

vi.mock('firebase/firestore', () => ({
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  serverTimestamp: () => 'mock-server-timestamp',
}));

vi.mock('@/infra/firestore/client', () => ({
  db: 'mock-db',
}));

describe('recordPhaseEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetGuard();
  });

  it('sends event to Firestore telemetry collection', () => {
    const payload: PhaseEventPayload = {
      event: PHASE_EVENTS.SUGGEST_SHOWN,
      phase: 'morning-meeting',
      screen: '/today',
    };

    recordPhaseEvent(payload);

    expect(mockCollection).toHaveBeenCalledWith('mock-db', 'telemetry');
    expect(mockAddDoc).toHaveBeenCalledWith(
      'mock-collection-ref',
      expect.objectContaining({
        event: 'phase-suggest-shown',
        phase: 'morning-meeting',
        screen: '/today',
        type: 'operational_phase_event',
        ts: 'mock-server-timestamp',
      }),
    );
  });

  it('includes clientTs as ISO string', () => {
    recordPhaseEvent({
      event: PHASE_EVENTS.MEETING_SUGGESTED,
      suggestedMode: 'morning',
      screen: '/handoff',
    });

    const payload = mockAddDoc.mock.calls[0][1];
    expect(payload.clientTs).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('includes suggestedMode for meeting-mode events', () => {
    recordPhaseEvent({
      event: PHASE_EVENTS.MEETING_ACCEPTED,
      suggestedMode: 'evening',
      screen: '/handoff',
    });

    const payload = mockAddDoc.mock.calls[0][1];
    expect(payload.suggestedMode).toBe('evening');
  });

  it('includes reason for config-load-fallback', () => {
    recordPhaseEvent({
      event: PHASE_EVENTS.CONFIG_FALLBACK,
      reason: 'repository-error',
      screen: '/today',
    });

    const payload = mockAddDoc.mock.calls[0][1];
    expect(payload.reason).toBe('repository-error');
  });

  it('does not throw when addDoc rejects', () => {
    mockAddDoc.mockRejectedValueOnce(new Error('Firestore down'));

    expect(() => {
      recordPhaseEvent({
        event: PHASE_EVENTS.SUGGEST_DISMISSED,
        screen: '/today',
      });
    }).not.toThrow();
  });

  it('does not throw when collection() throws synchronously', () => {
    mockCollection.mockImplementationOnce(() => {
      throw new Error('db not ready');
    });

    expect(() => {
      recordPhaseEvent({
        event: PHASE_EVENTS.SUGGEST_SHOWN,
        screen: '/daily',
      });
    }).not.toThrow();
  });

  describe('重複送信ガード (dedupe)', () => {
    it('sends the first event normally', () => {
      recordPhaseEvent(
        { event: PHASE_EVENTS.SUGGEST_SHOWN, screen: '/today', phase: 'am-operation' },
        { dedupe: true },
      );

      expect(mockAddDoc).toHaveBeenCalledTimes(1);
    });

    it('blocks duplicate shown events with same key', () => {
      const payload: PhaseEventPayload = {
        event: PHASE_EVENTS.SUGGEST_SHOWN,
        screen: '/today',
        phase: 'am-operation',
      };

      recordPhaseEvent(payload, { dedupe: true });
      recordPhaseEvent(payload, { dedupe: true });
      recordPhaseEvent(payload, { dedupe: true });

      expect(mockAddDoc).toHaveBeenCalledTimes(1);
    });

    it('allows different events for the same screen', () => {
      recordPhaseEvent(
        { event: PHASE_EVENTS.SUGGEST_SHOWN, screen: '/today', phase: 'am-operation' },
        { dedupe: true },
      );
      recordPhaseEvent(
        { event: PHASE_EVENTS.SUGGEST_DISMISSED, screen: '/today', phase: 'am-operation' },
        { dedupe: true },
      );

      expect(mockAddDoc).toHaveBeenCalledTimes(2);
    });

    it('allows same event for different screens', () => {
      recordPhaseEvent(
        { event: PHASE_EVENTS.SUGGEST_SHOWN, screen: '/today', phase: 'am-operation' },
        { dedupe: true },
      );
      recordPhaseEvent(
        { event: PHASE_EVENTS.SUGGEST_SHOWN, screen: '/daily', phase: 'am-operation' },
        { dedupe: true },
      );

      expect(mockAddDoc).toHaveBeenCalledTimes(2);
    });

    it('does not dedupe when option is not set', () => {
      const payload: PhaseEventPayload = {
        event: PHASE_EVENTS.SUGGEST_SHOWN,
        screen: '/today',
        phase: 'am-operation',
      };

      recordPhaseEvent(payload);
      recordPhaseEvent(payload);

      expect(mockAddDoc).toHaveBeenCalledTimes(2);
    });

    it('_resetGuard clears the guard set', () => {
      const payload: PhaseEventPayload = {
        event: PHASE_EVENTS.MEETING_SUGGESTED,
        screen: '/handoff',
        suggestedMode: 'morning',
      };

      recordPhaseEvent(payload, { dedupe: true });
      expect(mockAddDoc).toHaveBeenCalledTimes(1);

      _resetGuard();

      recordPhaseEvent(payload, { dedupe: true });
      expect(mockAddDoc).toHaveBeenCalledTimes(2);
    });
  });
});

describe('PHASE_EVENTS', () => {
  it('has 7 defined events', () => {
    expect(Object.keys(PHASE_EVENTS)).toHaveLength(7);
  });

  it('has consistent naming with hyphens', () => {
    const values = Object.values(PHASE_EVENTS);
    for (const v of values) {
      expect(v).toMatch(/^[a-z]+-[a-z]+-[a-z]+$/);
    }
  });
});
