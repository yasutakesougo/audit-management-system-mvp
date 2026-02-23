import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export default function BillingPage() {
  return (
    <Box sx={{ p: 3 }} data-testid="billing-root">
      <Typography variant="h4" component="h1" gutterBottom>
        請求処理
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Coming soon
      </Typography>
    </Box>
  );
}
