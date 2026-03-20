/**
 * AbcSlotDialog — スロット別 ABC 記録一覧ダイアログ
 *
 * Step 2 の ABC バッジ押下時に、そのスロットに紐づくABC記録を一覧表示。
 * 各記録をクリックすると ABC 記録詳細ページへ遷移する。
 */
import React, { memo } from 'react';
import { useNavigate } from 'react-router-dom';

// ── MUI ──
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

// ── Icons ──
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';

// ── Domain ──
import type { AbcRecord } from '@/domain/abc/abcRecord';
import { ABC_INTENSITY_DISPLAY } from '@/domain/abc/abcRecord';

// ── Helpers ──
function intensityColor(intensity: string): 'success' | 'warning' | 'error' {
  if (intensity === 'low') return 'success';
  if (intensity === 'high') return 'error';
  return 'warning';
}

interface AbcSlotDialogProps {
  open: boolean;
  onClose: () => void;
  /** 表示するスロットのラベル (e.g. "09:00 朝の受け入れ") */
  slotLabel: string;
  /** フィルタ済みの ABC レコード一覧 */
  records: AbcRecord[];
  /** 利用者 ID（ABC 詳細遷移用） */
  userId?: string;
}

export const AbcSlotDialog: React.FC<AbcSlotDialogProps> = memo(({
  open,
  onClose,
  slotLabel,
  records,
}) => {
  const navigate = useNavigate();

  const handleRecordClick = (record: AbcRecord) => {
    onClose();
    navigate(`/abc-record?userId=${record.userId}&recordId=${record.id}`);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <EditNoteRoundedIcon color="info" />
          <Box>
            <Typography variant="h6" fontWeight={700}>
              ABC 記録一覧
            </Typography>
            <Typography variant="caption" color="text.secondary">
              📍 {slotLabel}
            </Typography>
          </Box>
          <Chip
            label={`${records.length}件`}
            size="small"
            color="info"
            variant="filled"
            sx={{ ml: 'auto', fontWeight: 'bold' }}
          />
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        {records.length === 0 ? (
          <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            該当するABC記録はありません
          </Typography>
        ) : (
          <Stack spacing={1.5}>
            {records.map(record => (
              <Card
                key={record.id}
                variant="outlined"
                sx={{
                  cursor: 'pointer',
                  '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                  transition: 'all 0.2s',
                }}
                onClick={() => handleRecordClick(record)}
              >
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Stack spacing={0.75}>
                    {/* Header row */}
                    <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip
                          label={ABC_INTENSITY_DISPLAY[record.intensity]}
                          size="small"
                          color={intensityColor(record.intensity)}
                          variant="outlined"
                        />
                        {record.riskFlag && (
                          <Chip
                            icon={<WarningAmberRoundedIcon />}
                            label="危険"
                            size="small"
                            color="error"
                            variant="filled"
                          />
                        )}
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(record.occurredAt).toLocaleString('ja-JP', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Typography>
                    </Stack>

                    {/* ABC Summary */}
                    <Stack spacing={0.25}>
                      <Typography variant="body2">
                        <strong>A:</strong> {record.antecedent.length > 50
                          ? record.antecedent.slice(0, 50) + '…'
                          : record.antecedent}
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>
                        <strong>B:</strong> {record.behavior.length > 50
                          ? record.behavior.slice(0, 50) + '…'
                          : record.behavior}
                      </Typography>
                      <Typography variant="body2">
                        <strong>C:</strong> {record.consequence.length > 50
                          ? record.consequence.slice(0, 50) + '…'
                          : record.consequence}
                      </Typography>
                    </Stack>

                    {/* Tags */}
                    {record.tags.length > 0 && (
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                        {record.tags.map(tag => (
                          <Chip key={tag} label={tag} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                        ))}
                      </Stack>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>
          閉じる
        </Button>
      </DialogActions>
    </Dialog>
  );
});

AbcSlotDialog.displayName = 'AbcSlotDialog';
