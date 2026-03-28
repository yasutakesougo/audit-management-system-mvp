/**
 * useUsersPanelCrud — 削除確認フロー (UI契約は delete、実処理は terminate)
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockTerminate = vi.fn().mockResolvedValue(undefined);
const mockRefresh = vi.fn().mockResolvedValue(undefined);
const mockCreate = vi.fn().mockResolvedValue({ Id: 99 });

vi.mock('@/features/users/store', () => ({
  useUsersStore: () => ({
    data: [
      { Id: 1, UserID: 'U-001', FullName: '田中 太郎' },
      { Id: 2, UserID: 'U-002', FullName: '鈴木 美子' },
    ],
    status: 'success',
    error: null,
    create: mockCreate,
    terminate: mockTerminate,
    remove: vi.fn(),
    refresh: mockRefresh,
  }),
}));

vi.mock('@/features/users/repositoryFactory', () => ({
  getCurrentUserRepositoryKind: () => 'live',
}));

vi.mock('@/features/users/useUsersDemoSeed', () => ({
  useUsersDemoSeed: vi.fn(),
}));

import { useUsersPanelCrud } from '@/features/users/UsersPanel/hooks/useUsersPanelCrud';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
function renderCrudHook() {
  const setActiveTabRef = { current: vi.fn() };
  return renderHook(() => useUsersPanelCrud(setActiveTabRef));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('useUsersPanelCrud — delete confirmation flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deleteTarget is null initially', () => {
    const { result } = renderCrudHook();
    expect(result.current.deleteTarget).toBeNull();
  });

  it('requestDelete sets deleteTarget with id and userName', () => {
    const { result } = renderCrudHook();

    act(() => {
      result.current.requestDelete(1, '田中 太郎');
    });

    expect(result.current.deleteTarget).toEqual({
      id: 1,
      userName: '田中 太郎',
    });
  });

  it('cancelDelete clears deleteTarget without calling terminate', () => {
    const { result } = renderCrudHook();

    act(() => {
      result.current.requestDelete(1, '田中 太郎');
    });
    expect(result.current.deleteTarget).not.toBeNull();

    act(() => {
      result.current.cancelDelete();
    });

    expect(result.current.deleteTarget).toBeNull();
    expect(mockTerminate).not.toHaveBeenCalled();
  });

  it('confirmDelete calls terminate with the target id and clears state', async () => {
    const { result } = renderCrudHook();

    act(() => {
      result.current.requestDelete(2, '鈴木 美子');
    });
    expect(result.current.deleteTarget).toEqual({ id: 2, userName: '鈴木 美子' });

    await act(async () => {
      await result.current.confirmDelete();
    });

    expect(mockTerminate).toHaveBeenCalledWith(2);
    expect(result.current.deleteTarget).toBeNull();
    expect(result.current.busyId).toBeNull();
  });

  it('confirmDelete is a no-op when deleteTarget is null', async () => {
    const { result } = renderCrudHook();

    await act(async () => {
      await result.current.confirmDelete();
    });

    expect(mockTerminate).not.toHaveBeenCalled();
  });

  it('requestDelete overwrites previous target', () => {
    const { result } = renderCrudHook();

    act(() => {
      result.current.requestDelete(1, '田中 太郎');
    });

    act(() => {
      result.current.requestDelete(2, '鈴木 美子');
    });

    expect(result.current.deleteTarget).toEqual({ id: 2, userName: '鈴木 美子' });
  });

  it('busyId is set during confirmDelete and cleared afterwards', async () => {
    let resolveTerminate: () => void;
    mockTerminate.mockImplementationOnce(
      () => new Promise<void>((resolve) => { resolveTerminate = resolve; }),
    );

    const { result } = renderCrudHook();

    act(() => {
      result.current.requestDelete(1, '田中 太郎');
    });

    let confirmPromise: Promise<void>;
    act(() => {
      confirmPromise = result.current.confirmDelete();
    });

    expect(result.current.busyId).toBe(1);

    await act(async () => {
      resolveTerminate!();
      await confirmPromise!;
    });

    expect(result.current.busyId).toBeNull();
  });
});
