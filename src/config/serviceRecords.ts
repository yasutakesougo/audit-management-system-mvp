import { getParsedEnv, ParsedEnv, resetParsedEnvForTests } from '@/lib/env.schema';

type ServiceRecordsOverrides = Partial<ParsedEnv>;

type ServiceRecordsConfig = {
  discrepancyThreshold: number;
  absenceMonthlyLimit: number;
  facilityCloseTime: string;
};

// 型を外部でも使用可能にエクスポート
export type { ServiceRecordsConfig, ServiceRecordsOverrides };

/**
 * HH:mm 形式の時刻文字列を分に変換
 * @param timeString HH:mm 形式の時刻（例: '17:30'）
 * @returns 0時からの分数（例: 1050分）
 */
const parseTimeToMinutes = (timeString: string): number => {
  const match = timeString.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid time format: ${timeString}. Expected HH:mm format.`);
  }
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  return hours * 60 + minutes;
};

const computeConfig = (overrides?: ServiceRecordsOverrides): ServiceRecordsConfig => {
  const env = getParsedEnv(overrides);
  return {
    discrepancyThreshold: env.VITE_ATTENDANCE_DISCREPANCY_THRESHOLD,
    absenceMonthlyLimit: env.VITE_ABSENCE_MONTHLY_LIMIT,
    facilityCloseTime: env.VITE_FACILITY_CLOSE_TIME,
  };
};

let cachedConfig: ServiceRecordsConfig | null = null;

const getCachedConfig = (): ServiceRecordsConfig => {
  if (!cachedConfig) {
    cachedConfig = computeConfig();
  }
  return cachedConfig;
};

/**
 * アプリケーション起動時の環境変数から決定される固定定数
 * 注意: これらはキャッシュされた値です。テストで env を動的に変更する場合は getServiceRecordsConfig() を使用してください。
 */
export const DISCREPANCY_THRESHOLD = getCachedConfig().discrepancyThreshold;
export const ABSENCE_MONTHLY_LIMIT = getCachedConfig().absenceMonthlyLimit;
export const FACILITY_CLOSE_TIME = getCachedConfig().facilityCloseTime;

/**
 * サービス記録設定を取得（オーバーライド対応）
 * @param overrides 環境変数のオーバーライド（テスト時などに使用）
 * @returns サービス記録設定
 */
export const getServiceRecordsConfig = (overrides?: ServiceRecordsOverrides): ServiceRecordsConfig =>
  computeConfig(overrides);

export const getServiceThresholds = (overrides?: ServiceRecordsOverrides) => {
  const config = getServiceRecordsConfig(overrides);
  return {
    /** 乖離許容時間（分）- 時間から分に変換（四捨五入） */
    discrepancyMinutes: Math.round(config.discrepancyThreshold * 60),
    /** 月間欠席上限回数 */
    absenceMonthlyLimit: config.absenceMonthlyLimit,
    /** 施設閉所時刻（HH:mm形式） */
    facilityCloseTime: config.facilityCloseTime,
    /** 施設閉所時刻（0時からの分数） */
    facilityCloseMinutes: parseTimeToMinutes(config.facilityCloseTime),
  } as const;
};

export const resetServiceRecords = (): void => {
  cachedConfig = null;
  resetParsedEnvForTests();
};

export const __resetServiceRecordsForTests = resetServiceRecords;
