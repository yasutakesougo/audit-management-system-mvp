import type { Schedule, BaseShiftWarning } from '@/features/schedule/types';
import type { Staff } from '@/types';

export type StaffPatternIndex = Record<string, {
  staffId: string;
  staffName?: string;
  workDays?: string[];
  baseWorkingDays?: string[];
}>;

export function summarizeBaseShiftWarnings(warnings: BaseShiftWarning[] = []): string {
  if (!warnings.length) {
    return '';
  }
  const staffLabels = warnings
    .map((warning) => warning.staffName ?? warning.staffId)
    .filter((value): value is string => Boolean(value && value.trim()));
  if (!staffLabels.length) {
    return '';
  }
  return `${staffLabels.join('、')}のシフトに注意が必要です`;
}

export function collectBaseShiftWarnings(schedule: Schedule, index?: StaffPatternIndex | null): BaseShiftWarning[] {
  if (!index) {
    return [];
  }

  const warnings: BaseShiftWarning[] = [];
  const staffIds = 'staffIds' in schedule && Array.isArray(schedule.staffIds)
    ? schedule.staffIds
    : [];
  for (const staffId of staffIds) {
    if (!staffId) continue;
    if (!index[staffId]) {
      warnings.push({
        staffId,
        staffName: undefined,
        reasons: ['day'],
      });
    }
  }
  return warnings;
}

export function buildStaffPatternIndex(staff: Staff[] | undefined | null): StaffPatternIndex | null {
  if (!staff?.length) {
    return null;
  }

  const index: StaffPatternIndex = {};
  for (const member of staff) {
    const staffKey = String(member.staffId ?? member.id ?? '').trim();
    if (!staffKey) {
      continue;
    }
    index[staffKey] = {
      staffId: staffKey,
      staffName: member.name,
      workDays: member.workDays,
      baseWorkingDays: member.baseWorkingDays,
    };
  }
  return index;
}
