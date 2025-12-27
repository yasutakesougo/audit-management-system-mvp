import {
  Close as CloseIcon,
  EventAvailable as EventIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import type { SelectChangeEvent } from '@mui/material/Select';
import { addHours, format } from 'date-fns';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { useAnnounce } from '@/a11y/LiveAnnouncer';
import { TESTIDS } from '@/testids';
import type {
  CreateScheduleEventInput,
  ScheduleCategory,
  ScheduleServiceType,
  ScheduleStatus,
} from './data';
import { SCHEDULE_STATUS_OPTIONS } from './statusMetadata';
import { buildScheduleFailureAnnouncement, buildScheduleSuccessAnnouncement } from './utils/scheduleAnnouncements';
import { useOrgOptions, type OrgOption } from './useOrgOptions';
import { useStaffOptions, type StaffOption } from './useStaffOptions';

export type {
  CreateScheduleEventInput,
  ScheduleCategory,
  ScheduleServiceType,
  ScheduleStatus
} from './data';

// ===== Types =====

export interface ScheduleFormState {
  title: string;
  category: ScheduleCategory;
  userId: string;
  startLocal: string;
  endLocal: string;
  serviceType?: ScheduleServiceType | string | null;
  locationName: string;
  notes: string;
  assignedStaffId: string;
  vehicleId: string;
  status: ScheduleStatus;
  statusReason: string;
}

export interface ScheduleUserOption {
  id: string;
  name: string;
  lookupId?: string;
}

type ScheduleCreateDialogBaseProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CreateScheduleEventInput) => Promise<void> | void;
  users: ScheduleUserOption[];
  initialDate?: Date | string;
  initialStartTime?: string;
  initialEndTime?: string;
  defaultUser?: ScheduleUserOption | null;
  dialogTestId?: string;
  submitTestId?: string;
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

const SERVICE_TYPE_OPTIONS: { value: ScheduleServiceType; label: string }[] = [
  { value: 'absence', label: '欠席' },
  { value: 'late', label: '遅刻' },
  { value: 'earlyLeave', label: '早退' },
  { value: 'other', label: 'その他' },
];

const CATEGORY_OPTIONS: { value: ScheduleCategory; label: string; helper: string }[] = [
  { value: 'User', label: '利用者', helper: '利用者予定：利用者とサービス種別を指定' },
  { value: 'Staff', label: '職員', helper: '職員予定：担当職員を選択' },
  { value: 'Org', label: '事業所', helper: '事業所予定：共有イベントや会議など' },
];

function buildAutoTitle(params: {
  userName?: string;
  serviceType?: ScheduleServiceType | string | null;
  assignedStaffId?: string;
  vehicleId?: string;
}): string {
  if (params.userName?.trim()) return `${params.userName}の予定`;
  if (params.serviceType) {
    const label = SERVICE_TYPE_OPTIONS.find((o) => o.value === params.serviceType)?.label;
    if (label) return `${label}の予定`;
  }
  if (params.assignedStaffId?.trim()) return `担当 ${params.assignedStaffId} の予定`;
  if (params.vehicleId?.trim()) return `車両 ${params.vehicleId} の予定`;
  return '新規予定';
}

export function createInitialScheduleFormState(options?: {
  initialDate?: Date | string;
  initialStartTime?: string;
  initialEndTime?: string;
  defaultUserId?: string;
  defaultTitle?: string;
  override?: Partial<ScheduleFormState> | null;
}): ScheduleFormState {
  const base = (() => {
    if (options?.initialDate) {
      if (typeof options.initialDate === 'string') {
        const parsed = new Date(`${options.initialDate}T00:00:00`);
        if (!Number.isNaN(parsed.getTime())) return parsed;
      } else if (options.initialDate instanceof Date) {
        return options.initialDate;
      }
    }
    return new Date();
  })();

  const parseTime = (value?: string): { hours: number; minutes: number } | null => {
    if (!value) return null;
    const [hoursStr, minutesStr] = value.split(':');
    const hours = Number(hoursStr);
    const minutes = Number(minutesStr);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    return { hours, minutes };
  };

  const start = new Date(base);
  const startTime = parseTime(options?.initialStartTime);
  if (startTime) {
    start.setHours(startTime.hours, startTime.minutes, 0, 0);
  } else {
    start.setHours(10, 0, 0, 0);
  }

  let end = new Date(base);
  const endTime = parseTime(options?.initialEndTime);
  if (endTime) {
    end.setHours(endTime.hours, endTime.minutes, 0, 0);
  } else {
    end = addHours(start, 1);
  }

  const initial: ScheduleFormState = {
    title: options?.defaultTitle ?? '',
    category: options?.override?.category ?? 'User',
    userId: options?.defaultUserId ?? '',
    startLocal: formatDateTimeLocal(start),
    endLocal: formatDateTimeLocal(end),
    serviceType: '',
    locationName: '',
    notes: '',
    assignedStaffId: '',
    vehicleId: '',
    status: 'Planned',
    statusReason: '',
  };

  if (options?.override) {
    const override: Partial<ScheduleFormState> = {
      ...options.override,
      status: options.override.status ?? 'Planned',
      statusReason: options.override.statusReason ?? '',
    };
    return {
      ...initial,
      ...override,
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

  if (!form.title.trim()) {
    errors.push('予定タイトルを入力してください');
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

  if (form.category === 'User' && !form.serviceType) {
    errors.push('サービス種別を選択してください');
  }

  if (form.category === 'User' && !form.userId.trim()) {
    errors.push('利用者予定では利用者を選択してください');
  }

  if (form.category === 'Staff' && !form.assignedStaffId?.trim()) {
    errors.push('職員予定では担当職員 ID を入力してください');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function toCreateScheduleInput(
  form: ScheduleFormState,
  selectedUser?: ScheduleUserOption | null,
): CreateScheduleEventInput {
  const trimmedTitle = form.title.trim();
  if (!trimmedTitle) {
    throw new Error('title is required');
  }
  if (!form.startLocal || !form.endLocal) {
    throw new Error('startLocal and endLocal are required');
  }
  if (form.category === 'User' && !form.serviceType) {
    throw new Error('serviceType is required for user schedules');
  }

  const normalizeLookupId = (value?: unknown): string | undefined => {
    if (value == null) {
      return undefined;
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) ? String(value) : undefined;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed ? trimmed : undefined;
    }
    if (typeof value === 'object') {
      const lookupSource = value as Record<string, unknown>;
      if ('lookupId' in lookupSource) {
        return normalizeLookupId(lookupSource.lookupId);
      }
      if ('id' in lookupSource) {
        return normalizeLookupId(lookupSource.id);
      }
      if ('value' in lookupSource) {
        return normalizeLookupId(lookupSource.value);
      }
    }
    return undefined;
  };

  if (form.category === 'User' && !form.userId.trim()) {
    throw new Error('userId is required for user schedules');
  }

  if (form.category === 'Staff' && !form.assignedStaffId.trim()) {
    throw new Error('assignedStaffId is required for staff schedules');
  }

  let resolvedServiceType: ScheduleServiceType;
  if (form.category === 'User') {
    if (typeof form.serviceType === 'string') {
      resolvedServiceType = form.serviceType as ScheduleServiceType;
    } else if (!form.serviceType) {
      resolvedServiceType = 'normal';
    } else {
      resolvedServiceType = form.serviceType;
    }
  } else {
    if (typeof form.serviceType === 'string') {
      resolvedServiceType = form.serviceType as ScheduleServiceType;
    } else if (!form.serviceType) {
      resolvedServiceType = 'other';
    } else {
      resolvedServiceType = form.serviceType;
    }
  }
  const statusReason = form.statusReason.trim();
  const resolvedUserLookupId = normalizeLookupId(selectedUser?.lookupId ?? undefined);
  const resolvedUserName = selectedUser?.name?.trim() || undefined;

  return {
    title: trimmedTitle,
    category: form.category,
    userId: form.userId?.trim() || undefined,
    userLookupId: resolvedUserLookupId,
    userName: resolvedUserName,
    startLocal: form.startLocal,
    endLocal: form.endLocal,
    serviceType: resolvedServiceType,
    locationName: form.locationName || undefined,
    notes: form.notes || undefined,
    assignedStaffId: normalizeLookupId(form.assignedStaffId),
    vehicleId: normalizeLookupId(form.vehicleId),
    status: form.status,
    statusReason: statusReason ? statusReason : null,
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
    initialStartTime,
    initialEndTime,
    defaultUser,
    mode,
    eventId: _eventId,
    initialOverride,
    dialogTestId,
    submitTestId,
  } = props;
  const resolvedDialogTestId = dialogTestId ?? TESTIDS['schedule-create-dialog'];
  const headingId = `${resolvedDialogTestId}-heading`;
  const descriptionId = `${resolvedDialogTestId}-description`;
  const resolvedDefaultTitle = useMemo(() => {
    if (initialOverride?.title?.trim()) return initialOverride.title;
    const candidateUserId = initialOverride?.userId ?? defaultUser?.id;
    const matchedUser = candidateUserId ? users.find((candidate) => candidate.id === candidateUserId) : undefined;
    return buildAutoTitle({
      userName: matchedUser?.name ?? defaultUser?.name ?? undefined,
      serviceType: initialOverride?.serviceType ?? '',
      assignedStaffId: initialOverride?.assignedStaffId ?? '',
      vehicleId: initialOverride?.vehicleId ?? '',
    });
  }, [
    defaultUser?.id,
    defaultUser?.name,
    initialOverride?.title,
    initialOverride?.userId,
    initialOverride?.serviceType,
    initialOverride?.assignedStaffId,
    initialOverride?.vehicleId,
    users
  ]);
  const [form, setForm] = useState<ScheduleFormState>(() =>
    createInitialScheduleFormState({
      initialDate,
      initialStartTime,
      initialEndTime,
      defaultUserId: defaultUser?.id,
      defaultTitle: resolvedDefaultTitle,
      override: initialOverride ?? undefined
    })
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const announce = useAnnounce();
  const wasOpenRef = useRef(open);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const errorSummaryId = errors.length > 0 ? `${resolvedDialogTestId}-errors` : undefined;
  const dialogAriaDescribedBy = errorSummaryId ? `${descriptionId} ${errorSummaryId}` : descriptionId;
  const staffOptions = useStaffOptions();
  const orgOptions = useOrgOptions();
  const dateOrderErrorMessage = useMemo(
    () => errors.find((msg) => msg.includes('終了日時は開始日時より後にしてください')),
    [errors],
  );
  const serviceTypeErrorMessage = useMemo(
    () => errors.find((msg) => msg.includes('サービス種別を選択してください')),
    [errors],
  );
  const selectedStaffOption = useMemo(() => {
    if (!form.assignedStaffId) {
      return null;
    }
    const numeric = Number(form.assignedStaffId);
    if (!Number.isFinite(numeric)) {
      return null;
    }
    return staffOptions.find((option) => option.id === numeric) ?? null;
  }, [form.assignedStaffId, staffOptions]);

  useEffect(() => {
    if (open) {
      setForm((prev) => {
        const next = createInitialScheduleFormState({
          initialDate,
          initialStartTime,
          initialEndTime,
          defaultUserId: defaultUser?.id,
          defaultTitle: resolvedDefaultTitle,
          override: initialOverride ?? undefined
        });
        if (prev.title && prev.title.trim() && prev.title !== resolvedDefaultTitle) {
          next.title = prev.title;
        }
        return next;
      });
      setErrors([]);
      setSubmitting(false);
    }
  }, [open, initialDate, initialStartTime, initialEndTime, defaultUser?.id, initialOverride, mode, resolvedDefaultTitle]);

  const titleLabel = mode === 'edit' ? 'スケジュール更新' : 'スケジュール新規作成';
  const primaryButtonLabel = mode === 'edit' ? '更新' : '作成';
  const failureMessage = mode === 'edit'
    ? 'スケジュールの更新に失敗しました。もう一度お試しください。'
    : 'スケジュールの作成に失敗しました。もう一度お試しください。';
  const openAnnouncement = useMemo(
    () => (mode === 'edit' ? 'スケジュール更新ダイアログを開きました。' : 'スケジュール新規作成ダイアログを開きました。'),
    [mode],
  );

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    if (open && !wasOpenRef.current) {
      const active = document.activeElement;
      lastFocusedRef.current = active instanceof HTMLElement ? active : null;
      announce(openAnnouncement);
    } else if (!open && wasOpenRef.current) {
      const target = lastFocusedRef.current;
      lastFocusedRef.current = null;
      window.setTimeout(() => {
        target?.focus();
      }, 0);
    }
    wasOpenRef.current = open;
  }, [announce, open, openAnnouncement]);

  const selectedUser = useMemo(
    () => users.find(u => u.id === form.userId) ?? null,
    [users, form.userId]
  );

  const autoTitleFromForm = useMemo(() => {
    const currentUserName = users.find((u) => u.id === form.userId)?.name;
    return buildAutoTitle({
      userName: currentUserName,
      serviceType: form.serviceType,
      assignedStaffId: form.assignedStaffId,
      vehicleId: form.vehicleId,
    });
  }, [form.userId, form.serviceType, form.assignedStaffId, form.vehicleId, users]);

  const selectedOrgOption = useMemo(() => {
    if (!form.locationName) {
      return null;
    }
    return orgOptions.find((option) => option.label === form.locationName) ?? null;
  }, [form.locationName, orgOptions]);

  useEffect(() => {
    setForm((prev) => {
      if (prev.title.trim()) return prev;
      return { ...prev, title: autoTitleFromForm };
    });
  }, [autoTitleFromForm]);

  const handleUserChange = (_event: unknown, value: ScheduleUserOption | null) => {
    setForm((prev) => {
      const prevUserName = users.find((u) => u.id === prev.userId)?.name ?? '';
      const prevAutoTitle = buildAutoTitle({
        userName: prevUserName,
        serviceType: prev.serviceType,
        assignedStaffId: prev.assignedStaffId,
        vehicleId: prev.vehicleId,
      });
      const shouldReplaceTitle = !prev.title.trim() || prev.title === prevAutoTitle;
      const nextAutoTitle = buildAutoTitle({
        userName: value?.name,
        serviceType: prev.serviceType,
        assignedStaffId: prev.assignedStaffId,
        vehicleId: prev.vehicleId,
      });
      return {
        ...prev,
        userId: value?.id ?? '',
        title: shouldReplaceTitle ? nextAutoTitle : prev.title,
      };
    });
  };

  const handleFieldChange = (field: keyof ScheduleFormState, value: string) => {
    setForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCategoryChange = (event: SelectChangeEvent<ScheduleCategory>) => {
    const nextCategory = event.target.value as ScheduleCategory;
    setForm((prev) => {
      if (prev.category === nextCategory) {
        return prev;
      }
      const next: ScheduleFormState = {
        ...prev,
        category: nextCategory,
      };
      if (nextCategory !== 'User') {
        next.userId = '';
      }
      if (nextCategory !== 'Staff') {
        next.assignedStaffId = '';
      }
      return next;
    });
  };

  const handleStaffChange = (_event: unknown, option: StaffOption | null) => {
    setForm((prev) => {
      const currentUserName = users.find((u) => u.id === prev.userId)?.name ?? '';
      const prevAutoTitle = buildAutoTitle({
        userName: currentUserName,
        serviceType: prev.serviceType,
        assignedStaffId: prev.assignedStaffId,
        vehicleId: prev.vehicleId,
      });
      const shouldReplaceTitle = !prev.title.trim() || prev.title === prevAutoTitle;
      const nextAssignedStaffId = option ? String(option.id) : '';
      const nextAutoTitle = buildAutoTitle({
        userName: currentUserName,
        serviceType: prev.serviceType,
        assignedStaffId: nextAssignedStaffId,
        vehicleId: prev.vehicleId,
      });
      return {
        ...prev,
        assignedStaffId: nextAssignedStaffId,
        title: shouldReplaceTitle ? nextAutoTitle : prev.title,
      };
    });
  };

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const handleSubmit = async () => {
    const validation = validateScheduleForm(form);
    if (!validation.isValid) {
      setErrors(validation.errors);
      if (validation.errors.length > 0) {
        announce(validation.errors[0], 'assertive');
      }
      return;
    }

    const input = toCreateScheduleInput(form, selectedUser);

    setSubmitting(true);
    try {
      await onSubmit(input);
      const successAnnouncement = buildScheduleSuccessAnnouncement({
        input,
        userName: selectedUser?.name,
        mode,
      });
      announce(successAnnouncement);
      setSubmitting(false);
      onClose();
    } catch (error) {
      console.error('[ScheduleCreateDialog] submit failed', error);
      const failureAnnouncement = buildScheduleFailureAnnouncement({
        input,
        userName: selectedUser?.name,
        mode,
      });
      setErrors([failureAnnouncement || failureMessage]);
      announce(failureAnnouncement || failureMessage, 'assertive');
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': headingId,
        'aria-describedby': dialogAriaDescribedBy,
        'data-testid': resolvedDialogTestId,
      }}
    >
      <Box data-testid={TESTIDS['schedule-editor-root']} sx={{ display: 'contents' }}>
      <DialogTitle
        id={headingId}
        data-testid={TESTIDS['schedule-create-heading']}
        sx={{ pb: 1 }}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <EventIcon />
          {titleLabel}
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Typography
          id={descriptionId}
          data-testid={TESTIDS['schedule-create-description']}
          variant="body2"
          color="textSecondary"
          sx={{ mb: 2 }}
        >
          タイトル、開始/終了時刻、カテゴリと対象を入力して{mode === 'edit' ? '内容を更新' : '新しい予定を登録'}します。
        </Typography>

        <Stack spacing={2}>
          {errors.length > 0 && (
            <Alert
              severity="error"
              data-testid={TESTIDS['schedule-create-error-alert']}
              id={errorSummaryId}
            >
              <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
                {errors.map((msg, index) => (
                  <li key={index}>{msg}</li>
                ))}
              </ul>
            </Alert>
          )}

          <TextField
            label="予定タイトル"
            required
            fullWidth
            value={form.title}
            onChange={(e) => handleFieldChange('title', e.target.value)}
            placeholder="例）午前 利用者Aさん通所"
            autoFocus
            inputProps={{
              'data-testid': TESTIDS['schedule-create-title'],
            }}
          />

          <FormControl fullWidth required>
            <InputLabel id="schedule-create-category-label">カテゴリ</InputLabel>
            <Select
              labelId="schedule-create-category-label"
              label="カテゴリ"
              value={form.category}
              onChange={handleCategoryChange}
              data-testid={TESTIDS['schedule-create-category-select']}
            >
              {CATEGORY_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  <Stack spacing={0.25}>
                    <span>{option.label}</span>
                    <Typography variant="caption" color="text.secondary">
                      {option.helper}
                    </Typography>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {form.category === 'User' && (
            <Autocomplete
              options={users}
              value={selectedUser}
              onChange={handleUserChange}
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
          )}

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
              error={Boolean(dateOrderErrorMessage)}
              helperText={dateOrderErrorMessage}
              inputProps={{
                'data-testid': TESTIDS['schedule-create-end']
              }}
            />
          </Stack>

          {form.category === 'User' && (
            <FormControl fullWidth required error={Boolean(serviceTypeErrorMessage)}>
              <InputLabel id="schedule-create-service-type-label">サービス種別</InputLabel>
              <Select
                labelId="schedule-create-service-type-label"
                label="サービス種別"
                value={form.serviceType || ''}
                onChange={e =>
                  handleFieldChange('serviceType', e.target.value as ScheduleServiceType | '')
                }
                inputProps={{ 'aria-label': 'サービス種別' }}
                data-testid={TESTIDS['schedule-create-service-type']}
              >
                {SERVICE_TYPE_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>
                {serviceTypeErrorMessage ?? 'サービス種別を付けておくと一覧で絞り込みやすくなります。'}
              </FormHelperText>
            </FormControl>
          )}

          {form.category === 'Org' ? (
            <Autocomplete<OrgOption, false, false, true>
              freeSolo
              options={orgOptions}
              value={selectedOrgOption ?? (form.locationName ? form.locationName : null)}
              onChange={(_, value) => {
                if (typeof value === 'string') {
                  handleFieldChange('locationName', value);
                  return;
                }
                handleFieldChange('locationName', value?.label ?? '');
              }}
              onInputChange={(_, value, reason) => {
                if (reason === 'input') {
                  handleFieldChange('locationName', value);
                }
                if (reason === 'clear') {
                  handleFieldChange('locationName', '');
                }
              }}
              getOptionLabel={(option) => (typeof option === 'string' ? option : option.label)}
              isOptionEqualToValue={(option, value) =>
                typeof value === 'string' ? option.label === value : option.id === value.id
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="対象 / 場所（任意）"
                  placeholder="事業所イベントの対象を選択"
                  inputProps={{
                    ...params.inputProps,
                    'data-testid': TESTIDS['schedule-create-location'],
                  }}
                />
              )}
            />
          ) : (
            <TextField
              label="場所"
              fullWidth
              value={form.locationName}
              onChange={e => handleFieldChange('locationName', e.target.value)}
              placeholder="例）活動室A／送迎車／会議室 など"
              inputProps={{
                'data-testid': TESTIDS['schedule-create-location']
              }}
            />
          )}

          <TextField
            label="メモ"
            fullWidth
            multiline
            minRows={2}
            maxRows={4}
            value={form.notes}
            onChange={e => handleFieldChange('notes', e.target.value)}
            placeholder="支援のポイントや、共有したい補足を記入"
            inputProps={{
              'data-testid': TESTIDS['schedule-create-notes']
            }}
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            {form.category === 'User' ? (
              <Autocomplete<StaffOption>
                options={staffOptions}
                value={selectedStaffOption}
                onChange={handleStaffChange}
                getOptionLabel={(option) => option.label}
                isOptionEqualToValue={(option, value) => option.id === value?.id}
                fullWidth
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="職員を選択"
                    required
                    inputProps={{
                      ...params.inputProps,
                      'data-testid': TESTIDS['schedule-create-staff-id'],
                    }}
                  />
                )}
              />
            ) : (
              <TextField
                label="担当職員 ID（任意）"
                type="number"
                fullWidth
                value={form.assignedStaffId}
                onChange={(e) => handleFieldChange('assignedStaffId', e.target.value)}
                placeholder="SharePoint の AssignedStaffId"
                inputProps={{
                  min: 0,
                  'data-testid': TESTIDS['schedule-create-staff-id'],
                }}
              />
            )}

            <TextField
              label="車両 ID（任意）"
              type="number"
              fullWidth
              value={form.vehicleId}
              onChange={(e) => handleFieldChange('vehicleId', e.target.value)}
              placeholder="SharePoint の VehicleId"
              inputProps={{
                min: 0,
                'data-testid': TESTIDS['schedule-create-vehicle-id'],
              }}
            />
          </Stack>

          {mode === 'edit' && (
            <Box mt={1}
              sx={{ borderTop: '1px solid rgba(0,0,0,0.08)', pt: 2 }}
            >
              <Typography variant="subtitle2" gutterBottom>
                ステータス
              </Typography>
              <RadioGroup
                row
                value={form.status}
                onChange={(e) => handleFieldChange('status', e.target.value as ScheduleStatus)}
                aria-label="ステータス選択"
              >
                {SCHEDULE_STATUS_OPTIONS.map((option) => (
                  <FormControlLabel
                    key={option.value}
                    value={option.value}
                    control={<Radio />}
                    label={option.label}
                  />
                ))}
              </RadioGroup>
              <TextField
                margin="dense"
                fullWidth
                label="ステータスの理由（任意）"
                value={form.statusReason}
                onChange={(e) => handleFieldChange('statusReason', e.target.value)}
                placeholder="例：本人の体調不良のため延期など"
                multiline
                minRows={2}
              />
            </Box>
          )}
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
          data-testid={submitTestId ?? TESTIDS['schedule-create-save']}
        >
            {submitting ? '保存中...' : primaryButtonLabel}
        </Button>
      </DialogActions>
      </Box>
    </Dialog>
  );
};

export default ScheduleCreateDialog;
