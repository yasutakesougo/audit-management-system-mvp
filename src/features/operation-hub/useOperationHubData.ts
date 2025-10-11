import { useCallback, useMemo } from 'react';
import { formatInTimeZone } from '@/lib/tz';
import { addMinutes, differenceInCalendarDays, differenceInMinutes, isAfter, isBefore, set } from 'date-fns';
import type { Staff, User } from '@/types';
import type { Schedule } from '@/lib/mappers';
import { useSchedules } from '@/stores/useSchedules';
import { useUsers } from '@/stores/useUsers';
import { useStaff } from '@/stores/useStaff';
import { getNow } from '@/utils/getNow';
import { formatRangeLocal } from '@/utils/datetime';
import { ensureOperationHubLists, useEnsureOperationHubLists } from './ensureCoreLists';
import { useSP } from '@/lib/spClient';

export type KpiCardData = {
  id: string;
  title: string;
  value: string;
  helper: string;
  tone: 'success' | 'error' | 'info';
  helperAction?: string;
};

export type AlertItem = {
  id: string;
  tone: 'error' | 'warning' | 'info';
  message: string;
};

export type ContractExpiryItem = {
  id: string;
  userId: number;
  name: string;
  code: string;
  contractEndDate: string;
  status?: string;
  daysRemaining: number;
};

export type TimelineEvent = {
  id: string;
  label: string;
  detail?: string;
  start: Date;
  end: Date;
  color: string;
  conflict?: boolean;
};

export type TimelineResource = {
  id: string;
  name: string;
  employmentType: '常勤' | '非常勤' | '施設長' | 'その他';
  groupLabel: string;
  events: TimelineEvent[];
};

export type TimelineData = {
  start: Date;
  end: Date;
  slotMinutes: number;
  resources: TimelineResource[];
};

export type MobileTaskAction = {
  label: string;
  color: 'primary' | 'success';
  fullWidth?: boolean;
};

export type MobileTask = {
  id: string;
  time: string;
  title: string;
  status: 'completed' | 'alert' | 'pending';
  accent: string;
  note?: string;
  actions?: MobileTaskAction[];
};

export type OperationHubData = {
  loading: boolean;
  ready: boolean;
  errors: { schedules?: string; users?: string; staff?: string };
  dateLabel: string;
  dateISO: string;
  kpis: KpiCardData[];
  alerts: AlertItem[];
  contractExpirations: ContractExpiryItem[];
  timeline: TimelineData | null;
  mobileTasks: MobileTask[];
  unassignedSchedules: Schedule[];
  staff: Staff[];
  users: User[];
  refresh: () => Promise<void>;
};

const TIME_ZONE = 'Asia/Tokyo';
const SLOT_MINUTES = 30;
const DAILY_EXPECTED_HOURS = 8;

const CATEGORY_COLORS: Record<string, string> = {
  '生活介護': '#0078D4',
  '一時ケア': '#107C10',
  'ショートステイ': '#D83B01',
  '送迎': '#B146C2',
  '来客': '#5C2D91',
  'イベント': '#B146C2',
};

const ACCENT_FALLBACK = '#605E5C';

const classifyEmployment = (staff: Staff | undefined): TimelineResource['employmentType'] => {
  if (!staff) return 'その他';
  const source = staff.employmentType ?? staff.role ?? '';
  if (/施設長|管理者/.test(source)) return '施設長';
  if (/非常勤|パート|アルバイト/.test(source)) return '非常勤';
  if (/常勤|正社員/.test(source)) return '常勤';
  return 'その他';
};

const resolveGroupLabel = (type: TimelineResource['employmentType']): string => {
  switch (type) {
    case '施設長':
      return '施設長';
    case '常勤':
      return '常勤職員';
    case '非常勤':
      return '非常勤職員';
    default:
      return 'その他リソース';
  }
};

const parseIso = (iso?: string | null): Date | null => {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
};

const clampToDate = (value: Date, dayStart: Date, dayEnd: Date): Date => {
  if (isBefore(value, dayStart)) return new Date(dayStart);
  if (isAfter(value, dayEnd)) return new Date(dayEnd);
  return value;
};

const toTimelineEvents = (
  schedules: Schedule[],
  staffMap: Map<number, Staff>,
  dayStart: Date,
  dayEnd: Date
): TimelineResource[] => {
  const resources = new Map<string, TimelineResource>();

  for (const schedule of schedules) {
    const { staffId, staffNames = [], title, category, notes } = schedule;
    const start = parseIso(schedule.startLocal ?? schedule.startUtc);
    const end = parseIso(schedule.endLocal ?? schedule.endUtc);
    if (!start || !end) continue;

    const clampedStart = clampToDate(start, dayStart, dayEnd);
    const clampedEnd = clampToDate(end, dayStart, dayEnd);
    if (clampedEnd <= clampedStart) continue;

    const color = CATEGORY_COLORS[category ?? ''] ?? ACCENT_FALLBACK;

    const staffCandidates: Array<{ id: string; staff?: Staff; name: string }> = [];
    if (staffId != null) {
      const staff = staffMap.get(staffId);
      if (staff) {
        staffCandidates.push({ id: String(staff.id), staff, name: staff.name || `職員#${staff.id}` });
      }
    }
    if (!staffCandidates.length && staffNames.length) {
      for (const name of staffNames) {
        const trimmed = name.trim();
        if (!trimmed) continue;
        const match = Array.from(staffMap.values()).find((member) => member.name === trimmed);
        staffCandidates.push({
          id: `name:${trimmed}`,
          staff: match,
          name: trimmed,
        });
      }
    }
    if (!staffCandidates.length) {
      staffCandidates.push({ id: 'unassigned', name: '未割当', staff: undefined });
    }

    for (const candidate of staffCandidates) {
      const employmentType = classifyEmployment(candidate.staff);
      const resourceId = `${employmentType}:${candidate.id}`;
      if (!resources.has(resourceId)) {
        resources.set(resourceId, {
          id: resourceId,
          name: candidate.name,
          employmentType,
          groupLabel: resolveGroupLabel(employmentType),
          events: [],
        });
      }
      resources.get(resourceId)!.events.push({
        id: `${schedule.id}-${candidate.id}`,
        label: title || '無題の予定',
        detail: notes ?? undefined,
        start: clampedStart,
        end: clampedEnd,
        color,
      });
    }
  }

  const resourceArray = Array.from(resources.values());
  for (const resource of resourceArray) {
    resource.events.sort((a, b) => a.start.getTime() - b.start.getTime());
    markConflicts(resource.events);
  }
  resourceArray.sort((a, b) => {
    if (a.employmentType === b.employmentType) {
      return a.name.localeCompare(b.name, 'ja');
    }
    const weight = (type: TimelineResource['employmentType']): number => {
      switch (type) {
        case '施設長':
          return 0;
        case '常勤':
          return 1;
        case '非常勤':
          return 2;
        default:
          return 3;
      }
    };
    return weight(a.employmentType) - weight(b.employmentType);
  });
  return resourceArray;
};

const markConflicts = (events: TimelineEvent[]): void => {
  for (let i = 0; i < events.length; i += 1) {
    const current = events[i];
    for (let j = i + 1; j < events.length; j += 1) {
      const next = events[j];
      if (next.start >= current.end) {
        break;
      }
      current.conflict = true;
      next.conflict = true;
    }
  }
};

const sumStaffHours = (schedules: Schedule[]): number => {
  let totalHours = 0;
  for (const schedule of schedules) {
    const start = parseIso(schedule.startLocal ?? schedule.startUtc);
    const end = parseIso(schedule.endLocal ?? schedule.endUtc);
    if (!start || !end) continue;
    const diffMinutes = Math.max(0, differenceInMinutes(end, start));
    totalHours += diffMinutes / 60;
  }
  return totalHours;
};

const findExpiringUsers = (users: User[], reference: Date): AlertItem[] => {
  const items: AlertItem[] = [];
  for (const user of users) {
    const expiry = user.certExpiry ? parseIso(`${user.certExpiry}T00:00:00Z`) : null;
    if (!expiry) continue;
    const days = differenceInCalendarDays(expiry, reference);
    if (days < 0) continue;
    if (days <= 30) {
      const dateLabel = formatInTimeZone(expiry, TIME_ZONE, 'M月d日');
      items.push({
        id: `cert-${user.id}`,
        tone: days <= 7 ? 'error' : 'warning',
        message: `利用者${user.name || `#${user.userId}`}の受給者証が${dateLabel}に期限切れです。`,
      });
    }
  }
  return items;
};

const findContractExpirations = (): ContractExpiryItem[] => {
  // Users_Master の契約関連列が利用できなくなったため、現状は契約期限の集計を行わない。
  return [];
};

const findStaffAlerts = (staff: Staff[]): AlertItem[] => {
  const items: AlertItem[] = staff
    .filter((member) => (member.certifications ?? []).some((cert) => /更新|期限|要更新/i.test(cert)))
    .map((member) => ({
      id: `staff-cert-${member.id}`,
      tone: 'warning' as const,
      message: `${member.name || `職員#${member.id}`}の資格更新期限が近づいています。`,
    }));

  if (!items.length) {
    const missingRole = staff.filter((member) => !member.role?.trim()).slice(0, 1);
    items.push(
      ...missingRole.map((member) => ({
        id: `staff-role-${member.id}`,
        tone: 'info' as const,
        message: `${member.name || `職員#${member.id}`}の役割情報が未入力です。`,
      }))
    );
  }

  return items;
};

const toMobileTasks = (
  schedules: Schedule[],
  focusStaff: Staff | null,
  reference: Date
): MobileTask[] => {
  const targetSchedules = focusStaff
    ? schedules.filter((item) => item.staffId === focusStaff.id || (item.staffNames ?? []).includes(focusStaff.name))
    : schedules;

  const sorted = targetSchedules.slice().sort((a, b) => {
    const aStart = parseIso(a.startLocal ?? a.startUtc)?.getTime() ?? 0;
    const bStart = parseIso(b.startLocal ?? b.startUtc)?.getTime() ?? 0;
    return aStart - bStart;
  });

  return sorted.slice(0, 6).map((schedule) => {
    const start = parseIso(schedule.startLocal ?? schedule.startUtc) ?? reference;
    const end = parseIso(schedule.endLocal ?? schedule.endUtc) ?? addMinutes(start, 60);
    const range = formatRangeLocal(schedule.startLocal ?? schedule.startUtc, schedule.endLocal ?? schedule.endUtc, {
      roundTo: 5,
      tz: TIME_ZONE,
    });

    let status: MobileTask['status'] = 'pending';
    if (isBefore(end, reference)) {
      status = 'completed';
    } else if (isBefore(start, addMinutes(reference, 30))) {
      status = 'alert';
    }

    const accent = CATEGORY_COLORS[schedule.category ?? ''] ?? ACCENT_FALLBACK;

    const actions: MobileTaskAction[] = [];
    actions.push({ label: 'サービス記録', color: 'primary' });
    if (status === 'alert') {
      actions.push({ label: '緊急連絡', color: 'success' });
    }

    return {
      id: `task-${schedule.id}`,
      time: range,
      title: schedule.title || '無題の予定',
      status,
      accent,
      note: schedule.notes ?? undefined,
      actions,
    } satisfies MobileTask;
  });
};

export function useOperationHubData(): OperationHubData {
  const sp = useSP();
  useEnsureOperationHubLists(sp);

  const {
    data: scheduleData,
    loading: schedulesLoading,
    error: schedulesError,
    reload: reloadSchedules,
  } = useSchedules();
  const {
    data: userData,
    loading: usersLoading,
    error: usersError,
    reload: reloadUsers,
  } = useUsers();
  const {
    data: staffData,
    loading: staffLoading,
    error: staffError,
    reload: reloadStaff,
  } = useStaff();

  const loading = schedulesLoading || usersLoading || staffLoading;
  const ready = Boolean(scheduleData && userData && staffData);

  const now = useMemo(() => getNow(), []);
  const todayKey = useMemo(() => formatInTimeZone(now, TIME_ZONE, 'yyyy-MM-dd'), [now]);
  const dateLabel = useMemo(() => formatInTimeZone(now, TIME_ZONE, 'yyyy年M月d日 (EEE)'), [now]);

  const staffMap = useMemo(() => {
    const map = new Map<number, Staff>();
    for (const member of staffData ?? []) {
      map.set(member.id, member);
    }
    return map;
  }, [staffData]);

  const todaysSchedules = useMemo(() => {
    if (!scheduleData) return [] as Schedule[];
    const results: Schedule[] = [];
    for (const schedule of scheduleData) {
      const start = schedule.startDate ?? schedule.startLocal ?? schedule.startUtc ?? '';
      const end = schedule.endDate ?? schedule.endLocal ?? schedule.endUtc ?? start;
      const startDate = start.slice(0, 10);
      const endDate = end.slice(0, 10);
      if (!startDate || !endDate) continue;
      if (startDate <= todayKey && endDate >= todayKey) {
        results.push(schedule);
      }
    }
    return results;
  }, [scheduleData, todayKey]);

  const totalStaffCount = useMemo(
    () => (staffData ?? []).filter((member) => member.active !== false).length,
    [staffData]
  );

  const totalStaffHours = useMemo(() => sumStaffHours(todaysSchedules), [todaysSchedules]);
  const staffedEquivalents = totalStaffHours / DAILY_EXPECTED_HOURS;
  const coverageRate = totalStaffCount > 0 ? Math.min(1, totalStaffHours / (totalStaffCount * DAILY_EXPECTED_HOURS)) : 0;

  const unassignedSchedules = useMemo(
    () => todaysSchedules.filter((item) => !item.staffId && !(item.staffNames && item.staffNames.length)),
    [todaysSchedules]
  );

  const pendingApprovals = useMemo(
    () => todaysSchedules.filter((item) => item.status === 'submitted'),
    [todaysSchedules]
  );

  const kpis = useMemo<KpiCardData[]>(() => [
    {
      id: 'coverage',
      title: '本日の職員配置充足率',
      value: `${Math.round(coverageRate * 100)}%`,
      helper: `必要人数換算: ${totalStaffCount} / 配置済: ${staffedEquivalents.toFixed(1)}`,
      tone: coverageRate >= 0.9 ? 'success' : coverageRate >= 0.75 ? 'info' : 'error',
    },
    {
      id: 'unassigned',
      title: '未割り当ての依頼',
      value: `${unassignedSchedules.length}件`,
      helper: unassignedSchedules.length ? '担当者を割り当ててください' : 'すべて割り当て済みです',
      tone: unassignedSchedules.length ? 'error' : 'success',
      helperAction: unassignedSchedules.length ? '未割り当て一覧を見る' : undefined,
    },
    {
      id: 'pending-approvals',
      title: '承認待ちの申請（休暇・シフト変更）',
      value: `${pendingApprovals.length}件`,
      helper: pendingApprovals.length ? '承認が必要な申請があります' : '承認待ちはありません',
      tone: pendingApprovals.length ? 'info' : 'success',
    },
  ], [coverageRate, pendingApprovals.length, staffedEquivalents, totalStaffCount, unassignedSchedules.length]);

  const alerts = useMemo<AlertItem[]>(() => {
    const userAlerts = findExpiringUsers(userData ?? [], now);
    const staffAlerts = findStaffAlerts(staffData ?? []);
    if (userAlerts.length || staffAlerts.length) {
      return [...userAlerts, ...staffAlerts];
    }
    return [{
      id: 'no-alerts',
      tone: 'info',
      message: '重大なアラートはありません。',
    }];
  }, [now, staffData, userData]);

  const contractExpirations = useMemo(() => findContractExpirations(), []);

  const timeline = useMemo<TimelineData | null>(() => {
    if (!todaysSchedules.length) return null;
    let minStart: Date | null = null;
    let maxEnd: Date | null = null;
    for (const schedule of todaysSchedules) {
      const start = parseIso(schedule.startLocal ?? schedule.startUtc);
      const end = parseIso(schedule.endLocal ?? schedule.endUtc);
      if (!start || !end) continue;
      if (!minStart || start < minStart) {
        minStart = start;
      }
      if (!maxEnd || end > maxEnd) {
        maxEnd = end;
      }
    }

    if (!minStart || !maxEnd) {
      const defaultStart = set(now, { hours: 9, minutes: 0, seconds: 0, milliseconds: 0 });
      const defaultEnd = set(defaultStart, { hours: 18, minutes: 0, seconds: 0, milliseconds: 0 });
      minStart = defaultStart;
      maxEnd = defaultEnd;
    }

    const resources = toTimelineEvents(todaysSchedules, staffMap, minStart, maxEnd);
    return {
      start: minStart,
      end: maxEnd,
      slotMinutes: SLOT_MINUTES,
      resources,
    } satisfies TimelineData;
  }, [now, staffMap, todaysSchedules]);

  const focusStaff = useMemo(() => {
    if (!staffData?.length) return null;
    return staffData.find((member) => /非常勤|パート|アルバイト/.test(member.role ?? '')) ?? staffData[0];
  }, [staffData]);

  const mobileTasks = useMemo(
    () => toMobileTasks(todaysSchedules, focusStaff, now),
    [focusStaff, now, todaysSchedules]
  );

  const refresh = useCallback(async () => {
    await ensureOperationHubLists(sp);
    await Promise.allSettled([reloadSchedules(), reloadUsers(), reloadStaff()]);
  }, [reloadSchedules, reloadStaff, reloadUsers, sp]);

  return {
    loading,
    ready,
    errors: {
      schedules: schedulesError?.message,
      users: usersError?.message,
      staff: staffError?.message,
    },
    dateLabel,
  dateISO: todayKey,
    kpis,
  alerts,
  contractExpirations,
    timeline,
    mobileTasks,
    unassignedSchedules,
    staff: staffData ?? [],
    users: userData ?? [],
    refresh,
  } satisfies OperationHubData;
}
