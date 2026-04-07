import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { usePersistentDrift } from '../usePersistentDrift';
import { useSP } from '@/lib/spClient';
import { SharePointDriftEventRepository } from '../../infra/SharePointDriftEventRepository';

vi.mock('@/lib/spClient', () => ({
  useSP: vi.fn(),
}));

vi.mock('../../infra/SharePointDriftEventRepository', () => ({
  SharePointDriftEventRepository: vi.fn().mockImplementation(function() {
    return {
      getEvents: vi.fn(),
    };
  }),
}));

describe('usePersistentDrift', () => {
  const mockSp = {
    createItem: vi.fn(),
    updateItemByTitle: vi.fn(),
    getListItemsByTitle: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useSP as any).mockReturnValue(mockSp);
  });

  it('extracts drifts older than threshold days', async () => {
    const now = new Date().getTime();
    const fiveDaysAgo = new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString();

    const mockEvents = [
      {
        id: '1',
        listName: 'Users_Master',
        fieldName: 'UserCode',
        detectedAt: fiveDaysAgo,
        severity: 'warn',
        resolutionType: 'fallback',
        driftType: 'case_mismatch',
        resolved: false,
      },
      {
        id: '2',
        listName: 'Daily_Records',
        fieldName: 'Status',
        detectedAt: oneDayAgo,
        severity: 'warn',
        resolutionType: 'fallback',
        driftType: 'suffix_mismatch',
        resolved: false,
      },
    ];

    (SharePointDriftEventRepository as any).mockImplementation(function() {
      return {
        getEvents: vi.fn().mockResolvedValue(mockEvents),
      };
    });

    const { result } = renderHook(() => usePersistentDrift(3));

    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 3000 });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].id).toBe('1');
    expect(result.current.items[0].agingDays).toBe(5);
  });

  it('sorts drifts by aging days descending', async () => {
    const now = new Date().getTime();
    const fiveDaysAgo = new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString();
    const nineDaysAgo = new Date(now - 9 * 24 * 60 * 60 * 1000).toISOString();

    const mockEvents = [
      {
        id: '1',
        listName: 'List_A',
        fieldName: 'Field_A',
        detectedAt: fiveDaysAgo,
        resolved: false,
      },
      {
        id: '2',
        listName: 'List_B',
        fieldName: 'Field_B',
        detectedAt: nineDaysAgo,
        resolved: false,
      },
    ];

    (SharePointDriftEventRepository as any).mockImplementation(function() {
      return {
        getEvents: vi.fn().mockResolvedValue(mockEvents),
      };
    });

    const { result } = renderHook(() => usePersistentDrift(3));

    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 3000 });

    expect(result.current.items[0].id).toBe('2'); // 9 days ago
    expect(result.current.items[1].id).toBe('1'); // 5 days ago
  });

  it('handles empty results', async () => {
    (SharePointDriftEventRepository as any).mockImplementation(function() {
      return {
        getEvents: vi.fn().mockResolvedValue([]),
      };
    });

    const { result } = renderHook(() => usePersistentDrift(3));

    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 3000 });

    expect(result.current.items).toHaveLength(0);
  });
});
