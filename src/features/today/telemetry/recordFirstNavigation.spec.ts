import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFirstNavigationTracker, type NavigationTrigger } from './recordFirstNavigation';

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

describe('createFirstNavigationTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultOpts = {
    operationalPhase: 'am-operation' as const,
    dayPhase: 'morning' as const,
    role: 'staff',
  };

  it('records first navigation to Firestore', () => {
    const tracker = createFirstNavigationTracker(defaultOpts);

    tracker.record('/daily/attendance', 'cta-primary');

    expect(mockCollection).toHaveBeenCalledWith('mock-db', 'telemetry');
    expect(mockAddDoc).toHaveBeenCalledWith(
      'mock-collection-ref',
      expect.objectContaining({
        targetUrl: '/daily/attendance',
        trigger: 'cta-primary',
        operationalPhase: 'am-operation',
        dayPhase: 'morning',
        role: 'staff',
        type: 'todayops_first_navigation',
        ts: 'mock-server-timestamp',
      }),
    );
  });

  it('records only once — second call is noop', () => {
    const tracker = createFirstNavigationTracker(defaultOpts);

    tracker.record('/daily/attendance', 'cta-primary');
    tracker.record('/handoff', 'phase-suggest');

    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    expect(tracker.recorded).toBe(true);
  });

  it('starts with recorded=false', () => {
    const tracker = createFirstNavigationTracker(defaultOpts);
    expect(tracker.recorded).toBe(false);
  });

  it('sets recorded=true after first call', () => {
    const tracker = createFirstNavigationTracker(defaultOpts);
    tracker.record('/schedules', 'sidebar-nav');
    expect(tracker.recorded).toBe(true);
  });

  it('includes dwellMs as non-negative number', () => {
    const tracker = createFirstNavigationTracker(defaultOpts);

    tracker.record('/daily/support', 'widget-chip');

    const payload = mockAddDoc.mock.calls[0][1];
    expect(typeof payload.dwellMs).toBe('number');
    expect(payload.dwellMs).toBeGreaterThanOrEqual(0);
  });

  it('includes clientTs as ISO string', () => {
    const tracker = createFirstNavigationTracker(defaultOpts);

    tracker.record('/handoff', 'phase-suggest');

    const payload = mockAddDoc.mock.calls[0][1];
    expect(payload.clientTs).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('does not throw when addDoc rejects', async () => {
    mockAddDoc.mockRejectedValueOnce(new Error('Firestore down'));

    const tracker = createFirstNavigationTracker(defaultOpts);

    expect(() => {
      tracker.record('/dashboard', 'sidebar-nav');
    }).not.toThrow();
  });

  it('does not throw when collection() throws synchronously', () => {
    mockCollection.mockImplementationOnce(() => {
      throw new Error('db not ready');
    });

    const tracker = createFirstNavigationTracker(defaultOpts);

    expect(() => {
      tracker.record('/handoff', 'cta-scene');
    }).not.toThrow();
  });

  it.each<NavigationTrigger>([
    'phase-suggest',
    'cta-primary',
    'cta-scene',
    'cta-schedule',
    'cta-empty',
    'cta-utility',
    'widget-chip',
    'sidebar-nav',
    'unknown',
  ])('accepts trigger type: %s', (trigger) => {
    const tracker = createFirstNavigationTracker(defaultOpts);

    expect(() => {
      tracker.record('/test', trigger);
    }).not.toThrow();

    const payload = mockAddDoc.mock.calls[0][1];
    expect(payload.trigger).toBe(trigger);
  });
});
