import { useMemo } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, Typography, Divider, CircularProgress } from '@mui/material';
import { formatInTimeZone } from 'date-fns-tz';

import type { SchedItem } from '@/features/schedules/data';
import { resolveSchedulesTz } from '@/utils/scheduleTz';

interface ScheduleViewDialogProps {
  open: boolean;
  item: SchedItem | null;
  onClose: () => void;
  onEdit: (item: SchedItem) => void;
  onDelete: (id: string) => void;
  isDeleting?: boolean;
}

export default function ScheduleViewDialog({
  open,
  item,
  onClose,
  onEdit,
  onDelete,
  isDeleting = false,
}: ScheduleViewDialogProps) {
  const schedulesTz = useMemo(() => resolveSchedulesTz(), []);

  // Display target (category/visibility)
  const displayTarget = useMemo(() => {
    if (!item) return '';
    const category = item.category ?? 'Staff';
    const labels: Record<string, string> = {
      User: '利用者',
      Staff: '職員',
      Org: '全体',
    };
    return labels[category] ?? category;
  }, [item]);

  // Early return AFTER all hooks
  if (!item) return null;

  // Format time range with JST timezone
  const formatTimeRange = (): string => {
    try {
      const startDate = new Date(item.start);
      const endDate = new Date(item.end);
      const startStr = formatInTimeZone(startDate, schedulesTz, 'HH:mm');
      const endStr = formatInTimeZone(endDate, schedulesTz, 'HH:mm');
      return `${startStr} 〜 ${endStr}`;
    } catch {
      return `${item.start} 〜 ${item.end}`;
    }
  };

  // Format creation/update date
  const formatDateTime = (isoStr: string | undefined): string => {
    if (!isoStr) return '—';
    try {
      const date = new Date(isoStr);
      return formatInTimeZone(date, schedulesTz, 'yyyy-MM-dd HH:mm');
    } catch {
      return isoStr;
    }
  };

  const handleEditClick = () => {
    onEdit(item);
  };

  const handleDeleteClick = () => {
    if (window.confirm(`「${item.title}」を削除してよろしいですか？`)) {
      onDelete(item.id);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={{
          bgcolor: 'primary.light',
          color: 'primary.contrastText',
          fontSize: '1.1rem',
          fontWeight: 600,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {item.title}
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        <Stack spacing={2}>
          {/* Time */}
          <div>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              時間
            </Typography>
            <Typography variant="body1">{formatTimeRange()}</Typography>
          </div>

          <Divider />

          {/* Target (Category) */}
          <div>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              対象
            </Typography>
            <Typography variant="body1">{displayTarget}</Typography>
          </div>

          {/* Person/Staff Name */}
          {item.personName && (
            <>
              <Divider />
              <div>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  対象者
                </Typography>
                <Typography variant="body1">{item.personName}</Typography>
              </div>
            </>
          )}

          {/* Notes */}
          {item.notes && (
            <>
              <Divider />
              <div>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  メモ
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {item.notes}
                </Typography>
              </div>
            </>
          )}

          {/* Metadata */}
          <Divider />
          <Stack spacing={0.5} sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
            {item.createdAt && (
              <Typography variant="caption">
                作成: {formatDateTime(item.createdAt)}
              </Typography>
            )}
            {item.updatedAt && (
              <Typography variant="caption">
                更新: {formatDateTime(item.updatedAt)}
              </Typography>
            )}
          </Stack>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose} disabled={isDeleting} data-testid="schedule-view-close">
          閉じる
        </Button>
        <Button
          onClick={handleDeleteClick}
          color="error"
          disabled={isDeleting}
          data-testid="schedule-view-delete"
          startIcon={isDeleting && <CircularProgress size={16} />}
        >
          {isDeleting ? '削除中...' : '削除'}
        </Button>
        <Button
          onClick={handleEditClick}
          variant="contained"
          disabled={isDeleting}
          data-testid="schedule-view-edit"
        >
          編集
        </Button>
      </DialogActions>
    </Dialog>
  );
}
