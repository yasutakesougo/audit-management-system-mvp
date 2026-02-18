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
};

interface CreateScheduleDialogProps {
  open: boolean;
  dateIso: string | null;
  defaultAllDay?: boolean;
  onClose: () => void;
  onSubmit: (draft: CreateScheduleDraft) => void;
}

export function CreateScheduleDialog({
  open,
  dateIso,
  defaultAllDay = false,
  onClose,
  onSubmit,
}: CreateScheduleDialogProps) {
  const [title, setTitle] = React.useState('');
  const [notes, setNotes] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    // Reset on open
    setTitle('');
    setNotes('');
  }, [open]);

  const canSave = Boolean(dateIso) && title.trim().length > 0;

  const handleSave = () => {
    if (!dateIso) return;
    const draft: CreateScheduleDraft = {
      title: title.trim(),
      notes: notes.trim() ? notes.trim() : undefined,
      dateIso,
      allDay: defaultAllDay,
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
            {defaultAllDay ? '（終日）' : ''}
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
