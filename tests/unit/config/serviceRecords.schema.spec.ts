import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  ABSENCE_MONTHLY_LIMIT,
  DISCREPANCY_THRESHOLD,
  FACILITY_CLOSE_TIME,
  resetServiceRecords,
  getServiceRecordsConfig,
  getServiceThresholds,
} from '@/config/serviceRecords';
import { resetParsedEnvForTests } from '@/lib/env.schema';

type TestEnv = Record<string, unknown>;

type GlobalWithEnv = typeof globalThis & { __TEST_ENV__?: TestEnv };

const setTestEnv = (values: TestEnv) => {
  (globalThis as GlobalWithEnv).__TEST_ENV__ = values;
};

const clearTestEnv = () => {
  delete (globalThis as GlobalWithEnv).__TEST_ENV__;
};

describe('config/serviceRecords', () => {
  beforeEach(() => {
    resetParsedEnvForTests();
    resetServiceRecords();
    clearTestEnv();
  });

  afterEach(() => {
    resetParsedEnvForTests();
    resetServiceRecords();
    clearTestEnv();
  });

  it('exposes immutable defaults via constants', () => {
    expect(DISCREPANCY_THRESHOLD).toBe(0.75);
    expect(ABSENCE_MONTHLY_LIMIT).toBe(2);
    expect(FACILITY_CLOSE_TIME).toBe('18:00');
  });

  it('derives configured values from env schema', () => {
    setTestEnv({
      VITE_ATTENDANCE_DISCREPANCY_THRESHOLD: '1.1',
      VITE_ABSENCE_MONTHLY_LIMIT: '5',
      VITE_FACILITY_CLOSE_TIME: '6:45',
    });

    const config = getServiceRecordsConfig();

    expect(config.discrepancyThreshold).toBe(1.1);
    expect(config.absenceMonthlyLimit).toBe(5);
    expect(config.facilityCloseTime).toBe('6:45');

    const thresholds = getServiceThresholds();
    expect(thresholds).toEqual({ discrepancyMinutes: 66, absenceMonthlyLimit: 5, facilityCloseTime: '6:45' });
  });

  it('supports per-call overrides without disturbing cached config', () => {
    setTestEnv({
      VITE_ATTENDANCE_DISCREPANCY_THRESHOLD: '0.8',
      VITE_ABSENCE_MONTHLY_LIMIT: '3',
      VITE_FACILITY_CLOSE_TIME: '20:15',
    });

    const baseline = getServiceRecordsConfig();
    const override = getServiceRecordsConfig({ VITE_ATTENDANCE_DISCREPANCY_THRESHOLD: 1.9 });

    expect(baseline.discrepancyThreshold).toBe(0.8);
    expect(override.discrepancyThreshold).toBe(1.9);
    expect(getServiceRecordsConfig()).toEqual(baseline);
  });
});
