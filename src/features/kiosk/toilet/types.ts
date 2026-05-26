export const TOILET_GUIDANCE_TARGET_USER_IDS = [
  'I005',
  'I022',
] as const;

export type ToiletType = 'urination' | 'bowel' | 'both' | 'other';
export type ToiletAmount = 'small' | 'normal' | 'large' | 'unknown';

export type ToiletRecord = {
  id: string;
  userId: string;
  occurredAt: string;
  toiletType: ToiletType;
  amount: ToiletAmount;
  memo: string;
  recorderName: string;
  source: 'kiosk';
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ToiletRecordInput = {
  userId: string;
  occurredAt: string;
  toiletType: ToiletType;
  amount: ToiletAmount;
  memo?: string;
  recorderName?: string;
};

export const TOILET_TYPE_LABELS: Record<ToiletType, string> = {
  urination: '排尿',
  bowel: '排便',
  both: '両方',
  other: 'その他',
};

export const TOILET_AMOUNT_LABELS: Record<ToiletAmount, string> = {
  small: '少量',
  normal: '普通',
  large: '多量',
  unknown: '不明',
};
