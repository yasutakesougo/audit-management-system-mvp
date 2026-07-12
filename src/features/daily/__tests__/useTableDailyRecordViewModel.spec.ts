import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DailyRecordRepository } from '../domain/DailyRecordRepository';
import { useTableDailyRecordViewModel } from '../components/table/useTableDailyRecordViewModel';

const navigateToToday = vi.fn();

vi.mock('@/lib/nav/useCancelToDashboard', () => ({
  useCancelToToday: () => navigateToToday,
}));

describe('useTableDailyRecordViewModel', () => {
  beforeEach(() => {
    navigateToToday.mockClear();
  });

  it('exposes the injected repository without constructing an adapter', () => {
    const repository = createRepository();
    const { result } = renderHook(() => useTableDailyRecordViewModel(repository));

    expect(result.current.open).toBe(true);
    expect(result.current.title).toBe('一覧形式の日々の記録');
    expect(result.current.backTo).toBe('/today');
    expect(result.current.testId).toBe('daily-table-record-page');
    expect(result.current.repository).toBe(repository);
  });

  it.each(['onClose', 'onSuccess'] as const)('%s closes the page and returns to today', callback => {
    const { result } = renderHook(() => useTableDailyRecordViewModel(createRepository()));

    act(() => result.current[callback]());

    expect(result.current.open).toBe(false);
    expect(navigateToToday).toHaveBeenCalledOnce();
  });
});

function createRepository(): DailyRecordRepository {
  return {
    save: vi.fn(async () => undefined),
    load: vi.fn(async () => null),
    list: vi.fn(async () => []),
    approve: vi.fn(async () => {
      throw new Error('not used');
    }),
    scanIntegrity: vi.fn(async () => []),
  };
}
