import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CTA_EVENTS, recordCtaClick, type CtaClickEvent } from './recordCtaClick';

// ── Mock Firestore ──
const mockAddDoc = vi.fn().mockResolvedValue({ id: 'test-doc-id' });
const mockCollection = vi.fn().mockReturnValue('mock-collection-ref');
let firestoreWriteAvailable = true;

vi.mock('firebase/firestore', () => ({
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  serverTimestamp: () => 'mock-server-timestamp',
}));

vi.mock('@/infra/firestore/client', () => ({
  getDb: () => 'mock-db',
  isFirestoreWriteAvailable: () => firestoreWriteAvailable,
}));

describe('recordCtaClick', () => {
  beforeEach(() => {
    firestoreWriteAvailable = true;
    vi.clearAllMocks();
  });

  it('sends CTA event to Firestore telemetry collection', () => {
    const event: CtaClickEvent = {
      ctaId: CTA_EVENTS.NEXT_ACTION_PRIMARY,
      sourceComponent: 'NextActionCard',
      stateType: 'scene-action',
      scene: '終礼',
      priority: 'high',
    };

    recordCtaClick(event);

    expect(mockCollection).toHaveBeenCalledWith('mock-db', 'telemetry');
    expect(mockAddDoc).toHaveBeenCalledWith(
      'mock-collection-ref',
      expect.objectContaining({
        ctaId: 'today_next_action_primary_clicked',
        sourceComponent: 'NextActionCard',
        stateType: 'scene-action',
        scene: '終礼',
        priority: 'high',
        type: 'todayops_cta_click',
        ts: 'mock-server-timestamp',
      }),
    );
  });

  it('includes clientTs as ISO string', () => {
    recordCtaClick({
      ctaId: CTA_EVENTS.NEXT_ACTION_EMPTY,
      sourceComponent: 'NextActionCard',
      stateType: 'empty-state',
    });

    const payload = mockAddDoc.mock.calls[0][1];
    expect(payload.clientTs).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('does not throw when addDoc rejects', async () => {
    mockAddDoc.mockRejectedValueOnce(new Error('Firestore down'));

    expect(() => {
      recordCtaClick({
        ctaId: CTA_EVENTS.NEXT_ACTION_UTILITY,
        sourceComponent: 'NextActionCard',
        stateType: 'empty-state',
      });
    }).not.toThrow();
  });

  it('does not throw when collection() throws synchronously', () => {
    mockCollection.mockImplementationOnce(() => {
      throw new Error('db not ready');
    });

    expect(() => {
      recordCtaClick({
        ctaId: CTA_EVENTS.BRIEFING_ACTION,
        sourceComponent: 'BriefingActionList',
        stateType: 'widget-action',
      });
    }).not.toThrow();
  });

  it('passes optional fields when provided', () => {
    recordCtaClick({
      ctaId: CTA_EVENTS.NEXT_ACTION_SCHEDULE,
      sourceComponent: 'NextActionCard',
      stateType: 'schedule-context',
      targetUrl: '/schedules?date=2026-03-11',
      userRole: 'staff',
    });

    const payload = mockAddDoc.mock.calls[0][1];
    expect(payload.targetUrl).toBe('/schedules?date=2026-03-11');
    expect(payload.userRole).toBe('staff');
  });

  it('is no-op when Firestore is unavailable', () => {
    firestoreWriteAvailable = false;

    recordCtaClick({
      ctaId: CTA_EVENTS.NEXT_ACTION_PRIMARY,
      sourceComponent: 'NextActionCard',
      stateType: 'scene-action',
    });

    expect(mockCollection).not.toHaveBeenCalled();
    expect(mockAddDoc).not.toHaveBeenCalled();
  });
});

describe('CTA_EVENTS', () => {
  it('has consistent naming convention', () => {
    const values = Object.values(CTA_EVENTS);
    for (const v of values) {
      expect(v).toMatch(/^(today|calllog|handoff|daily)_/);
      expect(v).toMatch(/_(clicked|toggled)$/);
    }
  });

  it('has 30 defined events', () => {
    expect(Object.keys(CTA_EVENTS)).toHaveLength(30);
  });
});
