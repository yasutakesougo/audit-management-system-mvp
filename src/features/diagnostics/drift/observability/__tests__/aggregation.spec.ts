import { describe, expect, it } from 'vitest';
import {
  aggregateTopDriftFields,
  aggregateTopDriftLists,
  aggregateUnresolvedCount,
} from '../aggregation';

describe('drift observability aggregation', () => {
  it('aggregates top drift fields by count', () => {
    const events = [
      { fieldName: 'Status', listName: 'Daily_Attendance', resolved: false },
      { fieldName: 'Status', listName: 'Daily_Attendance', resolved: false },
      { fieldName: 'UserID', listName: 'Users_Master', resolved: false },
    ];

    expect(aggregateTopDriftFields(events)).toEqual([
      { key: 'Status', count: 2 },
      { key: 'UserID', count: 1 },
    ]);
  });

  it('aggregates top drift lists by count', () => {
    const events = [
      { fieldName: 'Status', listName: 'Daily_Attendance', resolved: false },
      { fieldName: 'UserID', listName: 'Users_Master', resolved: false },
      { fieldName: 'Date', listName: 'Daily_Attendance', resolved: true },
    ];

    expect(aggregateTopDriftLists(events)).toEqual([
      { key: 'Daily_Attendance', count: 2 },
      { key: 'Users_Master', count: 1 },
    ]);
  });

  it('counts unresolved from false or missing states', () => {
    const events = [
      { fieldName: 'Status', listName: 'Daily_Attendance', resolved: false },
      { fieldName: 'UserID', listName: 'Users_Master', resolved: true },
      { fieldName: 'Date', listName: 'Daily_Attendance' },
      { fieldName: 'Shift', resolved: true },
    ];

    expect(aggregateUnresolvedCount(events)).toBe(3);
  });

  it('returns zero and empty top lists for empty input', () => {
    expect(aggregateTopDriftFields([])).toEqual([]);
    expect(aggregateTopDriftLists([])).toEqual([]);
    expect(aggregateUnresolvedCount([])).toBe(0);
  });

  it('ignores invalid payload entries safely', () => {
    const events = [
      null,
      undefined,
      123,
      'bad',
      { foo: 'bar' },
      { fieldName: 'Status', listName: 'Daily_Attendance', resolved: 'false' },
    ];

    expect(aggregateTopDriftFields(events)).toEqual([{ key: 'Status', count: 1 }]);
    expect(aggregateTopDriftLists(events)).toEqual([{ key: 'Daily_Attendance', count: 1 }]);
    expect(aggregateUnresolvedCount(events)).toBe(1);
  });
});
