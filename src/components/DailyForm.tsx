import Autocomplete from '@mui/material/Autocomplete';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
// MUI Icons
import { useUsersStore } from '@/features/users/store';
import { useDaily } from '@/hooks/useDaily';
import { useToast } from '@/hooks/useToast';
import { isDevMode } from '@/lib/env';
import type { DailyStatus, DailyUpsert, SpDailyItem } from '@/types';
import { DAILY_STATUS_OPTIONS } from '@/types';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';

/**
 * Development environment detection helper
 */
const isDevEnvironment = (): boolean => isDevMode();

export type DailyFormMode = 'create' | 'edit';

type DailyFormInitial = {
  id?: number;
  title?: string | null;
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  staffId?: number | null;
  userId?: number | null;
  notes?: string | null;
  mealLog?: string | null;
  behaviorLog?: string | null;
  status?: string | null;
  etag?: string | null;
};

type DailyFormProps = {
  mode: DailyFormMode;
  initial?: DailyFormInitial;
  onDone?: (result: SpDailyItem) => void;
  prefillNotice?: string;
  prefillError?: string;
};

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

const toMinutes = (hhmm?: string | null) => {
  if (!hhmm) return null;
  const match = hhmm.match(/^([0-1]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

const sanitizeStatus = (value: string | null | undefined): DailyStatus | null => {
  if (!value) return null;
  return DAILY_STATUS_OPTIONS.includes(value as DailyStatus) ? (value as DailyStatus) : null;
};

const parseLookupId = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed.length) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toFormState = (source?: DailyFormInitial): DailyUpsert => ({
  title: source?.title ?? '',
  date: source?.date ?? '',
  startTime: source?.startTime ?? '',
  endTime: source?.endTime ?? '',
  location: source?.location ?? '',
  staffId: source?.staffId ?? null,
  userId: source?.userId ?? null,
  notes: source?.notes ?? '',
  mealLog: source?.mealLog ?? '',
  behaviorLog: source?.behaviorLog ?? '',
  status: sanitizeStatus(source?.status),
});

const toInitialFromItem = (item: SpDailyItem, etag?: string | null): DailyFormInitial => {
  const record = item as Record<string, unknown>;
  return {
    id: typeof item.Id === 'number' ? item.Id : undefined,
    title: item.Title ?? '',
    date: item.Date ?? null,
    startTime: item.StartTime ?? null,
    endTime: item.EndTime ?? null,
    location: item.Location ?? null,
    staffId: parseLookupId(item.StaffIdId ?? record.StaffId),
    userId: parseLookupId(item.UserIdId ?? record.UserId),
    notes: item.Notes ?? null,
    mealLog: item.MealLog ?? null,
    behaviorLog: item.BehaviorLog ?? null,
    status: typeof item.Status === 'string' ? item.Status : null,
    etag: typeof etag === 'string'
      ? etag
      : typeof record['__etag'] === 'string'
        ? (record['__etag'] as string)
        : null,
  };
};

export default function DailyForm({ mode, initial, onDone, prefillNotice, prefillError }: DailyFormProps) {
  const { createDaily, updateDaily, getDailyWithEtag } = useDaily();
  const { data: users, status } = useUsersStore();
  const usersLoading = status === 'loading';
  const { show } = useToast();

  const [form, setForm] = useState<DailyUpsert>(() => toFormState(initial));
  const [etag, setEtag] = useState<string | null>(() => initial?.etag ?? (initial as (DailyFormInitial & { __etag?: string | null }) | undefined)?.__etag ?? null);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitErrorType, setSubmitErrorType] = useState<'general' | 'time'>('general');

  // initial が変更されたときにフォームを更新（一覧から別レコードに切り替える場合など）
  useEffect(() => {
    setForm(toFormState(initial));
    const nextEtag = initial?.etag ?? (initial as (DailyFormInitial & { __etag?: string | null }) | undefined)?.__etag ?? null;
    setEtag(nextEtag);
  }, [initial]);

  const submitLabel = useMemo(() => (mode === 'create' ? '作成' : '更新'), [mode]);

  type UserOption = { id: number; name: string; code: string; active: boolean; initials: string };

  const userOptions = useMemo<UserOption[]>(() => {
    return (users ?? [])
      .map((user) => {
        const id = Number(user.Id);
        if (!Number.isFinite(id)) return null;
        const labelBase = user.FullName?.trim() ? user.FullName.trim() : '(無名)';
        const userCode = user.UserID?.trim() ? user.UserID.trim() : String(user.Id ?? id);
        return {
          id,
          name: labelBase,
          code: userCode,
          active: user.IsActive !== false,
          initials: labelBase.charAt(0).toUpperCase(),
        } satisfies UserOption;
      })
      .filter((option): option is UserOption => option !== null);
  }, [users]);

  const selectedUserOption = useMemo<UserOption | null>(() => {
    if (form.userId == null) return null;
    const id = Number(form.userId);
    if (!Number.isFinite(id)) return null;
    const matched = userOptions.find((option) => option.id === id);
    return matched ?? {
      id,
      name: `#${id}`,
      code: String(id),
      active: true,
      initials: '#',
    };
  }, [form.userId, userOptions]);

  const setField = useCallback((key: keyof DailyUpsert) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const rawValue = event.target.value;
    if (key === 'staffId') {
      const trimmed = rawValue.trim();
      if (!trimmed.length) {
        setForm((prev) => ({ ...prev, staffId: null }));
        return;
      }
      const parsed = Number(trimmed);
      setForm((prev) => ({
        ...prev,
        staffId: Number.isFinite(parsed) ? parsed : null,
      }));
      return;
    }
    if (key === 'status') {
      const trimmed = rawValue.trim();
      const next = DAILY_STATUS_OPTIONS.find((option) => option === trimmed) ?? null;
      setForm((prev) => ({
        ...prev,
        status: next,
      }));
      return;
    }
    setForm((prev) => ({
      ...prev,
      [key]: rawValue,
    }));
  }, []);

  const timeError = useMemo(() => {
    const start = form.startTime?.trim() || null;
    const end = form.endTime?.trim() || null;
    if (!start || !end) return null;
    const startMinutes = toMinutes(start);
    const endMinutes = toMinutes(end);
    if (startMinutes != null && endMinutes != null && endMinutes < startMinutes) {
      return '終了時刻は開始時刻より後の時間を選んでください';
    }
    return null;
  }, [form.startTime, form.endTime]);

  useEffect(() => {
    if (!timeError && submitErrorType === 'time' && submitError) {
      setSubmitError(null);
      setSubmitErrorType('general');
    }
  }, [timeError, submitError, submitErrorType]);

  useEffect(() => {
    if (mode !== 'edit') return;
    const next = initial?.etag ?? (initial as (DailyFormInitial & { __etag?: string | null }) | undefined)?.__etag ?? null;
    setEtag(next ?? null);
  }, [initial?.etag, initial?.id, mode]);

  const refreshLatestFromServer = useCallback(async (): Promise<{ ok: boolean; error?: string; etag?: string | null }> => {
    if (mode !== 'edit' || !initial?.id) {
      return { ok: false, error: '最新の内容を取得できませんでした。' };
    }
    try {
      const { item, etag: latestEtag } = await getDailyWithEtag(initial.id);
      const nextInitial = toInitialFromItem(item, latestEtag ?? null);
      setForm(toFormState(nextInitial));
      setEtag(nextInitial.etag ?? null);
      return { ok: true, etag: nextInitial.etag ?? null };
    } catch (error) {
      const message = error instanceof Error ? error.message : '最新の内容を取得できませんでした。';
      return { ok: false, error: message };
    }
  }, [getDailyWithEtag, initial?.id, mode]);

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = form.title?.trim() ?? '';
    if (!title) {
      setSubmitError('タイトルを入力してください');
      setSubmitErrorType('general');
      return;
    }
    const date = form.date?.trim() ?? '';
    if (date && !isoDatePattern.test(date)) {
      setSubmitError('日付は「YYYY-MM-DD」で入力してください');
      setSubmitErrorType('general');
      return;
    }

    if (timeError) {
      setSubmitError(timeError);
      setSubmitErrorType('time');
      return;
    }

    const payload: DailyUpsert = {
      ...form,
      title,
      date: date || '',
      startTime: form.startTime?.trim() || '',
      endTime: form.endTime?.trim() || '',
      location: form.location?.trim() || '',
      staffId: form.staffId ?? null,
      userId: form.userId ?? null,
      notes: form.notes?.trim() || '',
      mealLog: form.mealLog?.trim() || '',
      behaviorLog: form.behaviorLog?.trim() || '',
      status: form.status ?? null,
    };

    try {
      setBusy(true);
      setSubmitError(null);
      setSubmitErrorType('general');
      const rawResult = mode === 'create'
        ? await createDaily(payload)
        : await updateDaily(initial?.id ?? 0, payload, { etag });
      const savedItem = rawResult as SpDailyItem & { __etag?: string | null };
      if (mode === 'edit') {
        setEtag(savedItem.__etag ?? null);
        if (isDevEnvironment()) {
          console.debug('[daily-conflict] resolved and saved', {
            id: initial?.id ?? null,
            etag: savedItem.__etag ?? null,
          });
        }
      }
      show('success', '保存しました');
      onDone?.(savedItem);
    } catch (err) {
      const code = typeof err === 'object' && err && 'code' in err
        ? (err as { code?: string }).code
        : undefined;
      if (mode === 'edit' && code === 'conflict') {
        if (isDevEnvironment()) {
          console.debug('[daily-conflict] detected 412', {
            id: initial?.id ?? null,
            etag,
          });
        }
        const { ok, error: reloadError, etag: refreshedEtag } = await refreshLatestFromServer();
        if (ok && isDevEnvironment()) {
          console.debug('[daily-conflict] refetched latest', {
            id: initial?.id ?? null,
            etag: refreshedEtag ?? null,
          });
        }
          const baseMessage = ok
            ? '他のユーザーが先に更新しました。最新の内容を反映しました。内容を確認して再度保存してください。'
            : '他のユーザーが先に更新しました。ページを再読み込みして最新の内容を確認してください。';
        const message = reloadError ? `${baseMessage}\n詳細: ${reloadError}` : baseMessage;
        setSubmitError(message);
        setSubmitErrorType('general');
        show(ok ? 'warning' : 'error', baseMessage);
      } else {
        const message = err instanceof Error ? err.message : '保存に失敗しました。時間をおいて再度お試しください。';
        setSubmitError(message);
        setSubmitErrorType('general');
        show('error', message);
      }
    } finally {
      setBusy(false);
    }
  }, [createDaily, etag, form, initial?.id, mode, onDone, refreshLatestFromServer, show, timeError, updateDaily]);

  const isSubmitDisabled = busy || Boolean(timeError);
  const showGeneralError = submitError && submitErrorType === 'general';

  return (
    <form className="mx-auto flex w-full max-w-xl flex-col gap-4 rounded-md bg-white p-4 shadow" onSubmit={handleSubmit}>
      <header data-daily-toolbar="true" className="space-y-3">
        <h2 className="text-lg font-semibold">日次記録{mode === 'create' ? 'の作成' : 'の編集'}</h2>
        {prefillNotice ? (
          <div role="status" aria-live="polite" aria-atomic="true" className="text-xs text-gray-600">
            {prefillNotice}
          </div>
        ) : null}
        {prefillError ? (
          <div className="rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm text-yellow-900">
            {prefillError}
          </div>
        ) : null}
        {showGeneralError ? (
          <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{submitError}</div>
        ) : null}
        <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
          <ol className="list-decimal space-y-1 pl-5">
            <li>タイトルを入力</li>
            <li>日付・時間を入れる（終了は開始以降）</li>
            <li>担当スタッフ・利用者を選ぶ</li>
          </ol>
          <div className="mt-2 text-xs text-blue-800">
            保存すると一覧に戻ります。未確定なら「記録の状態：下書き」のままでOKです。
          </div>
        </div>
      </header>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-gray-700">タイトル</span>
        <input
          className="rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          value={form.title ?? ''}
          onChange={setField('title')}
          required
        />
      </label>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">日付</span>
          <input
            type="date"
            className="rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            value={form.date ?? ''}
            onChange={setField('date')}
          />
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700">開始時刻</span>
            <input
              type="time"
              className="rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={form.startTime ?? ''}
              onChange={setField('startTime')}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700">終了時刻</span>
            <input
              type="time"
              className="rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={form.endTime ?? ''}
              onChange={setField('endTime')}
            />
            {timeError && (
              <p className="mt-1 text-xs text-red-600">{timeError}</p>
            )}
          </label>
        </div>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-gray-700">場所</span>
        <input
          className="rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          value={form.location ?? ''}
          onChange={setField('location')}
          placeholder="例: 事業所"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-gray-700">利用者</span>
        <Autocomplete
          options={userOptions}
          value={selectedUserOption}
          onChange={(_, value) => {
            const previous = selectedUserOption;
            setForm((prev) => ({
              ...prev,
              userId: value?.id ?? null,
            }));
            if (value) {
              show('info', `担当を「${value.name}」に変更しました`);
            } else if (previous) {
              show('info', '担当を未設定に戻しました');
            }
          }}
          getOptionLabel={(option) => `${option.name}（${option.code}）`}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          groupBy={(option) => (option.active ? '在籍' : '退所')}
          loading={usersLoading}
          loadingText="読み込み中…"
          fullWidth
          renderOption={(props, option) => (
            <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar sx={{ width: 28, height: 28, fontSize: 14 }}>{option.initials}</Avatar>
              <div className="flex flex-col">
                <span className="font-medium text-gray-900">{option.name}</span>
                <span className="text-xs text-gray-500">ID: {option.code}</span>
              </div>
            </Box>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              size="small"
              label="利用者（氏名で検索）"
              placeholder="氏名の一部を入力（例：さかもと）"
              helperText="在籍/退所でグループ分けしています"
              InputProps={{
                ...params.InputProps,
                startAdornment: selectedUserOption ? (
                  <Avatar sx={{ width: 28, height: 28, fontSize: 14, mr: 1 }}>
                    {selectedUserOption.initials}
                  </Avatar>
                ) : params.InputProps.startAdornment,
              }}
            />
          )}
          clearOnEscape
          disablePortal
          noOptionsText="該当なし"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-gray-700">担当スタッフ（数値ID）</span>
        <input
          className="rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          value={form.staffId ?? ''}
          onChange={setField('staffId')}
          placeholder="例：101"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-gray-700">メモ</span>
        <textarea
          className="min-h-[100px] rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          value={form.notes ?? ''}
          onChange={setField('notes')}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-gray-700">食事ログ</span>
        <textarea
          className="min-h-[80px] rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          value={form.mealLog ?? ''}
          onChange={setField('mealLog')}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-gray-700">行動ログ</span>
        <textarea
          className="min-h-[80px] rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          value={form.behaviorLog ?? ''}
          onChange={setField('behaviorLog')}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-gray-700">記録の状態</span>
        <select
          className="rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          value={form.status ?? ''}
          onChange={setField('status')}
        >
          <option value="">（未指定）</option>
          {DAILY_STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-gray-700">ドラフト JSON（任意）</span>
        <textarea
          className="min-h-[80px] rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          value={('draft' in form && typeof form.draft === 'string') ? form.draft : ''}
          onChange={(event) => {
            const value = event.target.value;
            setForm((prev) => ({
              ...prev,
              draft: value,
            }));
          }}
          placeholder='例: {"memos": []}'
        />
      </label>

      <Box sx={{ mt: 3 }}>
        <Button
          type="submit"
          variant="contained"
          size="large"
          startIcon={mode === 'create' ? <SaveRoundedIcon /> : <EditRoundedIcon />}
          disabled={isSubmitDisabled}
          fullWidth
          sx={{ mb: 1 }}
        >
          {submitLabel}
        </Button>
        <Typography variant="caption" color="text.secondary" display="block" textAlign="center">
          保存すると一覧画面に戻ります。
        </Typography>
      </Box>
    </form>
  );
}
