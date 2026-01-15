import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { format as formatDate, startOfWeek } from 'date-fns';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
// Schedule View Icons
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import CalendarViewWeekRoundedIcon from '@mui/icons-material/CalendarViewWeekRounded';
import DomainRoundedIcon from '@mui/icons-material/DomainRounded';
import ListAltRoundedIcon from '@mui/icons-material/ListAltRounded';
import NavigateBeforeRoundedIcon from '@mui/icons-material/NavigateBeforeRounded';
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import TodayRoundedIcon from '@mui/icons-material/TodayRounded';

import { useAuth } from '@/auth/useAuth';
import { useSnackbarHost } from '@/features/nurse/components/SnackbarHost';
import BriefingPanel from '@/features/schedule/components/BriefingPanel';
import { assignLocalDateKey } from '@/features/schedule/dateutils.local';
import { moveScheduleToDay } from '@/features/schedule/move';
// ScheduleDialog is used via lane-specific wrappers (User/Staff/Org)
import OrgScheduleModal from '@/features/schedule/OrgScheduleModal';
import StaffScheduleModal from '@/features/schedule/StaffScheduleModal';
import type { ExtendedScheduleForm, Schedule, ScheduleOrg, ScheduleStaff, ScheduleStatus, ScheduleUserCare, Status } from '@/features/schedule/types';
import UserScheduleModal from '@/features/schedule/UserScheduleModal';
import ScheduleListView from '@/features/schedule/views/ListView';
import MonthView, { type MonthEntry } from '@/features/schedule/views/MonthView';
import OrgTab from '@/features/schedule/views/OrgTab';
import StaffTab from '@/features/schedule/views/StaffTab';
import TimelineDay from '@/features/schedule/views/TimelineDay';
import TimelineWeek, { type EventMovePayload } from '@/features/schedule/views/TimelineWeek';
import UserTab from '@/features/schedule/views/UserTab';
import ScheduleCreateDialog, { type CreateScheduleEventInput, type ScheduleFormState, type ScheduleServiceType, type ScheduleUserOption } from '@/features/schedules/ScheduleCreateDialog';
import { useScheduleUserOptions } from '@/features/schedules/useScheduleUserOptions';
import { getAppConfig, skipSharePoint } from '@/lib/env';
import { AuthRequiredError } from '@/lib/errors';
import { useSP } from '@/lib/spClient';
import { useStaff } from '@/stores/useStaff';
import { TESTIDS } from '@/testids';
import FilterToolbar from '@/ui/filters/FilterToolbar';
import { formatRangeLocal } from '@/utils/datetime';
import { getOrgFilterLabel, matchesOrgFilter, normalizeOrgFilter, type OrgFilterKey } from './orgFilters';
import { getComposedWeek, isScheduleFixturesMode, type ScheduleEvent } from './api/schedulesClient';
import { ensureDateParam, normalizeToDayStart, pickDateParam } from './dateQuery';
import { useEnsureScheduleList } from './ensureScheduleList';
import { createUserCare, getUserCareSchedules, updateUserCare } from './spClient.schedule';
import { createOrgSchedule, getOrgSchedules, updateOrgSchedule } from './spClient.schedule.org';
import { createStaffSchedule, getStaffSchedules, updateStaffSchedule } from './spClient.schedule.staff';
import { buildStaffPatternIndex, collectBaseShiftWarnings } from './workPattern';

type ViewMode = 'month' | 'week' | 'day' | 'list' | 'userCare' | 'org';

type RangeState = {
  start: Date;
  end: Date;
};

const DEFAULT_VIEW: ViewMode = 'week';
const VIEW_TABS: ViewMode[] = ['month', 'week', 'day', 'list', 'userCare', 'org'];

const resolveViewParam = (searchParams: URLSearchParams): ViewMode => {
  const raw = searchParams.get('tab');
  if (raw && VIEW_TABS.includes(raw as ViewMode)) {
    return raw as ViewMode;
  }
  return DEFAULT_VIEW;
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

const QUICK_SERVICE_TYPE_LABELS: Record<string, string> = {
  normal: '通所',
  transport: '送迎',
  respite: 'レスパイト',
  meeting: '会議',
  training: '研修',
  absence: '欠席',
  late: '遅刻',
  earlyLeave: '早退',
  other: 'その他',
};

const QUICK_SERVICE_TYPE_BY_LABEL: Record<string, ScheduleServiceType> = Object.entries(QUICK_SERVICE_TYPE_LABELS).reduce(
  (acc, [key, label]) => {
    acc[label] = key as ScheduleServiceType;
    return acc;
  },
  {} as Record<string, ScheduleServiceType>
);

// Quick-create(code) -> Domain(ServiceType) のマップ
const QUICK_TO_DOMAIN_SERVICE_TYPE: Record<string, ScheduleUserCare['serviceType']> = {
  normal: '通常利用',
  transport: '送迎',
  respite: '一時ケア',
  meeting: '会議',
  training: '研修',
  absence: '欠席・休み',
  late: 'late',
  earlyLeave: 'earlyLeave',
  other: 'その他',
};

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
const FIXTURE_DEFAULT_STATUS: Status = '承認済み';
const FIXTURE_USER_SERVICE: ScheduleUserCare['serviceType'] = '一時ケア';
const FIXTURE_USER_PERSON_TYPE: ScheduleUserCare['personType'] = 'Internal';

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
      userLookupId: schedule.userLookupId,
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

const fixtureEventToSchedule = (event: ScheduleEvent): Schedule => {
  const base = {
    id: String(event.id),
    etag: '',
    title: event.title,
    start: event.start,
    end: event.end,
    allDay: Boolean(event.allDay),
    status: FIXTURE_DEFAULT_STATUS,
    dayKey: event.dayKey,
    orgCode: event.orgCode,
  } satisfies Pick<Schedule, 'id' | 'etag' | 'title' | 'start' | 'end' | 'allDay' | 'status' | 'dayKey' | 'orgCode'>;

  if (event.category === 'User') {
    return {
      ...base,
      category: 'User',
      serviceType: FIXTURE_USER_SERVICE,
      personType: FIXTURE_USER_PERSON_TYPE,
      personId: event.targetUserIds?.[0],
      personName: event.personName ?? event.targetUserNames?.[0],
      userLookupId: event.targetUserIds?.[0],
      staffIds: event.staffIds ?? [],
      staffNames: event.staffNames,
    } satisfies ScheduleUserCare;
  }

  if (event.category === 'Org') {
    return {
      ...base,
      category: 'Org',
      subType: '会議',
    } satisfies ScheduleOrg;
  }

  return {
    ...base,
    category: 'Staff',
    subType: '会議',
    staffIds: event.staffIds ?? [],
    staffNames: event.staffNames,
  } satisfies ScheduleStaff;
};

export default function SchedulePage() {
  const { account } = useAuth();
  const sp = useSP();
  const snackbarHost = useSnackbarHost();
  const showSnackbar = snackbarHost.show;
  const snackbarUi = snackbarHost.ui;
  useEnsureScheduleList(sp);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: staffData } = useStaff();
  const scheduleUserOptions = useScheduleUserOptions();
  const [dialogEditing, setDialogEditing] = useState<Schedule | null>(null);
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
  const timelineEventsRef = useRef<Schedule[]>([]);

  const view = useMemo(() => resolveViewParam(searchParams), [searchParams]);
  const orgFilterKey = useMemo<OrgFilterKey>(() => normalizeOrgFilter(searchParams.get('org')), [searchParams]);
  const orgFilterLabel = useMemo(() => getOrgFilterLabel(orgFilterKey), [orgFilterKey]);

  useEffect(() => {
    const raw = searchParams.get('tab');
    if (!raw || !VIEW_TABS.includes(raw as ViewMode)) {
      const next = new URLSearchParams(searchParams);
      next.set('tab', DEFAULT_VIEW);
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleViewChange = useCallback(
    (_event: unknown, nextValue: ViewMode) => {
      if (view === nextValue) {
        return;
      }
      const next = new URLSearchParams(searchParams);
      next.set('tab', nextValue);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams, view],
  );

  // Schedule Dialog States
  // dialogOpen removed — using per-lane modals
  const [dialogInitial, setDialogInitial] = useState<ExtendedScheduleForm | undefined>(undefined);
  const [quickDialogOpen, setQuickDialogOpen] = useState(false);
  const [quickDialogInitialDate, setQuickDialogInitialDate] = useState<Date | null>(null);
  const [quickDialogMode, setQuickDialogMode] = useState<'create' | 'edit'>('create');
  const [quickDialogOverride, setQuickDialogOverride] = useState<Partial<ScheduleFormState> | null>(null);
  const [quickDialogEditingSchedule, setQuickDialogEditingSchedule] = useState<ScheduleUserCare | null>(null);
  const [lastQuickUserId, setLastQuickUserId] = useState<string | undefined>(undefined);
  // Per-lane modal states (thin wrappers around ScheduleDialog)
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [staffDialogOpen, setStaffDialogOpen] = useState(false);
  const [orgDialogOpen, setOrgDialogOpen] = useState(false);

  const rawDateParam = useMemo(() => pickDateParam(searchParams), [searchParams]);
  const anchorDate = useMemo(() => normalizeToDayStart(rawDateParam), [rawDateParam]);
  const anchorDateMs = anchorDate.getTime();
  const rangeStartMs = range.start.getTime();
  const rangeEndMs = range.end.getTime();

  useEffect(() => {
    const start = startOfWeek(anchorDate, { weekStartsOn: 1 });
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    setRange((prev) => {
      if (prev.start.getTime() === start.getTime() && prev.end.getTime() === end.getTime()) {
        return prev;
      }
      return { start, end };
    });
  }, [anchorDate, anchorDateMs]);

  useEffect(() => {
    if (rawDateParam) {
      return;
    }
    const next = ensureDateParam(searchParams, anchorDate);
    setSearchParams(next, { replace: true });
  }, [anchorDate, anchorDateMs, rawDateParam, searchParams, setSearchParams]);

  const updateDateParam = useCallback((nextDate: Date) => {
    const next = ensureDateParam(searchParams, nextDate);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const shiftWeek = useCallback((direction: -1 | 1) => {
    const span = rangeEndMs - rangeStartMs;
    const next = new Date(anchorDateMs + direction * span);
    updateDateParam(next);
  }, [anchorDateMs, rangeEndMs, rangeStartMs, updateDateParam]);

  const jumpToCurrentWeek = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    updateDateParam(today);
  }, [updateDateParam]);

  const fixturesEnabled = useMemo(() => isScheduleFixturesMode() || skipSharePoint(), []);

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
    const selectedUser = form.userId ? scheduleUserMap.get(form.userId) : undefined;
    const resolvedLookupId = (() => {
      const candidate = selectedUser?.lookupId ?? form.userLookupId ?? base?.userLookupId;
      if (candidate == null) return undefined;
      const normalized = String(candidate).trim();
      return normalized.length ? normalized : undefined;
    })();
    const resolvedPersonName = personType === 'Internal'
      ? (form.personName ?? selectedUser?.name ?? base?.personName) ?? undefined
      : undefined;

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
      personName: resolvedPersonName,
      userLookupId: personType === 'Internal' ? resolvedLookupId ?? undefined : undefined,
      externalPersonName: personType === 'External' ? (form.externalPersonName ?? base?.externalPersonName) ?? undefined : undefined,
      externalPersonOrg: personType === 'External' ? (form.externalPersonOrg ?? base?.externalPersonOrg) ?? undefined : undefined,
      externalPersonContact: personType === 'External' ? (form.externalPersonContact ?? base?.externalPersonContact) ?? undefined : undefined,
      staffIds,
      staffNames: staffNamesFromForm.length ? staffNamesFromForm : (staffNamesFromLookup.length ? staffNamesFromLookup : base?.staffNames),
    } satisfies ScheduleUserCare;
  }, [staffNameMap, scheduleUserMap]);

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

  const orgScopedEvents = useMemo(() => {
    if (orgFilterKey === 'all') {
      return annotatedTimelineEvents;
    }
    return annotatedTimelineEvents.filter((item) => matchesOrgFilter(item.orgCode, orgFilterKey));
  }, [annotatedTimelineEvents, orgFilterKey]);

  useEffect(() => {
    timelineEventsRef.current = timelineEvents;
  }, [timelineEvents]);
  const filteredTimelineEvents = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return orgScopedEvents;
    return orgScopedEvents.filter((item) => {
      const haystack = [
        item.title,
        item.notes,
        item.location,
        // @ts-expect-error category-specific fields
        item.subType,
        // @ts-expect-error category-specific fields
        item.serviceType,
        // @ts-expect-error category-specific fields
        Array.isArray(item.staffNames) ? item.staffNames.join(' ') : '',
        // @ts-expect-error category-specific fields
        item.personName ?? '',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [orgScopedEvents, query]);

  const filteredTimelineCount = filteredTimelineEvents.length;
  const timelineOrgSummary = useMemo(
    () => ({
      label: orgFilterLabel,
      count: filteredTimelineCount,
    }),
    [filteredTimelineCount, orgFilterLabel],
  );


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
      let combined: Schedule[] = [];
      if (fixturesEnabled) {
        const fixtureRows = await getComposedWeek({ fromISO: startIso, toISO: endIso });
        combined = fixtureRows
          .map((event) => assignLocalDateKey({ ...fixtureEventToSchedule(event) }))
          .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
      } else {
        const [userRows, orgRows, staffRows] = await Promise.all([
          getUserCareSchedules(sp, { start: startIso, end: endIso }),
          getOrgSchedules(sp, { start: startIso, end: endIso }),
          getStaffSchedules(sp, { start: startIso, end: endIso }),
        ]);
        combined = [...userRows, ...orgRows, ...staffRows]
          .map((event) => assignLocalDateKey({ ...event }))
          .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
      }
      setTimelineEvents(combined);
      // 成功時のリトライカウントリセットは useEffect で行う
    } catch (cause) {
      const err = (() => {
        if (cause instanceof AuthRequiredError) {
          return new Error('サインインが必要です。右上の「サインイン」からログインしてください。');
        }
        if (cause instanceof Error && cause.message === 'AUTH_REQUIRED') {
          return new Error('サインインが必要です。右上の「サインイン」からログインしてください。');
        }
        return cause instanceof Error ? cause : new Error('予定の取得に失敗しました');
      })();
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
  }, [fixturesEnabled, range.start.getTime(), range.end.getTime(), sp]);

  // データ読み込み用の useEffect（状態更新の重複を避けるため、loadTimeline内部の状態管理に委ねる）
  useEffect(() => {
    // loadTimeline()内でエラーハンドリングと状態更新が完結しているので、
    // useEffectでは追加の状態更新は行わない
    loadTimeline().catch(() => {
      // エラーはloadTimeline内で既に処理済み
      // 追加の状態更新は行わない（無限ループを防ぐため）
    });
  }, [range.start.getTime(), range.end.getTime(), sp]);

  const dayViewDate = useMemo(() => new Date(anchorDateMs), [anchorDateMs]);

  const handleEventMove = useCallback(async ({ id, to }: EventMovePayload) => {
    let original: Schedule | undefined;

    // 楽観的更新
    setTimelineEvents((prev) => {
      const index = prev.findIndex((item) => item.id === id);
      if (index === -1) {
        return prev;
      }
      original = prev[index];
      if (original.category !== to.category) {
        return prev;
      }
      const updated = moveScheduleToDay(original, to.dayKey);
      const next = [...prev];
      next.splice(index, 1, updated);
      next.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
      return next;
    });

    if (!original || original.category !== to.category) {
      return;
    }

    const moved = moveScheduleToDay(original, to.dayKey);

    try {
      if (moved.category === 'User') {
        await updateUserCare(sp, moved as ScheduleUserCare);
      } else if (moved.category === 'Org') {
        await updateOrgSchedule(sp, moved as ScheduleOrg);
      } else if (moved.category === 'Staff') {
        await updateStaffSchedule(sp, moved as ScheduleStaff);
      }
      showSnackbar('予定を移動しました', 'success');
    } catch (error) {
      // 巻き戻し
      const fallbackOriginal = timelineEventsRef.current.find((item) => item.id === id) ?? original;
      setTimelineEvents((prev) => {
        const index = prev.findIndex((item) => item.id === id);
        if (index === -1) {
          return prev;
        }
        const next = [...prev];
        next.splice(index, 1, fallbackOriginal);
        next.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
        return next;
      });

      const message = error instanceof Error ? error.message : '予定の移動に失敗しました';
      showSnackbar(message, 'error');
    }
  }, [sp, showSnackbar]);

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
    const assignedStaffId = input.assignedStaffId?.trim();
    const resolvedStaffIds = (() => {
      if (assignedStaffId) {
        return [assignedStaffId];
      }
      if (quickDialogMode === 'edit' && quickDialogEditingSchedule?.staffIds?.length) {
        return [...quickDialogEditingSchedule.staffIds];
      }
      if (defaultUserStaffIds.length) {
        return [...defaultUserStaffIds];
      }
      return [];
    })();

    const resolvedStaffNames = (() => {
      if (assignedStaffId) {
        const staffName = staffNameMap.get(assignedStaffId)?.trim();
        return staffName ? [staffName] : undefined;
      }
      if (quickDialogMode === 'edit' && quickDialogEditingSchedule?.staffNames?.length) {
        return [...quickDialogEditingSchedule.staffNames];
      }
      if (defaultUserStaffNames?.length) {
        return [...defaultUserStaffNames];
      }
      return undefined;
    })();

    const serviceTypeKey =
      typeof input.serviceType === 'string' && input.serviceType.trim()
        ? (input.serviceType.trim() as keyof typeof QUICK_SERVICE_TYPE_LABELS)
        : 'other';
    const serviceTypeLabel = QUICK_SERVICE_TYPE_LABELS[serviceTypeKey] ?? QUICK_SERVICE_TYPE_LABELS.other ?? 'その他';
    const userOption = input.userId ? scheduleUserMap.get(input.userId) ?? null : null;
    const trimmedTitle = input.title.trim();
    const resolvedTitle = trimmedTitle || `${serviceTypeLabel} / ${userOption?.name ?? '利用者'}`;
    const mappedServiceType = QUICK_TO_DOMAIN_SERVICE_TYPE[serviceTypeKey] ?? '一時ケア';

    const startDate = new Date(input.startLocal);
    const endDate = new Date(input.endLocal);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new Error('日時の形式が正しくありません');
    }

    const basePayload: ScheduleUserCare = {
      id: '',
      etag: '',
      category: 'User',
      title: resolvedTitle,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      allDay: false,
      status: quickDialogMode === 'edit' && quickDialogEditingSchedule ? quickDialogEditingSchedule.status : '下書き',
      location: input.locationName?.trim() ? input.locationName.trim() : undefined,
      notes: input.notes?.trim() ? input.notes.trim() : undefined,
      recurrenceRule: quickDialogMode === 'edit' && quickDialogEditingSchedule ? quickDialogEditingSchedule.recurrenceRule : undefined,
      dayKey: quickDialogMode === 'edit' && quickDialogEditingSchedule ? quickDialogEditingSchedule.dayKey : undefined,
      fiscalYear: quickDialogMode === 'edit' && quickDialogEditingSchedule ? quickDialogEditingSchedule.fiscalYear : undefined,
      serviceType: mappedServiceType,
      personType: 'Internal',
      personId: input.userId ?? '',
      personName: userOption?.name,
      userLookupId: userOption?.lookupId ? String(userOption.lookupId) : undefined,
      externalPersonName: undefined,
      externalPersonOrg: undefined,
      externalPersonContact: undefined,
      staffIds: resolvedStaffIds,
      staffNames: resolvedStaffNames,
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
        setLastQuickUserId(input.userId ?? '');
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
  }, [scheduleUserMap, quickDialogMode, quickDialogEditingSchedule, defaultUserStaffIds, defaultUserStaffNames, staffNameMap, sp, showSnackbar, loadTimeline]);

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
    setUserDialogOpen(true);
  }, [defaultUserStaffIds, defaultUserStaffNames]);

  const handleDialogClose = useCallback(() => {
    // Close any lane modal and reset shared initial/editing
    setDialogInitial(undefined);
    setDialogEditing(null);
    setUserDialogOpen(false);
    setStaffDialogOpen(false);
    setOrgDialogOpen(false);
  }, []);

  const handleDialogSubmit = useCallback(async (values: ExtendedScheduleForm) => {
    const category = values.category;
    const editing = dialogEditing && dialogEditing.category === category ? dialogEditing : null;

    try {
    switch (category) {
        case 'User': {
        const payload = buildUserCarePayload(values, editing as ScheduleUserCare | undefined);
          /* DEBUG: exact payload from UI before SharePoint call */
          // eslint-disable-next-line no-console
          console.debug('[schedule:create] category=User payload=', payload);
          if (editing) {
            await updateUserCare(sp, payload);
          } else {
            await createUserCare(sp, payload);
          }
          break;
        }
        case 'Org': {
        const payload = buildOrgPayload(values, editing as ScheduleOrg | undefined);
          /* DEBUG: exact payload from UI before SharePoint call */
          // eslint-disable-next-line no-console
          console.debug('[schedule:create] category=Org payload=', payload);
          if (editing) {
            await updateOrgSchedule(sp, payload);
          } else {
            await createOrgSchedule(sp, payload);
          }
          break;
        }
        case 'Staff': {
        const payload = buildStaffPayload(values, editing as ScheduleStaff | undefined);
          /* DEBUG: exact payload from UI before SharePoint call */
          // eslint-disable-next-line no-console
          console.debug('[schedule:create] category=Staff payload=', payload);
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

      // Close any open lane modal and reset state
      handleDialogClose();
      showSnackbar(editing ? '予定を更新しました' : '予定を作成しました', 'success');

      await loadTimeline();
    } catch (error) {
  const message = error instanceof Error ? error.message : '予定の保存に失敗しました。';
      showSnackbar(message, 'error');
      throw error;
    }
  }, [dialogEditing, buildUserCarePayload, buildOrgPayload, buildStaffPayload, sp, showSnackbar, loadTimeline]);

  const handleDateClick = useCallback((date: Date) => {
    const next = ensureDateParam(searchParams, date);
    next.set('tab', 'day');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

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
    // Open lane-specific modal
    if (payload.category === 'User') setUserDialogOpen(true);
    if (payload.category === 'Org') setOrgDialogOpen(true);
    if (payload.category === 'Staff') setStaffDialogOpen(true);
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
      if (schedule.category === 'User') setUserDialogOpen(true);
      if (schedule.category === 'Staff') setStaffDialogOpen(true);
      if (schedule.category === 'Org') setOrgDialogOpen(true);
    },
    [openQuickEditDialog]
  );

  const handleEventClick = useCallback(
    (event: MonthEntry) => {
      const iso = event.startIso;
      if (!iso) return;
      const yyyymmdd = iso.slice(0, 10);
      navigate(`/schedules/day?date=${encodeURIComponent(yyyymmdd)}`);
    },
    [navigate]
  );

  const handleDayNavigate = useCallback(
    (dayKey: string) => {
      navigate(`/schedules/day?date=${encodeURIComponent(dayKey)}&tab=day`);
    },
    [navigate],
  );

  return (
    <Container maxWidth="xl" sx={{ py: 3 }} data-testid={TESTIDS.SCHEDULES_PAGE_ROOT}>
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
                  onClick={() => shiftWeek(-1)}
                  aria-label="前の期間"
                >
                  <NavigateBeforeRoundedIcon />
                </IconButton>

                <Button
                  variant="outlined"
                  size="small"
                  onClick={jumpToCurrentWeek}
                >
                  今週
                </Button>

                <IconButton
                  onClick={() => shiftWeek(1)}
                  aria-label="次の期間"
                >
                  <NavigateNextRoundedIcon />
                </IconButton>
              </Stack>
            )}
          </Stack>

          <Typography
            variant="body2"
            color="text.secondary"
            mb={2}
            data-testid={TESTIDS.SCHEDULES_RANGE_LABEL}
          >
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
            onChange={handleViewChange}
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
            <Tab
              value="org"
              label="事業所別"
              icon={<DomainRoundedIcon />}
              iconPosition="start"
              data-testid="schedule-tab-org"
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
            <Box data-testid={TESTIDS.SCHEDULES_WEEK_TIMELINE}>
              <TimelineWeek
                events={filteredTimelineEvents}
                startDate={range.start}
                onEventMove={handleEventMove}
                onEventCreate={handleEventCreate}
                onEventEdit={handleEventEdit}
                onDayNavigate={handleDayNavigate}
                orgFilterLabel={orgFilterLabel}
              />
            </Box>
          )}
          {view === 'day' && (
            <TimelineDay
              events={filteredTimelineEvents}
              date={dayViewDate}
              onEventCreate={handleEventCreate}
              onEventEdit={handleEventEdit}
              orgSummary={timelineOrgSummary}
            />
          )}
          {view === 'list' && <ScheduleListView />}
          {view === 'userCare' && (
            <Stack spacing={3}>
              <BriefingPanel />
              <UserTab />
              <StaffTab />
            </Stack>
          )}
          {view === 'org' && <OrgTab />}

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

      <UserScheduleModal
        open={userDialogOpen}
        initial={dialogInitial}
        existingSchedules={timelineEvents}
        onClose={handleDialogClose}
        onSubmit={handleDialogSubmit}
      />

      <StaffScheduleModal
        open={staffDialogOpen}
        initial={dialogInitial}
        existingSchedules={timelineEvents}
        onClose={handleDialogClose}
        onSubmit={handleDialogSubmit}
      />

      <OrgScheduleModal
        open={orgDialogOpen}
        initial={dialogInitial}
        existingSchedules={timelineEvents}
        onClose={handleDialogClose}
        onSubmit={handleDialogSubmit}
      />
      {snackbarUi}
    </Container>
  );
}
