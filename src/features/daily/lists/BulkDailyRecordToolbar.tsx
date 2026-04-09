/**
 * BulkDailyRecordToolbar — Header, bulk-save button, keyboard hints, status legend
 *
 * Extracted from BulkDailyRecordList.tsx for single-responsibility.
 */

import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import PendingRoundedIcon from '@mui/icons-material/PendingRounded';
import SyncRoundedIcon from '@mui/icons-material/SyncRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

// ─── Props ──────────────────────────────────────────────────────────────────

interface BulkDailyRecordToolbarProps {
  selectedDate?: string;
  isSubmitting: boolean;
  onBulkSave: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function BulkDailyRecordToolbar({
  selectedDate,
  isSubmitting,
  onBulkSave,
}: BulkDailyRecordToolbarProps) {
  return (
    <>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 2, gap: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            日々の記録一覧入力
          </Typography>
          {selectedDate && (
            <Chip label={selectedDate} variant="outlined" size="small" />
          )}
        </Stack>
        <Tooltip title="Alt+S でも保存できます">
          <span>
            <Button
              startIcon={<SyncRoundedIcon />}
              onClick={onBulkSave}
              disabled={isSubmitting}
              variant="contained"
              data-testid="daily-bulk-save"
            >
              {isSubmitting ? '保存中...' : '一括保存'}
            </Button>
          </span>
        </Tooltip>
      </Stack>

      {/* Keyboard hints & status legend */}
      <Box sx={{ px: 2, pb: 1 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography variant="caption" color="text.secondary">
              キーボード操作:
            </Typography>
            <Chip size="small" label="Enter=保存して次へ" variant="outlined" />
            <Chip size="small" label="Ctrl+S=保存" variant="outlined" />
            <Chip size="small" label="Alt+S=一括保存" variant="outlined" />
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography variant="caption" color="text.secondary">
              状態:
            </Typography>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <span aria-hidden="true">—</span>
              <Typography variant="caption" color="text.secondary">未保存</Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <CheckCircleRoundedIcon color="success" sx={{ fontSize: 16 }} />
              <Typography variant="caption" color="text.secondary">保存済み</Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <PendingRoundedIcon color="warning" sx={{ fontSize: 16 }} />
              <Typography variant="caption" color="text.secondary">保存中</Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <ErrorRoundedIcon color="error" sx={{ fontSize: 16 }} />
              <Typography variant="caption" color="text.secondary">エラー</Typography>
            </Stack>
          </Stack>
        </Stack>
      </Box>
    </>
  );
}
