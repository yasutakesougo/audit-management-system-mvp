import { describe, expect, it } from 'vitest';

import { filterAuditHistoryRecords } from '@/features/planning-sheet/domain/filterAuditHistory';
import type { ImportAuditRecord } from '@/features/planning-sheet/stores/importAuditStore';

function makeRecord(id: string, mode: ImportAuditRecord['mode']): ImportAuditRecord {
  return {
    id,
    planningSheetId: 'sheet-1',
    importedAt: '2026-03-21T00:00:00.000Z',
    importedBy: 'test-user',
    assessmentId: mode === 'behavior-monitoring' ? null : 'assessment-1',
    tokuseiResponseId: null,
    mode,
    affectedFields: [],
    provenance: [],
    summaryText: '',
  };
}

describe('filterAuditHistoryRecords', () => {
  const records: ImportAuditRecord[] = [
    makeRecord('1', 'behavior-monitoring'),
    makeRecord('2', 'assessment-only'),
    makeRecord('3', 'with-tokusei'),
  ];

  it('returns all records for all filter', () => {
    expect(filterAuditHistoryRecords(records, 'all')).toEqual(records);
  });

  it('returns only behavior monitoring records for monitoring filter', () => {
    expect(filterAuditHistoryRecords(records, 'monitoring').map((record) => record.id)).toEqual(['1']);
  });

  it('returns non-monitoring records for assessment filter', () => {
    expect(filterAuditHistoryRecords(records, 'assessment').map((record) => record.id)).toEqual(['2', '3']);
  });
});

