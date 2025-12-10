import type { ScheduleServiceType } from './data';

export type ServiceTypeKey = ScheduleServiceType;

export type ServiceTypeMeta = {
  key: ServiceTypeKey;
  label: string;
  color: 'default' | 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'error';
};

export const SERVICE_TYPE_META: Partial<Record<ServiceTypeKey, ServiceTypeMeta>> = {
  absence: { key: 'absence', label: '欠席', color: 'error' },
  late: { key: 'late', label: '遅刻', color: 'warning' },
  earlyLeave: { key: 'earlyLeave', label: '早退', color: 'info' },
  other: { key: 'other', label: 'その他', color: 'default' },
};

const normalize = (value: string): string => value.trim();

/** Map SharePoint raw string (JP labels or english keys) to domain key. */
export const normalizeServiceType = (raw?: string | null): ServiceTypeKey => {
  if (raw == null) return 'other';
  const v = normalize(raw);
  if (!v) return 'other';

  if ((Object.keys(SERVICE_TYPE_META) as ServiceTypeKey[]).includes(v as ServiceTypeKey)) {
    return v as ServiceTypeKey;
  }

  if (v === '欠席') return 'absence';
  if (v === '遅刻') return 'late';
  if (v === '早退') return 'earlyLeave';
  if (v === 'その他') return 'other';

  return 'other';
};
