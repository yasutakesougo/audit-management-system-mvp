import { beforeEach, describe, expect, it, vi } from 'vitest';

import { trackSpEvent } from '@/lib/telemetry/spTelemetry';
import { BILLING_SUMMARY_CANDIDATES } from '@/sharepoint/fields/billingFields';

import { toSharePointFields, upsertMonthlySummary } from './map';
import type { MonthlySummary } from './types';

vi.mock('@/lib/telemetry/spTelemetry', () => ({
  trackSpEvent: vi.fn(),
}));

const baseSummary: MonthlySummary = {
  userId: 'I001',
  yearMonth: '2026-04',
  displayName: '利用者A',
  lastUpdatedUtc: '2026-04-29T00:00:00.000Z',
  kpi: {
    totalDays: 20,
    plannedRows: 380,
    completedRows: 300,
    inProgressRows: 50,
    emptyRows: 30,
    specialNotes: 4,
    incidents: 1,
  },
  completionRate: 78.9,
  firstEntryDate: '2026-04-01',
  lastEntryDate: '2026-04-29',
};

const monthlyFields = new Set([
  'UserCode',
  'YearMonth',
  'DisplayName',
  'LastAggregatedAt',
  'TotalDays',
  'PlannedRows',
  'CompletedCount',
  'PendingCount',
  'EmptyCount',
  'SpecialNoteCount',
  'IncidentCount',
  'CompletionRate',
  'FirstEntryDate',
  'LastEntryDate',
  'Idempotency_x0020_Key',
  'Key',
]);

describe('monthly record SharePoint mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps legacy Key as an intentional idempotency fallback candidate', () => {
    expect(BILLING_SUMMARY_CANDIDATES.idempotencyKey).toEqual([
      'Idempotency_x0020_Key',
      'IdempotencyKey',
      'Key',
      'cr013_idempotencyKey',
    ]);
  });

  it('writes idempotency data to the canonical field when that field exists', () => {
    const fields = toSharePointFields(baseSummary, {
      idempotencyKey: 'Idempotency_x0020_Key',
    });

    expect(fields.Idempotency_x0020_Key).toBe('I001#2026-04');
    expect(fields.Key).toBeUndefined();
  });

  it('does not emit fallback telemetry when canonical Idempotency_x0020_Key matches', async () => {
    const findByIdempotencyKey = vi.fn().mockResolvedValueOnce({
      Id: 42,
      Idempotency_x0020_Key: 'I001#2026-04',
      LastAggregatedAt: '2026-04-28T00:00:00.000Z',
    });
    const update = vi.fn().mockResolvedValue({ Id: 42 });
    const create = vi.fn();

    const client = {
      getListFieldInternalNames: vi.fn().mockResolvedValue(monthlyFields),
      findByIdempotencyKey,
      create,
      update,
    };

    const result = await upsertMonthlySummary(client, baseSummary);

    expect(result).toEqual({ action: 'updated', itemId: 42 });
    expect(findByIdempotencyKey).toHaveBeenCalledTimes(1);
    expect(findByIdempotencyKey).toHaveBeenCalledWith(
      'MonthlyRecord_Summary',
      'Idempotency_x0020_Key',
      'I001#2026-04'
    );
    expect(trackSpEvent).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('uses legacy Key lookup to update an existing monthly summary instead of creating a duplicate', async () => {
    const findByIdempotencyKey = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        Id: 42,
        Key: 'I001#2026-04',
        LastAggregatedAt: '2026-04-28T00:00:00.000Z',
      });
    const update = vi.fn().mockResolvedValue({ Id: 42 });
    const create = vi.fn();

    const client = {
      getListFieldInternalNames: vi.fn().mockResolvedValue(monthlyFields),
      findByIdempotencyKey,
      create,
      update,
    };

    const result = await upsertMonthlySummary(client, baseSummary);

    expect(result).toEqual({ action: 'updated', itemId: 42 });
    expect(findByIdempotencyKey).toHaveBeenNthCalledWith(
      1,
      'MonthlyRecord_Summary',
      'Idempotency_x0020_Key',
      'I001#2026-04'
    );
    expect(findByIdempotencyKey).toHaveBeenNthCalledWith(
      2,
      'MonthlyRecord_Summary',
      'IdempotencyKey',
      'I001#2026-04'
    );
    expect(findByIdempotencyKey).toHaveBeenNthCalledWith(
      3,
      'MonthlyRecord_Summary',
      'Key',
      'I001#2026-04'
    );
    expect(trackSpEvent).toHaveBeenCalledWith('sp:idempotency_fallback_used', {
      listName: 'MonthlyRecord_Summary',
      key: 'I001#2026-04',
      details: {
        canonicalField: 'Idempotency_x0020_Key',
        fallbackField: 'Key',
      },
    });
    expect(update).toHaveBeenCalledWith('MonthlyRecord_Summary', 42, expect.objectContaining({
      Idempotency_x0020_Key: 'I001#2026-04',
    }));
    expect(create).not.toHaveBeenCalled();
  });
});
