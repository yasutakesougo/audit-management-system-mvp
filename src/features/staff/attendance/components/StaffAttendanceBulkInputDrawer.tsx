import * as React from 'react';
import {
  Drawer,
  Box,
  Typography,
  Stack,
  Button,
  TextField,
  MenuItem,
  Alert,
} from '@mui/material';
import type { StaffAttendanceStatus } from '../types';

type Props = {
  open: boolean;
  selectedCount: number;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  writeEnabled?: boolean;

  // "適用"で生成するための入力値
  value: {
    status: StaffAttendanceStatus;
    checkInAtHHmm: string; // "09:10" など（空OK）
    note: string;          // 空なら "上書きしない"
  };
  onChange: (next: Props['value']) => void;

  onSave: () => void;
};

const STATUS_OPTIONS: StaffAttendanceStatus[] = ['出勤', '欠勤', '外出中'];

export function StaffAttendanceBulkInputDrawer(props: Props): JSX.Element {
  const { open, selectedCount, saving, error, onClose, value, onChange, onSave, writeEnabled = true } = props;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      data-testid="staff-attendance-bulk-drawer"
    >
      <Box sx={{ width: { xs: 320, sm: 420 }, p: 2 }}>
        <Stack spacing={2}>
          <Typography variant="h6">
            一括入力（{selectedCount}件）
          </Typography>

          {error ? (
            <Alert severity="error" data-testid="staff-attendance-bulk-error">
              {error}
            </Alert>
          ) : null}

          <TextField
            select
            label="ステータス（必ず上書き）"
            value={value.status}
            onChange={(e) =>
              onChange({ ...value, status: e.target.value as StaffAttendanceStatus })
            }
            data-testid="staff-attendance-bulk-status"
          >
            {STATUS_OPTIONS.map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="出勤時刻（HH:MM / 必ず上書き）"
            type="time"
            value={value.checkInAtHHmm}
            onChange={(e) => onChange({ ...value, checkInAtHHmm: e.target.value })}
            inputProps={{ step: 60 }}
            helperText="空の場合は空として上書きします（運用に合わせて後で変更可）"
            data-testid="staff-attendance-bulk-checkin"
            InputLabelProps={{
              shrink: true,
            }}
          />

          <TextField
            label="メモ（空なら上書きしない）"
            value={value.note}
            onChange={(e) => onChange({ ...value, note: e.target.value })}
            multiline
            minRows={3}
            placeholder="空のまま保存すると、既存メモは維持されます"
            data-testid="staff-attendance-bulk-note"
          />

          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button
              onClick={onClose}
              disabled={saving}
              data-testid="staff-attendance-bulk-cancel"
            >
              キャンセル
            </Button>
            <Button
              variant="contained"
              onClick={onSave}
              disabled={saving || selectedCount === 0 || !writeEnabled}
              data-testid="staff-attendance-bulk-save"
            >
              {saving ? '保存中...' : '保存'}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Drawer>
  );
}
