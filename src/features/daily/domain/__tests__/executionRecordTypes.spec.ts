import { describe, expect, it } from 'vitest';
import {
    createEmptyRecord,
    executionRecordSchema,
    executionStoreSchema,
    makeDailyUserKey,
    makeRecordId,
    type ExecutionRecord,
} from '../executionRecordTypes';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

describe('makeRecordId', () => {
  it('creates composite key from date, userId, scheduleItemId', () => {
    expect(makeRecordId('2025-04-01', 'I001', 'base-0900')).toBe('2025-04-01-I001-base-0900');
  });
});

describe('makeDailyUserKey', () => {
  it('creates date::userId key', () => {
    expect(makeDailyUserKey('2025-04-01', 'I001')).toBe('2025-04-01::I001');
  });
});

describe('createEmptyRecord', () => {
  it('creates a record with unrecorded status', () => {
    const record = createEmptyRecord('2025-04-01', 'I001', 'base-0900');
    expect(record).toEqual({
      id: '2025-04-01-I001-base-0900',
      date: '2025-04-01',
      userId: 'I001',
      scheduleItemId: 'base-0900',
      status: 'unrecorded',
      triggeredBipIds: [],
      memo: '',
      recordedBy: '',
      recordedAt: '',
    });
  });
});

// ---------------------------------------------------------------------------
// Zod validation
// ---------------------------------------------------------------------------

describe('executionRecordSchema', () => {
  const validRecord: ExecutionRecord = {
    id: '2025-04-01-I001-base-0900',
    date: '2025-04-01',
    userId: 'I001',
    scheduleItemId: 'base-0900',
    status: 'completed',
    triggeredBipIds: [],
    memo: '',
    recordedBy: 'staff-1',
    recordedAt: '2025-04-01T10:00:00Z',
  };

  it('validates a correct record', () => {
    expect(() => executionRecordSchema.parse(validRecord)).not.toThrow();
  });

  it('rejects invalid date format', () => {
    expect(() =>
      executionRecordSchema.parse({ ...validRecord, date: '2025/04/01' }),
    ).toThrow();
  });

  it('rejects invalid status', () => {
    expect(() =>
      executionRecordSchema.parse({ ...validRecord, status: 'invalid' }),
    ).toThrow();
  });

  it('accepts all 4 valid statuses', () => {
    for (const status of ['completed', 'triggered', 'skipped', 'unrecorded']) {
      expect(() =>
        executionRecordSchema.parse({ ...validRecord, status }),
      ).not.toThrow();
    }
  });
});

describe('executionStoreSchema', () => {
  it('validates empty store', () => {
    expect(() =>
      executionStoreSchema.parse({ version: 1, data: {} }),
    ).not.toThrow();
  });

  it('validates store with records', () => {
    const payload = {
      version: 1,
      data: {
        '2025-04-01::I001': {
          date: '2025-04-01',
          userId: 'I001',
          records: [{
            id: '2025-04-01-I001-base-0900',
            date: '2025-04-01',
            userId: 'I001',
            scheduleItemId: 'base-0900',
            status: 'completed',
            triggeredBipIds: [],
            memo: '',
            recordedBy: '',
            recordedAt: '2025-04-01T10:00:00Z',
          }],
          updatedAt: '2025-04-01T10:00:00Z',
        },
      },
    };
    expect(() => executionStoreSchema.parse(payload)).not.toThrow();
  });
});
