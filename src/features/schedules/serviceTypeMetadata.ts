import type { ScheduleServiceType } from './data';

export type ServiceTypeKey = ScheduleServiceType;

export type ServiceTypeMeta = {
  key: ServiceTypeKey;
  label: string;
  color: 'default' | 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'error';
};

export const SERVICE_TYPE_META: Partial<Record<ServiceTypeKey, ServiceTypeMeta>> = {
  // 通所系・送迎系：info / primary
  normal: { key: 'normal', label: '通常', color: 'info' },
  transport: { key: 'transport', label: '送迎', color: 'primary' },
  '通常利用': { key: '通常利用', label: '通常利用', color: 'info' },
  '送迎': { key: '送迎', label: '送迎', color: 'primary' },
  '日中活動': { key: '日中活動', label: '日中活動', color: 'info' },

  // 短期入所・レスパイト：success 系
  respite: { key: 'respite', label: '一時ケア', color: 'success' },
  '一時ケア・短期': { key: '一時ケア・短期', label: '一時ケア・短期', color: 'success' },
  '一時ケア': { key: '一時ケア', label: '一時ケア', color: 'success' },
  'ショートステイ': { key: 'ショートステイ', label: 'ショートステイ', color: 'success' },

  // 欠席・遅刻・キャンセル：warning / error 系
  absence: { key: 'absence', label: '欠席', color: 'error' },
  late: { key: 'late', label: '遅刻', color: 'warning' },
  earlyLeave: { key: 'earlyLeave', label: '早退', color: 'warning' },
  '欠席・休み': { key: '欠席・休み', label: '欠席・休み', color: 'error' },

  // その他サービス：secondary / info
  meeting: { key: 'meeting', label: '会議', color: 'secondary' },
  training: { key: 'training', label: '研修', color: 'secondary' },
  nursing: { key: 'nursing', label: '看護', color: 'info' },
  '面談': { key: '面談', label: '面談', color: 'secondary' },
  '会議': { key: '会議', label: '会議', color: 'secondary' },
  '研修': { key: '研修', label: '研修', color: 'secondary' },
  '看護': { key: '看護', label: '看護', color: 'info' },
  'イベント': { key: 'イベント', label: 'イベント', color: 'secondary' },
  '来客': { key: '来客', label: '来客', color: 'secondary' },

  // 未設定・その他：default
  other: { key: 'other', label: 'その他', color: 'default' },
  'その他': { key: 'その他', label: 'その他', color: 'default' },
};

const normalize = (value: string): string => value.trim();

/** Get service type metadata with fallback to default */
export const getServiceTypeMeta = (key?: ServiceTypeKey | null): ServiceTypeMeta => {
  if (!key) return SERVICE_TYPE_META.other || { key: 'other', label: 'その他', color: 'default' };
  return SERVICE_TYPE_META[key] || SERVICE_TYPE_META.other || { key: 'other', label: 'その他', color: 'default' };
};

/** Map SharePoint raw string (JP labels or english keys) to domain key. */
export const normalizeServiceType = (raw?: string | null): ServiceTypeKey => {
  if (raw == null) return 'other';
  const v = normalize(raw);
  if (!v) return 'other';

  // Direct match in metadata
  if ((Object.keys(SERVICE_TYPE_META) as ServiceTypeKey[]).includes(v as ServiceTypeKey)) {
    return v as ServiceTypeKey;
  }

  // Fallback mappings for legacy or alternate names
  const legacyMap: Record<string, ServiceTypeKey> = {
    '欠席': 'absence',
    '遅刻': 'late',
    '早退': 'earlyLeave',
  };

  return legacyMap[v] ?? 'other';
};
