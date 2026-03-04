/**
 * DailyRecordBulkActions — Bulk operation buttons
 *
 * Extracted from DailyRecordPage.tsx for single-responsibility.
 */

import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

// ─── Props ──────────────────────────────────────────────────────────────────

interface DailyRecordBulkActionsProps {
  onGenerateTodayRecords: () => void;
  onBulkCreateMissing: () => void;
  onBulkComplete: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function DailyRecordBulkActions({
  onGenerateTodayRecords,
  onBulkCreateMissing,
  onBulkComplete,
}: DailyRecordBulkActionsProps) {
  return (
    <Card sx={{ mb: 2 }} data-testid="bulk-operations-card">
      <CardContent>
        <Typography variant="h6" gutterBottom>
          一括操作
        </Typography>
        <Stack direction="row" spacing={2} flexWrap="wrap">
          <Button
            variant="contained"
            onClick={onGenerateTodayRecords}
            color="primary"
            data-testid="bulk-generate-today-records-button"
          >
            本日分全員作成（32名）
          </Button>
          <Button
            variant="outlined"
            onClick={onBulkCreateMissing}
            color="secondary"
            data-testid="bulk-create-missing-button"
          >
            未作成分追加
          </Button>
          <Button
            variant="outlined"
            onClick={onBulkComplete}
            color="success"
            data-testid="bulk-complete-button"
          >
            本日分一括完了
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
