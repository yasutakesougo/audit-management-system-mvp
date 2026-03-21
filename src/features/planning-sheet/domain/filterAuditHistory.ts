import type { ImportAuditRecord } from '@/features/planning-sheet/stores/importAuditStore';

export type AuditHistoryFilter = 'all' | 'monitoring' | 'assessment';

export function filterAuditHistoryRecords(
  records: ImportAuditRecord[],
  filter: AuditHistoryFilter,
): ImportAuditRecord[] {
  if (filter === 'all') return records;
  if (filter === 'monitoring') {
    return records.filter((record) => record.mode === 'behavior-monitoring');
  }
  return records.filter((record) => record.mode !== 'behavior-monitoring');
}

