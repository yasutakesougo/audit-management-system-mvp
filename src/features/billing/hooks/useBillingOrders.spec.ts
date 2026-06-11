import { describe, expect, it, vi } from 'vitest';
import { billingOrdersQueryKey, useBillingOrders } from '../useBillingOrders';

const { mockUseQuery } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: mockUseQuery,
}));

describe('useBillingOrders', () => {
  it('uses billingOrdersQueryKey and staleTime 60_000', () => {
    const repo = {
      list: vi.fn().mockResolvedValue([]),
      isPersistenceColumnsResolved: vi.fn(),
      updatePaymentStatus: vi.fn(),
      bulkUpdatePaymentStatus: vi.fn(),
    };

    mockUseQuery.mockReturnValue({ data: [], isLoading: false });

    useBillingOrders(repo);

    expect(mockUseQuery).toHaveBeenCalledTimes(1);
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: billingOrdersQueryKey,
        staleTime: 60_000,
        queryFn: expect.any(Function),
      }),
    );
  });

  it('queryFn delegates to repo.list', async () => {
    const rows = [{ id: 1 }, { id: 2 }] as const;
    const repo = {
      list: vi.fn().mockResolvedValue(rows),
      isPersistenceColumnsResolved: vi.fn(),
      updatePaymentStatus: vi.fn(),
      bulkUpdatePaymentStatus: vi.fn(),
    };

    let capturedQueryFn: (() => Promise<typeof rows>) | null = null;
    mockUseQuery.mockImplementation((options: { queryFn: () => Promise<typeof rows> }) => {
      capturedQueryFn = options.queryFn;
      return { data: [], isLoading: false };
    });

    useBillingOrders(repo);

    expect(capturedQueryFn).not.toBeNull();
    await expect(capturedQueryFn!()).resolves.toEqual(rows);
    expect(repo.list).toHaveBeenCalledTimes(1);
  });
});
