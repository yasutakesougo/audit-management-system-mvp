import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useToiletRecords } from '../useToiletRecords';

const mockListByDate = vi.fn();
const mockCreate = vi.fn();

let currentSpFetch = vi.fn();
let currentGetListFieldInternalNames = vi.fn();

vi.mock('@/lib/spClient', () => ({
  useSP: () => ({
    spFetch: (...args: unknown[]) => currentSpFetch(...args),
    getListFieldInternalNames: (...args: unknown[]) => currentGetListFieldInternalNames(...args),
  }),
}));

vi.mock('../toiletRepositoryFactory', () => ({
  getToiletRepository: (spFetch: any, getListFieldInternalNames: any) => ({
    listByDate: (dateIso: string) => mockListByDate(dateIso, spFetch, getListFieldInternalNames),
    create: (input: any) => mockCreate(input),
  }),
}));

describe('useToiletRecords', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSpFetch = vi.fn().mockResolvedValue({ ok: true });
    currentGetListFieldInternalNames = vi.fn().mockResolvedValue(new Set());
    mockListByDate.mockReset();
    mockCreate.mockReset();
  });

  it('does not trigger re-fetch loop even if useSP returns new function instances on every render', async () => {
    mockListByDate.mockResolvedValue([]);

    const { result, rerender } = renderHook(() => useToiletRecords('2026-05-28'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockListByDate).toHaveBeenCalledTimes(1);

    // Rerender multiple times to simulate function reference changes on every render
    rerender();
    rerender();

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockListByDate).toHaveBeenCalledTimes(1);
  });

  it('correctly routes spFetch calls to the latest spFetchRef.current reference after change', async () => {
    const firstSpFetchMock = vi.fn().mockResolvedValue({ ok: true });
    const secondSpFetchMock = vi.fn().mockResolvedValue({ ok: true });

    currentSpFetch = firstSpFetchMock;
    mockListByDate.mockImplementation(async (dateIso, spFetch) => {
      await spFetch('test-path');
      return [];
    });

    const { result, rerender } = renderHook(() => useToiletRecords('2026-05-28'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(firstSpFetchMock).toHaveBeenCalledWith('test-path', undefined);
    firstSpFetchMock.mockClear();

    // Update the spFetch implementation
    currentSpFetch = secondSpFetchMock;
    rerender();

    // Trigger refresh manually
    await act(async () => {
      await result.current.refresh();
    });

    expect(secondSpFetchMock).toHaveBeenCalledWith('test-path', undefined);
    expect(firstSpFetchMock).not.toHaveBeenCalled();
  });

  it('keeps refresh and create references completely stable across renders', async () => {
    mockListByDate.mockResolvedValue([]);

    const { result, rerender } = renderHook(() => useToiletRecords('2026-05-28'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const initialRefresh = result.current.refresh;
    const initialCreate = result.current.create;

    // Change spFetch instance and trigger rerender
    currentSpFetch = vi.fn().mockResolvedValue({ ok: true });
    rerender();

    expect(result.current.refresh).toBe(initialRefresh);
    expect(result.current.create).toBe(initialCreate);
  });

  it('sets error and sets isLoading to false when listByDate rejects, without infinite looping', async () => {
    const dbError = new Error('SharePoint timeout');
    mockListByDate.mockRejectedValue(dbError);

    const { result } = renderHook(() => useToiletRecords('2026-05-28'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe(dbError);
    expect(mockListByDate).toHaveBeenCalledTimes(1);

    mockListByDate.mockClear();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockListByDate).not.toHaveBeenCalled();
  });

  it('discards stale fetch results if date parameter changes mid-flight', async () => {
    let resolveFirstFetch: (value: any[]) => void = () => {};
    const firstFetchPromise = new Promise<any[]>((resolve) => {
      resolveFirstFetch = resolve;
    });

    mockListByDate.mockImplementation(async (dateIso) => {
      if (dateIso === '2026-05-28') {
        return firstFetchPromise;
      }
      return [{ id: 'record-2' }];
    });

    const { result, rerender } = renderHook(
      ({ date }) => useToiletRecords(date),
      {
        initialProps: { date: '2026-05-28' },
      },
    );

    // Props change mid-flight
    rerender({ date: '2026-05-29' });

    await waitFor(() => {
      expect(result.current.records).toEqual([{ id: 'record-2' }]);
    });

    // Resolve the first fetch
    resolveFirstFetch([{ id: 'record-1' }]);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current.records).toEqual([{ id: 'record-2' }]);
  });
});
