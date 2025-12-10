export type ServiceTypeKey =
  | 'unset'
  | 'normal'
  | 'transport'
  | 'meeting'
  | 'training'
  | 'respite'
  | 'absence'
  | 'late'
  | 'earlyLeave'
  | 'other';

export type ServiceTypeMeta = {
  key: ServiceTypeKey;
  label: string;
  color: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info' | 'secondary';
};

export const SERVICE_TYPE_META: Record<ServiceTypeKey, ServiceTypeMeta> = {
  unset: { key: 'unset', label: '区分未設定', color: 'default' },
  normal: { key: 'normal', label: '通所', color: 'primary' },
  transport: { key: 'transport', label: '送迎', color: 'info' },
  meeting: { key: 'meeting', label: '会議', color: 'info' },
  training: { key: 'training', label: '研修', color: 'success' },
  respite: { key: 'respite', label: 'レスパイト', color: 'success' },
  absence: { key: 'absence', label: '欠席', color: 'error' },
  late: { key: 'late', label: '遅刻', color: 'warning' },
  earlyLeave: { key: 'earlyLeave', label: '早退', color: 'warning' },
  other: { key: 'other', label: 'その他', color: 'default' },
};

const normalize = (value: string): string => value.trim();

/** Map SharePoint raw string (JP labels or english keys) to domain key. */
export const normalizeServiceType = (raw?: string | null): ServiceTypeKey => {
  const v = normalize(raw ?? '');
  if (!v) return 'unset';

  // Japanese labels → english keys
  if (v === '通所') return 'normal';
  if (v === '送迎') return 'transport';
  if (v === '会議') return 'meeting';
  if (v === '研修') return 'training';
  if (v === 'レスパイト') return 'respite';
  if (v === '欠席') return 'absence';
  if (v === '遅刻') return 'late';
  if (v === '早退') return 'earlyLeave';
  if (v === 'その他') return 'other';
  if (v === '区分未設定' || v === '未設定') return 'unset';

  // Already english keys
  const known: ServiceTypeKey[] = [
    'unset',
    'normal',
    'transport',
    'meeting',
    'training',
    'respite',
    'absence',
    'late',
    'earlyLeave',
    'other',
  ];
  if (known.includes(v as ServiceTypeKey)) return v as ServiceTypeKey;

  return 'unset';
};
