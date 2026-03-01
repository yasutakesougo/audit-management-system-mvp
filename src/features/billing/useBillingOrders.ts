import { useQuery } from '@tanstack/react-query';
import type { BillingOrderRepository } from './repository';

export const billingOrdersQueryKey = ['billingOrders', 'list'] as const;

export function useBillingOrders(repo: BillingOrderRepository) {
  return useQuery({
    queryKey: billingOrdersQueryKey,
    queryFn: () => repo.list(),
    staleTime: 60_000,
  });
}
