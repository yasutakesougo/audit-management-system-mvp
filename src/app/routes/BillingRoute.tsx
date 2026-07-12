import {
  BillingPage,
  useBillingRuntime,
} from '@/features/billing';

export default function BillingRoute() {
  const repository = useBillingRuntime();

  return <BillingPage repository={repository} />;
}
