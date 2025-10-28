import { getParsedEnv, ParsedEnv, resetParsedEnvForTests } from '@/lib/env.schema';

type ServiceRecordsOverrides = Partial<ParsedEnv>;

type ServiceRecordsConfig = {
  discrepancyThreshold: number;
  absenceMonthlyLimit: number;
  facilityCloseTime: string;
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

export const DISCREPANCY_THRESHOLD = getCachedConfig().discrepancyThreshold;
export const ABSENCE_MONTHLY_LIMIT = getCachedConfig().absenceMonthlyLimit;
export const FACILITY_CLOSE_TIME = getCachedConfig().facilityCloseTime;

export const getServiceRecordsConfig = (overrides?: ServiceRecordsOverrides): ServiceRecordsConfig =>
  computeConfig(overrides);

export const getServiceThresholds = (overrides?: ServiceRecordsOverrides) => {
  const config = getServiceRecordsConfig(overrides);
  return {
    discrepancyMinutes: Math.round(config.discrepancyThreshold * 60),
    absenceMonthlyLimit: config.absenceMonthlyLimit,
    facilityCloseTime: config.facilityCloseTime,
  } as const;
};

export const resetServiceRecords = (): void => {
  cachedConfig = null;
  resetParsedEnvForTests();
};

export const __resetServiceRecordsForTests = resetServiceRecords;
