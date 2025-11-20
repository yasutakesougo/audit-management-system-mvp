import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { startOfWeek, format as formatDate } from 'date-fns';
import { useCallback, useEffect, useMemo, useState } from 'react';
// Schedule View Icons
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import CalendarViewWeekRoundedIcon from '@mui/icons-material/CalendarViewWeekRounded';
import ListAltRoundedIcon from '@mui/icons-material/ListAltRounded';
import NavigateBeforeRoundedIcon from '@mui/icons-material/NavigateBeforeRounded';
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import TodayRoundedIcon from '@mui/icons-material/TodayRounded';

import { useAuth } from '@/auth/useAuth';
import { ScheduleCreateDialog, type CreateScheduleEventInput, type ScheduleFormState, type ScheduleServiceType, type ScheduleUserOption } from '@/features/schedules/ScheduleCreateDialog';
import { useUsersStore } from '@/features/users/store';
import { useSnackbarHost } from '@/features/nurse/components/SnackbarHost';
import BriefingPanel from '@/features/schedule/components/BriefingPanel';
import { assignLocalDateKey } from '@/features/schedule/dateutils.local';
import { moveScheduleToDay } from '@/features/schedule/move';
import ScheduleDialog from '@/features/schedule/ScheduleDialog';
import type { ExtendedScheduleForm, Schedule, ScheduleOrg, ScheduleStaff, ScheduleStatus, ScheduleUserCare, Status } from '@/features/schedule/types';
import ScheduleListView from '@/features/schedule/views/ListView';
import MonthView from '@/features/schedule/views/MonthView';
import OrgTab from '@/features/schedule/views/OrgTab';
import StaffTab from '@/features/schedule/views/StaffTab';
import TimelineDay from '@/features/schedule/views/TimelineDay';
import TimelineWeek, { type EventMovePayload } from '@/features/schedule/views/TimelineWeek';
import UserTab from '@/features/schedule/views/UserTab';
import { getAppConfig } from '@/lib/env';
import { useSP } from '@/lib/spClient';
import { useStaff } from '@/stores/useStaff';
import { TESTIDS } from '@/testids';
import FilterToolbar from '@/ui/filters/FilterToolbar';
import { formatRangeLocal } from '@/utils/datetime';
import { useEnsureScheduleList } from './ensureScheduleList';
import { createUserCare, getUserCareSchedules, updateUserCare } from './spClient.schedule';
import { createOrgSchedule, getOrgSchedules, updateOrgSchedule } from './spClient.schedule.org';
import { createStaffSchedule, getStaffSchedules, updateStaffSchedule } from './spClient.schedule.staff';
import { buildStaffPatternIndex, collectBaseShiftWarnings } from './workPattern';

type ViewMode = 'month' | 'week' | 'day' | 'list' | 'userCare';

type RangeState = {
  start: Date;
  end: Date;
};

const DIALOG_TO_DOMAIN_STATUS: Record<ScheduleStatus, Status> = {
  planned: '下書き',
  confirmed: '承認済み',
  absent: '申請中',
  holiday: '完了',
};

const DOMAIN_TO_DIALOG_STATUS: Record<Status, ScheduleStatus> = {
  下書き: 'planned',
  申請中: 'planned',
  承認済み: 'confirmed',
  完了: 'confirmed',
};

const QUICK_SERVICE_TYPE_LABELS: Record<ScheduleServiceType, ScheduleUserCare['serviceType']> = {
  normal: '通常利用',
  transport: '送迎',
  respite: '一時ケア・短期',
  nursing: '看護',
  absence: '欠席・休み',
  other: 'その他',
};

const QUICK_SERVICE_TYPE_BY_LABEL: Record<string, ScheduleServiceType> = Object.entries(QUICK_SERVICE_TYPE_LABELS).reduce(
  (acc, [key, label]) => {
    acc[label] = key as ScheduleServiceType;
    return acc;
  },
  {} as Record<string, ScheduleServiceType>
);

const toDomainStatus = (status: ScheduleStatus | undefined): Status => DIALOG_TO_DOMAIN_STATUS[status ?? 'planned'];

const toDialogStatus = (status: Status | undefined): ScheduleStatus => DOMAIN_TO_DIALOG_STATUS[status ?? '下書き'];

const toNumericId = (id?: string | number): number | undefined => {
  if (typeof id === 'number' && Number.isFinite(id)) {
    return Math.trunc(id);
  }
  if (typeof id === 'string') {
    const parsed = Number(id);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }
  return undefined;
};

const scheduleToExtendedForm = (schedule: Schedule): ExtendedScheduleForm => {
  const base: ExtendedScheduleForm = {
    category: schedule.category,
    id: toNumericId(schedule.id),
    title: schedule.title ?? '',
    note: schedule.notes ?? '',
    status: toDialogStatus(schedule.status),
    start: schedule.start,
    end: schedule.end,
    allDay: schedule.allDay,
    location: schedule.location ?? '',
  };

  if (schedule.category === 'User') {
    return {
      ...base,
      userId: schedule.personId ?? '',
      serviceType: schedule.serviceType,
      personType: schedule.personType,
      personId: schedule.personId,
      personName: schedule.personName,
      externalPersonName: schedule.externalPersonName,
      externalPersonOrg: schedule.externalPersonOrg,
      externalPersonContact: schedule.externalPersonContact,
      staffIds: [...schedule.staffIds],
      staffNames: schedule.staffNames ? [...schedule.staffNames] : undefined,
    } satisfies ExtendedScheduleForm;
  }

  if (schedule.category === 'Org') {
    return {
      ...base,
      subType: schedule.subType,
      audience: schedule.audience ? [...schedule.audience] : undefined,
      resourceId: schedule.resourceId,
      externalOrgName: schedule.externalOrgName,
    } satisfies ExtendedScheduleForm;
  }

  return {
    ...base,
    subType: schedule.subType,
    staffIds: [...schedule.staffIds],
    staffNames: schedule.staffNames ? [...schedule.staffNames] : undefined,
    dayPart: schedule.dayPart,
  } satisfies ExtendedScheduleForm;
};

export default function SchedulePage() {
  const { account } = useAuth();
  const sp = useSP();
  const snackbarHost = useSnackbarHost();
  const showSnackbar = snackbarHost.show;
  const snackbarUi = snackbarHost.ui;
  useEnsureScheduleList(sp);
  const { data: staffData } = useStaff();
  const { data: usersData } = useUsersStore();
  const [dialogEditing, setDialogEditing] = useState<Schedule | null>(null);
  const [view, setView] = useState<ViewMode>('week');
  const [query, setQuery] = useState('');
  const [range, setRange] = useState<RangeState>(() => {
    const now = new Date();
    // 月曜始まりの今週を設定
    const start = startOfWeek(now, { weekStartsOn: 1 });
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    return { start, end };
  });
  const [timelineEvents, setTimelineEvents] = useState<Schedule[]>([]);
  const [timelineLoading, setTimelineLoading] = useState<boolean>(false);
  const [timelineError, setTimelineError] = useState<Error | null>(null);

  // Schedule Dialog States
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInitial, setDialogInitial] = useState<ExtendedScheduleForm | undefined>(undefined);
  const [quickDialogOpen, setQuickDialogOpen] = useState(false);
  const [quickDialogInitialDate, setQuickDialogInitialDate] = useState<Date | null>(null);
  const [quickDialogMode, setQuickDialogMode] = useState<'create' | 'edit'>('create');
  const [quickDialogOverride, setQuickDialogOverride] = useState<Partial<ScheduleFormState> | null>(null);
  const [quickDialogEditingSchedule, setQuickDialogEditingSchedule] = useState<ScheduleUserCare | null>(null);
  const [lastQuickUserId, setLastQuickUserId] = useState<string | undefined>(undefined);

  const staffNameMap = useMemo(() => {
    const map = new Map<string, string>();
    if (Array.isArray(staffData)) {
      for (const staff of staffData) {
        if (!staff) continue;
        const key = staff.id != null ? String(staff.id) : (staff.staffId ?? '').trim();
        if (!key) continue;
        const name = staff.name?.trim() ?? staff.staffId?.trim() ?? key;
        map.set(key, name);
      }
    }
    return map;
  }, [staffData]);

  const defaultStaffId = useMemo(() => {
    if (!Array.isArray(staffData) || !staffData.length) return undefined;
    const candidates = new Set<string>();
    const pushCandidate = (raw: unknown) => {
      if (typeof raw !== 'string') return;
      const trimmed = raw.trim();
      if (!trimmed) return;
      candidates.add(trimmed.toLowerCase());
    };

    pushCandidate((account as { username?: string } | undefined)?.username);
    pushCandidate((account as { name?: string } | undefined)?.name);
    const idTokenClaims = (account as { idTokenClaims?: Record<string, unknown> } | undefined)?.idTokenClaims;
    if (idTokenClaims) {
      pushCandidate((idTokenClaims as { email?: string }).email);
      pushCandidate((idTokenClaims as { preferred_username?: string }).preferred_username);
      pushCandidate((idTokenClaims as { upn?: string }).upn);
    }

    if (!candidates.size) return undefined;

    const normalize = (value: unknown) => (typeof value === 'string' ? value.trim().toLowerCase() : undefined);

    for (const staff of staffData) {
      if (!staff) continue;
      const email = normalize(staff.email);
      const staffCode = normalize(staff.staffId);
      const name = normalize(staff.name);
      if ((email && candidates.has(email)) || (staffCode && candidates.has(staffCode)) || (name && candidates.has(name))) {
        const key = staff.id != null ? String(staff.id) : (staff.staffId ?? '').trim();
        if (key) {
          return key;
        }
      }
    }

    return undefined;
  }, [account, staffData]);

  const defaultUserStaffIds = useMemo(() => (defaultStaffId ? [defaultStaffId] : []), [defaultStaffId]);

  const defaultUserStaffNames = useMemo(() => {
    if (!defaultStaffId) return undefined;
    const name = staffNameMap.get(defaultStaffId)?.trim();
    return name ? [name] : undefined;
  }, [defaultStaffId, staffNameMap]);

  const scheduleUserOptions = useMemo<ScheduleUserOption[]>(() => {
    if (!Array.isArray(usersData)) return [];
    return usersData
      .map((user) => {
        if (!user) return null;
        const userId = typeof user.UserID === 'string' && user.UserID.trim().length
          ? user.UserID.trim()
          : (user.Id != null ? String(user.Id).trim() : '');
        const name = (user.FullName ?? '').trim() || (userId ? `利用者 ${userId}` : '');
        if (!userId || !name) {
          return null;
        }
        return { id: userId, name } satisfies ScheduleUserOption;
      })
      .filter((option): option is ScheduleUserOption => Boolean(option));
  }, [usersData]);

  const scheduleUserMap = useMemo(() => {
    const map = new Map<string, ScheduleUserOption>();
    for (const option of scheduleUserOptions) {
      map.set(option.id, option);
    }
    return map;
  }, [scheduleUserOptions]);

  const defaultQuickUser = useMemo(() => {
    if (!scheduleUserOptions.length) return null;
    if (lastQuickUserId) {
      return scheduleUserOptions.find((option) => option.id === lastQuickUserId) ?? scheduleUserOptions[0];
    }
    return scheduleUserOptions[0];
  }, [scheduleUserOptions, lastQuickUserId]);


  const staffPatterns = useMemo(() => buildStaffPatternIndex(staffData), [staffData]);

  const buildUserCarePayload = useCallback((form: ExtendedScheduleForm, base?: ScheduleUserCare): ScheduleUserCare => {
    if (!form.start || !form.end) {
      throw new Error('開始と終了の日時を入力してください。');
    }

    const staffIds = (form.staffIds ?? base?.staffIds ?? [])
      .map((id) => String(id).trim())
      .filter((id) => id.length > 0);

    const staffNamesFromForm = (form.staffNames ?? [])
      .map((name) => (name ?? '').trim())
      .filter((name) => name.length > 0);

    const staffNamesFromLookup = staffIds
      .map((id) => (staffNameMap.get(id) ?? '').trim())
      .filter((name) => name.length > 0);

    const hasTitleInput = form.title !== undefined;
    const rawTitle = (form.title ?? '').trim();
    const title = hasTitleInput ? rawTitle : (base?.title ?? '');
    const location = (form.location ?? '').trim();
    const note = (form.note ?? '').trim();

    const personType = (form.personType ?? base?.personType ?? 'Internal') as ScheduleUserCare['personType'];
    const serviceType = (form.serviceType ?? base?.serviceType ?? '一時ケア') as ScheduleUserCare['serviceType'];

    return {
      id: base?.id ?? '',
      etag: base?.etag ?? '',
      category: 'User',
      title,
      start: form.start,
      end: form.end,
      allDay: Boolean(form.allDay),
      status: toDomainStatus(form.status),
      location: location.length ? location : undefined,
      notes: note.length ? note : undefined,
      recurrenceRule: base?.recurrenceRule,
      dayKey: base?.dayKey,
      fiscalYear: base?.fiscalYear,
      serviceType,
      personType,
      personId: personType === 'Internal' ? (form.personId ?? form.userId ?? base?.personId) ?? undefined : undefined,
      personName: personType === 'Internal' ? (form.personName ?? base?.personName) ?? undefined : undefined,
      externalPersonName: personType === 'External' ? (form.externalPersonName ?? base?.externalPersonName) ?? undefined : undefined,
      externalPersonOrg: personType === 'External' ? (form.externalPersonOrg ?? base?.externalPersonOrg) ?? undefined : undefined,
      externalPersonContact: personType === 'External' ? (form.externalPersonContact ?? base?.externalPersonContact) ?? undefined : undefined,
      staffIds,
      staffNames: staffNamesFromForm.length ? staffNamesFromForm : (staffNamesFromLookup.length ? staffNamesFromLookup : base?.staffNames),
    } satisfies ScheduleUserCare;
  }, [staffNameMap]);

  const buildStaffPayload = useCallback((form: ExtendedScheduleForm, base?: ScheduleStaff): ScheduleStaff => {
    if (!form.start || !form.end) {
      throw new Error('開始と終了の日時を入力してください。');
    }

    const staffIds = (form.staffIds ?? base?.staffIds ?? [])
      .map((id) => String(id).trim())
      .filter((id) => id.length > 0);

    const staffNamesFromForm = (form.staffNames ?? [])
      .map((name) => (name ?? '').trim())
      .filter((name) => name.length > 0);

    const staffNamesFromLookup = staffIds
      .map((id) => (staffNameMap.get(id) ?? '').trim())
      .filter((name) => name.length > 0);

    const subType = (form.subType ?? base?.subType ?? '会議') as ScheduleStaff['subType'];
    const location = (form.location ?? '').trim();
    const note = (form.note ?? '').trim();
    const hasTitleInput = form.title !== undefined;
    const rawTitle = (form.title ?? '').trim();
    const title = hasTitleInput ? rawTitle : (base?.title ?? '');
    const dayPart = subType === '年休'
      ? ((form.dayPart ?? base?.dayPart ?? 'Full') as ScheduleStaff['dayPart'])
      : undefined;

    return {
      id: base?.id ?? '',
      etag: base?.etag ?? '',
      category: 'Staff',
      title,
      start: form.start,
      end: form.end,
      allDay: Boolean(form.allDay),
      status: toDomainStatus(form.status),
      location: location.length ? location : undefined,
      notes: note.length ? note : undefined,
      recurrenceRule: base?.recurrenceRule,
      dayKey: base?.dayKey,
      fiscalYear: base?.fiscalYear,
      subType,
      staffIds,
      staffNames: staffNamesFromForm.length ? staffNamesFromForm : (staffNamesFromLookup.length ? staffNamesFromLookup : base?.staffNames),
      dayPart,
    } satisfies ScheduleStaff;
  }, [staffNameMap]);

  const buildOrgPayload = useCallback((form: ExtendedScheduleForm, base?: ScheduleOrg): ScheduleOrg => {
    if (!form.start || !form.end) {
      throw new Error('開始と終了の日時を入力してください。');
    }

    const subType = (form.subType ?? base?.subType ?? '会議') as ScheduleOrg['subType'];
    const location = (form.location ?? '').trim();
    const note = (form.note ?? '').trim();
    const hasTitleInput = form.title !== undefined;
    const rawTitle = (form.title ?? '').trim();
    const title = hasTitleInput ? rawTitle : (base?.title ?? '');
    const audience = form.audience ?? base?.audience;
    const resourceId = (form.resourceId ?? base?.resourceId ?? '').trim();
    const externalOrgName = (form.externalOrgName ?? base?.externalOrgName ?? '').trim();

    return {
      id: base?.id ?? '',
      etag: base?.etag ?? '',
      category: 'Org',
      title,
      start: form.start,
      end: form.end,
      allDay: Boolean(form.allDay),
      status: toDomainStatus(form.status),
      location: location.length ? location : undefined,
      notes: note.length ? note : undefined,
      recurrenceRule: base?.recurrenceRule,
      dayKey: base?.dayKey,
      fiscalYear: base?.fiscalYear,
      subType,
      audience: audience && audience.length ? [...audience] : undefined,
      resourceId: resourceId.length ? resourceId : undefined,
      externalOrgName: externalOrgName.length ? externalOrgName : undefined,
    } satisfies ScheduleOrg;
  }, []);

  const annotatedTimelineEvents = useMemo(() => {
    if (!staffPatterns) {
      return timelineEvents;
    }
    return timelineEvents.map((event) => {
      const warnings = collectBaseShiftWarnings(event, staffPatterns);
      return warnings.length ? { ...event, baseShiftWarnings: warnings } : event;
    });
  }, [timelineEvents, staffPatterns]);

  const rangeLabel = useMemo(() => {
    return formatRangeLocal(range.start.toISOString(), range.end.toISOString());
  }, [range.start.getTime(), range.end.getTime()]);
  const loadTimeline = useCallback(async () => {
    const startIso = range.start.toISOString();
    const endIso = range.end.toISOString();
    setTimelineLoading(true);
    setTimelineError(null);

    // 開発環境での無限エラーを防ぐため、CORS エラーが発生した場合はモックデータに切り替える
    const { isDev: isDevelopment } = getAppConfig();

    try {
      const [userRows, orgRows, staffRows] = await Promise.all([
        getUserCareSchedules(sp, { start: startIso, end: endIso }),
        getOrgSchedules(sp, { start: startIso, end: endIso }),
        getStaffSchedules(sp, { start: startIso, end: endIso }),
      ]);
      const combined: Schedule[] = [...userRows, ...orgRows, ...staffRows]
        .map((event) => assignLocalDateKey({ ...event }))
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
      setTimelineEvents(combined);
      // 成功時のリトライカウントリセットは useEffect で行う
    } catch (cause) {
      const err = cause instanceof Error ? cause : new Error('予定の取得に失敗しました');
      console.warn('SharePoint API エラー:', err.message);

      // 開発環境では SharePoint エラーの場合、無限リトライを避けて空データを使用
      if (isDevelopment) {
        console.info('開発環境: SharePoint接続エラーのためモックデータを使用します');
        setTimelineEvents([]); // 空のデータセット
        setTimelineError(null); // エラーをクリア
      } else {
        setTimelineError(err);
        // エラーを再スローしない（useEffect内で追加処理が不要なため）
      }
    } finally {
      setTimelineLoading(false);
    }
  }, [range.start.getTime(), range.end.getTime(), sp]);

  // データ読み込み用の useEffect（状態更新の重複を避けるため、loadTimeline内部の状態管理に委ねる）
  useEffect(() => {
    // loadTimeline()内でエラーハンドリングと状態更新が完結しているので、
    // useEffectでは追加の状態更新は行わない
    loadTimeline().catch(() => {
      // エラーはloadTimeline内で既に処理済み
      // 追加の状態更新は行わない（無限ループを防ぐため）
    });
  }, [range.start.getTime(), range.end.getTime(), sp]);

  const dayViewDate = useMemo(() => new Date(range.start.getTime()), [range.start.getTime()]);

  const handleEventMove = useCallback(({ id, to }: EventMovePayload) => {
    setTimelineEvents((prev) => {
      const index = prev.findIndex((item) => item.id === id);
      if (index === -1) {
        return prev;
      }
      const original = prev[index];
      if (original.category !== to.category) {
        return prev;
      }
      const updated = moveScheduleToDay(original, to.dayKey);
      const next = [...prev];
      next.splice(index, 1, updated);
      next.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
      return next;
    });
  }, []);

  const toLocalInputValue = useCallback((date: Date) => formatDate(date, "yyyy-MM-dd'T'HH:mm"), []);

  const buildQuickEditOverride = useCallback(
    (schedule: ScheduleUserCare): Partial<ScheduleFormState> | null => {
      const startDate = new Date(schedule.start);
      const endDate = new Date(schedule.end ?? schedule.start);
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        return null;
      }
      const userId = schedule.personId ?? '';
      if (!userId) {
        return null;
      }
      const inferredServiceType = QUICK_SERVICE_TYPE_BY_LABEL[schedule.serviceType ?? ''] ?? 'other';
      return {
        userId,
        startLocal: toLocalInputValue(startDate),
        endLocal: toLocalInputValue(endDate),
        serviceType: inferredServiceType,
        locationName: schedule.location ?? '',
        notes: schedule.notes ?? '',
      };
    },
    [toLocalInputValue]
  );

  const handleQuickDialogOpen = useCallback(() => {
    setQuickDialogMode('create');
    setQuickDialogEditingSchedule(null);
    setQuickDialogOverride(null);
    setQuickDialogInitialDate(new Date());
    setQuickDialogOpen(true);
  }, []);

  const handleQuickDialogClose = useCallback(() => {
    setQuickDialogOpen(false);
    setQuickDialogInitialDate(null);
    setQuickDialogMode('create');
    setQuickDialogEditingSchedule(null);
    setQuickDialogOverride(null);
  }, []);

  const openQuickEditDialog = useCallback(
    (schedule: ScheduleUserCare) => {
      const override = buildQuickEditOverride(schedule);
      if (!override) {
        return false;
      }
      const startDate = new Date(schedule.start);
      setQuickDialogMode('edit');
      setQuickDialogEditingSchedule(schedule);
      setQuickDialogOverride(override);
      setQuickDialogInitialDate(Number.isNaN(startDate.getTime()) ? null : startDate);
      setQuickDialogOpen(true);
      return true;
    },
    [buildQuickEditOverride]
  );

  const handleQuickDialogSubmit = useCallback(async (input: CreateScheduleEventInput) => {
    const serviceTypeLabel = QUICK_SERVICE_TYPE_LABELS[input.serviceType] ?? QUICK_SERVICE_TYPE_LABELS.other;
    const userOption = scheduleUserMap.get(input.userId) ?? null;

    const startDate = new Date(input.startLocal);
    const endDate = new Date(input.endLocal);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new Error('日時の形式が正しくありません');
    }

    const basePayload: ScheduleUserCare = {
      id: '',
      etag: '',
      category: 'User',
      title: `${serviceTypeLabel} / ${userOption?.name ?? '利用者'}`,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      allDay: false,
      status: quickDialogMode === 'edit' && quickDialogEditingSchedule ? quickDialogEditingSchedule.status : '下書き',
      location: input.locationName?.trim() ? input.locationName.trim() : undefined,
      notes: input.notes?.trim() ? input.notes.trim() : undefined,
      recurrenceRule: quickDialogMode === 'edit' && quickDialogEditingSchedule ? quickDialogEditingSchedule.recurrenceRule : undefined,
      dayKey: quickDialogMode === 'edit' && quickDialogEditingSchedule ? quickDialogEditingSchedule.dayKey : undefined,
      fiscalYear: quickDialogMode === 'edit' && quickDialogEditingSchedule ? quickDialogEditingSchedule.fiscalYear : undefined,
      serviceType: serviceTypeLabel,
      personType: 'Internal',
      personId: input.userId,
      personName: userOption?.name,
      externalPersonName: undefined,
      externalPersonOrg: undefined,
      externalPersonContact: undefined,
      staffIds: quickDialogMode === 'edit' && quickDialogEditingSchedule?.staffIds?.length
        ? [...quickDialogEditingSchedule.staffIds]
        : [...defaultUserStaffIds],
      staffNames: quickDialogMode === 'edit' && quickDialogEditingSchedule?.staffNames?.length
        ? [...quickDialogEditingSchedule.staffNames]
        : (defaultUserStaffNames ? [...defaultUserStaffNames] : undefined),
    } satisfies ScheduleUserCare;

    try {
      if (quickDialogMode === 'edit' && quickDialogEditingSchedule) {
        const payload: ScheduleUserCare = {
          ...basePayload,
          id: quickDialogEditingSchedule.id ?? '',
          etag: quickDialogEditingSchedule.etag ?? '',
          personType: quickDialogEditingSchedule.personType,
          externalPersonName: quickDialogEditingSchedule.externalPersonName,
          externalPersonOrg: quickDialogEditingSchedule.externalPersonOrg,
          externalPersonContact: quickDialogEditingSchedule.externalPersonContact,
        } satisfies ScheduleUserCare;
        await updateUserCare(sp, payload);
        showSnackbar('予定を更新しました', 'success');
      } else {
        await createUserCare(sp, basePayload);
        setLastQuickUserId(input.userId);
        showSnackbar('予定を作成しました', 'success');
      }
      await loadTimeline();
    } catch (error) {
      const message = error instanceof Error ? error.message : quickDialogMode === 'edit'
        ? '予定の更新に失敗しました'
        : '予定の作成に失敗しました';
      showSnackbar(message, 'error');
      throw error;
    }
  }, [scheduleUserMap, quickDialogMode, quickDialogEditingSchedule, defaultUserStaffIds, defaultUserStaffNames, sp, showSnackbar, loadTimeline]);

  // Schedule Dialog Handlers
  const handleCreateSchedule = useCallback(() => {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    const end = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour later

    setDialogEditing(null);
    setDialogInitial({
      category: 'User',
      userId: '',
      status: 'planned',
      start: now.toISOString(),
      end: end.toISOString(),
      title: '',
      note: '',
      allDay: false,
      location: '',
      serviceType: '一時ケア',
      personType: 'Internal',
      staffIds: [...defaultUserStaffIds],
      staffNames: defaultUserStaffNames ? [...defaultUserStaffNames] : undefined,
    });
    setDialogOpen(true);
  }, [defaultUserStaffIds, defaultUserStaffNames]);

  const handleDialogClose = useCallback(() => {
    setDialogOpen(false);
    setDialogInitial(undefined);
    setDialogEditing(null);
  }, []);

  const handleDialogSubmit = useCallback(async (values: ExtendedScheduleForm) => {
    const category = values.category;
    const editing = dialogEditing && dialogEditing.category === category ? dialogEditing : null;

    try {
      switch (category) {
        case 'User': {
          const payload = buildUserCarePayload(values, editing as ScheduleUserCare | undefined);
          if (editing) {
            await updateUserCare(sp, payload);
          } else {
            await createUserCare(sp, payload);
          }
          break;
        }
        case 'Org': {
          const payload = buildOrgPayload(values, editing as ScheduleOrg | undefined);
          if (editing) {
            await updateOrgSchedule(sp, payload);
          } else {
            await createOrgSchedule(sp, payload);
          }
          break;
        }
        case 'Staff': {
          const payload = buildStaffPayload(values, editing as ScheduleStaff | undefined);
          if (editing) {
            await updateStaffSchedule(sp, payload);
          } else {
            await createStaffSchedule(sp, payload);
          }
          break;
        }
        default:
          throw new Error('対応していないカテゴリの予定です。');
      }

      setDialogOpen(false);
      setDialogInitial(undefined);
      setDialogEditing(null);
      showSnackbar(editing ? '予定を更新しました' : '予定を作成しました', 'success');

      await loadTimeline();
    } catch (error) {
  const message = error instanceof Error ? error.message : '予定の保存に失敗しました。';
      showSnackbar(message, 'error');
      throw error;
    }
  }, [dialogEditing, buildUserCarePayload, buildOrgPayload, buildStaffPayload, sp, showSnackbar, loadTimeline]);

  const handleDateClick = useCallback((date: Date) => {
    const start = date.toISOString();
    const end = new Date(date.getTime() + 60 * 60 * 1000).toISOString(); // 1時間後

    setDialogEditing(null);
    setDialogInitial({
      category: 'User',
      userId: '',
      status: 'planned',
      start,
      end,
      title: '',
      note: '',
      allDay: false,
      location: '',
      serviceType: '一時ケア',
      personType: 'Internal',
      staffIds: [...defaultUserStaffIds],
      staffNames: defaultUserStaffNames ? [...defaultUserStaffNames] : undefined,
    });
    setDialogOpen(true);
  }, [defaultUserStaffIds, defaultUserStaffNames]);

  // Timeline specific handlers
  const handleEventCreate = useCallback((payload: { category: Schedule['category']; date: string }) => {
    const startDate = new Date(payload.date);
    startDate.setHours(9, 0, 0, 0); // デフォルトで9:00から開始
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1時間後

    const startIso = startDate.toISOString();
    const endIso = endDate.toISOString();
    setDialogEditing(null);

    if (payload.category === 'User') {
      setDialogInitial({
        category: 'User',
        status: 'planned',
        start: startIso,
        end: endIso,
        title: '',
        note: '',
        allDay: false,
        location: '',
        userId: '',
        personType: 'Internal',
        serviceType: '一時ケア',
        staffIds: [...defaultUserStaffIds],
        staffNames: defaultUserStaffNames ? [...defaultUserStaffNames] : undefined,
      });
    } else if (payload.category === 'Org') {
      setDialogInitial({
        category: 'Org',
        status: 'planned',
        start: startIso,
        end: endIso,
        title: '',
        note: '',
        allDay: false,
        location: '',
        subType: '会議',
        audience: [],
      });
    } else {
      setDialogInitial({
        category: 'Staff',
        status: 'planned',
        start: startIso,
        end: endIso,
        title: '',
        note: '',
        allDay: false,
        location: '',
        subType: '会議',
        staffIds: [],
      });
    }
    setDialogOpen(true);
  }, [defaultUserStaffIds, defaultUserStaffNames]);

  const handleEventEdit = useCallback(
    (schedule: Schedule) => {
      if (schedule.category === 'User') {
        const userSchedule = schedule as ScheduleUserCare;
        const handled = openQuickEditDialog(userSchedule);
        if (handled) {
          return;
        }
      }
      setDialogEditing(schedule);
      setDialogInitial(scheduleToExtendedForm(schedule));
      setDialogOpen(true);
    },
    [openQuickEditDialog]
  );

  const handleEventClick = useCallback((event: { id: string; title: string; startIso: string }) => {
    const target = timelineEvents.find((item) => item.id === String(event.id));

    if (target) {
      if (target.category === 'User' && openQuickEditDialog(target as ScheduleUserCare)) {
        return;
      }
      setDialogEditing(target);
      setDialogInitial(scheduleToExtendedForm(target));
    } else {
      const startIso = event.startIso;
      const fallbackEnd = new Date(new Date(event.startIso).getTime() + 60 * 60 * 1000).toISOString();
      setDialogEditing(null);
      setDialogInitial({
        category: 'User',
        status: 'planned',
        start: startIso,
        end: fallbackEnd,
        title: event.title,
        note: '',
        userId: '',
        personType: 'Internal',
        serviceType: '一時ケア',
        staffIds: [...defaultUserStaffIds],
        staffNames: defaultUserStaffNames ? [...defaultUserStaffNames] : undefined,
      });
    }

    setDialogOpen(true);
  }, [timelineEvents, defaultUserStaffIds, defaultUserStaffNames, openQuickEditDialog]);

  return (
    <Container maxWidth="xl" sx={{ py: 3 }} data-testid="schedule-page-root">
      <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden' }}>
        {/* Header with title and period navigation */}
        <Box sx={{ p: 3, pb: 0 }}>
          <Stack direction="row" alignItems="center" flexWrap="wrap" gap={2} mb={2}>
            <Typography
              variant="h5"
              component="h1"
              fontWeight="bold"
              sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1, minWidth: 240 }}
            >
              <CalendarMonthRoundedIcon />
              スケジュール管理
            </Typography>

            <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
              <Button
                variant="outlined"
                startIcon={<AddRoundedIcon />}
                onClick={handleQuickDialogOpen}
                disabled={!scheduleUserOptions.length}
                data-testid={TESTIDS['schedule-create-quick-button']}
              >
                かんたん登録
              </Button>

              <Button
                variant="contained"
                startIcon={<AddRoundedIcon />}
                onClick={handleCreateSchedule}
              >
                新規作成
              </Button>
            </Stack>

            {view !== 'userCare' && (
              <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                <IconButton
                  onClick={() =>
                    setRange((prev) => {
                      const span = prev.end.getTime() - prev.start.getTime();
                      const nextStart = new Date(prev.start.getTime() - span);
                      const nextEnd = new Date(prev.end.getTime() - span);
                      return { start: nextStart, end: nextEnd };
                    })
                  }
                  aria-label="前の期間"
                >
                  <NavigateBeforeRoundedIcon />
                </IconButton>

                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    const now = new Date();
                    // 月曜始まりの今週を取得
                    const start = startOfWeek(now, { weekStartsOn: 1 });
                    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
                    setRange({ start, end });
                  }}
                >
                  今週
                </Button>

                <IconButton
                  onClick={() =>
                    setRange((prev) => {
                      const span = prev.end.getTime() - prev.start.getTime();
                      const nextStart = new Date(prev.start.getTime() + span);
                      const nextEnd = new Date(prev.end.getTime() + span);
                      return { start: nextStart, end: nextEnd };
                    })
                  }
                  aria-label="次の期間"
                >
                  <NavigateNextRoundedIcon />
                </IconButton>
              </Stack>
            )}
          </Stack>

          <Typography variant="body2" color="text.secondary" mb={2}>
            {rangeLabel || '期間未設定'}
          </Typography>

          <FilterToolbar
            toolbarLabel="スケジュールの検索とフィルタ"
            query={query}
            onQueryChange={setQuery}
            searchPlaceholder="予定名、メモ、担当など"
            scope="schedule"
          />
        </Box>

        {/* MUI Tabs for view switching */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}>
          <Tabs
            value={view}
            onChange={(_, newValue) => setView(newValue)}
            aria-label="スケジュールビュー切り替え"
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab
              value="month"
              label="月"
              icon={<CalendarMonthRoundedIcon />}
              iconPosition="start"
              sx={{ minHeight: 48, textTransform: 'none' }}
            />
            <Tab
              value="week"
              label="週"
              icon={<CalendarViewWeekRoundedIcon />}
              iconPosition="start"
              sx={{ minHeight: 48, textTransform: 'none' }}
            />
            <Tab
              value="day"
              label="日"
              icon={<TodayRoundedIcon />}
              iconPosition="start"
              sx={{ minHeight: 48, textTransform: 'none' }}
            />
            <Tab
              value="list"
              label="リスト"
              icon={<ListAltRoundedIcon />}
              iconPosition="start"
              sx={{ minHeight: 48, textTransform: 'none' }}
            />
            <Tab
              value="userCare"
              label="利用者ケア"
              icon={<PersonRoundedIcon />}
              iconPosition="start"
              sx={{ minHeight: 48, textTransform: 'none' }}
            />
          </Tabs>
        </Box>

        {/* Content Area */}
        <Box sx={{ p: 3 }}>
          {timelineError && (
            <Box sx={{ mb: 2, p: 2, bgcolor: 'error.light', color: 'error.contrastText', borderRadius: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                予定の読み込みに失敗しました
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {timelineError.message}
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '0.875rem', opacity: 0.8 }}>
                ページをリフレッシュ (Cmd+R / Ctrl+R) して再度お試しください。
              </Typography>
              {getAppConfig().isDev && (
                <Typography variant="body2" sx={{ fontSize: '0.875rem', opacity: 0.8, mt: 1 }}>
                  開発環境: SharePoint への接続に問題がある場合、モックデータが使用されます。
                </Typography>
              )}
            </Box>
          )}

          {view === 'month' && (
            <MonthView
              onDateClick={handleDateClick}
              onEventClick={handleEventClick}
            />
          )}
          {view === 'week' && (
            <TimelineWeek
              events={annotatedTimelineEvents}
              startDate={range.start}
              onEventMove={handleEventMove}
              onEventCreate={handleEventCreate}
              onEventEdit={handleEventEdit}
            />
          )}
          {view === 'day' && (
            <TimelineDay
              events={annotatedTimelineEvents}
              date={dayViewDate}
              onEventCreate={handleEventCreate}
              onEventEdit={handleEventEdit}
            />
          )}
          {view === 'list' && <ScheduleListView />}
          {view === 'userCare' && (
            <Stack spacing={3}>
              <BriefingPanel />
              <UserTab />
              <OrgTab />
              <StaffTab />
            </Stack>
          )}

          {timelineLoading && (
            <Box sx={{ mt: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                予定を読み込んでいます…
              </Typography>
            </Box>
          )}
        </Box>
      </Paper>

      <ScheduleCreateDialog
        open={quickDialogOpen}
        onClose={handleQuickDialogClose}
        onSubmit={handleQuickDialogSubmit}
        users={scheduleUserOptions}
        initialDate={quickDialogInitialDate ?? undefined}
        defaultUser={defaultQuickUser ?? undefined}
        {...(quickDialogMode === 'edit' && quickDialogEditingSchedule && quickDialogOverride
          ? {
              mode: 'edit' as const,
              eventId: String(quickDialogEditingSchedule.id ?? ''),
              initialOverride: quickDialogOverride,
            }
          : {
              mode: 'create' as const,
              eventId: undefined,
              initialOverride: quickDialogOverride ?? undefined,
            })}
      />

      <ScheduleDialog
        open={dialogOpen}
        initial={dialogInitial}
        existingSchedules={timelineEvents}
        onClose={handleDialogClose}
        onSubmit={handleDialogSubmit}
      />
      {snackbarUi}
    </Container>
  );
}
