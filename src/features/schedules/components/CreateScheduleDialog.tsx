import * as React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

export type CreateScheduleDraft = {
  title: string;
  notes?: string;
  dateIso: string; // YYYY-MM-DD
  allDay: boolean;
  startTime?: string; // HH:mm (time mode only)
  endTime?: string; // HH:mm (time mode only)
};

interface CreateScheduleDialogProps {
  open: boolean;
  dateIso: string | null;
  mode?: 'month' | 'time'; // Default: 'month'
  defaultAllDay?: boolean;
  defaultStartTime?: string; // HH:mm
  defaultEndTime?: string; // HH:mm
  onClose: () => void;
  onSubmit: (draft: CreateScheduleDraft) => void;
}

export function CreateScheduleDialog({
  open,
  dateIso,
  mode = 'month',
  defaultAllDay = false,
  defaultStartTime,
  defaultEndTime,
  onClose,
  onSubmit,
}: CreateScheduleDialogProps) {
  const [title, setTitle] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [startTime, setStartTime] = React.useState('');
  const [endTime, setEndTime] = React.useState('');

  const isTimeMode = mode === 'time';

  React.useEffect(() => {
    if (!open) return;
    // Reset on open
    setTitle('');
    setNotes('');
    setStartTime(defaultStartTime || '');
    setEndTime(defaultEndTime || '');
  }, [open, defaultStartTime, defaultEndTime]);

  const canSave = React.useMemo(() => {
    const hasTitle = Boolean(dateIso) && title.trim().length > 0;
    if (!isTimeMode) return hasTitle;
    // Time mode: additionally check start/end
    return hasTitle && startTime && endTime && startTime < endTime;
  }, [dateIso, title, isTimeMode, startTime, endTime]);

  const handleSave = () => {
    if (!dateIso) return;
    const draft: CreateScheduleDraft = {
      title: title.trim(),
      notes: notes.trim() ? notes.trim() : undefined,
      dateIso,
      allDay: isTimeMode ? false : defaultAllDay,
      startTime: isTimeMode ? startTime : undefined,
      endTime: isTimeMode ? endTime : undefined,
    };
    onSubmit(draft);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey && canSave) {
      handleSave();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>新規予定</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            日付: {dateIso ?? '—'}
            {defaultAllDay && !isTimeMode ? '（終日）' : ''}
          </Typography>

          <TextField
            autoFocus
            label="タイトル"
            placeholder="予定のタイトルを入力"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            required
            fullWidth
            inputProps={{ maxLength: 120 }}
          />

          {isTimeMode && (
            <Stack direction="row" spacing={2}>
              <TextField
                type="time"
                label="開始時間"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                onKeyDown={handleKeyDown}
                required
                fullWidth
                inputProps={{
                  step: 60, // 1 minute increments
                }}
              />
              <TextField
                type="time"
                label="終了時間"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                onKeyDown={handleKeyDown}
                required
                fullWidth
                inputProps={{
                  step: 60,
                }}
              />
            </Stack>
          )}

          <TextField
            label="メモ"
            placeholder="メモをここに入力（任意）"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onKeyDown={handleKeyDown}
            multiline
            minRows={3}
            fullWidth
            inputProps={{ maxLength: 1000 }}
          />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>キャンセル</Button>
        <Button onClick={handleSave} disabled={!canSave} variant="contained">
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
}
