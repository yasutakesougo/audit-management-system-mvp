import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KIOSK_TELEMETRY_EVENTS } from './kioskNavigationTelemetry.types';
import { recordKioskTelemetry } from './recordKioskTelemetry';

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

describe('recordKioskTelemetry', () => {
  beforeEach(() => {
    firestoreWriteAvailable = true;
    vi.clearAllMocks();
  });

  it('records kiosk telemetry to Firestore telemetry collection', () => {
    recordKioskTelemetry(KIOSK_TELEMETRY_EVENTS.KIOSK_SESSION_STARTED, {
      mode: 'kiosk',
      source: 'today',
      role: 'staff',
    });

    expect(mockCollection).toHaveBeenCalledWith('mock-db', 'telemetry');
    expect(mockAddDoc).toHaveBeenCalledWith(
      'mock-collection-ref',
      expect.objectContaining({
        event: 'ux_kiosk_session_started',
        type: 'kiosk_ux_event',
        mode: 'kiosk',
        source: 'today',
        role: 'staff',
        ts: 'mock-server-timestamp',
      }),
    );
  });

  it('is no-op when Firestore is unavailable', () => {
    firestoreWriteAvailable = false;

    recordKioskTelemetry(KIOSK_TELEMETRY_EVENTS.OPEN_FAB_MENU, {
      mode: 'kiosk',
      source: 'fab',
    });

    expect(mockCollection).not.toHaveBeenCalled();
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('does not throw when addDoc rejects', () => {
    mockAddDoc.mockRejectedValueOnce(new Error('Firestore down'));

    expect(() => {
      recordKioskTelemetry(KIOSK_TELEMETRY_EVENTS.RETURN_TO_TODAY, {
        mode: 'kiosk',
        source: 'header_back',
      });
    }).not.toThrow();
  });

  it('does not throw when collection() throws synchronously', () => {
    mockCollection.mockImplementationOnce(() => {
      throw new Error('db not ready');
    });

    expect(() => {
      recordKioskTelemetry(KIOSK_TELEMETRY_EVENTS.NAVIGATE_FROM_TODAY, {
        mode: 'kiosk',
        source: 'today',
        target: 'handoff',
      });
    }).not.toThrow();
  });
});
