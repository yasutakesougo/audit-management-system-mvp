import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import {
  EventAvailable as EventIcon,
  Save as SaveIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { format, addHours } from 'date-fns';

import { TESTIDS } from '@/testids';

// ===== Types =====

export type ScheduleServiceType =
  | 'normal'
  | 'transport'
  | 'respite'
  | 'nursing'
  | 'absence'
  | 'other';

export interface ScheduleFormState {
  userId: string;
  startLocal: string;
  endLocal: string;
  serviceType: ScheduleServiceType | '';
  locationName: string;
  notes: string;
}

export interface CreateScheduleEventInput {
  userId: string;
  startLocal: string;
  endLocal: string;
  serviceType: ScheduleServiceType;
  locationName?: string;
  notes?: string;
  staffIds?: string[];
}

export interface ScheduleUserOption {
  id: string;
  name: string;
}

type ScheduleCreateDialogBaseProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CreateScheduleEventInput) => Promise<void> | void;
  users: ScheduleUserOption[];
  initialDate?: Date;
  defaultUser?: ScheduleUserOption | null;
};

type ScheduleCreateDialogCreateProps = {
  mode: 'create';
  eventId?: undefined;
  initialOverride?: Partial<ScheduleFormState> | null;
};

type ScheduleCreateDialogEditProps = {
  mode: 'edit';
  eventId: string;
  initialOverride: Partial<ScheduleFormState>;
};

export type ScheduleCreateDialogProps = ScheduleCreateDialogBaseProps & (ScheduleCreateDialogCreateProps | ScheduleCreateDialogEditProps);

// ===== Helpers =====

function formatDateTimeLocal(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

export function createInitialScheduleFormState(options?: {
  initialDate?: Date;
  defaultUserId?: string;
  override?: Partial<ScheduleFormState> | null;
}): ScheduleFormState {
  const base = options?.initialDate ?? new Date();

  const start = new Date(base);
  start.setHours(10, 0, 0, 0);
  const end = addHours(start, 1);

  const initial: ScheduleFormState = {
    userId: options?.defaultUserId ?? '',
    startLocal: formatDateTimeLocal(start),
    endLocal: formatDateTimeLocal(end),
    serviceType: '',
    locationName: '',
    notes: ''
  };

  if (options?.override) {
    return {
      ...initial,
      ...options.override,
    };
  }

  return initial;
}

export interface ScheduleFormValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateScheduleForm(form: ScheduleFormState): ScheduleFormValidationResult {
  const errors: string[] = [];

  if (!form.userId) {
    errors.push('利用者を選択してください');
  }

  if (!form.startLocal) {
    errors.push('開始日時を入力してください');
  }

  if (!form.endLocal) {
    errors.push('終了日時を入力してください');
  }

  if (form.startLocal && form.endLocal) {
    const start = new Date(form.startLocal);
    const end = new Date(form.endLocal);

    if (!(start instanceof Date) || isNaN(start.getTime())) {
      errors.push('開始日時の形式が正しくありません');
    }
    if (!(end instanceof Date) || isNaN(end.getTime())) {
      errors.push('終了日時の形式が正しくありません');
    }
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end <= start) {
      errors.push('終了日時は開始日時より後にしてください');
    }
  }

  if (!form.serviceType) {
    errors.push('サービス種別を選択してください');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function toCreateScheduleInput(form: ScheduleFormState): CreateScheduleEventInput {
  if (!form.userId) {
    throw new Error('userId is required');
  }
  if (!form.startLocal || !form.endLocal) {
    throw new Error('startLocal and endLocal are required');
  }
  if (!form.serviceType) {
    throw new Error('serviceType is required');
  }

  return {
    userId: form.userId,
    startLocal: form.startLocal,
    endLocal: form.endLocal,
    serviceType: form.serviceType,
    locationName: form.locationName || undefined,
    notes: form.notes || undefined
  };
}

// ===== Component =====

export const ScheduleCreateDialog: React.FC<ScheduleCreateDialogProps> = (props) => {
  const {
    open,
    onClose,
    onSubmit,
    users,
    initialDate,
    defaultUser,
    mode,
    eventId: _eventId,
    initialOverride,
  } = props;
  const [form, setForm] = useState<ScheduleFormState>(() =>
    createInitialScheduleFormState({
      initialDate,
      defaultUserId: defaultUser?.id,
      override: initialOverride ?? undefined
    })
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        createInitialScheduleFormState({
          initialDate,
          defaultUserId: defaultUser?.id,
          override: initialOverride ?? undefined
        })
      );
      setErrors([]);
      setSubmitting(false);
    }
  }, [open, initialDate, defaultUser?.id, initialOverride, mode]);

  const titleLabel = mode === 'edit' ? 'スケジュール更新' : 'スケジュール新規作成';
  const primaryButtonLabel = mode === 'edit' ? '更新' : '作成';

  const selectedUser = useMemo(
    () => users.find(u => u.id === form.userId) ?? null,
    [users, form.userId]
  );

  const handleFieldChange = (field: keyof ScheduleFormState, value: string) => {
    setForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const handleSubmit = async () => {
    const validation = validateScheduleForm(form);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    const input = toCreateScheduleInput(form);
    const failureMessage = mode === 'edit'
      ? 'スケジュールの更新に失敗しました。もう一度お試しください。'
      : 'スケジュールの作成に失敗しました。もう一度お試しください。';

    setSubmitting(true);
    try {
      await onSubmit(input);
      onClose();
    } catch (error) {
      console.error('create schedule failed', error);
      setErrors([failureMessage]);
    } finally {
      setSubmitting(false);
    }
  };

  const serviceTypeOptions: { value: ScheduleServiceType; label: string }[] = [
    { value: 'normal', label: '通常利用' },
    { value: 'transport', label: '送迎' },
    { value: 'respite', label: '一時ケア・短期' },
    { value: 'nursing', label: '看護' },
    { value: 'absence', label: '欠席・休み' },
    { value: 'other', label: 'その他' }
  ];

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      data-testid={TESTIDS['schedule-create-dialog']}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <EventIcon />
          {titleLabel}
        </Box>
        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
          利用者・時間帯・サービス種別を入力して、{mode === 'edit' ? '予定を更新' : '新しい予定を登録'}します。
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2}>
          {errors.length > 0 && (
            <Alert severity="error" data-testid={TESTIDS['schedule-create-error-alert']}>
              <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
                {errors.map((msg, index) => (
                  <li key={index}>{msg}</li>
                ))}
              </ul>
            </Alert>
          )}

          <Autocomplete
            options={users}
            value={selectedUser}
            onChange={(_event, value) =>
              setForm(prev => ({
                ...prev,
                userId: value?.id ?? ''
              }))
            }
            getOptionLabel={option => option.name}
            renderInput={params => (
              <TextField
                {...params}
                label="利用者"
                required
                inputProps={{
                  ...params.inputProps,
                  'data-testid': TESTIDS['schedule-create-user-input']
                }}
              />
            )}
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              type="datetime-local"
              label="開始日時"
              required
              fullWidth
              value={form.startLocal}
              onChange={e => handleFieldChange('startLocal', e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{
                'data-testid': TESTIDS['schedule-create-start']
              }}
            />

            <TextField
              type="datetime-local"
              label="終了日時"
              required
              fullWidth
              value={form.endLocal}
              onChange={e => handleFieldChange('endLocal', e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{
                'data-testid': TESTIDS['schedule-create-end']
              }}
            />
          </Stack>

          <FormControl fullWidth required>
            <InputLabel id="schedule-create-service-type-label">サービス種別</InputLabel>
            <Select
              labelId="schedule-create-service-type-label"
              label="サービス種別"
              value={form.serviceType || ''}
              onChange={e =>
                handleFieldChange('serviceType', e.target.value as ScheduleServiceType | '')
              }
              data-testid={TESTIDS['schedule-create-service-type']}
            >
              {serviceTypeOptions.map(opt => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="場所（任意）"
            fullWidth
            value={form.locationName}
            onChange={e => handleFieldChange('locationName', e.target.value)}
            placeholder="例：生活介護室 / 訪問 / 通院先 など"
            inputProps={{
              'data-testid': TESTIDS['schedule-create-location']
            }}
          />

          <TextField
            label="備考（任意）"
            fullWidth
            multiline
            minRows={2}
            maxRows={4}
            value={form.notes}
            onChange={e => handleFieldChange('notes', e.target.value)}
            placeholder="送迎や看護の補足、留意事項などがあれば入力してください"
            inputProps={{
              'data-testid': TESTIDS['schedule-create-notes']
            }}
          />
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} startIcon={<CloseIcon />} disabled={submitting}>
          キャンセル
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          startIcon={<SaveIcon />}
          disabled={submitting}
          data-testid={TESTIDS['schedule-create-save']}
        >
            {submitting ? '保存中...' : primaryButtonLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
