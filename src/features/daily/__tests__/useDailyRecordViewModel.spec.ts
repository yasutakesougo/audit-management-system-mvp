import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDailyRecordViewModel } from '../useDailyRecordViewModel';

type PersonDaily = {
  id: number;
  personName: string;
  personId: string;
  status: string;
  date: string;
  draft: { isDraft: boolean };
};

function createDeps(
  overrides?: Partial<Parameters<typeof useDailyRecordViewModel<PersonDaily>>[0]>,
) {
  const records: PersonDaily[] = [
    { id: 1, personName: '山田 太郎', personId: 'U001', status: 'open', date: '2026-02-07', draft: { isDraft: false } },
    { id: 2, personName: '佐藤 花子', personId: 'U002', status: 'done', date: '2026-02-06', draft: { isDraft: false } },
    { id: 3, personName: '鈴木 次郎', personId: 'U003', status: 'open', date: '2026-02-06', draft: { isDraft: true } },
  ];

  const deps: Parameters<typeof useDailyRecordViewModel<PersonDaily>>[0] = {
    locationState: {},
    searchParams: new URLSearchParams(),
    records,
    setRecords: vi.fn(),
    editingRecord: undefined,
    setEditingRecord: vi.fn(),
    setFormOpen: vi.fn(),
    navigate: vi.fn(),
    validateDailyRecord: vi.fn(() => ({ isValid: true, errors: [] })),
    saveDailyRecord: vi.fn((rs) => rs),
    generateTodayRecords: vi.fn(() => records),
    mockUsers: ['山田 太郎', '佐藤 花子', '鈴木 次郎'],
    createMissingRecord: vi.fn((name, userId, date, index) => ({
      id: Date.now() + index,
      personId: userId,
      personName: name,
      date,
      status: '未作成',
      draft: { isDraft: true },
    })),
    ...(overrides ?? {}),
  };

  return deps;
}

describe('useDailyRecordViewModel', () => {
  it('prefers highlight from nav state over query params', () => {
    const deps = createDeps({
      locationState: { highlightUserId: 'NAV_USER', highlightDate: '2026-02-07' },
      searchParams: new URLSearchParams({ userId: 'QUERY_USER', date: '2026-02-06' }),
    });

    const { result } = renderHook(() => useDailyRecordViewModel(deps));
    expect(result.current.highlightUserId).toBe('NAV_USER');
    expect(result.current.highlightDate).toBe('2026-02-07');
  });

  it('filters records by search/status/date', () => {
    const deps = createDeps();
    const { result } = renderHook(() => useDailyRecordViewModel(deps));

    act(() => {
      result.current.setSearchQuery('U002');
      result.current.setStatusFilter('done');
      result.current.setDateFilter('2026-02-06');
    });

    const list = result.current.filteredRecords as PersonDaily[];
    expect(list).toHaveLength(1);
    expect(list[0].personId).toBe('U002');
  });
});
