/**
 * 障害者支援施設で提供されるサービス種別の標準定義
 * SharePointの「ServiceType」フィールドで使用される値の正規化に使用
 */
export const SERVICE_TYPE_OPTIONS = [
  '通常利用',        // 生活介護などの通常支援
  '送迎',           // 利用者の送迎サービス
  '一時ケア・短期',   // レスパイト/短期入所系
  '看護',           // 看護師による医療的ケア
  '欠席・休み',       // 欠席やお休み連絡
  // 既存データ互換用の従来値
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

/**
 * サービス種別の型定義（10種類の文字列リテラル型）
 */
export type ServiceType = (typeof SERVICE_TYPE_OPTIONS)[number];

/**
 * 入力値を標準のサービス種別に正規化する
 * @param value 正規化対象の文字列（SharePointから取得した値など）
 * @returns 正規化されたServiceType、または一致しない場合はnull
 * @example
 * ```typescript
 * normalizeServiceType('日中活動')     // '日中活動'
 * normalizeServiceType(' 面談 ')      // '面談' (前後空白を除去)
 * normalizeServiceType('不明な値')     // null
 * normalizeServiceType(null)         // null
 * ```
 */
export function normalizeServiceType(value: string | null | undefined): ServiceType | null {
  if (!value) return null;
  const trimmed = value.trim();
  const match = SERVICE_TYPE_OPTIONS.find((option) => option === trimmed);
  return match ?? null;
}
