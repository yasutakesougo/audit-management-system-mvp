/**
 * IrcEventDetailDialog — Event detail dialog
 *
 * Shows plan/actual times, status, notes, and delete action.
 * Extracted from IntegratedResourceCalendarPage.tsx.
 */

import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    Typography,
} from '@mui/material';
import type { UnifiedResourceEvent } from '../features/resources/types';
import { formatTime, getStatusIcon } from './ircCalendarTypes';

// ─── Props ──────────────────────────────────────────────────────────────────

interface IrcEventDetailDialogProps {
  open: boolean;
  event: UnifiedResourceEvent | null;
  onClose: () => void;
  onDelete: (eventId: string) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function IrcEventDetailDialog({
  open,
  event,
  onClose,
  onDelete,
}: IrcEventDetailDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        予定詳細 {event && getStatusIcon(event.extendedProps.status)}
      </DialogTitle>
      <DialogContent>
        {event && (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography><strong>タイトル:</strong> {event.title}</Typography>
            <Typography><strong>計画時間:</strong> {formatTime(event.start)} - {formatTime(event.end)}</Typography>
            <Typography><strong>種別:</strong> {event.extendedProps.planType}</Typography>
            <Typography><strong>ステータス:</strong> {event.extendedProps.status}</Typography>

            {event.extendedProps.actualStart && (
              <>
                <Typography><strong>実績開始:</strong> {formatTime(event.extendedProps.actualStart)}</Typography>
                {event.extendedProps.actualEnd && (
                  <Typography><strong>実績終了:</strong> {formatTime(event.extendedProps.actualEnd)}</Typography>
                )}
                {event.extendedProps.diffMinutes !== undefined && event.extendedProps.diffMinutes !== null && (
                  <Typography><strong>差分:</strong> {event.extendedProps.diffMinutes > 0 ? '+' : ''}{event.extendedProps.diffMinutes}分</Typography>
                )}
              </>
            )}

            {event.extendedProps.notes && (
              <Typography><strong>備考:</strong> {event.extendedProps.notes}</Typography>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {event && !event.extendedProps.actualStart && (
          <Button
            color="error"
            onClick={() => {
              onDelete(event.id);
              onClose();
            }}
          >
            削除
          </Button>
        )}
        <Button onClick={onClose}>
          閉じる
        </Button>
      </DialogActions>
    </Dialog>
  );
}
