import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUsers } from '@/features/users/useUsers';
import { useHandoffExceptions } from '../useHandoffExceptions';

vi.mock('@/features/users/useUsers', () => ({
  useUsers: vi.fn(),
}));

describe('useHandoffExceptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUsers).mockReturnValue({
      data: [],
      status: 'success',
      error: null,
      refresh: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    } as never);
  });

  it('handoff summary を parent + child に変換する', () => {
    vi.mocked(useUsers).mockReturnValue({
      data: [{ UserID: 'U-001', FullName: '田中 太郎' }],
      status: 'success',
      error: null,
      refresh: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    } as never);

    const { result } = renderHook(() => useHandoffExceptions({
      handoffs: [
        {
          id: '1',
          message: 'A',
          severity: '重要',
          status: '未対応',
          userId: 'U-001',
          userName: 'dummy',
          createdAt: '2026-03-25T09:00:00Z',
        },
        {
          id: '2',
          message: 'B',
          severity: '重要',
          status: '対応中',
          userId: 'U-001',
          userName: 'dummy',
          createdAt: '2026-03-25T10:00:00Z',
        },
      ],
    }));

    expect(result.current.items).toHaveLength(3);
    expect(result.current.count).toBe(2);
    expect(result.current.items[0]?.title).toContain('田中 太郎');
    expect(result.current.items[1]?.parentId).toBe('handoff-user-U-001');
  });

  it('完了済みのみの場合は空になる', () => {
    const { result } = renderHook(() => useHandoffExceptions({
      handoffs: [
        {
          id: '1',
          message: 'A',
          severity: '重要',
          status: '完了',
          userId: 'U-001',
          userName: 'dummy',
          createdAt: '2026-03-25T09:00:00Z',
        },
      ],
    }));

    expect(result.current.items).toEqual([]);
    expect(result.current.count).toBe(0);
  });
});
