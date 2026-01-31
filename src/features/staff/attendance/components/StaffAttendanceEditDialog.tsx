import * as React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
} from '@mui/material';
import type { StaffAttendance, StaffAttendanceStatus } from '../types';

type Props = {
  open: boolean;
  recordDate: string; // 選択中の日付（キー/保存に必要）
  initial: StaffAttendance | null;
  onClose: () => void;
  onSave: (next: StaffAttendance) => Promise<void>;
  saving?: boolean;
  writeEnabled?: boolean;
};

const STATUS_OPTIONS: StaffAttendanceStatus[] = ['出勤', '欠勤', '外出中'];

export function StaffAttendanceEditDialog(props: Props): JSX.Element {
  const { open, recordDate, initial, onClose, onSave, saving = false, writeEnabled = true } = props;

  const [status, setStatus] = React.useState<StaffAttendanceStatus>('出勤');
  const [note, setNote] = React.useState<string>('');
  const [checkInAt, setCheckInAt] = React.useState<string>(''); // "HH:MM" で扱う想定

  React.useEffect(() => {
    if (!initial) return;
    setStatus(initial.status);
    setNote(initial.note ?? '');
    // checkInAt は ISO datetime → HH:MM に変換
    if (initial.checkInAt) {
      try {
        const dt = new Date(initial.checkInAt);
        const hh = String(dt.getHours()).padStart(2, '0');
        const mm = String(dt.getMinutes()).padStart(2, '0');
        setCheckInAt(`${hh}:${mm}`);
      } catch {
        setCheckInAt('');
      }
    } else {
      setCheckInAt('');
    }
  }, [initial]);

  const canSave = !!initial && !!recordDate && !!initial.staffId;

  const handleSave = async () => {
    if (!initial) return;

    // checkInAt を ISO datetime に変換（recordDate + "T" + time）
    let checkInAtISO: string | undefined;
    if (checkInAt) {
      checkInAtISO = `${recordDate}T${checkInAt}:00`;
    }

    await onSave({
      ...initial,
      recordDate,
      status,
      note: note.trim() ? note : undefined,
      checkInAt: checkInAtISO,
    });
  };

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      data-testid="staff-attendance-edit-dialog"
    >
      <DialogTitle>勤怠編集</DialogTitle>

      <DialogContent sx={{ display: 'grid', gap: 2, pt: 1 }}>
        <TextField
          label="職員ID"
          value={initial?.staffId ?? ''}
          disabled
          fullWidth
        />

        <TextField
          select
          label="ステータス"
          value={status}
          onChange={(e) => setStatus(e.target.value as StaffAttendanceStatus)}
          fullWidth
          inputProps={{ 'data-testid': 'staff-attendance-edit-status' }}
        >
          {STATUS_OPTIONS.map((s) => (
            <MenuItem key={s} value={s}>
              {s}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          label="メモ"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          multiline
          minRows={2}
          fullWidth
          inputProps={{ 'data-testid': 'staff-attendance-edit-note' }}
        />

        <TextField
          label="出勤時刻"
          type="time"
          value={checkInAt}
          onChange={(e) => setCheckInAt(e.target.value)}
          fullWidth
          inputProps={{ 'data-testid': 'staff-attendance-edit-checkin' }}
          InputLabelProps={{
            shrink: true,
          }}
        />
      </DialogContent>

      <DialogActions>
        <Button
          onClick={onClose}
          disabled={saving}
          data-testid="staff-attendance-edit-cancel"
        >
          キャンセル
        </Button>

        <Button
          variant="contained"
          disabled={!canSave || saving || !writeEnabled}
          data-testid="staff-attendance-edit-save"
          onClick={handleSave}
        >
          {saving ? '保存中...' : '保存'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
