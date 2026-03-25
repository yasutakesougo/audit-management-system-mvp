import { beforeEach, describe, expect, it, vi } from 'vitest';
import { recordLanding } from './recordLanding';

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

describe('recordLanding', () => {
  beforeEach(() => {
    firestoreWriteAvailable = true;
    vi.clearAllMocks();
  });

  it('records landing event to telemetry collection', () => {
    recordLanding({
      path: '/today',
      search: '?tab=ops',
      role: 'staff',
      referrer: '',
      userAgent: 'test-agent',
    });

    expect(mockCollection).toHaveBeenCalledWith('mock-db', 'telemetry');
    expect(mockAddDoc).toHaveBeenCalledWith(
      'mock-collection-ref',
      expect.objectContaining({
        type: 'todayops_landing',
        path: '/today',
        search: '?tab=ops',
        role: 'staff',
        ts: 'mock-server-timestamp',
      }),
    );
  });

  it('is no-op when Firestore is unavailable', () => {
    firestoreWriteAvailable = false;

    recordLanding({
      path: '/today',
      search: '',
      role: 'staff',
      referrer: '',
      userAgent: 'test-agent',
    });

    expect(mockCollection).not.toHaveBeenCalled();
    expect(mockAddDoc).not.toHaveBeenCalled();
  });
});
