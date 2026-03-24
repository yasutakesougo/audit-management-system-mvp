import { describe, expect, it } from 'vitest';
import { sortRingsByPriority } from '../sortRingsByPriority';
import type { ProgressRingItem } from '../../components/ProgressRings';

// ─── Helper ──────────────────────────────────────────────────

function ring(key: ProgressRingItem['key'], status: ProgressRingItem['status']): ProgressRingItem {
  return { key, label: key, valueText: '', status };
}

// ─── Tests ───────────────────────────────────────────────────

describe('sortRingsByPriority', () => {
  it('moves attention items to front', () => {
    const input = [
      ring('records', 'complete'),
      ring('caseRecords', 'attention'),
      ring('attendance', 'in_progress'),
      ring('contacts', 'complete'),
    ];
    const result = sortRingsByPriority(input);
    expect(result.map(r => r.key)).toEqual([
      'caseRecords',  // attention → first
      'attendance',   // in_progress → second
      'records',      // complete → third
      'contacts',     // complete → fourth
    ]);
  });

  it('preserves order within same status', () => {
    const input = [
      ring('records', 'in_progress'),
      ring('caseRecords', 'in_progress'),
      ring('attendance', 'in_progress'),
      ring('contacts', 'in_progress'),
    ];
    const result = sortRingsByPriority(input);
    expect(result.map(r => r.key)).toEqual([
      'records', 'caseRecords', 'attendance', 'contacts',
    ]);
  });

  it('keeps order when all complete', () => {
    const input = [
      ring('records', 'complete'),
      ring('caseRecords', 'complete'),
      ring('attendance', 'complete'),
      ring('contacts', 'complete'),
    ];
    const result = sortRingsByPriority(input);
    expect(result.map(r => r.key)).toEqual([
      'records', 'caseRecords', 'attendance', 'contacts',
    ]);
  });

  it('handles multiple attention items', () => {
    const input = [
      ring('records', 'attention'),
      ring('caseRecords', 'complete'),
      ring('attendance', 'attention'),
      ring('contacts', 'in_progress'),
    ];
    const result = sortRingsByPriority(input);
    expect(result.map(r => r.key)).toEqual([
      'records',     // attention (first in original)
      'attendance',  // attention (third in original)
      'contacts',    // in_progress
      'caseRecords', // complete
    ]);
  });

  it('does not mutate the original array', () => {
    const input = [
      ring('records', 'complete'),
      ring('caseRecords', 'attention'),
    ];
    const original = [...input];
    sortRingsByPriority(input);
    expect(input).toEqual(original);
  });

  it('handles empty array', () => {
    expect(sortRingsByPriority([])).toEqual([]);
  });

  it('handles single item', () => {
    const input = [ring('records', 'attention')];
    const result = sortRingsByPriority(input);
    expect(result).toEqual(input);
  });
});
