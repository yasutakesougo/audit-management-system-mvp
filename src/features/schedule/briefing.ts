import { addDays } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from '@/lib/tz';
import type { UseSP } from '@/lib/spClient';
import { getUserCareSchedules } from './spClient.schedule';
import { getOrgSchedules } from './spClient.schedule.org';
import { getStaffSchedules } from './spClient.schedule.staff';
import type { ScheduleOrg, ScheduleStaff, ScheduleUserCare } from './types';

const TIME_ZONE = 'Asia/Tokyo';
const EN_DASH = '\u2013';

type BriefingItemKind = ScheduleOrg['category'] | ScheduleStaff['category'] | ScheduleUserCare['category'];

export type BriefingItem = {
  kind: BriefingItemKind;
  id: string;
  text: string;
  start: string;
  end: string;
};

export type BriefingBundle = {
  date: string;
  items: BriefingItem[];
  sources: {
    userCare: ScheduleUserCare[];
    org: ScheduleOrg[];
    staff: ScheduleStaff[];
  };
};

const toDayRange = (reference: Date): { startIso: string; endIso: string; dateKey: string } => {
  const targetKey = formatInTimeZone(reference, TIME_ZONE, 'yyyy-MM-dd');
  const dayStart = fromZonedTime(`${targetKey}T00:00:00`, TIME_ZONE);
  const dayEnd = addDays(dayStart, 1);
  return { startIso: dayStart.toISOString(), endIso: dayEnd.toISOString(), dateKey: targetKey };
};

const formatTimeRange = (startIso: string, endIso: string, allDay: boolean): string => {
  if (allDay) return '終日';
  const startLabel = formatInTimeZone(startIso, TIME_ZONE, 'HH:mm');
  const endLabel = formatInTimeZone(endIso, TIME_ZONE, 'HH:mm');
  if (!startLabel || !endLabel) return '';
  return `${startLabel}${EN_DASH}${endLabel}`;
};

const buildOrgLine = (org: ScheduleOrg): BriefingItem => {
  const title = org.title?.trim() || '予定';
  const headParts: string[] = [];
  if (org.externalOrgName?.trim()) {
    headParts.push(org.externalOrgName.trim());
  }
  if (org.subType?.trim()) {
    headParts.push(org.subType.trim());
  }
  let head = headParts.join(' / ');
  if (org.location?.trim()) {
    head = head ? `${head}・${org.location.trim()}` : org.location.trim();
  }
  const label = head ? `${head}：${title}` : title;
  const time = formatTimeRange(org.start, org.end, org.allDay);
  const text = time ? `${label} ${time}`.trim() : label;
  return {
    kind: 'Org',
    id: org.id,
    text,
    start: org.start,
    end: org.end,
  };
};

const normalizeNames = (names?: string[], fallbacks?: string[]): string => {
  if (names && names.length) {
    const trimmed = names.map((name) => name.trim()).filter(Boolean);
    if (trimmed.length) {
      return trimmed.join('・');
    }
  }
  if (fallbacks && fallbacks.length) {
    const trimmed = fallbacks.map((name) => name.trim()).filter(Boolean);
    if (trimmed.length) {
      return trimmed.join('・');
    }
  }
  return '';
};

const buildStaffLine = (staff: ScheduleStaff): BriefingItem => {
  const names = normalizeNames(staff.staffNames, staff.staffIds);
  const labelBase = names || staff.title?.trim() || '職員';
  const dayPart = staff.dayPart && staff.dayPart !== 'Full' ? staff.dayPart : null;
  const activity = staff.subType?.trim() || staff.title?.trim() || '';
  const activityLabel = activity ? (dayPart ? `${activity}(${dayPart})` : activity) : dayPart ? `(${dayPart})` : '';
  const head = activityLabel ? `${labelBase} ${activityLabel}` : labelBase;
  const time = formatTimeRange(staff.start, staff.end, staff.allDay);
  const text = time ? `${head} ${time}`.trim() : head;
  return {
    kind: 'Staff',
    id: staff.id,
    text,
    start: staff.start,
    end: staff.end,
  };
};

const buildUserLine = (user: ScheduleUserCare): BriefingItem => {
  const personName = user.personType === 'External'
    ? (user.externalPersonName?.trim() || '外部利用者')
    : (user.personName?.trim() || user.title?.trim() || '利用者');
  const service = user.serviceType?.trim() || '';
  const staffNames = normalizeNames(user.staffNames);
  const time = formatTimeRange(user.start, user.end, user.allDay);
  const contextParts: string[] = [];
  if (service) contextParts.push(service);
  if (user.personType === 'External' && user.externalPersonOrg?.trim()) {
    contextParts.push(user.externalPersonOrg.trim());
  }
  const header = contextParts.length ? `${personName} ${contextParts.join(' ')}` : personName;
  const tailParts: string[] = [];
  if (staffNames) {
    tailParts.push(`担当: ${staffNames}`);
  }
  if (user.location?.trim()) {
    tailParts.push(user.location.trim());
  }
  const suffix = tailParts.length ? `（${tailParts.join(' / ')}）` : '';
  const label = `${header}${suffix}`;
  const text = time ? `${label} ${time}`.trim() : label;
  return {
    kind: 'User',
    id: user.id,
    text,
    start: user.start,
    end: user.end,
  };
};

const sortByStart = <T extends { start: string }>(a: T, b: T): number => {
  const aTime = new Date(a.start).getTime();
  const bTime = new Date(b.start).getTime();
  if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
  if (Number.isNaN(aTime)) return 1;
  if (Number.isNaN(bTime)) return -1;
  return aTime - bTime;
};

export async function getBriefingForDay(sp: UseSP, reference: Date): Promise<BriefingBundle> {
  const { startIso, endIso, dateKey } = toDayRange(reference);

  const [userCare, org, staff] = await Promise.all([
    getUserCareSchedules(sp, { start: startIso, end: endIso, top: 200 }),
    getOrgSchedules(sp, { start: startIso, end: endIso, top: 200 }),
    getStaffSchedules(sp, { start: startIso, end: endIso, top: 200 }),
  ]);

  const items: BriefingItem[] = [
    ...org.map(buildOrgLine),
    ...staff.map(buildStaffLine),
    ...userCare.map(buildUserLine),
  ].sort(sortByStart);

  return {
    date: dateKey,
    items,
    sources: { userCare, org, staff },
  };
}
