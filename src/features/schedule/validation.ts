import type { ScheduleUserCare } from './types';

export type ValidationIssue = {
  field: string;
  message: string;
};

const ensureIso = (value: string | null | undefined, field: string): void => {
  if (!value || !value.trim()) {
    throwObject({ field, message: '開始と終了の日時を入力してください。' });
  }
  const parsed = new Date(value as string);
  if (Number.isNaN(parsed.getTime())) {
    throwObject({ field, message: `${field} の日時形式が不正です。` });
  }
};

const throwObject = (issue: ValidationIssue): never => {
  const err = new Error(issue.message);
  (err as Error & { field?: string }).field = issue.field;
  throw err;
};

const ensureStaffAssigned = (ids: string[] | undefined): void => {
  if (!ids || !ids.length) {
    throwObject({ field: 'staffIds', message: '担当職員を1名以上選択してください。' });
  }
};

const ensureExternalName = (candidate: Partial<ScheduleUserCare>): void => {
  if (candidate.personType === 'External') {
    const name = candidate.externalPersonName?.trim();
    if (!name) {
      throwObject({ field: 'externalPersonName', message: '外部利用者の氏名を入力してください。' });
    }
  }
};

const ensureServiceRules = (candidate: Partial<ScheduleUserCare>): void => {
  if (candidate.serviceType === '一時ケア' && candidate.allDay) {
    throwObject({ field: 'allDay', message: '一時ケアは終日スケジュールを設定できません。' });
  }
};

const ensureChronology = (candidate: Partial<ScheduleUserCare>): void => {
  const startValue = candidate.start ?? null;
  const endValue = candidate.end ?? null;
  if (!startValue || !endValue) return;
  const startDate = new Date(startValue);
  const endDate = new Date(endValue);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return;
  if (endDate <= startDate) {
    throwObject({ field: 'end', message: '終了日時は開始日時より後に設定してください。' });
  }
};

export function validateUserCare(candidate: Partial<ScheduleUserCare>): void {
  ensureExternalName(candidate);
  ensureServiceRules(candidate);
  ensureChronology(candidate);
  ensureStaffAssigned(candidate.staffIds);
  ensureIso(candidate.start, 'start');
  ensureIso(candidate.end, 'end');
}
