import type { SpListEntry } from './spListRegistry.shared';
import { masterListEntries } from './definitions/master';
import { dailyListEntries } from './definitions/daily';
import { attendanceListEntries } from './definitions/attendance';
import { scheduleListEntries } from './definitions/schedule';
import { meetingListEntries } from './definitions/meeting';
import { handoffListEntries } from './definitions/handoff';
import { complianceListEntries } from './definitions/compliance';
import { otherListEntries } from './definitions/other';
import { supportCaseListEntries } from './definitions/supportCase';

export {
  masterListEntries,
  dailyListEntries,
  attendanceListEntries,
  scheduleListEntries,
  meetingListEntries,
  handoffListEntries,
  complianceListEntries,
  otherListEntries,
  supportCaseListEntries,
};

/** 全リスト定義の統合（参照等価性を維持するため） */
export const listDefinitions: readonly SpListEntry[] = [
  ...masterListEntries,
  ...dailyListEntries,
  ...attendanceListEntries,
  ...scheduleListEntries,
  ...meetingListEntries,
  ...handoffListEntries,
  ...complianceListEntries,
  ...otherListEntries,
  ...supportCaseListEntries,
];
