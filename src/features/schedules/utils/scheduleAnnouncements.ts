import dayjs from 'dayjs';
import type { CreateScheduleEventInput, ScheduleServiceType } from '../data';

type AnnouncementMode = 'create' | 'edit';

type TimeRangeInfo = {
  label: string;
  isAllDay: boolean;
};

const SERVICE_TYPE_LABELS: Partial<Record<ScheduleServiceType, string>> = {
  unset: '区分未設定',
  normal: '通常',
  transport: '送迎',
  meeting: '会議',
  training: '研修',
  respite: 'レスパイト',
  nursing: '看護',
  absence: '欠席',
  late: '遅刻',
  earlyLeave: '早退',
  other: 'その他',
};

const parseTime = (value?: string | null) => {
  if (!value) return null;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed : null;
};

const formatTimeRange = (startLocal?: string | null, endLocal?: string | null): TimeRangeInfo => {
  const start = parseTime(startLocal);
  const end = parseTime(endLocal);

  if (start && end) {
    if (end.diff(start, 'minute') === 0) {
      return { label: '終日の予定', isAllDay: true };
    }
    return { label: `${start.format('HH:mm')}〜${end.format('HH:mm')}`, isAllDay: false };
  }

  if (start) {
    return { label: `${start.format('HH:mm')}〜`, isAllDay: false };
  }

  if (end) {
    return { label: `${end.format('HH:mm')} まで`, isAllDay: false };
  }

  return { label: '時間未定', isAllDay: false };
};

const formatUserDisplay = (name?: string | null): string | null => {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  if (/さん$|様$/.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed}さん`;
};

const resolveTargetLabel = (userName?: string | null, fallbackTitle?: string): string => {
  const userDisplay = formatUserDisplay(userName);
  if (userDisplay) return userDisplay;
  const title = fallbackTitle?.trim();
  if (title) return title;
  return '予定';
};

const resolveServiceLabel = (serviceType?: ScheduleServiceType): string | null => {
  if (!serviceType || serviceType === 'unset') return null;
  return SERVICE_TYPE_LABELS[serviceType] ?? null;
};

const buildSentence = ({
  target,
  timeRange,
  serviceLabel,
  verb,
  failure,
}: {
  target: string;
  timeRange: TimeRangeInfo;
  serviceLabel: string | null;
  verb: '登録しました' | '更新しました';
  failure?: boolean;
}): string => {
  const servicePart = serviceLabel ? `（${serviceLabel}）` : '';
  const scheduleSegment = timeRange.isAllDay
    ? `${target} の${timeRange.label}`
    : `${target} ${timeRange.label} の予定`;
  if (failure) {
    const action = verb === '更新しました' ? '更新' : '登録';
    return `${scheduleSegment}${servicePart}を${action}できませんでした。入力内容を確認してください。`;
  }
  return `${scheduleSegment}${servicePart}を${verb}。`;
};

const resolveVerb = (mode: AnnouncementMode): '登録しました' | '更新しました' =>
  mode === 'edit' ? '更新しました' : '登録しました';

export const buildScheduleSuccessAnnouncement = ({
  input,
  userName,
  mode,
}: {
  input: CreateScheduleEventInput;
  userName?: string | null;
  mode: AnnouncementMode;
}): string => {
  const target = resolveTargetLabel(userName, input.title);
  const timeRange = formatTimeRange(input.startLocal, input.endLocal);
  const serviceLabel = resolveServiceLabel(input.serviceType);
  return buildSentence({ target, timeRange, serviceLabel, verb: resolveVerb(mode) });
};

export const buildScheduleFailureAnnouncement = ({
  input,
  userName,
  mode,
}: {
  input: CreateScheduleEventInput;
  userName?: string | null;
  mode: AnnouncementMode;
}): string => {
  const target = resolveTargetLabel(userName, input.title);
  const timeRange = formatTimeRange(input.startLocal, input.endLocal);
  const serviceLabel = resolveServiceLabel(input.serviceType);
  return buildSentence({ target, timeRange, serviceLabel, verb: resolveVerb(mode), failure: true });
};

export const __testing__ = {
  formatTimeRange,
  resolveTargetLabel,
  resolveServiceLabel,
};
