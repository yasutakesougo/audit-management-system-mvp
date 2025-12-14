import { SERVICE_TYPE_LABELS, normalizeServiceType as normalizeSharePointServiceType } from '@/sharepoint/serviceTypes';
import type { ScheduleServiceType } from './data';

export type ServiceTypeKey = Extract<
  ScheduleServiceType,
  | 'normal'
  | 'transport'
  | 'respite'
  | 'meeting'
  | 'training'
  | 'nursing'
  | 'absence'
  | 'late'
  | 'earlyLeave'
  | 'other'
> | 'unset';

export type ServiceTypeMeta = {
  key: ServiceTypeKey;
  label: string;
  color: ServiceTypeColor;
};

export type ServiceTypeColor = 'default' | 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'error';

const RAW_TO_KEY: Record<string, ServiceTypeKey> = {
  normal: 'normal',
  transport: 'transport',
  respite: 'respite',
  meeting: 'meeting',
  training: 'training',
  nursing: 'nursing',
  absence: 'absence',
  late: 'late',
  earlyLeave: 'earlyLeave',
  other: 'other',
  未設定: 'unset',
  // Japanese labels
  '通常利用': 'normal',
  '日中活動': 'normal',
  '送迎': 'transport',
  '一時ケア・短期': 'respite',
  '一時ケア': 'respite',
  'ショートステイ': 'respite',
  '看護': 'nursing',
  '欠席・休み': 'absence',
  '欠席': 'absence',
  '遅刻': 'late',
  '早退': 'earlyLeave',
  '会議': 'meeting',
  '面談': 'meeting',
  'イベント': 'meeting',
  '来客': 'meeting',
  '研修': 'training',
  'その他': 'other',
};

export const SERVICE_TYPE_COLOR: Record<ServiceTypeKey, ServiceTypeColor> = {
  normal: 'info',
  transport: 'info',
  respite: 'success',
  meeting: 'primary',
  training: 'primary',
  nursing: 'secondary',
  absence: 'error',
  late: 'warning',
  earlyLeave: 'warning',
  other: 'default',
  unset: 'default',
};

const SERVICE_TYPE_LABEL: Record<ServiceTypeKey, string> = {
  normal: SERVICE_TYPE_LABELS.normal,
  transport: SERVICE_TYPE_LABELS.transport,
  respite: SERVICE_TYPE_LABELS.respite,
  meeting: SERVICE_TYPE_LABELS.meeting,
  training: SERVICE_TYPE_LABELS.training,
  nursing: SERVICE_TYPE_LABELS.nursing,
  absence: SERVICE_TYPE_LABELS.absence,
  late: SERVICE_TYPE_LABELS.late,
  earlyLeave: SERVICE_TYPE_LABELS.earlyLeave,
  other: 'その他',
  unset: '未設定',
};

export const SERVICE_TYPE_META: Record<ServiceTypeKey, ServiceTypeMeta> = (Object.keys(SERVICE_TYPE_COLOR) as ServiceTypeKey[])
  .reduce<Record<ServiceTypeKey, ServiceTypeMeta>>((acc, key) => {
    acc[key] = {
      key,
      label: SERVICE_TYPE_LABEL[key],
      color: SERVICE_TYPE_COLOR[key],
    } satisfies ServiceTypeMeta;
    return acc;
  }, {} as Record<ServiceTypeKey, ServiceTypeMeta>);

const normalize = (value: string): string => value.trim();

const normalizeViaSharePoint = (value: string): ServiceTypeKey | null => {
  const normalized = normalizeSharePointServiceType(value);
  if (!normalized) return null;
  return RAW_TO_KEY[normalized] ?? null;
};

/** Map SharePoint raw string (JP labels or english keys) to domain key. */
export const normalizeServiceType = (raw?: string | null): ServiceTypeKey => {
  if (raw == null) return 'unset';
  const v = normalize(raw);
  if (!v) return 'unset';

  const fromSharePoint = normalizeViaSharePoint(v);
  if (fromSharePoint) return fromSharePoint;

  if ((Object.keys(SERVICE_TYPE_META) as ServiceTypeKey[]).includes(v as ServiceTypeKey)) {
    return v as ServiceTypeKey;
  }

  return RAW_TO_KEY[v] ?? 'other';
};
