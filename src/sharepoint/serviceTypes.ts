/**
 * 障害者支援施設で提供されるサービス種別の標準定義
 * SharePointの「ServiceType」フィールドで使用される値の正規化に使用
 *
 * Schedules リストの英字コード（normal/transport/...）と、
 * 従来の日本語ラベルを併記して互換性を担保する。
 */
export const SERVICE_TYPE_OPTIONS = [
  // Schedules リスト互換（英字コード）
  'normal',
  'transport',
  'respite',
  'meeting',
  'training',
  'nursing',
  'absence',
  'late',        // 追加: 遅刻
  'earlyLeave',  // 追加: 早退
  'other',

  // 旧ScheduleEvents互換（日本語/既存ラベル）
  '通常利用',        // 生活介護などの通常支援
  '送迎',           // 利用者の送迎サービス
  '一時ケア・短期',   // レスパイト/短期入所系
  '看護',           // 看護師による医療的ケア
  '欠席・休み',       // 欠席やお休み連絡
  '日中活動',        // 旧ラベル（通常利用相当）
  '一時ケア',        // 旧ラベル（一時ケア・短期相当）
  'ショートステイ',   // 旧ラベル（一時ケア・短期相当）
  '面談',
  '会議',
  '研修',
  'イベント',
  '来客',
  'その他',
] as const;

const __ensureServiceTypeMeeting: ServiceType = 'meeting';

/** サービス種別の型定義（S P Choice と互換の列挙） */
export type ServiceType = (typeof SERVICE_TYPE_OPTIONS)[number];

export type ScheduleServiceType =
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
  | '通常利用'
  | '送迎'
  | '一時ケア・短期'
  | '看護'
  | '欠席・休み'
  | '日中活動'
  | '一時ケア'
  | 'ショートステイ'
  | '面談'
  | '会議'
  | '研修'
  | 'イベント'
  | '来客'
  | 'その他';

/**
 * 入力値を標準のサービス種別に正規化する
 * @param value 正規化対象の文字列（SharePointから取得した値など）
 * @returns 正規化されたServiceType、または一致しない場合はnull
 */
export function normalizeServiceType(value: string | null | undefined): ServiceType | null {
  if (!value) return null;
  const trimmed = value.trim();
  const match = SERVICE_TYPE_OPTIONS.find((option) => option === trimmed);
  return match ?? null;
}

/** 人間向けラベル辞書（英字コード -> 日本語） */
export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  normal: '通常',
  transport: '送迎',
  respite: '一時ケア',
  meeting: '会議',
  training: '研修',
  nursing: '看護',
  absence: '休み',
  late: '遅刻',
  earlyLeave: '早退',
  other: 'その他',
  '通常利用': '通常利用',
  '送迎': '送迎',
  '一時ケア・短期': '一時ケア・短期',
  '看護': '看護',
  '欠席・休み': '欠席・休み',
  '日中活動': '日中活動',
  '一時ケア': '一時ケア',
  'ショートステイ': 'ショートステイ',
  '面談': '面談',
  '会議': '会議',
  '研修': '研修',
  'イベント': 'イベント',
  '来客': '来客',
  'その他': 'その他',
};
