/**
 * IRC — Event detail dialog (Presentational).
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
import React from 'react';

import { formatTime, getStatusIcon } from '../ircEventLogic';
import type { UnifiedResourceEvent } from '../types';

export interface IrcEventDetailDialogProps {
  open: boolean;
  event: UnifiedResourceEvent | null;
  onClose: () => void;
  onDelete: (eventId: string) => void;
}

export const IrcEventDetailDialog: React.FC<IrcEventDetailDialogProps> = ({
  open,
  event,
  onClose,
  onDelete,
}) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
    <DialogTitle>
      予定詳細 {event && getStatusIcon(event.extendedProps.status)}
    </DialogTitle>
    <DialogContent>
      {event && (
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography><strong>タイトル:</strong> {event.title}</Typography>
          <Typography>
            <strong>計画時間:</strong> {formatTime(event.start)} - {formatTime(event.end)}
          </Typography>
          <Typography><strong>種別:</strong> {event.extendedProps.planType}</Typography>
          <Typography><strong>ステータス:</strong> {event.extendedProps.status}</Typography>

          {event.extendedProps.actualStart && (
            <>
              <Typography>
                <strong>実績開始:</strong> {formatTime(event.extendedProps.actualStart)}
              </Typography>
              {event.extendedProps.actualEnd && (
                <Typography>
                  <strong>実績終了:</strong> {formatTime(event.extendedProps.actualEnd)}
                </Typography>
              )}
              {event.extendedProps.diffMinutes !== undefined &&
                event.extendedProps.diffMinutes !== null && (
                  <Typography>
                    <strong>差分:</strong>{' '}
                    {event.extendedProps.diffMinutes > 0 ? '+' : ''}
                    {event.extendedProps.diffMinutes}分
                  </Typography>
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
        <Button color="error" onClick={() => onDelete(event.id)}>
          削除
        </Button>
      )}
      <Button onClick={onClose}>閉じる</Button>
    </DialogActions>
  </Dialog>
);

export default IrcEventDetailDialog;
