import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HUB_TELEMETRY_EVENTS, recordHubTelemetry, type HubTelemetryEvent } from '../hubTelemetry';

const mockAddDoc = vi.fn().mockResolvedValue({ id: 'hub-event-id' });
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

describe('hubTelemetry', () => {
  beforeEach(() => {
    firestoreWriteAvailable = true;
    vi.clearAllMocks();
  });

  it('records hub card click telemetry with hub metadata', () => {
    const event: HubTelemetryEvent = {
      eventName: HUB_TELEMETRY_EVENTS.CARD_CLICKED,
      hubId: 'planning',
      role: 'viewer',
      telemetryName: 'hub_planning_view',
      pathname: '/planning',
      search: '',
      entryId: 'planning-guide',
      section: 'primary',
      position: 1,
      targetUrl: '/support-plan-guide',
    };

    recordHubTelemetry(event);

    expect(mockCollection).toHaveBeenCalledWith('mock-db', 'telemetry');
    expect(mockAddDoc).toHaveBeenCalledWith(
      'mock-collection-ref',
      expect.objectContaining({
        type: 'hub_entry_telemetry',
        event: HUB_TELEMETRY_EVENTS.CARD_CLICKED,
        eventName: HUB_TELEMETRY_EVENTS.CARD_CLICKED,
        hubId: 'planning',
        role: 'viewer',
        telemetryName: 'hub_planning_view',
        entryId: 'planning-guide',
        section: 'primary',
        position: 1,
        targetUrl: '/support-plan-guide',
        ts: 'mock-server-timestamp',
      }),
    );
  });

  it('includes clientTs as ISO string', () => {
    recordHubTelemetry({
      eventName: HUB_TELEMETRY_EVENTS.HUB_VIEWED,
      hubId: 'today',
      role: 'staff',
      telemetryName: 'hub_today_view',
      visibleEntryCount: 3,
    });

    const payload = mockAddDoc.mock.calls[0][1];
    expect(payload.clientTs).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('is no-op when Firestore write is unavailable', () => {
    firestoreWriteAvailable = false;

    recordHubTelemetry({
      eventName: HUB_TELEMETRY_EVENTS.CARD_VIEWED,
      hubId: 'operations',
      role: 'reception',
      telemetryName: 'hub_operations_view',
      entryId: 'operations-attendance',
      section: 'primary',
      position: 1,
    });

    expect(mockCollection).not.toHaveBeenCalled();
    expect(mockAddDoc).not.toHaveBeenCalled();
  });
});
