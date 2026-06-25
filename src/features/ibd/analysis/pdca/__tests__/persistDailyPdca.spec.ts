import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createDailyEventCreateOnly,
  upsertDailySnapshot,
  persistDailySubmission,
  makeIdempotencyKey,
  type PersistDailyPdcaInput,
} from '../persistDailyPdca';

const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockDoc = vi.fn().mockReturnValue('mock-doc-ref');
const mockTimestampFromDate = vi.fn((value: Date) => ({ value }));

let firestoreWriteAvailable = true;

vi.mock('firebase/firestore', () => ({
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  serverTimestamp: () => 'mock-server-timestamp',
  Timestamp: {
    fromDate: (value: Date) => mockTimestampFromDate(value),
  },
}));

vi.mock('@/infra/firestore/client', () => ({
  db: 'mock-db',
  isFirestoreWriteAvailable: () => firestoreWriteAvailable,
}));

const baseInput: PersistDailyPdcaInput = {
  orgId: 'org-1',
  templateId: 'template-1',
  targetDate: '2026-06-26',
  targetUserId: 'user-1',
  actorUserId: 'actor-1',
  actorName: 'Alice',
  type: 'DAILY_SUPPORT_SUBMITTED',
  clientVersion: '1.0.0',
  sourceRoute: '/daily',
  ref: 'ref-1',
  metrics: { completionRate: 100, leadTimeMinutes: 12, unfilledCount: 0 },
  submittedAt: new Date('2026-06-26T01:02:03.000Z'),
};

describe('persistDailyPdca', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firestoreWriteAvailable = true;
  });

  it('returns idempotencyKey and does not call setDoc when Firestore writes are unavailable', async () => {
    firestoreWriteAvailable = false;

    const result = await createDailyEventCreateOnly(baseInput);

    expect(result).toEqual({ idempotencyKey: makeIdempotencyKey(baseInput) });
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('does not call setDoc in upsertDailySnapshot when Firestore writes are unavailable', async () => {
    firestoreWriteAvailable = false;

    await upsertDailySnapshot(baseInput);

    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('calls setDoc when Firestore writes are available', async () => {
    await createDailyEventCreateOnly(baseInput);
    await upsertDailySnapshot(baseInput);

    expect(mockSetDoc).toHaveBeenCalledTimes(2);
    expect(mockSetDoc).toHaveBeenNthCalledWith(
      1,
      'mock-doc-ref',
      expect.objectContaining({
        type: 'DAILY_SUPPORT_SUBMITTED',
        idempotencyKey: makeIdempotencyKey(baseInput),
      }),
      { merge: false },
    );
    expect(mockSetDoc).toHaveBeenNthCalledWith(
      2,
      'mock-doc-ref',
      expect.objectContaining({
        orgId: 'org-1',
        templateId: 'template-1',
      }),
      { merge: true },
    );
  });

  it('skips both writes in persistDailySubmission when Firestore writes are unavailable', async () => {
    firestoreWriteAvailable = false;

    const result = await persistDailySubmission(baseInput);

    expect(result).toBeUndefined();
    expect(mockSetDoc).not.toHaveBeenCalled();
  });
});
