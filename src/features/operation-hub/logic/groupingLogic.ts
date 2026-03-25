import type { Staff } from '@/types';
import type { TimelineResource } from '../useOperationHubData';

export const classifyEmployment = (staff: Staff | undefined): TimelineResource['employmentType'] => {
  if (!staff) return 'その他';
  const source = staff.employmentType ?? staff.role ?? '';
  if (/施設長|管理者/.test(source)) return '施設長';
  if (/非常勤|パート|アルバイト/.test(source)) return '非常勤';
  if (/常勤|正社員/.test(source)) return '常勤';
  return 'その他';
};

export const resolveGroupLabel = (type: TimelineResource['employmentType']): string => {
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
