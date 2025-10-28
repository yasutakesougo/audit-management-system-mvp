import type { CloneStrategy, ScheduleCloneDraft } from '@/features/schedule/clone';
import { STATUS_DEFAULT, STATUS_LABELS, normalizeStatus } from '@/features/schedule/statusDictionary';
import { SCHEDULE_STATUSES, type Status } from '@/features/schedule/types';
import { useUsersStore } from '@/features/users/store';
import { useToast } from '@/hooks/useToast';
import { createSchedule, useSP } from '@/lib/spClient';
import { formatInTimeZone, fromZonedTime } from '@/lib/tz';
import { SCHEDULE_FIELD_SERVICE_TYPE } from '@/sharepoint/fields';
import { useStaff } from '@/stores/useStaff';
import type { Staff, User } from '@/types';
import { formatRangeLocal } from '@/utils/datetime';
import { MessageBar, MessageBarType } from '@fluentui/react';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';
import { addDays, addMinutes, differenceInMinutes } from 'date-fns';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const TIMEZONE = 'Asia/Tokyo';
const ROUND_STEP_MINUTES = 5;
const DEFAULT_DURATION_MINUTES = 60;
const MIN_DURATION_MINUTES = 15;

const statusOptions: { value: Status; label: string }[] = SCHEDULE_STATUSES.map((status) => ({
  value: status,
  label: STATUS_LABELS[status],
}));

type FormState = {
  title: string;
  allDay: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  location: string;
  notes: string;
  status: Status;
  staffId: number | null;
  userId: number | null;
  serviceType: string;
  usesVehicle: boolean;
};

type FormErrors = Partial<Record<keyof FormState, string>> & { general?: string };

type ScheduleCloneState = {
  draft?: ScheduleCloneDraft;
  sourceId?: number;
  strategy?: CloneStrategy;
};

type ResolvedRange = {
  startUtc: string | null;
  endUtc: string | null;
  start: Date | null;
  end: Date | null;
};

const formatDateInput = (date: Date) => formatInTimeZone(date, TIMEZONE, 'yyyy-MM-dd');
const formatTimeInput = (date: Date) => formatInTimeZone(date, TIMEZONE, 'HH:mm');

const roundUpToStep = (date: Date, minutes: number) => {
  const result = new Date(date);
  result.setSeconds(0, 0);
  const remainder = result.getMinutes() % minutes;
  if (remainder !== 0) {
    result.setMinutes(result.getMinutes() + (minutes - remainder));
  }
  return result;
};

const buildDefaultForm = (): FormState => {
  const now = new Date();
  const start = roundUpToStep(now, ROUND_STEP_MINUTES);
  const end = addMinutes(start, DEFAULT_DURATION_MINUTES);
  return {
    title: '',
    allDay: false,
    startDate: formatDateInput(start),
    startTime: formatTimeInput(start),
    endDate: formatDateInput(end),
    endTime: formatTimeInput(end),
    location: '',
    notes: '',
    status: STATUS_DEFAULT,
    staffId: null,
    userId: null,
    serviceType: '',
    usesVehicle: false,
  };
};

const buildFormFromDraft = (draft: ScheduleCloneDraft): FormState => {
  const start = new Date(draft._initial.startLocalISO);
  const end = new Date(draft._initial.endLocalISO);
  const isAllDay = draft._initial.allDay;
  return {
    title: draft.title ?? '',
    allDay: isAllDay,
    startDate: formatDateInput(start),
    startTime: isAllDay ? '00:00' : formatTimeInput(start),
    endDate: formatDateInput(end),
    endTime: isAllDay ? '00:00' : formatTimeInput(end),
    location: draft.location ?? '',
    notes: draft.notes ?? '',
    status: normalizeStatus(draft.status),
    staffId: null,
    userId: null,
    serviceType: '',
    usesVehicle: false,
  };
};

const ensureEndDateForAllDay = (startDate: string, endDate: string): string => {
  if (!startDate) return endDate;
  if (!endDate) return startDate;
  return endDate < startDate ? startDate : endDate;
};

const resolveRange = (form: FormState): ResolvedRange => {
  if (!form.startDate) {
    return { startUtc: null, endUtc: null, start: null, end: null };
  }

  const startTime = form.allDay ? '00:00' : form.startTime;
  if (!startTime) {
    return { startUtc: null, endUtc: null, start: null, end: null };
  }

  try {
    const startLocalIso = `${form.startDate}T${startTime}`;
  const startDateUtc = fromZonedTime(startLocalIso, TIMEZONE);

    let endDateLocal = form.endDate || form.startDate;
    let endTime = form.allDay ? '00:00' : form.endTime;
    if (form.allDay) {
      endDateLocal = ensureEndDateForAllDay(form.startDate, form.endDate);
      endTime = '00:00';
    }
    if (!endDateLocal || !endTime) {
      return { startUtc: null, endUtc: null, start: null, end: null };
    }
    const endLocalIso = `${endDateLocal}T${endTime}`;
    let endDateUtc = fromZonedTime(endLocalIso, TIMEZONE);

    if (form.allDay) {
      const minEndUtc = addDays(fromZonedTime(`${form.startDate}T00:00`, TIMEZONE), 1);
      if (endDateUtc.getTime() <= minEndUtc.getTime()) {
        endDateUtc = minEndUtc;
      }
    }

    return {
      startUtc: startDateUtc.toISOString(),
      endUtc: endDateUtc.toISOString(),
      start: startDateUtc,
      end: endDateUtc,
    };
  } catch {
    return { startUtc: null, endUtc: null, start: null, end: null };
  }
};

const validateForm = (form: FormState): FormErrors => {
  const errors: FormErrors = {};
  if (!form.title.trim()) {
    errors.title = 'タイトルを入力してください';
  }
  if (!form.startDate) {
    errors.startDate = '開始日を入力してください';
  }
  if (!form.allDay && !form.startTime) {
    errors.startTime = '開始時刻を入力してください';
  }
  if (!form.endDate) {
    errors.endDate = '終了日を入力してください';
  }
  if (!form.allDay && !form.endTime) {
    errors.endTime = '終了時刻を入力してください';
  }

  if ((form.usesVehicle || form.serviceType === '送迎') && (form.staffId == null || Number.isNaN(form.staffId))) {
    errors.staffId = '車両利用時は担当職員を選択してください';
  }

  const { start, end } = resolveRange(form);
  if (start && end) {
    if (end.getTime() <= start.getTime()) {
      errors.endTime = '終了は開始より後の時間を指定してください';
    } else if (!form.allDay) {
      const durationMinutes = differenceInMinutes(end, start);
      if (durationMinutes < MIN_DURATION_MINUTES) {
        errors.endTime = `終了は開始から${MIN_DURATION_MINUTES}分以上後に設定してください`;
      }
    }
  }

  return errors;
};

const describeStrategy = (strategy?: CloneStrategy): string | null => {
  if (!strategy) return null;
  if (strategy === 'today') return '今日の時間割に合わせて複製しました。';
  if (strategy === 'nextWeekday') return '次の平日に合わせて複製しました。';
  return null;
};

export default function ScheduleCreatePage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const sp = useSP();
  const { show } = useToast();
  const { data: staff, loading: staffLoading, error: staffError } = useStaff();
  const { data: users, status, error: usersError } = useUsersStore();
  const usersLoading = status === 'loading';

  const locationState = (state ?? {}) as ScheduleCloneState;
  const draft = locationState.draft;
  const initialForm = useMemo(() => (draft ? buildFormFromDraft(draft) : buildDefaultForm()), [draft]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const lastTimedRangeRef = useRef<{ startTime: string; endTime: string }>({ startTime: '', endTime: '' });

  useEffect(() => {
    if (draft) {
      setForm(buildFormFromDraft(draft));
      setErrors({});
      setSubmitError(null);
    }
  }, [draft]);

  const handleFieldChange = useCallback(
    (field: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const handleStatusChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value as FormState['status'];
    setForm((prev) => ({ ...prev, status: value }));
  }, []);

  const handleAllDayChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const nextAllDay = event.target.checked;
    setForm((prev) => {
      if (nextAllDay) {
        lastTimedRangeRef.current = {
          startTime: prev.startTime,
          endTime: prev.endTime,
        };
        return {
          ...prev,
          allDay: true,
          startTime: '00:00',
          endTime: '00:00',
          endDate: ensureEndDateForAllDay(prev.startDate, prev.endDate),
        };
      }
      const fallbackStart = lastTimedRangeRef.current.startTime || '09:00';
      const fallbackEnd = lastTimedRangeRef.current.endTime || '10:00';
      return {
        ...prev,
        allDay: false,
        startTime: fallbackStart,
        endTime: fallbackEnd,
      };
    });
  }, []);

  const handleStaffChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    setForm((prev) => ({
      ...prev,
      staffId: nextValue === '' ? null : Number(nextValue),
    }));
  }, []);

  const handleUserSelect = useCallback((_: unknown, option: User | null) => {
    setForm((prev) => ({
      ...prev,
      userId: option ? option.id : null,
    }));
  }, []);

  const handleServiceTypeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    setForm((prev) => ({ ...prev, serviceType: nextValue }));
  }, []);

  const handleUsesVehicleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const nextChecked = event.target.checked;
    setForm((prev) => ({ ...prev, usesVehicle: nextChecked }));
  }, []);

  const resolvedRange = useMemo(() => resolveRange(form), [form]);

  const previewText = useMemo(() => {
    if (!resolvedRange.startUtc || !resolvedRange.endUtc) return '日時を入力するとプレビューが表示されます';
    return formatRangeLocal(resolvedRange.startUtc, resolvedRange.endUtc, { roundTo: ROUND_STEP_MINUTES, tz: TIMEZONE });
  }, [resolvedRange]);

  const staffOptions = useMemo(() => {
    if (!Array.isArray(staff)) return [] as Staff[];
    return staff.slice().sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  }, [staff]);

  const userOptions = useMemo(() => {
    if (!Array.isArray(users)) return [] as User[];
    return users.slice().sort((a, b) => {
      const ax = a.Furigana || a.FullNameKana || a.FullName || a.UserID;
      const bx = b.Furigana || b.FullNameKana || b.FullName || b.UserID;
      return ax.localeCompare(bx, 'ja');
    });
  }, [users]);

  const selectedStaff = useMemo(() => {
    if (form.staffId == null) return null;
    return staffOptions.find((candidate) => candidate.id === form.staffId) ?? null;
  }, [form.staffId, staffOptions]);

  const selectedUser = useMemo(() => {
    if (form.userId == null) return null;
    return userOptions.find((candidate) => {
      // IUserMaster型の場合
      if ('Id' in candidate) {
        return candidate.Id === form.userId;
      }
      // User型の場合
      return candidate.id === form.userId;
    }) ?? null;
  }, [form.userId, userOptions]);

  const requiresDrivingLicense = form.usesVehicle || form.serviceType === '送迎';

  const lacksDrivingLicense = useMemo(() => {
    if (!requiresDrivingLicense || !selectedStaff) return false;
    return !(selectedStaff.certifications ?? []).some((cert) => cert.trim() === '普通運転免許');
  }, [requiresDrivingLicense, selectedStaff]);

  const prefillNotice = useMemo(() => {
    if (!draft) return null;
    const sourceId = locationState.sourceId ? `#${locationState.sourceId}` : '複製元';
    const strategyDescription = describeStrategy(locationState.strategy);
    return [
      `${sourceId} の予定を複製しています。基準: ${draft._initial.preview}`,
      strategyDescription ?? undefined,
    ].filter(Boolean).join(' ');
  }, [draft, locationState.sourceId, locationState.strategy]);

  const handleSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    const validation = validateForm(form);
    setErrors(validation);
    const hasFieldErrors = Object.entries(validation).some(([key, value]) => key !== 'general' && Boolean(value));
    if (hasFieldErrors) {
      return;
    }

    const { startUtc, endUtc } = resolveRange(form);
    if (!startUtc || !endUtc) {
      setErrors((prev) => ({ ...prev, general: '日時の指定が正しくありません。' }));
      return;
    }

    const staffLookupId = typeof form.staffId === 'number' && Number.isFinite(form.staffId) ? form.staffId : null;
    const userLookupId = typeof form.userId === 'number' && Number.isFinite(form.userId) ? form.userId : null;
    const serviceTypeValue = form.serviceType.trim();

    const payload = {
      Title: form.title.trim(),
      EventDate: startUtc,
      EndDate: endUtc,
      AllDay: form.allDay,
      Location: form.location.trim() || null,
      Status: form.status,
      Notes: form.notes.trim() || null,
      StaffIdId: staffLookupId,
      UserIdId: userLookupId,
      [SCHEDULE_FIELD_SERVICE_TYPE]: serviceTypeValue || null,
    } as const;

    try {
      setSubmitting(true);
      setErrors({});
      await createSchedule(sp, payload);
      show('success', '予定を作成しました');
      navigate('/schedule', { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存に失敗しました。時間をおいて再実行してください。';
      setSubmitError(message);
      show('error', message);
    } finally {
      setSubmitting(false);
    }
  }, [form, navigate, show, sp]);

  return (
    <Box component="main" className="p-4">
      <Stack spacing={3} maxWidth={640} margin="0 auto">
        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            startIcon={<ArrowBackRoundedIcon />}
            variant="text"
            onClick={() => navigate(-1)}
            disabled={submitting}
          >
            戻る
          </Button>
          <Typography component="h1" variant="h5" fontWeight={600} marginLeft={0.5}>
            予定の新規作成
          </Typography>
        </Stack>

        {prefillNotice ? (
          <Alert severity="info" data-testid="schedule-prefill-notice">
            {prefillNotice}
          </Alert>
        ) : (
          <Alert severity="info">
            新しい予定を一から登録します。開始と終了の日時を入力してください。
          </Alert>
        )}

        {submitError ? (
          <Alert severity="error" role="alert">
            {submitError}
          </Alert>
        ) : null}

        {errors.general ? (
          <Alert severity="warning" role="alert">
            {errors.general}
          </Alert>
        ) : null}

        <Paper elevation={1}>
          <Box component="form" padding={3} display="flex" flexDirection="column" gap={2.5} onSubmit={handleSubmit}>
            <TextField
              label="タイトル"
              value={form.title}
              onChange={handleFieldChange('title')}
              required
              fullWidth
              autoComplete="off"
              error={Boolean(errors.title)}
              helperText={errors.title ?? '予定の名称を入力してください'}
            />

            <FormControlLabel
              control={<Switch checked={form.allDay} onChange={handleAllDayChange} />}
              label="終日イベント"
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="開始日"
                type="date"
                value={form.startDate}
                onChange={handleFieldChange('startDate')}
                InputLabelProps={{ shrink: true }}
                fullWidth
                error={Boolean(errors.startDate)}
                helperText={errors.startDate ?? undefined}
              />
              <TextField
                label="開始時刻"
                type="time"
                value={form.startTime}
                onChange={handleFieldChange('startTime')}
                InputLabelProps={{ shrink: true }}
                fullWidth
                disabled={form.allDay}
                error={Boolean(errors.startTime)}
                helperText={form.allDay ? '終日の場合は自動的に00:00になります' : errors.startTime ?? undefined}
              />
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="終了日"
                type="date"
                value={form.endDate}
                onChange={handleFieldChange('endDate')}
                InputLabelProps={{ shrink: true }}
                fullWidth
                error={Boolean(errors.endDate)}
                helperText={errors.endDate ?? undefined}
              />
              <TextField
                label="終了時刻"
                type="time"
                value={form.endTime}
                onChange={handleFieldChange('endTime')}
                InputLabelProps={{ shrink: true }}
                fullWidth
                disabled={form.allDay}
                error={Boolean(errors.endTime)}
                helperText={form.allDay ? '終日の場合は終了日までを終日扱いで保存します' : errors.endTime ?? `終了は開始から${MIN_DURATION_MINUTES}分以上後が必要です`}
              />
            </Stack>

            <TextField
              label="場所"
              value={form.location}
              onChange={handleFieldChange('location')}
              fullWidth
              placeholder="会議室や訪問先など"
            />

            <TextField
              select
              label="サービス種別"
              value={form.serviceType}
              onChange={handleServiceTypeChange}
              fullWidth
              helperText="送迎を選択すると車両利用の警告が有効になります"
            >
              <MenuItem value="">未選択</MenuItem>
              <MenuItem value="送迎">送迎</MenuItem>
              <MenuItem value="訪問支援">訪問支援</MenuItem>
              <MenuItem value="内勤">内勤</MenuItem>
              <MenuItem value="外出支援">外出支援</MenuItem>
            </TextField>

            <Autocomplete<User, false, false, false>
              options={userOptions as User[]}
              value={selectedUser as User | null}
              onChange={handleUserSelect}
              loading={usersLoading}
              noOptionsText={usersLoading ? '読み込み中…' : '該当する利用者が見つかりません'}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              getOptionLabel={(option) => {
                const name = option.name || '氏名未登録';
                const code = option.userId || `ID:${option.id}`;
                return `${name}（${code}）`;
              }}
              renderInput={(params) => {
                params.inputProps.autoComplete = 'off';
                return (
                  <TextField
                    {...params}
                    label="利用者"
                    placeholder="氏名 / UserID を入力すると絞り込めます"
                    error={Boolean(usersError)}
                    helperText={
                      usersError
                        ? `利用者リストの取得に失敗しました: ${String(usersError)}`
                        : selectedUser
                          ? '対象の利用者を選択しました'
                          : '対象の利用者を選択してください'
                    }
                  />
                );
              }}
            />

            <FormControlLabel
              control={<Switch checked={form.usesVehicle} onChange={handleUsesVehicleChange} />}
              label="使用車両が必要"
            />

            <TextField
              select
              label="担当職員"
              value={form.staffId == null ? '' : String(form.staffId)}
              onChange={handleStaffChange}
              fullWidth
              disabled={staffLoading || Boolean(staffError)}
              error={Boolean(errors.staffId)}
              helperText={
                staffError
                  ? `職員情報の取得に失敗しました: ${staffError.message}`
                  : errors.staffId ?? '担当する職員を選択してください'
              }
            >
              <MenuItem value="">未選択</MenuItem>
              {staffOptions.map((member) => (
                <MenuItem key={member.id} value={String(member.id)}>
                  {member.name}
                  {member.certifications.length ? `（${member.certifications.join('、')}）` : ''}
                </MenuItem>
              ))}
            </TextField>

            {requiresDrivingLicense && lacksDrivingLicense && selectedStaff ? (
              <MessageBar
                messageBarType={MessageBarType.warning}
                isMultiline
                styles={{
                  root: {
                    backgroundColor: '#FFF8E1',
                    borderRadius: 8,
                    padding: '12px 16px',
                  },
                }}
                role="alert"
              >
                <div className="flex items-start gap-2 text-sm text-amber-900">
                  <WarningAmberIcon fontSize="small" className="mt-0.5" />
                  <div>
                    <p className="font-semibold">普通運転免許が未登録です</p>
                    <p>
                      {selectedStaff.name} さんには「普通運転免許」の資格が登録されていません。車両を利用する予定の場合は、別の職員を割り当てるか、資格情報を更新してください。
                    </p>
                  </div>
                </div>
              </MessageBar>
            ) : null}

            <TextField
              label="メモ"
              value={form.notes}
              onChange={handleFieldChange('notes')}
              fullWidth
              multiline
              minRows={3}
              placeholder="詳細や持ち物などをメモできます"
            />

            <TextField
              select
              label="状態"
              value={form.status}
              onChange={handleStatusChange}
              fullWidth
            >
              {statusOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>

            <Box role="status" aria-live="polite" data-testid="schedule-preview" sx={{ fontSize: 14, color: 'text.secondary' }}>
              プレビュー: {previewText}
            </Box>

            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button
                type="submit"
                variant="contained"
                color="primary"
                startIcon={<SaveRoundedIcon />}
                disabled={submitting}
              >
                {submitting ? '保存中…' : '保存'}
              </Button>
            </Stack>
          </Box>
        </Paper>
      </Stack>
    </Box>
  );
}
