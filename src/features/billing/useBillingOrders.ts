import { useQuery } from '@tanstack/react-query';
import type { BillingOrderRepository } from './ports/billingOrderRepository';

export const billingOrdersQueryKey = ['billingOrders', 'list'] as const;

export function useBillingOrders(repo: BillingOrderRepository) {
  return useQuery({
    queryKey: billingOrdersQueryKey,
    queryFn: () => repo.list(),
    staleTime: 60_000,
  });
}
