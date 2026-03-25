import type { Schedule } from '@/lib/mappers';
import type { Staff } from '@/types';
import { isBefore, isAfter } from 'date-fns';
import type { TimelineResource, TimelineEvent } from '../useOperationHubData';
import { CATEGORY_COLORS, ACCENT_FALLBACK, parseIso } from '../useOperationHubData';
import { classifyEmployment, resolveGroupLabel } from './groupingLogic';

const clampToDate = (value: Date, dayStart: Date, dayEnd: Date): Date => {
  if (isBefore(value, dayStart)) return new Date(dayStart);
  if (isAfter(value, dayEnd)) return new Date(dayEnd);
  return value;
};

export const markConflicts = (events: TimelineEvent[]): void => {
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

export const toTimelineEvents = (
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
