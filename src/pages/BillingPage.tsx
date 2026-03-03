import { PageHeader } from '@/components/PageHeader';
import Box from '@mui/material/Box';

export default function BillingPage() {
  return (
    <Box sx={{ p: 3 }} data-testid="billing-root">
      <PageHeader title="請求処理" subtitle="Coming soon" />
    </Box>
  );
}
